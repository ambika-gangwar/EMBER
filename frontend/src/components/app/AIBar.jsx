import { Sparkles, Wand2, ListChecks, FileText, Lightbulb, ScrollText } from "lucide-react";

const actions = [
  { key: "continue", label: "Continue", icon: Wand2 },
  { key: "improve", label: "Improve", icon: Sparkles },
  { key: "summarize", label: "Summarize", icon: ScrollText },
  { key: "bullets", label: "Bulletify", icon: ListChecks },
  { key: "keypoints", label: "Key points", icon: Lightbulb },
];

export default function AIBar({ onAction, busy }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <button key={a.key} onClick={() => onAction(a.key)} disabled={busy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs border bg-card hover:bg-muted disabled:opacity-50 transition-colors"
          data-testid={`ai-${a.key}-btn`}>
          <a.icon size={13} className="opacity-80"/> {a.label}
        </button>
      ))}
      <span className="ai-chip ml-1">
        <span className="pulse-dot"/> Claude Sonnet 4.5
      </span>
    </div>
  );
}
