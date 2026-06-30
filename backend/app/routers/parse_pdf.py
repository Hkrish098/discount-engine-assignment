from fastapi import APIRouter, File, UploadFile

from app.schemas import ParsePdfFailure, ParsePdfSuccess
from app.services.pdf_cart_parser import parse_pdf_cart

router = APIRouter(prefix="/api", tags=["cart"])


@router.post(
    "/parse-pdf-cart",
    response_model=ParsePdfSuccess | ParsePdfFailure,
    summary="Extract cart items from a PDF and return CartItem objects",
)
async def parse_pdf_cart_endpoint(
    file: UploadFile = File(..., description="Cart PDF with Product / Brand / Platform / Base Price columns"),
) -> ParsePdfSuccess | ParsePdfFailure:
    if file.content_type and file.content_type not in (
        "application/pdf",
        "text/plain",
        "application/octet-stream",
    ):
        return ParsePdfFailure(
            errors=[f"Unsupported file type: {file.content_type}. Please upload a PDF."]
        )

    try:
        pdf_bytes = await file.read()
    except Exception:
        return ParsePdfFailure(errors=["Could not read the uploaded file."])

    return await parse_pdf_cart(pdf_bytes)
