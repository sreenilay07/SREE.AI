import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import Papa from 'papaparse';

import { normalizeSymbol, isValidSymbol } from './utils/symbolUtils.js';
import { searchInstruments, registerIsinMappings } from './services/upstoxService.js';
import {
  getSingleStockData,
  getBatchStockData,
  getHistoricalDataForSymbol,
  getIntradayDataForSymbol,
  getChartCandles
} from './services/marketDataService.js';
import { computeTechnicalAnalysis, calculateDynamicScoreAndVerdict } from './utils/technicalIndicators.js';
import { getTokenState, getTokenHealth, saveToken } from './services/tokenStore.js';
import { executeGroqRequest, getGroqClient } from './config/groqConfig.js';
import { classifySector, SECTORS_METRIC_MAP } from './config/sectorConfig.js';
import { getStockFundamentals } from './services/fundamentalsService.js';
import tradingRoutes from './routes/tradingRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware (Helmet & Explicit CORS Allowlist)
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
    }
  },
  credentials: true
}));

app.use(express.json());

// Express Rate Limiters
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 mins
  message: { error: 'TOO_MANY_REQUESTS', reason: 'Too many requests from this IP, please try again later.' }
});

const researchAnalysisLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit each IP to 15 analysis calls per minute
  message: { error: 'TOO_MANY_REQUESTS', reason: 'Stock analysis rate limit exceeded. Please wait a minute.' }
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit chatbot calls per minute
  message: { error: 'TOO_MANY_REQUESTS', reason: 'Chatbot rate limit exceeded. Please slow down.' }
});

app.use('/api/', generalApiLimiter);

// In-memory stock list loaded from EQUITY_L.csv
let allStocks = [];
let isLoaded = false;

const loadStocksFromCSV = () => {
  try {
    const csvPath = path.join(process.cwd(), 'EQUITY_L.csv');
    if (fs.existsSync(csvPath)) {
      const csvText = fs.readFileSync(csvPath, 'utf8');
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const isinMap = {};
          allStocks = results.data
            .map((rawRow) => {
              const row = {};
              for (const [k, v] of Object.entries(rawRow)) {
                if (k) row[k.trim()] = v;
              }
              return row;
            })
            .filter((row) => row['SYMBOL'] && row['NAME OF COMPANY'])
            .flatMap((row) => {
              const symbol = row['SYMBOL'].trim().toUpperCase();
              const name = row['NAME OF COMPANY'].trim();
              const isin = (row['ISIN NUMBER'] || row['ISIN'] || '').trim();
              if (symbol && isin) {
                isinMap[symbol] = isin;
              }
              const sector = classifySector(symbol, name);
              return [
                { symbol, name, exchange: 'NSE', sector, isin },
                { symbol: `${symbol}.BO`, name, exchange: 'BSE', sector, isin }
              ];
            });
          registerIsinMappings(isinMap);
          isLoaded = true;
          console.log(`[CSV LOADER] Successfully loaded ${allStocks.length} stocks from CSV with ${Object.keys(isinMap).length} ISIN mappings.`);
        },
        error: (err) => {
          console.error('[CSV LOADER] Error parsing CSV:', err);
        }
      });
    } else {
      console.warn('[CSV LOADER] EQUITY_L.csv not found. Stock search fallback will be used.');
    }
  } catch (error) {
    console.error('[CSV LOADER] Failed to load stock CSV:', error);
  }
};

// Initial load
loadStocksFromCSV();

const sanitizeJson = (jsonStr) => {
  if (!jsonStr) return '{}';
  let s = jsonStr.trim();
  const fenceRE = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = s.match(fenceRE);
  if (match && match[2]) s = match[2].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) s = s.substring(start, end + 1);
  return s;
};

const safeExtractText = (response) => {
  if (!response) return '';
  if (typeof response === 'string') return response;
  return response.content || '';
};

// --- AUTH / UPSTOX TOKEN LIFECYCLE ENDPOINTS ---

// Interactive OAuth Login Redirect
app.get('/api/auth/upstox/login', (req, res) => {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI || `http://localhost:${PORT}/api/auth/upstox/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'UPSTOX_CLIENT_ID is missing in server environment variables.' });
  }

  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  console.log(`[UPSTOX AUTH] Redirecting to authorization URL for Client ID: ${clientId}`);
  return res.redirect(authUrl);
});

// OAuth Callback Endpoint
app.get('/api/auth/upstox/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code missing in callback parameters.' });
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI || `http://localhost:${PORT}/api/auth/upstox/callback`;

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[UPSTOX AUTH] Token exchange failed:', errBody);
      return res.status(tokenRes.status).send(`Failed to exchange token: ${errBody}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    saveToken({ accessToken, expiresIn });

    return res.send(`
      <!TextInput>
      <html>
        <head><title>Upstox Re-Authentication Successful</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc;">
          <h2 style="color: #22c55e;">Upstox OAuth Token Updated Successfully!</h2>
          <p>The token has been persisted to disk. You can close this tab and return to SREE.AI.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #38bdf8; text-decoration: underline;">Return to App</a>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[UPSTOX AUTH] Error in callback handler:', err);
    return res.status(500).send(`OAuth Error: ${err.message}`);
  }
});

