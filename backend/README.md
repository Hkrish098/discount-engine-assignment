# Backend

FastAPI translator — natural language and PDF → `DiscountRule` / `CartItem` JSON.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GOOGLE_API_KEY
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/parse-rule` | Plain English → `DiscountRule` |
| `POST` | `/api/parse-pdf-cart` | PDF → `CartItem[]` |
| `GET` | `/health` | Liveness |

## Tests

```bash
pytest
```

Set `USE_LLM_PARSER=false` and `USE_VLM_PARSER=false` in `.env` to run tests without API calls.
