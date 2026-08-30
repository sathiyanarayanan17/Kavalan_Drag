"""
service.py
==========
FastAPI microservice exposing the KAVALAN heavy ML suite over HTTP so the
Next.js app can call the trained models.

Run:
    pip install -r ml/requirements.txt fastapi uvicorn
    python ml/service.py            # serves on http://127.0.0.1:8008

Endpoints:
    GET  /health
    POST /predict/autopsy   {"text": "..."}
    POST /predict/digital   {"sourceType": "...", "hour": 3, ...}
    POST /predict/risk      {"evidenceCount": 12, ...}

Models are loaded once at startup. If a model file is missing the endpoint
returns 503 so the caller can fall back to the rule-based engine.
"""

from __future__ import annotations

import json
import os
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

app = FastAPI(title="KAVALAN ML Service", version="1.0.0")

_state: dict = {}


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------
def _load():
    # Autopsy (PyTorch)
    try:
        import torch
        from train_autopsy import AutopsyMLP

        vec = joblib.load(os.path.join(MODELS, "autopsy_vectorizer.joblib"))
        le = joblib.load(os.path.join(MODELS, "autopsy_label_encoder.joblib"))
        with open(os.path.join(MODELS, "autopsy_meta.json")) as f:
            meta = json.load(f)
        model = AutopsyMLP(meta["in_dim"], meta["n_classes"])
        model.load_state_dict(
            torch.load(os.path.join(MODELS, "autopsy_model.pt"), map_location="cpu")
        )
        model.eval()
        _state["autopsy"] = (model, vec, le, torch)
    except Exception as e:  # noqa: BLE001
        print(f"[autopsy] not loaded: {e}")

    # Digital (XGBoost pipeline)
    try:
        _state["digital"] = joblib.load(os.path.join(MODELS, "digital_model.joblib"))
    except Exception as e:  # noqa: BLE001
        print(f"[digital] not loaded: {e}")

    # Risk (LightGBM pipeline)
    try:
        _state["risk"] = joblib.load(os.path.join(MODELS, "risk_model_heavy.joblib"))
    except Exception as e:  # noqa: BLE001
        print(f"[risk] not loaded: {e}")

    # Risk score regressor (LightGBM)
    try:
        _state["risk_score"] = joblib.load(
            os.path.join(MODELS, "risk_score_regressor.joblib")
        )
    except Exception as e:  # noqa: BLE001
        print(f"[risk_score] not loaded: {e}")


@app.on_event("startup")
def startup():
    _load()
    print("Loaded models:", [k for k in ("autopsy", "digital", "risk") if k in _state])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class AutopsyReq(BaseModel):
    text: str


class DigitalReq(BaseModel):
    sourceType: str = "CCTV"
    hour: int = 12
    temporalDeviation: float = 0.0
    novelLocation: int = 0
    burstCount: int = 0
    frequencyDeviation: float = 0.0
    subjectDiversity: float = 0.0
    confidence: float = 0.8


class RiskReq(BaseModel):
    evidenceCount: int = 0
    suspectCount: int = 0
    digitalAnomalyCount: int = 0
    hasAutopsy: int = 0
    hasTodEstimate: int = 0
    mannerOfDeath: str = "UNDETERMINED"
    openTimelineGaps: int = 0
    caseAgeHours: float = 0.0


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            k: (k in _state)
            for k in ("autopsy", "digital", "risk", "risk_score")
        },
    }


@app.post("/predict/autopsy")
def predict_autopsy(req: AutopsyReq):
    if "autopsy" not in _state:
        raise HTTPException(status_code=503, detail="autopsy model not loaded")
    model, vec, le, torch = _state["autopsy"]
    x = vec.transform([req.text]).toarray().astype(np.float32)
    with torch.no_grad():
        proba = torch.softmax(model(torch.tensor(x)), dim=1).numpy()[0]
    idx = int(proba.argmax())
    return {
        "mannerOfDeath": str(le.classes_[idx]),
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {str(c): round(float(p), 4) for c, p in zip(le.classes_, proba)},
    }


@app.post("/predict/digital")
def predict_digital(req: DigitalReq):
    if "digital" not in _state:
        raise HTTPException(status_code=503, detail="digital model not loaded")
    pipe = _state["digital"]
    X = pd.DataFrame([req.model_dump()])
    proba = pipe.predict_proba(X)[0]
    return {
        "highAnomaly": bool(int(pipe.predict(X)[0])),
        "anomalyProbability": round(float(proba[1]), 4),
    }


@app.post("/predict/risk")
def predict_risk(req: RiskReq):
    if "risk" not in _state:
        raise HTTPException(status_code=503, detail="risk model not loaded")
    pipe = _state["risk"]
    X = pd.DataFrame([req.model_dump()])
    proba = pipe.predict_proba(X)[0]
    classes = pipe.classes_
    idx = int(proba.argmax())

    out = {
        "riskTier": str(classes[idx]),
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {str(c): round(float(p), 4) for c, p in zip(classes, proba)},
    }

    # Regressed numeric score (0-100), if the regressor is loaded.
    if "risk_score" in _state:
        score = float(_state["risk_score"].predict(X)[0])
        out["predictedScore"] = round(max(0.0, min(100.0, score)), 2)

    # Explainability: per-feature contributions from the tree ensemble.
    out["explanation"] = _explain_risk(X)
    return out


def _explain_risk(X: pd.DataFrame) -> list[dict]:
    """Return top feature contributions for the predicted score using
    LightGBM's exact tree SHAP (pred_contrib). Falls back to empty on error."""
    try:
        if "risk_score" not in _state:
            return []
        pipe = _state["risk_score"]
        pre = pipe.named_steps["prep"]
        reg = pipe.named_steps["reg"]
        Xt = pre.transform(X)
        # pred_contrib returns one column per feature + a bias term.
        contribs = reg.predict(Xt, pred_contrib=True)[0]
        try:
            names = list(pre.get_feature_names_out())
        except Exception:  # noqa: BLE001
            names = [f"f{i}" for i in range(len(contribs) - 1)]
        pairs = [
            {"feature": _clean(n), "contribution": round(float(c), 3)}
            for n, c in zip(names, contribs[:-1])
        ]
        pairs.sort(key=lambda p: abs(p["contribution"]), reverse=True)
        return pairs[:6]
    except Exception:  # noqa: BLE001
        return []


def _clean(name: str) -> str:
    return name.replace("num__", "").replace("cat__", "").replace("mannerOfDeath_", "manner=")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8008)