// Admin / Status Check Endpoint
app.get('/api/auth/upstox/status', (req, res) => {
  const health = getTokenHealth();
  return res.json(health);
});


// --- ML INTRADAY TRADING ROUTES ---
app.use('/api/trading', tradingRoutes);

// --- STOCK & RESEARCH API ENDPOINTS ---

// Stock list search - Upstox + local CSV search
app.get('/api/stocks/search', async (req, res) => {
  const query = (req.query.query || '').trim().toLowerCase();
  if (!query) {
    return res.json([]);
  }

  // Local CSV search results
  const localResults = allStocks.filter(
    (stock) =>
      stock.name.toLowerCase().includes(query) ||
      stock.symbol.toLowerCase().includes(query)
  ).slice(0, 15);

  // Upstox API instrument search
  try {
    const upstoxResults = await searchInstruments(query);
    if (upstoxResults && upstoxResults.length > 0) {
      const merged = [...upstoxResults];
      for (const loc of localResults) {
        if (!merged.some(m => m.symbol.toUpperCase() === loc.symbol.toUpperCase())) {
          merged.push(loc);
        }
      }
      return res.json(merged.slice(0, 15));
    }
  } catch (err) {
    console.warn('[Search] Upstox search fallback to local CSV:', err.message);
  }

  return res.json(localResults);
});

// Single stock details - Upstox powered
app.get('/api/stocks/:symbol', async (req, res) => {
  const inputSym = req.params.symbol;
  if (!isValidSymbol(inputSym)) {
    return res.status(400).json({ error: "INVALID_SYMBOL", message: "Symbol contains invalid characters or length." });
  }

  const { cleanSymbol, exchange } = normalizeSymbol(inputSym);
  const stock = allStocks.find((s) => s.symbol.toUpperCase() === cleanSymbol || s.symbol.toUpperCase() === inputSym.toUpperCase());

  try {
    const stockData = await getSingleStockData(cleanSymbol, stock);
    
    // Explicit failure check (do not return fake ₹0 data)
    if (!stockData || stockData.currentPrice === 0) {
      return res.status(503).json({
        error: "MARKET_DATA_UNAVAILABLE",
        reason: "Upstox access token expired or market quote service offline.",
        retryAfter: 30
      });
    }

    return res.json(stockData);
  } catch (err) {
    console.error(`Error fetching single stock details for ${inputSym}:`, err.message);
    return res.status(503).json({
      error: "MARKET_DATA_UNAVAILABLE",
      reason: "Upstox token expired or market quote service error.",
      retryAfter: 30
    });
  }
});

// Historical candle data endpoint
app.get('/api/stocks/:symbol/historical', async (req, res) => {
  const inputSym = req.params.symbol;
  if (!isValidSymbol(inputSym)) {
    return res.status(400).json({ error: "INVALID_SYMBOL", message: "Symbol contains invalid characters." });
  }

  const unit = req.query.unit || 'days';
  const interval = req.query.interval || '1';

  try {
    const candles = await getHistoricalDataForSymbol(inputSym, { unit, interval });
    return res.json(candles);
  } catch (err) {
    console.error(`Historical fetch failed for ${inputSym}:`, err.message);
    return res.json([]);
  }
});

// Intraday candle data endpoint
app.get('/api/stocks/:symbol/intraday', async (req, res) => {
  const inputSym = req.params.symbol;
  if (!isValidSymbol(inputSym)) {
    return res.status(400).json({ error: "INVALID_SYMBOL", message: "Symbol contains invalid characters." });
  }

  const unit = req.query.unit || 'minutes';
  const interval = req.query.interval || '5';

  try {
    const candles = await getIntradayDataForSymbol(inputSym, { unit, interval });
    return res.json(candles);
  } catch (err) {
    console.error(`Intraday fetch failed for ${inputSym}:`, err.message);
    return res.json([]);
  }
});

