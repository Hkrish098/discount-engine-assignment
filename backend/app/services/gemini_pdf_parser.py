"""Direct Gemini VLM call — PDF bytes → structured cart extraction."""

from __future__ import annotations

from google import genai
from google.genai import types

from app.config import settings
from app.models.pdf_extraction import PDFExtractionResponse

PDF_SYSTEM_PROMPT = """You are a data extraction assistant for an e-commerce checkout system.

Look at this shopping cart document (PDF). Extract ONLY the tabular cart data with columns:
Product, Brand, Platform, Base Price.

Rules:
- IGNORE header junk such as "Order #OP-9921", dates, titles, and separator lines.
- IGNORE summary/total rows (e.g. "Cart Total", "Grand Total").
- Strip "Rs.", "₹", and commas from prices — return base_price as a plain number.
- For each table row, output one ExtractedCartItem.
- Set is_malformed=true if a row is unreadable or missing a valid base price.
- Do not invent products that are not in the document.

Set is_valid_cart=true only when at least one non-malformed item exists.
If nothing can be extracted, set is_valid_cart=false and explain in error_message."""


def call_gemini_pdf_extract(pdf_bytes: bytes) -> PDFExtractionResponse:
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured.")

    client = genai.Client(api_key=settings.google_api_key)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            "Extract all cart line items from this document.",
        ],
        config=types.GenerateContentConfig(
            system_instruction=PDF_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=PDFExtractionResponse,
            temperature=0,
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response for this PDF.")

    return PDFExtractionResponse.model_validate_json(response.text)
