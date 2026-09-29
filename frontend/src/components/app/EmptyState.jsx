import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { EmberMascot } from "@/components/Logo";

export default function EmptyState({ onCreate }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
        <div className="mx-auto flex justify-center mb-6">
          <EmberMascot size={84} withGlow={true} />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
          A blank page is a beautiful spark.
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Ember is a spark that helps ideas grow. Capture a thought, outline a thesis, or start a study guide.
        </p>
        <button
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-full bg-foreground text-background font-semibold hover:opacity-90 transition-opacity shadow-sm"
          data-testid="empty-create-btn"
        >
          <Plus size={16} /> Create your first note
        </button>
      </motion.div>
    </div>
  );
}
