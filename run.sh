#!/usr/bin/env bash
# Start RedFlag Terminal locally: API + dashboard on http://localhost:8000
set -e
cd "$(dirname "$0")/backend"
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
export SEC_USER_AGENT="${SEC_USER_AGENT:-RedFlag Terminal contact@example.com}"
uvicorn app.main:app --host 0.0.0.0 --port 8000
