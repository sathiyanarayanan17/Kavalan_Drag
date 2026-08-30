# KAVALAN — Deployment Guide

## Local development

```bash
npm install
pip install -r ml/requirements.txt
python ml/train_all.py
python ml/service.py      # terminal 1
npm run dev               # terminal 2  → http://localhost:4000
```

## Tests

```bash
npm test            # run once (Vitest)
npm run test:watch  # watch mode
```
Covers password hashing, session signing/verification (including tamper and
role-escalation rejection), and the risk-scoring formula.

## Docker (app + ML together)

```bash
# Set a strong secret first (do NOT use the default in production)
export AUTH_SECRET="$(openssl rand -hex 32)"

docker compose up --build
# app  → http://localhost:4000
# ml   → internal only (http://ml:8008 on the compose network)
```

- The Next.js app is built with `output: "standalone"` for a lean image.
- The ML service image trains the models at build time (see `Dockerfile.ml`);
  to skip that, comment out the `RUN python ml/train_all.py` line and mount
  pre-trained models into `/app/ml/models` instead.
- SQLite data persists in the `kavalan-data` named volume.

## Production notes / hardening checklist

- [x] Passwords hashed with PBKDF2-SHA256 (100k iterations, per-user salt).
- [x] Session cookie is HMAC-signed, `HttpOnly`, `SameSite=lax`, and `Secure`
      in production (requires HTTPS — terminate TLS at a proxy/load balancer).
- [x] Timing-safe comparisons for signatures and passwords.
- [ ] **Set `AUTH_SECRET`** to a strong random value (the app warns if unset in
      production).
- [ ] Replace demo users in `src/lib/auth.ts` with a real user store. Generate
      password hashes with `hashPassword()` and supply them via the
      `KAVALAN_*_HASH` env vars or a database.
- [ ] Put the app behind HTTPS (the `Secure` cookie will not travel over plain
      HTTP, so login will not persist without TLS in production).
- [ ] Configure the LLM keys (GROQ_API_KEY) if you want the Groq path; the app
      falls back to the local ML models + rules otherwise.

## Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `AUTH_SECRET` | Session cookie signing secret | dev default (warns in prod) |
| `ML_SERVICE_URL` | URL of the ML service | `http://127.0.0.1:8008` |
| `ML_HOST` / `ML_PORT` | Bind host/port for the ML service | `127.0.0.1` / `8008` |
| `KAVALAN_SUPERVISOR_HASH` etc. | Env-provided password hashes | runtime demo hash |
