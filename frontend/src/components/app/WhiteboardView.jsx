import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  ArrowRight,
  Minus,
  StickyNote,
  Type,
  MousePointer,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Sparkles,
  Loader2,
  Grid,
  Check,
  PanelBottomOpen,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const COLORS = [
  { name: "Obsidian", value: "#1e1e24" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Crimson", value: "#ef4444" },
  { name: "Emerald", value: "#10b981" },
  { name: "Azure", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Charcoal", value: "#6b7280" },
  { name: "Paper White", value: "#ffffff" },
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 8 },
  { label: "Heavy", value: 16 },
];

const STICKY_COLORS = [
  { name: "Amber", bg: "bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100" },
  { name: "Yellow", bg: "bg-yellow-100 dark:bg-yellow-950/80 border-yellow-300 dark:border-yellow-800 text-yellow-950 dark:text-yellow-100" },
  { name: "Mint", bg: "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100" },
  { name: "Sky", bg: "bg-sky-100 dark:bg-sky-950/80 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100" },
  { name: "Rose", bg: "bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100" },
  { name: "Lavender", bg: "bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-100" },
];

export default function WhiteboardView({
  noteId,
  noteTitle = "",
  onInsertImage,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Tools: 'select' | 'pan' | 'pen' | 'brush' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'line' | 'sticky' | 'text'
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#f59e0b");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [gridStyle, setGridStyle] = useState("dots"); // 'dots' | 'grid' | 'blank'

  // Viewport transformation: pan & zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  // Data Elements: Array of shapes / paths / stickies / texts
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Active drawing state
  const [currentElement, setCurrentElement] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const isDrawing = useRef(false);
  const saveTimeoutRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Load Persisted Drawing
  useEffect(() => {
    if (!noteId) return;
    api
      .get(`/notes/${noteId}/drawing`)
      .then(({ data }) => {
        if (data.elements && data.elements.length > 0) {
          setElements(data.elements);
          setHistory([data.elements]);
          setHistoryStep(0);
        }
        if (data.app_state?.scale) setScale(data.app_state.scale);
        if (data.app_state?.pan) setPan(data.app_state.pan);
      })
      .catch(() => {});
  }, [noteId]);

  // Debounced Autosave to Backend
  const triggerAutoSave = useCallback(
    (newElements, newPan = pan, newScale = scale) => {
      if (!noteId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaving(true);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await api.post(`/notes/${noteId}/drawing`, {
            elements: newElements,
            app_state: { pan: newPan, scale: newScale },
          });
          setSaving(false);
        } catch {
          setSaving(false);
        }
      }, 1000);
    },
    [noteId, pan, scale]
  );

  // Push into undo/redo history
  const pushHistory = (newElements) => {
    const updatedHistory = history.slice(0, historyStep + 1);
    updatedHistory.push(newElements);
    setHistory(updatedHistory);
    setHistoryStep(updatedHistory.length - 1);
    triggerAutoSave(newElements);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      const prevElements = history[prevStep];
      setHistoryStep(prevStep);
      setElements(prevElements);
      triggerAutoSave(prevElements);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      const nextElements = history[nextStep];
      setHistoryStep(nextStep);
      setElements(nextElements);
      triggerAutoSave(nextElements);
    }
  };

  // Convert Screen/Pointer coordinates to Canvas World coordinates
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  // Canvas redraw effect
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply viewport transformation
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Render all elements
    const renderList = currentElement ? [...elements, currentElement] : elements;

    renderList.forEach((el) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "pen" || el.type === "brush") {
        if (!el.points || el.points.length < 2) {
          ctx.restore();
          return;
        }
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.type === "brush" ? el.width * 2.5 : el.width;
        ctx.globalAlpha = el.type === "brush" ? 0.75 : 1;

        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);

        for (let i = 1; i < el.points.length - 1; i++) {
          const xc = (el.points[i].x + el.points[i + 1].x) / 2;
          const yc = (el.points[i].y + el.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, xc, yc);
        }

        const last = el.points[el.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      } else if (el.type === "highlighter") {
        if (!el.points || el.points.length < 2) {
          ctx.restore();
          return;
        }
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width * 4.5;
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = "multiply";

        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === "rect") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.fillStyle = `${el.color}15`;
        const x = Math.min(el.x1, el.x2);
        const y = Math.min(el.y1, el.y2);
        const w = Math.abs(el.x2 - el.x1);
        const h = Math.abs(el.y2 - el.y1);

        // Rounded rect
        const radius = Math.min(10, w / 4, h / 4);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        ctx.stroke();
      } else if (el.type === "circle") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.fillStyle = `${el.color}15`;
        const rx = Math.abs(el.x2 - el.x1) / 2;
        const ry = Math.abs(el.y2 - el.y1) / 2;
        const cx = (el.x1 + el.x2) / 2;
        const cy = (el.y1 + el.y2) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (el.type === "line") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === "arrow") {
        ctx.strokeStyle = el.color;
        ctx.fillStyle = el.color;
        ctx.lineWidth = el.width;

        // Draw shaft
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();

        // Draw Arrowhead
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const headlen = Math.max(12, el.width * 3.5);
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(
          el.x2 - headlen * Math.cos(angle - Math.PI / 6),
          el.y2 - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          el.x2 - headlen * Math.cos(angle + Math.PI / 6),
          el.y2 - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });
  }, [elements, currentElement, pan, scale]);

  // Sync canvas dimensions with parent container
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      redrawCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Touch & Pointer Down
  const handlePointerDown = (e) => {
    // Only handle primary touches
    if (!e.isPrimary) return;

    // Pan mode or Spacebar pan
    if (tool === "pan" || e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const { x, y } = getCanvasCoords(e);
    isDrawing.current = true;

    if (tool === "pen" || tool === "brush" || tool === "highlighter") {
      const newEl = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: tool,
        points: [{ x, y }],
        color,
        width: strokeWidth,
      };
      setCurrentElement(newEl);
    } else if (["rect", "circle", "line", "arrow"].includes(tool)) {
      const newEl = {
        id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: tool,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color,
        width: strokeWidth,
      };
      setCurrentElement(newEl);
    } else if (tool === "sticky") {
      const newSticky = {
        id: `sticky_${Date.now()}`,
        type: "sticky",
        x,
        y,
        width: 190,
        height: 150,
        text: "New idea or reflection...",
        colorIdx: 0,
      };
      const updated = [...elements, newSticky];
      setElements(updated);
      pushHistory(updated);
      setTool("select");
      setSelectedElementId(newSticky.id);
    } else if (tool === "text") {
      const newText = {
        id: `text_${Date.now()}`,
        type: "text",
        x,
        y,
        text: "Type notes here...",
        color,
        fontSize: strokeWidth > 4 ? 20 : 15,
      };
      const updated = [...elements, newText];
      setElements(updated);
      pushHistory(updated);
      setTool("select");
      setSelectedElementId(newText.id);
    } else if (tool === "eraser") {
      eraseAt(x, y);
    }
  };

  // Touch & Pointer Move
  const handlePointerMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      const newPan = { x: pan.x + dx, y: pan.y + dy };
      setPan(newPan);
      return;
    }

    if (!isDrawing.current) return;
    const { x, y } = getCanvasCoords(e);

    if (tool === "pen" || tool === "brush" || tool === "highlighter") {
      if (currentElement) {
        setCurrentElement((prev) => ({
          ...prev,
          points: [...prev.points, { x, y }],
        }));
      }
    } else if (["rect", "circle", "line", "arrow"].includes(tool)) {
      if (currentElement) {
        setCurrentElement((prev) => ({
          ...prev,
          x2: x,
          y2: y,
        }));
      }
    } else if (tool === "eraser") {
      eraseAt(x, y);
    }
  };

  // Touch & Pointer Up
  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      triggerAutoSave(elements, pan, scale);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentElement) {
      const updated = [...elements, currentElement];
      setElements(updated);
      setCurrentElement(null);
      pushHistory(updated);
    }
  };

  // Eraser collision check
  const eraseAt = (x, y) => {
    const threshold = 18 / scale;
    const remaining = elements.filter((el) => {
      if (el.type === "pen" || el.type === "brush" || el.type === "highlighter") {
        return !el.points.some(
          (p) => Math.hypot(p.x - x, p.y - y) < threshold + el.width
        );
      }
      if (el.type === "rect" || el.type === "circle") {
        const minX = Math.min(el.x1, el.x2) - threshold;
        const maxX = Math.max(el.x1, el.x2) + threshold;
        const minY = Math.min(el.y1, el.y2) - threshold;
        const maxY = Math.max(el.y1, el.y2) + threshold;
        return !(x >= minX && x <= maxX && y >= minY && y <= maxY);
      }
      if (el.type === "sticky") {
        return !(x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height);
      }
      return true;
    });

    if (remaining.length !== elements.length) {
      setElements(remaining);
      pushHistory(remaining);
    }
  };

  // Sticky Note & Text Updates
  const updateStickyText = (id, newText) => {
    const updated = elements.map((el) => (el.id === id ? { ...el, text: newText } : el));
    setElements(updated);
    triggerAutoSave(updated);
  };

  const updateStickyColor = (id) => {
    const updated = elements.map((el) => {
      if (el.id === id) {
        const nextIdx = ((el.colorIdx || 0) + 1) % STICKY_COLORS.length;
        return { ...el, colorIdx: nextIdx };
      }
      return el;
    });
    setElements(updated);
    triggerAutoSave(updated);
  };

  const deleteElement = (id) => {
    const updated = elements.filter((el) => el.id !== id);
    setElements(updated);
    pushHistory(updated);
    setSelectedElementId(null);
  };

  // Export to PNG Image
  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${(noteTitle || "Ember_Whiteboard").replace(/\s+/g, "_")}.png`;
    link.href = url;
    link.click();
    toast.success("Exported whiteboard image");
  };

  // Insert Drawing Image directly into Note Markdown
  const handleInsertIntoNote = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const imageMarkdown = `\n\n![Whiteboard Diagram](${dataUrl})\n*Diagram: ${noteTitle || "Visual Brainstorm"}*\n\n`;
    if (onInsertImage) {
      onInsertImage(imageMarkdown);
      toast.success("Whiteboard diagram embedded into note!");
    } else {
      toast.info("Switched to note editor to view image");
    }
  };

  // Clear Canvas with confirmation
  const handleClear = () => {
    if (elements.length === 0) return;
    if (window.confirm("Clear all drawings and sticky notes on this whiteboard?")) {
      setElements([]);
      pushHistory([]);
      toast.success("Whiteboard cleared");
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "p" || e.key === "P") {
        setTool("pen");
      } else if (e.key === "h" || e.key === "H") {
        setTool("highlighter");
      } else if (e.key === "e" || e.key === "E") {
        setTool("eraser");
      } else if (e.key === "r" || e.key === "R") {
        setTool("rect");
      } else if (e.key === "c" || e.key === "C") {
        setTool("circle");
      } else if (e.key === "s" || e.key === "S") {
        setTool("sticky");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[680px] sm:h-[750px] rounded-2xl border border-border/80 bg-card overflow-hidden select-none flex flex-col shadow-inner"
      style={{ touchAction: "none" }}
    >
      {/* Dynamic Background Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            gridStyle === "dots"
              ? "radial-gradient(circle, currentColor 0.75px, transparent 0.75px)"
              : gridStyle === "grid"
              ? "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)"
              : "none",
          backgroundSize:
            gridStyle === "dots"
              ? `${24 * scale}px ${24 * scale}px`
              : `${36 * scale}px ${36 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* HTML DOM Layer for Sticky Notes & Floating Text */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {elements
          .filter((el) => el.type === "sticky" || el.type === "text")
          .map((el) => {
            if (el.type === "sticky") {
              const colorTheme = STICKY_COLORS[el.colorIdx || 0] || STICKY_COLORS[0];
              return (
                <div
                  key={el.id}
                  style={{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    minHeight: `${el.height}px`,
                  }}
                  className={`absolute pointer-events-auto rounded-xl p-3 shadow-md border ${colorTheme.bg} flex flex-col justify-between transition-all group`}
                >
                  <div className="flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity mb-1.5">
                    <button
                      onClick={() => updateStickyColor(el.id)}
                      className="text-[10px] uppercase font-bold tracking-wider hover:opacity-80"
                      title="Change color"
                    >
                      Theme
                    </button>
                    <button
                      onClick={() => deleteElement(el.id)}
                      className="text-xs hover:text-rose-500 transition-colors"
                      title="Delete card"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={el.text}
                    onChange={(e) => updateStickyText(el.id, e.target.value)}
                    placeholder="Write idea..."
                    className="w-full flex-1 bg-transparent border-0 outline-none resize-none text-xs font-sans leading-relaxed text-inherit"
                  />
                </div>
              );
            }

            if (el.type === "text") {
              return (
                <div
                  key={el.id}
                  style={{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    color: el.color,
                    fontSize: `${el.fontSize || 16}px`,
                  }}
                  className="absolute pointer-events-auto group min-w-[120px]"
                >
                  <input
                    value={el.text}
                    onChange={(e) => updateStickyText(el.id, e.target.value)}
                    className="bg-transparent border-b border-transparent focus:border-border outline-none font-medium text-inherit w-full"
                  />
                </div>
              );
            }
            return null;
          })}
      </div>

      {/* Main Vector / Freehand Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 w-full h-full ${
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
        }`}
        style={{ touchAction: "none" }}
      />

      {/* Top Floating Controls & Telemetry */}
      <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto bg-background/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/70 shadow-xs text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Whiteboard Studio</span>
          <span className="opacity-60">·</span>
          <span>{saving ? "Saving..." : "Autosaved"}</span>
        </div>

        {/* Zoom & Canvas Actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-background/85 backdrop-blur-md p-1 rounded-xl border border-border/70 shadow-xs text-xs">
          <button
            onClick={() => setGridStyle((g) => (g === "dots" ? "grid" : g === "grid" ? "blank" : "dots"))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title={`Canvas grid: ${gridStyle}`}
          >
            <Grid size={13} />
          </button>

          <div className="h-3 w-px bg-border/60 mx-0.5" />

          <button
            onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Zoom out (-)"
          >
            <ZoomOut size={13} />
          </button>

          <button
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            title="Reset zoom & view"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Zoom in (+)"
          >
            <ZoomIn size={13} />
          </button>

          <div className="h-3 w-px bg-border/60 mx-0.5" />

          <button
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 transition-colors"
            title="Undo (⌘Z)"
          >
            <Undo2 size={13} />
          </button>

          <button
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 transition-colors"
            title="Redo (⌘Y)"
          >
            <Redo2 size={13} />
          </button>

          <div className="h-3 w-px bg-border/60 mx-0.5" />

          <button
            onClick={handleInsertIntoNote}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium text-[11px] transition-colors"
            title="Insert snapshot of whiteboard diagram into active note markdown"
          >
            <Plus size={11} />
            <span>Embed in Note</span>
          </button>

          <button
            onClick={exportImage}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Export PNG Image"
          >
            <Download size={13} />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Clear whiteboard"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Floating Bottom Tactile Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2">
        {/* Secondary Palette & Stroke Picker (Pencil / Shape Active) */}
        {tool !== "eraser" && tool !== "pan" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-background/90 backdrop-blur-md border border-border/70 shadow-ambient"
          >
            {/* Ink Swatches */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    color === c.value
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            <div className="h-3 w-px bg-border/60 mx-1" />

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  onClick={() => setStrokeWidth(sw.value)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    strokeWidth === sw.value
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sw.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Primary Tool Dock */}
        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-background/90 backdrop-blur-md border border-border/70 shadow-ambient">
          <ToolButton
            active={tool === "pen"}
            onClick={() => setTool("pen")}
            icon={<Pencil size={15} />}
            label="Pen (P)"
          />
          <ToolButton
            active={tool === "brush"}
            onClick={() => setTool("brush")}
            icon={<Sparkles size={15} />}
            label="Marker Brush"
          />
          <ToolButton
            active={tool === "highlighter"}
            onClick={() => setTool("highlighter")}
            icon={<Highlighter size={15} />}
            label="Highlighter (H)"
          />
          <ToolButton
            active={tool === "eraser"}
            onClick={() => setTool("eraser")}
            icon={<Eraser size={15} />}
            label="Eraser (E)"
          />

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          <ToolButton
            active={tool === "rect"}
            onClick={() => setTool("rect")}
            icon={<Square size={15} />}
            label="Rectangle (R)"
          />
          <ToolButton
            active={tool === "circle"}
            onClick={() => setTool("circle")}
            icon={<Circle size={15} />}
            label="Circle (C)"
          />
          <ToolButton
            active={tool === "arrow"}
            onClick={() => setTool("arrow")}
            icon={<ArrowRight size={15} />}
            label="Arrow Vector"
          />
          <ToolButton
            active={tool === "line"}
            onClick={() => setTool("line")}
            icon={<Minus size={15} />}
            label="Straight Line"
          />

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          <ToolButton
            active={tool === "sticky"}
            onClick={() => setTool("sticky")}
            icon={<StickyNote size={15} />}
            label="Sticky Card (S)"
          />
          <ToolButton
            active={tool === "text"}
            onClick={() => setTool("text")}
            icon={<Type size={15} />}
            label="Text Label"
          />
          <ToolButton
            active={tool === "pan"}
            onClick={() => setTool("pan")}
            icon={<Hand size={15} />}
            label="Hand / Pan"
          />
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-xl text-xs font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-xs scale-105"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
      }`}
      title={label}
    >
      {icon}
    </button>
  );
}
