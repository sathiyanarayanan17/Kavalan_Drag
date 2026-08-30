"""
generate_dataset.py
====================
Generate a large, realistic synthetic dataset for KAVALAN case risk prediction.

WHY SYNTHETIC DATA?
-------------------
The application database ships with only 5 demo cases. Training any ML model on
5 rows is meaningless — it would memorise them and report a fake accuracy.

Instead we generate thousands of realistic cases by sampling the SAME input
distributions a real caseload would have, then label each case using the EXACT
risk formula implemented in `src/lib/ai-engine.ts::calculateRiskScore`. Because
we control the data-generating process, any accuracy the model reports is a
genuine measure of how well it learned the underlying decision boundaries.

The ML model is therefore a learned, fast approximation of the auditable
rule-based scorer — useful for demonstrating an ML pipeline while staying
honest about what "accuracy" means here.
"""

from __future__ import annotations

import argparse
import math
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Faithful re-implementation of src/lib/ai-engine.ts::calculateRiskScore
# ---------------------------------------------------------------------------

def risk_overall_and_tier(
    evidence_count: int,
    suspect_count: int,
    digital_anomaly_count: int,
    has_autopsy: bool,
    has_tod_estimate: bool,
    case_age_hours: float,
) -> tuple[int, str]:
    """Mirror of the TypeScript formula. Returns (overall_score, tier)."""
    evidence_score = min(20, round(math.log1p(evidence_count) * 6))
    suspect_score = min(20, round(suspect_count * 4))
    digital_score = min(20, round(digital_anomaly_count * 5))
    forensic_inverse = 20 - ((10 if has_autopsy else 0) + (10 if has_tod_estimate else 0))
    urgency_score = min(20, round(max(0.0, 20 - (case_age_hours / 720) * 20)))

    overall = int(
        evidence_score + suspect_score + digital_score + forensic_inverse + urgency_score
    )

    if overall >= 70:
        tier = "CRITICAL"
    elif overall >= 50:
        tier = "HIGH"
    elif overall >= 30:
        tier = "MEDIUM"
    else:
        tier = "LOW"
    return overall, tier


# ---------------------------------------------------------------------------
# Input sampling — realistic distributions for a mixed caseload
# ---------------------------------------------------------------------------

MANNERS = ["HOMICIDE", "SUICIDE", "NATURAL", "ACCIDENTAL", "UNDETERMINED"]


def sample_case(rng: np.random.Generator) -> dict:
    # Evidence: most cases have a handful, some have many (long tail)
    evidence_count = int(rng.poisson(lam=6))
    evidence_count = max(0, min(evidence_count, 40))

    # Suspects: often 0-3, occasionally more
    suspect_count = int(rng.poisson(lam=1.3))
    suspect_count = max(0, min(suspect_count, 10))

    # Digital anomalies: mostly low, sometimes clustered
    digital_anomaly_count = int(rng.poisson(lam=1.5))
    digital_anomaly_count = max(0, min(digital_anomaly_count, 12))

    # Forensic completeness — biased toward incomplete early in a case
    has_autopsy = bool(rng.random() < 0.55)
    has_tod_estimate = bool(rng.random() < 0.45)

    # Manner of death (feature only; not used by the label formula but a real
    # signal in practice — kept so the model has realistic extra context)
    manner = str(rng.choice(MANNERS, p=[0.30, 0.15, 0.25, 0.20, 0.10]))

    # Open timeline gaps
    open_timeline_gaps = int(rng.poisson(lam=1.0))
    open_timeline_gaps = max(0, min(open_timeline_gaps, 8))

    # Case age in hours — from fresh (minutes) up to ~60 days
    case_age_hours = float(rng.exponential(scale=240.0))
    case_age_hours = min(case_age_hours, 1440.0)

    return {
        "evidenceCount": evidence_count,
        "suspectCount": suspect_count,
        "digitalAnomalyCount": digital_anomaly_count,
        "hasAutopsy": int(has_autopsy),
        "hasTodEstimate": int(has_tod_estimate),
        "mannerOfDeath": manner,
        "openTimelineGaps": open_timeline_gaps,
        "caseAgeHours": round(case_age_hours, 2),
    }


def build_dataset(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        case = sample_case(rng)
        overall, tier = risk_overall_and_tier(
            case["evidenceCount"],
            case["suspectCount"],
            case["digitalAnomalyCount"],
            bool(case["hasAutopsy"]),
            bool(case["hasTodEstimate"]),
            case["caseAgeHours"],
        )
        case["riskScore"] = overall
        case["riskTier"] = tier
        rows.append(case)
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate KAVALAN synthetic risk dataset")
    parser.add_argument("--n", type=int, default=20000, help="number of cases")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--out", type=str, default="ml/data/cases.csv", help="output CSV path")
    args = parser.parse_args()

    import os
    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    df = build_dataset(args.n, args.seed)
    df.to_csv(args.out, index=False)

    print(f"Generated {len(df):,} cases -> {args.out}")
    print("\nRisk tier distribution:")
    print(df["riskTier"].value_counts().sort_index().to_string())
    print(f"\nRisk score range: {df['riskScore'].min()}..{df['riskScore'].max()}")


if __name__ == "__main__":
    main()
