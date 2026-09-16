import os
import logging
import requests
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
try:
    from zoneinfo import ZoneInfo
    IST_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    try:
        import pytz
        IST_TZ = pytz.timezone("Asia/Kolkata")
    except Exception:
        IST_TZ = None

logger = logging.getLogger("ml-service.market_data")

UPSTOX_BASE = "https://api.upstox.com"
IST = "Asia/Kolkata"

def _get_token(override_token: Optional[str] = None) -> str:
    token = override_token or os.getenv("UPSTOX_ACCESS_TOKEN", "")
    return token.strip()

def _headers(token: Optional[str] = None) -> Dict[str, str]:
    t = _get_token(token)
    return {
        "Accept": "application/json",
        "Authorization": f"Bearer {t}"
    }

def upstox_get(url: str, token: Optional[str] = None, timeout: int = 30) -> Dict[str, Any]:
    try:
        resp = requests.get(url, headers=_headers(token), timeout=timeout)
        if resp.status_code != 200:
            logger.warning(f"[Upstox] API error {resp.status_code}: {resp.text[:300]}")
            return {"status": "error", "data": {}, "statusCode": resp.status_code, "text": resp.text}
        payload = resp.json()
        if payload.get("status") != "success":
            logger.warning(f"[Upstox] Non-success payload: {str(payload)[:300]}")
            return {"status": "error", "data": {}, "payload": payload}
        return payload
    except Exception as e:
        logger.error(f"[Upstox] Request exception for {url}: {e}")
        return {"status": "error", "data": {}, "error": str(e)}

def get_market_status(exchange: str = "NSE", token: Optional[str] = None) -> Dict[str, Any]:
    res = upstox_get(f"{UPSTOX_BASE}/v2/market/status/{exchange}", token=token)
    return res.get("data", {})

