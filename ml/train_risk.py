"""
train_risk.py
=============
Heavy gradient-boosted model (LightGBM) to predict case RISK TIER
(LOW / MEDIUM / HIGH / CRITICAL). Upgraded, scaled-up version of the earlier
HistGradientBoosting baseline.

Labels mirror the app's calculateRiskScore formula (see synth.py). Accuracy
measures how well the model recovers that auditable rule on unseen data.
"""

from __future__ import annotations

import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

NUM = ["evidenceCount", "suspectCount", "digitalAnomalyCount",
       "hasAutopsy", "hasTodEstimate", "openTimelineGaps", "caseAgeHours"]
CAT = ["mannerOfDeath"]
CLASS_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

from synth import build_risk_dataset


def main() -> None:
    parser = argparse.ArgumentParser(description="Train heavy risk-tier model")
    parser.add_argument("--n", type=int, default=40000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-dir", type=str, default="ml/models")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    print("Generating synthetic case dataset...")
    rows, labels = build_risk_dataset(args.n, args.seed)
    df = pd.DataFrame(rows)
    y = pd.Series(labels)

    X_tr, X_te, y_tr, y_te = train_test_split(
        df, y, test_size=0.2, random_state=args.seed, stratify=y
    )

    pre = ColumnTransformer([
        ("num", "passthrough", NUM),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CAT),
    ])
    clf = LGBMClassifier(
        n_estimators=800, num_leaves=63, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
        n_jobs=-1, random_state=args.seed, verbose=-1,
    )
    pipe = Pipeline([("prep", pre), ("clf", clf)])

    print("5-fold cross-validation...")
    cv = cross_val_score(pipe, X_tr, y_tr, cv=5, scoring="accuracy", n_jobs=-1)
    print(f"  CV accuracy: {cv.mean():.4f} +/- {cv.std():.4f}")

    print("Training LightGBM...")
    pipe.fit(X_tr, y_tr)

    y_pred = pipe.predict(X_te)
    acc = accuracy_score(y_te, y_pred)
    macro_f1 = f1_score(y_te, y_pred, average="macro")
    labels_present = [c for c in CLASS_ORDER if c in set(y_te) | set(y_pred)]

    print("\n" + "=" * 60)
    print("RISK-TIER MODEL — HELD-OUT TEST EVALUATION")
    print("=" * 60)
    print(f"Test samples : {len(y_te):,}")
    print(f"Accuracy     : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"Macro F1     : {macro_f1:.4f}")
    print(classification_report(y_te, y_pred, labels=labels_present, digits=4))

    joblib.dump(pipe, os.path.join(args.out_dir, "risk_model_heavy.joblib"))
    with open(os.path.join(args.out_dir, "risk_meta.json"), "w") as f:
        json.dump({"accuracy": float(acc), "macro_f1": float(macro_f1),
                   "cv_accuracy_mean": float(cv.mean()),
                   "cv_accuracy_std": float(cv.std()),
                   "features": NUM + CAT}, f, indent=2)
    print(f"\nSaved heavy risk model -> {args.out_dir}/risk_model_heavy.joblib")


if __name__ == "__main__":
    main()
