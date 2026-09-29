import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Search, SlidersHorizontal } from "lucide-react";
import { getAISettings } from "@/lib/aiSettings";

export default function Topbar({
  onSearch,
  onToggleChat,
  onOpenAISettings,
  collaborators = [],
  readerCount = 1,
}) {
  const [aiSettings, setAiSettings] = useState(getAISettings());

  useEffect(() => {
    const handleUpdate = () => setAiSettings(getAISettings());
    window.addEventListener("san_ai_settings_changed", handleUpdate);
    return () => window.removeEventListener("san_ai_settings_changed", handleUpdate);
  }, []);

  const providerLabel = {
    gemini: "Gemini 2.0",
    anthropic: "Claude 3.5",
    openai: "GPT-4o",
    local: "Local Engine",
    auto: "Spark",
  }[aiSettings.provider] || "Spark";

  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60" data-testid="topbar">
      <div className="h-12 px-4 sm:px-8 flex items-center justify-between gap-3">
        {/* Universal Search trigger */}
        <button
          onClick={onSearch}
          className="inline-flex items-center gap-2 px-3 h-8 w-full max-w-xs rounded-lg border border-border/70 bg-secondary/40 hover:bg-secondary/70 text-xs text-muted-foreground transition-colors"
          data-testid="topbar-search-btn"
        >
          <Search size={13} className="opacity-60" />
          <span className="flex-1 text-left font-normal truncate">Search workspace...</span>
          <kbd className="text-[10px] font-mono opacity-50 px-1 py-0.2 rounded bg-background border border-border/60">⌘K</kbd>
        </button>

        <div className="flex items-center gap-2">
          {/* Real-time Collaboration Avatars */}
          {collaborators.length > 0 && (
            <div className="flex items-center gap-1.5 mr-1" data-testid="collab-avatars">
              <div className="flex -space-x-1.5">
                {collaborators.map((c, i) => (
                  <motion.div
                    key={c.user_id || i}
                    title={`${c.name || "Collaborator"} is viewing`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-5 w-5 rounded-full border border-background flex items-center justify-center text-[9px] font-semibold text-white shadow-xs"
                    style={{ backgroundColor: c.color || "#8B5CF6" }}
                  >
                    {(c.name || "U")[0].toUpperCase()}
                  </motion.div>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {readerCount}
              </span>
            </div>
          )}

          {/* AI Settings Trigger */}
          {onOpenAISettings && (
            <button
              type="button"
              onClick={onOpenAISettings}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={`Engine: ${providerLabel}. Click to configure.`}
              data-testid="topbar-ai-settings-btn"
            >
              <SlidersHorizontal size={13} />
            </button>
          )}

          {/* Spark AI Drawer Trigger (Quiet & Integrated) */}
          <button
            onClick={onToggleChat}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-secondary hover:bg-muted text-foreground text-xs font-medium transition-colors border border-border/60"
            title="Open Spark AI (⌘J)"
            data-testid="topbar-chat-toggle-btn"
          >
            <Sparkles size={12} className="text-accent" />
            <span>Spark</span>
            <kbd className="text-[10px] font-mono opacity-40 ml-0.5">⌘J</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
