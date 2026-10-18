"""Export Yahoo Finance daily data to a static, offline-readable web snapshot.

Run: python update_data.py
Only completed sessions are exported; a failed ticker never receives fake prices.
"""
from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta
import json
import math
import os
from pathlib import Path
import sys
import time as clock
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
TAIPEI = ZoneInfo("Asia/Taipei")
PREFIX = "window.STOCKROOM_DATA = "


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def normalize_frame(frame, now):
    """Drop invalid, future and not-yet-completed daily bars; don't forward-fill."""
    if frame is None or frame.empty:
        raise ValueError("Yahoo 未回傳日線資料")
    if getattr(frame.columns, "nlevels", 1) > 1:
        raise ValueError("預期單一股票欄位")
    rows = {}
    for index, row in frame.sort_index().iterrows():
        stamp = index.to_pydatetime()
        day = (stamp.astimezone(TAIPEI) if stamp.tzinfo else stamp).date()
        if day > now.date() or day.weekday() >= 5:
            continue
        # Conservative cutoff: never label an in-progress bar as a closing quote.
        if day == now.date() and now.time().replace(tzinfo=None) < time(16, 0):
            continue
        close, adj, volume = (number(row.get(key)) for key in ("Close", "Adj Close", "Volume"))
        if close is None or close <= 0:
            continue
        rows[day.isoformat()] = {
            "date": day.isoformat(), "close": round(close, 6),
            "adjustedClose": round(adj, 6) if adj is not None and adj > 0 else None,
            "volume": int(volume) if volume is not None and volume >= 0 else None,
        }
    result = list(rows.values())
    if len(result) < 2:
        raise ValueError("不足兩個已完成交易日，無法計算漲跌幅")
    return result


def make_stock(spec, frame, now):
    rows = normalize_frame(frame, now)
    last, previous = rows[-1], rows[-2]
    # Raw closing prices: percentage is close-to-close, not an exchange ex-right reference.
    change = (last["close"] / previous["close"] - 1) * 100
    return {
        **spec, "price": last["close"], "previousClose": previous["close"],
        "change": round(change, 6), "changeAmount": round(last["close"]-previous["close"], 6),
        "volume": last["volume"] / 1000 if last["volume"] is not None else None,
        "tradeDate": last["date"], "previousDate": previous["date"],
        "history": [{"date": r["date"], "close": r["close"]} for r in rows[-130:]],
        "adjustedHistory": [{"date": r["date"], "close": r["adjustedClose"]} for r in rows[-130:]],
        "state": "ready", "fetchedAt": now.isoformat(timespec="seconds"),
    }


def read_snapshot(path):
    try:
        raw = path.read_text(encoding="utf-8")
        if not raw.startswith(PREFIX):
            return {}
        data = json.loads(raw[len(PREFIX):].strip().removesuffix(";"))
        return data if data.get("schemaVersion") == 1 else {}
    except (OSError, ValueError, AttributeError):
        return {}


def write_snapshot(path, snapshot):
    # One canonical file, atomic replacement; escape '<' so names cannot inject script tags.
    body = json.dumps(snapshot, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
    temp = path.with_suffix(".tmp")
    temp.write_text(PREFIX + body + ";\n", encoding="utf-8")
    os.replace(temp, path)


def build_snapshot(specs, fetched, previous, failures, now):
    previous_by_code = {s["code"]: s for s in previous.get("stocks", [])}
    stocks = []
    for spec in specs:
        if spec["code"] in fetched:
            stocks.append(fetched[spec["code"]])
        else:
            old = previous_by_code.get(spec["code"], {})
            if old.get("price") is not None and old.get("symbol") == spec["symbol"]:
                stocks.append({**old, **spec, "state": "cached"})
            else:
                stocks.append({**spec, "price": None, "change": None, "volume": None,
                               "tradeDate": None, "history": [], "adjustedHistory": [], "state": "unavailable"})
    trade_date = max((s["tradeDate"] for s in stocks if s.get("tradeDate")), default=None)
    return {"schemaVersion": 1, "source": "yfinance / Yahoo Finance", "status": "ready" if not failures else "partial" if fetched else "error",
            "generatedAt": now.isoformat(timespec="seconds") if fetched else previous.get("generatedAt"),
            "attemptedAt": now.isoformat(timespec="seconds"), "tradeDate": trade_date,
            "failures": failures, "stocks": stocks,
            "changeBasis": "raw_close_to_previous_raw_close", "completedSessionCutoff": "16:00 Asia/Taipei"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "market-data.js")
    parser.add_argument("--codes", help="Only fetch these codes for diagnostics; others retain old cache")
    args = parser.parse_args()
    import yfinance as yf
    specs = json.loads((ROOT / "stocks.json").read_text(encoding="utf-8"))
    now = datetime.now(TAIPEI)
    selected = set(args.codes.split(",")) if args.codes else None
    target = [s for s in specs if selected is None or s["code"] in selected]
    if not target:
        parser.error("沒有符合的股票代碼")
    # All library caches stay next to the export, not in the user's home directory.
    cache = args.output.parent / ".yfinance-cache"
    cache.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(cache))
    previous = read_snapshot(args.output)
    fetched, failures = {}, []
    for spec in specs:
        if spec not in target:
            failures.append({"code": spec["code"], "reason": "此輪未更新"})
    symbols = [s["symbol"] for s in target]
    print(f"Downloading {len(symbols)} Taiwan stocks (completed daily sessions)...", flush=True)
    try:
        batch = yf.download(symbols, period="1y", interval="1d", auto_adjust=False,
                            actions=False, group_by="ticker", threads=4, progress=False,
                            timeout=20, multi_level_index=True)
    except Exception as exc:
        print(f"Batch failed: {type(exc).__name__}", flush=True)
        batch = None
    for spec in target:
        result, reason = None, "下載失敗"
        for attempt in range(2):
            try:
                if attempt == 0 and batch is not None and not batch.empty:
                    frame = batch[spec["symbol"]]
                else:
                    clock.sleep(1)
                    frame = yf.download(spec["symbol"], period="1y", interval="1d",
                                        auto_adjust=False, actions=False, threads=False,
                                        progress=False, timeout=20, multi_level_index=False)
                result = make_stock(spec, frame, now)
                break
            except Exception as exc:
                reason = f"{type(exc).__name__}: 無法取得足夠有效日線"
        if result:
            fetched[spec["code"]] = result
            print(f"OK {spec['symbol']} {result['tradeDate']} {result['price']}", flush=True)
        else:
            failures.append({"code": spec["code"], "reason": reason})
            print(f"FAILED {spec['symbol']} ({reason})", flush=True)
    snapshot = build_snapshot(specs, fetched, previous, failures, now)
    write_snapshot(args.output, snapshot)
    print(f"Exported {len(fetched)}/{len(target)}; tradeDate={snapshot['tradeDate']}; status={snapshot['status']}", flush=True)
    return 0 if fetched else 1


if __name__ == "__main__":
    sys.exit(main())
