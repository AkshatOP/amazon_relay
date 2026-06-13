# CLAUDE.md — Amazon Relay

Project guidance for Claude Code working in this repo.

## What this is
Amazon Relay — Amazon HackOn 2026 submission. An intelligent reverse-logistics system that
gives returned/unused products a second life (resell / refurbish / donate / liquidate). This
repo is the **MVP of the first stage: the Condition Grading Agent**.

- Full problem statement + solution framing → [`docs/CONTEXT.md`](docs/CONTEXT.md)
- Phased build tracker / current status → [`docs/TODO.md`](docs/TODO.md)
- How pieces fit together → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Agent specs → [`.agents/`](.agents/)

## Core idea
A Google Gemini VLM grades the **condition delta** between **reference** photos (good product)
and **inspection** photos (returned product, captured by the delivery rider). Output is strict
JSON (grade A–D, score, defects, resale eligibility) — the same schema regardless of grading
path, so the downstream router is path-agnostic.

Two paths, auto-selected by category (`backend/category_map.py`):
- **visual** (hero) → `backend/grading_agent.py` (Gemini)
- **functional** (stub) → `backend/functional_grader.py` (yes/no rules)
- **hybrid** → visual now; answer-merge is a Phase 2 TODO

## Key files
| File | Role |
|------|------|
| `skills/grading_skill.md` | The runtime system prompt / rubric the VLM loads. Edit grading behavior here. |
| `backend/grading_agent.py` | Visual path: labelled image groups → Gemini → defensive JSON parse + retry. |
| `backend/schemas.py` | `GradeResult` strict schema (grade/score-band/boolean consistency). |
| `backend/config.py` | Model name (`GEMINI_MODEL`, default `gemini-2.5-flash`) + key loading. Swap model here. |
| `backend/main.py` | FastAPI: `GET /`, `GET /health`, `POST /grade`, `POST /grade/functional`. |
| `frontend/index.html` | Skeletal vanilla-JS demo UI. |

## Run / test
```bash
pip install -r requirements.txt   # or use the existing .venv/
export GEMINI_API_KEY="..."
uvicorn backend.main:app --reload  # from repo root → http://localhost:8000
```
A `.venv/` with deps already installed exists from the initial build.

## Conventions / guardrails
- **The grading agent must never throw.** Model/parse/API failures return a structured
  `{"grade": "ERROR", ...}` dict — the endpoints must never 500 on a formatting hiccup.
- Gemini wraps JSON in ```json fences often → the parser strips fences defensively. Keep that.
- Uniform output schema across all paths is load-bearing for downstream routing — don't diverge.
- Verify the `google-genai` SDK call shape against current docs before changing Gemini calls;
  don't rely on memory.
- This is a hackathon MVP: prefer a working vertical slice over polish. Don't over-engineer.

## Status
Phase 1 (visual agent) is functionally complete and smoke-tested without a key (boot, health,
functional path, error handling all verified). The only remaining Phase 1 item is a live Gemini
run, which needs a real key + photos. See `docs/TODO.md`.
