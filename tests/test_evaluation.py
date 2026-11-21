import unittest
from research.evaluation import evidence_gates, probability_metrics, transitions
from research.journal import validate_snapshot


def resolved(i, direction, at_end=True):
    minute = i * 15
    start = f"2026-11-18T00:{minute:02d}:00Z"
    end = f"2026-11-18T00:{minute+15:02d}:00Z"
    return {"venue": "us", "market_id": str(i), "interval_minutes": 15,
            "starts_at": start, "ends_at": end, "verified_outcome": direction,
            "outcome_status": "verified", "resolution_verified_at": end if at_end else "2026-11-18T02:00:00Z"}


class EvaluationTests(unittest.TestCase):
    def test_adjacent_verified_results_descriptive_only(self):
        rows = [resolved(0, "UP"), resolved(1, "DOWN"), resolved(2, "UP")]
        report = transitions(rows)["groups"][0]
        self.assertEqual(report["eligible_adjacent_pairs"], 2)
        self.assertEqual(report["flip_count"], 2)
        self.assertEqual(report["interpretation"], "descriptive_only_not_a_validated_forecast")

    def test_delayed_prior_resolution_cannot_leak_into_next_market(self):
        rows = [resolved(0, "UP", False), resolved(1, "DOWN")]
        report = transitions(rows)["groups"][0]
        self.assertEqual(report["eligible_adjacent_pairs"], 0)
        self.assertEqual(report["skipped_pairs"], 1)

    def test_unverified_result_rejected(self):
        row = resolved(0, "UP")
        row["outcome_status"] = "unverified"
        report = transitions([row])
        self.assertEqual(len(report["groups"]), 0)
        self.assertEqual(report["rejected_or_duplicate_records"], 1)

    def test_empty_probability_metrics_returns_no_claim(self):
        report = probability_metrics([])
        self.assertIsNone(report["brier_score"])

    def test_probabilities_need_pre_resolution_timestamp_and_version(self):
        record = {"probability_up": 0.8, "predicted_at": "2026-11-18T00:10:00Z",
                  "ends_at": "2026-11-18T00:15:00Z",
                  "resolution_verified_at": "2026-11-18T00:16:00Z",
                  "verified_outcome": "UP", "outcome_status": "verified",
                  "model_version": "baseline-v1"}
        self.assertAlmostEqual(probability_metrics([record])["brier_score"], .04)
        record["predicted_at"] = "2026-11-18T00:17:00Z"
        with self.assertRaisesRegex(ValueError, "chronologically"):
            probability_metrics([record])

    def test_entry_timing_requires_quote_history(self):
        self.assertEqual(evidence_gates([resolved(0, "UP")])["net_profitability"], "NOT_ESTABLISHED")

    def test_snapshot_blocks_future_outcome_and_untimed_quote(self):
        base = {"venue": "us", "market_id": "m1", "interval_minutes": 5,
                "observed_at": "2026-11-20T10:00:00Z", "chart_score": 2,
                "chart_lean": "BULLISH", "data_status": "FRESH"}
        self.assertIsNone(validate_snapshot(base)["verified_outcome"])
        with self.assertRaisesRegex(ValueError, "timestamp"):
            validate_snapshot({**base, "up_ask": .6})
        with self.assertRaisesRegex(ValueError, "future"):
            validate_snapshot({**base, "verified_outcome": "UP"})


if __name__ == "__main__":
    unittest.main()
