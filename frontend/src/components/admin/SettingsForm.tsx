"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import { getSettings, updateSettings, type Settings } from "@/lib/api";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "success" | "error";

const DEFAULT_PROMPT = "";
const DEFAULT_STRICTNESS = 0.5;

export default function SettingsForm() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [strictness, setStrictness] = useState(DEFAULT_STRICTNESS);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setOriginal(s);
        setSystemPrompt(s.system_prompt ?? "");
        setStrictness(s.strictness ?? DEFAULT_STRICTNESS);
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty =
    original !== null &&
    (systemPrompt !== (original.system_prompt ?? "") ||
      strictness !== (original.strictness ?? DEFAULT_STRICTNESS));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState("saving");
    setSaveError(null);
    try {
      const updated = await updateSettings({ system_prompt: systemPrompt, strictness });
      setOriginal(updated);
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 4000);
    }
  };

  const strictnessLabel = (v: number) => {
    if (v < 0.3) return "Creative";
    if (v < 0.6) return "Balanced";
    if (v < 0.85) return "Strict";
    return "Very Strict";
  };

  const strictnessDescription = (v: number) => {
    if (v < 0.3) return "The bot will be more creative and exploratory in its answers.";
    if (v < 0.6) return "A balance of accuracy and natural conversation.";
    if (v < 0.85) return "Answers stay closely grounded in retrieved documents.";
    return "The bot will only respond with information directly found in documents.";
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Configure how the Veritas chatbot behaves.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[80, 32, 48].map((h, i) => (
            <div
              key={i}
              className={`h-${h === 80 ? "40" : h === 32 ? "10" : "12"} bg-slate-800 rounded-xl animate-pulse`}
              style={{ height: h * 2 }}
            />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* System Prompt */}
          <div className="space-y-3">
            <label htmlFor="system-prompt" className="block text-sm font-semibold text-slate-200">
              System Prompt
            </label>
            <p className="text-xs text-slate-500 -mt-1">
              This message is prepended to every conversation to guide the chatbot&apos;s behavior.
            </p>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              placeholder="e.g. You are a helpful school assistant. Only answer questions about school-related topics…"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-600 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all leading-relaxed"
            />
          </div>

          {/* Strictness */}
          <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="strictness-slider" className="text-sm font-semibold text-slate-200 block">
                  Response Strictness
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controls how closely the bot sticks to source documents.
                </p>
              </div>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border",
                  strictness < 0.3
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : strictness < 0.6
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : strictness < 0.85
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                {strictnessLabel(strictness)}
              </span>
            </div>

            <input
              id="strictness-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={strictness}
              onChange={(e) => setStrictness(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500 bg-slate-700"
            />

            <div className="flex justify-between text-xs text-slate-600 select-none">
              <span>0.0 — Creative</span>
              <span className="font-mono text-slate-400">{strictness.toFixed(2)}</span>
              <span>1.0 — Very Strict</span>
            </div>

            <div className="flex items-start gap-2 bg-slate-800/50 rounded-xl px-4 py-3 text-xs text-slate-400">
              <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
              {strictnessDescription(strictness)}
            </div>
          </div>

          {/* Save feedback */}
          {saveState === "success" && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={15} /> Settings saved successfully.
            </div>
          )}
          {saveState === "error" && saveError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} /> {saveError}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {isDirty && saveState === "idle" && (
              <p className="text-xs text-slate-500 mr-auto">You have unsaved changes.</p>
            )}
            <button
              id="save-settings-btn"
              type="submit"
              disabled={saveState === "saving" || (!isDirty && saveState !== "error")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                saveState === "saving"
                  ? "bg-blue-700 text-white opacity-70 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
              )}
            >
              {saveState === "saving" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {saveState === "saving" ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
