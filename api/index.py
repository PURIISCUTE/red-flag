"""Vercel entry point: exposes the FastAPI backend as one serverless function.

vercel.json rewrites /api/<rest> -> /api/index?__path=<rest>. Depending on the runtime, the app may then see
either the original path (/api/v1/health) or /api/index; this wrapper restores the original path in both cases."""
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app as fastapi_app  # noqa: E402


async def app(scope, receive, send):
    if scope.get("type") == "http":
        qs = parse_qs(scope.get("query_string", b"").decode(), keep_blank_values=True)
        orig = qs.pop("__path", [None])[0]
        path = scope.get("path", "")
        if orig is not None and not path.startswith("/api/v1"):
            path = "/api/" + orig.lstrip("/")
        elif not path.startswith("/api/") and path.startswith("/v1/"):
            path = "/api" + path
        scope = dict(scope, path=path, raw_path=path.encode(),
                     query_string=urlencode({k: v[0] for k, v in qs.items()}).encode())
    await fastapi_app(scope, receive, send)
