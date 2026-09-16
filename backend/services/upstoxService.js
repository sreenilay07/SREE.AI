import zlib from 'zlib';
import { normalizeSymbol, formatInstrumentKey, chunkArray } from '../utils/symbolUtils.js';

const UPSTOX_BASE_URL = 'https://api.upstox.com';

// In-memory caches
const instrumentCache = new Map(); // symbol -> instrument details object
const upstoxMasterMap = new Map(); // SYMBOL:EXCHANGE -> { instrumentKey, name }
let masterPromise = null;
let isMasterLoaded = false;

const isinMap = new Map();         // CLEAN_SYMBOL -> ISIN NUMBER
const quoteCache = new Map();      // instrumentKey -> { data, timestamp }
const candleCache = new Map();     // cacheKey -> { data, timestamp }

const QUOTE_CACHE_TTL_MS = 5 * 1000;       // 5 seconds
const CANDLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Downloads and parses Upstox NSE instrument master file into memory.
 */
async function loadUpstoxInstrumentMaster() {
  if (isMasterLoaded) return;
  if (!masterPromise) {
    masterPromise = (async () => {
      try {
        const res = await fetch('https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz');
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const decompressed = zlib.gunzipSync(Buffer.from(buffer)).toString('utf-8');
          const lines = decompressed.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length >= 4) {
              const ik = cols[0].replace(/"/g, '');
              const sym = cols[2].replace(/"/g, '').toUpperCase();
              const name = cols[3].replace(/"/g, '');
              if (ik.startsWith('NSE_EQ') && !upstoxMasterMap.has(`${sym}:NSE`)) {
                upstoxMasterMap.set(`${sym}:NSE`, { instrumentKey: ik, name, exchange: 'NSE' });
              }
            }
          }
          isMasterLoaded = true;
          console.log(`[UpstoxService] Loaded ${upstoxMasterMap.size} NSE instruments into master cache.`);
        }
      } catch (err) {
        console.warn('[UpstoxService] Failed downloading NSE master list:', err.message);
      }
    })();
  }
  return masterPromise;
}

// Start downloading master list in background
loadUpstoxInstrumentMaster();

/**
 * Register ISIN mappings from CSV or external sources.
 * 
 * @param {Record<string, string> | Map<string, string>} mappings 
 */
export function registerIsinMappings(mappings) {
  if (!mappings) return;
  if (mappings instanceof Map) {
    for (const [sym, isin] of mappings.entries()) {
      if (sym && isin) isinMap.set(sym.toUpperCase(), isin.trim());
    }
  } else if (typeof mappings === 'object') {
    for (const [sym, isin] of Object.entries(mappings)) {
      if (sym && isin) isinMap.set(sym.toUpperCase(), isin.trim());
    }
  }
}

import { getAccessToken, getTokenHealth } from './tokenStore.js';

/**
 * Returns Authorization headers for Upstox API calls.
 */
function getHeaders() {
  const health = getTokenHealth();
  if (health.status === 'EXPIRED') {
    console.warn(`[UPSTOX AUTH] ${health.message}`);
  }
  const token = getAccessToken() || process.env.UPSTOX_ACCESS_TOKEN;
  return {
    'Authorization': `Bearer ${token || ''}`,
    'Accept': 'application/json'
  };
}

/**
 * Resolves a stock symbol (and optional exchange) to an Upstox instrument object.
 * Uses ISIN number mapping for 100% Upstox instrument key compatibility.
 * 
 * @param {string} symbol 
 * @param {string} [exchangeHint] 
 * @returns {Promise<{ symbol: string, name: string, exchange: string, instrumentKey: string, isin?: string }>}
 */
