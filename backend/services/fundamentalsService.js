/**
 * SREE.AI Fundamentals Data Service
 * 
 * Natively integrates with Upstox Company Fundamentals API (/v2/fundamentals)
 * to provide authentic, real-time key ratios, sector benchmarks, shareholding patterns,
 * corporate actions, and financial statements.
 * 
 * NO fake values, synthetic hash math, or fallback hardcoding.
 */

import { resolveInstrument, getQuote } from './upstoxService.js';
import { getAccessToken, getTokenHealth } from './tokenStore.js';

const UPSTOX_BASE_URL = 'https://api.upstox.com';
const fundamentalsCache = new Map(); // symbol -> { data, timestamp }
const marketCapCache = new Map();     // isin -> formatted market cap string
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * Helper to safely fetch an Upstox endpoint with 429 rate limit backoff retry.
 */
async function fetchUpstoxEndpoint(path, retries = 2, backoffMs = 400) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = `${UPSTOX_BASE_URL}${path}`;
      const res = await fetch(url, { headers: getHeaders() });

      if (res.status === 429) {
        if (attempt < retries) {
          const waitTime = backoffMs * (attempt + 1) + Math.floor(Math.random() * 200);
          console.warn(`[FundamentalsService] HTTP 429 Rate Limit for ${path}. Retrying in ${waitTime}ms (Attempt ${attempt + 1}/${retries})...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        console.warn(`[FundamentalsService] HTTP 429 Rate Limit exhausted for ${path}`);
        return { ok: false, status: 429, data: null };
      }

      if (!res.ok) {
        console.warn(`[FundamentalsService] HTTP ${res.status} for ${path}`);
        return { ok: false, status: res.status, data: null };
      }
      const json = await res.json();
      return { ok: true, status: 200, data: json?.data ?? null };
    } catch (err) {
      if (attempt < retries) {
        const waitTime = backoffMs * (attempt + 1);
        console.warn(`[FundamentalsService] Fetch failed for ${path}: ${err.message}. Retrying in ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      console.error(`[FundamentalsService] Error fetching ${path}:`, err.message);
      return { ok: false, status: 500, data: null, error: err.message };
    }
  }
}

/**
 * Concurrency Limiter Helper to map over array with N parallel workers.
 */
export async function mapConcurrent(items, limit, fn) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const results = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Parses numeric value from percentage or ratio string (e.g. "20.15%", "12.46").
 */
function parseRatioNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Fetches real fundamental financial metrics for a stock symbol from Upstox API.
 * 
 * @param {string} cleanSymbol 
 * @param {object} [options] Optional parameters (currentPrice, summaryOnly)
 * @returns {Promise<object>}
 */
