"""
train_all.py
============
Train the complete KAVALAN heavy ML suite in one command:
  1. Autopsy manner-of-death   (PyTorch deep MLP over TF-IDF)
  2. Digital anomaly detector  (XGBoost)
  3. Case risk tier            (LightGBM)

Then write a consolidated metrics summary to ml/models/summary.json.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(script: str) -> None:
    print("\n" + "#" * 70)
    print(f"# {script}")
    print("#" * 70)
    subprocess.run([sys.executable, os.path.join(HERE, script)], check=True, cwd=os.path.dirname(HERE))


def main() -> None:
    run("train_autopsy.py")
    run("train_digital.py")
    run("train_risk.py")
    run("train_risk_regressor.py")

    models_dir = os.path.join(os.path.dirname(HERE), "ml", "models")
    summary = {}
    for name, meta in [
        ("autopsy", "autopsy_meta.json"),
        ("digital", "digital_meta.json"),
        ("risk", "risk_meta.json"),
    ]:
        path = os.path.join(models_dir, meta)
        if os.path.exists(path):
            with open(path) as f:
                summary[name] = json.load(f)

    with open(os.path.join(models_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 70)
    print("COMPLETE SUITE — SUMMARY")
    print("=" * 70)
    for name, m in summary.items():
        acc = m.get("accuracy")
        print(f"  {name:8s}  accuracy={acc*100:.2f}%  macro_f1={m.get('macro_f1'):.4f}")
    print(f"\nSummary written -> {models_dir}/summary.json")


if __name__ == "__main__":
    main()
