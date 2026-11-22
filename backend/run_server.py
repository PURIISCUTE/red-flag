"""Run this file in PyCharm (right-click -> Run) to start the API + dashboard on http://localhost:8000."""
import os
import uvicorn

os.environ.setdefault("SEC_USER_AGENT", "RedFlag Terminal contact@example.com")  # use your real e-mail

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
