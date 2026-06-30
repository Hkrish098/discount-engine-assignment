"""
PDF → CartItem[] translator.

Gemini VLM when configured; text-table fallback for offline/tests.
"""

from __future__ import annotations

import re

from app.config import settings
from app.schemas import CartItem, ParsePdfFailure, ParsePdfSuccess, PdfRowError
from app.services.gemini_pdf_parser import call_gemini_pdf_extract
from app.services.price_parser import parse_price

_ROW_SPLIT = re.compile(r"\n+")
_CELL_SPLIT = re.compile(r"\s{2,}|\t")


def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        import pypdf  # type: ignore[import-untyped]

        from io import BytesIO

        reader = pypdf.PdfReader(BytesIO(pdf_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except ImportError:
        try:
            return pdf_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""


def _looks_like_header(line: str) -> bool:
    lower = line.lower()
    return "product" in lower and "brand" in lower and "platform" in lower


def _map_extraction_to_cart_items(
    extraction,
) -> tuple[list[CartItem], list[PdfRowError], list[str]]:
    items: list[CartItem] = []
    row_errors: list[PdfRowError] = []
    warnings: list[str] = []
    skipped = 0

    for idx, row in enumerate(extraction.items, start=1):
        if row.is_malformed:
            skipped += 1
            row_errors.append(
                PdfRowError(
                    row=idx,
                    message=row.row_note or f"Unreadable row: {row.product!r}",
                )
            )
            continue

        price = parse_price(row.base_price)
        if price is None:
            skipped += 1
            row_errors.append(
                PdfRowError(row=idx, message=f"Invalid base price for {row.product!r}")
            )
            continue

        item_id = f"ITEM-{len(items) + 1:02d}"
        try:
            items.append(
                CartItem(
                    itemId=item_id,
                    product=row.product.strip(),
                    brand=row.brand.strip() or "Unknown",
                    platform=row.platform.strip(),
                    basePrice=price,
                )
            )
        except ValueError as exc:
            skipped += 1
            row_errors.append(PdfRowError(row=idx, message=str(exc)))

    if skipped:
        warnings.append(
            f"Successfully loaded {len(items)} item(s). {skipped} unreadable row(s) were skipped."
        )

    return items, row_errors, warnings


def _parse_table_text(text: str) -> ParsePdfSuccess | ParsePdfFailure:
    lines = [ln.strip() for ln in _ROW_SPLIT.split(text) if ln.strip()]
    if not lines:
        return ParsePdfFailure(errors=["No readable content found in the uploaded file."])

    data_lines: list[str] = []
    for line in lines:
        if _looks_like_header(line):
            continue
        if set(line) <= {"─", "-", "=", " "}:
            continue
        lower = line.lower()
        if lower.startswith("order #") or lower.startswith("date:"):
            continue
        if "cart total" in lower or "grand total" in lower:
            continue
        data_lines.append(line)

    if not data_lines:
        return ParsePdfFailure(
            errors=[
                "Could not find cart rows. Expected columns: Product, Brand, Platform, Base Price."
            ]
        )

    items: list[CartItem] = []
    row_errors: list[PdfRowError] = []
    warnings: list[str] = []

    for idx, line in enumerate(data_lines, start=1):
        parts = [p.strip() for p in _CELL_SPLIT.split(line) if p.strip()]
        if len(parts) < 4:
            tokens = line.split()
            if len(tokens) < 4:
                row_errors.append(PdfRowError(row=idx, message=f"Malformed row: {line!r}"))
                continue
            base_price_raw = tokens[-1]
            platform = tokens[-2]
            brand = tokens[-3]
            product = " ".join(tokens[:-3])
            parts = [product, brand, platform, base_price_raw]

        product, brand, platform, base_price_raw = parts[0], parts[1], parts[2], parts[3]
        price = parse_price(base_price_raw)
        if price is None:
            row_errors.append(
                PdfRowError(row=idx, message=f"Invalid base price: {base_price_raw!r}")
            )
            continue

        item_id = f"ITEM-{len(items) + 1:02d}"
        try:
            items.append(
                CartItem(
                    itemId=item_id,
                    product=product,
                    brand=brand,
                    platform=platform,
                    basePrice=price,
                )
            )
        except ValueError as exc:
            row_errors.append(PdfRowError(row=idx, message=str(exc)))

    if not items:
        return ParsePdfFailure(
            errors=["No valid cart items could be extracted."]
            + [f"Row {e.row}: {e.message}" for e in row_errors]
        )

    if row_errors:
        warnings.append(
            f"Successfully loaded {len(items)} item(s). {len(row_errors)} unreadable row(s) were skipped."
        )

    return ParsePdfSuccess(items=items, warnings=warnings, rowErrors=row_errors)


async def _gemini_parse_pdf(pdf_bytes: bytes) -> ParsePdfSuccess | ParsePdfFailure:
    try:
        extraction = call_gemini_pdf_extract(pdf_bytes)
    except Exception as exc:
        return ParsePdfFailure(errors=[f"Could not extract cart from PDF: {exc}"])

    if not extraction.is_valid_cart:
        return ParsePdfFailure(
            errors=[
                extraction.error_message
                or "No valid cart items could be extracted from this PDF."
            ]
        )

    items, row_errors, warnings = _map_extraction_to_cart_items(extraction)

    if not items:
        return ParsePdfFailure(
            errors=["No valid cart items could be extracted."]
            + [f"Row {e.row}: {e.message}" for e in row_errors]
        )

    return ParsePdfSuccess(items=items, warnings=warnings, rowErrors=row_errors)


async def parse_pdf_cart(pdf_bytes: bytes) -> ParsePdfSuccess | ParsePdfFailure:
    if not pdf_bytes:
        return ParsePdfFailure(errors=["Uploaded file is empty."])

    if settings.google_api_key and settings.use_vlm_parser:
        return await _gemini_parse_pdf(pdf_bytes)

    try:
        text = _extract_text_from_pdf_bytes(pdf_bytes)
    except Exception:
        return ParsePdfFailure(errors=["Could not read the PDF. The file may be corrupted."])

    if not text.strip():
        return ParsePdfFailure(
            errors=[
                "No text could be extracted from this PDF. "
                "Configure GOOGLE_API_KEY for VLM extraction."
            ]
        )

    return _parse_table_text(text)
