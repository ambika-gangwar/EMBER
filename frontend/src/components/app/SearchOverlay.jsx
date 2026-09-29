import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, Loader2, FileText } from "lucide-react";
import api from "@/lib/api";

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
}

export default function SearchOverlay({ onClose, onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = useRef(debounce(async (query) => {
    if (!query.trim()) { setResults([]); setBusy(false); return; }
    try {
      const { data } = await api.post("/ai/search", { query });
      setResults(data.results || []);
    } finally { setBusy(false); }
  }, 350)).current;

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setBusy(true); search(q);
  }, [q, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" data-testid="search-overlay">
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <motion.div initial={{opacity:0, y:-8, scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8}}
        className="relative w-full max-w-xl glass-strong rounded-2xl border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b">
          <Search size={16} className="opacity-60"/>
          <input ref={inputRef} value={q} onChange={(e)=>setQ(e.target.value)}
            placeholder="Search by meaning or keyword…"
            className="flex-1 bg-transparent border-0 outline-none text-base"
            data-testid="search-input"/>
          {busy && <Loader2 size={14} className="animate-spin opacity-70"/>}
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted">
            <X size={16}/>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!q.trim() && (
            <div className="p-6 text-sm text-muted-foreground">
              Try <span className="mono">"deadlines", "ideas about onboarding"</span> · ⌘K to open anytime
            </div>
          )}
          {q.trim() && !busy && results.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No matches yet.</div>
          )}
          <ul>
            {results.map((r) => (
              <li key={r.id}>
                <button onClick={() => onPick(r.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/60 flex gap-3"
                  data-testid={`search-result-${r.id}`}>
                  <FileText size={14} className="mt-1 opacity-70"/>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title || "Untitled"}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{r.snippet}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
