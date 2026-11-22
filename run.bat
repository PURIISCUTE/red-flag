@echo off
REM Start RedFlag Terminal locally: API + dashboard on http://localhost:8000
cd /d "%~dp0backend"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
if "%SEC_USER_AGENT%"=="" set SEC_USER_AGENT=RedFlag Terminal contact@example.com
uvicorn app.main:app --host 0.0.0.0 --port 8000
