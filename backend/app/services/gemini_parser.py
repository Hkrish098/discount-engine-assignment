"""Direct Gemini API call with Pydantic structured output — no LangChain."""

from __future__ import annotations

from google import genai
from google.genai import types

from app.config import settings
from app.models.parsed_rule import ParsedDiscountRule

SYSTEM_PROMPT = """You are a discount rule parser for an e-commerce checkout engine.

Extract discount details from the user's plain-English input.

Rules:
- scope must be one of: brand, platform, cart (lowercase).
- type must be one of: percentage, flat (lowercase).
- value must be a plain number (e.g. "20" for 20%, "150" for Rs.150 flat).
- applies_to is required for brand/platform rules (e.g. "Natura Casa", "Flipkart").
- min_cart_value is required for cart rules (plain number in rupees, e.g. "5000").
- stackable: true only if the user explicitly says the offer is stackable.

If the input is vague or missing a concrete numeric value, target, or threshold
(e.g. "Give a discount for big orders"), set is_ambiguous to true, provide
ambiguity_reason explaining what is missing, and leave other fields null.
Do NOT guess values."""


def call_gemini_structured(text: str) -> ParsedDiscountRule:
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured.")

    client = genai.Client(api_key=settings.google_api_key)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=f"Parse this discount rule:\n\n{text.strip()}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ParsedDiscountRule,
            temperature=0,
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return ParsedDiscountRule.model_validate_json(response.text)
