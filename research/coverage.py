"""Summarize archive coverage without extrapolating missing contract history."""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from .history import utc_time


def audit(root):
    root = Path(root)
    inventory = defaultdict(list)
    for path in sorted(root.glob("*/????-??-??/manifest.json")):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if manifest.get("completed") is not True:
            continue
        venue = manifest.get("venue")
        if venue not in ("us", "international"):
            continue
        data_path = path.parent / "markets.jsonl"
        if not data_path.exists():
            raise ValueError("Manifest missing normalized file: " + str(path))
        records = [json.loads(x) for x in data_path.read_text(encoding="utf-8").splitlines() if x.strip()]
        if len(records) != manifest.get("matching_contracts"):
            raise ValueError("Manifest count mismatch: " + str(path))
        inventory[venue].extend(records)
    output = {}
    for venue, items in sorted(inventory.items()):
        by_horizon = {}
        for horizon in (5, 15):
            rows = [r for r in items if r.get("interval_minutes") == horizon]
            ids = {(r.get("venue"), r.get("market_id")) for r in rows}
            if len(ids) != len(rows):
                raise ValueError("Duplicate market IDs across daily files")
            valid = [utc_time(r.get("starts_at")) for r in rows]
            end_times = [utc_time(r.get("ends_at")) for r in rows]
            by_horizon[str(horizon)] = {
                "observed_market_records": len(rows),
                "verified_start_timestamp_count": sum(x is not None for x in valid),
                "verified_resolutions": sum(r.get("outcome_status") == "verified" and r.get("verified_outcome") in ("UP", "DOWN") for r in rows),
                "first_observed_end": min((x.isoformat() for x in end_times if x), default=None),
                "last_observed_end": max((x.isoformat() for x in end_times if x), default=None),
                "completeness": "not_verified",
                "executable_quote_coverage": "not_collected",
            }
        output[venue] = by_horizon
    return {
        "venue_coverage": output,
        "warning": "This counts only records successfully downloaded through configured source filters. Missing records, undiscovered dates, and source publication gaps are not resolved."
    }


def main():
    parser = argparse.ArgumentParser(description="Audit Bender contract metadata coverage")
    parser.add_argument("--input", default="research-data")
    args = parser.parse_args()
    print(json.dumps(audit(args.input), sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
