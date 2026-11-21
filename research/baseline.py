"""Leakage-aware, zero-parameter walk-forward base-rate benchmark.

This is a *research simulation*, NOT a record of signals Bender emitted in real
time, and it makes no trading profitability claim. It is only available offline.
"""
from __future__ import annotations

from collections import defaultdict

from .evaluation import probability_metrics, validated_resolution


def walk_forward_base_rate(rows, min_training=100):
    """At every contract opening, use only earlier outcomes already verified.

    Laplace-smoothed unconditional Up frequency is a deliberately simple
    baseline. No use of current market resolution, pricing, or future contracts
    in prediction. Keep US/International and 5m/15m independent.
    """
    if not isinstance(min_training, int) or isinstance(min_training, bool) or min_training < 1:
        raise ValueError("min_training must be a positive integer")
    groups = defaultdict(list)
    seen = set()
    invalid = 0
    for row in rows:
        market = validated_resolution(row)
        if market is None:
            invalid += 1
            continue
        key = (market["venue"], market["horizon"], market["id"])
        if key in seen:
            invalid += 1
            continue
        seen.add(key)
        groups[key[:2]].append(market)

    output = []
    for (venue, horizon), markets in sorted(groups.items()):
        markets.sort(key=lambda x: (x["start"], x["id"]))
        simulated = []
        available = sorted(markets, key=lambda m: (m["resolved"], m["id"]))
        pointer = 0
        observed_count, observed_up = 0, 0
        for target in markets:
            # O(n log n) availability sweep. Only past resolutions known at
            # the target opening can influence this simulated forecast.
            while pointer < len(available) and available[pointer]["resolved"] <= target["start"]:
                prior = available[pointer]
                if prior["end"] <= target["start"]:
                    observed_count += 1
                    observed_up += int(prior["outcome"] == "UP")
                pointer += 1
            if observed_count < min_training:
                continue
            p = (observed_up + 1) / (observed_count + 2)
            simulated.append({
                "venue": venue,
                "market_id": target["id"],
                "interval_minutes": horizon,
                "probability_up": p,
                "predicted_at": target["start"].isoformat(),
                "ends_at": target["end"].isoformat(),
                "resolution_verified_at": target["resolved"].isoformat(),
                "verified_outcome": target["outcome"],
                "outcome_status": "verified",
                "model_version": "offline-base-rate-laplace-v1",
            })
        metrics = probability_metrics(simulated)
        output.append({
            "venue": venue, "interval_minutes": horizon,
            "available_verified_markets": len(markets),
            "simulated_walk_forward_predictions": len(simulated),
            "min_prior_resolved_markets": min_training,
            "metrics": metrics,
            "evaluation_type": "offline_historical_simulation_not_logged_live_signals",
            "profitability": "NOT_ESTABLISHED",
        })
    return {
        "groups": output,
        "invalid_or_duplicate_records": invalid,
        "warning": "Walk-forward base-rate results are not evidence of positive after-cost trading returns or a deployed probability model.",
    }
