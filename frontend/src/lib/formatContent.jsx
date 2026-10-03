import React, { useState, useEffect } from "react";
import { Check, Copy, Info, Lightbulb, AlertTriangle, Flame, ShieldAlert, CheckSquare } from "lucide-react";

// Greek letter and math symbol lookup for pure client-side fallback
const GREEK_MAP = {
  "\\alpha": "α",
  "\\beta": "β",
  "\\gamma": "γ",
  "\\delta": "δ",
  "\\epsilon": "ε",
  "\\zeta": "ζ",
  "\\eta": "η",
  "\\theta": "θ",
  "\\iota": "ι",
  "\\kappa": "κ",
  "\\lambda": "λ",
  "\\mu": "μ",
  "\\nu": "ν",
  "\\xi": "ξ",
  "\\pi": "π",
  "\\rho": "ρ",
  "\\sigma": "σ",
  "\\tau": "τ",
  "\\upsilon": "υ",
  "\\phi": "φ",
  "\\chi": "χ",
  "\\psi": "ψ",
  "\\omega": "ω",
  "\\Gamma": "Γ",
  "\\Delta": "Δ",
  "\\Theta": "Θ",
  "\\Lambda": "Λ",
  "\\Xi": "Ξ",
  "\\Pi": "Π",
  "\\Sigma": "Σ",
  "\\Upsilon": "Υ",
  "\\Phi": "Φ",
  "\\Psi": "Ψ",
  "\\Omega": "Ω",
};

const SYMBOL_MAP = {
  "\\times": " × ",
  "\\cdot": " · ",
  "\\div": " ÷ ",
  "\\pm": " ± ",
  "\\mp": " ∓ ",
  "\\approx": " ≈ ",
  "\\neq": " ≠ ",
  "\\ne": " ≠ ",
  "\\leq": " ≤ ",
  "\\le": " ≤ ",
  "\\geq": " ≥ ",
  "\\ge": " ≥ ",
  "\\ll": " ≪ ",
  "\\gg": " ≫ ",
  "\\infty": "∞",
  "\\partial": "∂",
  "\\nabla": "∇",
  "\\rightarrow": " → ",
  "\\to": " → ",
  "\\leftarrow": " ← ",
  "\\Rightarrow": " ⇒ ",
  "\\Leftarrow": " ⇐ ",
  "\\Leftrightarrow": " ⇔ ",
  "\\sum": "∑",
  "\\prod": "∏",
  "\\int": "∫",
  "\\oint": "∮",
  "\\in": " ∈ ",
  "\\notin": " ∉ ",
  "\\subset": " ⊂ ",
  "\\subseteq": " ⊆ ",
  "\\cup": " ∪ ",
  "\\cap": " ∩ ",
  "\\forall": " ∀ ",
  "\\exists": " ∃ ",
  "\\quad": "   ",
  "\\qquad": "      ",
  "\\,": " ",
  "\\;": " ",
  "\\!": "",
};

/**
 * Pure React Math Formula Component.
 * Uses window.katex if available, otherwise renders elegant, high-legibility MathML / HTML math.
 */
