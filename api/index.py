import sys
import os
import traceback

# Resolve the absolute path to the backend directory
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, _backend_dir)

# Set a dummy DATABASE_URL if not configured, to prevent import crash
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///dummy.db"

try:
    from app.main import app  # noqa: F401 — re-exported for Vercel
except Exception:
    _tb = traceback.format_exc()
    print(f"[api/index.py] Failed to import app from backend:\n{_tb}", flush=True)

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="EduSphere API (fallback)")

    @app.get("/{path:path}")
    async def fallback(path: str = ""):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Backend failed to initialise.",
                "detail": _tb,
                "hint": "Check that GEMINI_API_KEY and other env vars are set in Vercel.",
            },
        )

# Vercel also checks for "handler" — expose it as an alias
handler = app
