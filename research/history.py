"""Auditable BTC Up/Down market metadata collection; never manufactures quote history.

The official public metadata endpoints do not guarantee historical bid/ask replay.
This tool stores raw JSON responses unchanged and separately normalizes verified fields.
Use a bounded date window and venue; never merge US and International results.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

GAMMA = "https://gamma-api.polymarket.com/markets"
US = "https://gateway.polymarket.us/v1/markets"
GAMMA_SLUG = re.compile(r"^btc-updown-(5|15)m-(\d{9,11})$")
US_TYPE = "ASSET_PRICE_MARKET_TYPE_UP_DOWN"


def utc_time(value):
    """Reject naive and invalid timestamps rather than silently assuming UTC."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(timezone.utc)


def iso(dt):
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z") if dt else None


def positive_decimal(value):
    if isinstance(value, dict):
        value = value.get("value")
    if isinstance(value, bool) or value in (None, ""):
        return None
    try:
        number = float(value)
        if number > 0 and number < float("inf"):
            return number
    except (TypeError, ValueError, OverflowError):
        pass
    return None


def normalize_market(venue, market, source_sha, collected_at):
    """Canonical metadata with explicit uncertainty; outcomes are never guessed."""
    if not isinstance(market, dict):
        return None
    slug = str(market.get("slug") or "")
    identifier = str(market.get("id") or "")
    if not slug or not identifier:
        return None

    if venue == "us":
        t = market.get("assetPriceTerms") or {}
        if t.get("marketType") != US_TYPE or str((t.get("asset") or {}).get("symbol", "")).lower() != "btc":
            return None
        horizon = str(t.get("horizon", "")).lower()
        if horizon not in ("5m", "15m"):
            return None
        interval = int(horizon[:-1])
        starts = utc_time(t.get("windowStart"))
        ends = utc_time(t.get("windowEnd"))
        target = positive_decimal(t.get("priceToBeat"))
        reference = str(t.get("indexSymbol") or "") or None
        start_basis = "venue_terms" if starts else "unavailable"
    elif venue == "international":
        match = GAMMA_SLUG.fullmatch(slug)
        if not match:
            return None
        interval = int(match.group(1))
        # Gamma startDate can be listing creation time, not the contract boundary.
        # Do not infer an official start merely from the UNIX epoch in the slug.
        starts = utc_time(market.get("windowStart"))
        ends = utc_time(market.get("endDate"))
        target = None
        reference = None  # Settlement oracle/rules require separate contract verification.
        start_basis = "explicit_window" if starts else "unavailable"
    else:
        raise ValueError("Unknown venue; must be us or international")

    if not ends or starts and (ends <= starts or abs((ends - starts).total_seconds() - interval * 60) > 30):
        return None
    return {
        "schema_version": 1,
        "venue": venue,
        "market_id": identifier,
        "slug": slug,
        "asset": "BTC",
        "interval_minutes": interval,
        "starts_at": iso(starts),
        "start_basis": start_basis,
        "ends_at": iso(ends),
        "reference_symbol": reference,
        "opening_target": target,
        "verified_outcome": None,
        "resolution_verified_at": None,
        "outcome_status": "unverified",
        "has_historical_executable_quotes": False,
        "raw_source_sha256": source_sha,
        "collected_at": collected_at,
    }


def query_params(venue, day, limit, offset):
    start = datetime.combine(day, datetime.min.time(), timezone.utc)
    end = start + timedelta(days=1)
    if venue == "us":
        return {
            "closed": "true", "limit": limit, "offset": offset,
            "endDateMin": iso(start), "endDateMax": iso(end),
            "orderBy": "endDate", "orderDirection": "asc",
        }
    if venue == "international":
        return {
            "closed": "true", "limit": limit, "offset": offset,
            "end_date_min": iso(start), "end_date_max": iso(end),
            "order": "endDate", "ascending": "true",
        }
    raise ValueError("Unknown venue")


