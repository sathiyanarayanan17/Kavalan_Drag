# KAVALAN (காவலன்) — AI-Powered Forensic Triage & Postmortem Intelligence

> _Guardian of the Investigation._ An explainable forensic triage system that
> assists investigators — and tells them how confident it is.

[![tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)]()
[![build](https://img.shields.io/badge/build-passing-brightgreen)]()

## What makes it different (novelty)

- **Method-disagreement / uncertainty flagging** — when the ML model, the rule
  engine, and the LLM disagree on manner of death, that disagreement is
  surfaced as an *uncertainty flag* recommending human review. The system tells
  you not just its answer, but how much its own methods agree.
- **Time-of-death window correlation** — automatically cross-references the
  estimated TOD window against digital-evidence timestamps and flags the events
  that fall *inside* it: the critical-window leads.
- **Tamper-evident chain of custody** — every analysis/evidence action is
  cryptographically hash-chained (SHA-256). Any alteration of a past record
  breaks the chain and is detectable — a real admissibility requirement.
- **Counterfactual risk explanations** — e.g. "risk would drop to MEDIUM by
  completing the autopsy" — actionable, explainable next steps.

## Core capabilities

| Capability | Method |
|-----------|--------|
| Autopsy manner-of-death | Neural NLP model (99.8%) + rules + optional LLM, with disagreement detection |
| Time-of-death | Henssge nomogram (published forensic math) |
| Digital anomaly detection | XGBoost model (96.7%) |
| Risk scoring | Auditable formula + LightGBM (98.4%) + counterfactuals |
| Suspect/evidence graph | Relationship graph per case |
| Cross-case correlation | Shared subjects/locations/sources across cases |
| Cross-case search | Full-text-ish search over all records |
| Export | Printable PDF report + CSV |
| Auth | PBKDF2-hashed passwords, roles (supervisor/analyst/readonly) |
| Audit | Tamper-evident chain of custody |

## Quick start

```bash
npm install
pip install -r ml/requirements.txt
python ml/train_all.py          # train the ML suite (one command)

python ml/service.py            # terminal 1 — ML API (or start-ml.bat)
npm run dev                     # terminal 2 — app → http://localhost:4000
```

Sign in with a demo account:

| Username | Password | Role |
|----------|----------|------|
| supervisor | supervisor | full (incl. delete) |
| analyst | analyst | run analyses + view |
| viewer | viewer | read-only |

### Tests

```bash
npm test     # 23 Vitest tests: auth, risk, uncertainty, chain-of-custody
```

### Docker

```bash
export AUTH_SECRET="$(openssl rand -hex 32)"
docker compose up --build       # app on :4000, ML service internal
```

See **`DEPLOYMENT.md`** for the production hardening checklist, **`ml/README.md`**
for the model suite, and **`ml/INTEGRATION.md`** for how ML is wired in.

## Honest scope

The ML models are trained on large **synthetic** datasets generated from the
app's own vocabulary and rule logic (the shipped database has only demo cases).
Reported accuracies measure generalisation across that space — **not** validated
real-world forensic accuracy. Consistent with the project's ethic: the tool
**assists and explains; it does not decide.** All outputs require review by
qualified professionals.

---

<details>
<summary>Original detailed documentation (architecture, schema, API reference)</summary>

# AIVENTRA

## AI-Powered Forensic Triage & Postmortem Intelligence System

> Built for the **HackHere Community Hackathon** — advancing forensic intelligence through AI-assisted case analysis.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [Technical Architecture](#technical-architecture)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Usage Guide](#usage-guide)
7. [AI Analysis Engine](#ai-analysis-engine)
8. [Design System](#design-system)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)
11. [Ethical Considerations](#ethical-considerations)
12. [Future Enhancements](#future-enhancements)
13. [HackHere Hackathon Context](#hackhereaiventra-hackathon-context)

---

## Project Overview

**AIVENTRA** is a dense, professional forensic intelligence platform designed for investigative analysts, medical examiners, and digital forensics teams. It centralises case management, AI-assisted autopsy analysis, time-of-death estimation, digital evidence correlation, and risk scoring into a single cohesive workspace.

### The Problem

Traditional forensic case management is fragmented across siloed tools: pathologists work with paper autopsy forms, digital forensics teams use separate chain-of-custody software, and case officers maintain spreadsheets for risk tracking. Critical intelligence gets lost across these boundaries, and the time between incident and actionable insight is measured in days — not minutes.

### The Solution

AIVENTRA unifies these workflows behind a single investigative interface. Each case becomes a living intelligence file: evidence is catalogued, AI analysis runs against autopsy reports to extract cause-of-death and postmortem intervals, a Henssge-based time-of-death nomogram estimates TOD windows, digital records are correlated across devices and timestamps, and a composite risk score surfaces the cases that most urgently demand attention.

### Who It's For

- **Forensic Investigators** managing multiple concurrent cases
- **Pathologists & Medical Examiners** needing structured autopsy analysis
- **Digital Forensics Analysts** correlating multi-source electronic evidence
- **Supervisors & Command Staff** who need at-a-glance risk prioritisation

---

## Core Features

### 1. Autopsy Report Analysis

Submit raw autopsy text to AIVENTRA's NLP pipeline. The system extracts:

- **Cause & manner of death** (natural, homicide, suicide, accidental, undetermined)
- **Wound count and injury patterns** (blunt force, sharp force, ballistic, strangulation)
- **Toxicology findings** (substance detection and probable contribution)
- **Postmortem interval estimation** from narrative text
- **Rigor mortis stage** (0–4 scale) and **livor mortis state**
- **Confidence score** (0–1) reflecting extraction certainty

Results are stored against the case and feed directly into the Timeline and TOD modules.

### 2. Time-of-Death Estimation

Enter environmental and physical variables (body temperature, ambient temperature, rigor and livor state, last-seen-alive timestamp) and AIVENTRA computes a TOD window using a simplified Henssge nomogram algorithm:

- **Estimated earliest and latest TOD** as ISO timestamps
- **Confidence level** (0–1) based on factor completeness
- **Methodology trace** explaining the calculation path
- **Corrective factors** for clothing, body mass, and environment

### 3. Digital Evidence Correlation

Import and analyse digital traces from CCTV, mobile devices, financial records, social media, GPS, email, and browser history. AIVENTRA:

- **Plots all events on a unified timeline** ordered chronologically
- **Calculates anomaly scores** — events that deviate from subject's normal patterns score higher
- **Identifies temporal clusters** — groups of events within short windows that suggest coordinated activity
- **Tags high-anomaly events** for priority review
- **Filters by source type** (CCTV, MOBILE, FINANCIAL, etc.)

### 4. Case Risk Scoring

Every case carries a composite risk score (0–100) and tier (LOW / MEDIUM / HIGH / CRITICAL) computed from:

- Evidence count and type diversity
- Suspect count
- Open action items
- Time elapsed without resolution
- Anomaly density in digital evidence
- Autopsy complexity indicators

The score updates on demand via the Risk Analysis button. The dashboard surfaces the top 3 CRITICAL/HIGH cases for immediate attention.

### 5. Investigation Dashboard

A dense, data-forward home screen showing:

- **Stats strip** — total cases, open, active, critical
- **Risk distribution chart** — breakdown by risk tier
- **Case pipeline** — status-flow bar chart
- **Recent activity feed** — latest actions across all cases
- **High-risk spotlight** — top 3 cases needing immediate attention

---

## Technical Architecture

### Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Framework      | Next.js 14 (App Router)              |
| Language       | TypeScript 5                         |
| Styling        | Tailwind CSS 3 + OKLCH CSS variables |
| Animation      | Framer Motion 11                     |
| Icons          | Lucide React                         |
| Charts         | Recharts 2                           |
| Database       | SQLite via `better-sqlite3`          |
| Date Utilities | date-fns 3                           |
| Runtime        | Node.js 20+                          |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Next.js)                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Dashboard │  │Case List │  │ Case WS  │  │  New   │  │
│  │ /        │  │ /cases   │  │/cases/[id│  │ Case   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │             │             │       │
│       └──────────────┴─────────────┴─────────────┘       │
│                            │                             │
│                   fetch() API calls                      │
└────────────────────────────┼─────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼─────────────────────────────┐
│                   NEXT.JS API ROUTES                      │
│                                                          │
│  GET/POST /api/cases          GET /api/cases/[id]        │
│  GET       /api/seed          POST /api/analyze/autopsy  │
│  POST      /api/analyze/tod   POST /api/analyze/risk     │
│  POST      /api/analyze/digital                          │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                    AI ANALYSIS ENGINE                     │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Autopsy NLP │  │ Henssge TOD  │  │ Digital Corr.  │  │
│  │  Extractor  │  │  Nomogram    │  │   Anomaly Det. │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Risk Scoring Engine                    │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                     SQLITE DATABASE                       │
│                                                          │
│   cases  │  evidence  │  autopsy_reports  │  tod_estimates│
│   digital_evidence  │  case_activities                   │
└──────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
aiventra/
├── README.md                          # This file
├── package.json                       # Dependencies and scripts
├── next.config.mjs                    # Next.js configuration
├── tailwind.config.ts                 # Tailwind CSS configuration
├── tsconfig.json                      # TypeScript configuration
├── postcss.config.mjs                 # PostCSS configuration
│
└── src/
    ├── types/
    │   └── index.ts                   # Shared TypeScript types
    │
    ├── app/
    │   ├── globals.css                # OKLCH design tokens + base styles
    │   ├── layout.tsx                 # Root layout (html, body, metadata)
    │   ├── page.tsx                   # Dashboard — Investigation Hub
    │   │
    │   ├── cases/
    │   │   ├── page.tsx               # Case registry with filters
    │   │   ├── new/
    │   │   │   └── page.tsx           # New case creation form
    │   │   └── [id]/
    │   │       ├── layout.tsx         # Case workspace shell + tab nav
    │   │       ├── page.tsx           # Case overview tab
    │   │       ├── autopsy/
    │   │       │   └── page.tsx       # Autopsy analysis tab
    │   │       ├── tod/
    │   │       │   └── page.tsx       # Time-of-death estimation tab
    │   │       ├── digital/
    │   │       │   └── page.tsx       # Digital evidence tab
    │   │       └── timeline/
    │   │           └── page.tsx       # Evidence timeline tab
    │   │
    │   └── api/
    │       ├── seed/
    │       │   └── route.ts           # Seeds demo data into SQLite
    │       ├── cases/
    │       │   ├── route.ts           # GET all cases, POST create case
    │       │   └── [id]/
    │       │       └── route.ts       # GET single case with all relations
    │       └── analyze/
    │           ├── autopsy/
    │           │   └── route.ts       # POST run autopsy NLP analysis
    │           ├── tod/
    │           │   └── route.ts       # POST run TOD Henssge estimation
    │           ├── digital/
    │           │   └── route.ts       # POST run digital correlation
    │           └── risk/
    │               └── route.ts       # POST run composite risk scoring
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx           # Sidebar + main content wrapper
    │   │   ├── Sidebar.tsx            # Navigation sidebar
    │   │   └── TopBar.tsx             # Page header with title and actions
    │   │
    │   ├── ui/
    │   │   ├── Badge.tsx              # Generic inline badge component
    │   │   ├── Button.tsx             # Primary / secondary / ghost button
    │   │   ├── ConfidenceBar.tsx      # Horizontal confidence progress bar
    │   │   ├── RiskBadge.tsx          # Risk level badge (CRITICAL/HIGH/etc.)
    │   │   └── StatusStamp.tsx        # Case status badge
    │   │
    │   ├── dashboard/
    │   │   ├── StatsStrip.tsx         # Top stats row (total, open, critical)
    │   │   ├── RiskDistribution.tsx   # Pie/donut chart of risk tiers
    │   │   ├── CasePipeline.tsx       # Status-flow bar chart
    │   │   └── RecentActivity.tsx     # Activity feed component
    │   │
    │   ├── cases/
    │   │   ├── CaseTable.tsx          # Filterable case list table
    │   │   ├── RiskGauge.tsx          # Radial gauge for risk score
    │   │   └── EvidenceTag.tsx        # Evidence type tag chip
    │   │
    │   ├── autopsy/
    │   │   └── AutopsyPanel.tsx       # Autopsy report input + results panel
    │   │
    │   ├── tod/
    │   │   └── TodPanel.tsx           # TOD estimation form + results
    │   │
    │   ├── digital/
    │   │   └── DigitalPanel.tsx       # Digital evidence list + anomaly view
    │   │
    │   └── timeline/
    │       └── TimelineRail.tsx       # Chronological evidence timeline rail
    │
    ├── lib/
    │   ├── db.ts                      # SQLite connection singleton
    │   └── ai/
    │       ├── autopsyAnalyzer.ts     # Autopsy NLP extraction logic
    │       ├── todEstimator.ts        # Henssge nomogram TOD calculator
    │       ├── digitalCorrelator.ts   # Digital evidence anomaly detection
    │       └── riskScorer.ts          # Composite risk scoring formula
    │
    └── db/
        └── schema.sql                 # SQL schema (reference — auto-run by seed)
```

---

## Getting Started

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Python 3** (required by `better-sqlite3` native build)
- **C++ build tools** (`build-essential` on Linux, Xcode CLI on macOS, MSVC on Windows)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/aiventra.git
cd aiventra

# Install dependencies (better-sqlite3 will compile a native addon)
npm install
```

### Running the Development Server

```bash
npm run dev
```

The application starts on **http://localhost:4000**.

On first load, visiting the dashboard automatically calls `GET /api/seed` to populate the SQLite database with realistic demo cases, evidence, activities, and analysis results.

### Production Build

```bash
npm run build
npm start        # runs on port 4000
```

---

## Usage Guide

### 1. Dashboard Overview

Open `http://localhost:4000`. The dashboard shows:

- **Stats strip** at the top — total, open, active, and critical case counts
- **Risk distribution** (left) — visual breakdown of case risk tiers
- **Case pipeline** (right) — cases by status stage
- **Recent activity** (bottom left) — latest events across all cases
- **High-risk spotlight** (bottom right) — top 3 CRITICAL/HIGH cases

Click any high-risk case strip to jump directly to that case workspace.

### 2. Browsing Cases

Navigate to **Cases** in the sidebar (or click `/cases`). Use the filter bar to narrow by:

- **Status**: ALL · OPEN · ACTIVE · PENDING · CLOSED · COLD
- **Risk**: ALL · CRITICAL · HIGH · MEDIUM · LOW

Click any row to open the full case workspace.

### 3. Opening a New Case

Click **NEW CASE** from the dashboard or case list. Fill in:

- Case title (required), victim name, location, date of incident
- Assigned agent, description, tags (comma-separated)
- Initial risk assessment (LOW / MEDIUM / HIGH / CRITICAL)

Submit to create the case and redirect to the overview tab.

### 4. Case Workspace Tabs

Each case has five tabs:

| Tab                  | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| **Overview**         | Case details, evidence inventory, quick actions |
| **Autopsy**          | Submit/view autopsy report analysis             |
| **Time of Death**    | Run Henssge TOD estimation                      |
| **Digital Evidence** | View and analyse digital traces                 |
| **Timeline**         | Unified chronological event rail                |

### 5. Running Autopsy Analysis

1. Navigate to **Autopsy** tab for a case
2. Paste raw autopsy report text into the input area
3. Optionally enter body temperature, ambient temperature, and rigor/livor observations
4. Click **ANALYSE REPORT**
5. Results appear: cause of death, manner, injuries, toxicology, PMI estimate, confidence score

### 6. Estimating Time of Death

1. Navigate to **Time of Death** tab
2. Enter: body temp (°C), ambient temp (°C), rigor mortis stage (0–4), livor mortis state, and last-seen-alive timestamp
3. Click **ESTIMATE TOD**
4. The system returns an earliest/latest TOD window with confidence level and methodology trace

### 7. Digital Evidence Analysis

1. Navigate to **Digital Evidence** tab
2. View existing digital records or add new ones via the API
3. AIVENTRA displays anomaly scores and flags high-deviation events
4. Click **CORRELATE EVIDENCE** to run the full anomaly-detection pass

### 8. Evidence Timeline

1. Navigate to **Timeline** tab
2. All digital events are plotted chronologically on a vertical rail
3. TOD window (if estimated) is highlighted as a shaded zone
4. Autopsy milestones are overlaid as markers

---

## AI Analysis Engine

AIVENTRA uses a deterministic rules-based AI engine — no external API calls or ML model inference. All analysis runs locally and synchronously in the API routes.

### Autopsy NLP Extractor (`lib/ai/autopsyAnalyzer.ts`)

**Cause of death** is extracted via keyword pattern matching against a priority-ordered lexicon:

```
GUNSHOT → ballistic trauma
STAB / LACERATIONS → sharp force injury
BLUNT / BLUDGEON → blunt force trauma
STRANGULATION / LIGATURE → asphyxiation
POISONING / TOXICITY → toxic ingestion
OVERDOSE → substance overdose
...
```

**Manner of death** is determined by secondary context clues:

- Presence of "self-inflicted", "suicide note", "lone actor" → SUICIDE
- Multiple wounds, "defensive", "victim fled" → HOMICIDE
- "fell", "accident", "unwitnessed" → ACCIDENTAL
- Insufficient context → UNDETERMINED

**Postmortem interval** is extracted from explicit ranges in the text ("approximately 6–10 hours", "24 to 36 hours post-mortem") using regex matching.

**Confidence** is calculated as a weighted average of extraction completeness:

```
confidence = (causeFound * 0.3) + (mannerFound * 0.2) + (PMIFound * 0.2)
           + (toxFound * 0.15) + (woundsFound * 0.15)
```

### Henssge Nomogram TOD Estimator (`lib/ai/todEstimator.ts`)

Based on the Henssge nomogram for body cooling. The core formula:

```
Corrected body temp = rectal temp × correction factor
Q = (correctedTemp - ambientTemp) / (37.2 - ambientTemp)
t = 1.11328 × sqrt(-1.2329 + sqrt(1.52122 + (0.32278 + Q)²)) / (0.0284)
```

Where `t` is time since death in hours. Correction factors applied for:

- **Clothing**: naked (+0), light (+15%), heavy (+30%)
- **Body mass**: standard 70kg reference; adjusted ±5% per 10kg deviation
- **Environment**: still air (baseline), moving air (−10%), water (−15%)

The 95% confidence interval produces an earliest/latest window. Confidence score decreases when inputs are incomplete or implausible (e.g., body temp > 37°C).

### Digital Evidence Anomaly Detector (`lib/ai/digitalCorrelator.ts`)

Each digital event is scored for anomaly using:

```
anomaly = w1 × temporalDeviation
        + w2 × locationDeviation
        + w3 × frequencyDeviation
        + w4 × subjectDiversityScore
```

**Temporal deviation**: how far the event timestamp deviates from the subject's typical activity hours (modelled as a Gaussian centred at midday).

**Location deviation**: events at novel locations (no prior occurrence in case data) score higher.

**Frequency deviation**: burst events (>3 of same type within 1 hour) score higher than isolated events.

**Subject diversity**: events involving multiple subjects in rapid succession raise the anomaly flag.

Events with `anomalyScore > 0.7` are flagged as HIGH ANOMALY and sorted to the top.

### Composite Risk Scorer (`lib/ai/riskScorer.ts`)

```
riskScore = Σ (factor_score × factor_weight)

Factors:
  evidenceCount      weight 0.15   (more evidence = higher complexity)
  suspectCount       weight 0.20   (more suspects = higher risk)
  digitalAnomalies   weight 0.25   (proportion of high-anomaly events)
  timeElapsed        weight 0.15   (days since incident, log-scaled)
  autopsyComplexity  weight 0.15   (wound count, toxicology, manner)
  openActions        weight 0.10   (unresolved follow-ups)

riskScore is normalised to 0–100.

Tiers:
  0–24  → LOW
  25–49 → MEDIUM
  50–74 → HIGH
  75–100 → CRITICAL
```

---

## Design System

AIVENTRA uses a custom dark forensic theme built on **OKLCH** perceptual colour space, ensuring consistent contrast and hue relationships across all UI surfaces.

### Colour Palette

```css
/* Backgrounds */
--bg: oklch(10% 0.01 265) /* Near-black blue-grey base */
  --bg-surface-1: oklch(13% 0.012 265) /* Raised surface */
  --bg-surface-2: oklch(16% 0.014 265) /* Input / card background */
  --bg-surface-3: oklch(19% 0.014 265) /* Elevated / hover surface */ /* Text */
  --text-base: oklch(92% 0.005 265) /* Primary text */
  --text-dim: oklch(55% 0.01 265) /* Labels, secondary */
  --text-data: oklch(88% 0.008 265) /* Data values */
  --text-muted: oklch(40% 0.01 265) /* Placeholder, metadata */
  /* Amber accent */ --amber: oklch(78% 0.18 75) /* Primary accent */
  --amber-dim: oklch(65% 0.16 75) /* Secondary accent / mono refs */
  --amber-bg: oklch(20% 0.04 75) /* Accent tinted background */
  /* Risk levels */ --critical: oklch(58% 0.22 25) /* Red */
  --high: oklch(65% 0.18 40) /* Orange */ --medium: oklch(75% 0.15 75)
  /* Amber */ --low: oklch(65% 0.15 145) /* Green */;
```

### Typography

| Usage                                 | Font           | Class       |
| ------------------------------------- | -------------- | ----------- |
| UI labels, body text, descriptions    | Inter          | `font-sans` |
| Identifiers, codes, data values, refs | JetBrains Mono | `font-mono` |

### UI Principles

1. **Dense information layout** — no excessive whitespace; data-forward design
2. **No gradient text** — solid colour only
3. **No glassmorphism** — solid backgrounds only
4. **No hero metrics** — data is contextual, not decorative
5. **Uppercase mono labels** — all field labels, headings, and filters use uppercase monospaced text
6. **Amber as the single accent** — one consistent accent colour across the interface

---

## API Reference

| Method | Path                   | Description                                            |
| ------ | ---------------------- | ------------------------------------------------------ |
| `GET`  | `/api/seed`            | Seeds the database with demo data (idempotent)         |
| `GET`  | `/api/cases`           | Returns all cases with counts                          |
| `POST` | `/api/cases`           | Creates a new case                                     |
| `GET`  | `/api/cases/:id`       | Returns full case with evidence, activities, reports   |
| `POST` | `/api/analyze/autopsy` | Runs autopsy NLP analysis on submitted report text     |
| `POST` | `/api/analyze/tod`     | Runs Henssge TOD estimation from physical observations |
| `POST` | `/api/analyze/digital` | Runs anomaly detection on digital evidence records     |
| `POST` | `/api/analyze/risk`    | Computes composite risk score for a case               |

### `POST /api/cases` — Request Body

```json
{
  "title": "string (required)",
  "victimName": "string",
  "location": "string",
  "dateOfIncident": "ISO date string",
  "assignedAgent": "string",
  "description": "string",
  "tags": "JSON array string e.g. '[\"homicide\",\"digital\"]'",
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL"
}
```

### `GET /api/cases/:id` — Response Shape

```json
{
  "case": { ...Case },
  "evidence": [ ...Evidence[] ],
  "activities": [ ...CaseActivity[] ],
  "autopsyReport": AutopsyReport | null,
  "todEstimate": TodEstimate | null,
  "digitalEvidence": [ ...DigitalEvidence[] ]
}
```

### `POST /api/analyze/autopsy` — Request / Response

```json
// Request
{
  "caseId": "string",
  "rawReport": "string (full autopsy text)",
  "bodyTemperature": 28.5,
  "ambientTemperature": 18.0,
  "rigorMortisStage": 2,
  "livorMortisState": "fixed"
}

// Response
{
  "autopsyReport": { ...AutopsyReport }
}
```

### `POST /api/analyze/tod` — Request / Response

```json
// Request
{
  "caseId": "string",
  "bodyTemp": 27.3,
  "ambientTemp": 19.0,
  "rigorMortisStage": 2,
  "livorMortisState": "mobile",
  "lastSeenAlive": "2024-03-15T14:30:00Z"
}

// Response
{
  "todEstimate": { ...TodEstimate }
}
```

### `POST /api/analyze/risk` — Request / Response

```json
// Request
{ "caseId": "string" }

// Response
{
  "riskSummary": {
    "overall": 78,
    "tier": "CRITICAL",
    "factors": [
      { "label": "Suspect Count", "score": 85, "weight": 0.20 }
    ],
    "anomalies": ["Multiple high-anomaly digital events detected"],
    "recommendations": ["Prioritise digital evidence correlation"]
  }
}
```

---

## Database Schema

### `cases`

| Column           | Type             | Description                           |
| ---------------- | ---------------- | ------------------------------------- |
| `id`             | TEXT PRIMARY KEY | UUID                                  |
| `caseRef`        | TEXT             | Human reference (e.g. `AIV-2024-001`) |
| `title`          | TEXT             | Case title                            |
| `description`    | TEXT             | Narrative description                 |
| `status`         | TEXT             | `OPEN\|ACTIVE\|PENDING\|CLOSED\|COLD` |
| `riskLevel`      | TEXT             | `LOW\|MEDIUM\|HIGH\|CRITICAL`         |
| `riskScore`      | INTEGER          | 0–100 composite score                 |
| `location`       | TEXT             | Incident location                     |
| `dateCreated`    | TEXT             | ISO timestamp                         |
| `dateOfIncident` | TEXT             | ISO date                              |
| `assignedAgent`  | TEXT             | Investigating officer name            |
| `suspectCount`   | INTEGER          | Number of suspects                    |
| `evidenceCount`  | INTEGER          | Denormalised evidence count           |
| `victimName`     | TEXT             | Primary victim name                   |
| `tags`           | TEXT             | JSON array of tag strings             |

### `evidence`

| Column        | Type             | Description                                            |
| ------------- | ---------------- | ------------------------------------------------------ |
| `id`          | TEXT PRIMARY KEY | UUID                                                   |
| `caseId`      | TEXT             | FK → cases.id                                          |
| `catalogRef`  | TEXT             | Evidence catalogue reference                           |
| `type`        | TEXT             | `PHYSICAL\|DIGITAL\|BIOLOGICAL\|TESTIMONIAL\|FORENSIC` |
| `description` | TEXT             | Evidence description                                   |
| `collectedAt` | TEXT             | ISO timestamp of collection                            |
| `location`    | TEXT             | Collection location                                    |
| `analyst`     | TEXT             | Collecting analyst                                     |
| `notes`       | TEXT             | Free-form notes                                        |
| `confidence`  | REAL             | 0.0–1.0 confidence rating                              |

### `autopsy_reports`

| Column               | Type             | Description                   |
| -------------------- | ---------------- | ----------------------------- |
| `id`                 | TEXT PRIMARY KEY | UUID                          |
| `caseId`             | TEXT             | FK → cases.id                 |
| `rawReport`          | TEXT             | Original submitted text       |
| `analyzedAt`         | TEXT             | ISO timestamp of analysis     |
| `causeOfDeath`       | TEXT             | Extracted cause               |
| `mannerOfDeath`      | TEXT             | Extracted manner              |
| `postmortemInterval` | TEXT             | Extracted PMI range           |
| `injuryPattern`      | TEXT             | Wound pattern summary         |
| `toxicologyFindings` | TEXT             | Toxicology summary            |
| `woundsCount`        | INTEGER          | Extracted wound count         |
| `bodyTemperature`    | REAL             | Recorded body temp (°C)       |
| `rigorMortisStage`   | INTEGER          | 0–4 stage                     |
| `livorMortisState`   | TEXT             | Livor state description       |
| `confidence`         | REAL             | 0.0–1.0 extraction confidence |
| `analysisNotes`      | TEXT             | Analysis trace notes          |

### `tod_estimates`

| Column                 | Type             | Description             |
| ---------------------- | ---------------- | ----------------------- |
| `id`                   | TEXT PRIMARY KEY | UUID                    |
| `caseId`               | TEXT             | FK → cases.id           |
| `estimatedAt`          | TEXT             | When estimation was run |
| `bodyTemp`             | REAL             | Input body temp (°C)    |
| `ambientTemp`          | REAL             | Input ambient temp (°C) |
| `rigorMortisStage`     | INTEGER          | Input rigor stage       |
| `livorMortisState`     | TEXT             | Input livor state       |
| `lastSeenAlive`        | TEXT             | ISO timestamp           |
| `estimatedTodEarliest` | TEXT             | ISO timestamp           |
| `estimatedTodLatest`   | TEXT             | ISO timestamp           |
| `confidenceLevel`      | REAL             | 0.0–1.0                 |
| `methodology`          | TEXT             | Methodology trace       |
| `notes`                | TEXT             | Additional notes        |

### `digital_evidence`

| Column         | Type             | Description                                            |
| -------------- | ---------------- | ------------------------------------------------------ |
| `id`           | TEXT PRIMARY KEY | UUID                                                   |
| `caseId`       | TEXT             | FK → cases.id                                          |
| `sourceType`   | TEXT             | `CCTV\|MOBILE\|FINANCIAL\|SOCIAL\|GPS\|EMAIL\|BROWSER` |
| `sourceName`   | TEXT             | Source identifier                                      |
| `timestamp`    | TEXT             | Event timestamp (ISO)                                  |
| `location`     | TEXT             | Geographic location                                    |
| `subject`      | TEXT             | Subject of the record                                  |
| `description`  | TEXT             | Event description                                      |
| `confidence`   | REAL             | 0.0–1.0                                                |
| `anomalyScore` | REAL             | 0.0–1.0 anomaly rating                                 |
| `tags`         | TEXT             | JSON array of tag strings                              |

### `case_activities`

| Column        | Type             | Description                                                                  |
| ------------- | ---------------- | ---------------------------------------------------------------------------- |
| `id`          | TEXT PRIMARY KEY | UUID                                                                         |
| `caseId`      | TEXT             | FK → cases.id                                                                |
| `type`        | TEXT             | `EVIDENCE_ADDED\|ANALYSIS_RUN\|REPORT_GENERATED\|STATUS_CHANGED\|NOTE_ADDED` |
| `description` | TEXT             | Human-readable description                                                   |
| `createdAt`   | TEXT             | ISO timestamp                                                                |
| `agent`       | TEXT             | Acting agent/user                                                            |

---

## Ethical Considerations

> **IMPORTANT DISCLAIMER**

AIVENTRA is an **advisory tool only**. All outputs — including cause-of-death extractions, time-of-death windows, anomaly scores, and risk assessments — are **probabilistic estimates** intended to assist trained professionals, not to replace them.

- **Autopsy analysis** results must be reviewed by a qualified forensic pathologist before use in any legal or investigative proceeding.
- **Time-of-death estimates** carry inherent uncertainty and are sensitive to environmental factors not fully captured by the Henssge nomogram. Body decomposition, environmental extremes, and postmortem movement can significantly affect accuracy.
- **Digital anomaly scores** reflect statistical deviation, not guilt. High-anomaly scores require human review and contextual interpretation.
- **Risk scores** are heuristic aggregates. A LOW score does not mean a case is unimportant; a CRITICAL score does not confirm danger.
- All data stored in AIVENTRA should be treated as **sensitive law enforcement information** and handled in compliance with applicable data protection regulations (GDPR, HIPAA, applicable national laws).

This system was built for a **hackathon demonstration** and has not been validated against clinical or forensic accuracy standards. It should **not** be deployed in real investigative contexts without extensive testing, validation, and regulatory review.

---

## Future Enhancements

| Priority | Feature              | Description                                                            |
| -------- | -------------------- | ---------------------------------------------------------------------- |
| HIGH     | LLM Integration      | Replace rules-based NLP with GPT-4 / Claude API for autopsy analysis   |
| HIGH     | Real-time Updates    | WebSocket push for live case updates across team sessions              |
| MEDIUM   | Multi-user Auth      | Role-based access (analyst, supervisor, read-only) with JWT            |
| MEDIUM   | Export & Reporting   | PDF/CSV export of case summaries and analysis reports                  |
| MEDIUM   | Evidence File Upload | Direct file attachments (images, documents) linked to evidence records |
| MEDIUM   | Advanced Timeline    | Interactive pan/zoom timeline with filtering and event grouping        |
| LOW      | Suspect Graph        | Visual network graph of suspect–location–device relationships          |
| LOW      | Case Linking         | Cross-case correlation to identify connected incidents                 |
| LOW      | Audit Trail          | Immutable audit log with cryptographic hash chain                      |
| LOW      | Mobile PWA           | Responsive progressive web app for field use                           |
| LOW      | Offline Mode         | IndexedDB sync for offline evidence capture                            |

---

## HackHere / AIVENTRA Hackathon Context

AIVENTRA was designed and built for the **HackHere Community Hackathon** — a community-driven initiative celebrating applied AI in high-impact domains.

The challenge: build an AI system that addresses a real-world professional workflow. Forensic investigation was chosen for its combination of:

- **High stakes** — errors have life-altering consequences
- **Data fragmentation** — multiple domains of evidence that rarely speak to each other
- **Time pressure** — the first 48 hours of a homicide investigation are the most critical
- **Underserved by technology** — most investigative tools are antiquated and disconnected

AIVENTRA demonstrates that a small team (or a single developer) can ship a coherent, functional intelligence platform in a hackathon timeframe by combining Next.js App Router, TypeScript, SQLite, and deterministic AI algorithms — without requiring any paid APIs or cloud infrastructure.

---

_Built with precision. Deployed with purpose. AIVENTRA — forensic intelligence for the modern investigator._

</details>
