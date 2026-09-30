import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, Loader2, CornerDownLeft } from "lucide-react";
import { streamAI } from "@/lib/aiSettings";
import { toast } from "sonner";

export default function InlineCopilot({
  noteId,
  noteTitle,
  noteContent,
  selectedText,
  mode = "create",
  onInsertText,
  onReplaceSelection,
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedResult, setStreamedResult] = useState("");
  const inputRef = useRef(null);

  // Listen for custom trigger event if needed
  useEffect(() => {
    const handleTrigger = (e) => {
      setOpen(true);
      if (e.detail?.prompt) {
        handleStartStream(e.detail.prompt);
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener("ember_inline_copilot_trigger", handleTrigger);
    return () => window.removeEventListener("ember_inline_copilot_trigger", handleTrigger);
  }, [noteContent, noteTitle]);

  const handleStartStream = async (customPrompt) => {
    const textToRun = (customPrompt || prompt).trim();
    if (!textToRun || streaming) return;

    setStreaming(true);
    setStreamedResult("");
    setOpen(true);

    await streamAI({
      prompt: textToRun,
      noteId,
      noteTitle,
      noteContext: noteContent,
      selectedText: selectedText || "",
      mode,
      onToken: (tok, acc) => {
        setStreamedResult(acc);
      },
      onDone: (final) => {
        setStreaming(false);
        setStreamedResult(final);
      },
      onError: () => {
        setStreaming(false);
        toast.error("Generation interrupted");
      },
    });
  };

  const handleAccept = () => {
    if (!streamedResult) return;
    if (selectedText) {
      onReplaceSelection(streamedResult);
    } else {
      onInsertText(`\n\n${streamedResult}\n`);
    }
    setStreamedResult("");
    setPrompt("");
    setOpen(false);
  };

  const handleDiscard = () => {
    setStreamedResult("");
    setPrompt("");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -6, height: 0 }}
        className="my-3 overflow-hidden"
      >
        <div className="p-3 rounded-xl border border-border/80 bg-card shadow-float">
          {/* Input Header */}
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-accent shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStartStream();
                } else if (e.key === "Escape") {
                  handleDiscard();
                }
              }}
              placeholder="What would you like to explore or synthesize? (Press Enter)"
              className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground/40"
              data-testid="inline-copilot-input"
            />
            {streaming && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            <button
              onClick={handleDiscard}
              className="h-5 w-5 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Streamed Result Box */}
          {streamedResult && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {streamedResult}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={handleDiscard}
                  className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleAccept}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
                >
                  <Check size={12} />
                  <span>Accept</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
