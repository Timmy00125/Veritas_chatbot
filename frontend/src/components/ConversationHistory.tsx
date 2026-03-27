"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Clock, MessageSquare, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getConversations,
  deleteConversation,
  getConversation,
  type Conversation,
  type ConversationDetail,
} from "@/lib/api";

interface ConversationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSelectConversation: (conversation: ConversationDetail) => void;
  onNewChat: () => void;
}

export default function ConversationHistory({
  isOpen,
  onClose,
  sessionId,
  onSelectConversation,
  onNewChat,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadConversations();
    }
  }, [isOpen, sessionId]);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const data = await getConversations(sessionId);
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectConversation(id: number) {
    setLoadingId(id);
    try {
      const data = await getConversation(id);
      onSelectConversation(data);
      onClose();
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(id);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-100/20 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Clock size={20} className="text-amber-400" />
                Conversation History
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/50 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                <MessageSquare size={18} />
                Start New Chat
              </button>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500">
                    No conversations yet. Start chatting to see your history here.
                  </p>
                </div>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={cn(
                        "group relative flex cursor-pointer items-start justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:border-slate-600 hover:bg-slate-800",
                        loadingId === conversation.id && "opacity-70"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate pr-8 text-sm font-medium text-white">
                          {conversation.title}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatDate(conversation.updated_at)}</span>
                          <span>{conversation.message_count} messages</span>
                        </div>
                      </div>

                      {loadingId === conversation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : (
                        <button
                          onClick={(e) => handleDelete(conversation.id, e)}
                          disabled={deletingId === conversation.id}
                          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {deletingId === conversation.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
