"""Fail-closed verification for historical archives and completed collection manifests.

The manifest, normalized research table, raw JSON payloads, and per-page
checkpoints are all checked before Bender trusts a previously completed day.
This verifies storage integrity, NOT coverage completeness or market outcomes.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from .history import canonical_json, sha256, utc_time

HEX = re.compile(r"^[0-9a-f]{64}$")


def _source_payload(path, expected_digest):
    """Require exactly the immutable, canonical raw payload written at capture."""
    if not isinstance(expected_digest, str) or not HEX.fullmatch(expected_digest):
        raise ValueError("Invalid raw SHA-256 identifier")
    raw_file = path / "raw" / (expected_digest + ".json")
    if not raw_file.is_file():
        raise ValueError("Missing raw payload: " + str(raw_file))
    content = raw_file.read_text(encoding="utf-8")
    try:
        payload = json.loads(content)
        canonical = canonical_json(payload)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid raw JSON: " + str(raw_file)) from exc
    if content != canonical + "\n" or sha256(canonical) != expected_digest:
        raise ValueError("Raw file integrity mismatch: " + str(raw_file))
    return payload


def verify_day_archive(location, manifest=None):
    """Validate every saved input and output for one completed UTC day.

    Returns the manifest when all checks pass. Never repairs or silently
    replaces an existing archive; a compromised day must be quarantined and
    recollected intentionally.
    """
    path = Path(location)
    manifest_file = path / "manifest.json"
    if manifest is None:
        if not manifest_file.is_file():
            raise ValueError("Missing manifest for " + str(path))
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("completed") is not True or manifest.get("schema_version") != 2:
        raise ValueError("Incomplete or unsupported manifest")
    venue, day = manifest.get("venue"), manifest.get("utc_day")
    if venue not in ("us", "international") or not isinstance(day, str):
        raise ValueError("Invalid venue or day")
    try:
        parsed_day = date.fromisoformat(day)
    except ValueError as exc:
        raise ValueError("Invalid UTC day") from exc
    if day != path.name or venue != path.parent.name:
        raise ValueError("Manifest does not match venue/day directory")
    pages = manifest.get("raw_pages")
    if not isinstance(pages, list) or not pages or manifest.get("page_count") != len(pages):
        raise ValueError("Incomplete raw page listing")
    raw_hashes = set()
    expected_offset = 0
    page_limit = manifest.get("page_limit")
    if isinstance(page_limit, bool) or not isinstance(page_limit, int) or not 1<=page_limit<=100:
        raise ValueError("Missing or invalid manifest page limit; legacy archives require a trusted migration")
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("row_count"), int) or isinstance(page.get("row_count"), bool) or page["row_count"] < 0:
            raise ValueError("Invalid page row count")
        if page.get("offset") != expected_offset or not isinstance(page.get("url"), str) or not page["url"].startswith("https://"):
            raise ValueError("Invalid source page pagination or URL")
        sha = page.get("sha256")
        payload = _source_payload(path, sha)
        rows = payload if venue == "international" else payload.get("markets") if isinstance(payload, dict) else None
        if not isinstance(rows, list) or len(rows) != page["row_count"]:
            raise ValueError("Raw page count does not match payload")
        raw_hashes.add(sha)
        expected_offset += page_limit
        if page["row_count"] > page_limit:
            raise ValueError("Page returned more rows than configured limit")
    if pages[-1]["row_count"] >= page_limit:
        raise ValueError("Incomplete pagination: terminal page not demonstrated")
    if any(page["row_count"] != page_limit for page in pages[:-1]):
        raise ValueError("Incomplete pagination: nonterminal page returned short data")
    normalized_file = path / "markets.jsonl"
    if not normalized_file.is_file():
        raise ValueError("Missing normalized data file")
    content = normalized_file.read_text(encoding="utf-8")
    if not isinstance(manifest.get("normalized_sha256"), str) or sha256(content) != manifest["normalized_sha256"]:
        raise ValueError("Normalized data integrity mismatch")
    try:
        records = [json.loads(line) for line in content.splitlines()]
    except (TypeError, ValueError) as exc:
        raise ValueError("Malformed normalized JSONL") from exc
    if content != "".join(canonical_json(row) + "\n" for row in records):
        raise ValueError("Normalized JSONL is not canonical")
    if len(records) != manifest.get("matching_contracts"):
        raise ValueError("Manifest normalized record count mismatch")
    ids = set()
    for row in records:
        if not isinstance(row, dict) or row.get("venue") != venue or row.get("asset") != "BTC" or row.get("interval_minutes") not in (5, 15):
            raise ValueError("Invalid normalized market schema")
        market_id = row.get("market_id")
        if not isinstance(market_id, str) or not market_id or market_id in ids:
            raise ValueError("Duplicate or missing market ID")
        ids.add(market_id)
        end = utc_time(row.get("ends_at"))
        if end is None or end.date() != parsed_day:
            raise ValueError("Market is outside requested UTC day")
        if row.get("raw_source_sha256") not in raw_hashes:
            raise ValueError("Market is missing verified source payload")
    expected_counts = {str(interval):sum(row["interval_minutes"] == interval for row in records) for interval in (5,15)}
    if manifest.get("by_interval") != expected_counts:
        raise ValueError("Manifest horizon counts do not match normalized data")
    return manifest


def verify_page_checkpoint(location, filename, venue, day, offset, limit):
    """Read an existing checkpoint only when its source and payload are intact."""
    checkpoint = Path(location) / "checkpoints" / filename
    if not checkpoint.is_file():
        return None
    record = json.loads(checkpoint.read_text(encoding="utf-8"))
    if not isinstance(record, dict) or record.get("venue") != venue or record.get("day") != str(day) or record.get("offset") != offset or record.get("limit") != limit:
        raise ValueError("Invalid checkpoint identity: " + str(checkpoint))
    payload = _source_payload(Path(location), record.get("sha256"))
    rows = payload if venue == "international" else payload.get("markets") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or len(rows) != record.get("row_count"):
        raise ValueError("Checkpoint row count mismatch")
    if not isinstance(record.get("url"), str) or not record["url"].startswith("https://"):
        raise ValueError("Invalid checkpoint source URL")
    return payload, rows, record["url"], record["sha256"]
