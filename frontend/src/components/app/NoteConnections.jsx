import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Share2,
  ExternalLink,
  Tag,
  Hash,
  Sparkles,
  Loader2,
  ArrowRight,
  Network,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function NoteConnections({ noteId, noteTitle, onOpenGraphModal }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/notes/${noteId}/connections`)
      .then(({ data }) => {
        if (!active) return;
        setConnections(data.connections || []);
      })
      .catch(() => {
        if (active) setConnections([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [noteId]);

  return (
    <div
      className="max-w-4xl mx-auto px-6 sm:px-12 py-8"
      data-testid="note-connections-view"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b">
        <div>
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-primary" />
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
              Connected Notes & Backlinks
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Semantic relationships, shared tags, and cross-references for{" "}
            <span className="font-medium text-foreground">{noteTitle || "this note"}</span>.
          </p>
        </div>

        {onOpenGraphModal && (
          <button
            onClick={onOpenGraphModal}
            className="h-8 px-3.5 rounded-full border bg-card hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Network size={13} className="text-primary" />
            <span>Workspace Graph</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-xs">Analyzing workspace knowledge graph...</span>
        </div>
      )}

      {!loading && connections.length === 0 && (
        <div className="py-16 text-center rounded-2xl border border-dashed bg-card/40 my-6">
          <Share2 size={28} className="mx-auto text-muted-foreground/60 mb-2" />
          <div className="font-semibold text-sm">No Connected Notes Found</div>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            As you create notes with shared tags or related concepts, Ember automatically maps their connections.
          </p>
        </div>
      )}

      {!loading && connections.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">
            {connections.length} Relevant Connection{connections.length > 1 ? "s" : ""}
          </div>

          <div className="grid gap-3">
            {connections.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => nav(`/app/n/${c.id}`)}
                className="group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate" style={{ fontFamily: "Outfit" }}>
                      {c.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary font-semibold">
                      Score: {c.score}
                    </span>
                  </div>

                  {c.snippet && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {c.snippet}
                    </p>
                  )}

                  {/* Reasons Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {c.reasons?.map((r, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-muted text-muted-foreground border border-border/60 flex items-center gap-1"
                      >
                        <Sparkles size={9} className="text-amber-500" />
                        {r}
                      </span>
                    ))}
                    {c.tags?.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-secondary text-secondary-foreground flex items-center gap-0.5"
                      >
                        <Hash size={9} />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">
                  <span className="hidden sm:inline">Open Note</span>
                  <ArrowRight size={13} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
