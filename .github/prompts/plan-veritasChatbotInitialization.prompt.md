Initialize a monorepo structure for a unified development environment. The stack includes a FastAPI backend, a Bun-powered Next.js frontend, and a PostgreSQL database, all orchestrated via Docker Compose.

### 1. Root Orchestration: `docker-compose.yml`

Define the core services with networked communication and persistent volumes.

- **db**: PostgreSQL 16+ image.
- **backend**: FastAPI service with hot-reloading.
- **frontend**: Next.js service using the Bun runtime.

### 2. Backend Architecture (`backend/`)

- **Dockerfile**: Use a Python 3.11/3.12-slim base.
- **Requirements**: Include `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `google-genai`, and **`alembic`**.
- **Alembic Setup**:
- Initialize Alembic in the `backend/` directory.
- Configure `alembic.ini` to pull the `sqlalchemy.url` from environment variables.
- Set up `env.py` to target the project's Metadata for autogeneration.

- **Core Logic**: Establish `app/core/db.py` for the SQLAlchemy engine and session factory.

### 3. Frontend Architecture (`frontend/`)

- **Runtime**: Use the `oven/bun:alpine` image for the Dockerfile.
- **Scaffolding**:
- Create a placeholder `package.json` (empty object `{}`).
- Provide `next.config.js` and `tsconfig.json` configurations.
- **Note**: All dependencies and scripts will be managed via Bun once the container is live or during local development.

### 4. Configuration & Environment

- **`.env.example`**: Define `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `DATABASE_URL`.
- **Networking**: Ensure the backend connects to the database via the service name `db` (e.g., `postgresql://user:pass@db:5432/veritas_db`).

---

### Implementation Details

| Component      | Technology | Docker Image          |
| -------------- | ---------- | --------------------- |
| **Backend**    | FastAPI    | `python:3.12-slim`    |
| **Frontend**   | Next.js    | `oven/bun:alpine`     |
| **Database**   | PostgreSQL | `postgres:16-alpine`  |
| **Migrations** | Alembic    | (Included in Backend) |

---

### Immediate Action Items

1. **Alembic Initialization**: Run `alembic init alembic` within the backend directory and ensure the migration script folder is tracked in Git.
2. **Bun Dockerfile**: Ensure the frontend `Dockerfile` uses `BUN_INSTALL` paths correctly to allow `bun install` to run within the container volume.
3. **Port Mapping**:

- Backend: `8000:8000`
- Frontend: `3000:3000`
- Database: `5432:5432`
