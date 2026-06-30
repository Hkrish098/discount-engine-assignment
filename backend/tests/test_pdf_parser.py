"""Tests for PDF cart text fallback parser (no API key)."""

import pytest

from app.services.pdf_cart_parser import _parse_table_text

SAMPLE_PDF_TEXT = """
Order #OP-9921 | Date: 15 Jan 2025
Product  Brand  Platform  Base Price
──────────────────────────────────────────────────────────
Cushion Cover  Natura Casa  Amazon India  Rs.1,299
Bed Sheet Set  Natura Casa  Flipkart  Rs.849
Bad Row  Missing  Fields
Wall Shelf  LivSpace Pro  Amazon India  Rs.599
"""


def test_parses_valid_rows_and_skips_malformed():
  result = _parse_table_text(SAMPLE_PDF_TEXT)
  assert result.ok is True
  assert len(result.items) == 3
  assert result.items[0].product == "Cushion Cover"
  assert result.items[0].basePrice == 1299
  assert len(result.rowErrors) >= 1
  assert any("Successfully loaded" in w for w in result.warnings)


def test_ignores_order_header():
  result = _parse_table_text(SAMPLE_PDF_TEXT)
  assert result.ok is True
  assert all("Order" not in i.product for i in result.items)


def test_rejects_empty_content():
  result = _parse_table_text("   ")
  assert result.ok is False
