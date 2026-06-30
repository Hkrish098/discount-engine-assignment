"""Pydantic guardrails for Gemini VLM PDF cart extraction."""

from pydantic import BaseModel, Field


class ExtractedCartItem(BaseModel):
    product: str = Field(description="Product name from the table row.")
    brand: str = Field(description="Brand name. Use 'Unknown' only if truly missing.")
    platform: str = Field(description="Sales platform, e.g. Amazon India, Flipkart.")
    base_price: float = Field(description="Numeric price in rupees only — no 'Rs.' prefix.")
    is_malformed: bool = Field(
        default=False,
        description="True if the row is unreadable or missing a valid base price.",
    )
    row_note: str | None = Field(
        default=None,
        description="If malformed, briefly explain what is wrong with this row.",
    )


class PDFExtractionResponse(BaseModel):
    items: list[ExtractedCartItem] = Field(
        default_factory=list,
        description="All table rows found, including malformed ones flagged.",
    )
    is_valid_cart: bool = Field(
        description="True if at least one non-malformed item with a valid price was found.",
    )
    error_message: str | None = Field(
        default=None,
        description="If no valid items, explain why (e.g. no table found).",
    )
