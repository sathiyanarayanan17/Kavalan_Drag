# KAVALAN — Running the Complete Product (App + ML)

This project is now a complete end product: the Next.js forensic app plus a
trained heavy ML suite wired into the analysis pipeline.

## Architecture

```
Browser ──HTTP──> Next.js API routes ──HTTP──> Python ML service (FastAPI)
                        │                              │
                        │                       trained models:
                        │                       - autopsy (PyTorch)
                        │                       - digital  (XGBoost)
                        │                       - risk     (LightGBM)
                        └── rule-based engine (automatic fallback)
```

The API routes call the ML service for a prediction. If the service is
unreachable (or a model is missing), they transparently fall back to the
existing rule-based engine — **the app never breaks either way.**

## One-time setup

```bash
# 1. Node deps (already installed if node_modules exists)
npm install

# 2. Python deps for the ML service
pip install -r ml/requirements.txt

# 3. Train the models (writes to ml/models/)
python ml/train_all.py
```

## Running

Open two terminals:

```bash
# Terminal 1 — ML service (or double-click start-ml.bat on Windows)
python ml/service.py           # http://127.0.0.1:8008

# Terminal 2 — the app
npm run dev                    # http://localhost:4000
```

Then open http://localhost:4000. On first load the database seeds automatically.

## Where the ML is used

| Route | ML model | Behaviour |
|-------|----------|-----------|
| `POST /api/analyze/autopsy` | Autopsy neural classifier | Predicts manner of death; adopts it when more confident than the base engine and annotates the analysis notes. |
| `POST /api/analyze/risk` | Risk LightGBM model | Confirms the risk tier (numeric score + factors still come from the auditable formula). |
| Digital anomaly model | available via the service | `POST /predict/digital` — ready to wire into the digital route if desired. |

## Verified

- `npm run build` completes with **zero errors**.
- Autopsy route: "ligature mark, defensive wounds" → HOMICIDE (100%).
- Autopsy route: "contact temple GSW, hesitation cut, note" → SUICIDE (100%).
- Risk route: ML tier confirmation appears in recommendations.
- Fallback: with the ML service stopped, both routes still return valid
  results from the rule-based engine (no crash).

## Configuration

Set `ML_SERVICE_URL` in `.env.local` to point at a different host/port
(default `http://127.0.0.1:8008`).

## Honest scope note

The models are trained on large **synthetic** datasets generated from the
app's own vocabulary and rule logic (see `ml/README.md`), because the database
ships with only 5 demo cases. Reported accuracies (autopsy 99.8%, digital
96.7%, risk 98.4%) measure generalisation across that generated space — not
validated real-world forensic accuracy. This matches the project's ethical
stance: the tool assists and explains, it does not decide.
