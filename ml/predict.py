"""
predict.py
==========
Load the trained KAVALAN risk model and predict a risk tier for a single case.

Usage examples:
    python ml/predict.py --evidenceCount 12 --suspectCount 3 \
        --digitalAnomalyCount 4 --hasAutopsy 1 --hasTodEstimate 0 \
        --mannerOfDeath HOMICIDE --openTimelineGaps 3 --caseAgeHours 10

    # or pass a JSON blob
    python ml/predict.py --json "{\"evidenceCount\":12,\"suspectCount\":3,...}"
"""

from __future__ import annotations

import argparse
import json

import joblib
import pandas as pd

FEATURES = [
    "evidenceCount",
    "suspectCount",
    "digitalAnomalyCount",
    "hasAutopsy",
    "hasTodEstimate",
    "openTimelineGaps",
    "caseAgeHours",
    "mannerOfDeath",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict KAVALAN case risk tier")
    parser.add_argument("--model", type=str, default="ml/models/risk_model.joblib")
    parser.add_argument("--json", type=str, help="JSON object of features")
    parser.add_argument("--evidenceCount", type=int, default=0)
    parser.add_argument("--suspectCount", type=int, default=0)
    parser.add_argument("--digitalAnomalyCount", type=int, default=0)
    parser.add_argument("--hasAutopsy", type=int, default=0)
    parser.add_argument("--hasTodEstimate", type=int, default=0)
    parser.add_argument("--mannerOfDeath", type=str, default="UNDETERMINED")
    parser.add_argument("--openTimelineGaps", type=int, default=0)
    parser.add_argument("--caseAgeHours", type=float, default=0.0)
    args = parser.parse_args()

    if args.json:
        case = json.loads(args.json)
    else:
        case = {f: getattr(args, f) for f in FEATURES}

    pipe = joblib.load(args.model)
    X = pd.DataFrame([{f: case.get(f) for f in FEATURES}])

    tier = pipe.predict(X)[0]
    result = {"predictedTier": str(tier)}

    if hasattr(pipe, "predict_proba"):
        proba = pipe.predict_proba(X)[0]
        classes = pipe.classes_
        result["probabilities"] = {
            str(c): round(float(p), 4) for c, p in zip(classes, proba)
        }
        result["confidence"] = round(float(max(proba)), 4)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
