from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, AliasChoices

class StockInfo(BaseModel):
    symbol: str
    name: str
    instrumentKey: str

class MarketInfo(BaseModel):
    status: str
    isOpen: bool
    timestamp: str
    dataTimestamp: Optional[str] = None
    reason: Optional[str] = None

class HorizonForecast(BaseModel):
    minutes: int
    predictedPrice: float
    expectedMovePercent: float
    expectedMoveRupees: float
    direction: str
    confidence: float
    modelUsed: str = "GRU"

class ModelStatus(BaseModel):
    gru: bool
    xgboost: bool

class RiskLevels(BaseModel):
    entry: float
    targetPrice: float = Field(..., validation_alias=AliasChoices("targetPrice", "target_price"))
    stopLoss: float = Field(..., validation_alias=AliasChoices("stopLoss", "stop_loss"))
    riskReward: Optional[float] = Field(None, validation_alias=AliasChoices("riskReward", "risk_reward"))

class ForecastCandle(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    type: str = "predicted"
    ohlc_note: Optional[str] = None

class PredictionResponse(BaseModel):
    status: str
    message: Optional[str] = None
    reason: Optional[str] = None
    stock: StockInfo
    market: MarketInfo
    currentPrice: float
    forecasts: Dict[str, HorizonForecast] = Field(default_factory=dict)
    model: ModelStatus
    confidence: float
    risk: RiskLevels
    signal: str
    forecastCandles: List[ForecastCandle] = Field(default_factory=list)
    disclaimer: str = "AI forecast only — not financial advice"
    debug: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    artifacts: Dict[str, bool]
    timestamp: str
    error: Optional[str] = None
