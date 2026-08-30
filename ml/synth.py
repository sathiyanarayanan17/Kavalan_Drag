"""
synth.py
========
Shared synthetic-data generators for the KAVALAN heavy ML suite.

The application has only 5 demo cases, which is far too few to train real
models. These generators produce large, realistic datasets grounded in the
app's own vocabulary and rule logic (src/lib/ai-engine.ts) so the models learn
meaningful, evaluable decision boundaries.

Three datasets:
  1. Autopsy text  -> manner of death (5-class NLP)
  2. Digital event -> high-anomaly flag (binary)
  3. Case features -> risk tier (4-class, mirrors calculateRiskScore)
"""

from __future__ import annotations

import math
import numpy as np

# ---------------------------------------------------------------------------
# 1. AUTOPSY TEXT  ->  MANNER OF DEATH
# ---------------------------------------------------------------------------

MANNERS = ["HOMICIDE", "SUICIDE", "NATURAL", "ACCIDENTAL", "UNDETERMINED"]

_VICTIMS = [
    "Adult male, 34.", "Female, 41.", "Male, 27.", "Elderly female, 78.",
    "Unidentified male.", "Young adult, 22.", "Male, 55.", "Female, 63.",
]

# Phrase banks per manner. The model learns from realistic language, not a
# single keyword, so it must generalise across paraphrases.
_HOMICIDE = [
    "Multiple sharp force injuries to the torso with defensive wounds on both forearms.",
    "Ligature mark encircling the neck; petechial hemorrhaging in the conjunctivae.",
    "Single gunshot wound to the chest, entry anterior, no exit; stippling absent.",
    "Blunt force trauma to the posterior cranium consistent with repeated blows.",
    "Manual strangulation indicated by hyoid fracture and bruising to the throat.",
    "Stab wounds to the abdomen and flank; wound track suggests a downward angle.",
    "Defensive lacerations across the palms; victim appears to have fought back.",
    "Ballistic trauma, two entry wounds to the back, execution-style pattern.",
]
_SUICIDE = [
    "Single hesitation-marked incision to the left wrist; tool recovered at scene.",
    "Ligature suspension point overhead; furrow angled upward, self-inflicted.",
    "Contact gunshot wound to the right temple with soot and stippling present.",
    "Note recovered at scene; superficial hesitation cuts precede the fatal wound.",
    "Toxic ingestion of prescribed medication, empty containers beside the body.",
    "Deep incised wound to the wrist, tentative parallel cuts, lone occupant.",
    "Self-inflicted gunshot, intraoral entry, consistent with self-harm.",
]
_NATURAL = [
    "Severe coronary atherosclerosis; myocardial infarction the likely cause.",
    "Massive pulmonary embolism with deep vein thrombosis of the lower limb.",
    "Ruptured cerebral aneurysm with extensive subarachnoid hemorrhage.",
    "End-stage hepatic cirrhosis with esophageal variceal hemorrhage.",
    "Bronchopneumonia superimposed on chronic obstructive pulmonary disease.",
    "Aortic dissection with hemopericardium; no external injuries noted.",
    "Advanced metastatic carcinoma; death attributable to disease progression.",
]
_ACCIDENTAL = [
    "Blunt polytrauma consistent with a high-speed motor vehicle collision.",
    "Fall from height; comminuted fractures and internal hemorrhage.",
    "Accidental drowning; frothy fluid in the airways, no ligature or wounds.",
    "Thermal burns over 40 percent body surface from a dwelling fire.",
    "Positional asphyxia following an unwitnessed fall; no foul play indicated.",
    "Accidental overdose; polypharmacy with no note and disordered scene.",
    "Electrocution injury with entry and exit burns on the hands.",
]
_UNDETERMINED = [
    "Advanced decomposition precludes determination of cause or manner.",
    "Skeletal remains recovered; insufficient soft tissue for assessment.",
    "Ambiguous findings; neither trauma nor natural disease clearly dominant.",
    "Scene disturbed; findings equivocal, manner cannot be established.",
    "Partial remains only; postmortem interval and cause indeterminate.",
    "Nonspecific findings with unwitnessed collapse; manner undetermined.",
]

_MANNER_BANK = {
    "HOMICIDE": _HOMICIDE,
    "SUICIDE": _SUICIDE,
    "NATURAL": _NATURAL,
    "ACCIDENTAL": _ACCIDENTAL,
    "UNDETERMINED": _UNDETERMINED,
}

_TOX = [
    "Toxicology: ethanol 0.08%, benzodiazepines detected.",
    "Toxicology negative for common substances.",
    "Elevated opioid concentration on toxicology screen.",
    "Toxicology pending at time of report.",
    "",
]
_CONNECT = [
    "External examination reveals", "On postmortem inspection,",
    "The autopsy documents", "Findings include", "Gross examination shows",
]


