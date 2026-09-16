/**
 * Symbol & Instrument Utilities for SREE.AI Upstox Integration
 */

export function isValidSymbol(inputSymbol) {
  if (!inputSymbol || typeof inputSymbol !== 'string') return false;
  const SYMBOL_REGEX = /^[A-Za-z0-9.&-]{1,20}$/;
  return SYMBOL_REGEX.test(inputSymbol.trim());
}

/**
 * Normalizes an input symbol string into clean symbol and exchange details.
 * Examples:
 *   "RELIANCE" -> { cleanSymbol: "RELIANCE", exchange: "NSE" }
 *   "RELIANCE.NS" -> { cleanSymbol: "RELIANCE", exchange: "NSE" }
 *   "TCS.BO" -> { cleanSymbol: "TCS", exchange: "BSE" }
 *   "TCS_BO" -> { cleanSymbol: "TCS", exchange: "BSE" }
 * 
 * @param {string} inputSymbol 
 * @returns {{ rawSymbol: string, cleanSymbol: string, exchange: 'NSE' | 'BSE' }}
 */
export function normalizeSymbol(inputSymbol) {
  if (!inputSymbol || typeof inputSymbol !== 'string') {
    return { rawSymbol: '', cleanSymbol: '', exchange: 'NSE' };
  }

  const rawSymbol = inputSymbol.trim().toUpperCase();
  let cleanSymbol = rawSymbol;
  let exchange = 'NSE';

  if (rawSymbol.endsWith('.BO') || rawSymbol.endsWith('_BO')) {
    exchange = 'BSE';
    cleanSymbol = rawSymbol.replace(/\.BO$|_BO$/, '');
  } else if (rawSymbol.endsWith('.NS') || rawSymbol.endsWith('_NS')) {
    exchange = 'NSE';
    cleanSymbol = rawSymbol.replace(/\.NS$|_NS$/, '');
  }

  return { rawSymbol, cleanSymbol, exchange };
}

/**
 * Format standard exchange and token/ISIN/symbol into Upstox instrument key.
 * 
 * @param {'NSE' | 'BSE'} exchange 
 * @param {string} identifier 
 * @returns {string} e.g. "NSE_EQ|INE002A01018"
 */
export function formatInstrumentKey(exchange, identifier) {
  const ex = exchange ? exchange.toUpperCase() : 'NSE';
  const id = identifier ? identifier.trim() : '';

  if (id.includes('|')) {
    return id;
  }

  const segment = 'EQ';
  return `${ex}_${segment}|${id}`;
}

/**
 * Utility to split an array into chunks of a maximum size.
 * 
 * @template T
 * @param {T[]} array 
 * @param {number} chunkSize 
 * @returns {T[][]}
 */
export function chunkArray(array, chunkSize) {
  if (!Array.isArray(array) || chunkSize <= 0) return [];
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}
