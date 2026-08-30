@echo off
REM ============================================================
REM  start-ml.bat  — launch the KAVALAN ML microservice
REM  Serves the trained models on http://127.0.0.1:8008
REM  The Next.js app calls this automatically; if it is not
REM  running the app falls back to the rule-based engine.
REM ============================================================
cd /d "%~dp0"
echo Starting KAVALAN ML service on http://127.0.0.1:8008 ...
python ml\service.py
