# Veritas Chatbot

> An AI-powered chatbot system for school websites, providing students and visitors with instant, accurate answers about school policies, admissions, and campus life using Managed Retrieval-Augmented Generation (RAG).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start (Docker)](#quick-start-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Veritas Chatbot is a full-stack application designed to reduce administrative workload by automating responses to common inquiries. It leverages Google's Gemini File Search (Managed RAG) to ground all answers in officially uploaded school documents, ensuring accuracy and consistency.

The system includes:
- A **public chat interface** for students and visitors.
- An **admin dashboard** for school staff to manage documents and monitor usage.
- A **FastAPI backend** handling RAG pipelines, authentication, and analytics.

---

## Features

### Core Chat Experience
- **Document-Grounded Answers:** Responses are strictly based on uploaded PDF, DOCX, and TXT files.
- **FAQ Suggestions:** Curated "Suggested Questions" guide users (e.g., "How do I apply?", "What are the hostel fees?").
- **Rate Limiting:** Prevents API abuse and ensures fair usage.

### Admin Dashboard
- **Document Management:** Upload, view, and delete school documents.
- **Usage Analytics:** Visual cards displaying total questions, common topics, and active document counts.
- **System Settings:** Adjust chatbot "strictness" and update the system prompt.

### Security & Roles
| Role | Capabilities |
|------|--------------|
| **Superadmin** | Full system access, API configuration, advanced logs |
| **Admin** | Document management, view usage stats |
| **End User** | Chat with AI, browse FAQs |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **LLM** | Google Gemini 2.5 Flash |
| **RAG Engine** | Google Gemini File Search (Managed RAG) |
| **Embeddings** | Google Gemini Embedding Model |
| **Backend** | FastAPI (Python 3.10+) |
| **Frontend** | Next.js 16 (React 19, Tailwind CSS v4) |
| **Database** | PostgreSQL 16 (via SQLAlchemy + Alembic) |
| **Containerization** | Docker & Docker Compose |

---

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Next.js       │──────▶   FastAPI       │──────▶   PostgreSQL    │
│   Frontend      │◀─────│   Backend       │◀─────│   (Analytics)   │
│  (Port 3000)    │      │  (Port 8000)    │      │   (Port 5432)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  Google Gemini  │
                        │  File Search    │
                        └─────────────────┘
```

---

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 18+ (with `pnpm` recommended)
- [Python](https://www.python.org/) 3.10+
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (optional, for containerized setup)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

---

### Quick Start (Docker)

The fastest way to get running locally:

```bash
# 1. Clone the repository
git clone https://github.com/Timmy00125/Veritas_chatbot.git
cd Veritas_chatbot

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Start all services
docker-compose up --build
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs (Swagger UI):** http://localhost:8000/docs

---

### Manual Setup

If you prefer running services directly on your machine:

#### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# Set up environment
cp ../.env.example .env
# Edit .env with your database URL and Gemini API key

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

---

## Environment Variables

Create a `.env` file in the project root (or `backend/` for manual setup) with the following:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `veritas_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `veritas_password` |
| `POSTGRES_DB` | PostgreSQL database name | `veritas_db` |
| `DATABASE_URL` | Full database connection string | `postgresql://veritas_user:veritas_password@db:5432/veritas_db` |
| `GEMINI_API_KEY` | Your Google Gemini API key | `AIzaSy...` |

> **Security Note:** Never commit your `.env` file or expose your `GEMINI_API_KEY` in public repositories.

---

## Project Structure

```
Veritas_chatbot/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/              # API route definitions
│   │   ├── core/             # Config, security, dependencies
│   │   ├── db/               # Database models & sessions
│   │   ├── services/         # Business logic (RAG, uploads)
│   │   └── main.py           # Application entry point
│   ├── alembic/              # Database migration scripts
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile
├── frontend/                 # Next.js application
│   ├── app/                  # App router pages
│   ├── components/           # Reusable React components
│   ├── lib/                  # Utilities & API clients
│   ├── public/               # Static assets
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml        # Multi-service orchestration
├── .env.example              # Environment variable template
├── quick_start.md            # Detailed quick-start guide
└── README.md                 # You are here!
```

---

## API Documentation

Once the backend is running, interactive API documentation is available at:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send a message to the chatbot |
| `POST` | `/api/documents` | Upload a new document |
| `GET` | `/api/documents` | List all uploaded documents |
| `DELETE` | `/api/documents/{id}` | Remove a document |
| `GET` | `/api/stats` | Retrieve usage statistics |
| `GET` | `/api/settings` | Get system settings |
| `PUT` | `/api/settings` | Update system settings |

---

## Testing

### Backend Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

### Frontend Tests

```bash
cd frontend
pnpm test
```

---

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production` for the frontend.
- [ ] Use a production-grade ASGI server (e.g., Gunicorn with Uvicorn workers) for the backend.
- [ ] Configure a secure PostgreSQL instance with regular backups.
- [ ] Store all secrets (API keys, DB credentials) in a secure vault or environment manager.
- [ ] Enable HTTPS for all traffic.
- [ ] Set up monitoring and logging (e.g., Prometheus, Grafana, or cloud-native solutions).

### Docker Production Build

```bash
docker-compose -f docker-compose.yml up --build -d
```

For a more robust production setup, consider using orchestration tools like **Kubernetes** or managed platforms like **AWS ECS**, **Google Cloud Run**, or **Azure Container Apps**.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Invalid DB URL` | Verify your `DATABASE_URL` scheme and credentials in `.env`. |
| `Missing GEMINI_API_KEY` | Ensure the `GEMINI_API_KEY` environment variable is set and the backend was restarted. |
| `Frontend 500 error` | Ensure the backend is running on `localhost:8000` and is reachable from the frontend. |
| `Migration errors` | Run `alembic upgrade head` inside the backend container/directory. |
| `Port already in use` | Stop existing services on ports `3000`, `8000`, or `5432`, or change the mapped ports in `docker-compose.yml`. |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please ensure your code follows the existing style and includes tests where applicable.

---

## License

This project is proprietary and developed for school administrative use. Please contact the maintainers for licensing inquiries.

---

<div align="center">
  <sub>Built with care for the school community.</sub>
</div>
