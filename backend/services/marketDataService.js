import { resolveInstrument, getQuote, getMarketQuotes, getHistoricalCandles as fetchUpstoxHistorical, getIntradayCandles as fetchUpstoxIntraday } from './upstoxService.js';
import { normalizeSymbol } from '../utils/symbolUtils.js';
import { parseTimestampToIST } from '../utils/marketSessionUtils.js';
import { getStockFundamentals, mapConcurrent } from './fundamentalsService.js';



/**
 * Normalizes raw Upstox quote data into standard SREE.AI StockBasicData shape.
 * Missing/unsupported fundamentals evaluate strictly to null / "N/A".
 * 
 * @param {object} rawQuote Raw quote object from Upstox API
 * @param {object} symbolInfo { symbol, name, exchange, sector }
 * @param {object} [fundamentalsObj] Optional fundamentals object from fundamentalsService
 * @returns {object} StockBasicData normalized object
 */
export function normalizeUpstoxQuote(rawQuote, symbolInfo = {}, fundamentalsObj = null) {
  const symbol = symbolInfo.symbol || rawQuote?.symbol || 'UNKNOWN';
  const name = symbolInfo.name || rawQuote?.name || symbol;
  const exchange = symbolInfo.exchange || rawQuote?.exchange || 'NSE';
  const sector = symbolInfo.sector || 'General';

  const ohlc = rawQuote?.ohlc || {};
  const currentPrice = typeof rawQuote?.last_price === 'number' ? rawQuote.last_price : (ohlc.close || 0);
  const open = ohlc.open || 0;
  const high = ohlc.high || 0;
  const low = ohlc.low || 0;
  const prevClose = ohlc.close || 0;
  const volume = rawQuote?.volume || rawQuote?.total_buy_quantity || 0;

  const change = typeof rawQuote?.net_change === 'number'
    ? rawQuote.net_change
    : (prevClose > 0 ? currentPrice - prevClose : 0);

  const changePercent = typeof rawQuote?.percentage_change === 'number'
    ? rawQuote.percentage_change
    : (prevClose > 0 ? (change / prevClose) * 100 : 0);

  const fiftyTwoWeekHigh = rawQuote?.['52_week_high'] || rawQuote?.fifty_two_week_high || high || 0;
  const fiftyTwoWeekLow = rawQuote?.['52_week_low'] || rawQuote?.fifty_two_week_low || low || 0;

  const fund = fundamentalsObj || {};

  let marketCapStr = fund.marketCap || symbolInfo?.marketCap || 'N/A';
  if (typeof rawQuote?.market_cap === 'number' && rawQuote.market_cap > 0) {
    marketCapStr = `₹${(rawQuote.market_cap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  }

  const peRatio = typeof rawQuote?.pe_ratio === 'number' ? rawQuote.pe_ratio : (fund.peRatio ?? null);
  const pbRatio = typeof rawQuote?.pb_ratio === 'number' ? rawQuote.pb_ratio : (fund.pbRatio ?? null);
  const dividendYield = typeof rawQuote?.dividend_yield === 'number' ? rawQuote.dividend_yield : (fund.dividendYield ?? null);
  const roe = fund.roe ?? null;
  const debtToEquity = fund.debtToEquity ?? null;
  const promoterHolding = fund.promoterHolding ?? null;

  const fundShareholding = fund.fundamentals?.shareholdingPattern || {};

  return {
    symbol,
    name,
    exchange,
    sector,
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    close: parseFloat(prevClose.toFixed(2)),
    volume: Math.round(volume),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    fiftyTwoWeekHigh: parseFloat(fiftyTwoWeekHigh.toFixed(2)),
    fiftyTwoWeekLow: parseFloat(fiftyTwoWeekLow.toFixed(2)),
    marketCap: marketCapStr,
    peRatio,
    pbRatio,
    dividendYield,
    debtToEquity,
    roe,
    promoterHolding,
    financialHealth: fund.financialHealth || [],
    fundamentals: {
      keyRatios: {
        pe: peRatio,
        pb: pbRatio,
        debtToEquity,
        roe,
        dividendYield
      },
      shareholdingPattern: {
        promoter: promoterHolding,
        fii: fundShareholding.fii ?? null,
        dii: fundShareholding.dii ?? null,
        public: fundShareholding.public ?? null,
        pledgedPromoter: fundShareholding.pledgedPromoter ?? 0.0
      }
    }
  };
}

/**
 * Normalizes Upstox candle data array [[timestamp, open, high, low, close, volume, open_interest], ...]
 * 
 * CANONICAL MODEL:
 * {
 *   timestamp: number,  // Unix timestamp in ms
 *   datetime: string,   // ISO IST string
 *   date: string,       // YYYY-MM-DD IST
 *   time: string,       // HH:mm IST
 *   open: number,
 *   high: number,
 *   low: number,
 *   close: number,
 *   volume: number | null
 * }
 * 
 * @param {Array} rawCandles 
 * @param {boolean} [isIntraday=false]
 * @returns {Array}
 */
export function normalizeCandles(rawCandles, isIntraday = false) {
  if (!Array.isArray(rawCandles)) return [];

  const validCandles = [];
  const seenTimestamps = new Set();

  for (const c of rawCandles) {
    if (!Array.isArray(c) || c.length < 5) continue;

    const rawTs = c[0];
    const open = typeof c[1] === 'number' ? c[1] : 0;
    const high = typeof c[2] === 'number' ? c[2] : 0;
    const low = typeof c[3] === 'number' ? c[3] : 0;
    const close = typeof c[4] === 'number' ? c[4] : 0;
    const volume = typeof c[5] === 'number' ? c[5] : (c[5] !== null ? Number(c[5]) : null);

    // Validation (Requirement 16): open, high, low, close > 0, high >= max(open, close), low <= min(open, close)
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
    if (high < Math.max(open, close) - 0.01) continue;
    if (low > Math.min(open, close) + 0.01) continue;

    // Canonical IST Timestamp Resolution (Requirement 4 & 5)
    const { timestamp, datetime, date, time } = parseTimestampToIST(rawTs);

    // Guard (Requirement 14 & 77): Reject future timestamps
    if (timestamp > Date.now()) continue;

    // Deduplication (Requirement 18)
    if (seenTimestamps.has(timestamp)) continue;
    seenTimestamps.add(timestamp);

    validCandles.push({
      timestamp,
      datetime,
      date,
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume !== null && !isNaN(volume) ? Math.round(volume) : null,
      price: parseFloat(close.toFixed(2)) // Compatibility field
    });
  }

  // Strict Ascending Sort by Unix Timestamp ms (Requirement 17)
  validCandles.sort((a, b) => a.timestamp - b.timestamp);

  return validCandles;
}

/**
 * Resolves instrument and retrieves normalized stock quote.
 * 
 * @param {string} symbol 
 * @param {object} [knownStock] Optional CSV stock metadata
 * @returns {Promise<object>}
 */
export async function getSingleStockData(symbol, knownStock = null) {
  const { cleanSymbol, exchange } = normalizeSymbol(symbol);
  const resolved = await resolveInstrument(cleanSymbol, knownStock?.exchange || exchange);

  const [rawQuote, fundamentalsObj] = await Promise.all([
    getQuote(resolved.instrumentKey),
    getStockFundamentals(cleanSymbol)
  ]);

  const symbolInfo = {
    symbol: cleanSymbol,
    name: knownStock?.name || resolved.name || cleanSymbol,
    exchange: resolved.exchange || exchange,
    sector: knownStock?.sector || 'General'
  };

  return normalizeUpstoxQuote(rawQuote, symbolInfo, fundamentalsObj);
}

/**
 * Batch retrieves normalized market quotes for an array of symbols.
 * 
 * @param {string[]} symbols 
 * @param {Array} knownStocks 
 * @returns {Promise<Array<object>>}
 */
export async function getBatchStockData(symbols, knownStocks = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];

  // Step 1: Resolve all instruments in parallel
  const resolvedList = await Promise.all(symbols.map(async (sym) => {
    const { cleanSymbol, exchange } = normalizeSymbol(sym);
    const match = knownStocks.find(s => s.symbol.toUpperCase() === cleanSymbol || s.symbol.toUpperCase() === sym.toUpperCase());
    const resolved = await resolveInstrument(cleanSymbol, match?.exchange || exchange);
    return {
      rawSymbol: sym,
      cleanSymbol,
      exchange: resolved.exchange || exchange,
      instrumentKey: resolved.instrumentKey,
      name: match?.name || resolved.name || cleanSymbol,
      sector: match?.sector || 'General'
    };
  }));

  // Step 2: Fetch all quotes in chunked batch requests & fundamentals with throttled concurrency
  const instrumentKeys = resolvedList.map(r => r.instrumentKey);
  const [quotesMap, fundamentalsList] = await Promise.all([
    getMarketQuotes(instrumentKeys),
    mapConcurrent(resolvedList, 4, item => getStockFundamentals(item.cleanSymbol, { summaryOnly: true }).catch(() => null))
  ]);

  // Step 3: Normalize each stock quote with its authentic fundamental metrics
  return resolvedList.map((item, idx) => {
    const rawQuote = quotesMap[item.instrumentKey] || quotesMap[item.instrumentKey.replace('|', ':')];
    const fund = fundamentalsList[idx] || null;
    return normalizeUpstoxQuote(rawQuote, {
      symbol: item.cleanSymbol,
      name: item.name,
      exchange: item.exchange,
      sector: item.sector,
      marketCap: item.marketCap || fund?.marketCap
    }, fund);
  });
}

/**
 * Retrieves normalized historical candle data.
 * 
 * @param {string} symbol 
 * @param {object} [options] 
 * @returns {Promise<Array>}
 */
export async function getHistoricalDataForSymbol(symbol, options = {}) {
  const { cleanSymbol, exchange } = normalizeSymbol(symbol);
  const resolved = await resolveInstrument(cleanSymbol, exchange);
  const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, options);
  return normalizeCandles(rawCandles, false);
}

/**
 * Retrieves normalized intraday candle data.
 * 
 * @param {string} symbol 
 * @param {object} [options] 
 * @returns {Promise<Array>}
 */
export async function getIntradayDataForSymbol(symbol, options = {}) {
  const { cleanSymbol, exchange } = normalizeSymbol(symbol);
  const resolved = await resolveInstrument(cleanSymbol, exchange);
  const rawCandles = await fetchUpstoxIntraday(resolved.instrumentKey, options);
  return normalizeCandles(rawCandles, true);
}

/**
 * Advanced chart candle resolution based on timeframe.
 * Handles market closed scenarios by finding latest valid trading sessions.
 */
export async function getChartCandles(symbol, timeframe) {
  const { cleanSymbol, exchange } = normalizeSymbol(symbol);
  const resolved = await resolveInstrument(cleanSymbol, exchange);

  let candles = [];
  let isHistoricalSession = false;
  let sessionDate = null;

  try {
    if (timeframe === '1D') {
      // 1D: intraday 1-min candles for the current session
      let rawCandles = await fetchUpstoxIntraday(resolved.instrumentKey, { interval: '1minute' });
      candles = normalizeCandles(rawCandles, true);

      // If no valid candles for today (e.g. weekend / market closed), fetch 1-minute historical candles for recent days
      if (candles.length === 0) {
        isHistoricalSession = true;
        const today = new Date().toISOString().split('T')[0];
        const past = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];
        const fallbackRaw = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: '1minute', toDate: today, fromDate: past });
        let fallbackCandles = normalizeCandles(fallbackRaw, true);

        if (fallbackCandles.length > 0) {
          // Group by date and pick the latest trading session date
          const latestDate = fallbackCandles[fallbackCandles.length - 1].date;
          candles = fallbackCandles.filter(c => c.date === latestDate);
        } else {
          // Fallback to 5minute or daily if 1minute unavailable
          const dailyRaw = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
          candles = normalizeCandles(dailyRaw, false).slice(-30);
        }
      } else {
        // Only return latest session
        const latestDate = candles[candles.length - 1].date;
        candles = candles.filter(c => c.date === latestDate);
      }
    } else if (timeframe === '1W') {
      // 1W: 15-min candles or daily candles fallback
      let rawCandles = await fetchUpstoxIntraday(resolved.instrumentKey, { interval: '15minute' });
      candles = normalizeCandles(rawCandles, true);

      if (candles.length === 0) {
        isHistoricalSession = true;
        const dailyRaw = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
        candles = normalizeCandles(dailyRaw, false).slice(-7);
      } else {
        const uniqueDates = [...new Set(candles.map(c => c.date))];
        const validDates = uniqueDates.slice(-5);
        candles = candles.filter(c => validDates.includes(c.date));
      }

    } else if (timeframe === '1M') {
      // 1M: Daily candles
      const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
      candles = normalizeCandles(rawCandles, false);
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      candles = candles.filter(c => c.timestamp >= oneMonthAgo);

    } else if (timeframe === '3M') {
      // 3M: Daily candles
      const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
      candles = normalizeCandles(rawCandles, false);
      const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      candles = candles.filter(c => c.timestamp >= threeMonthsAgo);

    } else if (timeframe === '6M') {
      // 6M: Daily candles (~125 candles - sufficient for MACD & SMA-50)
      const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
      candles = normalizeCandles(rawCandles, false);
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      candles = candles.filter(c => c.timestamp >= sixMonthsAgo);

    } else if (timeframe === '1Y') {
      // 1Y: Daily candles
      const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
      candles = normalizeCandles(rawCandles, false);
      const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
      candles = candles.filter(c => c.timestamp >= oneYearAgo);

    } else if (timeframe === '5Y') {
      // 5Y: Daily candles
      const rawCandles = await fetchUpstoxHistorical(resolved.instrumentKey, { interval: 'day' });
      candles = normalizeCandles(rawCandles, false);
      const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
      candles = candles.filter(c => c.timestamp >= fiveYearsAgo);
    }
  } catch (err) {
    console.error(`[Chart] Failed fetching candles for ${symbol} @ ${timeframe}:`, err);
  }

  if (candles.length > 0) {
    sessionDate = candles[candles.length - 1].date;
  }

  return {
    symbol: cleanSymbol,
    exchange: resolved.exchange,
    instrumentKey: resolved.instrumentKey,
    timeframe,
    marketStatus: isHistoricalSession ? 'CLOSED' : 'OPEN_OR_UNKNOWN',
    sessionDate,
    isHistoricalSession,
    candles
  };
}
