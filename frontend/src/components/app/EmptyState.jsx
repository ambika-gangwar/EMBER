import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Logo from "@/components/Logo";

export default function EmptyState({ onCreate }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md text-center"
      >
        <div className="mx-auto flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-secondary/80 border border-border/80 flex items-center justify-center shadow-ambient">
            <Logo size={32} />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Start with a thought.
        </h2>
        <p className="mt-2.5 text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Capture something worth remembering. Refine mental models, take active-recall notes, or write freely.
        </p>
        <button
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-ambient"
          data-testid="empty-create-btn"
        >
          <Plus size={14} /> New note
        </button>
      </motion.div>
    </div>
  );
}
