import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import Logo, { EmberMascot } from "@/components/Logo";
import { Sun, Moon, Pen, Layers, Search, Brain, FileDown, Users, ArrowUpRight, Flame, Sparkles } from "lucide-react";

const features = [
  { icon: Pen, title: "Ember Writing Companion", desc: "Continue, polish, and synthesize thoughts without losing your flow." },
  { icon: Layers, title: "Slash commands", desc: "Type / in the editor to summarize, todo, extract key points, or challenge premises." },
  { icon: Brain, title: "Factual Study Studio", desc: "Direct active-recall flashcards & realistic concept quizzes grounded in your notes." },
  { icon: Search, title: "Semantic search", desc: "Find ideas and connections by meaning, not just exact keywords." },
  { icon: FileDown, title: "Clean PDF export", desc: "Export publication-ready study guides and notes for sharing." },
  { icon: Users, title: "Live collaboration", desc: "Real-time presence avatars, live cursor movement, and shared canvas." },
];

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function Landing() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground grain">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="brand-link">
            <Logo size={32} />
            <span className="font-bold tracking-tight text-lg" style={{ fontFamily: "Outfit" }}>
              Ember
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#study" className="hover:text-foreground transition-colors">Study Mode</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Workspace</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="toggle theme"
              data-testid="theme-toggle"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login"><Button variant="ghost" data-testid="nav-login-btn">Sign in</Button></Link>
            <Link to="/signup"><Button data-testid="nav-signup-btn">Get started free</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-20 max-w-6xl mx-auto text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-foreground border border-border/80 mb-6">
            <span>Ember Workspace 2.0</span>
            <span className="text-muted-foreground">· Factual Active-Recall Studio</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tight font-semibold text-foreground leading-[1.1]">
            A thinking environment for clear ideas and active retention.
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Write without friction, transform notes into high-yield active-recall cards, and collaborate in real-time. Built for focus, speed, and deep understanding.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="rounded-lg px-6 bg-foreground text-background hover:opacity-90 font-medium text-sm shadow-xs" data-testid="hero-cta-btn">
                Get started free <ArrowUpRight size={15} className="ml-1" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="rounded-lg px-5 text-sm" data-testid="hero-secondary-btn">
                Open Workspace
              </Button>
            </Link>
          </div>

          <div className="mt-5 text-xs text-muted-foreground">
            Free personal workspace · No credit card required
          </div>
        </div>

        {/* Native Interactive Workspace UI Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-14 text-left max-w-5xl mx-auto"
        >
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            {/* Mockup Window Bar */}
            <div className="bg-muted/40 border-b border-border/60 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                <span className="text-xs text-muted-foreground ml-3 font-medium">Ember · Distributed Systems & Consensus</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-foreground font-medium border border-border/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Spark AI
                </span>
              </div>
            </div>

            {/* Mockup Body Grid */}
            <div className="grid grid-cols-12 min-h-[360px] bg-background">
              {/* Mini Sidebar */}
              <div className="col-span-3 border-r border-border/60 p-3.5 hidden sm:block bg-muted/10">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-2">Notebooks</div>
                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium flex items-center justify-between">
                    <span>⚡ Raft Consensus</span>
                    <span className="text-[10px] text-muted-foreground">Active</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-md hover:bg-muted/40 text-muted-foreground text-xs transition-colors">
                    <span>🧬 Molecular Genetics</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-md hover:bg-muted/40 text-muted-foreground text-xs transition-colors">
                    <span>📐 Linear Algebra & SVD</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-md hover:bg-muted/40 text-muted-foreground text-xs transition-colors">
                    <span>💡 System Design Patterns</span>
                  </div>
                </div>
              </div>

              {/* Mini Editor Content */}
              <div className="col-span-12 sm:col-span-9 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium mb-1.5">
                    <span>Active Note</span> · <span>Updated 2m ago</span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Understanding Leader Election & Log Replication in Raft
                  </h3>
                  <div className="mt-2 text-xs text-muted-foreground leading-relaxed space-y-2">
                    <p>
                      In the Raft consensus algorithm, nodes transition between three distinct states: <span className="font-medium text-foreground">Follower</span>, <span className="font-medium text-foreground">Candidate</span>, and <span className="font-medium text-foreground">Leader</span>. When a follower's election timer expires without receiving heartbeats, it increments the term and transitions to candidate...
                    </p>
                  </div>

                  {/* Mock AI Inline Assistant Box */}
                  <div className="mt-4 rounded-lg border border-border/80 bg-secondary/30 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={13} className="text-foreground" />
                      <span className="text-xs font-semibold text-foreground">Spark Socratic Tutor</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">Decision: Socratic Guide</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      "Why do randomized election timeouts prevent perpetual split-brain elections across nodes?"
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-4 text-xs text-muted-foreground">
                  <span>Slash commands: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">/flashcard</code> <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">/quiz</code></span>
                  <span className="text-foreground font-medium">3 Active-Recall Cards Ready</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="mb-8 max-w-xl">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Features</div>
          <h2 className="mt-1.5 text-2xl sm:text-3xl tracking-tight font-semibold text-foreground">
            Crafted for focus, clarity, and retention.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="p-5 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-colors"
              data-testid={`feature-card-${i}`}
            >
              <div className="h-8 w-8 rounded-lg bg-secondary border border-border/80 text-foreground flex items-center justify-center">
                <f.icon size={16} />
              </div>
              <div className="mt-3 font-semibold text-sm text-foreground">{f.title}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-border/80 bg-secondary/30 p-8 md:p-12 relative overflow-hidden">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Free Personal Workspace
            </div>
            <h3 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Start with one thought. Build lasting mental models.
            </h3>
            <div className="mt-5 flex items-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="rounded-lg px-6 font-medium text-sm" data-testid="cta-bottom-btn">
                  Create your workspace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span>© 2026 Ember</span>
          </div>
          <div className="font-mono text-[11px] opacity-70">v2.0 · Calm & Grounded</div>
        </div>
      </footer>
    </div>
  );
}
