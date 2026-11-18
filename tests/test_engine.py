import unittest
import pandas as pd
from bender.data import demo
from bender.engine import analyze, validate


class BenderEngineTests(unittest.TestCase):
    def test_bullish_demo(self):
        x = analyze(demo("bullish"), "DEMO", 5)
        self.assertEqual(x["bias"], "BULLISH")
        self.assertEqual(len(x["votes"]), 8)

    def test_bearish_demo(self):
        self.assertEqual(analyze(demo("bearish"), "DEMO", 5)["bias"], "BEARISH")

    def test_too_few_candles_rejected(self):
        with self.assertRaisesRegex(ValueError, "210"):
            validate(demo(count=100))

    def test_duplicate_candles_rejected(self):
        f = demo()
        f.loc[1, "timestamp"] = f.loc[0, "timestamp"]
        with self.assertRaisesRegex(ValueError, "unique"):
            validate(f)

    def test_invalid_price_rejected(self):
        f = demo()
        f.loc[4, "high"] = -1
        with self.assertRaisesRegex(ValueError, "Invalid"):
            validate(f)

    def test_stale_warning(self):
        f = demo()
        f["timestamp"] = pd.to_datetime(f["timestamp"], utc=True) - pd.Timedelta(days=2)
        self.assertTrue(any("Stale" in w for w in analyze(f, "TEST", 5)["warnings"]))


if __name__ == "__main__":
    unittest.main()
