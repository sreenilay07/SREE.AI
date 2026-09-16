import Papa from 'papaparse';
import { StockIdentifier, StockBasicData, StockFundamentalData, NewsItemRaw, CorporateAnnouncement, ChartInterval, ScreenerCriteria } from '../types';
import { CanonicalCandle } from '../utils/marketSessionUtils';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://sree-ai.onrender.com' : '');

const classifySector = (symbol: string, name: string): string => {
  const sym = symbol.toUpperCase();
  const nm = name.toLowerCase();

  // Renewable Energy
  if (sym === 'SUZLON' || sym === 'ADANIGREEN' || sym === 'IREDA' || nm.includes('green energy') || nm.includes('solar') || nm.includes('renewable') || nm.includes('wind power')) {
    return 'Renewable Energy';
  }
  // Banking
  if (sym.endsWith('BANK') || nm.includes(' bank ') || nm.includes(' bank') || nm.includes('banking') || nm.includes('cooperative bank')) {
    return 'Banking';
  }
  // IT Services
  if (sym === 'TCS' || sym === 'INFY' || sym === 'HCLTECH' || sym === 'WIPRO' || sym === 'COFORGE' || sym === 'LTIM' || sym === 'TECHM' || nm.includes('technology') || nm.includes('technologies') || nm.includes('software') || nm.includes('infotech') || nm.includes('consultancy services') || nm.includes('digital solutions')) {
    return 'IT Services';
  }
  // Pharma
  if (sym === 'SUNPHARMA' || sym === 'CIPLA' || sym === 'DRREDDY' || nm.includes('pharma') || nm.includes('pharmaceutical') || nm.includes('healthcare') || nm.includes('drugs') || nm.includes('laboratories') || nm.includes('hospitals') || nm.includes('lifesciences')) {
    return 'Pharma';
  }
  // FMCG
  if (sym === 'ITC' || sym === 'HINDUNILVR' || sym === 'NESTLEIND' || sym === 'BRITANNIA' || nm.includes('consumer') || nm.includes('foods') || nm.includes('breweries') || nm.includes('beverage') || nm.includes('agro') || nm.includes('sugar') || nm.includes('dairy') || nm.includes('distillers') || nm.includes('spices')) {
    return 'FMCG';
  }
  // Automobile
  if (sym === 'TATAMOTORS' || sym === 'M&M' || sym === 'MARUTI' || sym === 'ASHOKLEY' || nm.includes('motors') || nm.includes('automotive') || nm.includes('auto ') || nm.includes('tyre') || nm.includes('bearing') || nm.includes('gears') || nm.includes('forgings')) {
    return 'Automobile';
  }
  // Energy
  if (sym === 'RELIANCE' || sym === 'ONGC' || sym === 'NTPC' || sym === 'POWERGRID' || nm.includes('power') || nm.includes('energy') || nm.includes('petroleum') || nm.includes('refining') || nm.includes('oil & gas') || nm.includes('coal')) {
    return 'Energy';
  }
  // Metals
  if (sym === 'TATASTEEL' || sym === 'JSWSTEEL' || sym === 'HINDALCO' || sym === 'VEDL' || nm.includes('steel') || nm.includes('metal') || nm.includes('iron') || nm.includes('aluminum') || nm.includes('zinc') || nm.includes('copper') || nm.includes('alloys')) {
    return 'Metals';
  }
  // Infrastructure
  if (sym === 'LT' || sym === 'DLF' || nm.includes('infrastructure') || nm.includes('construction') || nm.includes('developers') || nm.includes('realty') || nm.includes('estates') || nm.includes('cement') || nm.includes('housing') || nm.includes('infra')) {
    return 'Infrastructure';
  }
  // PSU
  if (sym === 'HAL' || sym === 'BEL' || sym === 'BHEL' || nm.includes('bharat electronics') || nm.includes('hindustan aeronautics') || nm.includes('corporation of india')) {
    return 'PSU';
  }

  return 'General';
};

// Cache for all stocks
let allStocksCache: StockIdentifier[] = [];
let isStocksLoaded = false;

const loadStocks = async (): Promise<void> => {
  if (isStocksLoaded) return;

  try {
    const response = await fetch('/EQUITY_L.csv');
    const csvText = await response.text();

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const parsedStocks: StockIdentifier[] = results.data
          .filter((row: any) => row['SYMBOL'] && row['NAME OF COMPANY'])
          .flatMap((row: any) => {
            const symbol = row['SYMBOL'].trim().toUpperCase();
            const name = row['NAME OF COMPANY'].trim();
            const sector = classifySector(symbol, name);
            return [
              { symbol, name, exchange: 'NSE', sector },
              { symbol: `${symbol}.BO`, name, exchange: 'BSE', sector }
            ];
          });

        allStocksCache = parsedStocks;
        isStocksLoaded = true;
        console.log(`Loaded ${allStocksCache.length} stocks from CSV.`);
      },
      error: (error: any) => {
        console.error("Error parsing stock CSV:", error);
      }
    });
  } catch (error) {
    console.error("Failed to load stock list:", error);
  }
};

// Initialize loading
loadStocks();