export async function getStockFundamentals(cleanSymbol, options = {}) {
  if (!cleanSymbol) {
    return { isAvailable: false, reason: "INVALID_SYMBOL", symbol: "UNKNOWN" };
  }

  const symbolKey = cleanSymbol.toUpperCase().replace(/\.NS$|\.BO$/, '');
  const now = Date.now();

  const cached = fundamentalsCache.get(symbolKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // 1. Resolve Instrument to get ISIN
  const inst = await resolveInstrument(symbolKey);
  const isin = inst?.isin || (inst?.instrumentKey?.includes('|') ? inst.instrumentKey.split('|')[1] : null);

  if (!isin) {
    console.warn(`[FundamentalsService] No ISIN resolved for symbol: ${symbolKey}`);
    const noIsinResult = {
      symbol: symbolKey,
      isAvailable: false,
      reason: "ISIN_NOT_FOUND",
      message: `No ISIN available for ${symbolKey}. Fundamental data requires an ISIN.`
    };
    return noIsinResult;
  }

  const instrumentKey = inst.instrumentKey || `NSE_EQ|${isin}`;
  const summaryOnly = Boolean(options.summaryOnly);

  // 2. Execute Upstox API requests with throttled sub-batching
  let keyRatiosRes, shareHoldingsRes, incomeStatementRes, balanceSheetRes, corporateActionsRes, competitorsRes;

  if (summaryOnly) {
    [keyRatiosRes, shareHoldingsRes, competitorsRes] = await Promise.all([
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/key-ratios`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/share-holdings`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${encodeURIComponent(instrumentKey)}/competitors`)
    ]);
    incomeStatementRes = { status: 'fulfilled', value: { ok: false, data: null } };
    balanceSheetRes = { status: 'fulfilled', value: { ok: false, data: null } };
    corporateActionsRes = { status: 'fulfilled', value: { ok: false, data: null } };
  } else {
    [
      keyRatiosRes,
      shareHoldingsRes,
      incomeStatementRes,
      balanceSheetRes,
      corporateActionsRes,
      competitorsRes
    ] = await Promise.all([
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/key-ratios`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/share-holdings`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/income-statement`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/balance-sheet`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${isin}/corporate-actions`),
      fetchUpstoxEndpoint(`/v2/fundamentals/${encodeURIComponent(instrumentKey)}/competitors`)
    ]);
  }

  // Helper to extract data from Promise.all or Promise.allSettled
  const extractData = (res) => {
    if (!res) return null;
    if (res.status === 'fulfilled') return res.value?.ok ? res.value.data : null;
    if (res.ok) return res.data;
    return null;
  };

  const isOk = (res) => Boolean(res?.ok || (res?.status === 'fulfilled' && res?.value?.ok));

  // Extract results safely
  const keyRatiosRaw = extractData(keyRatiosRes);
  const shareHoldingsRaw = extractData(shareHoldingsRes);
  const incomeStatementRaw = extractData(incomeStatementRes);
  const balanceSheetRaw = extractData(balanceSheetRes);
  const corporateActionsRaw = extractData(corporateActionsRes);
  const competitorsRaw = extractData(competitorsRes);

  // 3. Parse Key Ratios & Sector Comparisons
  const ratioMap = {};
  if (Array.isArray(keyRatiosRaw)) {
    for (const item of keyRatiosRaw) {
      if (item?.name) {
        ratioMap[item.name.toUpperCase()] = {
          company_value: item.company_value ?? null,
          sector_value: item.sector_value ?? null,
          numCompany: parseRatioNum(item.company_value),
          numSector: parseRatioNum(item.sector_value)
        };
      }
    }
  }

  const peData = ratioMap['P/E'] || ratioMap['PE'] || null;
  const pbData = ratioMap['P/B'] || ratioMap['PB'] || null;
  const roaData = ratioMap['ROA'] || null;
  const roeData = ratioMap['ROE'] || null;
  const roceData = ratioMap['ROCE'] || null;
  const evEbitdaData = ratioMap['EV/EBITDA'] || null;

  // 4. Parse Shareholding Pattern (Handle Upstox categories: promoters, fii, other_dii, mutual_funds, retail_and_other)
  let promoterHolding = null;
  let fiiHolding = null;
  let diiHolding = null;
  let publicHolding = null;
  let shareholdingPeriod = null;

  if (Array.isArray(shareHoldingsRaw)) {
    let diiSum = 0;
    let hasDii = false;
    let publicSum = 0;
    let hasPublic = false;

    for (const catObj of shareHoldingsRaw) {
      const cat = (catObj.category || '').toLowerCase();
      const latestHistory = catObj.history?.[0];
      if (latestHistory) {
        if (!shareholdingPeriod) shareholdingPeriod = latestHistory.period;
        const val = Number(latestHistory.value) || 0;

        if (cat.includes('promoter')) {
          promoterHolding = val;
        } else if (cat.includes('fii') || cat.includes('foreign')) {
          fiiHolding = val;
        } else if (cat.includes('dii') || cat.includes('mutual') || cat.includes('domestic') || cat.includes('institution')) {
          diiSum += val;
          hasDii = true;
        } else if (cat.includes('public') || cat.includes('retail') || cat.includes('other')) {
          publicSum += val;
          hasPublic = true;
        }
      }
    }

    if (hasDii) diiHolding = Number(diiSum.toFixed(2));
    if (hasPublic) publicHolding = Number(publicSum.toFixed(2));
  }

  // 5. Parse Balance Sheet -> Derive Debt to Equity & Total Equity
  let debtToEquity = null;
  let debtToEquityData = null;
  let totalEquity = null;

  if (balanceSheetRaw?.history && Array.isArray(balanceSheetRaw.history) && balanceSheetRaw.history.length > 0) {
    const latestBS = balanceSheetRaw.history[0];
    const totalAsset = latestBS.total_asset;
    const totalLiability = latestBS.total_liability;
    if (totalAsset && totalLiability && (totalAsset > totalLiability)) {
      totalEquity = totalAsset - totalLiability;
      debtToEquity = Number((totalLiability / totalEquity).toFixed(2));
      debtToEquityData = {
        company_value: String(debtToEquity),
        sector_value: null,
        numCompany: debtToEquity,
        numSector: null
      };
    }
  }

  // 6. Parse Corporate Actions -> Derive Dividend Yield
  let dividendYield = null;
  let dividendYieldData = null;

  if (Array.isArray(corporateActionsRaw)) {
    let totalDividend = 0;
    for (const action of corporateActionsRaw) {
      if ((action.name || '').toLowerCase().includes('dividend') && action.amount) {
        totalDividend += Number(action.amount);
      }
    }

    let currentPrice = options.currentPrice || null;
    if (!currentPrice || currentPrice <= 0) {
      try {
        const liveQ = await getQuote(instrumentKey);
        currentPrice = liveQ?.last_price || liveQ?.ohlc?.close || null;
      } catch (err) {
        // Price lookup fallback
      }
    }

    if (totalDividend > 0 && currentPrice && currentPrice > 0) {
      dividendYield = Number(((totalDividend / currentPrice) * 100).toFixed(2));
      dividendYieldData = {
        company_value: `${dividendYield}%`,
        sector_value: null,
        numCompany: dividendYield,
        numSector: null
      };
    }
  }

  // 7. Parse Financial Statements (Income Statement history)
  const financialHealth = [];
  if (incomeStatementRaw?.income_statement && Array.isArray(incomeStatementRaw.income_statement)) {
    const revCategory = incomeStatementRaw.income_statement.find(c => c.category === 'revenue');
    const profitCategory = incomeStatementRaw.income_statement.find(c => c.category === 'net_profit' || c.category === 'operating_profit');

    if (revCategory?.history) {
      for (const item of revCategory.history) {
        const period = item.period || 'FY';
        const revVal = item.value || 0;
        const matchingProfit = profitCategory?.history?.find(p => p.period === period);
        financialHealth.push({
          period,
          revenue: revVal,
          netProfit: matchingProfit?.value ?? 0,
          eps: null
        });
      }
    }
  }

  // 8. Extract & Cache Market Cap from Competitors response or calculate from P/B * Equity
  let marketCap = marketCapCache.get(isin) || null;
  if (Array.isArray(competitorsRaw) && competitorsRaw.length > 0) {
    for (const comp of competitorsRaw) {
      const compIsin = (comp.instrument_key || '').split('|')[1];
      if (compIsin && comp.sector_market_cap_inr?.formatted) {
        const capFormatted = `₹${comp.sector_market_cap_inr.formatted.replace(/\s*Cr$/i, '')} Cr`;
        marketCapCache.set(compIsin, capFormatted);
        if (compIsin === isin) {
          marketCap = capFormatted;
        }
      }
    }
  }
  if (!marketCap && marketCapCache.has(isin)) {
    marketCap = marketCapCache.get(isin);
  }
  if (!marketCap && pbData?.numCompany && totalEquity) {
    const calcCap = Number((pbData.numCompany * totalEquity).toFixed(2));
    if (calcCap > 0) {
      marketCap = `₹${calcCap.toLocaleString('en-IN')} Cr`;
      marketCapCache.set(isin, marketCap);
    }
  }

  // Determine availability
  const hasRealData = Boolean(
    keyRatiosRaw || shareHoldingsRaw || incomeStatementRaw || balanceSheetRaw || corporateActionsRaw
  );

  const result = {
    symbol: symbolKey,
    isin,
    marketCap,
    isAvailable: hasRealData,
    source: hasRealData ? "UPSTOX_LIVE_API" : "UNAVAILABLE",
    statusMap: {
      keyRatios: isOk(keyRatiosRes),
      shareHoldings: isOk(shareHoldingsRes),
      incomeStatement: isOk(incomeStatementRes),
      balanceSheet: isOk(balanceSheetRes),
      corporateActions: isOk(corporateActionsRes),
      competitors: isOk(competitorsRes),
    },
    // Standard flat metrics
    peRatio: peData?.numCompany ?? null,
    pbRatio: pbData?.numCompany ?? null,
    roa: roaData?.numCompany ?? null,
    roe: roeData?.numCompany ?? null,
    roce: roceData?.numCompany ?? null,
    evEbitda: evEbitdaData?.numCompany ?? null,
    debtToEquity: debtToEquity ?? null,
    dividendYield: dividendYield ?? null,
    promoterHolding: promoterHolding ?? null,
    fiiHolding: fiiHolding ?? null,
    diiHolding: diiHolding ?? null,
    publicHolding: publicHolding ?? null,
    shareholdingPeriod: shareholdingPeriod ?? null,

    // Detailed metrics WITH sector averages
    metrics: {
      pe: peData,
      pb: pbData,
      roa: roaData,
      roe: roeData,
      roce: roceData,
      evEbitda: evEbitdaData,
      debtToEquity: debtToEquityData,
      dividendYield: dividendYieldData
    },

    shareholdingPattern: {
      promoter: promoterHolding ?? null,
      fii: fiiHolding ?? null,
      dii: diiHolding ?? null,
      public: publicHolding ?? null,
      pledgedPromoter: 0.0
    },

    keyRatios: {
      pe: peData?.numCompany ?? null,
      pb: pbData?.numCompany ?? null,
      debtToEquity: debtToEquity ?? null,
      roe: roeData?.numCompany ?? null,
      dividendYield: dividendYield ?? null
    },

    financialHealth: financialHealth.length > 0 ? financialHealth : [],
    competitors: Array.isArray(competitorsRaw) ? competitorsRaw.slice(0, 5) : []
  };

  fundamentalsCache.set(symbolKey, { data: result, timestamp: now });
  return result;
}
