"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { queryChat, type ChatHistoryItem } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "What are the school admission requirements?",
  "How can I apply for financial aid or scholarships?",
  "What documents do I need for enrollment?",
  "When are the key academic calendar deadlines?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I am the Veritas chatbot. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function submitMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const trimmedContent = content.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history: ChatHistoryItem[] = messages
        .slice(-8)
        .map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        }));
      const data = await queryChat(userMessage.content, history);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "I received a response, but it was empty.",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I am having trouble connecting to the server. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  const handleSuggestedQuestion = async (question: string) => {
    await submitMessage(question);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-amber-100 bg-gradient-to-b from-white via-amber-50/30 to-cyan-50/30 shadow-2xl shadow-cyan-900/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/90 to-transparent" />

      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4 sm:px-5 sm:pt-5">
        <section className="mb-4 rounded-2xl border border-cyan-100 bg-white/80 p-3 shadow-sm backdrop-blur sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
            Suggested Questions
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((question, index) => (
              <motion.button
                key={question}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.06 }}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  void handleSuggestedQuestion(question);
                }}
                className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {question}
              </motion.button>
            ))}
          </div>
        </section>

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "mb-4 flex w-full",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "flex max-w-[94%] gap-2 sm:max-w-[82%] sm:gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div
                  className={cn(
                    "mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-cyan-600 text-white shadow-md"
                      : "bg-amber-500 text-white shadow-md ring-2 ring-amber-500/20",
                  )}
                >
                  {message.role === "user" ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>

                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:text-[15px]",
                    message.role === "user"
                      ? "rounded-tr-sm bg-cyan-600 text-white"
                      : "rounded-tl-sm border border-amber-100 bg-white text-slate-800",
                  )}
                >
                  <p className="whitespace-pre-wrap format-text">
                    {message.content}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 flex w-full justify-start"
            >
              <div className="flex max-w-[94%] gap-2 sm:max-w-[82%] sm:gap-3">
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md ring-2 ring-amber-500/20">
                  <Bot size={16} />
                </div>
                <div className="flex items-center rounded-2xl rounded-tl-sm border border-amber-100 bg-white px-5 py-4 shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  <span className="ml-3 text-sm font-medium text-slate-500">
                    Veritas is typing...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="border-t border-amber-100 bg-white/90 p-3 backdrop-blur-md sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="relative mx-auto flex max-w-4xl items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Veritas a question..."
            disabled={isLoading}
            className="w-full rounded-full border border-amber-200 bg-amber-50/60 py-3 pl-4 pr-14 text-[15px] text-slate-800 shadow-sm transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4 sm:pl-5"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 rounded-full bg-cyan-600 p-2.5 text-white transition-colors hover:bg-cyan-700 disabled:bg-slate-200 disabled:text-slate-400 sm:right-2"
          >
            <Send size={18} className={cn(isLoading && "opacity-0")} />
            {isLoading && (
              <Loader2
                size={18}
                className="absolute inset-0 m-auto animate-spin"
              />
            )}
            <span className="sr-only">Send message</span>
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-xs text-slate-400">
            Veritas uses AI and may occasionally generate incorrect information.
          </p>
        </div>
      </div>
    </div>
  );
}
