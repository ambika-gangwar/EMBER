import React from "react";
import { Check, Info, Lightbulb, AlertTriangle, Flame } from "lucide-react";

function renderFormattedText(text) {
  if (!text) return "";
  // Split on bold, italic, and inline code tokens
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  // Simple parser for **bold**, *italic*, `code`, and ~~strike~~
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={keyIdx++} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={keyIdx++} className="italic text-foreground">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-muted font-mono text-[13px] border border-border/40">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      parts.push(<del key={keyIdx++} className="line-through text-muted-foreground">{token.slice(2, -2)}</del>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export default function MarkdownViewer({ content, onToggleTask }) {
  if (!content || !content.trim()) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground italic">
        No content to preview yet. Start typing to see formatted text.
      </div>
    );
  }

  const lines = content.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  lines.forEach((line, index) => {
    // Fenced Code Block
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${index}`}
            className="my-3 p-4 rounded-xl bg-muted/80 text-xs font-mono overflow-x-auto border"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      elements.push(<div key={`blank-${index}`} className="h-3" />);
      return;
    }

    // Callout Box (> [!NOTE] or > [!TIP] or > 💡)
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i) || line.match(/^>\s*💡\s*(.*)$/);
    if (calloutMatch) {
      const type = (calloutMatch[1] || "NOTE").toUpperCase();
      const text = calloutMatch[2] || calloutMatch[1];
      const isWarn = type === "WARNING" || type === "CAUTION";
      const isTip = type === "TIP" || line.includes("💡");

      elements.push(
        <div
          key={`callout-${index}`}
          className={`my-3 p-3.5 rounded-xl border flex items-start gap-3 text-sm leading-relaxed ${
            isWarn
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
              : isTip
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
              : "bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-200"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {isWarn ? <AlertTriangle size={15} /> : isTip ? <Lightbulb size={15} /> : <Info size={15} />}
          </div>
          <div className="flex-1">
            <span className="font-semibold text-xs tracking-wider uppercase block mb-0.5 opacity-80">{type}</span>
            <div>{renderFormattedText(text)}</div>
          </div>
        </div>
      );
      return;
    }

    // Task Checklist: - [ ] or - [x]
    const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[2].toLowerCase() === "x";
      const text = taskMatch[3];
      elements.push(
        <div
          key={`task-${index}`}
          onClick={() => onToggleTask && onToggleTask(index)}
          className="flex items-start gap-2.5 my-1.5 cursor-pointer group select-none transition-opacity hover:opacity-80"
          data-testid={`task-checkbox-${index}`}
        >
          <div
            className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-all ${
              isChecked
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "border-muted-foreground/40 group-hover:border-foreground"
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3} />}
          </div>
          <span
            className={`text-base leading-relaxed ${
              isChecked ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {renderFormattedText(text)}
          </span>
        </div>
      );
      return;
    }

    // Heading 1
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${index}`}
          className="text-2xl sm:text-3xl font-semibold tracking-tight mt-6 mb-2"
          style={{ fontFamily: "Outfit" }}
        >
          {renderFormattedText(line.replace(/^#\s+/, ""))}
        </h1>
      );
      return;
    }

    // Heading 2
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${index}`}
          className="text-xl sm:text-2xl font-semibold tracking-tight mt-5 mb-2"
          style={{ fontFamily: "Outfit" }}
        >
          {renderFormattedText(line.replace(/^##\s+/, ""))}
        </h2>
      );
      return;
    }

    // Heading 3
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${index}`}
          className="text-lg font-medium tracking-tight mt-4 mb-1"
          style={{ fontFamily: "Outfit" }}
        >
          {renderFormattedText(line.replace(/^###\s+/, ""))}
        </h3>
      );
      return;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-foreground/30 pl-4 py-1 italic text-muted-foreground my-2.5 bg-muted/20 rounded-r-lg"
        >
          {renderFormattedText(line.replace(/^>\s+/, ""))}
        </blockquote>
      );
      return;
    }

    // Bullet List
    if (line.match(/^(\s*)[-*+]\s+/)) {
      elements.push(
        <li key={`bullet-${index}`} className="ml-5 list-disc my-1 leading-relaxed text-base">
          {renderFormattedText(line.replace(/^(\s*)[-*+]\s+/, ""))}
        </li>
      );
      return;
    }

    // Numbered List
    if (line.match(/^(\s*)\d+\.\s+/)) {
      elements.push(
        <li key={`num-${index}`} className="ml-5 list-decimal my-1 leading-relaxed text-base">
          {renderFormattedText(line.replace(/^(\s*)\d+\.\s+/, ""))}
        </li>
      );
      return;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={`hr-${index}`} className="my-6 border-border" />);
      return;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${index}`} className="my-1.5 text-base leading-relaxed">
        {renderFormattedText(line)}
      </p>
    );
  });

  return (
    <div className="prose-note max-w-none text-foreground" data-testid="markdown-preview">
      {elements}
    </div>
  );
}
