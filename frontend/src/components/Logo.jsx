import React from "react";
import { Sparkles } from "lucide-react";

/**
 * Ember Brand Mark
 * "A spark that helps ideas grow."
 */
export default function Logo({ size = 32, tone = "auto", showMascot = true, className = "" }) {
  if (showMascot) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden relative shadow-sm ring-1 ring-violet-500/20 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-purple-500/10 ${className}`}
        style={{ height: size, width: size }}
        aria-label="Ember logo"
      >
        <img
          src="/logo.png"
          alt="Ember"
          className="w-full h-full object-cover rounded-xl"
        />
      </span>
    );
  }

  // Vector Fallback
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl overflow-hidden relative bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-500/30 ${className}`}
      style={{ height: size, width: size }}
      aria-label="Ember logo"
    >
      <Sparkles size={Math.round(size * 0.55)} className="text-white fill-white/90 drop-shadow-sm" />
    </span>
  );
}

export function EmberMascot({ size = 72, className = "", withGlow = true }) {
  return (
    <div className={`relative inline-block ${className}`}>
      {withGlow && (
        <div className="absolute -inset-3 bg-gradient-to-r from-violet-500/30 via-indigo-500/30 to-purple-500/30 rounded-3xl blur-xl -z-10 animate-pulse" />
      )}
      <div
        className="rounded-3xl overflow-hidden border border-violet-500/30 bg-card shadow-lg shadow-indigo-500/10 p-1 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <img
          src="/logo.png"
          alt="Ember - A spark that helps ideas grow"
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>
    </div>
  );
}
