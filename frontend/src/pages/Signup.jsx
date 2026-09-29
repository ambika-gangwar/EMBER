import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo, { EmberMascot } from "@/components/Logo";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signup(name.trim() || "Friend", email, password);
      toast.success("Welcome to Ember");
      nav("/app", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-10 order-2 lg:order-1">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-6 inline-flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-bold text-lg" style={{ fontFamily: "Outfit" }}>
              Ember
            </span>
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
            Create Ember workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Ember is a spark that helps ideas grow.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="signup-form">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
                data-testid="signup-name-input"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                data-testid="signup-email-input"
                placeholder="you@domain.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
                data-testid="signup-password-input"
                placeholder="6+ characters"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full font-semibold bg-foreground text-background hover:opacity-90"
              disabled={busy}
              data-testid="signup-submit-btn"
            >
              {busy ? "Creating..." : "Create workspace"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground font-medium hover:underline" data-testid="signup-to-login-link">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:flex relative items-end p-12 order-1 lg:order-2 bg-neutral-950 text-neutral-50 grain overflow-hidden">
        <div className="absolute top-12 left-12 flex items-center gap-2.5">
          <Logo size={36} />
          <span className="font-bold text-xl tracking-tight" style={{ fontFamily: "Outfit" }}>
            Ember
          </span>
        </div>

        <div className="absolute top-36 left-12 flex items-center gap-4">
          <EmberMascot size={90} withGlow={true} />
          <div>
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider">A spark that helps ideas grow</div>
            <div className="text-neutral-300 text-sm max-w-xs mt-1">Start small. Organize ideas. Master complex topics with factual study AI.</div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="max-w-md text-2xl leading-snug" style={{ fontFamily: "Outfit" }}>
          A spark that helps ideas grow.
          <div className="mt-4 text-sm opacity-70 font-normal" style={{ fontFamily: "Inter" }}>
            Free personal workspace. Active recall, quizzes, and concrete knowledge distillation.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
