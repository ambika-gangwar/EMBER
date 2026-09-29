import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Network, Loader2, ZoomIn, ZoomOut, Maximize2, Sparkles, FileText } from "lucide-react";
import api from "@/lib/api";

export default function KnowledgeGraphModal({ open, onClose }) {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const canvasRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get("/notes/graph")
      .then(({ data }) => {
        setGraph(data || { nodes: [], links: [] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Render Force/Orbit Graph on Canvas
  useEffect(() => {
    if (!open || !canvasRef.current || graph.nodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Simple deterministic radial layout for notes
    const nodeCount = graph.nodes.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const nodePositions = new Map();
    graph.nodes.forEach((n, i) => {
      const angle = (i / nodeCount) * 2 * Math.PI;
      const r = radius * (0.6 + (i % 3) * 0.2);
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      nodePositions.set(n.id, { x, y, node: n });
    });

    let animId;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw links
      graph.links.forEach((l) => {
        const p1 = nodePositions.get(l.source);
        const p2 = nodePositions.get(l.target);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = "rgba(150, 150, 150, 0.25)";
          ctx.lineWidth = Math.min(3, l.weight || 1);
          ctx.stroke();

          if (l.label) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.fillStyle = "rgba(130, 130, 130, 0.7)";
            ctx.font = "9px sans-serif";
            ctx.fillText(l.label, mx + 2, my - 2);
          }
        }
      });

      // Draw nodes
      nodePositions.forEach((pos) => {
        const isHovered = hoveredNode?.id === pos.node.id;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isHovered ? 10 : 7, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#3b82f6" : "#6366f1";
        ctx.shadowColor = isHovered ? "rgba(59, 130, 246, 0.5)" : "transparent";
        ctx.shadowBlur = isHovered ? 12 : 0;
        ctx.fill();

        // Node Title Label
        ctx.fillStyle = isHovered ? "#111827" : "#4b5563";
        ctx.font = isHovered ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.textAlign = "center";
        const title = pos.node.title.length > 18 ? pos.node.title.slice(0, 18) + "..." : pos.node.title;
        ctx.fillText(title, pos.x, pos.y + 18);
      });
    };

    render();

    // Hover detection
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      let found = null;
      nodePositions.forEach((pos) => {
        const dx = mx - pos.x;
        const dy = my - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 14) {
          found = pos.node;
        }
      });
      setHoveredNode(found);
      render();
    };

    const handleClick = (e) => {
      if (hoveredNode) {
        onClose();
        nav(`/app/n/${hoveredNode.id}`);
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [open, graph, hoveredNode, nav, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl h-[640px] rounded-3xl border bg-card shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={18} className="text-primary" />
            <div>
              <h3 className="font-semibold text-base sm:text-lg tracking-tight" style={{ fontFamily: "Outfit" }}>
                Workspace Knowledge Graph
              </h3>
              <p className="text-xs text-muted-foreground">
                {graph.nodes.length} notes · {graph.links.length} semantic connections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative flex items-center justify-center bg-muted/20">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs">Mapping knowledge network...</span>
            </div>
          )}

          {!loading && graph.nodes.length === 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              Create notes to start visualizing your interconnected thinking network.
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={850}
            height={500}
            className="w-full h-full cursor-pointer"
          />

          {hoveredNode && (
            <div className="absolute bottom-4 left-6 right-6 p-3 rounded-xl border bg-background/90 backdrop-blur-md shadow-md flex items-center justify-between text-xs pointer-events-none">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <span className="font-medium text-foreground">{hoveredNode.title}</span>
                <span className="text-muted-foreground">({hoveredNode.words} words)</span>
              </div>
              <span className="text-primary font-medium">Click node to open →</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
