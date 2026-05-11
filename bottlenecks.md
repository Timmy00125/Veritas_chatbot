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

## 6. Admin Dashboard — Inefficient Stats Computation

*   **O(N) Topic Extraction:** The `get_stats` endpoint (`backend/app/api/endpoints/admin.py:95-96`) loads every `ChatLog.question` into Python memory, then runs regex + `Counter` to extract topics. This scans the entire `chat_logs` table on every stats request and will degrade badly as the table grows.
*   **Naive Keyword Frequency:** Topic extraction is single-word only — "school fees" becomes two separate topics "school" and "fees". The stopword list is minimal (35 words) and there's no n-gram or phrase detection, so the "Top Topics" chart is dominated by generic words that slipped past the filter.

## 7. Admin Dashboard — Missing Pagination & Filtering

*   **No Pagination on Conversations:** The backend `admin_list_conversations` accepts `limit` and `offset` params, but the frontend always passes `limit=50, offset=0` with no "load more" or pagination controls. Admins with more than 50 conversations can only see the first page.
*   **No Date Range Filtering:** Conversations and exports have no date-range filter. An admin wanting "last month's conversations" must export everything and filter manually in a spreadsheet.
*   **No Bulk Document Operations:** Deleting 10 failed documents requires 10 individual delete clicks and confirmations.

## 8. Admin Dashboard — No Authentication

*   **Open Admin Routes:** All `/admin/*` routes are fully unauthenticated. Anyone who discovers the URL can read every conversation, delete documents, change the system prompt, and export all chat data. This is the single highest-severity security gap in the system.

## 9. Admin Dashboard — Data Model Gaps

*   **No Document-to-Answer Linkage:** `ChatLog` doesn't record which documents were active when an answer was generated, so the admin can't measure which documents are actually useful or how often each is referenced.
*   **Bot Errors Not Logged:** Gemini API failures (503s, permission errors, DNS resolution failures) are handled in code but never written to the database. The admin has no visibility into bot failure rates beyond documents that eventually end up with `FAILED` status.
*   **No Session-Level View:** `session_id` exists on conversations but the dashboard doesn't group by it. There's no way to see a single user's journey across multiple conversations.

## 10. Admin Dashboard — Configuration Mismatch

*   **Strictness Default Discrepancy:** The `Setting` model defaults `strictness` to `0.2` (`backend/app/models/setting.py:10`), but the frontend `SettingsForm` defaults to `0.5` (`frontend/src/components/admin/SettingsForm.tsx:11`). If the settings row doesn't exist yet, the admin UI shows `0.5` while the chatbot actually uses `0.2`.

## Recommendations for Refactoring

To fix the most immediate issues, consider the following starting points:
1.  **Decouple Document Status Polling:** Move the document status polling out of the chat endpoint. Run it on a cron job or background task instead.
2.  **Cache Document Context:** Cache the `active_document_parts` so it doesn't need to be rebuilt from scratch on every single message.
3.  **Implement a Task Queue:** Introduce Celery or RQ for handling uploads and Gemini API synchronization asynchronously.
4.  **Upgrade Database:** Migrate from SQLite to PostgreSQL for production to handle concurrent reads and writes.
5.  **Environment Variables:** Refactor frontend and backend to strictly rely on environment variables for API URLs and other configuration settings.
6.  **Admin Authentication:** Add at minimum an env-var–based password gate for the admin routes. Even a single shared secret is better than open access.
7.  **SQL-Based Topic Extraction:** Move topic extraction out of Python and into a SQL `GROUP BY` query (or a materialized view) so the database does the heavy lifting instead of loading every question into memory.
8.  **Pagination & Date Filters:** Implement cursor/offset pagination and date-range filters on the conversations and export endpoints. The backend already supports `limit`/`offset` — wire it into the frontend.
9.  **Log Bot Errors to DB:** Capture Gemini API failures (503s, permission errors, DNS errors) as records in the database so the admin dashboard can surface failure rates and affected conversations.
10. **Fix Strictness Default:** Align the `Setting` model default (`0.2`) and the frontend default (`0.5`) to the same value to avoid silent misconfiguration.
