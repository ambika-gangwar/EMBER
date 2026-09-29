import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Key, Check, ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getAISettings, saveAISettings, PROVIDER_OPTIONS } from "@/lib/aiSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AISettingsModal({ open, onClose }) {
  const [settings, setSettings] = useState(getAISettings());
  const [testing, setTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);

  useEffect(() => {
    if (open) {
      setSettings(getAISettings());
      api.get("/ai/status").then(({ data }) => setServerStatus(data)).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const currentProvider = PROVIDER_OPTIONS.find((p) => p.id === settings.provider) || PROVIDER_OPTIONS[0];

  const handleSave = () => {
    saveAISettings(settings);
    toast.success("AI preferences saved");
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const payload = {
        text: "Briefly explain the benefit of deliberate note-taking.",
        provider: settings.provider !== "auto" ? settings.provider : undefined,
        api_key: settings.apiKey || undefined,
        model: settings.model !== "default" ? settings.model : undefined,
      };
      const { data } = await api.post("/ai/continue", payload);
      if (data.result) {
        toast.success("Connection test successful! Intelligence engine responded.");
      } else {
        toast.info("Using local semantic engine.");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Connection failed. Please check your key.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.16 }}
          className="relative w-full max-w-lg rounded-2xl border bg-background shadow-2xl p-6 overflow-hidden z-10"
          data-testid="ai-settings-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
                  AI Thinking Partner Settings
                </h2>
                <p className="text-xs text-muted-foreground">
                  Connect your preferred model or use the private offline engine
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {/* Provider Selection */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Provider
              </Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {PROVIDER_OPTIONS.map((prov) => {
                  const selected = settings.provider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          provider: prov.id,
                          model: prov.models[0] || "default",
                        }))
                      }
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? "border-foreground bg-foreground/5 shadow-sm ring-1 ring-foreground"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{prov.name}</span>
                        {selected && <Check size={14} className="text-foreground" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                        {prov.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Selector */}
            {currentProvider.models && currentProvider.models.length > 1 && (
              <div>
                <Label htmlFor="model-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model
                </Label>
                <select
                  id="model-select"
                  value={settings.model}
                  onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                  className="mt-1.5 w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-1 focus:ring-foreground"
                >
                  {currentProvider.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* API Key Input (if cloud provider) */}
            {currentProvider.id !== "local" && currentProvider.id !== "auto" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Key size={12} /> {currentProvider.name} API Key
                  </Label>
                  {currentProvider.keyUrl && (
                    <a
                      href={currentProvider.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Get Key <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <Input
                  id="api-key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
                  placeholder={currentProvider.keyPlaceholder || "Enter your API key..."}
                  className="font-mono text-xs mt-1"
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                  Stored locally in your browser and used only to power your notes.
                </p>
              </div>
            )}

            {/* Active Status Badge */}
            <div className="p-3 rounded-xl border bg-muted/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium">
                  {settings.provider === "auto"
                    ? "Auto-Intelligent Reasoning"
                    : `${currentProvider.name} (${settings.model})`}
                </span>
              </div>
              <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                <Zap size={11} className="text-amber-500" /> SSE Streaming Active
              </span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
              className="text-xs"
            >
              {testing ? (
                <>
                  <Loader2 size={12} className="animate-spin mr-1.5" /> Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="text-xs rounded-full px-4">
                Save & Activate
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
