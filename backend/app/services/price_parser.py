"""Shared price parsing — mirrors formats the assignment expects."""

import re

_PRICE_RE = re.compile(r"[\d,]+(?:\.\d+)?")


def parse_price(raw: str | int | float) -> int | None:
    if isinstance(raw, (int, float)):
        value = float(raw)
        return round(value) if value > 0 else None

    text = str(raw).strip()
    if not text:
        return None

    match = _PRICE_RE.search(text.replace("₹", "").replace("Rs.", "Rs").replace("Rs ", ""))
    if not match:
        return None

    try:
        value = float(match.group().replace(",", ""))
    except ValueError:
        return None

    return round(value) if value > 0 else None
