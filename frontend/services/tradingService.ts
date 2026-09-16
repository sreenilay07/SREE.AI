import { TradingPredictionResponse, TradingHealthResponse } from '../types/trading';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://sree-ai.onrender.com' : '');

/**
 * Checks health of the ML trading service via backend gateway.
 */
export async function getTradingHealth(): Promise<TradingHealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/trading/health`);
    if (!res.ok) {
      return {
        status: 'error',
        model_loaded: false,
        error: `Server responded with HTTP ${res.status}`
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      status: 'offline',
      model_loaded: false,
      error: err.message || 'Could not connect to backend gateway'
    };
  }
}

/**
 * Requests live intraday prediction for a stock.
 * NEVER returns mock or synthetic trading data.
 */
export async function getTradingPrediction(
  symbol: string,
  instrumentKey?: string,
  stockName?: string
): Promise<TradingPredictionResponse> {
  if (!symbol) {
    throw new Error('Stock symbol is required');
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  const params = new URLSearchParams({
    symbol: cleanSymbol
  });

  if (instrumentKey) {
    params.set('instrumentKey', instrumentKey.trim());
  }
  if (stockName) {
    params.set('stockName', stockName.trim());
  }

  try {
    const res = await fetch(`${API_BASE}/api/trading/predict?${params.toString()}`);
    if (!res.ok) {
      const errorText = await res.text();
      return {
        status: 'error',
        message: 'BACKEND_HTTP_ERROR',
        reason: `Backend gateway error ${res.status}: ${errorText.slice(0, 150)}`,
        stock: { symbol: cleanSymbol, name: stockName || cleanSymbol, instrumentKey: instrumentKey || '' },
        market: { status: 'UNKNOWN', isOpen: false, timestamp: new Date().toISOString() },
        currentPrice: 0,
        forecasts: {},
        model: { gru: false, xgboost: false },
        confidence: 0,
        risk: { entry: 0, targetPrice: 0, stopLoss: 0, riskReward: null },
        signal: 'NO TRADE',
        forecastCandles: [],
        disclaimer: 'AI forecast only — not financial advice'
      };
    }

    const data: TradingPredictionResponse = await res.json();
    return data;
  } catch (err: any) {
    return {
      status: 'error',
      message: 'NETWORK_ERROR',
      reason: `Could not reach backend service: ${err.message || 'Network disconnected'}`,
      stock: { symbol: cleanSymbol, name: stockName || cleanSymbol, instrumentKey: instrumentKey || '' },
      market: { status: 'UNKNOWN', isOpen: false, timestamp: new Date().toISOString() },
      currentPrice: 0,
      forecasts: {},
      model: { gru: false, xgboost: false },
      confidence: 0,
      risk: { entry: 0, targetPrice: 0, stopLoss: 0, riskReward: null },
      signal: 'NO TRADE',
      forecastCandles: [],
      disclaimer: 'AI forecast only — not financial advice'
    };
  }
}
