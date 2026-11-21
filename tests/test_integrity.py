"""Historical capture integrity regressions. These never call the network."""
import json
import tempfile
import unittest
from pathlib import Path

from research.history import collect_day, canonical_json
from research.coverage import audit
from research.integrity import verify_day_archive, verify_page_checkpoint

US_MARKET = {
    "id": "123",
    "slug": "btc-updown-15m-2026-11-18-0600z",
    "assetPriceTerms": {
        "asset": {"symbol": "btc"}, "marketType": "ASSET_PRICE_MARKET_TYPE_UP_DOWN",
        "horizon": "15m", "windowStart": "2026-11-18T06:00:00Z",
        "windowEnd": "2026-11-18T06:15:00Z",
        "indexSymbol": "BRTI", "priceToBeat": {"value": 65421.12}
    },
}

class Response:
    status_code = 200
    url = "https://gateway.polymarket.us/v1/markets?closed=true"
    def __init__(self, body):
        self.body = body
    def json(self):
        return self.body
    def raise_for_status(self):
        return None

class Session:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0
    def get(self, *_args, **_kwargs):
        self.calls += 1
        return Response(self.payload)

class InterruptSession:
    def __init__(self):
        self.calls = 0
    def get(self, *_args, **_kwargs):
        self.calls += 1
        if self.calls == 1:
            return Response({"markets": [US_MARKET]})
        raise RuntimeError("Simulated interrupted page retrieval")

class EmptySession(Session):
    def __init__(self):
        super().__init__({"markets":[]})

class IntegrityTests(unittest.TestCase):
    def setup_archive(self, root):
        collect_day("us", "2026-11-18", root, session=Session({"markets":[US_MARKET]}))
        return Path(root) / "us" / "2026-11-18"

    def test_complete_day_verifies_all_hashes_and_coverage(self):
        with tempfile.TemporaryDirectory() as root:
            location = self.setup_archive(root)
            manifest = verify_day_archive(location)
            self.assertEqual(manifest["matching_contracts"], 1)
            self.assertEqual(audit(root)["venue_coverage"]["us"]["15"]["observed_market_records"], 1)

    def test_tampered_normalized_content_is_not_trusted(self):
        with tempfile.TemporaryDirectory() as root:
            location = self.setup_archive(root)
            with (location / "markets.jsonl").open("a") as handle:
                handle.write("{}\n")
            with self.assertRaisesRegex(ValueError, "integrity mismatch"):
                verify_day_archive(location)
            with self.assertRaisesRegex(ValueError, "integrity mismatch"):
                collect_day("us", "2026-11-18", root, session=Session({"markets":[]}))
            with self.assertRaisesRegex(ValueError, "integrity mismatch"):
                audit(root)

    def test_tampered_or_missing_raw_payload_is_not_trusted(self):
        with tempfile.TemporaryDirectory() as root:
            location = self.setup_archive(root)
            raw = next((location / "raw").glob("*.json"))
            raw.write_text(raw.read_text().replace("65421.12", "65421.13"))
            with self.assertRaisesRegex(ValueError, "Raw file integrity mismatch"):
                verify_day_archive(location)
            raw.unlink()
            with self.assertRaisesRegex(ValueError, "Missing raw payload"):
                verify_day_archive(location)

    def test_manifest_page_and_interval_counts_are_verified(self):
        with tempfile.TemporaryDirectory() as root:
            location = self.setup_archive(root)
            path = location / "manifest.json"
            manifest = json.loads(path.read_text())
            manifest["by_interval"]["15"] = 0
            path.write_text(canonical_json(manifest) + "\n")
            with self.assertRaisesRegex(ValueError, "horizon counts"):
                verify_day_archive(location)

    def test_interrupted_page_checkpoint_resumes_without_requerying_first_page(self):
        with tempfile.TemporaryDirectory() as root:
            stopped = InterruptSession()
            with self.assertRaisesRegex(RuntimeError, "interrupted"):
                collect_day("us", "2026-11-18", root, session=stopped, limit=1, max_pages=3)
            location = Path(root) / "us" / "2026-11-18"
            self.assertFalse((location / "manifest.json").exists())
            self.assertEqual(len(list((location / "checkpoints").glob("*.json"))), 1)
            resumed = EmptySession()
            manifest = collect_day("us", "2026-11-18", root, session=resumed, limit=1, max_pages=3)
            self.assertEqual(resumed.calls, 1, "Only the missing page should be fetched")
            self.assertEqual(manifest["matching_contracts"], 1)
            self.assertEqual(manifest["page_count"], 2)

    def test_invalid_checkpoint_hash_never_resumes_silently(self):
        with tempfile.TemporaryDirectory() as root:
            stopped = InterruptSession()
            with self.assertRaises(RuntimeError):
                collect_day("us", "2026-11-18", root, session=stopped, limit=1, max_pages=3)
            location = Path(root) / "us" / "2026-11-18"
            checkpoint = next((location / "checkpoints").glob("*.json"))
            data = json.loads(checkpoint.read_text())
            data["sha256"] = "0" * 64
            checkpoint.write_text(canonical_json(data) + "\n")
            with self.assertRaisesRegex(ValueError, "Missing raw payload"):
                collect_day("us", "2026-11-18", root, session=EmptySession(), limit=1, max_pages=3)

if __name__ == "__main__":
    unittest.main()
