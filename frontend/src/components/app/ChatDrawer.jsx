import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  CornerDownLeft,
  FileText,
  ShieldAlert,
  ListChecks,
  ScrollText,
  Lightbulb,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { streamAI, getAISettings } from "@/lib/aiSettings";

export default function ChatDrawer({ note, selectedText, onInsertText, onClose, mode = "create" }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I'm Ember, a spark that helps ideas grow. I analyze your notes, challenge premises, spot blind spots, explore alternative perspectives, and help you think with depth and clarity. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const scrollRef = useRef(null);

  const suggestedPrompts = [
    { label: "Challenge premises", text: "What foundational premises in this note could be false or fragile?" },
    { label: "Alternative perspective", text: "How would a first-principles practitioner or an adversary analyze this?" },
    { label: "Missing context", text: "What critical questions or variables are omitted from this document?" },
    { label: "Executive synthesis", text: "Synthesize this note into an executive summary with core levers." },
    { label: "Action items", text: "Extract concrete, high-leverage action items as an interactive checklist." },
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const handleSend = async (customText) => {
    const text = (customText || input).trim();
    if (!text || streaming) return;
    setInput("");

    // Capture conversation history for multi-turn reasoning (last 6 turns)
    const historyPayload = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Add user message and empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    let accumulated = "";

    await streamAI({
      prompt: text,
      noteId: note?.id || "",
      noteTitle: note?.title || "",
      noteContext: note?.content || "",
      selectedText: selectedText || "",
      history: historyPayload,
      mode: mode || "create",
      onToken: (token, acc) => {
        accumulated = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      },
      onDone: (final) => {
        setStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: final || accumulated };
          return next;
        });
      },
      onError: (err) => {
        setStreaming(false);
        toast.error("Generation interrupted");
      },
    });
  };

  const handleCopy = (content, index) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleInsertIntoNote = (content) => {
    onInsertText(`\n\n${content}\n`);
    toast.success("Inserted into note");
  };

  return (
    <>
      {/* Dim Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-background border-l border-border/80 flex flex-col shadow-float"
        data-testid="chat-drawer"
      >
        {/* Drawer Header */}
        <div className="h-12 border-b border-border/60 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-md overflow-hidden shrink-0 border border-border/80">
              <img src="/logo.png" alt="Spark" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                Spark
                <span className="text-[10px] font-normal text-muted-foreground">
                  · Cognitive Partner
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            data-testid="chat-close-btn"
          >
            <X size={14} />
          </button>
        </div>

        {/* Selected text indicator (if any) */}
        {selectedText && (
          <div className="px-4 py-1.5 border-b border-border/40 bg-secondary/30 text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground text-[11px]">Context:</span>
            <span className="truncate italic text-[11px] max-w-[260px]">"{selectedText}"</span>
          </div>
        )}

        {/* Conversation messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[90%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-foreground text-background"
                      : "bg-secondary/60 text-foreground border border-border/60"
                  }`}
                  data-testid={`chat-msg-${i}`}
                >
                  {m.content}
                  {!isUser && streaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-3 bg-foreground ml-1 animate-pulse" />
                  )}
                </div>

                {/* Assistant message action tools */}
                {!isUser && m.content && (
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground px-1">
                    <button
                      type="button"
                      onClick={() => handleInsertIntoNote(m.content)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Insert response into the active note"
                    >
                      <PlusCircle size={11} /> Insert in note
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(m.content, i)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Copy response"
                    >
                      {copiedIndex === i ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      {copiedIndex === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Suggested Starter Prompts */}
        <div className="px-3 py-2 border-t border-border/40 bg-secondary/20 flex gap-1 overflow-x-auto">
          {suggestedPrompts.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSend(p.text)}
              className="px-2.5 py-1 rounded-md border border-border/60 bg-background text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Composer */}
        <div className="p-3 border-t border-border/60 bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-secondary/30 px-3 py-1.5 focus-within:border-foreground/50 transition-colors"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Spark or challenge ideas..."
              className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground/50"
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-foreground text-background disabled:opacity-30 transition-opacity"
            >
              {streaming ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            </button>
          </form>
        </div>
      </motion.aside>
    </>
  );
}
