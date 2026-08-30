"""
train_digital.py
================
Heavy gradient-boosted model (XGBoost) to flag HIGH-ANOMALY digital events.

Binary classification on engineered features that mirror the app's
digitalCorrelator logic (temporal deviation, novel location, burst frequency,
subject diversity). Reports accuracy, ROC-AUC, and a full classification report.
"""

from __future__ import annotations

import argparse
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from synth import build_digital_dataset

NUM = ["hour", "temporalDeviation", "novelLocation", "burstCount",
       "frequencyDeviation", "subjectDiversity", "confidence"]
CAT = ["sourceType"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Train digital anomaly model")
    parser.add_argument("--n", type=int, default=30000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-dir", type=str, default="ml/models")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    print("Generating synthetic digital-event dataset...")
    rows, labels = build_digital_dataset(args.n, args.seed)
    df = pd.DataFrame(rows)
    y = np.array(labels)
    print(f"  positives (high anomaly): {y.mean()*100:.1f}%")

    X_tr, X_te, y_tr, y_te = train_test_split(
        df, y, test_size=0.2, random_state=args.seed, stratify=y
    )

    pre = ColumnTransformer([
        ("num", "passthrough", NUM),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CAT),
    ])
    clf = XGBClassifier(
        n_estimators=600, max_depth=6, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
        eval_metric="logloss", n_jobs=-1, random_state=args.seed,
        tree_method="hist",
    )
    pipe = Pipeline([("prep", pre), ("clf", clf)])

    print("Training XGBoost...")
    pipe.fit(X_tr, y_tr)

    y_pred = pipe.predict(X_te)
    y_proba = pipe.predict_proba(X_te)[:, 1]
    acc = accuracy_score(y_te, y_pred)
    macro_f1 = f1_score(y_te, y_pred, average="macro")
    auc = roc_auc_score(y_te, y_proba)

    print("\n" + "=" * 60)
    print("DIGITAL ANOMALY MODEL — HELD-OUT TEST EVALUATION")
    print("=" * 60)
    print(f"Test samples : {len(y_te):,}")
    print(f"Accuracy     : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"ROC-AUC      : {auc:.4f}")
    print(f"Macro F1     : {macro_f1:.4f}")
    print(classification_report(y_te, y_pred, target_names=["normal", "high_anomaly"], digits=4))

    joblib.dump(pipe, os.path.join(args.out_dir, "digital_model.joblib"))
    with open(os.path.join(args.out_dir, "digital_meta.json"), "w") as f:
        json.dump({"accuracy": float(acc), "roc_auc": float(auc),
                   "macro_f1": float(macro_f1),
                   "features": NUM + CAT}, f, indent=2)
    print(f"\nSaved digital model -> {args.out_dir}/digital_model.joblib")


if __name__ == "__main__":
    main()