export function MathFormula({ tex, displayMode = false }) {
  const [html, setHtml] = useState("");
  const cleanTex = (tex || "").trim();

  useEffect(() => {
    if (typeof window !== "undefined" && window.katex && cleanTex) {
      try {
        const rendered = window.katex.renderToString(cleanTex, {
          displayMode,
          throwOnError: false,
        });
        setHtml(rendered);
      } catch (err) {
        setHtml("");
      }
    }
  }, [cleanTex, displayMode]);

  if (html) {
    return (
      <span
        className={`katex-rendered ${displayMode ? "block my-3 py-2 px-3 text-center overflow-x-auto bg-muted/20 rounded-xl" : "inline-block px-1 align-baseline"}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Graceful High-Legibility Fallback
  return (
    <FallbackMathRenderer tex={cleanTex} displayMode={displayMode} />
  );
}

/**
 * Graceful TeX fallback parser producing clean mathematical typography without code artifacts.
 */
function FallbackMathRenderer({ tex, displayMode }) {
  let parsed = tex;

  // Replace Greek letters
  Object.entries(GREEK_MAP).forEach(([cmd, sym]) => {
    parsed = parsed.split(cmd).join(sym);
  });

  // Replace standard symbols
  Object.entries(SYMBOL_MAP).forEach(([cmd, sym]) => {
    parsed = parsed.split(cmd).join(sym);
  });

  // Handle \sqrt{...}
  parsed = parsed.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");

  // Handle \frac{a}{b} -> (a / b)
  parsed = parsed.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");

  // Handle \text{...} -> normal text
  parsed = parsed.replace(/\\text\{([^}]+)\}/g, "$1");
  parsed = parsed.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  parsed = parsed.replace(/\\mathbf\{([^}]+)\}/g, "$1");

  // Handle exponents and subscripts: x^{2} -> x² or x^2
  parsed = parsed.replace(/\^\{([^}]+)\}/g, "^$1");
  parsed = parsed.replace(/\_\{([^}]+)\}/g, "_$1");

  return (
    <span
      className={`font-serif italic tracking-wide text-foreground/95 select-text ${
        displayMode
          ? "block my-3 py-2.5 px-4 text-center text-base sm:text-lg bg-muted/20 border border-border/50 rounded-xl overflow-x-auto"
          : "inline-block px-1 font-medium not-italic font-mono text-[13.5px] bg-muted/40 rounded px-1.5 py-0.5 border border-border/30"
      }`}
    >
      {parsed}
    </span>
  );
}

/**
 * Strips raw programming syntax artifacts (like unescaped slashes `//`, `\$`, raw JSON dumps).
 */
export function cleanRawText(raw) {
  if (!raw) return "";
  let text = String(raw);

  // If text is a raw JSON string e.g. {"result": "..."} or {"reply": "..."}, extract the payload
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const obj = JSON.parse(text);
      if (obj.result) text = obj.result;
      else if (obj.reply) text = obj.reply;
      else if (obj.content) text = obj.content;
      else if (obj.structured_content) text = obj.structured_content;
    } catch {
      // not JSON, keep text
    }
  }

  // Normalize LaTeX math block delimiters: \[ ... \] -> $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, "\n\n$$$$$1$$$$\n\n");
  // Normalize LaTeX inline delimiters: \( ... \) -> $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, " $$$1$$ ");

  // Clean stray double backslashes in front of markdown tokens
  text = text.replace(/\\([*_~`#])/g, "$1");

  return text;
}

/**
 * Formats inline text segment into tokens (Math, Bold, Italic, Code, Links).
 */
export function formatInlineText(text) {
  if (!text) return "";

  // Split by inline math ($...$), inline code (`...`), bold (**...**), italic (*...*), links ([...](...))
  const regex = /(\$[^$]+\$|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];

    // Inline Math: $...$
    if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
      const tex = token.slice(1, -1);
      parts.push(<MathFormula key={`m-${keyIdx++}`} tex={tex} displayMode={false} />);
    }
    // Inline Code: `...`
    else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-[12px] sm:text-[13px] text-foreground border border-border/50"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Bold: **...**
    else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-foreground">
          {formatInlineText(token.slice(2, -2))}
        </strong>
      );
    }
    // Italic: *...*
    else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`i-${keyIdx++}`} className="italic text-foreground">
          {formatInlineText(token.slice(1, -1))}
        </em>
      );
    }
    // Strikethrough: ~~...~~
    else if (token.startsWith("~~") && token.endsWith("~~")) {
      parts.push(
        <del key={`d-${keyIdx++}`} className="line-through text-muted-foreground">
          {token.slice(2, -2)}
        </del>
      );
    }
    // Link: [text](url)
    else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={`a-${keyIdx++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Universal Rich Markdown & Math Content Renderer.
 * Used across ChatDrawer, Socratic Tutor, Note Preview, and AI Copilot.
 */
export function FormattedContent({ content, onToggleTask, className = "" }) {
  const cleaned = cleanRawText(content);
  if (!cleaned || !cleaned.trim()) return null;

  const lines = cleaned.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeBuffer = [];
  let inMathBlock = false;
  let mathBuffer = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = (key) => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-muted/50 border-b border-border font-medium text-foreground">
              <tr>
                {header.map((col, ci) => (
                  <th key={ci} className="px-3.5 py-2.5">
                    {formatInlineText(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {body.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/20 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 text-foreground/90">
                      {formatInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 1. Math Display Block: $$ ... $$
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      const formula = trimmed.slice(2, -2).trim();
      elements.push(<MathFormula key={`mb-${index}`} tex={formula} displayMode={true} />);
      return;
    }

    if (trimmed === "$$") {
      if (inMathBlock) {
        elements.push(
          <MathFormula key={`mb-block-${index}`} tex={mathBuffer.join("\n")} displayMode={true} />
        );
        mathBuffer = [];
        inMathBlock = false;
      } else {
        inMathBlock = true;
      }
      return;
    }

    if (inMathBlock) {
      mathBuffer.push(line);
      return;
    }

    // 2. Fenced Code Block: ```lang ... ```
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <CodeBlockItem
            key={`cb-${index}`}
            code={codeBuffer.join("\n")}
            lang={codeLang}
          />
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        codeLang = trimmed.slice(3).trim();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // 3. Table Rows (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Check if it's separator row | :--- | :--- |
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        return;
      }
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      inTable = true;
      return;
    } else if (inTable) {
      flushTable(index);
    }

    // 4. Blank lines
    if (!trimmed) {
      elements.push(<div key={`blank-${index}`} className="h-2.5" />);
      return;
    }

    // 5. Callouts (> [!NOTE], > [!TIP], > 💡)
    const calloutMatch =
      line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i) ||
      line.match(/^>\s*💡\s*(.*)$/);
    if (calloutMatch) {
      const type = (calloutMatch[1] || "NOTE").toUpperCase();
      const text = calloutMatch[2] || calloutMatch[1];
      const isWarn = type === "WARNING" || type === "CAUTION";
      const isTip = type === "TIP" || line.includes("💡");

      elements.push(
        <div
          key={`co-${index}`}
          className={`my-3 p-3.5 rounded-xl border flex items-start gap-3 text-xs sm:text-sm leading-relaxed ${
            isWarn
              ? "bg-rose-500/5 border-rose-500/30 text-rose-800 dark:text-rose-300"
              : isTip
              ? "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "bg-blue-500/5 border-blue-500/30 text-blue-900 dark:text-blue-200"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {isWarn ? (
              <AlertTriangle size={15} className="text-rose-500" />
            ) : isTip ? (
              <Lightbulb size={15} className="text-amber-500" />
            ) : (
              <Info size={15} className="text-blue-500" />
            )}
          </div>
          <div className="flex-1">{formatInlineText(text)}</div>
        </div>
      );
      return;
    }

    // 6. Regular Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteText = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote
          key={`bq-${index}`}
          className="my-2.5 pl-3.5 border-l-2 border-primary/50 text-xs sm:text-sm italic text-foreground/80 leading-relaxed"
        >
          {formatInlineText(quoteText)}
        </blockquote>
      );
      return;
    }

    // 7. Headings (#, ##, ###, ####)
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${index}`} className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-5 mb-2">
          {formatInlineText(trimmed.slice(2))}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${index}`} className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mt-4 mb-1.5">
          {formatInlineText(trimmed.slice(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${index}`} className="text-sm sm:text-base font-semibold text-foreground mt-3 mb-1">
          {formatInlineText(trimmed.slice(4))}
        </h3>
      );
      return;
    }

    // 8. Interactive Checklist Tasks (- [ ] or - [x])
    const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[2].toLowerCase() === "x";
      const taskText = taskMatch[3];
      elements.push(
        <div key={`task-${index}`} className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleTask && onToggleTask(index)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary cursor-pointer accent-primary"
          />
          <span className={`leading-relaxed ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {formatInlineText(taskText)}
          </span>
        </div>
      );
      return;
    }

    // 9. Bulleted List (- ... or * ...)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2 my-1 text-xs sm:text-sm">
          <span className="text-muted-foreground mt-1 text-[8px] shrink-0">●</span>
          <span className="leading-relaxed text-foreground flex-1">
            {formatInlineText(trimmed.slice(2))}
          </span>
        </div>
      );
      return;
    }

    // 10. Numbered List (1. ...)
    const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${index}`} className="flex items-start gap-2 my-1 text-xs sm:text-sm">
          <span className="font-mono text-muted-foreground text-xs shrink-0 w-4 text-right">
            {numMatch[1]}.
          </span>
          <span className="leading-relaxed text-foreground flex-1">
            {formatInlineText(numMatch[2])}
          </span>
        </div>
      );
      return;
    }

    // 11. Standard Paragraph
    elements.push(
      <p key={`p-${index}`} className="my-1.5 text-xs sm:text-sm leading-relaxed text-foreground/90">
        {formatInlineText(line)}
      </p>
    );
  });

  if (inTable) {
    flushTable("end");
  }

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}

function CodeBlockItem({ code, lang }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 rounded-xl border border-border/80 bg-muted/40 overflow-hidden text-xs font-mono">
      <div className="px-3.5 py-1.5 bg-muted/70 border-b border-border/60 flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <span>{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-foreground/90 leading-relaxed font-mono select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}
