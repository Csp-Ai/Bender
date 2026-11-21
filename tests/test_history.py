import json
import tempfile
import unittest
from pathlib import Path

from research.history import collect_day, normalize_market, utc_time, sha256

US_MARKET = {
    "id": "123", "slug": "btc-updown-15m-demo", "closed": True,
    "assetPriceTerms": {
        "asset": {"symbol": "btc"},
        "marketType": "ASSET_PRICE_MARKET_TYPE_UP_DOWN",
        "horizon": "15m", "windowStart": "2026-11-18T06:00:00Z",
        "windowEnd": "2026-11-18T06:15:00Z",
        "indexSymbol": "BRTI", "priceToBeat": {"value": 65421.12},
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
        pass


class Session:
    def __init__(self, body):
        self.body = body
        self.calls = 0

    def get(self, *_args, **_kwargs):
        self.calls += 1
        return Response(self.body)


class HistoryTests(unittest.TestCase):
    def test_time_parser_rejects_naive_and_invalid(self):
        self.assertIsNone(utc_time("2026-11-18T06:00:00"))
        self.assertIsNone(utc_time("not a time"))
        self.assertIsNotNone(utc_time("2026-11-18T06:00:00Z"))

    def test_us_terms_verified_but_outcome_unknown(self):
        result = normalize_market("us", US_MARKET, "hash", "2026-11-20T00:00:00Z")
        self.assertEqual(result["interval_minutes"], 15)
        self.assertEqual(result["opening_target"], 65421.12)
        self.assertEqual(result["start_basis"], "venue_terms")
        self.assertIsNone(result["verified_outcome"])
        self.assertFalse(result["has_historical_executable_quotes"])

    def test_rejects_wrong_type_and_invalid_times(self):
        broken = json.loads(json.dumps(US_MARKET))
        broken["assetPriceTerms"]["asset"]["symbol"] = "eth"
        self.assertIsNone(normalize_market("us", broken, "hash", "2026-11-20T00:00:00Z"))
        broken["assetPriceTerms"]["asset"]["symbol"] = "btc"
        broken["assetPriceTerms"]["windowStart"] = "2026-11-18T07:00:00Z"
        self.assertIsNone(normalize_market("us", broken, "hash", "2026-11-20T00:00:00Z"))

    def test_international_slug_does_not_fabricate_window(self):
        market = {"id": "7", "slug": "btc-updown-5m-1763452800",
                  "endDate": "2026-11-18T00:05:00Z", "closed": True}
        row = normalize_market("international", market, "hash", "2026-11-20T00:00:00Z")
        self.assertEqual(row["interval_minutes"], 5)
        self.assertIsNone(row["starts_at"])
        self.assertIsNone(row["reference_symbol"])
        self.assertIsNone(row["verified_outcome"])

    def test_collect_day_persists_immutable_raw_and_idempotent_manifest(self):
        session = Session({"markets": [US_MARKET]})
        with tempfile.TemporaryDirectory() as root:
            a = collect_day("us", "2026-11-18", root, session=session)
            b = collect_day("us", "2026-11-18", root, session=session)
            self.assertEqual(a, b)
            self.assertEqual(session.calls, 1)
            self.assertEqual(a["matching_contracts"], 1)
            home = Path(root) / "us" / "2026-11-18"
            records = (home / "markets.jsonl").read_text()
            self.assertEqual(sha256(records), a["normalized_sha256"])
            self.assertEqual(len(list((home / "raw").glob("*.json"))), 1)

    def test_page_cap_does_not_claim_completed_coverage(self):
        session = Session({"markets": [US_MARKET]})
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(RuntimeError, "incomplete"):
                collect_day("us", "2026-11-18", root, session=session, limit=1, max_pages=1)
            self.assertFalse((Path(root) / "us" / "2026-11-18" / "manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
