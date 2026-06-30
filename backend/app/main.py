from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import parse_pdf, parse_rule

app = FastAPI(
    title="Opptra Discount Engine API",
    description=(
        "Translator layer for unstructured inputs (natural language, PDF). "
        "Outputs match the DiscountRule / CartItem shapes consumed by discountEngine.js."
    ),
    version="1.0.0",
)

_use_wildcard = settings.cors_origins.strip() == "*"
_origins = ["*"] if _use_wildcard else [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=not _use_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_rule.router)
app.include_router(parse_pdf.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
