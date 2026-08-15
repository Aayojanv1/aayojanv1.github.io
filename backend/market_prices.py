"""Market-price CSV loader — refreshed on backend restart or explicit reload."""

import csv
import os
import time
from pathlib import Path

_CSV_PATH = Path(__file__).parent / "market_prices.csv"
_cache: dict = {"loaded_at": 0.0, "items": [], "mtime": 0.0}


def _load() -> list[dict]:
    items = []
    with _CSV_PATH.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                row["price"] = float(row["price"])
            except (KeyError, ValueError):
                continue
            items.append(row)
    return items


def get_prices() -> list[dict]:
    """Return list of {name, category, price, unit, notes}. Auto-reloads if CSV edited."""
    try:
        mtime = _CSV_PATH.stat().st_mtime
    except FileNotFoundError:
        return []
    if not _cache["items"] or mtime != _cache["mtime"]:
        _cache["items"] = _load()
        _cache["mtime"] = mtime
        _cache["loaded_at"] = time.time()
    return _cache["items"]


def format_for_prompt() -> str:
    """Compact block for injection into Gemini prompts."""
    items = get_prices()
    if not items:
        return "(no market price data available)"
    by_cat: dict[str, list[str]] = {}
    for it in items:
        line = f"{it['name']}: ₹{it['price']:.0f}/{it['unit']}"
        if it.get("notes"):
            line += f" ({it['notes']})"
        by_cat.setdefault(it.get("category", "misc"), []).append(line)
    blocks = []
    for cat in sorted(by_cat.keys()):
        blocks.append(f"[{cat.upper()}]\n" + "\n".join(by_cat[cat]))
    return "\n\n".join(blocks)


def snapshot_meta() -> dict:
    """For the public /api/market-prices endpoint."""
    get_prices()  # ensure cache warm
    return {
        "items": _cache["items"],
        "loaded_at": _cache["loaded_at"],
        "source_mtime": _cache["mtime"],
        "count": len(_cache["items"]),
    }