// Batch stocks details - Powered by Upstox batch market quotes
app.post('/api/stocks/batch', async (req, res) => {
  const { symbols } = req.body || {};
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.json([]);
  }

  // Filter out invalid symbols
  const validSymbols = symbols.filter(isValidSymbol);
  if (validSymbols.length === 0) return res.json([]);

  try {
    const results = await getBatchStockData(validSymbols, allStocks);
    return res.json(results);
  } catch (e) {
    console.error('Error fetching batch stocks:', e.message);
    return res.status(503).json({
      error: "MARKET_DATA_UNAVAILABLE",
      reason: "Unable to retrieve batch quotes from Upstox.",
      retryAfter: 30
    });
  }
});

// Financial term explanation dictionary fallback
const FINANCIAL_TERMS_DICTIONARY = {
  'Dividend Yield': 'Dividend Yield measures how much cash dividends a company pays out relative to its current share price. A higher yield indicates more income per rupee invested.',
  'P/E Ratio': 'Price-to-Earnings (P/E) ratio compares a stock price to its earnings per share. It helps investors gauge whether a stock is overvalued or undervalued relative to its peers.',
  'P/B Ratio': 'Price-to-Book (P/B) ratio evaluates a stock value compared to its net asset value per share. Lower P/B ratios can highlight potential value opportunities.',
  'Return on Equity (RoE)': 'Return on Equity (ROE) measures how effectively a company generates profits from shareholders equity capital. ROE above 15% is generally considered strong.',
  'Debt-to-Equity Ratio': 'Debt-to-Equity ratio compares total corporate debt against shareholder equity, indicating financial leverage and solvency risk. Lower ratio means safer balance sheet.',
  'Promoter Pledged Percentage': 'Promoter Pledged Percentage shows what portion of promoter-held shares are used as collateral for loans. High pledging (>15%) represents credit risk.',
  'Market Cap': 'Market Capitalization is the total market value of all outstanding shares of a company, categorizing it as Large-cap, Mid-cap, or Small-cap.',
  'RSI': 'Relative Strength Index (RSI) measures price momentum on a scale of 0 to 100. Above 70 is overbought; below 30 is oversold.',
  'MACD': 'Moving Average Convergence Divergence (MACD) tracks momentum trends between fast and slow exponential moving averages.'
};

// Financial term explanation
app.get('/api/term/explain', async (req, res) => {
  const { term } = req.query;
  if (!term) return res.send("No term specified.");

  const normalizedTerm = Object.keys(FINANCIAL_TERMS_DICTIONARY).find(k => k.toLowerCase() === term.trim().toLowerCase());

  try {
    const r = await executeGroqRequest(`Explain the financial term "${term}" for beginners. Be very concise (max 2-3 sentences), simple, and clear.`, { temperature: 0.2 });
    const text = safeExtractText(r);
    if (text && text.trim()) return res.send(text);
  } catch (e) {
    console.warn(`[TERM EXPLAIN] Groq unavailable for "${term}", using dictionary fallback.`);
  }

  if (normalizedTerm) {
    return res.send(FINANCIAL_TERMS_DICTIONARY[normalizedTerm]);
  }

  return res.send(`"${term}" is a key financial metric evaluated by equity analysts to assess corporate profitability and balance sheet strength.`);
});

// Screener Query Parsing
app.post('/api/screener/parse', async (req, res) => {
  const { query } = req.body || {};

  const localParse = (q) => {
    const lower = (q || '').toLowerCase();
    let sector = null;
    let price_lt = null;

    const sectorsList = ['banking', 'it services', 'pharma', 'fmcg', 'automobile', 'energy', 'metals', 'infrastructure', 'psu', 'renewable energy'];
    for (const sec of sectorsList) {
      if (lower.includes(sec)) {
        sector = sec.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        if (sector === 'It Services') sector = 'IT Services';
        if (sector === 'Fmcg') sector = 'FMCG';
        if (sector === 'Psu') sector = 'PSU';
        break;
      }
    }

    const match = lower.match(/(?:under|below|less than|\bval\b|\blt\b)\s*(\d+)/) || lower.match(/(\d+)\s*(?:under|below|less than)/);
    if (match && match[1]) {
      price_lt = parseInt(match[1]);
    }

    return { sector, price_lt, limit: 30 };
  };

  try {
    const prompt = `Convert the natural language investment criteria query "${query}" to a JSON filter object. Valid JSON structure: { "sector": "Banking" | "IT Services" | "FMCG" | "Automobile" | "Pharma" | "Energy" | "Metals" | "Infrastructure" | "PSU" | "Renewable Energy", "price_lt": number, "limit": number }. Keep values null if not mentioned. Do not write text, return only JSON.`;
    const r = await executeGroqRequest(prompt, { temperature: 0, responseMimeType: 'application/json' });
    const criteria = JSON.parse(sanitizeJson(safeExtractText(r) || '{}'));

    if (!criteria.sector && !criteria.price_lt) {
      return res.json(localParse(query));
    }

    return res.json(criteria);
  } catch (e) {
    console.warn("Groq screener parsing failed, falling back to local NLP parser:", e.message);
    return res.json(localParse(query));
  }
});

