import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo, { EmberMascot } from "@/components/Logo";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("demo@smartainotes.com");
  const [password, setPassword] = useState("demo123!");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome to Ember");
      nav(loc.state?.from || "/app", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative items-end p-12 bg-neutral-950 text-neutral-50 grain overflow-hidden">
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
            <div className="text-neutral-300 text-sm max-w-xs mt-1">Factual study sets, active recall, and distraction-free writing.</div>
          </div>
        </div>

        <motion.blockquote
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md text-2xl leading-snug"
          style={{ fontFamily: "Outfit" }}
        >
          "Ember is the spark that keeps my study sessions organized, factual, and deeply engaging."
          <div className="mt-4 text-sm opacity-70 font-normal">— Study & Knowledge Space</div>
        </motion.blockquote>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-6 inline-flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-bold text-lg" style={{ fontFamily: "Outfit" }}>
              Ember
            </span>
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your Ember workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                data-testid="login-email-input"
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
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full font-semibold bg-foreground text-background hover:opacity-90"
              disabled={busy}
              data-testid="login-submit-btn"
            >
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            Don't have a workspace?{" "}
            <Link to="/signup" className="text-foreground font-medium hover:underline" data-testid="login-to-signup-link">
              Create one free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