def get_page(session, venue, day, offset, limit=100, attempts=4):
    endpoint = US if venue == "us" else GAMMA
    params = query_params(venue, day, limit, offset)
    for attempt in range(attempts):
        try:
            result = session.get(endpoint, params=params, timeout=20, headers={"Accept": "application/json"})
            if result.status_code == 429 or 500 <= result.status_code < 600:
                if attempt + 1 < attempts:
                    time.sleep(min(2 ** attempt, 8))
                    continue
            result.raise_for_status()
            body = result.json()
            rows = body if venue == "international" else body.get("markets") if isinstance(body, dict) else None
            if not isinstance(rows, list):
                raise ValueError("Unexpected market response shape")
            return body, rows, result.url
        except (requests.Timeout, requests.ConnectionError):
            if attempt + 1 >= attempts:
                raise
            time.sleep(min(2 ** attempt, 8))
    raise RuntimeError("History download exhausted retries")


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     prefix=path.name + ".", suffix=".tmp", delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(content)
    os.replace(temporary, path)


def collect_day(venue, day, root, *, session=None, limit=100, max_pages=100):
    """Collect one UTC day. A completed manifest makes reruns idempotent.

    All raw payloads are content-addressed and immutable. A truncated run never
    receives a completed manifest, and the page cap raises instead of claiming coverage.
    """
    if venue not in ("us", "international"):
        raise ValueError("Invalid venue")
    if not 1 <= limit <= 100 or max_pages < 1:
        raise ValueError("Invalid pagination limits")
    if isinstance(day, str):
        day = date.fromisoformat(day)
    root = Path(root)
    location = root / venue / day.isoformat()
    manifest_path = location / "manifest.json"
    if manifest_path.exists():
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    session = session or requests.Session()
    retrieved_at = iso(datetime.now(timezone.utc))
    by_id = {}
    page_infos = []
    for page in range(max_pages):
        body, rows, url = get_page(session, venue, day, page * limit, limit)
        raw = canonical_json(body)
        digest = sha256(raw)
        raw_path = location / "raw" / (digest + ".json")
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        if not raw_path.exists():
            with open(raw_path, "x", encoding="utf-8") as file:
                file.write(raw + "\n")
        page_infos.append({"offset": page * limit, "row_count": len(rows), "url": url, "sha256": digest})
        for market in rows:
            normalized = normalize_market(venue, market, digest, retrieved_at)
            if not normalized:
                continue
            # A daily query should not silently accept out-of-window results.
            ends = utc_time(normalized["ends_at"])
            if ends.date() != day:
                continue
            key = (normalized["venue"], normalized["market_id"])
            if key in by_id and by_id[key]["slug"] != normalized["slug"]:
                raise ValueError("Conflicting ID in same venue")
            by_id[key] = normalized
        if len(rows) < limit:
            break
    else:
        raise RuntimeError("Maximum pages reached; day is incomplete, increase --max-pages")

    records = sorted(by_id.values(), key=lambda r: (r["ends_at"], r["market_id"]))
    normalized = "".join(canonical_json(r) + "\n" for r in records)
    atomic_write(location / "markets.jsonl", normalized)
    manifest = {
        "schema_version": 1, "venue": venue, "utc_day": day.isoformat(),
        "collected_at": retrieved_at, "page_count": len(page_infos),
        "matching_contracts": len(records),
        "by_interval": {str(n): sum(r["interval_minutes"] == n for r in records) for n in (5, 15)},
        "raw_pages": page_infos, "normalized_sha256": sha256(normalized),
        "coverage": "query_window_metadata_only_completeness_not_proven",
        "completed": True,
        "notes": "API window results are not a completeness guarantee. Outcomes are unverified and quote history is not included.",
    }
    atomic_write(manifest_path, canonical_json(manifest) + "\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Read-only, provenance-first BTC contract metadata backfill")
    parser.add_argument("--venue", choices=["us", "international"], required=True)
    parser.add_argument("--from-date", required=True, help="UTC YYYY-MM-DD, inclusive")
    parser.add_argument("--to-date", required=True, help="UTC YYYY-MM-DD, inclusive")
    parser.add_argument("--output", default="research-data", help="Directory excluded from git")
    parser.add_argument("--max-pages", type=int, default=100)
    args = parser.parse_args()
    start, end = date.fromisoformat(args.from_date), date.fromisoformat(args.to_date)
    if end < start or (end - start).days > 365:
        parser.error("Date range must be 0 to 365 days (split longer backfills into batches)")
    with requests.Session() as session:
        current = start
        while current <= end:
            result = collect_day(args.venue, current, args.output, session=session, max_pages=args.max_pages)
            print(canonical_json({k: result[k] for k in ("venue", "utc_day", "matching_contracts", "by_interval", "completed")}))
            current += timedelta(days=1)


if __name__ == "__main__":
    main()
