export interface TradingHorizonForecast {
  minutes: number;
  predictedPrice: number;
  expectedMovePercent: number;
  expectedMoveRupees: number;
  direction: 'INCREASE' | 'DECREASE' | 'SIDEWAYS' | string;
  confidence: number;
  modelUsed: 'GRU' | 'XGBoost' | string;
}

export interface TradingModelStatus {
  gru: boolean;
  xgboost: boolean;
}

export interface TradingRiskLevels {
  entry: number;
  targetPrice: number;
  stopLoss: number;
  riskReward: number | null;
}

export interface TradingMarketInfo {
  status: string;
  isOpen: boolean;
  timestamp: string;
  dataTimestamp?: string | null;
  reason?: string | null;
}

export interface ForecastCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  type?: string;
  ohlc_note?: string;
}

export interface TradingPredictionResponse {
  status: 'success' | 'stale_data' | 'insufficient_data' | 'out_of_distribution' | 'error' | string;
  message?: string;
  reason?: string;
  stock: {
    symbol: string;
    name: string;
    instrumentKey: string;
  };
  market: TradingMarketInfo;
  currentPrice: number;
  forecasts: Record<string, TradingHorizonForecast>;
  model: TradingModelStatus;
  confidence: number;
  risk: TradingRiskLevels;
  signal: 'BULLISH' | 'BEARISH' | 'NO TRADE' | string;
  forecastCandles: ForecastCandle[];
  disclaimer: string;
  debug?: Record<string, any>;
}

export interface TradingHealthResponse {
  status: string;
  model_loaded: boolean;
  artifacts?: Record<string, boolean>;
  timestamp?: string;
  error?: string | null;
}

export type ApplicationMode = 'INVESTOR' | 'TRADER';
