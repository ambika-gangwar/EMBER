import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, X, Check, Loader2, Wand2, ShieldAlert, ListChecks, FileText, Lightbulb, CornerDownLeft } from "lucide-react";
import { streamAI, getAISettings } from "@/lib/aiSettings";
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

  const quickChips = [
    { label: "Continue writing", prompt: "Continue writing seamlessly in the voice and thesis of this note." },
    { label: "Challenge premises", prompt: "Uncover 3-4 foundational unspoken assumptions and boundary conditions in this note." },
    { label: "Alternative perspective", prompt: "Re-frame this topic through contrasting paradigms: First Principles, Systems Ecology, and Pragmatic Implementation." },
    { label: "Missing context", prompt: "Identify 3-4 critical pieces of missing information, unaddressed variables, or overlooked edge cases." },
    { label: "Research questions", prompt: "Generate 4-5 high-yield empirical research questions to deepen this document." },
    { label: "Counter-arguments", prompt: "Provide 3-4 constructive counter-perspectives and blind spots for these ideas." },
    { label: "Action items", prompt: "Extract concrete, high-leverage action items as an interactive checklist." },
  ];

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
      onError: (err) => {
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
    toast.success("Accepted into note");
  };

  const handleDiscard = () => {
    setStreamedResult("");
    setPrompt("");
    setOpen(false);
  };

  return (
    <div className="mb-4">
      {/* Collapsed Bar / Prompt Input */}
      {!open && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border bg-card/60 backdrop-blur-sm text-xs">
          <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-background/80 rounded-xl border border-transparent focus-within:border-foreground/30 transition-all min-w-[240px]">
            <Sparkles size={14} className="text-amber-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleStartStream();
                }
              }}
              placeholder="Ask Ember to draft, challenge assumptions, reframe, or expand..."
              className="w-full bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground"
              data-testid="inline-copilot-input"
            />
            {prompt && (
              <button
                type="button"
                onClick={() => handleStartStream()}
                className="h-6 w-6 rounded-full bg-foreground text-background inline-flex items-center justify-center shrink-0"
                title="Execute (Enter)"
              >
                <CornerDownLeft size={11} />
              </button>
            )}
          </div>

          {/* Quick Action Chips */}
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
            {quickChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleStartStream(chip.prompt)}
                className="px-2.5 py-1 rounded-full text-[11px] border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Streaming Canvas */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-2xl border-2 border-foreground/20 bg-card shadow-lg space-y-3"
            data-testid="inline-copilot-streaming-box"
          >
            <div className="flex items-center justify-between text-xs pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-foreground text-background flex items-center justify-center">
                  <Sparkles size={12} className="text-amber-400" />
                </div>
                <span className="font-semibold" style={{ fontFamily: "Outfit" }}>
                  Ember Copilot
                </span>
                {streaming && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-2">
                    <Loader2 size={11} className="animate-spin" /> thinking...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Discard"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Streamed text content */}
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto font-normal font-sans py-1">
              {streamedResult || (
                <span className="text-muted-foreground italic flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> Analyzing note context...
                </span>
              )}
              {streaming && <span className="inline-block w-1.5 h-4 bg-foreground ml-1 animate-pulse" />}
            </div>

            {/* Action Bar */}
            {!streaming && streamedResult && (
              <div className="pt-3 border-t flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Ready to insert into your note
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-3 py-1.5 rounded-lg text-xs hover:bg-muted text-muted-foreground"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-foreground text-background inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity"
                    data-testid="copilot-accept-btn"
                  >
                    <Check size={13} /> {selectedText ? "Replace selection" : "Insert below"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
