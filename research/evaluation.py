"""Conservative evaluation of verified, timestamped BTC binary contract outcomes.

Metrics are research outputs, never automatic forecasts, trade instructions, or
proof of profitability. Missing archival quotes prevent trade-return inference.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import timedelta

from .history import utc_time

DIRECTIONS = {"UP", "DOWN"}
VENUES = {"us", "international"}


def validated_resolution(row):
    """Require explicit resolution verification and a sensible time axis."""
    if not isinstance(row, dict):
        return None
    venue = row.get("venue")
    horizon = row.get("interval_minutes")
    if venue not in VENUES or horizon not in (5, 15):
        return None
    if row.get("outcome_status") != "verified":
        return None
    outcome = row.get("verified_outcome")
    if outcome not in DIRECTIONS:
        return None
    start = utc_time(row.get("starts_at"))
    end = utc_time(row.get("ends_at"))
    resolved = utc_time(row.get("resolution_verified_at"))
    if not start or not end or not resolved or not (start < end <= resolved):
        return None
    if abs((end - start).total_seconds() - horizon * 60) > 30:
        return None
    if not row.get("market_id"):
        return None
    return {
        "venue": venue, "horizon": horizon, "id": str(row["market_id"]),
        "start": start, "end": end, "resolved": resolved,
        "outcome": outcome,
    }


def _wilson(successes, total, z=1.96):
    if not total:
        return None
    rate = successes / total
    denominator = 1 + z * z / total
    center = (rate + z * z / (2 * total)) / denominator
    radius = z * math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total) / denominator
    return [max(0.0, center - radius), min(1.0, center + radius)]


def transitions(rows):
    """Descriptive reversal counts: only fully verified, adjacent prior markets.

    Prior outcome must have been verified at/before the next market's start.
    This avoids hindsight leakage from outcomes published later.
    """
    groups = defaultdict(list)
    seen = set()
    rejected = 0
    for row in rows:
        item = validated_resolution(row)
        if item is None:
            rejected += 1
            continue
        key = (item["venue"], item["horizon"], item["id"])
        if key in seen:
            rejected += 1
            continue
        seen.add(key)
        groups[key[:2]].append(item)
    result = []
    for (venue, horizon), markets in sorted(groups.items()):
        markets.sort(key=lambda x: (x["start"], x["id"]))
        count = Counter()
        skipped = 0
        for previous, current in zip(markets, markets[1:]):
            if previous["end"] != current["start"] or previous["resolved"] > current["start"]:
                skipped += 1
                continue
            count[(previous["outcome"], current["outcome"])] += 1
        flips = count[("UP", "DOWN")] + count[("DOWN", "UP")]
        same = count[("UP", "UP")] + count[("DOWN", "DOWN")]
        n = flips + same
        result.append({
            "venue": venue, "interval_minutes": horizon,
            "verified_market_count": len(markets),
            "eligible_adjacent_pairs": n,
            "skipped_pairs": skipped,
            "flip_count": flips, "same_count": same,
            "flip_rate": flips / n if n else None,
            "flip_rate_wilson_95": _wilson(flips, n),
            "interpretation": "descriptive_only_not_a_validated_forecast",
        })
    return {"groups": result, "rejected_or_duplicate_records": rejected,
            "warning": "An observed streak or flip rate does not by itself predict the next contract."}


def probability_metrics(observations):
    """Evaluate historical probabilities, never infer them from market asks.

    Each record needs explicitly recorded model probability and actual outcome;
    the prediction must predate the contract end and the outcome verification.
    """
    losses = []
    correct = 0
    for observation in observations:
        if not isinstance(observation, dict):
            raise ValueError("Invalid prediction record")
        probability = observation.get("probability_up")
        if isinstance(probability, bool) or not isinstance(probability, (int, float)) or not math.isfinite(probability) or not 0 <= probability <= 1:
            raise ValueError("Probability must be finite in [0,1]")
        published = utc_time(observation.get("predicted_at"))
        end = utc_time(observation.get("ends_at"))
        resolved = utc_time(observation.get("resolution_verified_at"))
        outcome = observation.get("verified_outcome")
        if not published or not end or not resolved or not published < end <= resolved or outcome not in DIRECTIONS:
            raise ValueError("Prediction and resolution timestamps must be verified and chronologically consistent")
        if observation.get("outcome_status") != "verified" or not observation.get("model_version"):
            raise ValueError("Unverified outcome or missing model version")
        label = 1 if outcome == "UP" else 0
        eps = 1e-15
        clipped = min(1-eps, max(eps, probability))
        log_loss = -(label * math.log(clipped) + (1-label) * math.log(1-clipped))
        losses.append(((probability-label)**2, log_loss))
        correct += int((probability > 0.5) == bool(label)) if probability != 0.5 else 0
    if not losses:
        return {"sample_size": 0, "brier_score": None, "log_loss": None, "accuracy_excluding_ties": None}
    return {"sample_size": len(losses),
            "brier_score": sum(x[0] for x in losses)/len(losses),
            "log_loss": sum(x[1] for x in losses)/len(losses),
            "accuracy_excluding_ties": correct/len(losses),
            "disclosure": "Descriptive historical model metrics, not a verified trading edge."}


def evidence_gates(records):
    """Without full quote/fill data, return unsupported rather than fake ROI."""
    count = sum(1 for row in records if validated_resolution(row))
    return {
        "verified_resolutions": count,
        "entry_timing": "NOT_EVALUABLE_WITHOUT_TIMESTAMPED_QUOTES",
        "entry_price_thresholds": "NOT_EVALUABLE_WITHOUT_TIMESTAMPED_QUOTES_AND_FEES",
        "late_reversals": "NOT_EVALUABLE_WITHOUT_TIMESTAMPED_REFERENCE_OBSERVATIONS",
        "no_trade_filters": "NOT_EVALUABLE_WITHOUT_POINT_IN_TIME_SIGNALS",
        "net_profitability": "NOT_ESTABLISHED",
    }
