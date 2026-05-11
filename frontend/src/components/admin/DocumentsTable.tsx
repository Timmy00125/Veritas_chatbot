"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Trash2,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  X,
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
type StatusFilter = "ALL" | "ACTIVE" | "PROCESSING" | "FAILED";

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

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

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

  // Get unique file types for filter
  const fileTypes = useMemo(() => {
    const types = new Set(documents.map((d) => d.mime_type.split("/").pop()?.toUpperCase() ?? "Unknown"));
    return ["ALL", ...Array.from(types).sort()];
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (!doc.filename.toLowerCase().includes(searchLower)) return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && doc.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== "ALL") {
        const docType = doc.mime_type.split("/").pop()?.toUpperCase() ?? "Unknown";
        if (docType !== typeFilter) return false;
      }
      return true;
    });
  }, [documents, search, statusFilter, typeFilter]);

  const activeFiltersCount = [statusFilter !== "ALL", typeFilter !== "ALL", search !== ""].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: documents.length },
    { value: "ACTIVE", label: "Active", count: documents.filter((d) => d.status === "ACTIVE").length },
    { value: "PROCESSING", label: "Processing", count: documents.filter((d) => d.status === "PROCESSING").length },
    { value: "FAILED", label: "Failed", count: documents.filter((d) => d.status === "FAILED").length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Management</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Upload and manage files ingested into the RAG pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
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

      {/* Search & Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder-slate-600 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
              showFilters || activeFiltersCount > 0
                ? "border-blue-500/40 bg-blue-600/20 text-blue-300"
                : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
            )}
          >
            <Filter size={14} />
            Filters
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/30 text-xs">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                {/* Status Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          statusFilter === opt.value
                            ? "border-blue-500/40 bg-blue-600/20 text-blue-300"
                            : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                        )}
                      >
                        {opt.label}
                        <span className="ml-1.5 text-slate-500">{opt.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">File Type</label>
                  <div className="flex flex-wrap gap-2">
                    {fileTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          typeFilter === type
                            ? "border-blue-500/40 bg-blue-600/20 text-blue-300"
                            : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    <X size={12} />
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results count */}
      {(search || activeFiltersCount > 0) && !loading && (
        <p className="text-xs text-slate-500 mb-3">
          Showing {filteredDocuments.length} of {documents.length} documents
        </p>
      )}

      {/* Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-sm md:block">
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

            {!loading && !error && filteredDocuments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <FileText size={32} className="text-slate-700" />
                    <p>{search || activeFiltersCount > 0 ? "No documents match your filters." : "No documents uploaded yet."}</p>
                    {search || activeFiltersCount > 0 ? (
                      <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300">
                        Clear filters
                      </button>
                    ) : (
                      <p className="text-xs text-slate-600">
                        Click &quot;Upload File&quot; to add a PDF, TXT, or DOCX.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            <AnimatePresence>
              {!loading &&
                filteredDocuments.map((doc) => (
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
                        {doc.supabase_file_url ? (
                          <a
                            href={doc.supabase_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-medium truncate max-w-60 hover:underline"
                            title={`Download ${doc.filename}`}
                          >
                            {doc.filename}
                          </a>
                        ) : (
                          <span
                            className="text-slate-200 font-medium truncate max-w-60"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        )}
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

      <div className="space-y-3 md:hidden">
        {loading &&
          [1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
              <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-slate-800" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-800" />
            </div>
          ))}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-5 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && filteredDocuments.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-slate-400">
            {search || activeFiltersCount > 0 ? "No documents match your filters." : "No documents uploaded yet."}
          </div>
        )}

        {!loading &&
          !error &&
          filteredDocuments.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium text-slate-100"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc.mime_type.split("/").pop()?.toUpperCase()} •{" "}
                    {formatDate(doc.created_at)}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  id={`delete-document-${doc.id}-btn-mobile`}
                  aria-label={`Delete ${doc.filename}`}
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                >
                  {deletingId === doc.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
      </div>

      {!loading && documents.length > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          {filteredDocuments.length === documents.length
            ? `${documents.length} document${documents.length !== 1 ? "s" : ""} total`
            : `${filteredDocuments.length} of ${documents.length} documents`}
        </p>
      )}
    </div>
  );
}
