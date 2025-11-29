import Papa from 'papaparse';
import { StockIdentifier, StockBasicData, StockFundamentalData, NewsItemRaw, CorporateAnnouncement, PriceDataPoint, CandleDataPoint, ChartInterval, ScreenerCriteria } from '../types';
import { MOCK_API_DELAY } from '../constants';

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
          .map((row: any) => ({
            symbol: row['SYMBOL'],
            name: row['NAME OF COMPANY'],
            exchange: 'NSE',
            // Sector might not be in this CSV, but we add the field for type compatibility
            sector: row['SECTOR'] || undefined
          }));

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

// --- HELPER FUNCTIONS ---

const isMarketOpen = (): boolean => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false; // Weekend

  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // NSE Market Hours: 9:15 AM to 3:30 PM
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;

  return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
};

// Simple seeded random number generator
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const generateMockCandleHistory = (basePrice: number, interval: ChartInterval, symbol: string = "STOCK"): CandleDataPoint[] => {
  const data: CandleDataPoint[] = [];
  const now = new Date();

  // Create a seed from the symbol string
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Configuration for each interval
  let daysToGenerate = 0;
  let candleDurationMinutes = 0; // 0 means daily candles

  switch (interval) {
    case '1D':
      daysToGenerate = 1; // Today
      candleDurationMinutes = 5; // 5 min candles
      break;
    case '1W':
      daysToGenerate = 7;
      candleDurationMinutes = 60; // 1 hour candles
      break;
    case '1M':
      daysToGenerate = 30;
      candleDurationMinutes = 0; // Daily candles
      break;
    case '1Y':
      daysToGenerate = 365;
      candleDurationMinutes = 0; // Daily candles
      break;
    case '5Y':
      daysToGenerate = 365 * 5;
      candleDurationMinutes = 0; // Weekly candles
      break;
    default:
      daysToGenerate = 1;
      candleDurationMinutes = 5;
  }

  if (interval === '1D') {
    // Special handling for Intraday (Today)
    const marketOpen = 9 * 60 + 15;
    const marketClose = 15 * 60 + 30;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const isMarketActive = isMarketOpen();
    const endMinute = isMarketActive ? Math.min(currentTotalMinutes, marketClose) : marketClose;

    // Start slightly off
    let tempPrice = basePrice * (0.99 + seededRandom(seed++) * 0.02);

    for (let minSinceOpen = 0; minSinceOpen <= (endMinute - marketOpen); minSinceOpen += candleDurationMinutes) {
      const totalMins = marketOpen + minSinceOpen;
      const hour = Math.floor(totalMins / 60);
      const minute = totalMins % 60;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      const progress = minSinceOpen / (endMinute - marketOpen || 1);
      // Less volatility for Area Chart
      const volatility = 0.001;
      const open = tempPrice;
      const noise = (seededRandom(seed++) - 0.5) * volatility;
      const weightedTarget = (tempPrice * (1 - progress)) + (basePrice * progress);
      const close = weightedTarget * (1 + noise);

      // High/Low not strictly needed for Area but good to have
      const high = Math.max(open, close);
      const low = Math.min(open, close);

      data.push({
        time,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2))
      });
      tempPrice = close;
    }
    // Anchor last point
    if (data.length > 0) {
      const last = data[data.length - 1];
      last.close = basePrice;
    }
    return data;
  }

  // Historical Data (Fallback Mock)
  let currentClose = basePrice;
  const points = interval === '5Y' ? 260 : (interval === '1Y' ? 250 : (interval === '1M' ? 30 : 35));

  for (let i = 0; i < points; i++) {
    const date = new Date();
    if (interval === '5Y') {
      date.setDate(date.getDate() - (i * 7));
    } else {
      date.setDate(date.getDate() - i);
    }

    const volatility = interval === '5Y' ? 0.03 : 0.015;
    const change = (seededRandom(seed++) - 0.48) * volatility;
    const prevClose = currentClose / (1 + change);

    data.unshift({
      time: date.toISOString().split('T')[0],
      open: prevClose,
      high: Math.max(prevClose, currentClose),
      low: Math.min(prevClose, currentClose),
      close: parseFloat(currentClose.toFixed(2))
    });

    currentClose = prevClose;
  }

  return data;
};

// --- SERVICES ---

export const searchStocks = async (query: string): Promise<StockIdentifier[]> => {
  if (!isStocksLoaded) {
    await loadStocks();
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      if (!query) {
        resolve([]);
        return;
      }
      const lowerQuery = query.toLowerCase();
      // Search in the full list
      const results = allStocksCache.filter(
        (stock) =>
          stock.name.toLowerCase().includes(lowerQuery) ||
          stock.symbol.toLowerCase().includes(lowerQuery)
      );
      resolve(results.slice(0, 10));
    }, MOCK_API_DELAY / 3);
  });
};

