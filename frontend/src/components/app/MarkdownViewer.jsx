import React from "react";
import { FormattedContent } from "@/lib/formatContent";

export default function MarkdownViewer({ content, onToggleTask, className = "" }) {
  if (!content || !content.trim()) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground italic select-none">
        No content to preview yet. Start typing to see beautifully formatted text & formulas.
      </div>
    );
  }

  return (
    <div className={`prose-container max-w-none text-foreground font-sans leading-relaxed ${className}`}>
      <FormattedContent content={content} onToggleTask={onToggleTask} />
    </div>
  );
}