export async function resolveInstrument(symbol, exchangeHint) {
  const { cleanSymbol, exchange } = normalizeSymbol(symbol);
  const targetExchange = exchangeHint || exchange;
  const cacheKey = `${cleanSymbol}:${targetExchange}`;

  if (instrumentCache.has(cacheKey)) {
    return instrumentCache.get(cacheKey);
  }

  // 1. Check Upstox Master Map
  if (!isMasterLoaded) {
    await loadUpstoxInstrumentMaster();
  }

  const masterMatch = upstoxMasterMap.get(`${cleanSymbol}:${targetExchange}`) || upstoxMasterMap.get(`${cleanSymbol}:NSE`);
  if (masterMatch) {
    const resolved = {
      symbol: cleanSymbol,
      name: masterMatch.name || cleanSymbol,
      exchange: targetExchange,
      instrumentKey: masterMatch.instrumentKey,
      isin: masterMatch.instrumentKey.includes('|') ? masterMatch.instrumentKey.split('|')[1] : null
    };
    instrumentCache.set(cacheKey, resolved);
    return resolved;
  }

  // 2. Check ISIN map fallback
  const knownIsin = isinMap.get(cleanSymbol);
  let resolvedInstrumentKey = knownIsin ? `${targetExchange}_EQ|${knownIsin}` : formatInstrumentKey(targetExchange, cleanSymbol);

  let resolved = {
    symbol: cleanSymbol,
    name: cleanSymbol,
    exchange: targetExchange,
    instrumentKey: resolvedInstrumentKey,
    isin: knownIsin || null
  };

  instrumentCache.set(cacheKey, resolved);
  return resolved;
}

/**
 * Searches instruments across Upstox directory.
 */
export async function searchInstruments(query) {
  if (!query || typeof query !== 'string') return [];
  const clean = query.trim();
  if (!clean) return [];

  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const searchUrl = `${UPSTOX_BASE_URL}/v2/market/instruments/search?query=${encodeURIComponent(clean)}`;
    const res = await fetch(searchUrl, { headers: getHeaders() });
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.data || [];

    return items
      .filter(item => {
        const seg = (item.segment || '').toUpperCase();
        return seg === 'EQ' || seg === 'NSE_EQ' || seg === 'BSE_EQ' || !seg;
      })
      .slice(0, 15)
      .map(item => ({
        symbol: item.trading_symbol || item.symbol || '',
        name: item.name || item.trading_symbol || '',
        exchange: item.exchange || 'NSE',
        instrumentKey: item.instrument_key || (item.isin ? `${item.exchange || 'NSE'}_EQ|${item.isin}` : formatInstrumentKey(item.exchange || 'NSE', item.trading_symbol))
      }));
  } catch (err) {
    console.error('[UpstoxService] Search instruments error:', err.message);
    return [];
  }
}

/**
 * Fetches market quote for a single instrument key.
 */
export async function getQuote(instrumentKey) {
  const quotes = await getMarketQuotes([instrumentKey]);
  return quotes[instrumentKey] || Object.values(quotes)[0] || null;
}

/**
 * Fetches market quotes for multiple instrument keys in batches.
 */
export async function getMarketQuotes(instrumentKeys) {
  if (!Array.isArray(instrumentKeys) || instrumentKeys.length === 0) {
    return {};
  }

  const uniqueKeys = Array.from(new Set(instrumentKeys.filter(Boolean)));
  const result = {};
  const missingKeys = [];

  const now = Date.now();
  for (const key of uniqueKeys) {
    const cached = quoteCache.get(key);
    if (cached && (now - cached.timestamp < QUOTE_CACHE_TTL_MS)) {
      result[key] = cached.data;
    } else {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) {
    return result;
  }

  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) {
    return result;
  }

  const chunks = chunkArray(missingKeys, 500);

  for (const chunk of chunks) {
    try {
      const keysParam = encodeURIComponent(chunk.join(','));
      let quoteUrl = `${UPSTOX_BASE_URL}/v3/market-quote/quotes?instrument_key=${keysParam}`;
      let res = await fetch(quoteUrl, { headers: getHeaders() });

      if (!res.ok) {
        quoteUrl = `${UPSTOX_BASE_URL}/v2/market-quote/quotes?instrument_key=${keysParam}`;
        res = await fetch(quoteUrl, { headers: getHeaders() });
      }

      if (!res.ok) {
        console.error(`[UpstoxService] Quote HTTP Error ${res.status}`);
        continue;
      }

      const json = await res.json();
      const data = json?.data || {};

      for (const rawKey of Object.keys(data)) {
        const item = data[rawKey];
        const cleanKey = item.instrument_token || item.instrument_key || rawKey.replace(':', '|');
        result[cleanKey] = item;
        result[rawKey] = item;
        quoteCache.set(cleanKey, { data: item, timestamp: now });
        quoteCache.set(rawKey, { data: item, timestamp: now });
      }

      for (const reqKey of chunk) {
        if (!result[reqKey]) {
          const altKey = reqKey.replace('|', ':');
          if (data[altKey]) {
            result[reqKey] = data[altKey];
            quoteCache.set(reqKey, { data: data[altKey], timestamp: now });
          }
        }
      }
    } catch (err) {
      console.error('[UpstoxService] Batch quote fetch error:', err.message);
    }
  }

  return result;
}

