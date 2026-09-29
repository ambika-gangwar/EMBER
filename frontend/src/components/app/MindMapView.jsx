import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  RefreshCw,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  FileText,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getAIPayloadExtra } from "@/lib/aiSettings";

export default function MindMapView({ noteId, noteTitle, noteContent, onInsertText }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  // Load existing mind map or auto-generate if missing
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/notes/${noteId}/mindmap`)
      .then(({ data: res }) => {
        if (!active) return;
        if (res && res.root) {
          setData(res.root);
          setSelectedNode(res.root);
        } else {
          generateMindMap();
        }
      })
      .catch(() => {
        if (active) generateMindMap();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [noteId]); // eslint-disable-line

  const generateMindMap = async () => {
    setLoading(true);
    try {
      const extra = getAIPayloadExtra();
      const text = `${noteTitle || ""}\n\n${noteContent || ""}`;
      const { data: res } = await api.post("/ai/mindmap", {
        text,
        note_title: noteTitle,
        note_context: noteContent,
        ...extra,
      });

      if (res && res.root) {
        setData(res.root);
        setSelectedNode(res.root);
        await api.post(`/notes/${noteId}/mindmap`, { root: res.root });
        toast.success("Mind map generated & saved");
      }
    } catch (err) {
      toast.error("Could not generate mind map");
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = (id) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyOutline = () => {
    if (!data) return;
    let outline = `# ${data.label}\n${data.summary ? `> ${data.summary}\n\n` : "\n"}`;
    data.children?.forEach((b) => {
      outline += `## ${b.label}\n${b.summary ? `${b.summary}\n\n` : ""}`;
      b.children?.forEach((c) => {
        outline += `- **${c.label}**: ${c.summary || ""}\n`;
      });
      outline += "\n";
    });
    navigator.clipboard.writeText(outline);
    setCopied(true);
    toast.success("Mind map outline copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertOutline = () => {
    if (!data || !onInsertText) return;
    let outline = `\n\n### Mind Map: ${data.label}\n`;
    data.children?.forEach((b) => {
      outline += `\n#### ${b.label}\n`;
      b.children?.forEach((c) => {
        outline += `- **${c.label}**: ${c.summary || ""}\n`;
      });
    });
    onInsertText(outline);
    toast.success("Mind map outline inserted into note");
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-180px)] min-h-[550px] rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col select-none"
      data-testid="mindmap-container"
    >
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-background/90 backdrop-blur-md border border-border/80 px-3 py-1.5 rounded-full shadow-sm">
          <Network size={14} className="text-primary" />
          <span className="text-xs font-medium tracking-tight">
            Mind Map <span className="text-muted-foreground">· {data?.label || noteTitle}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Zoom Controls */}
          <div className="flex items-center bg-background/90 backdrop-blur-md border border-border/80 rounded-full p-0.5 shadow-sm">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[11px] font-mono px-2 text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border-l"
              title="Reset zoom"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={copyOutline}
            className="h-8 px-3 rounded-full bg-background/90 backdrop-blur-md border hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors"
            title="Copy as Markdown outline"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span className="hidden sm:inline">Copy Outline</span>
          </button>

          {onInsertText && (
            <button
              onClick={handleInsertOutline}
              className="h-8 px-3 rounded-full bg-background/90 backdrop-blur-md border hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors"
              title="Insert outline into note content"
            >
              <PlusCircle size={12} />
              <span className="hidden sm:inline">Insert into Note</span>
            </button>
          )}

          <button
            onClick={generateMindMap}
            disabled={loading}
            className="h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
            data-testid="regenerate-mindmap-btn"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-8 pt-20 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/30 via-transparent to-transparent">
        {loading && !data && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-medium">Extracting conceptual hierarchy...</span>
          </div>
        )}

        {!loading && !data && (
          <div className="text-center max-w-sm p-6 rounded-2xl border border-dashed bg-card/60">
            <Network size={28} className="mx-auto text-muted-foreground mb-2" />
            <div className="font-semibold text-sm">No Mind Map Yet</div>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Synthesize your note into an interconnected visual concept tree.
            </p>
            <button
              onClick={generateMindMap}
              className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-all"
            >
              <Sparkles size={12} /> Generate Mind Map
            </button>
          </div>
        )}

        {data && (
          <div
            className="transition-transform duration-200 ease-out origin-center"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Visual Mind Map Tree Hierarchy */}
            <div className="flex flex-col items-center gap-12">
              {/* Root Node */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => setSelectedNode(data)}
                className={`relative px-6 py-4 rounded-2xl border shadow-lg cursor-pointer transition-all ${
                  selectedNode?.id === data.id
                    ? "border-primary ring-2 ring-primary/20 bg-primary/10"
                    : "border-border/80 bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  <span className="font-semibold text-base sm:text-lg tracking-tight" style={{ fontFamily: "Outfit" }}>
                    {data.label}
                  </span>
                </div>
                {data.summary && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs line-clamp-2">
                    {data.summary}
                  </p>
                )}
              </motion.div>

              {/* Main Branches Container */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12 relative">
                {data.children?.map((branch, bIdx) => {
                  const isCollapsed = collapsedNodes.has(branch.id);
                  const isSelected = selectedNode?.id === branch.id;

                  return (
                    <div key={branch.id} className="flex flex-col items-center relative">
                      {/* Branch Header Node */}
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: bIdx * 0.08 }}
                        onClick={() => setSelectedNode(branch)}
                        className={`w-full p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border/80 bg-card hover:border-foreground/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {branch.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(branch.id);
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                        {branch.summary && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {branch.summary}
                          </p>
                        )}
                      </motion.div>

                      {/* Sub-node Leaves */}
                      <AnimatePresence>
                        {!isCollapsed && branch.children?.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="w-full pl-4 border-l-2 border-primary/20 mt-3 space-y-2"
                          >
                            {branch.children.map((leaf) => {
                              const isLeafSelected = selectedNode?.id === leaf.id;
                              return (
                                <div
                                  key={leaf.id}
                                  onClick={() => setSelectedNode(leaf)}
                                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                    isLeafSelected
                                      ? "border-primary bg-primary/10 font-medium"
                                      : "border-border/60 bg-muted/40 hover:bg-muted"
                                  }`}
                                >
                                  <div className="font-medium text-foreground">{leaf.label}</div>
                                  {leaf.summary && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                      {leaf.summary}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Node Inspector Drawer / Card */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-4 left-6 right-6 z-20 p-4 rounded-xl border bg-background/95 backdrop-blur-md shadow-lg flex items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-primary font-semibold">
                  Node Detail
                </span>
                <span className="text-xs font-semibold text-foreground truncate">
                  {selectedNode.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {selectedNode.summary || "No specific sub-summary for this conceptual node."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `**${selectedNode.label}**: ${selectedNode.summary || ""}`
                  );
                  toast.success("Node text copied");
                }}
                className="h-7 px-2.5 text-xs rounded-md border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <Copy size={11} /> Copy
              </button>
              <button
                onClick={() => setSelectedNode(null)}
                className="h-7 px-2 text-xs rounded-md hover:bg-muted text-muted-foreground"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
