import { useEffect, useMemo, useState, useCallback } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/app/Sidebar";
import Topbar from "@/components/app/Topbar";
import Editor from "@/components/app/Editor";
import EmptyState from "@/components/app/EmptyState";
import ChatDrawer from "@/components/app/ChatDrawer";
import SearchOverlay from "@/components/app/SearchOverlay";
import StudyView from "@/components/app/StudyView";
import AISettingsModal from "@/components/app/AISettingsModal";
import KnowledgeGraphModal from "@/components/app/KnowledgeGraphModal";
import PDFImportModal from "@/components/app/PDFImportModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles, RefreshCw, ArrowRight, PenTool, FileText } from "lucide-react";

export default function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const nav = useNavigate();
  const location = useLocation();

  const activeId = location.pathname.match(/\/app\/n\/(.+)/)?.[1];
  const activeNote = notes.find((n) => n.id === activeId);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/notes");
      const list = Array.isArray(data) ? data : (data.notes || []);
      setNotes(list);
      return list;
    } catch {
      toast.error("Could not load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshQuote = async () => {
    try {
      const { data } = await api.post("/insights/refresh");
      setQuote(data);
      toast.success(data.category ? `Ember perspective: ${data.category}` : "Insight refreshed");
    } catch {
      toast.error("Could not refresh insight");
    }
  };

  useEffect(() => {
    api.get("/insights/daily").then(({ data }) => setQuote(data)).catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createNote = async () => {
    const { data } = await api.post("/notes", { title: "Untitled", content: "" });
    await refresh();
    nav(`/app/n/${data.id}`);
  };

  const handleCreateReflectionNote = async (promptText) => {
    try {
      const cleanTitle = promptText.length > 70 ? `${promptText.slice(0, 67)}...` : promptText;
      const initialContent = `> *"${promptText}"*\n\n`;
      const { data } = await api.post("/notes", {
        title: cleanTitle,
        content: initialContent,
      });
      await refresh();
      toast.success("Created reflection note");
      nav(`/app/n/${data.id}`);
    } catch {
      toast.error("Could not create reflection note");
    }
  };

  const handleInsertFromChat = (text) => {
    if (!activeNote) {
      toast.error("Open a note to insert this content");
      return;
    }
    const updatedContent = (activeNote.content || "") + text;
    api.patch(`/notes/${activeNote.id}`, { content: updatedContent }).then(() => {
      refresh();
    });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        notes={notes}
        onCreate={createNote}
        onSearch={() => setSearchOpen(true)}
        onReorder={async (ids) => {
          setNotes((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]));
            return ids.map((id, i) => ({ ...map.get(id), order: i }));
          });
          await api.post("/notes/reorder", { note_ids: ids });
        }}
          loading={loading}
          onOpenPDF={() => setPdfModalOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            onSearch={() => setSearchOpen(true)}
            onToggleChat={() => setChatOpen((v) => !v)}
            onOpenAISettings={() => setAiModalOpen(true)}
            onOpenPDF={() => setPdfModalOpen(true)}
          />

          <main className="flex-1 relative">
            <Routes>
              <Route
                index
                element={
                  notes.length === 0 && !loading ? (
                    <EmptyState onCreate={createNote} />
                  ) : (
                    <Welcome
                      notes={notes}
                      onPick={(id) => nav(`/app/n/${id}`)}
                      onCreate={createNote}
                      onOpenPDF={() => setPdfModalOpen(true)}
                      quote={quote}
                      onRefreshQuote={refreshQuote}
                      onOpenChat={() => setChatOpen(true)}
                      onCreateReflectionNote={handleCreateReflectionNote}
                    />
                  )
                }
              />
              <Route
                path="n/:id"
                element={
                  <EditorRoute
                    notes={notes}
                    loading={loading}
                    onChanged={refresh}
                    onDeleted={refresh}
                    onOpenAIModal={() => setAiModalOpen(true)}
                  />
                }
              />
              <Route path="study/:id" element={<StudyRoute />} />
            </Routes>
          </main>
        </div>

        {/* Ember Thinking Partner Drawer */}
        <AnimatePresence>
          {chatOpen && (
            <ChatDrawer
              note={activeNote}
              onInsertText={handleInsertFromChat}
              onClose={() => setChatOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Search Overlay */}
        <AnimatePresence>
          {searchOpen && (
            <SearchOverlay
              onClose={() => setSearchOpen(false)}
              onPick={(id) => {
                setSearchOpen(false);
                nav(`/app/n/${id}`);
              }}
            />
          )}
        </AnimatePresence>

        {/* AI Settings Modal */}
        <AISettingsModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />

        {/* Workspace Knowledge Graph Modal */}
        <KnowledgeGraphModal open={graphModalOpen} onClose={() => setGraphModalOpen(false)} />

        {/* PDF Intelligence & Importer Modal */}
        <PDFImportModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          onNoteCreated={async (createdNote, isStudy) => {
            await refresh();
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

function Welcome({
  notes,
  onPick,
  onCreate,
  onOpenPDF,
  quote,
  onRefreshQuote,
  onOpenChat,
  onCreateReflectionNote,
}) {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(" ")[0] : null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const recent = useMemo(
    () => [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6),
    [notes]
  );

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-12">
      {/* Calm, Confident Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          What's on your mind today?
        </p>
      </div>

      {/* Contemplative Daily Reflection Card */}
      {quote && (
        <div
          className="mt-6 p-5 rounded-2xl border border-border/80 bg-card shadow-ambient relative overflow-hidden"
          data-testid="welcome-spark-insight-card"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {quote.category || "Reflection"}
            </span>
            {onRefreshQuote && (
              <button
                onClick={onRefreshQuote}
                className="h-6 w-6 rounded-md hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Next prompt"
                data-testid="welcome-refresh-insight-btn"
              >
                <RefreshCw size={11} />
              </button>
            )}
          </div>

          <div className="mt-2.5 text-sm sm:text-base font-normal text-foreground leading-relaxed">
            "{quote.prompt || quote.q}"
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-border/40 text-xs">
            {onCreateReflectionNote && (
              <button
                onClick={() => onCreateReflectionNote(quote.prompt || quote.q)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 text-xs font-medium transition-colors"
                data-testid="welcome-reflect-note-btn"
              >
                <PenTool size={11} />
                <span>Reflect</span>
              </button>
            )}

            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all"
                data-testid="welcome-explore-spark-btn"
              >
                <Sparkles size={11} />
                <span>Ask Spark</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent Notes Section */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          Recent Documents
        </h2>
        <div className="flex items-center gap-3">
          {onOpenPDF && (
            <button
              onClick={onOpenPDF}
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/70 hover:bg-muted transition-colors"
              data-testid="welcome-import-pdf-btn"
            >
              <FileText size={12} /> Import PDF
            </button>
          )}
          <button
            onClick={onCreate}
            className="text-xs font-medium text-foreground hover:underline inline-flex items-center gap-1"
          >
            <Plus size={12} /> New Note
          </button>
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {recent.map((n) => (
          <button
            key={n.id}
            onClick={() => onPick(n.id)}
            className="text-left p-4 rounded-2xl border border-border/80 bg-card hover:bg-secondary/30 shadow-ambient transition-all group"
            data-testid={`recent-note-${n.id}`}
          >
            <div className="font-medium text-sm truncate text-foreground">
              {n.title || "Untitled"}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {n.content?.slice(0, 140) || "Empty note"}
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground/50 font-mono">
              {n.updated_at ? new Date(n.updated_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
            </div>
          </button>
        ))}
        <button
          onClick={onCreate}
          className="p-4 rounded-2xl border border-dashed border-border/80 hover:border-foreground/30 hover:bg-secondary/20 transition-all text-left flex flex-col justify-between min-h-[100px]"
          data-testid="welcome-new-note-btn"
        >
          <div>
            <div className="font-medium text-sm text-foreground">+ Begin new note</div>
            <div className="text-xs text-muted-foreground mt-1">Write, study with active recall, or collaborate</div>
          </div>
          <div className="text-[10px] text-muted-foreground/50 font-mono">
            Type / for commands & thinking companion
          </div>
        </button>
      </div>
    </div>
  );
}

function EditorRoute({ notes, loading, onChanged, onDeleted, onOpenAIModal }) {
  const { id } = useParams();
  const [directNote, setDirectNote] = useState(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!notes.find((n) => n.id === id) && id) {
      setFetching(true);
      api
        .get(`/notes/${id}`)
        .then(({ data }) => setDirectNote(data))
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [id, notes]);

  const note = notes.find((n) => n.id === id) || directNote;

  if (loading || (fetching && !note)) {
    return (
      <div className="p-8 sm:p-12 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!note) return <div className="p-12 text-center text-muted-foreground">Note not found.</div>;
  return (
    <Editor
      key={note.id}
      note={note}
      onChanged={onChanged}
      onDeleted={onDeleted}
      onOpenAIModal={onOpenAIModal}
    />
  );
}

function StudyRoute() {
  const { id } = useParams();
  return <StudyView noteId={id} />;
}
