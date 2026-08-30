"""
train_model.py
==============
Train a "heavy" ensemble model to predict a KAVALAN case's risk TIER
(LOW / MEDIUM / HIGH / CRITICAL) from case features, and honestly report
its accuracy on a held-out test set.

WHAT "HEAVY" MEANS HERE
-----------------------
We use a Histogram Gradient Boosting classifier (a strong, modern
tree-ensemble) wrapped in a preprocessing pipeline, with a proper
train/validation/test split, stratification, cross-validation, and a full
classification report + confusion matrix. This is a real, defensible ML
pipeline — not a toy.

HONESTY NOTE
------------
The labels come from the app's deterministic risk formula (see
generate_dataset.py). The model therefore learns to approximate an auditable
rule. Reported accuracy reflects how well it recovers those rules on unseen
samples — it is NOT a claim about real-world forensic accuracy, which would
require validated, labelled field data the project does not have.
"""

from __future__ import annotations

import argparse
import json
import os
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

NUMERIC_FEATURES = [
    "evidenceCount",
    "suspectCount",
    "digitalAnomalyCount",
    "hasAutopsy",
    "hasTodEstimate",
    "openTimelineGaps",
    "caseAgeHours",
]
CATEGORICAL_FEATURES = ["mannerOfDeath"]
TARGET = "riskTier"
CLASS_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def load_data(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found. Run: python ml/generate_dataset.py first."
        )
    return pd.read_csv(path)


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    clf = HistGradientBoostingClassifier(
        max_iter=400,
        learning_rate=0.08,
        max_depth=None,
        max_leaf_nodes=63,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
    )
    return Pipeline([("prep", preprocessor), ("clf", clf)])


def main() -> None:
    parser = argparse.ArgumentParser(description="Train KAVALAN risk-tier model")
    parser.add_argument("--data", type=str, default="ml/data/cases.csv")
    parser.add_argument("--model-out", type=str, default="ml/models/risk_model.joblib")
    parser.add_argument("--metrics-out", type=str, default="ml/models/metrics.json")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.model_out), exist_ok=True)

    df = load_data(args.data)
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    pipe = build_pipeline()

    print("Running 5-fold cross-validation on the training set...")
    cv_scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="accuracy", n_jobs=-1)
    print(f"  CV accuracy: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    print("\nFitting final model on full training set...")
    t0 = time.time()
    pipe.fit(X_train, y_train)
    fit_secs = time.time() - t0
    print(f"  Trained in {fit_secs:.2f}s")

    # ------------------------------------------------------------------
    # Honest evaluation on the held-out test set
    # ------------------------------------------------------------------
    y_pred = pipe.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")

    labels = [c for c in CLASS_ORDER if c in set(y_test) | set(y_pred)]
    report = classification_report(y_test, y_pred, labels=labels, digits=4)
    cm = confusion_matrix(y_test, y_pred, labels=labels)

    print("\n" + "=" * 60)
    print("HELD-OUT TEST SET EVALUATION")
    print("=" * 60)
    print(f"Test samples      : {len(y_test):,}")
    print(f"Accuracy          : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"Macro F1          : {macro_f1:.4f}")
    print("\nPer-class report:")
    print(report)
    print("Confusion matrix (rows = true, cols = predicted):")
    print("labels:", labels)
    print(cm)

    # ------------------------------------------------------------------
    # Persist model + metrics
    # ------------------------------------------------------------------
    joblib.dump(pipe, args.model_out)
    metrics = {
        "test_samples": int(len(y_test)),
        "accuracy": float(acc),
        "macro_f1": float(macro_f1),
        "cv_accuracy_mean": float(cv_scores.mean()),
        "cv_accuracy_std": float(cv_scores.std()),
        "fit_seconds": float(fit_secs),
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "feature_order": NUMERIC_FEATURES + CATEGORICAL_FEATURES,
    }
    with open(args.metrics_out, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSaved model   -> {args.model_out}")
    print(f"Saved metrics -> {args.metrics_out}")


if __name__ == "__main__":
    main()
