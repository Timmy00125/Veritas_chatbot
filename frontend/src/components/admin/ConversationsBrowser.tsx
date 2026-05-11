"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  User,
  Bot,
  Clock,
} from "lucide-react";
import {
  getAdminConversations,
  getConversation,
  deleteConversation,
  type AdminConversation,
  type ConversationDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function SkeletonRow() {
  return (
    <div className="border-b border-slate-800/50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-800 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-1/3" />
        </div>
        <div className="h-6 w-16 bg-slate-800 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

function MessageBubble({ role, content, createdAt }: { role: string; content: string; createdAt: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Bot size={14} className="text-emerald-400" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-slate-800 text-slate-200 rounded-bl-md"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <p className={cn("text-xs mt-1", isUser ? "text-blue-200/60" : "text-slate-500")}>
          {new Date(createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <User size={14} className="text-blue-400" />
        </div>
      )}
    </div>
  );
}

function ConversationDetailPanel({
  conversationId,
  onClose,
  onDelete,
}: {
  conversationId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setDetail(await getConversation(conversationId));
      } catch {
        setError("Failed to load conversation");
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="px-6 py-8 text-center text-red-400 text-sm">{error ?? "Not found"}</div>
    );
  }

  return (
    <div className="border-t border-slate-800">
      <div className="px-6 py-4 bg-slate-800/40 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{detail.title}</h3>
          <p className="text-xs text-slate-500">
            {detail.messages.length} messages &middot; Started{" "}
            {new Date(detail.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onDelete(conversationId);
              onClose();
            }}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Delete conversation"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
        {detail.messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            createdAt={msg.created_at}
          />
        ))}
      </div>
    </div>
  );
}

export default function ConversationsBrowser() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      setConversations(await getAdminConversations(search || undefined));
    } catch {
      setError("Could not load conversations. Is the backend running?");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      // silently surface
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const truncateText = (text: string | null, maxLen = 80) => {
    if (!text) return "No messages";
    return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Conversations</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Browse and manage all chatbot conversations across all sessions.
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
          aria-label="Refresh conversations"
        >
          <RefreshCw size={16} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or session ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </form>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm overflow-hidden">
        {loading &&
          [1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}

        {!loading && !error && conversations.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <MessageSquare size={32} className="text-slate-700" />
              <p>No conversations found.</p>
              {search && (
                <p className="text-xs text-slate-600">Try a different search term.</p>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {!loading &&
            conversations.map((conv) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className={cn(
                    "border-b border-slate-800/50 px-6 py-4 hover:bg-slate-800/30 transition-colors cursor-pointer group",
                    expandedId === conv.id && "bg-slate-800/40"
                  )}
                  onClick={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {conv.title || "Untitled Conversation"}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30 shrink-0">
                          {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {truncateText(conv.last_question)}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(conv.updated_at)}
                        </span>
                        <span className="font-mono text-slate-700">
                          {conv.session_id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(conv.id);
                        }}
                        disabled={deletingId === conv.id}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                        aria-label={`Delete conversation ${conv.title}`}
                      >
                        {deletingId === conv.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                      {expandedId === conv.id ? (
                        <ChevronUp size={14} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-500" />
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === conv.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <ConversationDetailPanel
                        conversationId={conv.id}
                        onClose={() => setExpandedId(null)}
                        onDelete={handleDelete}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {!loading && conversations.length > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}
