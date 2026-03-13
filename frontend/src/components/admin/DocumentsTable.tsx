"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Trash2,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  type Document,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type UploadState = "idle" | "uploading" | "success" | "error";

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    PROCESSING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={cn(
        "px-2.5 py-0.5 rounded-full text-xs font-medium border",
        colours[status] ?? "bg-slate-700/50 text-slate-400 border-slate-600/30",
      )}
    >
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function DocumentsTable() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      setDocuments(await getDocuments());
    } catch {
      setError("Could not load documents. Is the backend running?");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const hasProcessingDocuments = documents.some(
      (doc) => doc.status === "PROCESSING",
    );
    if (!hasProcessingDocuments) return;

    const intervalId = window.setInterval(() => {
      void load(true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [documents, load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadState("uploading");
    setUploadError(null);
    try {
      await uploadDocument(file);
      setUploadState("success");
      await load();
      setTimeout(() => setUploadState("idle"), 2500);
    } catch (err) {
      setUploadState("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setUploadState("idle"), 4000);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
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
    });

  const uploadIcon = {
    idle: <Upload size={15} />,
    uploading: <Loader2 size={15} className="animate-spin" />,
    success: <CheckCircle2 size={15} />,
    error: <AlertCircle size={15} />,
  }[uploadState];

  const uploadLabel = {
    idle: "Upload File",
    uploading: "Uploading…",
    success: "Uploaded!",
    error: "Failed",
  }[uploadState];

  const uploadClasses = cn(
    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
    uploadState === "success" && "bg-emerald-600 text-white",
    uploadState === "error" && "bg-red-600 text-white",
    (uploadState === "idle" || uploadState === "uploading") &&
      "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 disabled:cursor-not-allowed",
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Management</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Upload and manage files ingested into the RAG pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="refresh-documents-btn"
            onClick={() => {
              void load();
            }}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
            aria-label="Refresh documents"
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin")} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleUpload}
            id="document-upload-input"
            aria-label="Upload document file"
          />
          <button
            id="upload-document-btn"
            className={uploadClasses}
            disabled={uploadState === "uploading"}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadIcon}
            {uploadLabel}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {uploadError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 backdrop-blur-sm shadow-xl">
        <table className="w-full text-sm" id="documents-table">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 text-left uppercase text-xs tracking-wider">
              <th className="px-6 py-4 font-medium">File</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Uploaded</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && [1, 2, 3].map((i) => <SkeletonRow key={i} />)}

            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <AlertCircle size={24} className="text-red-400" />
                    <p className="text-red-400">{error}</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <FileText size={32} className="text-slate-700" />
                    <p>No documents uploaded yet.</p>
                    <p className="text-xs text-slate-600">
                      Click &quot;Upload File&quot; to add a PDF, TXT, or DOCX.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            <AnimatePresence>
              {!loading &&
                documents.map((doc) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-blue-400" />
                        </div>
                        <span
                          className="text-slate-200 font-medium truncate max-w-60"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                      {doc.mime_type.split("/").pop()?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        id={`delete-document-${doc.id}-btn`}
                        aria-label={`Delete ${doc.filename}`}
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 disabled:opacity-40 opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {!loading && documents.length > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          {documents.length} document{documents.length !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}
