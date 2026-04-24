# Veritas Chatbot — Code Documentation

> This document explains how the Veritas Chatbot codebase works, module by module, file by file. It is intended for developers who need to understand, maintain, or extend the system.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Backend Deep Dive](#3-backend-deep-dive)
4. [Frontend Deep Dive](#4-frontend-deep-dive)
5. [Data Flow & Interactions](#5-data-flow--interactions)
6. [Deployment & Infrastructure](#6-deployment--infrastructure)
7. [Testing Strategy](#7-testing-strategy)

---

## 1. Project Overview

**Veritas Chatbot** is an AI-powered school assistant built around **Managed Retrieval-Augmented Generation (RAG)**. Instead of maintaining a self-hosted vector database, it leverages **Google Gemini File Search** for document indexing and retrieval. The system consists of:

- A **public chat interface** where students and visitors ask questions grounded in official school documents.
- An **admin dashboard** where staff upload/manage documents and configure chatbot behavior.
- A **FastAPI backend** that orchestrates document ingestion, chat generation, and analytics.
- A **Next.js frontend** that provides both the chat UI and the admin panel.

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| LLM | Google Gemini 2.5 Flash (via `google-genai`) |
| RAG Engine | Google Gemini File Search (Managed RAG) |
| Backend Framework | FastAPI (Python 3.12) |
| Frontend Framework | Next.js 16 (React 19, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (production) / SQLite (fallback & testing) |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Testing | pytest (backend) / Vitest (frontend) |
| Containerization | Docker + Docker Compose |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                               │
│  ┌────────────────────────┐      ┌──────────────────────────────┐  │
│  │   Chat Interface       │      │   Admin Dashboard            │  │
│  │   (Next.js /page)      │      │   (Next.js /admin/*)         │  │
│  └──────────┬─────────────┘      └──────────────┬───────────────┘  │
└─────────────┼───────────────────────────────────┼──────────────────┘
              │ HTTP/JSON                         │ HTTP/JSON
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND (Port 8000)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ /chat/*     │  │ /documents/*│  │ /admin/*    │  │ CORS       │ │
│  │ Routers     │  │ Routers     │  │ Routers     │  │ Middleware │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────────┘ │
│         └─────────────────┴─────────────────┘                        │
│                           │                                          │
│         ┌─────────────────┴─────────────────┐                        │
│         │       SQLAlchemy ORM Layer          │                        │
│         │    (PostgreSQL / SQLite fallback)   │                        │
│         └─────────────────────────────────────┘                        │
│                           │                                          │
│         ┌─────────────────┴─────────────────┐                        │
│         │      Google Gemini Client           │                        │
│         │   (File Upload / File Search /      │                        │
│         │    Generate Content)                │                        │
│         └─────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Deep Dive

The backend lives in `backend/app/`. It follows a standard layered architecture: **Routers → Schemas → Services → Models → DB**.

### 3.1 Entry Point: `app/main.py`

This is the FastAPI application factory.

- **Creates tables automatically** on startup via `Base.metadata.create_all(bind=engine)`.
- **Configures CORS** to allow all origins (`["*"]`) — suitable for development; tighten for production.
- **Mounts three routers**:
  - `/documents` → Document management
  - `/chat` → Chat queries & conversation history
  - `/admin` → Statistics & settings

```python
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
```

### 3.2 Configuration: `app/core/config.py`

Uses **Pydantic Settings** to load environment variables from `.env`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | SQLAlchemy connection string | *required* |
| `GEMINI_API_KEY` | API key for Google GenAI | *required* |
| `GEMINI_MODEL` | Gemini model identifier | `gemini-3-flash-preview` |

### 3.3 Database Layer: `app/core/db.py`

- Uses **SQLAlchemy 2.0** with `declarative_base()`.
- Falls back to **SQLite** (`test.db`) if `DATABASE_URL` is unset — useful for builds and local testing.
- Exposes `get_db()` as a FastAPI dependency, yielding session-scoped DB connections.

```python
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### 3.4 Models (`app/models/`)

Four core models, all inheriting from `Base`:

#### `Document`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | Integer PK | Local DB ID |
| `filename` | String | Original upload name |
| `gemini_file_id` | String (unique) | Gemini's internal file reference |
| `gemini_file_uri` | String (nullable) | URI used for grounding in chat |
| `mime_type` | String | File content type |
| `status` | String | `ACTIVE`, `PROCESSING`, or `FAILED` |
| `created_at` / `updated_at` | DateTime | Audit timestamps |

#### `ChatLog`

Stores every question/answer pair. Linked to `Conversation` via `conversation_id`.

#### `Conversation`

Groups chat messages by a browser `session_id` (stored in `localStorage`). Auto-generates a title from the first user message.

#### `Setting`

Singleton table (only one row expected). Stores:
- `system_prompt` — prepended to every Gemini request.
- `strictness` — mapped to Gemini's `temperature` (0.0 = very strict, 1.0 = creative).

### 3.5 Schemas (`app/schemas/`)

Pydantic v2 models for request/response validation:

- **`chat.py`**: `ChatRequest` (message, optional session_id & conversation_id) and `ChatResponse` (answer, conversation_id).
- **`document.py`**: `DocumentResponse` with full metadata.
- **`admin.py`**: `StatsResponse` (total_questions, top_topics), `SettingResponse`, `SettingUpdate`.
- **`conversation.py`**: `ConversationListItem`, `ConversationDetail`, `MessageItem`.

### 3.6 Services: `app/services/gemini_documents.py`

This is the **integration layer** with Google Gemini. It handles edge cases that arise when file permissions change or network issues occur inside Docker containers.

#### Key Functions

| Function | Purpose |
|----------|---------|
| `is_dns_resolution_error(e)` | Traverses the exception chain looking for `socket.gaierror` or DNS-related strings. Returns `True` if the backend cannot reach Gemini's hostname. |
| `is_file_permission_error(e)` | Detects `403 PERMISSION_DENIED` or "do not have permission to access the file". |
| `extract_file_ids_from_permission_error(e)` | Uses regex to pull Gemini file IDs out of error messages. |
| `normalize_file_status(raw)` | Maps Gemini's `STATE_ACTIVE` / `STATE_PROCESSING` enums to our `ACTIVE` / `PROCESSING` strings. |
| `refresh_document_statuses(db, docs, client)` | Polls Gemini File API for each document and updates local status/URI. Quarantines `FAILED` docs. |
| `build_active_document_parts(docs)` | Converts active documents into Gemini `types.Part` objects (URI + mime_type) for content generation. |

#### Error-Resilience Strategy

The chat endpoint implements a **two-tier fallback** when Gemini rejects file references:

1. **Known file ID**: If the error message contains a file ID, that specific document is marked `FAILED` and the request is retried once.
2. **Unknown file ID**: The system isolates documents one-by-one (binary search style) until the request succeeds, marking the offending document `FAILED`.
3. **Total failure**: If all documents are bad, returns `503` with a clear message to re-upload.

### 3.7 API Endpoints

#### `/documents` Router (`app/api/endpoints/documents.py`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Accepts `multipart/form-data` with `.pdf`, `.txt`, or `.docx`. Saves to `/tmp`, uploads to Gemini File API, creates DB record. |
| `GET` | `/` | Lists all documents, refreshing statuses from Gemini. |
| `DELETE` | `/{id}` | Deletes DB record and attempts to delete from Gemini File API. |

#### `/chat` Router (`app/api/endpoints/chat.py`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/query` | Main chat endpoint. Fetches settings, refreshes doc statuses, builds Gemini content parts, generates answer, logs to DB. |
| `GET` | `/conversations` | Lists conversations for a `session_id` with message counts. |
| `GET` | `/conversations/{id}` | Returns full message history for a conversation. |
| `DELETE` | `/conversations/{id}` | Deletes a conversation and its chat logs. |

**Chat Generation Logic:**
1. Load `system_prompt` and `strictness` from `Setting` table (or use defaults).
2. Query all documents and refresh their statuses.
3. Filter to `ACTIVE` documents with valid URIs.
4. Call `client.models.generate_content()` with:
   - `contents = [document_parts..., user_message]`
   - `system_instruction = system_prompt`
   - `temperature = strictness`
5. Log the interaction and return the answer.

#### `/admin` Router (`app/api/endpoints/admin.py`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats` | Returns total question count and top keyword topics (basic NLP via `re` + `Counter`). |
| `GET` | `/settings` | Returns current settings row (creates defaults if missing). |
| `PUT` | `/settings` | Updates `system_prompt` and `strictness`. Validates `strictness ∈ [0.0, 1.0]`. |

---

## 4. Frontend Deep Dive

The frontend lives in `frontend/src/`. It is a **Next.js App Router** application with a clean separation between the public chat and the admin panel.

### 4.1 Global Setup

#### `app/layout.tsx`

- Sets up **Geist** and **Geist Mono** fonts.
- Applies `antialiased` class globally.
- Metadata: title = "Veritas Chatbot".

#### `lib/utils.ts`

A tiny utility that merges Tailwind classes without conflicts:

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### `lib/api.ts`

The **single source of truth** for all backend communication.

- Base URL is hardcoded to the production Render deployment (`https://veritas-chatbot-uy2v.onrender.com`), with a commented-out localhost fallback for development.
- Exports typed functions for every endpoint:
  - `queryChat()`, `getConversations()`, `getConversation()`, `deleteConversation()`
  - `getDocuments()`, `uploadDocument()`, `deleteDocument()`
  - `getStats()`, `getSettings()`, `updateSettings()`

### 4.2 Public Chat Interface

#### `app/page.tsx`

The landing page. Renders a full-screen gradient background and embeds the `<Chat />` component inside a rounded glassmorphic container.

#### `components/Chat.tsx`

The heart of the user-facing UI.

**State Management:**
- `messages` — array of `{id, role, content}` objects.
- `input` — current text input.
- `isLoading` — blocks input and shows typing indicator.
- `conversationId` — tracks active conversation for continuity.
- `showHistory` — toggles the conversation history modal.

**Session ID Generation:**
```typescript
const sessionId = typeof window !== "undefined"
  ? localStorage.getItem("veritas_session_id") ?? crypto.randomUUID()
  : "";
```

This allows anonymous users to retain conversation history across page reloads.

**Message Submission Flow:**
1. Append user message to local state immediately (optimistic UI).
2. Trim message history to last 8 messages (to stay within context limits and reduce token cost).
3. Call `queryChat(message, history, sessionId, conversationId)`.
4. Append assistant response. Update `conversationId` if the backend created a new one.
5. On error, show a friendly fallback message.

**Suggested Questions:**
Four pre-written questions are displayed as clickable chips to guide first-time users:
- "What are the school admission requirements?"
- "How can I apply for financial aid or scholarships?"
- etc.

#### `components/ConversationHistory.tsx`

A modal overlay that fetches and displays past conversations for the current `session_id`.

- **Load**: Fetches from `/chat/conversations?session_id=...`.
- **Select**: Fetches full message history and hydrates the chat UI.
- **Delete**: Removes conversation from backend and local state.
- **Date formatting**: Smart relative dates ("Today", "Yesterday", "Monday", "Apr 23").

### 4.3 Admin Dashboard

#### `app/admin/layout.tsx`

Provides a **responsive sidebar layout**:
- **Desktop**: Fixed left sidebar with navigation links (Documents, Statistics, Settings) and a "Back to Chatbot" footer.
- **Mobile**: Collapsible top header with horizontal scrollable nav pills.
- Active route highlighting via `usePathname()`.

#### `app/admin/page.tsx`

Simple redirect: `/admin` → `/admin/documents`.

#### `components/admin/DocumentsTable.tsx`

Full CRUD interface for documents.

**Features:**
- **Upload**: Hidden `<input type="file">` triggered by a styled button. Accepts `.pdf`, `.txt`, `.docx`.
- **Polling**: If any document is `PROCESSING`, it auto-refreshes every 5 seconds.
- **Status badges**: Color-coded chips (`PROCESSING` = amber, `ACTIVE` = emerald, `FAILED` = red).
- **Responsive**: Table on desktop, card list on mobile.
- **Skeleton loaders**: Shimmer effects while loading.

#### `components/admin/StatsCards.tsx`

Displays usage metrics as animated cards.

- **Total Questions**: Count of all rows in `chat_logs`.
- **Engagement Rate**: Static "Active" / "No data" label based on whether questions exist.
- Uses `framer-motion` for staggered entrance animations.

#### `components/admin/SettingsForm.tsx`

Controls chatbot behavior.

- **System Prompt**: Large textarea (max 2000 chars) that sets the AI's personality and constraints.
- **Strictness Slider**: Range input `0.0` to `1.0` (step `0.05`).
  - Label dynamically changes: Creative → Balanced → Strict → Very Strict.
  - Description text updates to explain the behavior at each level.
- **Dirty tracking**: Shows "unsaved changes" warning and disables Save when clean.
- **Feedback**: Success/error banners with auto-dismiss timeouts.

---

## 5. Data Flow & Interactions

### 5.1 Uploading a Document

```
User selects file
    │
    ▼
DocumentsTable.tsx ──POST /documents/upload──► documents.py
    │                                                │
    │                                                ▼
    │                                    Save to /tmp, upload to Gemini
    │                                    Create Document row (status=PROCESSING)
    │                                                │
    ▼                                                ▼
Poll every 5s ◄──GET /documents/─── refresh_document_statuses()
    │
    ▼
Status becomes ACTIVE (or FAILED)
```

### 5.2 Asking a Question

```
User types message
    │
    ▼
Chat.tsx ──POST /chat/query──► chat.py
    │                              │
    │                              ├── Load settings (prompt + strictness)
    │                              ├── Refresh all document statuses
    │                              ├── Filter ACTIVE docs with URIs
    │                              ├── Build Gemini content parts
    │                              └── Call generate_content()
    │                                  │
    │                                  ├── DNS error? → 503
    │                                  ├── Permission error? → quarantine + retry
    │                                  └── Success → answer text
    │                              │
    │                              ├── Log to ChatLog
    │                              └── Link to Conversation (if session_id)
    ▼                              ▼
Display answer ◄── ChatResponse
```

### 5.3 Viewing Admin Stats

```
Admin opens /admin/stats
    │
    ▼
StatsCards.tsx ──GET /admin/stats──► admin.py
    │                                   │
    │                                   ├── Count all ChatLog rows
    │                                   └── Extract keywords from questions
    │                                       (regex: [a-zA-Z]{3,}, remove stopwords)
    │                                   └── Counter.most_common(5)
    ▼                                   ▼
Render cards ◄── StatsResponse
```

---

## 6. Deployment & Infrastructure

### 6.1 Docker Compose (`docker-compose.yml`)

Three services:

| Service | Image / Build | Port | Notes |
|---------|--------------|------|-------|
| `db` | `postgres:16-alpine` | `5432` | Persistent volume `postgres_data` |
| `backend` | `./backend/Dockerfile` | `8000` | Hot-reload via `--reload` flag in dev |
| `frontend` | `./frontend/Dockerfile` | `3000` | Node development server |

All services attach to a custom bridge network `veritas_network`.

### 6.2 Backend Dockerfile

- Base: `python:3.12-slim`
- Installs `gcc` and `libpq-dev` for compiling `psycopg2-binary`
- Installs Python deps from `requirements.txt`
- Default command: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`

### 6.3 Environment Variables

See `.env.example`:

```bash
POSTGRES_USER=veritas_user
POSTGRES_PASSWORD=veritas_password
POSTGRES_DB=veritas_db
DATABASE_URL=postgresql://veritas_user:veritas_password@db:5432/veritas_db
GEMINI_API_KEY=your_gemini_api_key_here
```

### 6.4 Database Migrations (Alembic)

Alembic is configured (`alembic.ini`, `alembic/env.py`) but currently **auto-create tables** are enabled in `main.py` for simplicity. For production, switch to `alembic upgrade head`.

---

## 7. Testing Strategy

### 7.1 Backend Tests (`backend/tests/`)

Uses **pytest** with an in-memory SQLite database and `TestClient`.

#### `conftest.py`

- Creates a separate `TestingSessionLocal` bound to `test.db`.
- Overrides `get_db` dependency so all tests use the test DB.
- Auto-creates/drops tables around each test via `setup_db` fixture.

#### Test Coverage

| File | What It Tests |
|------|---------------|
| `test_chat.py` | Query endpoint, validation errors, DNS failure (503), permission-denied retry logic, isolation of bad documents without IDs. |
| `test_documents.py` | Upload success, invalid file type rejection, list documents, delete document, delete missing doc (404), DNS failure on upload. |
| `test_admin.py` | Empty stats, stats with seeded chat logs, topic extraction, settings default creation, settings update, strictness validation (422). |

**Mocking Strategy:**
- The `client` (Gemini client) is patched at the router module level.
- MagicMock objects simulate `client.files.upload()`, `client.files.get()`, and `client.models.generate_content()`.
- DNS errors are injected using real `socket.gaierror` exceptions.

### 7.2 Frontend Tests (`frontend/src/__tests__/`)

Uses **Vitest** + **React Testing Library** + **jsdom**.

Configured in `vitest.config.ts`:
- `@/` alias resolves to `./src`
- Globals enabled (no need to import `describe`, `it`, etc.)
- Setup file: `vitest.setup.ts`

Test files (observed in repo):
- `Chat.test.tsx`
- `DocumentsTable.test.tsx`
- `StatsCards.test.tsx`
- `SettingsForm.test.tsx`

---

## 8. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Managed RAG (Gemini File Search)** | Eliminates the need to self-host a vector DB (Pinecone, Weaviate, etc.), reducing infrastructure complexity. |
| **SQLite fallback in DB layer** | Allows the backend to start even without a PostgreSQL container (e.g., during CI, local testing, or Render free tier). |
| **Session-based conversations (no auth)** | The target users are anonymous website visitors. `localStorage` + `session_id` provides continuity without login friction. |
| **Two-tier file permission fallback** | Gemini file references can become invalid if the API key changes or files expire. The system gracefully degrades by quarantining bad documents instead of crashing. |
| **Hardcoded production API base in frontend** | Simplifies deployment to static hosting (e.g., Vercel, Netlify) without needing runtime env vars. The commented localhost line makes local development easy. |

---

## 9. File Tree Reference

```
Veritas_chatbot/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints/
│   │   │       ├── admin.py          # Stats & settings endpoints
│   │   │       ├── chat.py           # Chat query & conversation endpoints
│   │   │       └── documents.py      # Document upload/list/delete endpoints
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic settings (.env loader)
│   │   │   └── db.py                 # SQLAlchemy engine, session, Base
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── chat_log.py           # Q&A pair model
│   │   │   ├── conversation.py       # Conversation thread model
│   │   │   ├── document.py           # Uploaded document model
│   │   │   └── setting.py            # Chatbot configuration singleton
│   │   ├── schemas/
│   │   │   ├── admin.py              # Stats & settings Pydantic schemas
│   │   │   ├── chat.py               # Chat request/response schemas
│   │   │   ├── conversation.py       # Conversation list/detail schemas
│   │   │   └── document.py           # Document response schema
│   │   ├── services/
│   │   │   └── gemini_documents.py   # Gemini client integration helpers
│   │   └── main.py                   # FastAPI app, CORS, router mounts
│   ├── tests/
│   │   ├── api/
│   │   │   ├── test_admin.py
│   │   │   ├── test_chat.py
│   │   │   └── test_documents.py
│   │   └── conftest.py               # Pytest fixtures & test DB override
│   ├── alembic/                      # Database migration scripts
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env / .env.prod
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx        # Admin sidebar shell
│   │   │   │   ├── page.tsx          # Redirects to /documents
│   │   │   │   ├── documents/
│   │   │   │   │   └── page.tsx      # Document management page
│   │   │   │   ├── stats/
│   │   │   │   │   └── page.tsx      # Statistics page
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx      # Settings page
│   │   │   ├── layout.tsx            # Root layout (fonts, metadata)
│   │   │   └── page.tsx              # Public chat landing page
│   │   ├── components/
│   │   │   ├── Chat.tsx              # Main chat UI
│   │   │   ├── ConversationHistory.tsx # Past conversations modal
│   │   │   └── admin/
│   │   │       ├── DocumentsTable.tsx
│   │   │       ├── SettingsForm.tsx
│   │   │       └── StatsCards.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                # Typed fetch wrappers
│   │   │   └── utils.ts              # cn() Tailwind merge utility
│   │   └── __tests__/                # Vitest test suites
│   ├── package.json
│   ├── vitest.config.ts
│   └── Dockerfile
├── docker-compose.yml                # Local dev orchestration
├── .env.example
└── README.md
```

---

*Document generated for the Veritas Chatbot project. For questions or updates, refer to the source code in `backend/app/` and `frontend/src/`.*
