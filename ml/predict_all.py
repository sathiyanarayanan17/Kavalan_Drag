"""
predict_all.py
==============
Unified inference for the KAVALAN heavy ML suite. Loads all three trained
models and exposes a simple CLI:

  # Autopsy manner-of-death from report text
  python ml/predict_all.py autopsy --text "Ligature mark on the neck, petechial hemorrhage..."

  # Digital event anomaly
  python ml/predict_all.py digital --json "{\"sourceType\":\"CCTV\",\"hour\":3,...}"

  # Case risk tier
  python ml/predict_all.py risk --json "{\"evidenceCount\":12,...}"
"""

from __future__ import annotations

import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd

MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


# --------------------------------------------------------------------------
def predict_autopsy(text: str) -> dict:
    import torch
    from train_autopsy import AutopsyMLP  # reuse architecture

    vec = joblib.load(os.path.join(MODELS, "autopsy_vectorizer.joblib"))
    le = joblib.load(os.path.join(MODELS, "autopsy_label_encoder.joblib"))
    with open(os.path.join(MODELS, "autopsy_meta.json")) as f:
        meta = json.load(f)

    model = AutopsyMLP(meta["in_dim"], meta["n_classes"])
    model.load_state_dict(torch.load(os.path.join(MODELS, "autopsy_model.pt"),
                                     map_location="cpu"))
    model.eval()

    x = vec.transform([text]).toarray().astype(np.float32)
    with torch.no_grad():
        logits = model(torch.tensor(x))
        proba = torch.softmax(logits, dim=1).numpy()[0]
    idx = int(proba.argmax())
    return {
        "mannerOfDeath": le.classes_[idx],
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {c: round(float(p), 4) for c, p in zip(le.classes_, proba)},
    }


def predict_digital(case: dict) -> dict:
    pipe = joblib.load(os.path.join(MODELS, "digital_model.joblib"))
    feats = ["sourceType", "hour", "temporalDeviation", "novelLocation",
             "burstCount", "frequencyDeviation", "subjectDiversity", "confidence"]
    X = pd.DataFrame([{f: case.get(f) for f in feats}])
    proba = pipe.predict_proba(X)[0]
    pred = int(pipe.predict(X)[0])
    return {
        "highAnomaly": bool(pred),
        "anomalyProbability": round(float(proba[1]), 4),
    }


def predict_risk(case: dict) -> dict:
    pipe = joblib.load(os.path.join(MODELS, "risk_model_heavy.joblib"))
    feats = ["evidenceCount", "suspectCount", "digitalAnomalyCount",
             "hasAutopsy", "hasTodEstimate", "mannerOfDeath",
             "openTimelineGaps", "caseAgeHours"]
    X = pd.DataFrame([{f: case.get(f) for f in feats}])
    proba = pipe.predict_proba(X)[0]
    classes = pipe.classes_
    idx = int(proba.argmax())
    return {
        "riskTier": str(classes[idx]),
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {str(c): round(float(p), 4) for c, p in zip(classes, proba)},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="KAVALAN unified ML inference")
    sub = parser.add_subparsers(dest="task", required=True)

    a = sub.add_parser("autopsy")
    a.add_argument("--text", required=True)

    d = sub.add_parser("digital")
    d.add_argument("--json", required=True)

    r = sub.add_parser("risk")
    r.add_argument("--json", required=True)

    args = parser.parse_args()

    if args.task == "autopsy":
        result = predict_autopsy(args.text)
    elif args.task == "digital":
        result = predict_digital(json.loads(args.json))
    else:
        result = predict_risk(json.loads(args.json))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
