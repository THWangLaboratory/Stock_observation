import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from datetime import datetime

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("update_data", ROOT / "update_data.py")
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)
NOW = datetime(2026, 10, 16, 16, 30, tzinfo=updater.TAIPEI)
STOCK = {"code": "2330", "symbol": "2330.TW", "name": "台積電", "sector": "半導體"}


def frame(values=(100, 105), dates=("2026-10-15", "2026-10-16")):
    return pd.DataFrame({"Close": values, "Adj Close": values, "Volume": [1500] * len(values)}, index=pd.to_datetime(dates))


class ExportTests(unittest.TestCase):
    def test_change_units_and_date(self):
        stock = updater.make_stock(STOCK, frame(), NOW)
        self.assertEqual(stock["change"], 5)
        self.assertEqual(stock["changeAmount"], 5)
        self.assertEqual(stock["volume"], 1.5)
        self.assertEqual(stock["tradeDate"], "2026-10-16")

    def test_before_cutoff_drops_in_progress_bar(self):
        data = frame((90, 100, 105), ("2026-10-14", "2026-10-15", "2026-10-16"))
        morning = NOW.replace(hour=10)
        self.assertEqual(updater.make_stock(STOCK, data, morning)["tradeDate"], "2026-10-15")

    def test_weekend_and_future_rows_dropped(self):
        data = frame((100, 105, 110, 120), ("2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19"))
        rows = updater.normalize_frame(data, NOW)
        self.assertEqual([r["date"] for r in rows], ["2026-10-15", "2026-10-16"])

    def test_invalid_closes_not_forward_filled(self):
        data = frame((90, float("nan"), -1, 100), ("2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"))
        rows = updater.normalize_frame(data, NOW)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["close"], 90)

    def test_insufficient_data_rejected(self):
        with self.assertRaises(ValueError):
            updater.make_stock(STOCK, frame((100,), ("2026-10-16",)), NOW)

    def test_missing_adjustment_never_invented(self):
        data = frame().drop(columns="Adj Close")
        self.assertIsNone(updater.make_stock(STOCK, data, NOW)["adjustedHistory"][-1]["close"])

    def test_failed_download_preserves_cache_and_marks_it(self):
        old = updater.make_stock(STOCK, frame(), NOW)
        snapshot = updater.build_snapshot([STOCK], {}, {"stocks": [old], "generatedAt": "old-time"}, [{"code": "2330"}], NOW)
        self.assertEqual(snapshot["status"], "error")
        self.assertEqual(snapshot["generatedAt"], "old-time")
        self.assertEqual(snapshot["stocks"][0]["state"], "cached")
        self.assertEqual(snapshot["stocks"][0]["price"], 105)
        self.assertEqual(old["state"], "ready")

    def test_missing_cache_has_nulls(self):
        snapshot = updater.build_snapshot([STOCK], {}, {}, [{"code": "2330"}], NOW)
        self.assertIsNone(snapshot["stocks"][0]["price"])
        self.assertIsNone(snapshot["tradeDate"])

    def test_atomic_export_roundtrip_and_script_escaping(self):
        data = {"schemaVersion": 1, "name": "</script>", "stocks": []}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "market-data.js"
            updater.write_snapshot(path, data)
            self.assertEqual(updater.read_snapshot(path), data)
            self.assertNotIn("</script>", path.read_text(encoding="utf-8"))

    def test_real_snapshot_contract(self):
        snapshot = updater.read_snapshot(ROOT / "market-data.js")
        for stock in snapshot.get("stocks", []):
            if stock["price"] is None:
                continue
            self.assertGreater(stock["price"], 0)
            self.assertAlmostEqual(stock["change"], (stock["price"] / stock["previousClose"] - 1) * 100, places=4)
            self.assertEqual(stock["history"][-1]["date"], stock["tradeDate"])
            self.assertEqual(stock["history"][-1]["close"], stock["price"])
            self.assertEqual(stock["history"], sorted(stock["history"], key=lambda row: row["date"]))


if __name__ == "__main__":
    unittest.main()
