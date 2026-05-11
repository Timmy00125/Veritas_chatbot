"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  AlertCircle,
  Loader2,
  FileText,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react";
import { getStats, type Stats, type TopicCount, type DayCount } from "@/lib/api";
import { cn } from "@/lib/utils";
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

function StatCard({ title, value, subtitle, icon, accent, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 shadow-xl overflow-hidden group hover:border-slate-700 transition-colors duration-200"
    >
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-10 ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", accent, "bg-opacity-10")}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black text-white mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </motion.div>
  );
}

function BarChart({ data, maxBars = 14 }: { data: DayCount[]; maxBars?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        No activity data yet
      </div>
    );
  }

  const sliced = data.slice(-maxBars);
  const maxCount = Math.max(...sliced.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-48">
      {sliced.map((day, i) => {
        const height = Math.max((day.count / maxCount) * 100, 4);
        const dateLabel = new Date(day.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        });
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex justify-center">
              <div className="absolute -top-6 hidden group-hover:block bg-slate-700 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                {day.count} questions
              </div>
            </div>
            <div className="w-full flex items-end" style={{ height: "160px" }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md hover:from-blue-500 hover:to-blue-300 transition-colors cursor-pointer min-h-[4px]"
              />
            </div>
            <span className="text-[10px] text-slate-600 w-full text-center truncate">
              {i % 2 === 0 ? dateLabel : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopicsChart({ topics }: { topics: TopicCount[] }) {
  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        No topic data yet
      </div>
    );
  }

  const maxCount = Math.max(...topics.map((t) => t.count), 1);
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-lime-500",
  ];

  return (
    <div className="space-y-3">
      {topics.map((topic, i) => (
        <div key={topic.topic} className="flex items-center gap-3">
          <div className="w-24 text-xs text-slate-400 text-right truncate" title={topic.topic}>
            {topic.topic}
          </div>
          <div className="flex-1 h-7 bg-slate-800/50 rounded-lg overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(topic.count / maxCount) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={cn("h-full rounded-lg flex items-center justify-end pr-2", colors[i % colors.length])}
            >
              <span className="text-xs font-bold text-white">{topic.count}</span>
            </motion.div>
          </div>
        </div>
      ))}
    </div>
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

  const mainCards: StatCardProps[] = [
    {
      title: "Total Questions",
      value: stats?.total_questions ?? 0,
      subtitle: "Questions asked across all sessions",
      icon: <MessageSquare size={17} className="text-blue-400" />,
      accent: "bg-blue-500",
      index: 0,
    },
    {
      title: "Conversations",
      value: stats?.total_conversations ?? 0,
      subtitle: `Avg ${stats?.avg_messages_per_conversation ?? 0} messages each`,
      icon: <Users size={17} className="text-emerald-400" />,
      accent: "bg-emerald-500",
      index: 1,
    },
    {
      title: "Documents",
      value: stats?.total_documents ?? 0,
      subtitle: `${stats?.active_documents ?? 0} active, ${stats?.failed_documents ?? 0} failed`,
      icon: <FileText size={17} className="text-purple-400" />,
      accent: "bg-purple-500",
      index: 2,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
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

      {/* Main Stats */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {mainCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      )}

      {/* Document Status */}
      {!loading && stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active_documents}</p>
              <p className="text-sm text-slate-400">Active Documents</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <XCircle size={18} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.failed_documents}</p>
              <p className="text-sm text-slate-400">Failed Documents</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Charts */}
      {!loading && stats && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Questions Over Time */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Questions Over Time</h2>
              <span className="text-xs text-slate-500 ml-auto">Last 30 days</span>
            </div>
            <BarChart data={stats.questions_per_day} />
          </motion.div>

          {/* Top Topics */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Hash size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Top Topics</h2>
              <span className="text-xs text-slate-500 ml-auto">Most mentioned keywords</span>
            </div>
            <TopicsChart topics={stats.top_topics} />
          </motion.div>
        </div>
      )}

      {!loading && !error && (
        <p className="text-xs text-slate-600 mt-6 flex items-center gap-1">
          <Loader2 size={11} /> Data is live from the database — refresh the page to update.
        </p>
      )}
    </div>
  );
}
