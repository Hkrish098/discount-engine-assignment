"""
LLM extraction model — guardrail between Gemini and the discount engine.

Gemini fills this via structured JSON output. We validate with Pydantic,
then map to DiscountRule (engine format) in rule_mapper.py.
"""

from pydantic import BaseModel, Field


class ParsedDiscountRule(BaseModel):
    is_ambiguous: bool = Field(
        description=(
            "True if the input lacks a concrete numeric value, target brand/platform, "
            "or cart threshold. Do not guess."
        )
    )
    ambiguity_reason: str | None = Field(
        default=None,
        description="If ambiguous, explain what is missing so the user can clarify.",
    )
    scope: str | None = Field(
        default=None,
        description='One of: "brand", "platform", or "cart" (lowercase).',
    )
    applies_to: str | None = Field(
        default=None,
        description='Brand or platform name, e.g. "Natura Casa", "Flipkart". Empty for cart rules.',
    )
    type: str | None = Field(
        default=None,
        description='One of: "percentage" or "flat" (lowercase).',
    )
    value: str | None = Field(
        default=None,
        description='Numeric discount, e.g. "20" for 20% or "150" for Rs.150 flat.',
    )
    stackable: bool | None = Field(
        default=None,
        description="True if the rule can stack on top of other offers.",
    )
    min_cart_value: str | None = Field(
        default=None,
        description='Minimum cart total in rupees when scope is cart, e.g. "5000".',
    )
