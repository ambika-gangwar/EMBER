import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import {
  Sun,
  Moon,
  PenTool,
  Layers,
  Search,
  Brain,
  FileDown,
  Users,
  ArrowUpRight,
  Sparkles,
  Network,
  Share2,
  CheckCircle2,
  BookOpen,
  Compass,
  Lock,
} from "lucide-react";

const PILLARS = [
  {
    category: "Thought & Writing",
    title: "A distraction-free writing sanctuary",
    desc: "Clean markdown canvas with borderless typography, inline slash commands (/), split preview, and publication-grade PDF export.",
    icon: PenTool,
    highlights: ["Slash commands (/)", "Live markdown preview", "Reading time & word telemetry", "Clean PDF export"],
  },
  {
    category: "Active Recall Studio",
    title: "Turn notes into lasting mental models",
    desc: "Generate high-yield 3D flashcards with spaced repetition ratings, interactive concept quizzes with explanations, and executive takeaways.",
    icon: Brain,
    highlights: ["Tactile 3D flashcards", "4-tier spaced repetition", "Practice quizzes with rationale", "Executive summaries"],
  },
  {
    category: "Visual Mind Maps",
    title: "See how ideas connect across your workspace",
    desc: "Explore concepts visually with automatic hierarchical mind maps, bidirectional note connections, and a global workspace knowledge graph.",
    icon: Network,
    highlights: ["Hierarchical mind maps", "Bidirectional linking", "Interactive knowledge graph", "Concept clustering"],
  },
  {
    category: "Quiet Cognitive Companion",
    title: "Intelligence that speaks only when invited",
    desc: "Spark operates as a Socratic thinking partner. Challenge premises, explore opposing paradigms, and drill mechanisms without clutter.",
    icon: Sparkles,
    highlights: ["4 pedagogical depths (ELI5 to Advanced)", "Premise & assumption checks", "Multi-model engine switch", "Strict Principle Zero data privacy"],
  },
];

const USE_CASES = [
  {
    role: "For Deep Learners & Students",
    tagline: "Active retention over passive rereading",
    points: [
      "Capture lecture and book notes with zero friction.",
      "Convert notes into spaced-repetition flashcards in one click.",
      "Take self-grading quizzes before exams with concrete explanations.",
    ],
  },
  {
    role: "For Engineers & Architects",
    tagline: "Clarity on complex systems",
    points: [
      "Document protocols, trade-offs, and distributed architectures.",
      "Pressure-test assumptions and find overlooked edge cases.",
      "Map out dependency trees and concept nodes visually.",
    ],
  },
  {
    role: "For Researchers & Writers",
    tagline: "From raw sparks to polished prose",
    points: [
      "Synthesize disparate research vectors into structured drafts.",
      "Challenge underlying premises with contrasting mental models.",
      "Export clean, beautiful study guides and whitepapers.",
    ],
  },
];

