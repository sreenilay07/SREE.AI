import { resolveInstrument } from './upstoxService.js';
import { getAccessToken } from './tokenStore.js';

const getMlServiceUrl = () => (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

/**
 * Checks health of the Python ML Inference Service.
 */
export async function getMlHealth() {
  const mlUrl = getMlServiceUrl();
  try {
    const res = await fetch(`${mlUrl}/health`, {

      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      return {
        status: 'error',
        model_loaded: false,
        error: `ML service returned HTTP ${res.status}: ${res.statusText}`
      };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    return {
      status: 'offline',
      model_loaded: false,
      error: `Could not connect to ML service at ${ML_SERVICE_URL}: ${err.message}`
    };
  }
}

/**
 * Requests real-time intraday prediction from Python ML service.
 * Automatically resolves instrumentKey if omitted or incomplete.
 * 
 * @param {Object} params
 * @param {string} params.symbol
 * @param {string} [params.instrumentKey]
 * @param {string} [params.stockName]
 */
export async function getStockPrediction({ symbol, instrumentKey, stockName }) {
  if (!symbol) {
    throw new Error('Stock symbol is required.');
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  let key = instrumentKey;
  let name = stockName || cleanSymbol;

  // Resolve instrument key if not provided
  if (!key) {
    try {
      const resolved = await resolveInstrument(cleanSymbol);
      if (resolved && resolved.instrumentKey) {
        key = resolved.instrumentKey;
        name = resolved.name || name;
      }
    } catch (err) {
      console.warn(`[MLTradingService] Could not resolve instrumentKey for ${cleanSymbol}:`, err.message);
    }
  }

  if (!key) {
    key = `NSE_EQ|${cleanSymbol}`;
  }

  const token = getAccessToken() || process.env.UPSTOX_ACCESS_TOKEN || '';
  const queryParams = new URLSearchParams({
    symbol: cleanSymbol,
    instrumentKey: key,
    stockName: name
  });

  const mlUrl = getMlServiceUrl();
  const targetUrl = `${mlUrl}/api/predict?${queryParams.toString()}`;
  console.log(`[ML Gateway] Requesting prediction: ${cleanSymbol} (${key}) -> ${mlUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      signal: AbortSignal.timeout(30000) // Upstox history fetch can take several seconds
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        status: 'error',
        message: 'ML_SERVICE_HTTP_ERROR',
        reason: `ML service returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
        stock: { symbol: cleanSymbol, name, instrumentKey: key },
        market: { status: 'UNKNOWN', isOpen: false, timestamp: new Date().toISOString() },
        currentPrice: 0,
        forecasts: {},
        model: { gru: false, xgboost: false },
        confidence: 0,
        risk: { entry: 0, targetPrice: 0, stopLoss: 0, riskReward: null },
        signal: 'NO TRADE',
        forecastCandles: []
      };
    }

    const payload = await res.json();
    return payload;
  } catch (err) {
    console.error(`[ML Gateway] Failed calling ML service for ${cleanSymbol}:`, err.message);
    return {
      status: 'error',
      message: 'ML_SERVICE_UNREACHABLE',
      reason: `Failed connecting to ML service at ${mlUrl}: ${err.message}`,
      stock: { symbol: cleanSymbol, name, instrumentKey: key },
      market: { status: 'UNKNOWN', isOpen: false, timestamp: new Date().toISOString() },
      currentPrice: 0,
      forecasts: {},
      model: { gru: false, xgboost: false },
      confidence: 0,
      risk: { entry: 0, targetPrice: 0, stopLoss: 0, riskReward: null },
      signal: 'NO TRADE',
      forecastCandles: []
    };
  }
}
