"use client";

import { useState } from "react";
import {
  Download,
  MessageSquare,
  FileText,
  ClipboardList,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getExportUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type ExportType = "conversations" | "documents" | "chat-logs";

interface ExportOption {
  type: ExportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  filename: string;
}

const exportOptions: ExportOption[] = [
  {
    type: "conversations",
    title: "Conversations",
    description: "All conversations with full message history, session IDs, and timestamps.",
    icon: <MessageSquare size={20} className="text-blue-400" />,
    accent: "border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/5",
    filename: "conversations_export.csv",
  },
  {
    type: "documents",
    title: "Documents",
    description: "All uploaded documents with status, file types, and Gemini/Supabase references.",
    icon: <FileText size={20} className="text-emerald-400" />,
    accent: "border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5",
    filename: "documents_export.csv",
  },
  {
    type: "chat-logs",
    title: "Chat Logs",
    description: "Individual question-answer pairs with timestamps and conversation references.",
    icon: <ClipboardList size={20} className="text-purple-400" />,
    accent: "border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5",
    filename: "chat_logs_export.csv",
  },
];

export default function ExportPanel() {
  const [downloading, setDownloading] = useState<ExportType | null>(null);
  const [completed, setCompleted] = useState<Set<ExportType>>(new Set());

  const handleDownload = async (option: ExportOption) => {
    setDownloading(option.type);
    try {
      const url = getExportUrl(option.type);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = option.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setCompleted((prev) => new Set(prev).add(option.type));
      setTimeout(() => {
        setCompleted((prev) => {
          const next = new Set(prev);
          next.delete(option.type);
          return next;
        });
      }, 3000);
    } catch {
      // silently surface
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Export Data</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Download your chatbot data as CSV files for analysis or backup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exportOptions.map((option, i) => {
          const isDownloading = downloading === option.type;
          const isCompleted = completed.has(option.type);

          return (
            <motion.div
              key={option.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={cn(
                "relative bg-slate-900/60 border rounded-2xl p-6 transition-all duration-200",
                option.accent
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                  {option.icon}
                </div>
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-emerald-400"
                  >
                    <CheckCircle2 size={18} />
                  </motion.div>
                )}
              </div>

              <h3 className="text-base font-semibold text-white mb-1">
                {option.title}
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {option.description}
              </p>

              <button
                onClick={() => handleDownload(option)}
                disabled={isDownloading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  isCompleted
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700",
                  isDownloading && "opacity-70 cursor-not-allowed"
                )}
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Downloading…
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 size={14} />
                    Downloaded
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Download CSV
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Export Notes</h3>
        <ul className="text-xs text-slate-500 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>Conversations export includes all messages grouped by conversation with full Q&A history.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>Documents export includes metadata, storage references, and processing status.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>Chat logs export includes individual question-answer pairs with timestamps.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>All exports are in CSV format, compatible with Excel, Google Sheets, and data analysis tools.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
