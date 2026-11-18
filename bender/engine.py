"""Explainable chart bias from completed OHLCV candles; NOT a trading forecast."""
from __future__ import annotations
from datetime import datetime, timezone
import pandas as pd

MIN_CANDLES = 210
MAX_SCORE = 8


def validate(candles: pd.DataFrame) -> pd.DataFrame:
    cols = ["timestamp", "open", "high", "low", "close", "volume"]
    if any(c not in candles.columns for c in cols):
        raise ValueError("Missing OHLCV columns")
    frame = candles[cols].copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    for col in cols[1:]:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    if frame.isna().any().any():
        raise ValueError("Invalid or missing candle value")
    frame = frame.sort_values("timestamp").reset_index(drop=True)
    if frame["timestamp"].duplicated().any():
        raise ValueError("Candle timestamps must be unique")
    prices = frame[["open", "high", "low", "close"]]
    if ((prices <= 0).any(axis=1) | (frame["volume"] < 0)).any():
        raise ValueError("Invalid price or volume")
    if ((frame["high"] < prices[["open", "low", "close"]].max(axis=1)) | (frame["low"] > prices[["open", "high", "close"]].min(axis=1))).any():
        raise ValueError("Invalid OHLC range")
    if len(frame) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} completed candles")
    return frame


def analyze(candles: pd.DataFrame, symbol: str, interval: int, source: str = "DEMO") -> dict:
    if interval not in (5, 15):
        raise ValueError("Only 5- and 15-minute intervals supported")
    f = validate(candles)
    c = f["close"]
    for n in (9, 20, 50, 200):
        f[f"ema{n}"] = c.ewm(span=n, adjust=False).mean()
    macd = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
    f["macd_hist"] = macd - macd.ewm(span=9, adjust=False).mean()
    delta = c.diff()
    gains = delta.clip(lower=0).ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    losses = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    rs = gains / losses.replace(0, float("nan"))
    f["rsi14"] = (100 - 100/(1+rs)).mask((losses == 0) & (gains > 0), 100).mask((gains == 0) & (losses > 0), 0).mask((gains == 0) & (losses == 0), 50)
    tp = (f["high"] + f["low"] + f["close"]) / 3
    f["vwap50"] = (tp*f["volume"]).rolling(50).sum() / f["volume"].rolling(50).sum().replace(0, float("nan"))
    f["avg_volume20"] = f["volume"].rolling(20).mean()
    last, prior = f.iloc[-1], f.iloc[-2]
    highs, lows = f["high"].iloc[-21:-1], f["low"].iloc[-21:-1]
    resistance, support = float(highs.max()), float(lows.min())
    votes = []
    def vote(name: str, direction: int, evidence: str) -> None:
        votes.append({"factor": name, "direction": direction, "evidence": evidence})
    sign = lambda a, b: int(a > b) - int(a < b)
    vote("Short trend", sign(last.ema9, last.ema20), "EMA9 versus EMA20")
    vote("Intermediate trend", sign(last.close, last.ema50), "Close versus EMA50")
    vote("Long trend", sign(last.ema50, last.ema200), "EMA50 versus EMA200")
    vote("Rolling VWAP", sign(last.close, last.vwap50), "Close versus 50-bar rolling VWAP (not session VWAP)")
    vote("MACD", sign(last.macd_hist, 0), "Histogram sign")
    rsi = float(last.rsi14)
    vote("RSI", 1 if 55 <= rsi <= 75 else -1 if 25 <= rsi <= 45 else 0, f"RSI(14) {rsi:.1f}")
    vote("Breakout", 1 if last.close > resistance else -1 if last.close < support else 0, "Close versus prior 20-bar range")
    vol_ratio = float(last.volume / last.avg_volume20) if last.avg_volume20 > 0 else 0.0
    vote("Volume confirmation", sign(last.close, prior.close) if vol_ratio >= 1.2 else 0, f"Volume ratio {vol_ratio:.2f}x; threshold 1.2x")
    score = sum(v["direction"] for v in votes)
    bias = "BULLISH" if score >= 4 else "BEARISH" if score <= -4 else "NEUTRAL"
    age_minutes = (datetime.now(timezone.utc) - last.timestamp.to_pydatetime()).total_seconds()/60
    warnings = []
    if age_minutes > interval*3:
        warnings.append("Stale last candle; do not treat as current")
    if age_minutes < 0:
        warnings.append("Future-dated candle")
    if source == "DEMO":
        warnings.append("SIMULATED DATA; not suitable for live trades")
    if (f["volume"].tail(20) == 0).any():
        warnings.append("Zero-volume bars may distort volume indicators")
    return {"symbol": symbol, "interval": interval, "source": source, "bias": bias,
            "score": score, "max_score": MAX_SCORE, "votes": votes,
            "last_close": float(last.close), "candle_time_utc": last.timestamp.isoformat(),
            "levels": {"support20": support, "resistance20": resistance},
            "rsi14": rsi, "warnings": warnings, "chart": f}
