# AsterLearn

A deployable, AI-powered personalized learning and adaptive assessment platform.

## Project structure

- `frontend/` - React + Vite student application
- `backend/` - FastAPI API, database models, and AI service boundary

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000/api/v1` in `frontend/.env` if the API uses a different address.

## Deployment target

- Frontend: Vercel
- API: Render or Railway
- Database: Neon or Supabase Postgres

Never place API keys in the frontend. Configure them only in backend environment variables.
