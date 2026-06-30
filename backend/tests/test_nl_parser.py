"""Tests for deterministic NL parser and rule mapper (no API key required)."""

import pytest

from app.models.parsed_rule import ParsedDiscountRule
from app.services.natural_language_parser import _deterministic_parse
from app.services.rule_mapper import build_preview, parsed_to_discount_rule


@pytest.mark.parametrize(
    "text,expected_scope,expected_applies",
    [
        ("20% off for Natura Casa brand, stackable with other offers", "brand", "Natura Casa"),
        ("Rs.100 flat discount on all Flipkart items", "platform", "Flipkart"),
        ("10% off if cart value is more than Rs.5,000", "cart", ""),
    ],
)
@pytest.mark.asyncio
async def test_deterministic_parser_accepts_examples(text, expected_scope, expected_applies):
    result = _deterministic_parse(text)
    assert result.ok is True
    assert result.rule.scope == expected_scope
    if expected_applies:
        assert result.rule.appliesTo == expected_applies


@pytest.mark.asyncio
async def test_deterministic_parser_rejects_ambiguous():
    result = _deterministic_parse("Give a discount for big orders")
    assert result.ok is False
    assert len(result.errors) > 0


def test_rule_mapper_from_parsed_brand():
    parsed = ParsedDiscountRule(
        is_ambiguous=False,
        scope="brand",
        applies_to="Natura Casa",
        type="percentage",
        value="20",
        stackable=True,
    )
    rule = parsed_to_discount_rule(parsed)
    assert rule.scope == "brand"
    assert rule.appliesTo == "Natura Casa"
    assert rule.value == 20
    assert rule.stackable is True
    preview = build_preview(parsed)
    assert preview.scope == "Brand"


def test_rule_mapper_rejects_ambiguous_flag():
    parsed = ParsedDiscountRule(
        is_ambiguous=True,
        ambiguity_reason="Please specify a percentage or amount.",
    )
    with pytest.raises(ValueError, match="Please specify"):
        parsed_to_discount_rule(parsed)
