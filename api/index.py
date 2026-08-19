import sys
import os

# Add backend directory to Python path so Vercel can find the app package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Set a dummy DATABASE_URL if not configured, to prevent import crash
# (the Vercel serverless functions don't use the database directly)
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///dummy.db"

# Import the actual app from backend
from app.main import app

# Vercel needs this top-level assignment cleanly
app = app
handler = app
