/**
 * components/StepCard.tsx — Renders a single agent reasoning step.
 */
"use client";

import { AgentStep } from "@/lib/api";

interface Props {
  step: AgentStep;
  index: number;
}

const CONFIG: Record<
  AgentStep["type"],
  { label: string; icon: string; badgeBg: string; badgeText: string; cardBorder: string; cardBg: string }
> = {
  thought: {
    label: "Thinking",
    icon: "🧠",
    badgeBg: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    badgeText: "text-blue-300",
    cardBorder: "border-blue-500/20",
    cardBg: "bg-blue-950/20",
  },
  action: {
    label: "Tool Call",
    icon: "⚙️",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    badgeText: "text-amber-300",
    cardBorder: "border-amber-500/20",
    cardBg: "bg-amber-950/20",
  },
  observation: {
    label: "Observation",
    icon: "📊",
    badgeBg: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    badgeText: "text-slate-300",
    cardBorder: "border-white/10",
    cardBg: "bg-black/40",
  },
  answer: {
    label: "Final Answer",
    icon: "✨",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    badgeText: "text-emerald-300",
    cardBorder: "border-emerald-500/30",
    cardBg: "bg-emerald-950/20",
  },
  error: {
    label: "Error",
    icon: "⚠️",
    badgeBg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    badgeText: "text-rose-300",
    cardBorder: "border-rose-500/30",
    cardBg: "bg-rose-950/20",
  },
  done: {
    label: "Done",
    icon: "✓",
    badgeBg: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    badgeText: "text-slate-400",
    cardBorder: "border-white/10",
    cardBg: "bg-black/30",
  },
};

export function StepCard({ step, index }: Props) {
  const cfg = CONFIG[step.type] ?? CONFIG.thought;
  const isObservation = step.type === "observation";

  // Try to pretty-print JSON observations
  let displayContent = step.content;
  if (isObservation) {
    try {
      const parsed = JSON.parse(step.content);
      displayContent = JSON.stringify(parsed, null, 2);
    } catch {
      // not JSON, show as-is
    }
  }

  return (
    <div
      className={`rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} backdrop-blur-xl p-4 sm:p-5 shadow-xl animate-fade-in transition-all`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Header badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${cfg.badgeBg}`}>
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </span>
      </div>

      {/* Content */}
      {isObservation || step.type === "action" ? (
        <pre className="text-xs sm:text-sm font-mono whitespace-pre-wrap break-words text-zinc-200 bg-black/50 border border-white/5 rounded-xl p-3 leading-relaxed overflow-x-auto">
          {displayContent}
        </pre>
      ) : (
        <div className="text-sm sm:text-base text-zinc-100 leading-relaxed whitespace-pre-wrap font-normal">
          {displayContent}
        </div>
      )}
    </div>
  );
}
