import { Flag, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const PRIORITY_META = {
  none:   { label: "No priority", dot: "bg-muted-foreground/30",  text: "text-muted-foreground" },
  low:    { label: "Low",         dot: "bg-sky-500",              text: "text-sky-600 dark:text-sky-400" },
  medium: { label: "Medium",      dot: "bg-amber-500",            text: "text-amber-600 dark:text-amber-400" },
  high:   { label: "High",        dot: "bg-rose-500",             text: "text-rose-600 dark:text-rose-400" },
};

const ORDER = ["none", "low", "medium", "high"];

export default function PriorityPicker({ value = "none", onChange }) {
  const meta = PRIORITY_META[value] || PRIORITY_META.none;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md hover:bg-muted text-sm"
          data-testid="editor-priority-btn">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <Flag size={13} className={`${value === "none" ? "opacity-60" : meta.text}`} />
          <span className={value === "none" ? "" : meta.text}>{meta.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {ORDER.map((k) => {
          const m = PRIORITY_META[k];
          return (
            <DropdownMenuItem key={k} onClick={() => onChange(k)} data-testid={`priority-option-${k}`}
              className="cursor-pointer">
              <span className={`h-2 w-2 rounded-full mr-2 ${m.dot}`} />
              <span className="flex-1">{m.label}</span>
              {value === k && <Check size={13} className="opacity-70" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
