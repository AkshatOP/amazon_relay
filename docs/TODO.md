# Amazon Relay — Build Tracker

## ✅ Phase 0 — Scaffold & Context   [STATUS: done]
- [x] Repo structure, requirements.txt, .env.example, README
- [x] CONTEXT.md (problem statement + solution)
- [x] ARCHITECTURE.md
- [x] .agents specs

## ✅ Phase 1 — Visual Grading Agent (CURRENT → done)
- [x] grading_skill.md written
- [x] grading_agent.py calling Gemini VLM with reference + inspection images
- [x] schemas.py strict JSON validation + defensive fence-stripping
- [x] POST /grade endpoint working
- [x] Skeletal index.html: dropdown + 2 image containers + JSON output
- [ ] End-to-end test: upload good + worn shoe photos → correct grade JSON
      *(requires a real GEMINI_API_KEY + test images — see Manual test checklist in README)*

## 🔵 Phase 2 — Functional & Hybrid Paths
- [x] functional_grader.py rule logic (stub)
- [x] yes/no question UI + /grade/functional
- [ ] hybrid path combining photos + answers (visual half wired; answers-merge TODO)

## ⚪ Phase 3 — Downstream Routing (XGBoost)
- [ ] routing-agent spec → consume score + defect count → RESELL/REFURBISH/DONATE/LIQUIDATE
      *(spec written in `.agents/routing-agent.agent.md`; model not built)*

## ⚪ Phase 4 — Trust Layer & Matching
- [ ] Product Health Card generation
- [ ] Nearby-buyer matching stub

## Progress: Phase 1 of 4 functionally complete (~30% of MVP scope).
Code path is end-to-end; the only Phase 1 box left is the live Gemini test, which needs a
real API key + photos. Phase 2 functional path is wired ahead of schedule (stub).
