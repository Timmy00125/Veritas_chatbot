# Veritas Chatbot - Performance & Architectural Bottlenecks

Based on an analysis of the `Veritas_chatbot` project, here are the critical performance, scalability, and architectural bottlenecks identified.

## 1. Severe API Latency (The Biggest Bottleneck)

*   **Redundant Synchronous API Calls:** In the backend, the `/chat/query` and `/documents/` endpoints both call a function named `refresh_document_statuses`. This function performs a synchronous network request to the Gemini API for *every single document* in your database to check its status. This means your API latency will scale linearly (O(N)) with the number of documents you have. As users upload more files, the chat will become noticeably slower and eventually time out.
*   **Context Reconstruction Overhead:** On every single chat request, the system fetches and rebuilds the `active_document_parts` payload to send to Gemini. For a large knowledge base, this results in massive payload reconstruction on the fly and unnecessary processing overhead.

## 2. Lack of Asynchronous Background Processing

*   **Synchronous Uploads:** Document uploads and their subsequent syncing with the Gemini API occur entirely within the HTTP request-response cycle. If a user uploads a large PDF or the Gemini API is slow, the HTTP request will block and likely time out. 
*   **Missing Task Queue:** The system currently lacks a background worker (like Celery or Redis Queue) to handle heavy tasks like document processing, vectorization, or status polling asynchronously.

## 3. Database Concurrency Limits

*   **SQLite Default:** The project relies on SQLite as the default database (`backend/test.db`). While fine for testing, SQLite locks the entire database during write operations. Under concurrent load (multiple users chatting or uploading documents simultaneously), this will cause significant performance degradation and "database is locked" errors.
*   **Synchronous SQLAlchemy:** The database interactions appear to be using synchronous SQLAlchemy sessions, which block the event loop in FastAPI, preventing it from handling other requests concurrently.

## 4. Missing Chat Context (Functional Issue)

*   While looking at the bottlenecks, it appears the frontend sends a `history` array to the backend, but the backend's `chat_query` endpoint does not actually utilize this history when communicating with Gemini. This means the AI currently treats every message as an isolated query and has no memory of the conversation.

## 5. Deployment & Configuration Brittleness

*   **Hardcoded Frontend URLs:** The frontend API client (`frontend/src/lib/api.ts`) contains a hardcoded production API base URL. This makes it very difficult to run the frontend locally against a local backend or deploy to staging environments without manually modifying code.
*   **Local File Storage:** When uploading files, the backend relies on local temporary files. In a containerized (Docker) environment, if you scale to multiple backend containers, they won't share the same local filesystem, leading to broken document references unless a shared volume or cloud storage (like AWS S3) is implemented.

## Recommendations for Refactoring

To fix the most immediate issues, consider the following starting points:
1.  **Decouple Document Status Polling:** Move the document status polling out of the chat endpoint. Run it on a cron job or background task instead.
2.  **Cache Document Context:** Cache the `active_document_parts` so it doesn't need to be rebuilt from scratch on every single message.
3.  **Implement a Task Queue:** Introduce Celery or RQ for handling uploads and Gemini API synchronization asynchronously.
4.  **Upgrade Database:** Migrate from SQLite to PostgreSQL for production to handle concurrent reads and writes.
5.  **Environment Variables:** Refactor frontend and backend to strictly rely on environment variables for API URLs and other configuration settings.
