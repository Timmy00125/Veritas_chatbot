Project Overview

An AI-powered chatbot system for the school website designed to provide students and visitors with accurate information about school policies, admissions, and campus life using Managed Retrieval Augmented Generation (RAG). The system includes an administrative dashboard for document management and usage analytics.

Tech Stack
LLM: Google Gemini 2.5 Flash (for speed and cost-effectiveness)

RAG Engine: Google Gemini File Search (Managed RAG)

Embeddings: Google Gemini Embedding Model

Backend: FastAPI (Python 3.10+)

Frontend: Next.js (Tailwind CSS for styling)

Database: PostgreSQL or MongoDB (for user management and analytics tracking)

User Roles & Permissions
Superadmin (Developer): Full system access, API configuration, and advanced logs.

Admins (School Staff): Can access the dashboard to upload/delete documents and view usage stats.

End Users (Students/Visitors): Can chat with the AI and view the FAQ section.

Core Features

1. Managed RAG Pipeline (Backend)
   Ingestion: Support for .pdf, .docx, and .txt files.

Managed Retrieval: Integrate with the Gemini File Search API to handle document indexing and retrieval without a manual vector DB setup.

Contextual Response: Generate answers strictly grounded in the uploaded school documents.

2. Admin Dashboard (Frontend + API)
   Document Management: A table view showing all uploaded files with a "Delete" option and a "Upload New" button.

Usage Statistics: Visual cards showing:

Total questions asked.

Most common query topics.

Number of active documents.

Settings: Toggle chatbot "strictness" or update the system prompt.

3. Chat Interface (Frontend)
   User UI: A clean, floating chat bubble or a dedicated support page.

FAQ Section: A curated list of "Suggested Questions" (e.g., "How do I apply?", "What are the hostel fees?") to guide the user.

Security: Rate-limiting to prevent API abuse and sanitization of user inputs.
