import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCollaboration } from "@/hooks/useCollaboration";
import {
  Pin,
  PinOff,
  Trash2,
  FileDown,
  BookOpenCheck,
  Loader2,
  Users,
  Sparkles,
  Columns2,
  Eye,
  PenTool,
  Clock,
  CheckCircle2,
  Check,
  Network,
  Share2,
  MoreHorizontal,
  ArrowLeft,
  Palette,
} from "lucide-react";
import jsPDF from "jspdf";
import SlashMenu from "./SlashMenu";
import PriorityPicker from "./PriorityPicker";
import MarkdownViewer from "./MarkdownViewer";
import LiveCursors from "./LiveCursors";
import SelectionToolbar from "./SelectionToolbar";
import MindMapView from "./MindMapView";
import NoteConnections from "./NoteConnections";
import WhiteboardView from "./WhiteboardView";
import StudyView from "./StudyView";
import CollabView from "./CollabView";
import KnowledgeGraphModal from "./KnowledgeGraphModal";
import PDFImportModal from "./PDFImportModal";
import ModeSwitcher from "./ModeSwitcher";
import InlineCopilot from "./InlineCopilot";
import { getAIPayloadExtra } from "@/lib/aiSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Editor({ note, onChanged, onDeleted, onOpenAIModal }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(note.title || "Untitled");
  const [content, setContent] = useState(note.content || "");
  const [pinned, setPinned] = useState(Boolean(note.pinned));
  const [priority, setPriority] = useState(note.priority || "none");
  const [savingState, setSavingState] = useState("idle"); // idle | saving | saved
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Adaptive Mode: "create" | "study" | "collab"
  const [notebookMode, setNotebookMode] = useState("create");

  // Create Mode Sub-views: "edit" | "split" | "preview" | "mindmap" | "connections"
  const [createSubView, setCreateSubView] = useState("edit");

  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Selection toolbar state
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0, text: "" });
  const [selectionPos, setSelectionPos] = useState(null);

  const taRef = useRef(null);
  const containerRef = useRef(null);
  const currentNoteIdRef = useRef(note.id);
  const isInitialMount = useRef(true);
  const nav = useNavigate();

  // Document Telemetry
  const stats = useMemo(() => {
    const text = (content || "").trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingTime };
  }, [content]);

  // Handle remote collaboration edits
  const handleRemoteEdit = useCallback((edit) => {
    if (edit.title !== undefined) setTitle(edit.title);
    if (edit.content !== undefined) setContent(edit.content);
  }, []);

  // Real-time collaboration hook
  const {
    collaborators,
    readerCount,
    remoteCursors,
    sendCursor,
    sendEdit,
  } = useCollaboration({
    noteId: note.id,
    user,
    onRemoteEdit: handleRemoteEdit,
  });

  // Track cursor position inside editor canvas
  const handleMouseMove = useCallback(
    (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sendCursor(x, y);
    },
    [sendCursor]
  );

  // Sync state when switching notes
  useEffect(() => {
    currentNoteIdRef.current = note.id;
    setTitle(note.title || "Untitled");
    setContent(note.content || "");
    setPinned(Boolean(note.pinned));
    setPriority(note.priority || "none");
    setSelectionPos(null);
    setCreateSubView("edit");
    isInitialMount.current = true;
  }, [note.id]); // eslint-disable-line

  // Debounced save
  const saveTimeoutRef = useRef(null);
  const performSave = useCallback(
    async (payload, targetNoteId) => {
      if (!targetNoteId || targetNoteId !== currentNoteIdRef.current) return;
      setSavingState("saving");
      try {
        await api.patch(`/notes/${targetNoteId}`, payload);
        if (targetNoteId === currentNoteIdRef.current) {
          setSavingState("saved");
          onChanged?.();
          setTimeout(() => setSavingState("idle"), 1500);
        }
      } catch (err) {
        if (targetNoteId === currentNoteIdRef.current) {
          setSavingState("idle");
          toast.error("Autosave failed");
        }
      }
    },
    [onChanged]
  );

  // Trigger autosave on changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (
      title === note.title &&
      content === note.content &&
      pinned === note.pinned &&
      priority === (note.priority || "none")
    ) {
      return;
    }

    const noteIdToSave = note.id;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      performSave({ title, content, pinned, priority }, noteIdToSave);
    }, 600);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, pinned, priority, note.title, note.content, note.pinned, note.priority, note.id, performSave]);

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    await performSave({ pinned: next }, note.id);
    toast.success(next ? "Pinned note to top" : "Unpinned note");
  };

  const onDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      await api.delete(`/notes/${note.id}`);
      toast.success("Note deleted");
      onDeleted?.();
      nav("/app");
    } catch {
      toast.error("Could not delete note");
    }
  };

  // Text insertion helper
  const insertText = (chunk) => {
    const ta = taRef.current;
    if (!ta) {
      const next = (content || "") + chunk;
      setContent(next);
      sendEdit(title, next);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const next = val.slice(0, start) + chunk + val.slice(end);
    setContent(next);
    sendEdit(title, next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + chunk.length, start + chunk.length);
    }, 0);
  };

  const replaceSelection = (replacement) => {
    const ta = taRef.current;
    if (!ta) return;
    const { start, end } = selectionRange;
    const val = ta.value;
    const next = val.slice(0, start) + replacement + val.slice(end);
    setContent(next);
    sendEdit(title, next);
    setSelectionPos(null);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start, start + replacement.length);
    }, 0);
  };

  // Text selection tracking
  const handleSelect = (e) => {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const text = (content || "").slice(start, end);
    if (text && text.trim().length > 0) {
      setSelectionRange({ start, end, text });
      const rect = e.target.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + 40, 20), window.innerWidth - 300);
      const y = Math.max(rect.top - 50, 60);
      setSelectionPos({ x, y });
    } else {
      setSelectionPos(null);
    }
  };

  // Task item checkbox toggle in preview mode
  const handleToggleTask = (taskIndex) => {
    let count = -1;
    const regex = /^(\s*-\s*\[)([ xX])(\]\s.*)$/gm;
    const updated = content.replace(regex, (match, prefix, check, suffix) => {
      count++;
      if (count === taskIndex) {
        const nextState = check.trim() ? " " : "x";
        return `${prefix}${nextState}${suffix}`;
      }
      return match;
    });
    setContent(updated);
    sendEdit(title, updated);
  };

  // Continue writing seamlessly with Ember
  const handleContinue = async () => {
    setAiBusy(true);
    toast.info("Ember: Continuing line of thought...");
    try {
      const extra = getAIPayloadExtra();
      const payload = {
        text: content,
        note_id: note.id,
        note_title: title,
        note_context: content,
        selected_text: selectionRange.text,
        mode: notebookMode,
        ...extra,
      };
      const { data } = await api.post("/ai/continue", payload);
      const result = data.result || "";
      if (result) {
        insertText(`\n\n${result}\n`);
        toast.success("Ember · Continuation added");
      }
    } catch {
      toast.error("Ember could not continue writing");
    } finally {
      setAiBusy(false);
    }
  };

  // Slash commands picker
  const handleSlashPick = (item) => {
    setSlashOpen(false);
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const val = ta.value;
    const lastSlash = val.slice(0, pos).lastIndexOf("/");
    const key = typeof item === "string" ? item : (item.key || item.id || "");

    const cleanBefore = lastSlash >= 0 ? val.slice(0, lastSlash) : val.slice(0, pos);
    const cleanAfter = val.slice(pos);

    if (key === "mindmap") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      setNotebookMode("create");
      setCreateSubView("mindmap");
      return;
    }
    if (key === "study") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      setNotebookMode("study");
      return;
    }
    if (key === "connections") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      setNotebookMode("create");
      setCreateSubView("connections");
      return;
    }
    if (key === "continue") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      handleContinue();
      return;
    }
    if (key === "whiteboard" || key === "draw") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      setNotebookMode("create");
      setCreateSubView("whiteboard");
      return;
    }
    if (key === "pdf") {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      setPdfModalOpen(true);
      return;
    }
    if (["improve", "expand", "assumptions", "perspective", "missing", "research", "counter", "actions", "summarize", "keypoints", "bullets"].includes(key)) {
      setContent(cleanBefore + cleanAfter);
      sendEdit(title, cleanBefore + cleanAfter);
      handleAIAction(key);
      return;
    }

    // Markdown Block Templates
    const blockTemplates = {
      h1: "# ",
      h2: "## ",
      h3: "### ",
      todo: "- [ ] ",
      bullet: "- ",
      numbered: "1. ",
      callout: "> 💡 **Insight**: ",
      quote: "> ",
      code: "```\n\n```",
      divider: "---\n",
      table: "| Item | Description | Status |\n| :--- | :--- | :--- |\n|  |  |  |\n",
    };

    const tpl = blockTemplates[key] || (typeof item === "object" && item.template) || "";
    const next = cleanBefore + tpl + cleanAfter;
    setContent(next);
    sendEdit(title, next);
    setTimeout(() => {
      ta.focus();
      const newPos = cleanBefore.length + tpl.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Dedicated AI action dispatcher
  const handleAIAction = async (kind) => {
    setAiBusy(true);
    const friendlyName = {
      improve: "Polishing prose",
      expand: "Expanding concept",
      assumptions: "Uncovering assumptions",
      perspective: "Contrasting paradigms",
      missing: "Spotting blind spots",
      research: "Formulating research vectors",
      counter: "Analyzing counter-arguments",
      actions: "Extracting action items",
      summarize: "Synthesizing summary",
      bullets: "Structuring bullets",
      keypoints: "Distilling insights",
    }[kind] || `Running ${kind}`;

    toast.info(`Ember: ${friendlyName}...`);
    try {
      const extra = getAIPayloadExtra();
      const payload = {
        text: selectionRange.text || content,
        note_id: note.id,
        note_title: title,
        note_context: content,
        selected_text: selectionRange.text,
        mode: notebookMode,
        ...extra,
      };

      const { data } = await api.post(`/ai/${kind}`, payload);
      const result = data.result || "";

      if (kind === "improve") {
        if (selectionRange.text) {
          replaceSelection(result);
        } else {
          setContent(result);
          sendEdit(title, result);
        }
      } else if (kind === "expand" && selectionRange.text) {
        insertText(`\n\n${result}\n`);
      } else if (
        kind === "actions" ||
        kind === "counter" ||
        kind === "assumptions" ||
        kind === "perspective" ||
        kind === "missing" ||
        kind === "research"
      ) {
        insertText(`\n\n${result}\n`);
      } else {
        const tag =
          {
            summarize: "Executive Summary",
            bullets: "Structured Bullets",
            keypoints: "Core Insights",
          }[kind] || "Ember Synthesis";
        insertText(`\n\n--- ${tag} ---\n${result}\n`);
      }
      toast.success(`Ember · ${kind} complete`);
    } catch {
      toast.error("Ember service could not complete the request");
    } finally {
      setAiBusy(false);
    }
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      wrapSelection("**", "**");
    } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      wrapSelection("*", "*");
    } else if (e.key === "Tab") {
      e.preventDefault();
      insertText("  ");
    }
  };

  const wrapSelection = (before, after) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.slice(start, end) || "text";
    const newVal = text.slice(0, start) + before + selected + after + text.slice(end);
    setContent(newVal);
    sendEdit(title, newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // Format selection from Toolbar
  const handleFormat = (type) => {
    switch (type) {
      case "bold":
        wrapSelection("**", "**");
        break;
      case "italic":
        wrapSelection("*", "*");
        break;
      case "code":
        wrapSelection("`", "`");
        break;
      case "strike":
        wrapSelection("~~", "~~");
        break;
      case "h1":
        insertText("\n# ");
        break;
      case "h2":
        insertText("\n## ");
        break;
      case "h3":
        insertText("\n### ");
        break;
      case "quote":
        insertText("\n> ");
        break;
      case "callout":
        insertText("\n> [!NOTE] ");
        break;
      case "bullet":
        insertText("\n- ");
        break;
      case "numbered":
        insertText("\n1. ");
        break;
      case "task":
        insertText("\n- [ ] ");
        break;
      default:
        break;
    }
  };

  // Multi-Page Clean PDF Export
  const exportPdf = () => {
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 45;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin + 15;

    // Title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(20, 20, 20);
    const titleLines = pdf.splitTextToSize(title || "Untitled", contentWidth);
    titleLines.forEach((tl) => {
      pdf.text(tl, margin, yPos);
      yPos += 26;
    });

    // Subtitle meta
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text(
      `Exported from Ember · ${stats.words} words · ${new Date().toLocaleDateString()}`,
      margin,
      yPos
    );
    yPos += 16;

    // Divider line
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 20;

    // Body text
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(40, 40, 40);

    const paragraphs = (content || "").split("\n");
    paragraphs.forEach((p) => {
      if (yPos > pageHeight - margin - 20) {
        pdf.addPage();
        yPos = margin + 10;
      }
      if (!p.trim()) {
        yPos += 10;
        return;
      }
      const lines = pdf.splitTextToSize(p, contentWidth);
      lines.forEach((l) => {
        if (yPos > pageHeight - margin - 15) {
          pdf.addPage();
          yPos = margin + 10;
        }
        pdf.text(l, margin, yPos);
        yPos += 16;
      });
      yPos += 6;
    });

    pdf.save(`${(title || "Untitled").replace(/\s+/g, "_")}.pdf`);
    toast.success("Note exported as PDF");
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative flex-1 flex flex-col min-h-full pb-20"
      data-testid="editor-canvas"
    >
      {/* Real-time remote collaborator cursors for Create mode */}
      {notebookMode === "create" && <LiveCursors remoteCursors={remoteCursors} />}

      {/* Floating Selection Toolbar in Create Mode */}
      <AnimatePresence>
        {notebookMode === "create" && selectionPos && (
          <SelectionToolbar
            pos={selectionPos}
            selectedText={selectionRange.text}
            onFormat={handleFormat}
            onAITransform={handleAIAction}
            busy={aiBusy}
          />
        )}
      </AnimatePresence>

      {/* Top Header Bar: Clean, Calm, Mode-Aware */}
      <div className="sticky top-11 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 sm:px-8 py-2 flex items-center justify-between gap-4 select-none">
        {/* Left: Priority & Pin Status */}
        <div className="flex items-center gap-1.5">
          <PriorityPicker
            value={priority}
            onChange={(p) => {
              setPriority(p);
              performSave({ priority: p }, note.id);
            }}
          />

          <button
            onClick={togglePin}
            className={`h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors ${
              pinned ? "text-accent font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
            title={pinned ? "Unpin note" : "Pin note to top"}
            data-testid="editor-pin-btn"
          >
            {pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
        </div>

        {/* Center: Adaptive Mode Switcher (Write | Study | Collaborate) */}
        <div className="flex items-center">
          <ModeSwitcher
            currentMode={notebookMode}
            onModeChange={(mode) => {
              setNotebookMode(mode);
              if (mode === "create" && (createSubView === "mindmap" || createSubView === "connections")) {
                setCreateSubView("edit");
              }
            }}
            readerCount={readerCount}
          />
        </div>

        {/* Right: Mode-Specific Actions & Secondary Menu */}
        <div className="flex items-center gap-1.5">
          {/* Sub-view switcher in Create Mode */}
          {notebookMode === "create" && createSubView !== "mindmap" && createSubView !== "connections" && createSubView !== "whiteboard" && (
            <div className="flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border/60">
              <button
                type="button"
                onClick={() => setCreateSubView("edit")}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  createSubView === "edit"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Write mode"
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setCreateSubView("split")}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  createSubView === "split"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Split editor & preview"
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setCreateSubView("preview")}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  createSubView === "preview"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Preview"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setCreateSubView("whiteboard")}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  createSubView === "whiteboard"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Whiteboard Canvas"
              >
                Canvas
              </button>
            </div>
          )}

          {/* Return to writing button if in Mindmap, Connections, or Whiteboard subview */}
          {notebookMode === "create" && (createSubView === "mindmap" || createSubView === "connections" || createSubView === "whiteboard") && (
            <button
              onClick={() => setCreateSubView("edit")}
              className="h-7 px-2.5 rounded-md border border-border/60 bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={12} /> Return to editor
            </button>
          )}

          {/* Secondary Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="More actions"
                data-testid="editor-more-btn"
              >
                <MoreHorizontal size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-float">
              <DropdownMenuItem
                onClick={() => {
                  setNotebookMode("create");
                  setCreateSubView("whiteboard");
                }}
                className="rounded-lg text-xs gap-2 py-1.5"
              >
                <Palette size={13} className="opacity-70" />
                <span>Whiteboard Canvas</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setNotebookMode("create");
                  setCreateSubView("mindmap");
                }}
                className="rounded-lg text-xs gap-2 py-1.5"
              >
                <Network size={13} className="opacity-70" />
                <span>Concept Mind Map</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setNotebookMode("create");
                  setCreateSubView("connections");
                }}
                className="rounded-lg text-xs gap-2 py-1.5"
              >
                <Share2 size={13} className="opacity-70" />
                <span>Note Connections</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setGraphModalOpen(true)}
                className="rounded-lg text-xs gap-2 py-1.5"
              >
                <Network size={13} className="text-accent opacity-80" />
                <span>Workspace Graph</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem onClick={exportPdf} className="rounded-lg text-xs gap-2 py-1.5">
                <FileDown size={13} className="opacity-70" />
                <span>Export PDF</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={onDelete}
                className="rounded-lg text-xs gap-2 py-1.5 text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-500/10"
              >
                <Trash2 size={13} />
                <span>Delete note</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: WRITE MODE (HERO CANVAS)                         */}
      {/* ======================================================== */}
      {notebookMode === "create" && (
        <>
          {/* Sub-view: Mind Map */}
          {createSubView === "mindmap" && (
            <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 pt-6 flex-1 flex flex-col">
              <MindMapView
                noteId={note.id}
                noteTitle={title}
                noteContent={content}
                onInsertText={insertText}
              />
            </div>
          )}

          {/* Sub-view: Whiteboard Canvas */}
          {createSubView === "whiteboard" && (
            <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-4 pb-12 flex-1 flex flex-col">
              <WhiteboardView
                noteId={note.id}
                noteTitle={title}
                onInsertImage={(imgMarkdown) => {
                  insertText(imgMarkdown);
                  setCreateSubView("edit");
                }}
              />
            </div>
          )}

          {/* Sub-view: Note Connections */}
          {createSubView === "connections" && (
            <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 pt-6 flex-1 flex flex-col">
              <NoteConnections
                noteId={note.id}
                noteTitle={title}
                onOpenGraphModal={() => setGraphModalOpen(true)}
              />
            </div>
          )}

          {/* Hero Writing Canvas (Edit / Split / Preview) */}
          {(createSubView === "edit" || createSubView === "split" || createSubView === "preview") && (
            <div className="max-w-[700px] w-full mx-auto px-6 pt-10 pb-28 flex-1 flex flex-col">
              {/* Note Title Input */}
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  sendEdit(e.target.value, content);
                }}
                placeholder="Untitled"
                className="w-full text-3xl sm:text-4xl font-semibold tracking-tight bg-transparent border-0 outline-none pb-2 placeholder:text-muted-foreground/30 text-foreground transition-colors"
                data-testid="editor-title-input"
              />

              {/* Spark Inline Copilot */}
              <InlineCopilot
                noteId={note.id}
                noteTitle={title}
                noteContent={content}
                selectedText={selectionRange.text}
                mode={notebookMode}
                onInsertText={insertText}
                onReplaceSelection={replaceSelection}
              />

              {/* Canvas Area: Write, Split, or Preview */}
              <div className="flex-1 mt-2 relative">
                {createSubView === "edit" && (
                  <textarea
                    ref={taRef}
                    value={content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setContent(val);
                      sendEdit(title, val);

                      // Slash command detection
                      const pos = e.target.selectionStart;
                      const textBefore = val.slice(0, pos);
                      const lastSlash = textBefore.lastIndexOf("/");
                      if (lastSlash >= 0 && !textBefore.slice(lastSlash).includes("\n")) {
                        const query = textBefore.slice(lastSlash + 1);
                        setSlashQuery(query);
                        const rect = taRef.current.getBoundingClientRect();
                        setSlashPos({ x: rect.left + 24, y: rect.top + 80 });
                        setSlashOpen(true);
                      } else {
                        setSlashOpen(false);
                      }
                    }}
                    onSelect={handleSelect}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your note... Type '/' for formatting and commands."
                    className="w-full min-h-[550px] h-full resize-none bg-transparent border-0 outline-none text-[1.0625rem] leading-[1.85] text-foreground placeholder:text-muted-foreground/30 font-normal font-sans"
                    data-testid="editor-content-input"
                  />
                )}

                {createSubView === "split" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
                    <textarea
                      ref={taRef}
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        sendEdit(title, e.target.value);
                      }}
                      onSelect={handleSelect}
                      onKeyDown={handleKeyDown}
                      placeholder="Markdown text..."
                      className="w-full h-full resize-none bg-transparent border-r pr-4 outline-none text-sm leading-relaxed text-foreground font-mono"
                    />
                    <div className="overflow-y-auto pl-2">
                      <MarkdownViewer content={content} onToggleTask={handleToggleTask} />
                    </div>
                  </div>
                )}

                {createSubView === "preview" && (
                  <div className="min-h-[500px] py-2">
                    <MarkdownViewer content={content} onToggleTask={handleToggleTask} />
                  </div>
                )}

                {/* Slash Commands Dropdown */}
                <AnimatePresence>
                  {slashOpen && (
                    <SlashMenu
                      pos={slashPos}
                      query={slashQuery}
                      onPick={handleSlashPick}
                      onClose={() => setSlashOpen(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Quiet Status Bar Footer in Create Mode */}
          <footer className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1 rounded-full border border-border/60 bg-background/90 backdrop-blur-md shadow-ambient text-[11px] text-muted-foreground flex items-center gap-3 select-none">
            <div className="flex items-center gap-1.5">
              {savingState === "saving" ? (
                <>
                  <Loader2 size={10} className="animate-spin text-amber-500" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Saved</span>
                </>
              )}
            </div>

            <div className="h-3 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span>{stats.words} words</span>
              <span>·</span>
              <span>{stats.readingTime} min read</span>
            </div>
          </footer>
        </>
      )}

      {/* ======================================================== */}
      {/* MODE 2: STUDY MODE                                       */}
      {/* ======================================================== */}
      {notebookMode === "study" && (
        <div className="flex-1 flex flex-col">
          <StudyView
            noteId={note.id}
            embedded={true}
            noteTitle={title}
            noteContent={content}
            onNoteChange={(newTitle, newContent) => {
              setTitle(newTitle);
              setContent(newContent);
              sendEdit(newTitle, newContent);
            }}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: COLLABORATE MODE                                 */}
      {/* ======================================================== */}
      {notebookMode === "collab" && (
        <div className="flex-1 flex flex-col">
          <CollabView
            noteId={note.id}
            noteTitle={title}
            noteContent={content}
            user={user}
            collaborators={collaborators}
            readerCount={readerCount}
            remoteCursors={remoteCursors}
            onMouseMove={handleMouseMove}
          />
        </div>
      )}

      {/* Global Workspace Knowledge Graph Modal */}
      <KnowledgeGraphModal open={graphModalOpen} onClose={() => setGraphModalOpen(false)} />

      {/* PDF Document Intelligence & Study Importer Modal */}
      <PDFImportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        onNoteCreated={(createdNote, isStudy) => {
          onChanged?.();
          if (isStudy) {
            nav(`/app/study/${createdNote.id}`);
          } else {
            nav(`/app/n/${createdNote.id}`);
          }
        }}
      />
    </div>
  );
}