def make_autopsy_report(rng: np.random.Generator, manner: str) -> str:
    victim = rng.choice(_VICTIMS)
    # 1-3 manner-specific sentences to add variability and mixed signals
    n_core = int(rng.integers(1, 4))
    core = list(rng.choice(_MANNER_BANK[manner], size=n_core, replace=False))
    connector = rng.choice(_CONNECT)
    tox = rng.choice(_TOX)
    parts = [victim, f"{connector} {core[0]}"] + core[1:]
    if tox:
        parts.append(tox)
    # Occasionally inject a mild confounder from another manner (realistic noise)
    if rng.random() < 0.12:
        other = rng.choice([m for m in MANNERS if m != manner])
        parts.append(rng.choice(_MANNER_BANK[other]))
    return " ".join(parts)


def build_autopsy_dataset(n: int, seed: int):
    rng = np.random.default_rng(seed)
    texts, labels = [], []
    probs = [0.30, 0.15, 0.25, 0.20, 0.10]
    for _ in range(n):
        manner = str(rng.choice(MANNERS, p=probs))
        texts.append(make_autopsy_report(rng, manner))
        labels.append(manner)
    return texts, labels


# ---------------------------------------------------------------------------
# 2. DIGITAL EVENT  ->  HIGH-ANOMALY FLAG
# ---------------------------------------------------------------------------

SOURCE_TYPES = ["CCTV", "MOBILE", "FINANCIAL", "SOCIAL", "GPS", "EMAIL", "BROWSER"]


def build_digital_dataset(n: int, seed: int):
    """Each row is a digital event; label = high anomaly (score > 0.7).

    The latent anomaly score combines temporal deviation, novel location,
    burst frequency, and subject diversity (mirrors digitalCorrelator logic).
    """
    rng = np.random.default_rng(seed)
    rows, labels = [], []
    for _ in range(n):
        source = str(rng.choice(SOURCE_TYPES))
        hour = int(rng.integers(0, 24))
        # temporal deviation: Gaussian centred at midday (12)
        temporal_dev = min(1.0, abs(hour - 12) / 12.0)
        novel_location = int(rng.random() < 0.25)
        burst_count = int(rng.poisson(1.2))  # events of same type within 1h
        freq_dev = min(1.0, max(0.0, (burst_count - 1) / 4.0))
        subject_diversity = float(rng.random())
        confidence = float(rng.uniform(0.4, 1.0))

        latent = (
            0.35 * temporal_dev
            + 0.25 * novel_location
            + 0.25 * freq_dev
            + 0.15 * subject_diversity
        )
        latent += rng.normal(0, 0.05)  # measurement noise
        latent = float(np.clip(latent, 0.0, 1.0))
        high_anomaly = int(latent > 0.6)

        rows.append({
            "sourceType": source,
            "hour": hour,
            "temporalDeviation": round(temporal_dev, 4),
            "novelLocation": novel_location,
            "burstCount": burst_count,
            "frequencyDeviation": round(freq_dev, 4),
            "subjectDiversity": round(subject_diversity, 4),
            "confidence": round(confidence, 4),
        })
        labels.append(high_anomaly)
    return rows, labels


# ---------------------------------------------------------------------------
# 3. CASE FEATURES  ->  RISK TIER  (mirror of calculateRiskScore)
# ---------------------------------------------------------------------------

RISK_MANNERS = MANNERS


def _risk_overall(evidence, suspects, anomalies, has_autopsy, has_tod, age_hours):
    ev = min(20, round(math.log1p(evidence) * 6))
    su = min(20, round(suspects * 4))
    dg = min(20, round(anomalies * 5))
    fi = 20 - ((10 if has_autopsy else 0) + (10 if has_tod else 0))
    ur = min(20, round(max(0.0, 20 - (age_hours / 720) * 20)))
    return int(ev + su + dg + fi + ur)


def _tier(overall: int) -> str:
    if overall >= 70:
        return "CRITICAL"
    if overall >= 50:
        return "HIGH"
    if overall >= 30:
        return "MEDIUM"
    return "LOW"


def build_risk_dataset(n: int, seed: int):
    rng = np.random.default_rng(seed)
    rows, labels = [], []
    for _ in range(n):
        evidence = max(0, min(int(rng.poisson(6)), 40))
        suspects = max(0, min(int(rng.poisson(1.3)), 10))
        anomalies = max(0, min(int(rng.poisson(1.5)), 12))
        has_autopsy = int(rng.random() < 0.55)
        has_tod = int(rng.random() < 0.45)
        manner = str(rng.choice(RISK_MANNERS, p=[0.30, 0.15, 0.25, 0.20, 0.10]))
        gaps = max(0, min(int(rng.poisson(1.0)), 8))
        age = float(min(rng.exponential(240.0), 1440.0))

        overall = _risk_overall(evidence, suspects, anomalies,
                                 bool(has_autopsy), bool(has_tod), age)
        rows.append({
            "evidenceCount": evidence,
            "suspectCount": suspects,
            "digitalAnomalyCount": anomalies,
            "hasAutopsy": has_autopsy,
            "hasTodEstimate": has_tod,
            "mannerOfDeath": manner,
            "openTimelineGaps": gaps,
            "caseAgeHours": round(age, 2),
        })
        labels.append(_tier(overall))
    return rows, labels
