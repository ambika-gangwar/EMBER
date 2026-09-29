import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bold,
  Italic,
  Code,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  List,
  CheckCheck,
  ChevronDown,
  Loader2,
  Zap,
} from "lucide-react";

const AI_OPTIONS = [
  { key: "improve", label: "Polish & clarify", desc: "Sharpen prose without fluff" },
  { key: "expand", label: "Deep expand", desc: "Mechanisms, nuances & real examples" },
  { key: "assumptions", label: "Challenge premises", desc: "Uncover unspoken fragile assumptions" },
  { key: "perspective", label: "Alternative perspective", desc: "Contrast with opposing mental models" },
  { key: "missing", label: "Missing information", desc: "Identify critical omissions & blind spots" },
  { key: "research", label: "Research vectors", desc: "Formulate empirical probes & vectors" },
  { key: "counter", label: "Counter-arguments", desc: "Pressure test with critical blind spots" },
  { key: "summarize", label: "Summarize", desc: "Compress into high-signal takeaway" },
  { key: "bullets", label: "Convert to bullets", desc: "Break into structured bullet points" },
  { key: "actions", label: "Extract action items", desc: "Turn into checklist tasks" },
];

export default function SelectionToolbar({ pos, selectedText, onFormat, onAITransform, busy }) {
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  if (!pos || !selectedText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "fixed",
        left: Math.max(16, Math.min(window.innerWidth - 380, pos.x)),
        top: Math.max(70, pos.y - 48),
      }}
      className="z-50 flex items-center gap-0.5 p-1 rounded-full border bg-background/95 backdrop-blur-md shadow-2xl text-foreground text-xs"
      data-testid="selection-toolbar"
    >
      {/* AI Quick Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAiMenuOpen((v) => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-foreground/10 hover:bg-foreground/15 text-foreground font-medium transition-colors"
          data-testid="selection-ai-dropdown"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-amber-500" />}
          <span>Ask Ember</span>
          <ChevronDown size={10} className="opacity-60" />
        </button>

        <AnimatePresence>
          {aiMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border bg-popover shadow-xl p-1 z-50"
            >
              {AI_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setAiMenuOpen(false);
                    onAITransform(opt.key);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted flex flex-col transition-colors text-xs"
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Formatting Tools */}
      <button
        type="button"
        onClick={() => onFormat("bold")}
        title="Bold (Ctrl+B)"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-semibold"
      >
        <Bold size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFormat("italic")}
        title="Italic (Ctrl+I)"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors italic"
      >
        <Italic size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFormat("code")}
        title="Inline Code"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFormat("strike")}
        title="Strikethrough"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Strikethrough size={13} />
      </button>

      <div className="h-4 w-px bg-border mx-0.5" />

      <button
        type="button"
        onClick={() => onFormat("h2")}
        title="Heading 2"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Heading2 size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFormat("quote")}
        title="Blockquote"
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Quote size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFormat("callout")}
        title="Insight Callout"
        className="h-7 px-2 inline-flex items-center gap-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px]"
      >
        <span>💡 Callout</span>
      </button>
    </motion.div>
  );
}
