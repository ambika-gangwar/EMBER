import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wand2,
  Sparkles,
  ScrollText,
  ListChecks,
  Lightbulb,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Quote,
  Code2,
  BookOpenCheck,
  ShieldAlert,
  Minus,
  Table,
  ListOrdered,
  List,
  Network,
  Share2,
  FileText,
  Palette,
} from "lucide-react";

const items = [
  // Ember Thinking Tools
  { key: "continue", label: "Continue writing", desc: "Let Ember seamlessly extend your line of thought", icon: Wand2, group: "Ember Thinking Tools" },
  { key: "improve", label: "Polish & refine", desc: "Sharpen prose, remove passive drag", icon: Sparkles, group: "Ember Thinking Tools" },
  { key: "expand", label: "Deep expand", desc: "Deconstruct mechanisms & concrete examples", icon: Wand2, group: "Ember Thinking Tools" },
  { key: "assumptions", label: "Challenge premises", desc: "Uncover unspoken assumptions & boundary risks", icon: ShieldAlert, group: "Ember Thinking Tools" },
  { key: "perspective", label: "Alternative perspective", desc: "Contrast with opposing mental models", icon: Sparkles, group: "Ember Thinking Tools" },
  { key: "missing", label: "Missing information", desc: "Identify critical omissions & blind spots", icon: Lightbulb, group: "Ember Thinking Tools" },
  { key: "research", label: "Research questions", desc: "Empirical vectors & testable hypotheses", icon: ScrollText, group: "Ember Thinking Tools" },
  { key: "counter", label: "Counter-arguments", desc: "Pressure-test with opposing arguments", icon: ShieldAlert, group: "Ember Thinking Tools" },
  { key: "actions", label: "Action items", desc: "Extract concrete checklist tasks", icon: ListChecks, group: "Ember Thinking Tools" },
  { key: "summarize", label: "Executive summary", desc: "Synthesize thesis & bottom line", icon: ScrollText, group: "Ember Thinking Tools" },
  { key: "keypoints", label: "Core insights", desc: "5-8 high-leverage realizations", icon: Lightbulb, group: "Ember Thinking Tools" },
  { key: "mindmap", label: "Mind Map", desc: "Interactive concept tree visualization", icon: Network, group: "Ember Thinking Tools" },
  { key: "whiteboard", label: "Whiteboard canvas", desc: "Touchscreen sketching, vector diagrams & sticky cards", icon: Palette, group: "Ember Thinking Tools" },
  { key: "study", label: "Study deck", desc: "Interactive flashcards & quiz", icon: BookOpenCheck, group: "Ember Thinking Tools" },
  { key: "pdf", label: "Import PDF", desc: "Parse PDF, extract synopsis & generate study deck", icon: FileText, group: "Ember Thinking Tools" },
  { key: "connections", label: "Connected Notes", desc: "Backlinks & knowledge graph links", icon: Share2, group: "Ember Thinking Tools" },

  // Structure & Blocks
  { key: "h1", label: "Heading 1", desc: "Top section header", icon: Heading1, group: "Basic Blocks" },
  { key: "h2", label: "Heading 2", desc: "Medium sub-section", icon: Heading2, group: "Basic Blocks" },
  { key: "h3", label: "Heading 3", desc: "Small section header", icon: Heading3, group: "Basic Blocks" },
  { key: "todo", label: "Interactive task", desc: "Checkbox checklist item", icon: CheckSquare, group: "Basic Blocks" },
  { key: "bullet", label: "Bulleted list", desc: "Simple bulleted item", icon: List, group: "Basic Blocks" },
  { key: "numbered", label: "Numbered list", desc: "Sequential ordered list", icon: ListOrdered, group: "Basic Blocks" },
  { key: "callout", label: "Callout box", desc: "Highlighted insight block", icon: Lightbulb, group: "Basic Blocks" },
  { key: "quote", label: "Quote block", desc: "Capture quotes and takeaways", icon: Quote, group: "Basic Blocks" },
  { key: "code", label: "Code snippet", desc: "Fenced monospaced code", icon: Code2, group: "Basic Blocks" },
  { key: "divider", label: "Divider line", desc: "Visual horizontal line", icon: Minus, group: "Basic Blocks" },
  { key: "table", label: "Table layout", desc: "Formatted 3-column table", icon: Table, group: "Basic Blocks" },
];

export default function SlashMenu({ pos, query, onPick, onClose }) {
  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.key.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q)
    );
  }, [query]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[active]) onPick(filtered[active].key);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, active, onPick, onClose]);

  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "fixed",
        left: Math.max(16, Math.min(window.innerWidth - 320, pos.x)),
        top: Math.max(70, Math.min(window.innerHeight - 360, pos.y)),
      }}
      className="z-50 w-[300px] rounded-2xl border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 max-h-[340px] overflow-y-auto"
      data-testid="slash-menu"
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
        <span>Commands</span>
        <span className="mono opacity-60">↑↓ to navigate · ↵ to insert</span>
      </div>

      <div className="space-y-0.5 mt-1">
        {filtered.map((it, i) => {
          const isSelected = i === active;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onPick(it.key)}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-3 text-xs transition-colors ${
                isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`slash-item-${it.key}`}
            >
              <div
                className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-foreground text-background border-transparent" : "bg-card text-foreground"
                }`}
              >
                <it.icon size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">{it.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{it.desc}</div>
              </div>
              {it.group === "Ember Thinking Tools" && (
                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  Ember
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