export const searchStocks = async (query: string): Promise<StockIdentifier[]> => {
  if (!query) return [];
  try {
    const response = await fetch(`${API_BASE}/api/stocks/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Backend search failed.");
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("Backend search failed, falling back to local search:", error);
    if (!isStocksLoaded) {
      await loadStocks();
    }
    const lowerQuery = query.toLowerCase();
    return allStocksCache.filter(
      (stock) =>
        stock.name.toLowerCase().includes(lowerQuery) ||
        stock.symbol.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
  }
};

export const getStockBasicData = async (symbol: string): Promise<StockBasicData | null> => {
  try {
    const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(symbol)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`[StockService] Failed to fetch basic data for ${symbol}:`, e);
  }

  if (!isStocksLoaded) await loadStocks();
  const found = allStocksCache.find(s => s.symbol === symbol.toUpperCase());
  return {
    symbol: symbol.toUpperCase(),
    name: found ? found.name : symbol.toUpperCase(),
    exchange: symbol.toUpperCase().endsWith('.BO') ? 'BSE' : 'NSE',
    currentPrice: 0,
    open: 0, high: 0, low: 0, close: 0, volume: 0, change: 0, changePercent: 0,
    fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: "N/A", sector: found ? found.sector || "General" : "General",
    peRatio: null, pbRatio: null, dividendYield: null, debtToEquity: null, roe: null, promoterHolding: null
  };
};

// Cache for price history
const priceHistoryCache = new Map<string, { data: CanonicalCandle[], timestamp: number }>();
const HISTORY_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

/**
 * Retrieves real canonical candlestick history for a given timeframe from Upstox backend.
 */
export const getStockPriceHistory = async (
  symbol: string,
  interval: ChartInterval,
  currentPrice: number
): Promise<CanonicalCandle[]> => {
  const cacheKey = `${symbol}-${interval}`;
  const cached = priceHistoryCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < HISTORY_CACHE_DURATION)) {
    return cached.data;
  }

  try {
    const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(symbol)}/chart?timeframe=${interval}`);
    if (res.ok) {
      const data = await res.json();
      const rawCandles = Array.isArray(data) ? data : (data.candles || []);
      if (Array.isArray(rawCandles) && rawCandles.length > 0) {
        const canonicalList: CanonicalCandle[] = rawCandles.map((c: any) => {
          const ts = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.datetime || c.timestamp || c.date).getTime();
          const open = c.open ?? c.close ?? currentPrice;
          const high = c.high ?? Math.max(open, c.close ?? currentPrice);
          const low = c.low ?? Math.min(open, c.close ?? currentPrice);
          const close = c.close ?? c.price ?? currentPrice;
          const volume = typeof c.volume === 'number' ? c.volume : null;

          return {
            timestamp: isNaN(ts) ? Date.now() : ts,
            datetime: c.datetime || new Date(ts).toISOString(),
            date: c.date || '',
            time: c.time || '',
            open,
            high,
            low,
            close,
            volume,
            price: close
          };
        });

        // Filter and sort ascending by timestamp
        const validSorted = canonicalList
          .filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
          .sort((a, b) => a.timestamp - b.timestamp);

        priceHistoryCache.set(cacheKey, { data: validSorted, timestamp: Date.now() });
        return validSorted;
      }
    }
  } catch (err) {
    console.warn(`[StockService] Failed to fetch real candle history for ${symbol}:`, err);
  }

  return [];
};

export const getStockFundamentalData = (_symbol: string): Promise<StockFundamentalData | null> => Promise.resolve(null);
export const getNewsItemsRaw = (_symbol: string): Promise<NewsItemRaw[]> => Promise.resolve([]);
export const getCorporateAnnouncements = (_symbol: string): Promise<CorporateAnnouncement[]> => Promise.resolve([]);
export const getSectorPeers = (_sector: string, _currentSymbol: string): Promise<StockIdentifier[]> => Promise.resolve([]);

export const filterStocks = async (criteria: ScreenerCriteria): Promise<StockBasicData[]> => {
  if (!isStocksLoaded) await loadStocks();

  let filtered = allStocksCache.filter(stock => {
    if (!criteria.exchange && stock.symbol.endsWith('.BO')) return false;
    if (criteria.exchange && stock.exchange !== criteria.exchange) return false;
    if (criteria.sector && stock.sector !== criteria.sector) return false;
    return true;
  });

  if (criteria.limit) {
    filtered = filtered.slice(0, criteria.limit);
  }

  // Batch fetch real quote details from backend
  try {
    const res = await fetch(`${API_BASE}/api/stocks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: filtered.map(s => s.symbol) })
    });
    if (res.ok) {
      const batchData = await res.json();
      if (Array.isArray(batchData) && batchData.length > 0) {
        return batchData;
      }
    }
  } catch (e) {
    console.warn('[StockService] Batch fetch for screener failed:', e);
  }

  return filtered.map(s => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    sector: s.sector || 'General',
    currentPrice: 0, open: 0, high: 0, low: 0, close: 0, volume: 0, change: 0, changePercent: 0,
    fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: 'N/A',
    peRatio: null, pbRatio: null, dividendYield: null, debtToEquity: null, roe: null, promoterHolding: null
  }));
};

export const getSectors = (): string[] => {
  return ['Banking', 'IT Services', 'Pharma', 'FMCG', 'Automobile', 'Energy', 'Metals', 'Infrastructure', 'PSU', 'Renewable Energy'];
};
