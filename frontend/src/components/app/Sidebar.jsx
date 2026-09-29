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
  Sparkles,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRIORITY_META } from "./PriorityPicker";

function SortableNote({ note, active }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const pmeta = PRIORITY_META[note.priority || "none"];

  return (
    <Link
      to={`/app/n/${note.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors select-none ${
        active
          ? "bg-secondary text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      }`}
      data-testid={`sidebar-note-${note.id}`}
    >
      <div className="relative shrink-0 mt-0.5">
        <FileText size={13} className={active ? "text-foreground" : "opacity-50"} />
        {note.priority && note.priority !== "none" && (
          <span
            className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background ${pmeta.dot}`}
            title={`${pmeta.label} priority`}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground text-xs leading-normal">{note.title || "Untitled"}</div>
      </div>

      {note.pinned && <Pin size={10} className="text-accent shrink-0 mt-1 opacity-70" />}
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
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="border-r border-border/60 bg-background/50 backdrop-blur-md h-screen sticky top-0 overflow-hidden flex flex-col z-20"
        >
          {/* Brand Header */}
          <div className="h-12 px-3 flex items-center justify-between border-b border-border/40">
            <Link to="/app" className="flex items-center gap-2" data-testid="sidebar-brand">
              <Logo size={22} />
              <span className="font-semibold tracking-tight text-xs text-foreground">
                Ember
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={onCreate}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="New Note (⌘N)"
                data-testid="sidebar-new-note-btn"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={onToggle}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                data-testid="sidebar-collapse-btn"
                title="Collapse sidebar"
              >
                <ChevronLeft size={13} />
              </button>
            </div>
          </div>

          {/* Notes List with DndKit */}
          <div className="px-2 py-2 flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="space-y-1 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {pinnedNotes.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="px-2 py-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/60 flex items-center gap-1">
                        Pinned
                      </div>
                      {pinnedNotes.map((n) => (
                        <SortableNote key={n.id} note={n} active={activeId === n.id} />
                      ))}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/60">
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
          <div className="border-t border-border/40 p-2.5 flex items-center justify-between text-xs text-muted-foreground bg-secondary/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-md bg-secondary border border-border/80 flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="truncate text-xs font-medium text-foreground">{user?.name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={toggle}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                data-testid="sidebar-theme-toggle"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
              </button>
              <button
                onClick={logout}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
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
          className="fixed top-2.5 left-2.5 z-30 h-7 w-7 inline-flex items-center justify-center rounded-md bg-background/90 backdrop-blur-md border border-border/60 shadow-xs hover:bg-muted transition-colors"
          data-testid="sidebar-expand-btn"
          title="Expand sidebar"
        >
          <ChevronRight size={13} />
        </button>
      )}
    </AnimatePresence>
  );
}
