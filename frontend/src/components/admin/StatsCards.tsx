"use client";

import { useState, useEffect } from "react";
import { MessageSquare, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { getStats, type Stats } from "@/lib/api";
import { motion } from "framer-motion";

function SkeletonCard() {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="h-4 w-24 bg-slate-800 rounded animate-pulse mb-4" />
      <div className="h-10 w-16 bg-slate-800 rounded animate-pulse mb-2" />
      <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  index: number;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  index,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl overflow-hidden group hover:border-slate-700 transition-colors duration-200"
    >
      {/* Glow blob */}
      <div
        className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-10 ${accent}`}
      />

      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-10`}
        >
          {icon}
        </div>
      </div>

      <p className="text-4xl font-black text-white mb-1 tabular-nums">
        {value}
      </p>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </motion.div>
  );
}

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStats(await getStats());
      } catch {
        setError("Could not load statistics. Is the backend running?");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    {
      title: "Total Questions",
      value: stats?.total_questions ?? 0,
      subtitle: "Questions asked across all sessions",
      icon: <MessageSquare size={18} className="text-blue-400" />,
      accent: "bg-blue-500",
    },
    {
      title: "Engagement Rate",
      value: stats && stats.total_questions > 0 ? "Active" : "No data",
      subtitle: "Based on conversation volume",
      icon: <TrendingUp size={18} className="text-emerald-400" />,
      accent: "bg-emerald-500",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Usage Statistics</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Insights into how the Veritas chatbot is being used.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {cards.map((card, i) => (
            <StatCard key={card.title} {...card} index={i} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <p className="text-xs text-slate-600 mt-6 flex items-center gap-1">
          <Loader2 size={11} /> Data is live from the database — refresh the
          page to update.
        </p>
      )}
    </div>
  );
}