def get_market_timings(date_string: str, exchange: str = "NSE", token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    payload = upstox_get(f"{UPSTOX_BASE}/v2/market/timings/{date_string}", token=token)
    for row in payload.get("data", []):
        if row.get("exchange") == exchange:
            return row
    return None

def market_is_open(exchange: str = "NSE", token: Optional[str] = None) -> Dict[str, Any]:
    now = pd.Timestamp.now(tz=IST)
    today = now.strftime("%Y-%m-%d")
    status = get_market_status(exchange, token=token)
    market_status = status.get("status", "UNKNOWN")
    timings = get_market_timings(today, exchange, token=token)

    if timings is None:
        # Check standard NSE hours as fallback context
        # Normal NSE session: 09:15 to 15:30 IST Mon-Fri
        is_weekday = now.weekday() < 5
        curr_time = now.time()
        start_t = pd.Timestamp("09:15").time()
        end_t = pd.Timestamp("15:30").time()
        open_by_hours = is_weekday and (start_t <= curr_time < end_t)
        open_now = open_by_hours if market_status == "NORMAL_OPEN" else False

        return {
            "open": bool(open_now),
            "reason": "No NSE timing data returned from Upstox (weekend/holiday/session inactive)",
            "status": market_status if market_status != "UNKNOWN" else ("OPEN" if open_now else "CLOSED"),
            "now": str(now),
            "session_start": None,
            "session_end": None
        }

    try:
        start = pd.to_datetime(timings["start_time"], unit="ms", utc=True).tz_convert(IST)
        end = pd.to_datetime(timings["end_time"], unit="ms", utc=True).tz_convert(IST)
        open_now = (market_status == "NORMAL_OPEN") and (start <= now < end)

        return {
            "open": bool(open_now),
            "status": market_status,
            "now": str(now),
            "session_start": str(start),
            "session_end": str(end)
        }
    except Exception as e:
        logger.warn(f"[MarketStatus] Error parsing timing timestamps: {e}")
        return {
            "open": False,
            "status": market_status,
            "now": str(now),
            "error": str(e)
        }

def get_historical_candles(instrument_key: str, start_date: str, end_date: str, interval: int = 5, token: Optional[str] = None) -> pd.DataFrame:
    key = instrument_key.replace("|", "%7C")
    url = f"{UPSTOX_BASE}/v3/historical-candle/{key}/minutes/{interval}/{end_date}/{start_date}"
    payload = upstox_get(url, token=token)
    candles = payload.get("data", {}).get("candles", [])
    cols = ["Datetime", "Open", "High", "Low", "Close", "Volume", "OpenInterest"]
    if not candles:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(candles, columns=cols)
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    for c in cols[1:]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.sort_values("Datetime").drop_duplicates(subset=["Datetime"]).reset_index(drop=True)

def get_intraday_candles(instrument_key: str, interval: int = 5, token: Optional[str] = None) -> pd.DataFrame:
    key = instrument_key.replace("|", "%7C")
    url = f"{UPSTOX_BASE}/v3/historical-candle/intraday/{key}/minutes/{interval}"
    payload = upstox_get(url, token=token)
    candles = payload.get("data", {}).get("candles", [])
    cols = ["Datetime", "Open", "High", "Low", "Close", "Volume", "OpenInterest"]
    if not candles:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(candles, columns=cols)
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    for c in cols[1:]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.sort_values("Datetime").drop_duplicates(subset=["Datetime"]).reset_index(drop=True)

def month_ranges(start_date: str, end_date: str):
    start = pd.Timestamp(start_date).normalize()
    end = pd.Timestamp(end_date).normalize()
    cur = start
    while cur <= end:
        month_end = min((cur + pd.offsets.MonthEnd(0)).normalize(), end)
        yield cur.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")
        cur = (month_end + pd.Timedelta(days=1)).normalize()

def download_history(instrument_key: str, start_date: str, end_date: str, interval: int = 5, token: Optional[str] = None) -> pd.DataFrame:
    dfs = []
    for s, e in month_ranges(start_date, end_date):
        df_part = get_historical_candles(instrument_key, s, e, interval=interval, token=token)
        if not df_part.empty:
            dfs.append(df_part)
    if not dfs:
        return pd.DataFrame(columns=["Datetime", "Open", "High", "Low", "Close", "Volume", "OpenInterest"])
    combined = pd.concat(dfs, ignore_index=True)
    return combined.sort_values("Datetime").drop_duplicates(subset=["Datetime"]).reset_index(drop=True)

def validate_and_clean(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    x = df.copy()
    initial_rows = len(x)
    x = x.dropna(subset=["Datetime", "Open", "High", "Low", "Close"])
    for c in ["Open", "High", "Low", "Close"]:
        x = x[x[c] > 0]
    x = x[x["High"] >= x["Low"]]
    x = x[x["High"] >= x["Open"]]
    x = x[x["High"] >= x["Close"]]
    x = x[x["Low"] <= x["Open"]]
    x = x[x["Low"] <= x["Close"]]
    x = x.drop_duplicates(subset=["Datetime"]).sort_values("Datetime").reset_index(drop=True)
    final_rows = len(x)
    report = {"initial_rows": initial_rows, "dropped": initial_rows - final_rows, "final_rows": final_rows}
    return x, report

def restrict_to_normal_session(df: pd.DataFrame, session_start: str = "09:15", session_end: str = "15:30") -> pd.DataFrame:
    x = df.copy()
    clock = x["Datetime"].dt.time
    mask = (clock >= pd.Timestamp(session_start).time()) & (clock < pd.Timestamp(session_end).time())
    return x.loc[mask].copy().reset_index(drop=True)

def get_live_warmup_data(instrument_key: str, interval: int = 5, warmup_days: int = 7, token: Optional[str] = None) -> pd.DataFrame:
    now = pd.Timestamp.now(tz=IST)
    start_date = (now - pd.Timedelta(days=warmup_days)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    logger.info(f"[MarketData] Fetching live warm-up history for {instrument_key} from {start_date} to {end_date}")
    
    # 1. Fetch chunked history
    recent = download_history(instrument_key, start_date, end_date, interval=interval, token=token)

    # 2. Also fetch intraday candles for today
    try:
        intraday = get_intraday_candles(instrument_key, interval=interval, token=token)
        if not intraday.empty:
            if recent.empty:
                recent = intraday
            else:
                recent = pd.concat([recent, intraday], ignore_index=True)
                recent = recent.sort_values("Datetime").drop_duplicates(subset=["Datetime"]).reset_index(drop=True)
    except Exception as e:
        logger.warning(f"[MarketData] Failed fetching intraday additions: {e}")

    if recent.empty:
        return pd.DataFrame(columns=["Datetime", "Open", "High", "Low", "Close", "Volume", "OpenInterest"])

    recent, _ = validate_and_clean(recent)
    recent = restrict_to_normal_session(recent)

    # Remove any incomplete candle currently forming
    candle_end = recent["Datetime"] + pd.Timedelta(minutes=interval)
    if recent["Datetime"].dt.tz is None:
        now_compare = now.tz_localize(None)
    else:
        now_compare = now

    recent = recent.loc[candle_end <= now_compare].copy()
    recent = recent.drop_duplicates(subset=["Datetime"]).sort_values("Datetime").reset_index(drop=True)
    return recent
