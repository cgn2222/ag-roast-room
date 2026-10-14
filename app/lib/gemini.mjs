// Optional provider: Google Gemini API (Generative Language REST API, v1beta).
// Opt-in only: LLM_PROVIDER=gemini plus GEMINI_API_KEY, SEAT_MODEL and CHAIR_MODEL in .env.
// This bills the Google AI account that owns the key. It is NOT used by the default viewer mode.
import { env } from "./env.mjs";

const BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const RETRY = new Set([429, 500, 502, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
function addUsage(u = {}) {
  usage.input += u.promptTokenCount || 0;
  usage.output += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
  usage.cacheRead += u.cachedContentTokenCount || 0;
  usage.calls += 1;
}

function headers() {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set (add it to .env).");
  return { "x-goog-api-key": key, "content-type": "application/json" };
}

/** Gemini's responseSchema is an OpenAPI subset: upper-case types, no additionalProperties. */
export function toGeminiSchema(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (!s || typeof s !== "object") return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "additionalProperties") continue;
    if (k === "type" && typeof v === "string") out.type = v.toUpperCase();
    else if (k === "properties") out.properties = Object.fromEntries(Object.entries(v).map(([n, p]) => [n, toGeminiSchema(p)]));
    else if (k === "items") out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  return out;
}

const textOf = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? "" : p.text || "")).join("");
const systemText = (system) => (typeof system === "string" ? system : (system || []).map((b) => b.text).join("\n"));

function body({ system, messages, maxTokens, generationConfig = {} }) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: systemText(system) }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens, ...generationConfig },
  });
}

function needModel(model) {
  if (!model) throw new Error("Set SEAT_MODEL and CHAIR_MODEL in .env to Gemini model ids you have access to (the app does not guess them).");
}

export async function stream({ model, system, messages, maxTokens = 2000, onText = () => {} }) {
  needModel(model);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, { method: "POST", headers: headers(), body: body({ system, messages, maxTokens }) });
    if (RETRY.has(res.status)) { await sleep(Math.min(30000, 2000 * 2 ** attempt)); continue; }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    let text = "", buf = "", last = {};
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.error) throw new Error(`Gemini stream error: ${JSON.stringify(ev.error).slice(0, 300)}`);
        const t = textOf(ev);
        if (t) { text += t; onText(t); }
        if (ev.usageMetadata) last = ev.usageMetadata;
      }
    }
    addUsage(last);
    return text;
  }
  throw new Error("Gemini API kept refusing after retries");
}

export async function json({ model, system, prompt, schema, maxTokens = 4000 }) {
  needModel(model);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: headers(),
      body: body({ system, messages: [{ role: "user", content: prompt }], maxTokens, generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) } }),
    });
    if (RETRY.has(res.status)) { await sleep(Math.min(30000, 2000 * 2 ** attempt)); continue; }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    addUsage(j.usageMetadata);
    if (j.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error("Chair output hit max tokens");
    return JSON.parse(textOf(j));
  }
  throw new Error("Gemini API kept refusing after retries");
}
