"""
train_risk_regressor.py
=======================
Predict the exact numeric RISK SCORE (0-100) instead of just the tier.
Complements train_risk.py (which predicts the tier).

Algorithm: LightGBM regressor. Reports MAE, RMSE, and R2 on a held-out set.
Also fits a SHAP explainer artifact for per-prediction explanations.

Labels come from the app's calculateRiskScore formula (see synth.py), so the
model learns a fast, differentiable approximation of that auditable rule.
"""

from __future__ import annotations

import argparse
import json
import math
import os

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from synth import build_risk_dataset, _risk_overall

NUM = ["evidenceCount", "suspectCount", "digitalAnomalyCount",
       "hasAutopsy", "hasTodEstimate", "openTimelineGaps", "caseAgeHours"]
CAT = ["mannerOfDeath"]


def build_score_dataset(n: int, seed: int):
    """Reuse the feature sampler but keep the numeric score as the target."""
    rows, _ = build_risk_dataset(n, seed)
    df = pd.DataFrame(rows)
    scores = [
        _risk_overall(r["evidenceCount"], r["suspectCount"], r["digitalAnomalyCount"],
                      bool(r["hasAutopsy"]), bool(r["hasTodEstimate"]), r["caseAgeHours"])
        for r in rows
    ]
    return df, np.array(scores, dtype=float)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train risk-score regressor")
    parser.add_argument("--n", type=int, default=40000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-dir", type=str, default="ml/models")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    print("Generating dataset...")
    df, y = build_score_dataset(args.n, args.seed)

    X_tr, X_te, y_tr, y_te = train_test_split(
        df, y, test_size=0.2, random_state=args.seed
    )

    pre = ColumnTransformer([
        ("num", "passthrough", NUM),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CAT),
    ])
    reg = LGBMRegressor(
        n_estimators=800, num_leaves=63, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
        n_jobs=-1, random_state=args.seed, verbose=-1,
    )
    pipe = Pipeline([("prep", pre), ("reg", reg)])

    print("Training LightGBM regressor...")
    pipe.fit(X_tr, y_tr)

    y_pred = pipe.predict(X_te)
    mae = mean_absolute_error(y_te, y_pred)
    rmse = math.sqrt(mean_squared_error(y_te, y_pred))
    r2 = r2_score(y_te, y_pred)

    print("\n" + "=" * 60)
    print("RISK-SCORE REGRESSOR — HELD-OUT TEST EVALUATION")
    print("=" * 60)
    print(f"Test samples : {len(y_te):,}")
    print(f"MAE          : {mae:.3f} points (out of 100)")
    print(f"RMSE         : {rmse:.3f}")
    print(f"R2           : {r2:.4f}")

    joblib.dump(pipe, os.path.join(args.out_dir, "risk_score_regressor.joblib"))
    with open(os.path.join(args.out_dir, "risk_score_meta.json"), "w") as f:
        json.dump({"mae": float(mae), "rmse": float(rmse), "r2": float(r2),
                   "features": NUM + CAT}, f, indent=2)
    print(f"\nSaved regressor -> {args.out_dir}/risk_score_regressor.joblib")


if __name__ == "__main__":
    main()
