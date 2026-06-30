"""Map LLM-parsed fields → DiscountRule for discountEngine.js."""

from __future__ import annotations

import re
import uuid

from app.models.parsed_rule import ParsedDiscountRule
from app.schemas import DiscountRule, RulePreviewFields
from app.services.price_parser import parse_price

_SCOPE_MAP = {
    "brand": "brand",
    "platform": "platform",
    "cart": "cart",
}

_TYPE_MAP = {
    "percentage": "percentage",
    "percent": "percentage",
    "%": "percentage",
    "flat": "flat",
    "fixed": "flat",
}


def _next_rule_id() -> str:
    return f"RULE-NL-{uuid.uuid4().hex[:6].upper()}"


def _normalize_scope(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower()
    return _SCOPE_MAP.get(key)


def _normalize_type(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower()
    return _TYPE_MAP.get(key)


def _parse_numeric_value(raw: str | None) -> float | None:
    if raw is None or str(raw).strip() == "":
        return None
    text = str(raw).strip()
    match = re.search(r"[\d,]+(?:\.\d+)?", text.replace("%", ""))
    if not match:
        return None
    try:
        return float(match.group().replace(",", ""))
    except ValueError:
        return None


def build_preview(parsed: ParsedDiscountRule) -> RulePreviewFields:
    scope_label = (parsed.scope or "—").strip().title()
    type_label = (parsed.type or "—").strip().title()
    value_display = parsed.value or "—"
    if parsed.type and "percent" in parsed.type.lower():
        value_display = f"{parsed.value}% off" if parsed.value else "—"
    elif parsed.type and "flat" in parsed.type.lower() and parsed.value:
        value_display = f"Rs.{parsed.value} off"

    return RulePreviewFields(
        scope=scope_label,
        appliesTo=(parsed.applies_to or "—").strip() or "—",
        type=type_label,
        value=value_display,
        stackable="Yes" if parsed.stackable else "No" if parsed.stackable is False else "—",
        minCartValue=(
            f"Rs.{parse_price(parsed.min_cart_value):,}"
            if parsed.min_cart_value and parse_price(parsed.min_cart_value)
            else None
        ),
    )


def parsed_to_discount_rule(parsed: ParsedDiscountRule) -> DiscountRule:
    if parsed.is_ambiguous:
        raise ValueError(
            parsed.ambiguity_reason
            or "Could not resolve this rule. Please be more specific."
        )

    scope = _normalize_scope(parsed.scope)
    rule_type = _normalize_type(parsed.type)
    numeric_value = _parse_numeric_value(parsed.value)

    errors: list[str] = []
    if not scope:
        errors.append("Missing or invalid scope (expected brand, platform, or cart).")
    if not rule_type:
        errors.append("Missing or invalid discount type (expected percentage or flat).")
    if numeric_value is None or numeric_value <= 0:
        errors.append("Missing or invalid discount value.")
    if errors:
        raise ValueError(" ".join(errors))

    applies_to = (parsed.applies_to or "").strip()
    min_cart_value = parse_price(parsed.min_cart_value) if parsed.min_cart_value else None

    if scope in ("brand", "platform") and not applies_to:
        raise ValueError(f"A {scope} rule must specify which {scope} it applies to.")
    if scope == "cart" and min_cart_value is None:
        raise ValueError("A cart rule must include a minimum cart value threshold.")

    stackable = bool(parsed.stackable) if parsed.stackable is not None else False

    return DiscountRule(
        ruleId=_next_rule_id(),
        scope=scope,  # type: ignore[arg-type]
        appliesTo=applies_to if scope != "cart" else "",
        type=rule_type,  # type: ignore[arg-type]
        value=numeric_value,  # type: ignore[arg-type]
        stackable=stackable,
        minCartValue=min_cart_value if scope == "cart" else None,
    )