export default function Landing() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("editor");

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/20">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <Logo size={22} />
            <span className="font-semibold tracking-tight text-sm text-foreground">
              Ember
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground font-medium">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#study" className="hover:text-foreground transition-colors">Active Recall</a>
            <a href="#workflows" className="hover:text-foreground transition-colors">Workflows</a>
            <a href="#privacy" className="hover:text-foreground transition-colors">Privacy</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="toggle theme"
              data-testid="theme-toggle"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground" data-testid="nav-login-btn">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="h-7 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all" data-testid="nav-signup-btn">
                Open Workspace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 max-w-5xl mx-auto text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-secondary/80 text-foreground border border-border/70 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Ember Workspace 2.0</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">The Note is the Hero</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] tracking-tight font-semibold text-foreground leading-[1.12]">
            A calm notebook for clear ideas and lasting understanding.
          </h1>

          <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Write without friction, transform notes into high-yield active-recall cards, and explore ideas visually. Crafted like a physical notebook, powered with quiet intelligence.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="rounded-xl px-6 h-10 bg-foreground text-background hover:opacity-90 font-medium text-xs shadow-ambient active:scale-[0.98] transition-all" data-testid="hero-cta-btn">
                Get started free <ArrowUpRight size={14} className="ml-1 opacity-70" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="rounded-xl px-5 h-10 text-xs border-border/80 hover:bg-secondary" data-testid="hero-secondary-btn">
                Try demo workspace
              </Button>
            </Link>
          </div>

          <div className="mt-4 text-[11px] text-muted-foreground/70">
            Free personal workspace · No credit card required · Instant setup
          </div>
        </div>

        {/* Tactile Workspace Showcase Window */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 text-left max-w-4xl mx-auto"
        >
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-float">
            {/* Window Titlebar */}
            <div className="bg-secondary/40 border-b border-border/60 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <span className="text-xs text-muted-foreground ml-3 font-medium">Ember · Distributed Consensus & Raft</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Saved · 340 words</span>
              </div>
            </div>

            {/* Window Body Grid */}
            <div className="grid grid-cols-12 min-h-[350px] bg-background">
              {/* Mini Sidebar */}
              <div className="col-span-4 border-r border-border/60 p-3 hidden sm:block bg-secondary/20">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1.5">
                  Notebook
                </div>
                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 rounded-lg bg-card shadow-xs text-foreground text-xs font-medium border border-border/80 flex flex-col gap-0.5">
                    <span className="truncate">⚡ Raft Consensus Algorithm</span>
                    <span className="text-[10px] text-muted-foreground/60">Leader election & logs · 2m ago</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-muted-foreground text-xs hover:bg-card/50 transition-colors flex flex-col gap-0.5">
                    <span className="truncate">🧬 Molecular Genetics & CRISPR</span>
                    <span className="text-[10px] text-muted-foreground/60">Cas9 mechanisms · Yesterday</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-muted-foreground text-xs hover:bg-card/50 transition-colors flex flex-col gap-0.5">
                    <span className="truncate">📐 Singular Value Decomposition</span>
                    <span className="text-[10px] text-muted-foreground/60">Matrix factorization · Oct 12</span>
                  </div>
                </div>
              </div>

              {/* Mini Editor Canvas */}
              <div className="col-span-12 sm:col-span-8 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium mb-1.5">
                    <span>Active Note</span> · <span>Distributed Systems</span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Understanding Leader Election & Log Replication in Raft
                  </h3>
                  <div className="mt-2.5 text-xs text-muted-foreground leading-relaxed space-y-2">
                    <p>
                      In the Raft consensus algorithm, nodes transition between three distinct states: <span className="text-foreground font-medium">Follower</span>, <span className="text-foreground font-medium">Candidate</span>, and <span className="text-foreground font-medium">Leader</span>. When a follower's election timer expires without receiving heartbeats, it increments the term and requests votes.
                    </p>
                  </div>

                  {/* Socratic Discussion Card */}
                  <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={12} className="text-accent" />
                      <span className="text-xs font-semibold text-foreground">Socratic Exploration</span>
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">⌘J</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      "Why does randomized election timeout prevent split votes from becoming permanent split-brain deadlocks?"
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-4 text-xs text-muted-foreground">
                  <span>Slash commands: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">/flashcard</code> <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">/quiz</code></span>
                  <span className="text-foreground font-medium">4 Active-Recall Cards Ready</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Core Pillars (Feature Breakdown) */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto border-t border-border/50">
        <div className="mb-12 max-w-xl">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Capabilities
          </div>
          <h2 className="mt-1.5 text-2xl sm:text-3xl tracking-tight font-semibold text-foreground">
            Everything you need to think clearly and retain what matters.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <div
              key={p.category}
              className="p-6 rounded-2xl border border-border/80 bg-card shadow-ambient hover:bg-secondary/20 transition-all flex flex-col justify-between"
              data-testid={`pillar-card-${i}`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-secondary/80 border border-border/80 text-foreground flex items-center justify-center">
                    <p.icon size={16} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {p.category}
                  </span>
                </div>

                <h3 className="font-semibold text-base text-foreground tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {p.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px] text-foreground/80">
                {p.highlights.map((h) => (
                  <div key={h} className="flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow Section: How People Think in Ember */}
      <section id="workflows" className="px-6 py-20 max-w-5xl mx-auto border-t border-border/50">
        <div className="mb-12 max-w-xl">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Workflows
          </div>
          <h2 className="mt-1.5 text-2xl sm:text-3xl tracking-tight font-semibold text-foreground">
            Designed for curious minds across disciplines.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {USE_CASES.map((u, i) => (
            <div
              key={u.role}
              className="p-5 rounded-2xl border border-border/80 bg-card shadow-ambient flex flex-col justify-between"
              data-testid={`usecase-card-${i}`}
            >
              <div>
                <div className="text-xs font-semibold text-foreground">{u.role}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 italic">{u.tagline}</div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
                  {u.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2">
                      <span className="text-foreground/40 font-mono text-[10px] mt-0.5">•</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Principle Zero Privacy Banner */}
      <section id="privacy" className="px-6 py-16 max-w-5xl mx-auto border-t border-border/50">
        <div className="rounded-2xl border border-border/80 bg-secondary/30 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Lock size={13} className="text-foreground" />
              <span>Principle Zero Privacy Guarantee</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your notes belong entirely to you. Context is never shared across tenants, retrieval is strictly scoped to your authorized workspace, and system prompts are sealed.
            </p>
          </div>
          <div className="shrink-0">
            <Link to="/signup">
              <Button size="sm" className="h-8 px-4 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90">
                Start thinking securely
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6 text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="font-semibold text-foreground">Ember</span>
            <span className="text-muted-foreground/60">·</span>
            <span>A calm thinking environment</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
            <a href="#privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <span className="font-mono text-[10px] opacity-60">v2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
