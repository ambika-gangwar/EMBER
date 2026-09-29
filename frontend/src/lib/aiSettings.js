// AI Settings & Streaming Client for Ember
import { API } from "./api";

const SETTINGS_KEY = "san_ai_settings_v1";

export const DEFAULT_AI_SETTINGS = {
  provider: "auto", // "gemini" | "anthropic" | "openai" | "local" | "auto"
  apiKey: "",
  model: "default",
};

export const PROVIDER_OPTIONS = [
  {
    id: "auto",
    name: "Auto-Detect / Best Available",
    desc: "Uses configured cloud keys or intelligent local semantic engine",
    models: ["default"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    desc: "Lightning fast, free tier, state-of-the-art analytical depth",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    keyPlaceholder: "AIzaSy...",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    desc: "Exceptional prose quality, deep reasoning, and thoughtful critique",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI GPT-4o",
    desc: "Versatile, structured formatting and broad reasoning",
    models: ["gpt-4o-mini", "gpt-4o"],
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "local",
    name: "Local Semantic Engine",
    desc: "Runs completely private offline; extracts genuine ideas from note",
    models: ["smart-semantic-engine-v2"],
  },
];

export function getAISettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAISettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("san_ai_settings_changed", { detail: settings }));
  } catch (e) {
    console.error("Failed to save AI settings:", e);
  }
}

export function getAIPayloadExtra() {
  const s = getAISettings();
  const extra = {};
  if (s.provider && s.provider !== "auto") extra.provider = s.provider;
  if (s.model && s.model !== "default") extra.model = s.model;
  if (s.apiKey) extra.api_key = s.apiKey;
  return extra;
}

/**
 * Live streaming AI completion over SSE
 */
export async function streamAI({ prompt, instruction, noteId, noteTitle, noteContext, selectedText, history, mode, onToken, onDone, onError }) {
  const token = localStorage.getItem("san_token") || "";
  const extra = getAIPayloadExtra();

  const body = {
    prompt,
    instruction: instruction || "",
    note_id: noteId || "",
    note_title: noteTitle || "",
    note_context: noteContext || "",
    selected_text: selectedText || "",
    history: history || [],
    mode: mode || "create",
    ...extra,
  };

  try {
    const res = await fetch(`${API}/ai/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      onError?.(new Error(`Stream error: ${res.status} ${err}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const textChunk = decoder.decode(value, { stream: true });
      const lines = textChunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.token) {
              accumulated += data.token;
              onToken?.(data.token, accumulated);
            }
            if (data.done) {
              onDone?.(accumulated);
              return;
            }
          } catch {
            // ignore non-json ping
          }
        }
      }
    }
    onDone?.(accumulated);
  } catch (err) {
    onError?.(err);
  }
}
