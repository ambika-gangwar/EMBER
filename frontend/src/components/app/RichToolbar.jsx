import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Columns2,
  Eye,
  PenTool,
} from "lucide-react";

export default function RichToolbar({ onFormat, viewMode, onViewModeChange }) {
  const tools = [
    { label: "Bold", icon: Bold, action: () => onFormat("bold"), title: "Bold (Ctrl+B)" },
    { label: "Italic", icon: Italic, action: () => onFormat("italic"), title: "Italic (Ctrl+I)" },
    { label: "Strikethrough", icon: Strikethrough, action: () => onFormat("strike"), title: "Strikethrough" },
    { label: "Code", icon: Code, action: () => onFormat("code"), title: "Inline Code" },
    { divider: true },
    { label: "H1", icon: Heading1, action: () => onFormat("h1"), title: "Heading 1" },
    { label: "H2", icon: Heading2, action: () => onFormat("h2"), title: "Heading 2" },
    { label: "H3", icon: Heading3, action: () => onFormat("h3"), title: "Heading 3" },
    { divider: true },
    { label: "Bullet List", icon: List, action: () => onFormat("bullet"), title: "Bullet List" },
    { label: "Numbered List", icon: ListOrdered, action: () => onFormat("numbered"), title: "Numbered List" },
    { label: "Task List", icon: CheckSquare, action: () => onFormat("task"), title: "Task Checklist" },
    { label: "Quote", icon: Quote, action: () => onFormat("quote"), title: "Blockquote" },
  ];

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-1 p-1 rounded-xl border bg-card/70 backdrop-blur-sm text-sm"
      data-testid="rich-toolbar"
    >
      {/* Formatting buttons */}
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {tools.map((t, i) =>
          t.divider ? (
            <div key={i} className="h-4 w-px bg-border mx-1 my-auto" />
          ) : (
            <button
              key={t.label}
              type="button"
              onClick={t.action}
              title={t.title}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              data-testid={`toolbar-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <t.icon size={13} />
            </button>
          )
        )}
      </div>

      {/* View Mode Toggle: Edit / Split / Preview */}
      <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg ml-auto">
        <button
          type="button"
          onClick={() => onViewModeChange("edit")}
          title="Editor mode"
          className={`h-6 px-2 text-xs rounded-md inline-flex items-center gap-1 transition-all ${
            viewMode === "edit"
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="view-mode-edit"
        >
          <PenTool size={11} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("split")}
          title="Split view"
          className={`h-6 px-2 text-xs rounded-md inline-flex items-center gap-1 transition-all ${
            viewMode === "split"
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="view-mode-split"
        >
          <Columns2 size={11} /> Split
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("preview")}
          title="Formatted preview"
          className={`h-6 px-2 text-xs rounded-md inline-flex items-center gap-1 transition-all ${
            viewMode === "preview"
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="view-mode-preview"
        >
          <Eye size={11} /> Preview
        </button>
      </div>
    </div>
  );
}