// AI Screener Results Analysis
app.post('/api/screener/analyze', async (req, res) => {
  const { query, stocks } = req.body || {};
  const stocksStr = (stocks || []).slice(0, 8).map(s => `${s.symbol} (₹${s.currentPrice})`).join(', ');
  const prompt = `Analyze these search results for query "${query}": ${stocksStr}. Return JSON with:
  {
    "summary": "Short overview analysis",
    "commonThemes": ["Theme 1", "Theme 2"],
    "topPicks": [{"symbol": "...", "name": "...", "reason": "why chosen"}]
  }`;
  try {
    const r = await executeGroqRequest(prompt, { responseMimeType: 'application/json' });
    return res.json(JSON.parse(sanitizeJson(safeExtractText(r))));
  } catch (e) {
    console.error("Screener analysis error:", e.message);
    return res.status(500).json({ error: "Screener analysis failed." });
  }
});

// AI Portfolio Auditor
app.post('/api/portfolio/analyze', async (req, res) => {
  const { holdings } = req.body || {};
  const holdingsStr = (holdings || []).map(h => `${h.symbol}: Quantity ${h.quantity}, Avg Cost ₹${h.buyPrice}`).join(', ');
  const prompt = `Analyze this user stock portfolio: ${holdingsStr}. Evaluate diversification, concentration risks, and sectors. Return JSON in exact format:
  {
    "overallScore": 8,
    "diversification": {
      "rating": "Good",
      "feedback": "..."
    },
    "suggestions": {
      "add": ["sector/stock suggestion"],
      "reduce": ["sector/stock risk reduction"]
    },
    "healthSummary": "Overall detailed feedback"
  }`;
  try {
    const r = await executeGroqRequest(prompt, { responseMimeType: 'application/json' });
    return res.json(JSON.parse(sanitizeJson(safeExtractText(r))));
  } catch (e) {
    return res.status(500).json({ error: "Portfolio analysis failed." });
  }
});

// AI Stock Comparison
app.post('/api/stocks/compare', async (req, res) => {
  const { stocks } = req.body || {};
  const sStr = (stocks || []).map(s => `${s.symbol} (Price: ₹${s.currentPrice}, P/E: ${s.peRatio !== null && s.peRatio !== undefined ? s.peRatio : 'N/A'}, M-Cap: ${s.marketCap || 'N/A'})`).join(', ');
  const prompt = `Perform a comprehensive financial comparison for long-term investment between these stocks: ${sStr}. Return JSON in exact format:
  {
    "summary": "Comparative summary",
    "recommendation": "Final recommendation for long term",
    "winnerSymbol": "SYMBOL_OF_WINNER",
    "pros": {
      "SYMBOL1": ["pro 1", "pro 2"],
      "SYMBOL2": ["pro 1", "pro 2"]
    },
    "cons": {
      "SYMBOL1": ["con 1", "con 2"],
      "SYMBOL2": ["con 1", "con 2"]
    }
  }`;
  try {
    const r = await executeGroqRequest(prompt, { responseMimeType: 'application/json' });
    return res.json(JSON.parse(sanitizeJson(safeExtractText(r))));
  } catch (e) {
    return res.status(500).json({ error: "Stock comparison failed." });
  }
});

// Chatbot Assistant API
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { stockData, messages, message } = req.body || {};
  if (!stockData || !message) {
    return res.status(400).json({ text: "Missing stock data or prompt message." });
  }

  const systemInstruction = `You are Sree AI, a helpful and friendly chatbot assistant for the stock ${stockData.name} (${stockData.symbol}). The stock's current price is ₹${(stockData.currentPrice || 0).toFixed(2)}. Its sector is ${stockData.sector}. The 52-week high is ₹${(stockData.fiftyTwoWeekHigh || 0).toFixed(2)} and the low is ₹${(stockData.fiftyTwoWeekLow || 0).toFixed(2)}. The P/E ratio is ${stockData.peRatio !== null && stockData.peRatio !== undefined ? stockData.peRatio : 'N/A'}. Promoter holding is ${stockData.promoterHolding ? (stockData.promoterHolding || 0).toFixed(2) + '%' : 'N/A'}. Your role is to answer user questions about this specific stock based on the real data provided and general market knowledge. Be concise and clear. Explain financial terms simply if asked. You MUST NOT give direct financial advice. Keep the conversation strictly focused on the stock: ${stockData.name}.`;

  const prompt = [
    { role: 'system', content: systemInstruction },
    ...(messages || []).map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text
    })),
    { role: 'user', content: message }
  ];

  try {
    const content = await executeGroqRequest(prompt, { temperature: 0.7 });
    return res.json({ text: content || '' });
  } catch (e) {
    console.error('Chat error:', e.message);
    return res.json({ text: `For ${stockData.name} (${stockData.symbol}), current price is ₹${stockData.currentPrice} with P/E ratio ${stockData.peRatio || 'N/A'}. Let me know if you need specific technical or fundamental details!` });
  }
});

