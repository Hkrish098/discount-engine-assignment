from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import parse_pdf, parse_rule

app = FastAPI(
    title="Opptra Discount Engine API",
    description=(
        "Translator layer for unstructured inputs (natural language, PDF). "
        "Outputs match the DiscountRule / CartItem shapes consumed by discountEngine.js."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_rule.router)
app.include_router(parse_pdf.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
