# KAVALAN — Heavy ML Model Suite

A complete set of trained machine-learning models covering the app's
ML-appropriate capabilities. Three models, three different heavy algorithms.

| # | Model | Predicts | Algorithm | Test accuracy |
|---|-------|----------|-----------|---------------|
| 1 | **Autopsy** | Manner of death (5-class, from report text) | Deep PyTorch MLP (816K params) over TF-IDF | **99.83%** |
| 2 | **Digital** | High-anomaly digital event (binary) | XGBoost (600 trees) | **96.65%** (ROC-AUC 0.988) |
| 3 | **Risk** | Case risk tier (LOW/MEDIUM/HIGH/CRITICAL) | LightGBM (800 trees) | **98.38%** |

Exact metrics are written to `ml/models/summary.json` after `train_all.py`.

> Time-of-death is intentionally **not** an ML model — it uses the Henssge
> nomogram (published forensic math), which is the correct, auditable approach.

## Honesty note (important)

The app ships with only **5 demo cases** — far too few to train any model. So
each model is trained on a large **synthetic** dataset generated from the app's
own vocabulary and rule logic (`ml/synth.py`, grounded in
`src/lib/ai-engine.ts`). Because we control the data-generating process, the
reported accuracy genuinely measures how well each model generalises across
that space — it is **not** a claim of validated real-world forensic accuracy,
which would require labelled field data the project does not have. This keeps
the models consistent with the project's own ethical stance: assist and
explain, never decide.

## Quick start

```bash
pip install -r ml/requirements.txt

# Train the entire suite in one command
python ml/train_all.py

# --- or train individually ---
python ml/train_autopsy.py     # heavy PyTorch NLP model
python ml/train_digital.py     # XGBoost anomaly model
python ml/train_risk.py        # LightGBM risk model
```

## Inference

```bash
# Manner of death from free-text autopsy report
python ml/predict_all.py autopsy --text "Ligature mark on the neck, petechial hemorrhage, defensive wounds."

# Digital event anomaly
python ml/predict_all.py digital --json "{\"sourceType\":\"CCTV\",\"hour\":3,\"temporalDeviation\":0.75,\"novelLocation\":1,\"burstCount\":4,\"frequencyDeviation\":0.75,\"subjectDiversity\":0.8,\"confidence\":0.9}"

# Case risk tier
python ml/predict_all.py risk --json "{\"evidenceCount\":15,\"suspectCount\":4,\"digitalAnomalyCount\":5,\"hasAutopsy\":0,\"hasTodEstimate\":0,\"mannerOfDeath\":\"HOMICIDE\",\"openTimelineGaps\":3,\"caseAgeHours\":6}"
```

## Files

```
ml/
├── synth.py            # Shared synthetic-data generators (all 3 datasets)
├── train_autopsy.py    # Deep PyTorch MLP — manner of death
├── train_digital.py    # XGBoost — digital anomaly
├── train_risk.py       # LightGBM — risk tier (heavy upgrade)
├── train_all.py        # Train everything + write summary.json
├── predict_all.py      # Unified inference CLI for all 3 models
├── predict.py          # (legacy) simple risk-only predictor
├── generate_dataset.py # (legacy) risk CSV generator
├── requirements.txt
└── models/
    ├── autopsy_model.pt / autopsy_vectorizer.joblib / autopsy_label_encoder.joblib
    ├── digital_model.joblib
    ├── risk_model_heavy.joblib
    ├── *_meta.json
    └── summary.json
```

## Scaling further

- More data: pass `--n 100000` to any trainer.
- The autopsy model runs on GPU automatically if CUDA is available.
- To integrate with the Next.js app, expose `predict_all.py` behind a small
  Python service (FastAPI) and call it from an API route, or export the
  boosted models to ONNX for in-process inference.
