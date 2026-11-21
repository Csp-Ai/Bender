"""Explicit, append-only read-only research observations, not actual trades."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

from .history import utc_time, iso, canonical_json

STATES = {"FRESH", "DELAYED", "UNAVAILABLE", "SIMULATED", "MARKET_CLOSED"}


def validate_snapshot(payload):
    if not isinstance(payload, dict):
        raise ValueError("Snapshot must be an object")
    venue = payload.get("venue")
    if venue not in ("us", "international"):
        raise ValueError("Venue is required")
    market_id = payload.get("market_id")
    if not market_id or not isinstance(market_id, str):
        raise ValueError("Verified market ID is required")
    interval = payload.get("interval_minutes")
    if interval not in (5, 15):
        raise ValueError("Invalid contract interval")
    observed = utc_time(payload.get("observed_at"))
    if not observed:
        raise ValueError("An explicit timezone-aware observation timestamp is required")
    score = payload.get("chart_score")
    if score is not None and (isinstance(score, bool) or not isinstance(score, int) or abs(score)>8):
        raise ValueError("The eight-factor chart score is an integer from -8 to +8")
    for field in ("up_ask", "down_ask"):
        price = payload.get(field)
        if price is not None and (isinstance(price, bool) or not isinstance(price, (int,float)) or not math.isfinite(price) or not 0 < price < 1):
            raise ValueError("Quote must be in (0,1), or absent")
    if payload.get("data_status") not in STATES:
        raise ValueError("Data freshness is not specified")
    quote_time = payload.get("quote_observed_at")
    if quote_time is not None:
        quote_dt = utc_time(quote_time)
        if not quote_dt or quote_dt > observed:
            raise ValueError("Quote cannot come from the future")
    else:
        if payload.get("up_ask") is not None or payload.get("down_ask") is not None:
            raise ValueError("Quote requires a timestamp")
    if payload.get("verified_outcome") is not None:
        raise ValueError("Signal observations must not prefill future contract outcomes")
    return {
        "schema_version": 1,
        "observation_type": "read_only_signal",
        "venue": venue,
        "market_id": market_id,
        "interval_minutes": interval,
        "observed_at": iso(observed),
        "chart_score": score,
        "chart_lean": payload.get("chart_lean") if payload.get("chart_lean") in ("BULLISH", "BEARISH", "MIXED", None) else None,
        "data_status": payload["data_status"],
        "up_ask": payload.get("up_ask"),
        "down_ask": payload.get("down_ask"),
        "quote_observed_at": iso(utc_time(quote_time)) if quote_time else None,
        "quote_timestamp_type": "server_retrieval" if quote_time else None,
        "verified_outcome": None,
        "model_probability": None,
        "model_version": None,
        "trade_executed": False,
    }


def append_snapshot(path, observation):
    """Append locally to a journal. No serverless persistence is claimed."""
    record = validate_snapshot(observation)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(canonical_json(record) + "\n")
    return record
