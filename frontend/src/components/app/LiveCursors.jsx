import { motion } from "framer-motion";

export default function LiveCursors({ remoteCursors }) {
  const cursors = Object.values(remoteCursors || {}).filter(
    (c) => Date.now() - (c.timestamp || 0) < 15000
  );

  if (cursors.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" data-testid="live-cursors-overlay">
      {cursors.map((c, i) => (
        <motion.div
          key={c.name + i}
          animate={{ x: c.x, y: c.y }}
          transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.5 }}
          className="absolute top-0 left-0"
          style={{ willChange: "transform" }}
        >
          {/* Custom SVG Cursor Arrow */}
          <svg
            className="w-4 h-4 drop-shadow-md"
            viewBox="0 0 24 24"
            fill={c.color || "#F59E0B"}
            stroke="#ffffff"
            strokeWidth="1.5"
          >
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" />
          </svg>

          {/* User Name Pill Tag */}
          <div
            className="ml-3 -mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white shadow-md truncate max-w-[120px]"
            style={{ backgroundColor: c.color || "#F59E0B" }}
            data-testid={`remote-cursor-tag-${c.name}`}
          >
            {c.name}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