export const getStockBasicData = async (symbol: string): Promise<StockBasicData | null> => {
  // This function is now mostly bypassed by the main hook which gets data from Gemini.
  // However, it can still return a skeleton for initial loads if needed.
  if (!isStocksLoaded) await loadStocks();

  return new Promise((resolve) => {
    setTimeout(() => {
      const found = allStocksCache.find(s => s.symbol === symbol.toUpperCase());
      if (found) {
        resolve({
          ...found,
          currentPrice: 0,
          open: 0, high: 0, low: 0, close: 0, volume: 0, change: 0, changePercent: 0,
          fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: "Loading...", sector: "Loading..."
        });
      } else {
        // Fallback if not found in list but requested (e.g. from URL)
        resolve({
          symbol: symbol.toUpperCase(),
          name: symbol.toUpperCase(),
          exchange: 'NSE',
          currentPrice: 0,
          open: 0, high: 0, low: 0, close: 0, volume: 0, change: 0, changePercent: 0,
          fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: "Loading...", sector: "Loading..."
        });
      }
    }, MOCK_API_DELAY / 3);
  });
};

// Cache for price history to ensure chart stability
const priceHistoryCache = new Map<string, { data: CandleDataPoint[], timestamp: number }>();
const HISTORY_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

/**
 * Generates a mock candlestick history chart that is anchored to a real reference price.
 */
export const getStockPriceHistory = async (symbol: string, interval: ChartInterval, currentPrice: number, historicalData?: { date: string, price: number }[]): Promise<CandleDataPoint[]> => {
  const cacheKey = `${symbol}-${interval}`;
  const cached = priceHistoryCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < HISTORY_CACHE_DURATION)) {
    // If cached data exists and is fresh, return it to ensure the chart looks exactly the same
    // But we might need to update the *last* point to match the latest currentPrice if it changed significantly?
    // For stability, let's just return the cached one. The user prefers stability over live ticking.
    return cached.data;
  }

  // If we have real historical data from Gemini, use it for 1M, 1Y, 5Y
  if (historicalData && historicalData.length > 0 && ['1M', '1Y', '5Y'].includes(interval)) {
    const realData = historicalData.map(h => ({
      time: h.date,
      open: h.price,
      high: h.price,
      low: h.price,
      close: h.price
    })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    priceHistoryCache.set(cacheKey, { data: realData, timestamp: Date.now() });
    return realData;
  }

  // Fallback to mock generation if no real history or for Intraday
  return new Promise((resolve) => {
    setTimeout(() => {
      // Use the provided reference price or default to 1000
      const basePrice = currentPrice && currentPrice > 0 ? currentPrice : 1000;
      const generatedData = generateMockCandleHistory(basePrice, interval, symbol);

      priceHistoryCache.set(cacheKey, { data: generatedData, timestamp: Date.now() });
      resolve(generatedData);
    }, MOCK_API_DELAY / 2);
  });
};

// Deprecated functions now return empty/null to force usage of the Gemini service.
export const getStockFundamentalData = (symbol: string): Promise<StockFundamentalData | null> => Promise.resolve(null);
export const getNewsItemsRaw = (symbol: string): Promise<NewsItemRaw[]> => Promise.resolve([]);
export const getCorporateAnnouncements = (symbol: string): Promise<CorporateAnnouncement[]> => Promise.resolve([]);
export const getSectorPeers = (sector: string, currentSymbol: string): Promise<StockIdentifier[]> => Promise.resolve([]);

export const filterStocks = async (criteria: ScreenerCriteria): Promise<StockBasicData[]> => {
  if (!isStocksLoaded) await loadStocks();

  let filtered = allStocksCache.filter(stock => {
    if (criteria.sector && stock.sector !== criteria.sector) return false;
    // We can't filter by price accurately without real data for all stocks.
    // So we skip price filtering or use a very rough estimate if we had one.
    // For now, let's just return the matches based on sector/name.
    return true;
  });

  // Limit results
  if (criteria.limit) {
    filtered = filtered.slice(0, criteria.limit);
  }

  // Return basic data with 0 price to indicate "fetch needed"
  return filtered.map(s => ({
    ...s,
    currentPrice: 0, // Explicitly 0 to avoid confusion
    open: 0, high: 0, low: 0, close: 0, volume: 0, change: 0, changePercent: 0,
    fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: "TBD", sector: s.sector || "Unknown"
  }));
};

export const getSectors = (): string[] => {
  return ['Banking', 'IT Services', 'FMCG', 'Automobile', 'Pharma', 'Energy', 'Metals', 'Infrastructure'];
};
