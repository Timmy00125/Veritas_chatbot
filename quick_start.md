# Veritas Chatbot Quick Start

This quick-start guide gets you up and running locally with the Veritas Chatbot repository (FastAPI backend + Next.js frontend).

## 1. Prerequisites

- `git` installed
- Node.js 18+ (`pnpm` recommended)
- Python 3.10+
- PostgreSQL or MongoDB configured locally (the backend expects a database URL via env var)
- Google Gemini API key

## 2. Clone repo

```bash
git clone https://github.com/Timmy00125/Veritas_chatbot.git
cd Veritas_chatbot
```

## 3. Backend setup

### 3.1 Python environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.2 Environment variables

Create `.env` file in `backend/` with:

```env
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/<db>
# or MongoDB URL for your choice
GEMINI_API_KEY=<your-gemini-api-key>
```

### 3.3 Database migrations

```bash
alembic upgrade head
```

### 3.4 Start the API server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

---

## 4. Frontend setup

```bash
cd ../frontend
pnpm install
```

### 4.1 Start frontend

```bash
pnpm dev
```

Open http://localhost:3000

---

## 5. Quick test flow

1. Upload docs in Admin > Documents page.
2. Use the chat UI to ask questions.
3. Check stats on Admin > Stats page.
4. Change system settings at Admin > Settings.

---

## 6. Running tests

### Backend tests

```bash
cd backend
source .venv/bin/activate
pytest
```

### Frontend tests

```bash
cd frontend
pnpm test
```

---

## 7. Notes

- The backend fetches config from `.env` via `app/core/config.py`.
- `GEMINI_API_KEY` is mandatory: used for Gemini embeddings + file search integration.
- If you need local development without API service, create mock endpoints or stub out `gemini_documents.py`.

---

## 8. Troubleshooting

- `Invalid DB URL` → verify `DATABASE_URL` scheme and credentials.
- `Missing GEMINI_API_KEY` → set env var and restart backend.
- `Frontend 500` → ensure backend is running on `localhost:8000` and API endpoints are reachable.
