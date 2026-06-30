"""
Pydantic models that mirror the plain-object shapes expected by
frontend/src/engine/discountEngine.js and csvParser.js.

Translators (LLM, VLM, PDF parsers) must output these — never the other way around.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class DiscountRule(BaseModel):
    """Matches DiscountRule in discountEngine.js."""

    ruleId: str
    scope: Literal["brand", "platform", "cart"]
    appliesTo: str = ""
    type: Literal["percentage", "flat"]
    value: float
    stackable: bool
    minCartValue: float | None = None

    @field_validator("ruleId", "appliesTo", mode="before")
    @classmethod
    def strip_strings(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def validate_rule(self) -> "DiscountRule":
        if self.scope in ("brand", "platform") and not self.appliesTo:
            raise ValueError(f"A {self.scope} rule must have appliesTo")
        if self.scope == "cart" and self.minCartValue is None:
            raise ValueError("A cart rule must have minCartValue")
        if self.type == "percentage" and not (0 < self.value <= 100):
            raise ValueError("Percentage value must be between 0 and 100 (exclusive of 0)")
        if self.type == "flat" and self.value <= 0:
            raise ValueError("Flat value must be greater than 0")
        return self


class CartItem(BaseModel):
    """Matches CartItem in discountEngine.js."""

    itemId: str
    product: str
    brand: str
    platform: str
    basePrice: int

    @field_validator("itemId", "product", "brand", "platform", mode="before")
    @classmethod
    def strip_strings(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class RulePreviewFields(BaseModel):
    """Human-readable fields for the frontend confirmation step."""

    scope: str
    appliesTo: str
    type: str
    value: str
    stackable: str
    minCartValue: str | None = None


class ParseRuleRequest(BaseModel):
    text: str = Field(..., min_length=1)


class ParseRuleSuccess(BaseModel):
    ok: Literal[True] = True
    rule: DiscountRule
    preview: RulePreviewFields
    warnings: list[str] = []


class ParseRuleFailure(BaseModel):
    ok: Literal[False] = False
    errors: list[str]


class PdfRowError(BaseModel):
    row: int
    message: str


class ParsePdfSuccess(BaseModel):
    ok: Literal[True] = True
    items: list[CartItem]
    warnings: list[str] = []
    rowErrors: list[PdfRowError] = []


class ParsePdfFailure(BaseModel):
    ok: Literal[False] = False
    errors: list[str]
