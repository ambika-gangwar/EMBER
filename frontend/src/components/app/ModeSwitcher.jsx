import { useEffect } from "react";
import { motion } from "framer-motion";
import { PenTool, GraduationCap, Users2 } from "lucide-react";

export const MODES = [
  {
    id: "create",
    label: "Write",
    icon: PenTool,
    hotkey: "1",
    description: "Editor, thought synthesis & connections",
  },
  {
    id: "study",
    label: "Study",
    icon: GraduationCap,
    hotkey: "2",
    description: "Active-recall cards, practice quizzes & Socratic tutor",
  },
  {
    id: "collab",
    label: "Collaborate",
    icon: Users2,
    hotkey: "3",
    description: "Presence, inline comments & discussion synthesis",
  },
];

export default function ModeSwitcher({ currentMode, onModeChange, readerCount = 0 }) {
  // Global Keyboard Shortcuts (Cmd+1, Cmd+2, Cmd+3 or Alt+1, Alt+2, Alt+3)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if ((e.metaKey || e.ctrlKey || e.altKey) && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        if (e.key === "1") onModeChange("create");
        if (e.key === "2") onModeChange("study");
        if (e.key === "3") onModeChange("collab");
      } else if (!isInput && (e.key === "1" || e.key === "2" || e.key === "3")) {
        if (e.key === "1") onModeChange("create");
        if (e.key === "2") onModeChange("study");
        if (e.key === "3") onModeChange("collab");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onModeChange]);

  return (
    <div
      className="inline-flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border/60"
      data-testid="mode-switcher"
      role="tablist"
      aria-label="Workspace Mode"
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onModeChange(mode.id)}
            title={`${mode.label} (⌘${mode.hotkey})`}
            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors select-none ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`mode-tab-${mode.id}`}
          >
            {isActive && (
              <motion.div
                layoutId="mode-pill-bg"
                className="absolute inset-0 rounded-md bg-background shadow-xs border border-border/60"
                transition={{ duration: 0.15 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon size={12} className={isActive ? "text-foreground" : "opacity-60"} />
              <span>{mode.label}</span>
              {mode.id === "collab" && readerCount > 1 && (
                <span className="h-3.5 min-w-[14px] px-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-semibold flex items-center justify-center">
                  {readerCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
