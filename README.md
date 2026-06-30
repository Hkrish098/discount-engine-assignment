# Opptra Discount Engine

Customer-facing cart pricing engine for the Opptra FDE Intern assignment.

**Live deployment:** _add your URL here before submission_

---

## Run locally (3 steps)

### Step 1 — Install & configure

```bash
cd frontend && npm install
cd ../backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and add your Gemini API key:

```
GOOGLE_API_KEY=your_key_here
USE_LLM_PARSER=true
USE_VLM_PARSER=true
GEMINI_MODEL=gemini-3.5-flash
```

> **Never commit `backend/.env`** — it is listed in `.gitignore`. Use `.env.example` as the template only.

### Step 2 — Start the backend (terminal 1)

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Step 3 — Start the frontend (terminal 2)

```bash
cd frontend && npm run dev
```

Open http://localhost:5173

---

## How to use (execution flow)

```
1. Upload rules.csv          → rules table loads
2. Upload cart.csv or PDF    → cart table loads (PDF shows spinner, replaces old cart)
3. (Optional) Parse NL rule    → preview → Apply Rule → appended to rules table
4. Click Calculate Discounts → Cart Summary with item offers + cart-level offer
```

**Sample files:** `frontend/sample-data/rules.csv` and `frontend/sample-data/cart.csv`

| Action | Behaviour |
|--------|-----------|
| CSV rules / cart | Parsed client-side, instant |
| Natural-language rule | Gemini → confirm → append to rules (click Calculate to refresh summary) |
| PDF cart | Gemini VLM extracts items, replaces cart entirely (click Calculate for summary) |
| Malformed PDF row | Warning banner, valid rows still load |

---

## Expected results (sample data + RULE-04)

| Item | Final Price | Offer |
|------|-------------|-------|
| ITEM-01 | Rs.1,104 | Platform 15% off |
| ITEM-02 | Rs.629 | Brand Rs.150 + Platform 10% stacked |
| ITEM-03 | Rs.509 | Platform 15% off |
| ITEM-04 | Rs.2,499 | No offers available |
| ITEM-05 | Rs.382 | Platform 15% off |
| ITEM-06 | Rs.809 | Platform 10% off |

Cart subtotal **Rs.5,932** → RULE-04 cart offer **−Rs.593** → **Final Rs.5,339**

---

## Architecture

```
frontend/                 React UI + pure discount engine
  src/engine/             discountEngine.js, csvParser.js
  src/api/                calls backend translators

backend/                  FastAPI + Gemini (NL rules, PDF carts)
  app/services/           gemini_parser, gemini_pdf_parser, rule_mapper
```

**Core rule:** inputs adapt to the engine — `discountEngine.js` never sees raw text or PDF bytes.

| Input | Translator | Engine receives |
|-------|------------|-----------------|
| CSV | `csvParser.js` | `DiscountRule[]`, `CartItem[]` |
| Plain English | `POST /api/parse-rule` | `DiscountRule` |
| PDF cart | `POST /api/parse-pdf-cart` | `CartItem[]` |

---

## Features

- [x] CSV upload + item-level discounts (best rule + stacking)
- [x] Cart-level discounts (RULE-04 threshold)
- [x] Natural-language rules (Gemini + Pydantic structured output + confirm step)
- [x] PDF cart upload (Gemini VLM + malformed-row warnings)
- [x] Tests (`cd frontend && npm test` · `cd backend && pytest`)

---

## Design decisions & tradeoffs

- **Direct Gemini API + Pydantic** — no LangChain; structured JSON schema prevents invalid rules reaching the engine.
- **Backend for NL/PDF only** — all discount math stays in `discountEngine.js` on the frontend.
- **PDF replaces cart; NL rules append** — different input semantics per assignment spec.
- **Manual Calculate** — user clicks after loading cart or adding rules so results are intentional.
- **Offline fallback** — set `USE_LLM_PARSER=false` / `USE_VLM_PARSER=false` for regex/text parsers (tests).

---

## Build & deploy

```bash
cd frontend && npm run build    # → frontend/dist/
```

Deploy `frontend/dist/` to Vercel/Netlify. Set `VITE_API_URL` to your deployed FastAPI URL.

```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Project layout

```
frontend/          Vite + React app
backend/           FastAPI translator API
  .env.example     template (safe to commit)
  .env             your API key (gitignored)
```