/**
 * Fetches historical candle data for a security.
 */
export async function getHistoricalCandles(instrumentKey, options = {}) {
  let interval = options.interval || 'day';
  if (interval === '1' || interval === '1d' || interval === 'days') interval = 'day';

  const today = new Date();
  const defaultTo = today.toISOString().split('T')[0];

  const past = new Date();
  past.setFullYear(past.getFullYear() - 5);
  const defaultFrom = past.toISOString().split('T')[0];

  const toDate = options.toDate || defaultTo;
  const fromDate = options.fromDate || defaultFrom;

  const cacheKey = `hist:${instrumentKey}:${interval}:${fromDate}:${toDate}`;
  const now = Date.now();
  const cached = candleCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CANDLE_CACHE_TTL_MS)) {
    return cached.data;
  }

  try {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${UPSTOX_BASE_URL}/v2/historical-candle/${encodedKey}/${interval}/${toDate}/${fromDate}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      console.error(`[UpstoxService] Historical candles HTTP Error ${res.status} for ${instrumentKey}`);
      return [];
    }

    const json = await res.json();
    const candles = json?.data?.candles || [];
    candleCache.set(cacheKey, { data: candles, timestamp: now });
    return candles;
  } catch (err) {
    console.error(`[UpstoxService] Historical candle fetch error for ${instrumentKey}:`, err.message);
    return [];
  }
}

/**
 * Fetches intraday candle data for a security.
 */
export async function getIntradayCandles(instrumentKey, options = {}) {
  let interval = options.interval || '5minute';
  if (interval === '5' || interval === '5m') interval = '5minute';
  if (interval === '1' || interval === '1m') interval = '1minute';
  if (interval === '15' || interval === '15m') interval = '15minute';

  const cacheKey = `intra:${instrumentKey}:${interval}`;
  const now = Date.now();
  const cached = candleCache.get(cacheKey);
  if (cached && (now - cached.timestamp < 60 * 1000)) {
    return cached.data;
  }

  try {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${UPSTOX_BASE_URL}/v2/historical-candle/intraday/${encodedKey}/${interval}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      console.error(`[UpstoxService] Intraday candles HTTP Error ${res.status} for ${instrumentKey}`);
      return [];
    }

    const json = await res.json();
    const candles = json?.data?.candles || [];
    candleCache.set(cacheKey, { data: candles, timestamp: now });
    return candles;
  } catch (err) {
    console.error(`[UpstoxService] Intraday candle fetch error for ${instrumentKey}:`, err.message);
    return [];
  }
}

/**
 * Returns current Indian stock market session timing and status.
 */
export function getMarketTimings() {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' };
  const timeStr = now.toLocaleTimeString('en-GB', options);
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = day === 0 || day === 6;
  const isTradingHours = !isWeekend && timeStr >= '09:15' && timeStr <= '15:30';

  return {
    isTradingHours,
    isWeekend,
    currentTimeIST: timeStr,
    timezone: 'Asia/Kolkata'
  };
}

