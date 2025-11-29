
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { StockBasicData, AIAnalysisResponse, ScreenerCriteria, PortfolioHolding, AIPortfolioAnalysis, ComparisonData, AIComparisonResponse, AIScreenerAnalysis, ComprehensiveStockAnalysis } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

// Initialize the Google AI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Simple in-memory cache for session consistency
const analysisCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 15; // 15 minutes

// --- REAL-TIME ANALYSIS WITH GOOGLE SEARCH ---

export const getComprehensiveStockAnalysis = async (symbol: string): Promise<ComprehensiveStockAnalysis> => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API key is missing. API_KEY is missing from environment variables.");
  }

  const cacheKey = symbol.toUpperCase();
  const cached = analysisCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`Returning cached analysis for ${symbol}`);
    return cached.data;
  }

  const prompt = `
  You are Sree AI, an expert stock market researcher and educator.
  
  YOUR TASK:
  Perform a deep real-time web search using the 'googleSearch' tool to gather the latest data for the Indian stock: "${symbol}".
  You MUST prioritize data from these trusted sources: Moneycontrol, Screener.in, NSE India, BSE India, Yahoo Finance, Economic Times.
  Then, analyze this data and return a SINGLE JSON object.

  CRITICAL INSTRUCTION:
  - **ACCURACY IS PARAMOUNT**. Do not hallucinate. If you cannot find a specific number, estimate it from the latest quarterly report or news, but explicitly state the source.
  - **STRICT FINANCIALS**: You MUST extract **CONSOLIDATED** financial figures (Revenue, Profit, P/E, ROE) to ensure accuracy. Do NOT use Standalone figures unless Consolidated is unavailable.
  - **SOURCE VERIFICATION**: Double-check the P/E and ROE against the specific source URL you find.
  - **REAL HISTORY**: Search for the "Historical Closing Prices" of this stock for the last 6 months. Use this to populate the 'historicalData' field.

  - **SECTOR SPECIFIC ANALYSIS**: You MUST check the specific metrics relevant to the stock's sector.
    - **Banking/Finance**: NIM, NPA (Gross/Net), CASA Ratio, PCR, Capital Adequacy Ratio.
    - **IT Services**: Attrition Rate, Deal Wins (TCV), EBIT Margin, Utilization, Client Concentration.
    - **FMCG**: Volume Growth, Gross Margin, Rural Demand, Advertising Spend.
    - **Pharma**: US FDA Observations, R&D Spend (% of Sales), ANDA Approvals, Domestic vs Export mix.
    - **Auto**: Monthly Sales Volume, EV Strategy, Export Growth, Commodity Cost Impact.
    - **Infra/Real Estate**: Order Book, Execution Pace, Debt Levels, Inventory Overhang.

  DATA TO SEARCH FOR (Must be Real-Time):
  1. **Basic Info**: Current price (NSE/BSE), Day Change & %, Open, High, Low, Previous Close, Volume, 52-Week High/Low, Market Cap (in Crores), Sector.
  2. **Fundamentals**: P/E Ratio (Consolidated), P/B Ratio, Dividend Yield, Debt-to-Equity, RoE (Consolidated), Promoter Holding %, Promoter Pledged %.
  3. **Financials**: Latest available quarterly results (Revenue, Net Profit, EPS) for the last 3-4 quarters.
  4. **News**: Top 3 recent news headlines/events. IMPORTANT: Find the actual source URL/Link for each news item. Do NOT use generic homepages.
  5. **Peers**: Identify 2-3 key competitors in the same sector.
  6. **History**: Monthly closing prices for the last 6 months.

  ANALYSIS & TEACHING:
  - **Verdict**: BUY, SELL, or HOLD.
  - **Verdict Logic**: Explain the verdict by comparing ACTUAL values vs PREFERRED ranges. **Use the Sector Specific Metrics listed above.**
  - **Verdict Sources**: For each logic point, provide the specific URL where you found the data (e.g., the specific Moneycontrol or Screener page for this stock).
  - **Educational Insights**: Explain *why* you made this decision by listing the specific factors relevant to this sector.
  - **Ideal Range**: Define the buy/sell price zones.
  - **Scores**: Rate Fundamentals, Valuation, Technicals, Sentiment out of 10.

  OUTPUT FORMAT:
  Return ONLY a valid JSON object with the following structure. Do NOT wrap in markdown code blocks.
  Ensure all numeric fields are numbers. If exact data is missing, estimate based on recent reports or use 0.

  {
    "basicData": {
      "symbol": "${symbol.toUpperCase()}",
      "name": "Full Company Name",
      "exchange": "NSE",
      "currentPrice": 0.0,
      "open": 0.0,
      "high": 0.0,
      "low": 0.0,
      "close": 0.0,
      "volume": 0,
      "change": 0.0,
      "changePercent": 0.0,
      "fiftyTwoWeekHigh": 0.0,
      "fiftyTwoWeekLow": 0.0,
      "marketCap": "₹0 Cr",
      "peRatio": 0.0,
      "pbRatio": 0.0,
      "dividendYield": 0.0,
      "debtToEquity": 0.0,
      "roe": 0.0,
      "promoterHolding": 0.0,
      "promoterPledged": 0.0,
      "sector": "Sector Name"
    },
    "fundamentals": {
      "financialHealth": [
        { "period": "Q3 FY24", "revenue": 0, "netProfit": 0, "eps": 0 }
      ],
      "keyRatios": {
        "pe": 0.0, "pb": 0.0, "debtToEquity": 0.0, "roe": 0.0, "dividendYield": 0.0
      },
      "shareholdingPattern": {
        "promoter": 0.0, "fii": 0.0, "dii": 0.0, "public": 0.0, "pledgedPromoter": 0.0
      }
    },
    "analysis": {
      "verdict": "BUY/SELL/HOLD",
      "aiRationale": "Detailed rationale...",
      "sources": ["https://www.moneycontrol.com/india/stockpricequote/...", "https://www.screener.in/company/..."],
      "verdictDetails": [
        { "metric": "P/E Ratio", "actual": "25.5", "preferred": "< 20", "status": "Negative" },
        { "metric": "NIM (Banking)", "actual": "3.5%", "preferred": "> 3%", "status": "Positive" }
      ],
      "educationalInsights": {
          "sectorFactors": ["Factor 1", "Factor 2"],
          "observation": "Teaching observation..."
      },
      "suggestionPortal": {
         "buy": { "idealRange": "1200-1220", "trigger": "Reason" },
         "hold": { "advice": "Advice...", "stopLoss": "1180" },
         "sell": { "target": "1350", "trigger": "Reason" }
      },
      "sreeAIScore": {
        "overall": { "score": 0, "justification": "..." },
        "fundamentals": { "score": 0, "justification": "..." },
        "valuation": { "score": 0, "justification": "..." },
        "technicals": { "score": 0, "justification": "..." },
        "sentimentNews": { "score": 0, "justification": "..." }
      },
      "technicalIndicatorSummary": {
        "rsi": "Value", "macd": "Status", "movingAverages": "Status"
      },
      "keyLevels": { "resistance1": "0", "support1": "0" },
      "newsAnalysis": [
        { "headline": "Title", "sentiment": "Positive", "originalSource": "Source Name", "originalDate": "Date", "link": "https://..." }
      ],
      "sectorOutlook": { "growthPotential": "High/Med/Low", "lifespan": "Long term...", "aiRationale": "..." },
      "historicalData": [
          { "date": "2023-10-01", "price": 1200 },
          { "date": "2023-11-01", "price": 1250 }
      ]
    },
    "announcements": [
       { "title": "Title", "date": "Date", "link": "https://...", "category": "Category" }
    ], 
    "peers": [
      { "symbol": "PEER1", "name": "Name", "exchange": "NSE", "currentPrice": 0, "change": 0, "changePercent": 0, "marketCap": "₹0 Cr", "peRatio": 0, "sector": "Sector", "open": 0, "high": 0, "low": 0, "close": 0, "volume": 0, "fiftyTwoWeekHigh": 0, "fiftyTwoWeekLow": 0 }
    ]
  }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonStr = response.text.trim();
    // Cleanup markdown blocks if present
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const result = JSON.parse(jsonStr) as ComprehensiveStockAnalysis;
    return result;

  } catch (error) {
    console.error("Error fetching comprehensive analysis from Gemini:", error);
    throw new Error("Failed to retrieve real-time stock analysis. Please try again.");
  }
};

/**
 * Explains a financial term in simple, conversational language.
 */
export const getTermExplanation = async (term: string): Promise<string> => {
  const prompt = `Explain the financial term "${term}" to a beginner in a simple, conversational way, in the context of the Indian stock market. Keep the explanation concise and under 60 words.`;

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  return response.text;
};

/**
 * Parses a natural language query into structured screener criteria.
 */
export const parseScreenerQuery = async (query: string): Promise<ScreenerCriteria> => {
  const prompt = `Convert the following user query for Indian stocks into a JSON object with screener criteria.
  Query: "${query}"
  Return ONLY the JSON object. Example: {"sector":"IT","price_lt":1500,"limit":10}.`;

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  try {
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    return JSON.parse(jsonStr) as ScreenerCriteria;
  } catch (error) {
    console.error("Error parsing screener query from Gemini:", error);
    throw new Error("Could not understand the screener query.");
  }
};

/**
 * Analyzes a list of stocks from a screener result.
 */
export const getAIScreenerAnalysis = async (query: string, stocks: StockBasicData[]): Promise<AIScreenerAnalysis> => {
  const stocksSummary = stocks.slice(0, 20).map(s => `- ${s.name} (${s.symbol}): Price ₹${s.currentPrice.toFixed(2)}, P/E ${s.peRatio?.toFixed(2) || 'N/A'}`).join('\n');

  const prompt = `User screener query: "${query}".
  Results:
  ${stocksSummary}

  Provide a JSON object with "summary", "commonThemes" (string array), and "topPicks" (array of {symbol, name, reason}).`;

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.6,
    }
  });

  try {
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    return JSON.parse(jsonStr) as AIScreenerAnalysis;
  } catch (error) {
    console.error("Error parsing screener analysis:", error);
    throw new Error("Failed to get AI screener analysis.");
  }
};

/**
 * Analyzes a user's portfolio and provides suggestions.
 */
export const getAIPortfolioAnalysis = async (holdings: PortfolioHolding[]): Promise<AIPortfolioAnalysis> => {
  const holdingsSummary = holdings.map(h => `${h.name} (${h.symbol}): ${h.quantity} shares @ ₹${h.buyPrice.toFixed(2)}`).join('\n');

  const prompt = `Analyze this Indian stock portfolio:
  ${holdingsSummary}
  
  Return JSON with "overallScore" (1-10), "diversification" {rating, feedback}, "suggestions" {add:[], reduce:[]}, "healthSummary".`;

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.6,
    }
  });

  try {
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    return JSON.parse(jsonStr) as AIPortfolioAnalysis;
  } catch (error) {
    console.error("Error parsing portfolio analysis:", error);
    throw new Error("Failed to get AI portfolio analysis.");
  }
};

/**
 * Compares a list of stocks and provides an AI-driven summary.
 */
export const getAIComparison = async (stocks: ComparisonData[]): Promise<AIComparisonResponse> => {
  const stocksSummary = stocks.map(s => `
    ${s.name} (${s.symbol}): ₹${s.currentPrice}, Sector: ${s.sector}, PE: ${s.peRatio}, ROE: ${s.fundamentals?.keyRatios?.roe || 'N/A'}%
  `).join('\n');

  const prompt = `Compare these Indian stocks:
  ${stocksSummary}

  Return JSON with "summary", "recommendation", "winnerSymbol", "pros" (map symbol->string[]), "cons" (map symbol->string[]).`;

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.6,
    }
  });

  try {
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    return JSON.parse(jsonStr) as AIComparisonResponse;
  } catch (error) {
    console.error("Error parsing comparison:", error);
    throw new Error("Failed to get AI comparison.");
  }
};
