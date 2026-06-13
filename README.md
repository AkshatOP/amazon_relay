# Amazon Relay — Condition Grading Agent (MVP)

Amazon HackOn 2026 submission. An intelligent reverse-logistics system that gives
returned/unused products a meaningful second life. This MVP implements the first and
most critical stage: the **Condition Grading Agent**.

> Read [`docs/CONTEXT.md`](docs/CONTEXT.md) for the full problem statement and solution,
> and [`docs/TODO.md`](docs/TODO.md) for the phased build tracker.

## What it does

Given **reference photos** of a good product and **inspection photos** of a returned
product (captured by the delivery rider on pickup), a Google Gemini VLM grades the
**condition delta** between them and emits strict JSON (grade A–D, score, defects,
resale eligibility) that a downstream router can consume.

Two grading paths, auto-selected from product category:
- **Visual path** (hero) — for products where condition = what you can see (shoes, clothing, bags…).
- **Functional path** (stub) — for products where a photo is useless (chargers, speakers…); graded by yes/no rules.

## Run it

```bash
# 1. Install deps (use a virtualenv if you like)
pip install -r requirements.txt

# 2. Set your Gemini API key (get one at https://aistudio.google.com/apikey)
export GEMINI_API_KEY="your-key-here"
#   ...or: cp .env.example .env  and fill it in

# 3. Start the server (from the amazon-relay/ root)
uvicorn backend.main:app --reload

# 4. Open the demo
#    http://localhost:8000
```

## Manual test checklist

1. Page loads at `http://localhost:8000`.
2. Pick a category (e.g. **Footwear / Shoes**).
3. Upload 1+ **reference** (good) photos and 1+ **inspection** (returned) photos.
   Drop your own test images into `sample_images/` (see its README).
4. Click **Grade it** → valid JSON appears below.
5. Sanity checks:
   - Clean item vs its reference → **Grade A/B**.
   - Clearly worn item → **Grade C**.
   - Broken / cracked item → **Grade D**.
6. A malformed model response never 500s — it returns a structured `"grade": "ERROR"` object.

## API

| Method | Path                | Body                                                            |
|--------|---------------------|-----------------------------------------------------------------|
| GET    | `/`                 | serves the demo UI                                              |
| GET    | `/health`           | `{"status": "ok", "model": "..."}`                             |
| POST   | `/grade`            | multipart: `category`, `reference_images[]`, `inspection_images[]` |
| POST   | `/grade/functional` | JSON: `{"category": "...", "answers": [true, false, ...]}`     |

## Layout

```
amazon-relay/
├── docs/        # CONTEXT, ARCHITECTURE, TODO
├── .agents/     # agent specs (grading, routing)
├── skills/      # grading_skill.md — the runtime system prompt / rubric
├── backend/     # FastAPI app + grading agents
├── frontend/    # index.html demo
└── sample_images/
```
