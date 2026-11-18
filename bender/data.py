"""Read-only data providers; candle timestamps are UTC bar-start times."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import random
import pandas as pd
import requests

KRAKEN_PAIRS = {"BTC/USD": "XBTUSD", "ETH/USD": "ETHUSD", "SOL/USD": "SOLUSD"}


def kraken(symbol: str, interval: int) -> pd.DataFrame:
    if symbol not in KRAKEN_PAIRS or interval not in (5, 15):
        raise ValueError("Unsupported symbol or timeframe")
    response = requests.get("https://api.kraken.com/0/public/OHLC",
                            params={"pair": KRAKEN_PAIRS[symbol], "interval": interval}, timeout=15)
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(f"Kraken feed error: {payload['error']}")
    result = [v for k, v in payload["result"].items() if k != "last"]
    if len(result) != 1:
        raise RuntimeError("Unexpected Kraken response")
    rows = result[0]
    # Kraken always includes a final running/uncommitted candle.
    rows = rows[:-1]
    f = pd.DataFrame([{"timestamp": pd.to_datetime(int(r[0]), unit="s", utc=True),
        "open": float(r[1]), "high": float(r[2]), "low": float(r[3]),
        "close": float(r[4]), "volume": float(r[6])} for r in rows])
    now = pd.Timestamp.now(tz="UTC")
    return f[f["timestamp"] + pd.Timedelta(minutes=interval) <= now].reset_index(drop=True)


def demo(trend: str = "bullish", interval: int = 5, count: int = 260) -> pd.DataFrame:
    if trend not in ("bullish", "bearish", "sideways") or interval not in (5, 15):
        raise ValueError("Unknown demo trend or interval")
    rng = random.Random(420)
    p = 100.0
    drift = {"bullish": 0.0012, "bearish": -0.0012, "sideways": 0.0}[trend]
    now = datetime.now(timezone.utc)
    end = now.replace(second=0, microsecond=0) - timedelta(minutes=interval + now.minute % interval)
    candles = []
    for idx in range(count):
        opening = p
        p = max(1, p*(1+drift+rng.gauss(0, 0.0007)))
        wiggle = abs(rng.gauss(0, 0.0006))*p
        candles.append({"timestamp": end - timedelta(minutes=interval*(count-idx-1)),
            "open": opening, "high": max(opening, p)+wiggle,
            "low": min(opening, p)-wiggle, "close": p, "volume": 100+rng.random()*100})
    return pd.DataFrame(candles)
