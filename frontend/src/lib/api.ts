const FALLBACK_API_BASE = "https://veritas-chatbot-uy2v.onrender.com";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? FALLBACK_API_BASE;
// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  filename: string;
  mime_type: string;
  status: string;
  created_at: string;
  gemini_file_id: string;
  gemini_file_uri: string;
}

export interface Stats {
  total_questions: number;
}

export interface Settings {
  id: number;
  system_prompt: string;
  strictness: number;
}

export interface SettingsUpdate {
  system_prompt: string;
  strictness: number;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatQueryResponse {
  answer: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function queryChat(
  message: string,
  history: ChatHistoryItem[] = [],
): Promise<ChatQueryResponse> {
  const res = await fetch(`${API_BASE}/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch response");
  }

  return res.json();
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/documents/`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/admin/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/admin/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function updateSettings(
  payload: SettingsUpdate,
): Promise<Settings> {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}