// Dedicated Chart Candles API
app.get('/api/stocks/:symbol/chart', async (req, res) => {
  const inputSym = req.params.symbol;
  if (!isValidSymbol(inputSym)) {
    return res.status(400).json({ error: "INVALID_SYMBOL", message: "Symbol contains invalid characters." });
  }

  const timeframe = (req.query.timeframe || '1D').toUpperCase();
  const { cleanSymbol } = normalizeSymbol(inputSym);

  try {
    const chartResult = await getChartCandles(cleanSymbol, timeframe);
    return res.json(chartResult);
  } catch (err) {
    console.error(`[CHART API] Error fetching chart for ${cleanSymbol} (${timeframe}):`, err.message);
    return res.status(500).json({ error: 'Failed to fetch chart data', candles: [], isPreviousSession: false });
  }
});

// CORE RESEARCH AGENT & SECTOR INTELLIGENCE API
app.get('/api/stocks/analysis/:symbol', researchAnalysisLimiter, async (req, res) => {
  const inputSym = req.params.symbol;
  if (!isValidSymbol(inputSym)) {
    return res.status(400).json({ error: "INVALID_SYMBOL", message: "Symbol contains invalid characters." });
  }

  const { cleanSymbol, exchange } = normalizeSymbol(inputSym);
  console.log(`[CORE ENGINE] Starting comprehensive research for ${cleanSymbol} (${exchange})...`);

  const stockInDb = allStocks.find(s => s.symbol.toUpperCase() === cleanSymbol || s.symbol.toUpperCase() === inputSym.toUpperCase());

  // 1. Fetch Real Live Market Quote from Upstox
  let liveQuote = null;
  try {
    liveQuote = await getSingleStockData(cleanSymbol, stockInDb);
  } catch (err) {
    console.error(`[LIVE DATA] Upstox quote fetch failed for ${cleanSymbol}:`, err.message);
  }

  // GUARNAL & FAILURE HANDLING (Phase 2): Stop masking errors as zeros!
  if (!liveQuote || liveQuote.currentPrice === 0) {
    const health = getTokenHealth();
    console.warn(`[CORE ENGINE] Market data unavailable for ${cleanSymbol}. Upstox health: ${health.status}`);
    return res.status(503).json({
      error: "MARKET_DATA_UNAVAILABLE",
      reason: health.status === 'EXPIRED' 
        ? "Upstox access token expired. Re-authenticate at /api/auth/upstox/login." 
        : "Market data service is temporarily offline or returned zero quote.",
      retryAfter: 30
    });
  }

  console.log(`[LIVE DATA] Verified Upstox live price for ${cleanSymbol}: ₹${liveQuote.currentPrice}`);

  // 2. Fetch Live Fundamentals from Upstox Company Fundamentals API
  let fundamentals = { isAvailable: false, keyRatios: {}, shareholdingPattern: {}, financialHealth: [] };
  try {
    fundamentals = await getStockFundamentals(cleanSymbol, { currentPrice: liveQuote.currentPrice });
  } catch (fundErr) {
    console.warn(`[FUNDAMENTALS] Failed fetching Upstox fundamentals for ${cleanSymbol}:`, fundErr.message);
  }

  // 3. Fetch Recent Candles & Compute Technicals
  let techMetrics = { rsi: null, macd: null, pivotPoints: null, summary: { rsiText: 'N/A', macdText: 'N/A', movingAveragesText: 'N/A' } };
  try {
    const chartData = await getChartCandles(cleanSymbol, '6M');
    if (chartData?.candles?.length > 0) {
      techMetrics = computeTechnicalAnalysis(chartData.candles);
    }
  } catch (techErr) {
    console.warn(`[TECHNICALS] Failed computing technical indicators for ${cleanSymbol}:`, techErr.message);
  }

  const dynamicVerdictObj = calculateDynamicScoreAndVerdict(techMetrics, liveQuote);

  // 4. Compose Prompt for LLM
  const peCompany = fundamentals.metrics?.pe?.company_value || (fundamentals.peRatio !== null ? String(fundamentals.peRatio) : 'N/A');
  const peSector = fundamentals.metrics?.pe?.sector_value ? `(Sector Avg: ${fundamentals.metrics.pe.sector_value})` : '';
  const roeCompany = fundamentals.metrics?.roe?.company_value || (fundamentals.roe !== null ? `${fundamentals.roe}%` : 'N/A');
  const roeSector = fundamentals.metrics?.roe?.sector_value ? `(Sector Avg: ${fundamentals.metrics.roe.sector_value})` : '';
  const pbCompany = fundamentals.metrics?.pb?.company_value || (fundamentals.pbRatio !== null ? String(fundamentals.pbRatio) : 'N/A');
  const pbSector = fundamentals.metrics?.pb?.sector_value ? `(Sector Avg: ${fundamentals.metrics.pb.sector_value})` : '';

  const prompt = `
  Analyze the Indian stock: "${liveQuote.name} (${liveQuote.symbol})".
  Date Context: Current year is 2026.
  
  REAL-TIME MARKET & FUNDAMENTAL DATA FROM UPSTOX API (DO NOT ALTER OR INVENT THESE NUMBERS):
  - Current Price: ₹${liveQuote.currentPrice}
  - Open: ₹${liveQuote.open}
  - Day High / 52W High: ₹${liveQuote.high} / ₹${liveQuote.fiftyTwoWeekHigh}
  - Day Low / 52W Low: ₹${liveQuote.low} / ₹${liveQuote.fiftyTwoWeekLow}
  - Previous Close: ₹${liveQuote.close}
  - Volume: ${liveQuote.volume}
  - Change: ₹${liveQuote.change} (${liveQuote.changePercent}%)
  - Market Cap: ${liveQuote.marketCap}
  - P/E Ratio: ${peCompany} ${peSector}
  - P/B Ratio: ${pbCompany} ${pbSector}
  - Return on Equity (ROE): ${roeCompany} ${roeSector}
  - Debt-to-Equity: ${fundamentals.debtToEquity !== null ? fundamentals.debtToEquity : 'N/A'}
  - Dividend Yield: ${fundamentals.dividendYield !== null ? fundamentals.dividendYield + '%' : 'N/A'}
  - Promoter Holding: ${fundamentals.promoterHolding !== null ? fundamentals.promoterHolding + '%' : 'N/A'}

  COMPUTED TECHNICAL INDICATORS (CALCULATED FROM UPSTOX CANDLE DATA):
  - RSI (14): ${techMetrics.summary.rsiText}
  - MACD (12,26,9): ${techMetrics.summary.macdText}
  - Moving Average Status: ${techMetrics.summary.movingAveragesText}
  - Pivot Level (S1 / R1): ${techMetrics.pivotPoints ? `Support: ₹${techMetrics.pivotPoints.support1}, Resistance: ₹${techMetrics.pivotPoints.resistance1}` : 'N/A'}

  CRITICAL DATA INTEGRITY INSTRUCTIONS:
  - All numeric market and fundamental data in this context comes directly from Upstox API. Do not change, guess, or fabricate unavailable metrics.
  - If a metric is labeled N/A or null, keep it as null in JSON (or N/A in text explanations). Do NOT invent fake numbers.

  YOUR VERDICT AND ANALYSIS MUST BE EXTREMELY PROFESSIONAL, SPECIFIC, AND ACCURATE:
  - In "verdict", you MUST ONLY return strictly one of "BUY", "HOLD", or "SELL".
  - In "aiRationale", write a detailed 3-4 paragraph deep financial analysis referencing current price ₹${liveQuote.currentPrice}, fundamental metrics vs sector benchmarks, technical indicators (RSI ${techMetrics.rsi || 'N/A'}), and sector dynamics.
  
  Return ONLY a complete, valid JSON output in this exact schema:
  {
    "basicData": {
      "symbol": "${liveQuote.symbol}",
      "name": "${liveQuote.name}",
      "exchange": "${liveQuote.exchange}",
      "currentPrice": ${liveQuote.currentPrice},
      "open": ${liveQuote.open},
      "high": ${liveQuote.high},
      "low": ${liveQuote.low},
      "close": ${liveQuote.close},
      "volume": ${liveQuote.volume},
      "change": ${liveQuote.change},
      "changePercent": ${liveQuote.changePercent},
      "fiftyTwoWeekHigh": ${liveQuote.fiftyTwoWeekHigh},
      "fiftyTwoWeekLow": ${liveQuote.fiftyTwoWeekLow},
      "marketCap": "${liveQuote.marketCap}",
      "peRatio": ${fundamentals.peRatio !== null ? fundamentals.peRatio : null},
      "sector": "${liveQuote.sector || 'General'}"
    },
    "fundamentals": ${JSON.stringify(fundamentals)},
    "analysis": {
      "verdict": "${dynamicVerdictObj.verdict}",
      "confidence": ${dynamicVerdictObj.confidence},
      "aiRationale": "Detailed summary referencing Upstox market data, sector dynamics, and technical levels.",
      "suggestionPortal": {
        "buy": { "idealRange": "exact price range e.g. ₹2180.00 - ₹2200.80", "trigger": "technical trigger WITH EXACT PRICE RANGE e.g. Breakout above ₹2232.60" },
        "hold": { "advice": "holding target details", "stopLoss": "exact stop-loss price e.g. ₹2150.00" },
        "sell": { "target": "profit booking target price e.g. ₹2350.00", "trigger": "exit trigger WITH EXACT PRICE RANGE e.g. Break below key support level ₹2180.00 - ₹2185.50" }
      },
      "technicalIndicatorSummary": { 
        "rsi": "${techMetrics.summary.rsiText}", 
        "macd": "${techMetrics.summary.macdText}", 
        "movingAverages": "${techMetrics.summary.movingAveragesText}" 
      },
      "newsAnalysis": [],
      "sectorOutlook": {
        "growthPotential": "High",
        "lifespan": "5-10 Years",
        "aiRationale": "Long term growth tailwinds for this sector."
      }
    }
  }
  `;

  let aiRationale = `Quantitative synthesis based on Upstox real market data for ${liveQuote.symbol} at ₹${liveQuote.currentPrice}.`;
  let parsedAi = {};

  try {
    const r = await executeGroqRequest(prompt, { responseMimeType: 'application/json' });
    const text = safeExtractText(r);
    const sanitized = sanitizeJson(text);
    parsedAi = JSON.parse(sanitized);
    if (parsedAi.analysis?.aiRationale) {
      aiRationale = parsedAi.analysis.aiRationale;
    }
  } catch (groqErr) {
    console.warn(`[GROQ ENGINE] AI commentary fallback engaged for ${cleanSymbol}:`, groqErr.message);
  }

  // Construct canonical verified response object
  const overallScore = dynamicVerdictObj.score;
  const techScore = techMetrics.rsi ? Number(Math.min(Math.max((techMetrics.rsi / 10), 1), 10).toFixed(1)) : overallScore;
  const valScore = liveQuote.peRatio ? Number(Math.min(Math.max((40 - liveQuote.peRatio) / 3, 2), 9).toFixed(1)) : overallScore;
  const fundScore = liveQuote.roe ? Number(Math.min(Math.max(liveQuote.roe / 4, 3), 9.5).toFixed(1)) : overallScore;

  const responseObj = {
    basicData: {
      symbol: liveQuote.symbol,
      name: liveQuote.name,
      exchange: liveQuote.exchange,
      sector: liveQuote.sector || 'General',
      currentPrice: liveQuote.currentPrice,
      open: liveQuote.open,
      high: liveQuote.high,
      low: liveQuote.low,
      close: liveQuote.close,
      volume: liveQuote.volume,
      change: liveQuote.change,
      changePercent: liveQuote.changePercent,
      fiftyTwoWeekHigh: liveQuote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: liveQuote.fiftyTwoWeekLow,
      marketCap: liveQuote.marketCap,
      peRatio: liveQuote.peRatio,
      pbRatio: liveQuote.pbRatio,
      dividendYield: liveQuote.dividendYield,
      debtToEquity: liveQuote.debtToEquity,
      roe: liveQuote.roe,
      promoterHolding: liveQuote.promoterHolding
    },
    fundamentals: {
      financialHealth: (liveQuote.financialHealth && liveQuote.financialHealth.length > 0) ? liveQuote.financialHealth : (parsedAi.fundamentals?.financialHealth || []),
      keyRatios: {
        pe: liveQuote.peRatio,
        pb: liveQuote.pbRatio,
        debtToEquity: liveQuote.debtToEquity,
        roe: liveQuote.roe,
        dividendYield: liveQuote.dividendYield
      },
      shareholdingPattern: {
        promoter: liveQuote.promoterHolding,
        fii: liveQuote.fundamentals?.shareholdingPattern?.fii ?? null,
        dii: liveQuote.fundamentals?.shareholdingPattern?.dii ?? null,
        public: liveQuote.fundamentals?.shareholdingPattern?.public ?? null,
        pledgedPromoter: liveQuote.fundamentals?.shareholdingPattern?.pledgedPromoter ?? 0.0
      }
    },
    analysis: {
      verdict: dynamicVerdictObj.verdict,
      score: overallScore,
      confidence: dynamicVerdictObj.confidence,
      aiRationale,
      sreeAIScore: {
        overall: {
          score: overallScore,
          justification: `Quantitative synthesis based on Upstox real market data, price action, and technical momentum.`
        },
        fundamentals: {
          score: fundScore,
          justification: liveQuote.roe ? `Return on Equity (ROE) of ${liveQuote.roe}% with market cap ${liveQuote.marketCap}.` : `Market cap: ${liveQuote.marketCap}. Balance sheet and fundamental indicators evaluated.`
        },
        valuation: {
          score: valScore,
          justification: liveQuote.peRatio ? `Trailing P/E ratio is ${liveQuote.peRatio} with P/B ratio ${liveQuote.pbRatio || 'N/A'}.` : `Valuation assessed relative to current price ₹${liveQuote.currentPrice}.`
        },
        technicals: {
          score: techScore,
          justification: techMetrics.summary?.rsiText ? `RSI (14): ${techMetrics.summary.rsiText}. Moving averages: ${techMetrics.summary.movingAveragesText}.` : `Technical momentum analyzed from 6M OHLC candles.`
        },
        sentimentNews: {
          score: overallScore,
          justification: `Live order flow, session volume (${liveQuote.volume}), and price change (${liveQuote.changePercent}%).`
        }
      },
      suggestionPortal: (() => {
        const supPrice = techMetrics.pivotPoints?.support1 || (liveQuote.currentPrice * 0.95).toFixed(2);
        const supLow = (parseFloat(supPrice) * 0.998).toFixed(2);
        const resPrice = techMetrics.pivotPoints?.resistance1 || (liveQuote.currentPrice * 1.05).toFixed(2);
        const resHigh = (parseFloat(resPrice) * 1.002).toFixed(2);

        const formatTrig = (trigText, isSell = false) => {
          let str = (trigText || '').trim();
          if (!str || str === 'N/A') {
            str = isSell ? "Break below key support level" : "Breakout above short-term resistance";
          }
          if (!/\d/.test(str)) {
            if (isSell || str.toLowerCase().includes('support') || str.toLowerCase().includes('below')) {
              str = `${str} ₹${supLow} - ₹${supPrice}`;
            } else {
              str = `${str} ₹${resPrice} - ₹${resHigh}`;
            }
          }
          return str;
        };

        const rawBuy = parsedAi.analysis?.suggestionPortal?.buy;
        const rawHold = parsedAi.analysis?.suggestionPortal?.hold;
        const rawSell = parsedAi.analysis?.suggestionPortal?.sell;

        return {
          buy: {
            idealRange: rawBuy?.idealRange || `₹${(liveQuote.currentPrice * 0.97).toFixed(2)} - ₹${liveQuote.currentPrice.toFixed(2)}`,
            trigger: formatTrig(rawBuy?.trigger, false)
          },
          hold: {
            advice: rawHold?.advice || "Hold with long-term perspective",
            stopLoss: rawHold?.stopLoss || `₹${(liveQuote.currentPrice * 0.93).toFixed(2)}`
          },
          sell: {
            target: rawSell?.target || `₹${(liveQuote.currentPrice * 1.12).toFixed(2)}`,
            trigger: formatTrig(rawSell?.trigger, true)
          }
        };
      })(),
      technicalIndicatorSummary: techMetrics.summary,
      keyLevels: {
        resistance1: techMetrics.pivotPoints ? `₹${techMetrics.pivotPoints.resistance1}` : `₹${(liveQuote.currentPrice * 1.05).toFixed(2)}`,
        support1: techMetrics.pivotPoints ? `₹${techMetrics.pivotPoints.support1}` : `₹${(liveQuote.currentPrice * 0.95).toFixed(2)}`
      },
      verdictDetails: dynamicVerdictObj.verdictDetails || [],
      newsAnalysis: parsedAi.analysis?.newsAnalysis || [],
      sectorOutlook: parsedAi.analysis?.sectorOutlook || {
        growthPotential: "High",
        lifespan: "5-10 Years",
        aiRationale: "Long-term sector structural growth drivers."
      }
    },
    announcements: [],
    peers: []
  };

  return res.json(responseObj);
});

// Root path confirmation
app.get('/', (req, res) => {
  const health = getTokenHealth();
  res.send(`SreeAI stock research backend is running smoothly. Upstox Token Status: ${health.status}`);
});

app.listen(PORT, () => {
  console.log(`[SERVER] Backend running on port ${PORT}`);
  const health = getTokenHealth();
  console.log(`[SERVER] Boot Token Health Check: ${health.message}`);
});
