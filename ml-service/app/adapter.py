import math
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional

EPS = 1e-9
BASE_TIMEFRAME_MINUTES = 5
NSE_INDEX_INSTRUMENT_KEY = "NSE_INDEX|Nifty 50"

def add_candle_anatomy(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()
    O, H, L, C, V = x["Open"], x["High"], x["Low"], x["Close"], x["Volume"]

    x["Body"] = C - O
    x["BodyAbs"] = x["Body"].abs()
    x["Range"] = (H - L).clip(lower=EPS)
    x["UpperWick"] = (H - x[["Open","Close"]].max(axis=1)).clip(lower=0)
    x["LowerWick"] = (x[["Open","Close"]].min(axis=1) - L).clip(lower=0)

    x["BodyPctRange"]  = x["BodyAbs"] / x["Range"]
    x["UpperPctRange"] = x["UpperWick"] / x["Range"]
    x["LowerPctRange"] = x["LowerWick"] / x["Range"]

    x["CloseLocation"] = (C - L) / x["Range"]
    x["OpenLocation"]  = (O - L) / x["Range"]

    x["Bullish"] = (C > O).astype(np.float32)
    x["Bearish"] = (C < O).astype(np.float32)

    x["GapPct"] = O / x["Close"].shift(1) - 1

    x["Return_1"]  = C.pct_change(1)
    x["LogReturn"] = np.log(C / C.shift(1))

    x["VolumeChange"] = V.pct_change()
    vol_ma = V.rolling(24).mean()
    x["RelativeVolume"] = V / (vol_ma + EPS)

    return x

def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()
    C, H, L, V = x["Close"], x["High"], x["Low"], x["Volume"]

    # Trend: EMA distance
    for span in (10, 20, 50):
        ema = C.ewm(span=span, adjust=False).mean()
        x[f"EMA_{span}_dist"] = C / ema - 1

    # Momentum: RSI(14)
    delta = C.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
    rs = avg_gain / (avg_loss + EPS)
    x["RSI_14"] = 100 - (100 / (1 + rs))

    # MACD
    ema12 = C.ewm(span=12, adjust=False).mean()
    ema26 = C.ewm(span=26, adjust=False).mean()
    x["MACD"] = ema12 - ema26
    x["MACD_signal"] = x["MACD"].ewm(span=9, adjust=False).mean()
    x["MACD_hist"] = x["MACD"] - x["MACD_signal"]

    # Volatility: ATR(14) and rolling stdev
    prev_close = C.shift(1)
    tr = pd.concat([H - L, (H - prev_close).abs(), (L - prev_close).abs()], axis=1).max(axis=1)
    x["ATR_14"] = tr.ewm(alpha=1/14, adjust=False).mean()
    x["ATR_pct"] = x["ATR_14"] / C

    x["Volatility_12"] = x["LogReturn"].rolling(12).std()
    x["Volatility_24"] = x["LogReturn"].rolling(24).std()

    # Bollinger Bands
    bb_mid = C.rolling(20).mean()
    bb_std = C.rolling(20).std()
    x["BB_width"] = (4 * bb_std) / (bb_mid + EPS)
    x["BB_position"] = (C - (bb_mid - 2*bb_std)) / ((4*bb_std) + EPS)

    # Momentum / rate of change
    x["ROC_6"] = C.pct_change(6)
    x["ROC_12"] = C.pct_change(12)

    # Session-time encoding
    minutes_from_open = x["Datetime"].dt.hour * 60 + x["Datetime"].dt.minute - (9*60 + 15)
    x["SinTime"] = np.sin(2*np.pi*minutes_from_open/375)
    x["CosTime"] = np.cos(2*np.pi*minutes_from_open/375)

    return x

def add_patterns(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    x = df.copy()
    O, H, L, C = x["Open"], x["High"], x["Low"], x["Close"]
    body, abs_body = C - O, (C - O).abs()
    rng = (H - L).clip(lower=EPS)
    upper = (H - x[["Open","Close"]].max(axis=1)).clip(lower=0)
    lower = (x[["Open","Close"]].min(axis=1) - L).clip(lower=0)
    bull, bear = C > O, C < O

    p = {}
    p["doji"]              = abs_body <= rng*0.10
    p["long_legged_doji"]  = p["doji"] & (upper >= rng*0.35) & (lower >= rng*0.35)
    p["dragonfly_doji"]    = p["doji"] & (lower >= rng*0.70) & (upper <= rng*0.10)
    p["gravestone_doji"]   = p["doji"] & (upper >= rng*0.70) & (lower <= rng*0.10)
    p["spinning_top"]      = (abs_body/rng <= 0.35) & (upper/rng >= 0.20) & (lower/rng >= 0.20)
    p["marubozu_bull"]     = bull & (abs_body/rng >= 0.90)
    p["marubozu_bear"]     = bear & (abs_body/rng >= 0.90)
    p["hammer"]            = (lower >= 2*abs_body) & (upper <= 0.5*abs_body) & (abs_body/rng <= 0.45)
    p["inverted_hammer"]   = (upper >= 2*abs_body) & (lower <= 0.5*abs_body) & (abs_body/rng <= 0.45)
    
    prior_uptrend = C.shift(1) > C.rolling(10).mean().shift(1)
    p["hanging_man"]       = p["hammer"] & prior_uptrend
    p["shooting_star"]     = p["inverted_hammer"] & prior_uptrend

    pO, pC, pH, pL = O.shift(1), C.shift(1), H.shift(1), L.shift(1)
    p_abs = (pC - pO).abs()
    p_bull, p_bear = pC > pO, pC < pO

    p["bullish_engulfing"] = p_bear & bull & (O <= pC) & (C >= pO) & (abs_body > p_abs)
    p["bearish_engulfing"] = p_bull & bear & (O >= pC) & (C <= pO) & (abs_body > p_abs)
    p["bullish_harami"]    = p_bear & bull & (O >= pC) & (C <= pO) & (abs_body < p_abs)
    p["bearish_harami"]    = p_bull & bear & (O <= pC) & (C >= pO) & (abs_body < p_abs)
    p["piercing_pattern"]  = p_bear & bull & (O < pC) & (C > (pO + pC)/2) & (C < pO)
    p["dark_cloud_cover"]  = p_bull & bear & (O > pC) & (C < (pO + pC)/2) & (C > pO)
    p["tweezer_top"]       = p_bull & bear & (np.isclose(H, pH, rtol=0.001))
    p["tweezer_bottom"]    = p_bear & bull & (np.isclose(L, pL, rtol=0.001))
    p["inside_bar"]        = (H <= pH) & (L >= pL)
    p["outside_bar"]       = (H >= pH) & (L <= pL)

    p2O, p2C = O.shift(2), C.shift(2)
    p2_bull, p2_bear = p2C > p2O, p2C < p2O

    p["morning_star"] = p2_bear & (p_abs/((pH-pL).clip(lower=EPS)) <= 0.35) & bull & (C > (p2O+p2C)/2)
    p["evening_star"] = p2_bull & (p_abs/((pH-pL).clip(lower=EPS)) <= 0.35) & bear & (C < (p2O+p2C)/2)
    p["three_white_soldiers"] = p2_bull & p_bull & bull & (C > pC) & (pC > p2C)
    p["three_black_crows"]    = p2_bear & p_bear & bear & (C < pC) & (pC < p2C)
    p["three_inside_up"]      = p["bullish_harami"].shift(1).fillna(False).astype(bool) & bull & (C > pO)
    p["three_inside_down"]    = p["bearish_harami"].shift(1).fillna(False).astype(bool) & bear & (C < pO)
    p["three_outside_up"]     = p["bullish_engulfing"].shift(1).fillna(False).astype(bool) & bull & (C > pC)
    p["three_outside_down"]   = p["bearish_engulfing"].shift(1).fillna(False).astype(bool) & bear & (C < pC)

    for name, series in p.items():
        x[f"PATTERN_{name}"] = series.fillna(False).astype(np.float32)

    return x, [f"PATTERN_{n}" for n in p.keys()]

def build_live_features(recent_ohlcv_df: pd.DataFrame, pattern_columns: List[str], include_market_context: bool = True, token: Optional[str] = None) -> pd.DataFrame:
    from .market_data import download_history, validate_and_clean, restrict_to_normal_session, IST_TZ

    x = (
        recent_ohlcv_df
        .copy()
        .sort_values("Datetime")
        .drop_duplicates("Datetime")
        .reset_index(drop=True)
    )

    x = add_candle_anatomy(x)
    x = add_technical_indicators(x)
    x, detected_patterns = add_patterns(x)

    actual_patterns = pattern_columns if pattern_columns else detected_patterns

    # Trend interaction
    trend_up_live = (x["EMA_10_dist"] > 0).astype(np.float32)
    for col in actual_patterns:
        if col in x.columns:
            x[col + "_x_trend"] = x[col] * (2 * trend_up_live - 1)
        else:
            x[col] = 0.0
            x[col + "_x_trend"] = 0.0

    pat_cols_present = [c for c in actual_patterns if c in x.columns]
    pat_sum = x[pat_cols_present].sum(axis=1) if pat_cols_present else pd.Series(0.0, index=x.index)

    rolling_vol_median = x["Volatility_24"].rolling(100, min_periods=50).median()
    high_vol = (x["Volatility_24"] > rolling_vol_median).astype(np.float32)
    high_rel_vol = (x["RelativeVolume"] > 1.2).astype(np.float32)

    x["ANY_PATTERN_HIGH_VOL"] = (pat_sum > 0).astype(np.float32) * high_vol
    x["ANY_PATTERN_HIGH_RELVOL"] = (pat_sum > 0).astype(np.float32) * high_rel_vol

    # NIFTY context
    if include_market_context:
        try:
            now = pd.Timestamp.now(tz=IST_TZ)
            context_start = (now - pd.Timedelta(days=7)).strftime("%Y-%m-%d")
            context_end = now.strftime("%Y-%m-%d")

            idx_raw = download_history(
                NSE_INDEX_INSTRUMENT_KEY,
                context_start,
                context_end,
                interval=BASE_TIMEFRAME_MINUTES,
                token=token
            )

            if not idx_raw.empty:
                idx_raw, _ = validate_and_clean(idx_raw)
                idx_raw = restrict_to_normal_session(idx_raw)
                idx_raw = (
                    idx_raw[["Datetime", "Close"]]
                    .rename(columns={"Close": "Index_Close"})
                    .sort_values("Datetime")
                )
                idx_raw["Index_Return_1"] = idx_raw["Index_Close"].pct_change()
                idx_raw["Index_Volatility_12"] = idx_raw["Index_Return_1"].rolling(12, min_periods=12).std()

                x = x.merge(
                    idx_raw[["Datetime", "Index_Return_1", "Index_Volatility_12"]],
                    on="Datetime",
                    how="left"
                )
                x["Index_Return_1"] = x["Index_Return_1"].ffill().fillna(0.0)
                x["Index_Volatility_12"] = x["Index_Volatility_12"].ffill().fillna(0.0)
            else:
                x["Index_Return_1"] = 0.0
                x["Index_Volatility_12"] = 0.0
        except Exception:
            x["Index_Return_1"] = 0.0
            x["Index_Volatility_12"] = 0.0
    else:
        x["Index_Return_1"] = 0.0
        x["Index_Volatility_12"] = 0.0

    x = x.replace([np.inf, -np.inf], np.nan)
    return x

def audit_live_feature_distribution(live_feat: pd.DataFrame, feature_columns: List[str], scaler: Any) -> pd.DataFrame:
    rows = []
    latest = live_feat[feature_columns].iloc[-1].astype(float)

    for i, col in enumerate(feature_columns):
        value = latest[col]
        mean = scaler.mean_[i]
        std = scaler.scale_[i]
        z = (value - mean) / (std + 1e-12)
        rows.append({
            "Feature": col,
            "Live_Value": value,
            "Train_Mean": mean,
            "Train_Std": std,
            "Z_Score": z,
            "Abs_Z": abs(z)
        })

    audit = pd.DataFrame(rows).sort_values("Abs_Z", ascending=False).reset_index(drop=True)
    return audit

def flatten_for_xgb(X: np.ndarray) -> np.ndarray:
    """XGBoost consumes: last candle's features + mean + std over the lookback window."""
    last = X[:, -1, :]
    mean_ = X.mean(axis=1)
    std_ = X.std(axis=1)
    return np.concatenate([last, mean_, std_], axis=1)

def compute_confidence(
    horizon_minutes: int,
    gru_pred_return: float,
    xgb_pred_return: float,
    validation_confidence_stats: Dict[int, Any]
) -> float:
    """Validation-based ranking confidence score (0 to 100) exactly as in Notebook Cell 42."""
    stats = validation_confidence_stats.get(horizon_minutes, {
        "accuracy": 0.51, "p50_abs_return": 0.002, "p90_abs_return": 0.008
    })

    base_accuracy = stats["accuracy"]
    agreement = 1.0 if np.sign(gru_pred_return) == np.sign(xgb_pred_return) else 0.0

    p50 = stats.get("p50_abs_return", 0.002)
    p90 = stats.get("p90_abs_return", 0.008)

    abs_return = abs(gru_pred_return)
    if abs_return <= p50:
        conviction = 0.35 * (abs_return / (p50 + 1e-9))
    else:
        conviction = 0.35 + 0.65 * np.clip((abs_return - p50) / (p90 - p50 + 1e-9), 0, 1)

    score = (
        0.50 * base_accuracy +
        0.25 * agreement +
        0.25 * conviction
    )
    return float(np.clip(score * 100, 0, 100))

def compute_risk_levels(current_price: float, predicted_price: float, recent_atr: float) -> Dict[str, Any]:
    """ATR-based risk management (Cell 43)."""
    direction = 1 if predicted_price >= current_price else -1
    stop_distance = max(recent_atr * 1.0, current_price * 0.0015)
    target_price = predicted_price
    stop_loss = current_price - direction * stop_distance

    reward = abs(target_price - current_price)
    risk = abs(current_price - stop_loss)
    rr = reward / risk if risk > 0 else np.nan

    return {
        "entry": round(float(current_price), 2),
        "targetPrice": round(float(target_price), 2),
        "stopLoss": round(float(stop_loss), 2),
        "riskReward": round(float(rr), 2) if np.isfinite(rr) else None,
        "target_price": round(float(target_price), 2),
        "stop_loss": round(float(stop_loss), 2),
        "risk_reward": round(float(rr), 2) if np.isfinite(rr) else None,
    }

def generate_next_five_candles(
    gru_model: Any,
    scaled_window: np.ndarray,
    current_price: float,
    last_time: Any,
    recent_wick_frac: float,
    horizons_dict: Dict[int, int],
    max_single_step_pct: float = 0.02
) -> List[Dict[str, Any]]:
    """Next five 5-minute forecast candles derived from predicted cumulative log-returns (Cell 44)."""
    pred = gru_model.predict(scaled_window[np.newaxis, ...], verbose=0)[0]

    requested_horizons = [5, 10, 15, 20, 25]
    horizon_keys = list(horizons_dict.keys())
    horizon_indices = [horizon_keys.index(m) for m in requested_horizons if m in horizon_keys]

    cumulative_returns = pred[horizon_indices]
    prices = current_price * np.exp(cumulative_returns)

    candles = []
    prev_close = float(current_price)
    t = pd.Timestamp(last_time)
    wick_frac = float(np.clip(recent_wick_frac, 0.001, 0.05))

    for price in prices:
        price = float(price)
        t = t + pd.Timedelta(minutes=5)
        body = abs(price - prev_close)
        wick = max(body * wick_frac, prev_close * 0.0005)

        candle = {
            "time": t.strftime("%H:%M"),
            "open": round(prev_close, 2),
            "high": round(max(prev_close, price) + wick, 2),
            "low": round(min(prev_close, price) - wick, 2),
            "close": round(price, 2),
            "type": "predicted",
            "ohlc_note": "Synthetic forecast OHLC derived from predicted close."
        }
        candles.append(candle)
        prev_close = price

    return candles
