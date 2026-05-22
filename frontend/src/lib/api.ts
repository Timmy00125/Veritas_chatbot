const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://0.0.0.0:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  filename: string;
  mime_type: string;
  status: string;
  created_at: string;
  gemini_file_id: string;
  gemini_file_uri: string;
  supabase_file_url?: string;
  supabase_file_path?: string;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface Stats {
  total_questions: number;
  top_topics: TopicCount[];
  total_conversations: number;
  total_documents: number;
  active_documents: number;
  failed_documents: number;
  questions_per_day: DayCount[];
  avg_messages_per_conversation: number;
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
  conversation_id: number;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AdminConversation {
  id: number;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_question: string | null;
}

export interface ConversationMessage {
  role: string;
  content: string;
  created_at: string;
}

export interface ConversationDetail {
  id: number;
  title: string;
  created_at: string;
  messages: ConversationMessage[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function queryChat(
  message: string,
  history: ChatHistoryItem[] = [],
  sessionId?: string,
  conversationId?: number,
): Promise<ChatQueryResponse> {
  const res = await fetch(`${API_BASE}/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      session_id: sessionId,
      conversation_id: conversationId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to fetch response");
  }

  return res.json();
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(
  sessionId: string,
): Promise<Conversation[]> {
  const res = await fetch(
    `${API_BASE}/chat/conversations?session_id=${encodeURIComponent(sessionId)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function getConversation(id: number): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete conversation");
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

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/admin/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

// ─── Admin Conversations ──────────────────────────────────────────────────────

export async function getAdminConversations(
  search?: string,
  limit = 50,
  offset = 0,
): Promise<AdminConversation[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(`${API_BASE}/admin/conversations?${params}`);
  if (!res.ok) throw new Error("Failed to fetch conversations");
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

// ─── Admin Exports ────────────────────────────────────────────────────────────

export function getExportUrl(
  type: "conversations" | "documents" | "chat-logs",
): string {
  return `${API_BASE}/admin/export/${type}`;
}
