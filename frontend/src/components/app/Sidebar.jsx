import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pin,
  Search,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  FileText,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRIORITY_META } from "./PriorityPicker";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffHours = (now - d) / (1000 * 60 * 60);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function SortableNote({ note, active }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  const pmeta = PRIORITY_META[note.priority || "none"];
  const relativeTime = useMemo(() => formatRelativeTime(note.updated_at), [note.updated_at]);

  // Clean snippet: remove markdown symbols for preview
  const snippet = useMemo(() => {
    if (!note.content) return "Empty note";
    return note.content
      .replace(/[#*`_~[\]]/g, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 60) || "Empty note";
  }, [note.content]);

  return (
    <Link
      to={`/app/n/${note.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex flex-col gap-0.5 px-3 py-2 rounded-xl text-xs transition-all select-none ${
        active
          ? "bg-card shadow-xs text-foreground font-medium border border-border/80"
          : "text-muted-foreground hover:bg-card/60 hover:text-foreground border border-transparent"
      }`}
      data-testid={`sidebar-note-${note.id}`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="truncate text-foreground text-[12.5px] font-medium leading-tight">
          {note.title || "Untitled"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {note.pinned && <Pin size={9} className="text-accent opacity-80" />}
          {note.priority && note.priority !== "none" && (
            <span
              className={`h-1.5 w-1.5 rounded-full ring-1 ring-background ${pmeta.dot}`}
              title={`${pmeta.label} priority`}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/70 leading-normal">
        <span className="truncate max-w-[150px]">{snippet}</span>
        <span className="shrink-0 text-[10px] font-mono opacity-60">{relativeTime}</span>
      </div>
    </Link>
  );
}

export default function Sidebar({
  open,
  onToggle,
  notes,
  onCreate,
  onReorder,
  loading,
  onSearch,
  onOpenPDF,
}) {
  const loc = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = notes.map((n) => n.id);
  const activeId = loc.pathname.match(/\/app\/n\/(.+)/)?.[1];

  const onDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const newIds = arrayMove(ids, oldIdx, newIdx);
    onReorder(newIds);
  };

  const pinnedNotes = notes.filter((n) => n.pinned);
  const regularNotes = notes.filter((n) => !n.pinned);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="border-r border-border/70 bg-secondary/35 backdrop-blur-md h-screen sticky top-0 overflow-hidden flex flex-col z-20"
        >
          {/* Brand & Action Header */}
          <div className="h-12 px-3.5 flex items-center justify-between border-b border-border/40">
            <Link to="/app" className="flex items-center gap-2" data-testid="sidebar-brand">
              <Logo size={20} />
              <span className="font-semibold tracking-tight text-xs text-foreground">
                Ember
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenPDF}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Import PDF & Study Notes"
                data-testid="sidebar-import-pdf-btn"
              >
                <FileText size={13} />
              </button>
              <button
                onClick={onCreate}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                title="New Note (⌘N)"
                data-testid="sidebar-new-note-btn"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={onToggle}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="sidebar-collapse-btn"
                title="Collapse sidebar"
              >
                <ChevronLeft size={13} />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="px-3 pt-2 pb-1">
            <button
              onClick={onSearch}
              className="w-full flex items-center gap-2 px-2.5 h-7 rounded-lg border border-border/60 bg-background/50 hover:bg-background text-[11px] text-muted-foreground transition-colors"
            >
              <Search size={11} className="opacity-50" />
              <span className="flex-1 text-left">Search notes...</span>
              <kbd className="text-[9px] font-mono opacity-40 px-1 py-0.2 rounded bg-muted">⌘K</kbd>
            </button>
          </div>

          {/* Notes List with DndKit */}
          <div className="px-2 py-2 flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="space-y-1.5 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {pinnedNotes.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/60 flex items-center gap-1">
                        Pinned
                      </div>
                      {pinnedNotes.map((n) => (
                        <SortableNote key={n.id} note={n} active={activeId === n.id} />
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/60">
                      Notes ({notes.length})
                    </div>
                    {regularNotes.map((n) => (
                      <SortableNote key={n.id} note={n} active={activeId === n.id} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* User Profile & Theme Controls */}
          <div className="border-t border-border/40 p-2.5 px-3 flex items-center justify-between text-xs text-muted-foreground bg-background/30">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-full bg-secondary border border-border/80 flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="truncate text-xs font-medium text-foreground">{user?.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={toggle}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-background transition-colors"
                data-testid="sidebar-theme-toggle"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
              </button>
              <button
                onClick={logout}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-background transition-colors"
                data-testid="sidebar-logout-btn"
                title="Log out"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
        </motion.aside>
      )}

      {/* Expand sidebar button when collapsed */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed top-2.5 left-2.5 z-30 h-7 w-7 inline-flex items-center justify-center rounded-lg bg-background/90 backdrop-blur-md border border-border/60 shadow-xs hover:bg-muted transition-colors"
          data-testid="sidebar-expand-btn"
          title="Expand sidebar"
        >
          <ChevronRight size={13} />
        </button>
      )}
    </AnimatePresence>
  );
}
