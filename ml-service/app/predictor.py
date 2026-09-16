import math
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional

from .model_loader import get_model_container, HORIZONS
from .market_data import (
    market_is_open,
    get_live_warmup_data,
    IST_TZ
)
from .adapter import (
    build_live_features,
    audit_live_feature_distribution,
    flatten_for_xgb,
    compute_confidence,
    compute_risk_levels,
    generate_next_five_candles
)

logger = logging.getLogger("ml-service.predictor")

LOOKBACK = 48
MIN_CONFIDENCE = 60.0
MIN_EXPECTED_MOVE_PCT = 0.10

def predict_stock_pipeline(
    symbol: str,
    instrument_key: str,
    stock_name: str,
    token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the exact multi-horizon production inference pipeline from STOCK_CANDLES_PRODUCTION_FINAL.ipynb.
    Zero mock data is generated.
    """
    container = get_model_container()
    
    # 1. Verify model artifacts are loaded
    if not container.is_loaded:
        return {
            "status": "error",
            "message": "MODEL_NOT_LOADED",
            "reason": container.load_error or "Production artifacts are not loaded into memory.",
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {"status": "UNKNOWN", "isOpen": False, "timestamp": str(pd.Timestamp.now(tz=IST_TZ))},
            "currentPrice": 0.0,
            "forecasts": {},
            "model": {"gru": False, "xgboost": False},
            "confidence": 0.0,
            "risk": {"entry": 0.0, "targetPrice": 0.0, "stopLoss": 0.0, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": []
        }

    # 2. Check Market Status
    logger.info(f"[ML] Checking market status for {symbol} ({instrument_key})")
    market_info = market_is_open(exchange="NSE", token=token)
    is_open = market_info.get("open", False)
    market_status = market_info.get("status", "CLOSED")

    now = pd.Timestamp.now(tz=IST_TZ)

    # 3. Retrieve Live / Warmup Market Data
    logger.info(f"[ML] Retrieving warmup candles for {instrument_key}")
    try:
        completed = get_live_warmup_data(instrument_key, interval=5, warmup_days=7, token=token)
    except Exception as e:
        logger.error(f"[ML] Error retrieving market data: {e}")
        return {
            "status": "error",
            "message": "DATA_FETCH_FAILED",
            "reason": f"Failed to retrieve market candles from Upstox: {str(e)}",
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {"status": market_status, "isOpen": is_open, "timestamp": str(now)},
            "currentPrice": 0.0,
            "forecasts": {},
            "model": {"gru": True, "xgboost": True},
            "confidence": 0.0,
            "risk": {"entry": 0.0, "targetPrice": 0.0, "stopLoss": 0.0, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": []
        }

    if completed.empty:
        return {
            "status": "error",
            "message": "NO_MARKET_DATA",
            "reason": "No valid candles returned from Upstox for the requested instrument.",
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {"status": market_status, "isOpen": is_open, "timestamp": str(now)},
            "currentPrice": 0.0,
            "forecasts": {},
            "model": {"gru": True, "xgboost": True},
            "confidence": 0.0,
            "risk": {"entry": 0.0, "targetPrice": 0.0, "stopLoss": 0.0, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": []
        }

    latest_candle_time = completed["Datetime"].iloc[-1]
    if latest_candle_time.tzinfo is None:
        latest_candle_time_ist = latest_candle_time.tz_localize(IST_TZ)
    else:
        latest_candle_time_ist = latest_candle_time.tz_convert(IST_TZ)

    data_age_seconds = (now - latest_candle_time_ist).total_seconds()
    data_age_minutes = max(0, int(data_age_seconds // 60))
    current_price = round(float(completed["Close"].iloc[-1]), 2)

    # Stale market data guard (if market is open and data > 15 mins old)
    if is_open and data_age_minutes > 15:
        logger.warning(f"[ML] Stale data warning: data is {data_age_minutes} mins old during open session.")
        return {
            "status": "stale_data",
            "message": "STALE_MARKET_DATA",
            "reason": f"Live data feed is lagging behind active trading hours by {data_age_minutes} minutes.",
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {
                "status": market_status,
                "isOpen": is_open,
                "timestamp": str(now),
                "dataTimestamp": str(latest_candle_time_ist)
            },
            "currentPrice": current_price,
            "forecasts": {},
            "model": {"gru": True, "xgboost": True},
            "confidence": 0.0,
            "risk": {"entry": current_price, "targetPrice": current_price, "stopLoss": current_price, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": []
        }

    # 4. Feature Engineering
    logger.info(f"[ML] Generating live features for {len(completed)} candles")
    live_feat = build_live_features(
        completed,
        pattern_columns=container.pattern_columns,
        include_market_context=True,
        token=token
    )

    feature_cols = container.feature_columns
    live_feat = live_feat.dropna(subset=feature_cols).reset_index(drop=True)

    if len(live_feat) < LOOKBACK:
        return {
            "status": "insufficient_data",
            "message": "INSUFFICIENT_WARMED_DATA",
            "reason": f"Insufficient complete indicator rows. Required: {LOOKBACK}, Available: {len(live_feat)}.",
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {
                "status": market_status,
                "isOpen": is_open,
                "timestamp": str(now),
                "dataTimestamp": str(latest_candle_time_ist)
            },
            "currentPrice": current_price,
            "forecasts": {},
            "model": {"gru": True, "xgboost": True},
            "confidence": 0.0,
            "risk": {"entry": current_price, "targetPrice": current_price, "stopLoss": current_price, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": []
        }

    # 5. Feature Distribution Audit (Cell 41A & Cell 45)
    audit = audit_live_feature_distribution(live_feat, feature_cols, container.scaler)
    extreme_count = int((audit["Abs_Z"] > 10).sum())

    if extreme_count > 0:
        top_extremes = audit.head(5)[["Feature", "Live_Value", "Z_Score"]].to_dict("records")
        logger.warning(f"[ML] Features out of distribution: {extreme_count} features with |Z| > 10.")
        return {
            "status": "out_of_distribution",
            "message": "MODEL_INPUT_OUT_OF_DISTRIBUTION",
            "reason": (
                f"{extreme_count} features have |Z| > 10 versus the model's training distribution. "
                "The model was trained on MRF (NSE_EQ|INE883A01011). Direct prediction on this instrument "
                "is prevented by the notebook's distribution safety audit."
            ),
            "stock": {"symbol": symbol, "name": stock_name, "instrumentKey": instrument_key},
            "market": {
                "status": market_status,
                "isOpen": is_open,
                "timestamp": str(now),
                "dataTimestamp": str(latest_candle_time_ist)
            },
            "currentPrice": current_price,
            "forecasts": {},
            "model": {"gru": True, "xgboost": True},
            "confidence": 0.0,
            "risk": {"entry": current_price, "targetPrice": current_price, "stopLoss": current_price, "riskReward": None},
            "signal": "NO TRADE",
            "forecastCandles": [],
            "debug": {"extreme_features": top_extremes}
        }

    # 6. Prepare Sequence & Scaler Transform
    window_raw = live_feat[feature_cols].values[-LOOKBACK:].astype(np.float32)
    window_scaled = container.scaler.transform(window_raw).astype(np.float32)

    # 7. Model Inference (GRU + XGBoost)
    logger.info(f"[ML] Running GRU inference for {symbol}")
    gru_vector = container.gru_model.predict(window_scaled[np.newaxis, ...], verbose=0)[0]

    flat_feat = flatten_for_xgb(window_scaled[np.newaxis, ...])
    xgb_returns = {}
    for minutes in HORIZONS.keys():
        xgb_returns[minutes] = float(container.xgb_models[minutes].predict(flat_feat)[0])

    # 8. Build Horizon Forecasts
    forecasts_dict = {}
    horizon_keys = list(HORIZONS.keys())

    for j, minutes in enumerate(horizon_keys):
        gru_ret = float(gru_vector[j])
        xgb_ret = xgb_returns[minutes]

        pred_price = round(current_price * math.exp(gru_ret), 2)
        move_rupees = round(pred_price - current_price, 2)
        move_pct = round(((pred_price / current_price) - 1) * 100, 3)

        if gru_ret > 0:
            direction = "INCREASE"
        elif gru_ret < 0:
            direction = "DECREASE"
        else:
            direction = "SIDEWAYS"

        conf = compute_confidence(
            minutes,
            gru_ret,
            xgb_ret,
            container.validation_confidence_stats
        )

        forecasts_dict[str(minutes)] = {
            "minutes": minutes,
            "predictedPrice": pred_price,
            "expectedMovePercent": move_pct,
            "expectedMoveRupees": move_rupees,
            "direction": direction,
            "confidence": round(conf, 1),
            "modelUsed": container.config.get("best_model_per_horizon", {}).get(str(minutes), "GRU")
        }

    # 9. Overall Signal & Confidence Evaluation (Cell 46)
    # 30-minute evaluation horizon
    eval_item = forecasts_dict.get("30") or forecasts_dict.get("5")
    overall_confidence = eval_item["confidence"] if eval_item else 0.0

    if not eval_item:
        signal = "NO TRADE"
    elif not is_open:
        # Session inactive
        signal = "NO TRADE"
    elif overall_confidence < MIN_CONFIDENCE:
        signal = "NO TRADE"
    elif abs(eval_item["expectedMovePercent"]) < MIN_EXPECTED_MOVE_PCT:
        signal = "NO TRADE"
    else:
        signal = "BULLISH" if eval_item["direction"] == "INCREASE" else "BEARISH"

    # 10. Risk Management (Cell 43)
    atr_now = float(live_feat["ATR_pct"].iloc[-1] * current_price) if "ATR_pct" in live_feat.columns else current_price * 0.005
    target_pred_price = eval_item["predictedPrice"] if eval_item else current_price
    risk_dict = compute_risk_levels(current_price, target_pred_price, atr_now)

    # 11. Next 5-Candle Synthetic Forecast (Cell 44)
    forecast_candles = []
    try:
        wick_sum = float(live_feat["UpperPctRange"].tail(100).mean() + live_feat["LowerPctRange"].tail(100).mean())
        forecast_candles = generate_next_five_candles(
            container.gru_model,
            window_scaled,
            current_price,
            latest_candle_time,
            wick_sum,
            HORIZONS
        )
    except Exception as e:
        logger.warning(f"[ML] Could not generate 5-candle sequence: {e}")

    logger.info(f"[ML] Inference complete for {symbol}: Signal={signal}, Price={current_price}, Confidence={overall_confidence}%")

    return {
        "status": "success",
        "stock": {
            "symbol": symbol,
            "name": stock_name,
            "instrumentKey": instrument_key
        },
        "market": {
            "status": market_status,
            "isOpen": is_open,
            "timestamp": str(now),
            "dataTimestamp": str(latest_candle_time_ist)
        },
        "currentPrice": current_price,
        "forecasts": forecasts_dict,
        "model": {
            "gru": True,
            "xgboost": True
        },
        "confidence": overall_confidence,
        "risk": risk_dict,
        "signal": signal,
        "forecastCandles": forecast_candles,
        "disclaimer": "AI forecast only — not financial advice"
    }
