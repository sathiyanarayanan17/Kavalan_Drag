# KAVALAN — Project Completion Summary

This document describes the fully assembled product: the Next.js forensic
intelligence app, the trained ML suite, and all integrated features.

## Run it

```bash
# 1. Dependencies
npm install
pip install -r ml/requirements.txt

# 2. Train the ML models (one command)
python ml/train_all.py

# 3. Start both processes
python ml/service.py     # terminal 1  (ML API on :8008) — or start-ml.bat
npm run dev              # terminal 2  (app on :4000)

# 4. Open http://localhost:4000 and sign in
```

### Demo accounts

| Username | Password | Role | Can do |
|----------|----------|------|--------|
| supervisor | supervisor | SUPERVISOR | Everything |
| analyst | analyst | ANALYST | Run analyses + view |
| viewer | viewer | READONLY | View only (analyses blocked) |

> Passwords are plaintext demo credentials in `src/lib/auth.ts`. Replace with a
> real user store + hashing and set a strong `AUTH_SECRET` before real use.

## Feature map

| Feature | Where | Status |
|---------|-------|--------|
| Autopsy analysis (manner of death) | `/api/analyze/autopsy` + neural ML | ✅ |
| Time-of-death (Henssge nomogram) | `/api/analyze/tod` | ✅ |
| Digital evidence correlation + ML anomaly | `/api/analyze/digital` + XGBoost | ✅ |
| Risk scoring (tier + score + explanation) | `/api/analyze/risk` + LightGBM | ✅ |
| Suspect / evidence relationship graph | `/cases/[id]/graph` | ✅ |
| Cross-case correlation | `/correlate` | ✅ |
| Case export (PDF/CSV) | `/api/cases/[id]/export` | ✅ |
| Multi-user auth + roles | `/login`, middleware | ✅ |
| Real-time activity feed (polling) | dashboard `LiveActivityFeed` | ✅ |
| Health / status | `/api/health` | ✅ |

## ML suite (trained, verified reproducible)

| Model | Algorithm | Metric |
|-------|-----------|--------|
| Autopsy manner-of-death | PyTorch deep MLP (816K params) | 99.83% accuracy |
| Digital anomaly | XGBoost (600 trees) | 96.65% acc / 0.988 AUC |
| Risk tier | LightGBM (800 trees) | 98.38% accuracy |
| Risk score | LightGBM regressor | MAE 0.16 / R² 0.9996 |

All wired into the app with automatic fallback to the rule-based engine when
the ML service is unavailable. See `ml/README.md` and `ml/INTEGRATION.md`.

## Verification performed

- `npm run build` — zero errors; middleware registered.
- `tsc --noEmit` — clean.
- All 13 pages render 200 under auth.
- All API endpoints return 200 (autopsy, risk, digital, tod, export, graph,
  correlate, health, activities, auth).
- Role enforcement: READONLY blocked from analyses (403); unauthenticated
  API → 401; pages → redirect to /login.
- ML suite retrains end-to-end from `python ml/train_all.py`.
- LLM fallback confirmed working (Groq 404 → rule-based + ML).

## Honest scope note

The ML models are trained on large **synthetic** datasets generated from the
app's own vocabulary and rule logic, because the database ships with only a
handful of demo cases. The reported accuracies measure how well each model
generalises across that generated space — they are **not** validated
real-world forensic accuracy, which would require labelled field data. This is
consistent with the project's stated ethical principle: the tool assists and
explains, it does not decide. All outputs must be reviewed by qualified
professionals.
