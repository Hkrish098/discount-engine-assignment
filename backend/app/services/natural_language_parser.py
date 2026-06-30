"""
Natural-language → DiscountRule translator.

Flow:
  1. Gemini structured output → ParsedDiscountRule (Pydantic guardrail)
  2. rule_mapper → DiscountRule (engine format)
  3. Frontend confirmation → append rule → re-run calculateCart

Falls back to deterministic regex parser when no API key is configured.
"""

from __future__ import annotations

import re
import uuid

from app.config import settings
from app.schemas import DiscountRule, ParseRuleFailure, ParseRuleSuccess, RulePreviewFields
from app.services.gemini_parser import call_gemini_structured
from app.services.rule_mapper import build_preview, parsed_to_discount_rule

_AMBIGUOUS_PATTERNS = [
    re.compile(r"\bbig orders?\b", re.I),
    re.compile(r"\bgive a discount\b", re.I),
    re.compile(r"\bsome discount\b", re.I),
]


def _next_rule_id() -> str:
    return f"RULE-NL-{uuid.uuid4().hex[:6].upper()}"


def _success(rule: DiscountRule, preview: RulePreviewFields, warnings: list[str] | None = None) -> ParseRuleSuccess:
    return ParseRuleSuccess(rule=rule, preview=preview, warnings=warnings or [])


def _preview_from_rule(rule: DiscountRule) -> RulePreviewFields:
    return RulePreviewFields(
        scope=rule.scope.title(),
        appliesTo=rule.appliesTo or "—",
        type=rule.type.title(),
        value=f"{rule.value}% off" if rule.type == "percentage" else f"Rs.{int(rule.value)} off",
        stackable="Yes" if rule.stackable else "No",
        minCartValue=(
            f"Rs.{int(rule.minCartValue):,}" if rule.minCartValue is not None else None
        ),
    )


def _deterministic_parse(text: str) -> ParseRuleSuccess | ParseRuleFailure:
    normalized = " ".join(text.strip().split())

    for pattern in _AMBIGUOUS_PATTERNS:
        if pattern.search(normalized) and not re.search(r"\d", normalized):
            return ParseRuleFailure(
                errors=[
                    "Could not determine a specific discount value or cart threshold. "
                    "Please include a percentage, flat amount, or minimum cart value."
                ]
            )

    stackable = bool(re.search(r"stackable", normalized, re.I))

    from app.services.price_parser import parse_price

    cart_match = re.search(
        r"(\d+(?:\.\d+)?)\s*%\s*off.*cart.*(?:more than|over|above|>=?)\s*(?:Rs\.?|₹)?\s*([\d,]+)",
        normalized,
        re.I,
    )
    if cart_match:
        pct = float(cart_match.group(1))
        min_cart = parse_price(cart_match.group(2))
        if min_cart is None:
            return ParseRuleFailure(errors=["Could not parse the minimum cart value."])
        try:
            rule = DiscountRule(
                ruleId=_next_rule_id(),
                scope="cart",
                appliesTo="",
                type="percentage",
                value=pct,
                stackable=False,
                minCartValue=min_cart,
            )
            return _success(rule, _preview_from_rule(rule))
        except ValueError as exc:
            return ParseRuleFailure(errors=[str(exc)])

    brand_pct = re.search(
        r"(\d+(?:\.\d+)?)\s*%\s*off.*?(?:for|on)\s+(.+?)\s+brand",
        normalized,
        re.I,
    )
    if brand_pct:
        try:
            rule = DiscountRule(
                ruleId=_next_rule_id(),
                scope="brand",
                appliesTo=brand_pct.group(2).strip(),
                type="percentage",
                value=float(brand_pct.group(1)),
                stackable=stackable,
            )
            return _success(rule, _preview_from_rule(rule))
        except ValueError as exc:
            return ParseRuleFailure(errors=[str(exc)])

    platform_flat = re.search(
        r"(?:Rs\.?|₹)\s*([\d,]+)\s+flat.*?(?:on|for)\s+(?:all\s+)?(.+?)\s+items?",
        normalized,
        re.I,
    )
    if platform_flat:
        amount = parse_price(platform_flat.group(1))
        if amount is None:
            return ParseRuleFailure(errors=["Could not parse the flat discount amount."])
        try:
            rule = DiscountRule(
                ruleId=_next_rule_id(),
                scope="platform",
                appliesTo=platform_flat.group(2).strip(),
                type="flat",
                value=amount,
                stackable=False,
            )
            return _success(rule, _preview_from_rule(rule))
        except ValueError as exc:
            return ParseRuleFailure(errors=[str(exc)])

    return ParseRuleFailure(
        errors=[
            "Could not parse this rule. Include a clear percentage or flat amount, "
            "whether it applies to a brand, platform, or cart total, and any stackable flag."
        ]
    )


async def _gemini_parse(text: str) -> ParseRuleSuccess | ParseRuleFailure:
    try:
        parsed = call_gemini_structured(text)
    except Exception as exc:
        return ParseRuleFailure(
            errors=[f"Could not reach the language model: {exc}"]
        )

    if parsed.is_ambiguous:
        return ParseRuleFailure(
            errors=[
                parsed.ambiguity_reason
                or "Please specify a percentage, flat amount, target brand/platform, or cart threshold."
            ]
        )

    try:
        rule = parsed_to_discount_rule(parsed)
        preview = build_preview(parsed)
        return _success(rule, preview)
    except ValueError as exc:
        return ParseRuleFailure(errors=[str(exc)])


async def parse_natural_language_rule(text: str) -> ParseRuleSuccess | ParseRuleFailure:
    if settings.google_api_key and settings.use_llm_parser:
        return await _gemini_parse(text)
    return _deterministic_parse(text)
