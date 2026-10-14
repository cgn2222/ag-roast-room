import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT, env } from "./lib/env.mjs";
import { SEATS } from "./lib/seats.mjs";
import { startCouncil, getSession, subscribe, listSaved, loadSaved, MODELS } from "./lib/council.mjs";
import { usage, providerName, hasCredentials } from "./lib/llm.mjs";
import * as watch from "./lib/watch.mjs";

const PORT = Number(process.env.PORT) || 4730;
const PUBLIC = path.join(APP_ROOT, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" };

let running = null; // one council at a time (API runner)

// "viewer" (default): the room plays councils that your agent (Antigravity or Claude Code) runs from the skill.
// "api": the room can also run councils itself with the provider in LLM_PROVIDER (COUNCIL_RUNNER=api in .env).
const RUNNER = (process.env.COUNCIL_RUNNER || env("COUNCIL_RUNNER") || "viewer").toLowerCase() === "api" ? "api" : "viewer";
watch.startWatching();

/** The room only talks to its own page on localhost. Blocks DNS rebinding and cross-site requests,
 *  which could otherwise start a council that bills the API account in "api" mode. */
function originAllowed(req, port = PORT) {
  const okHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  if (!okHosts.has(String(req.headers.host || "").toLowerCase())) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return okHosts.has(new URL(origin).host.toLowerCase()); } catch { return false; }
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 1e5) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  if (!originAllowed(req)) return send(res, 403, { error: "Forbidden: the room only answers requests from http://localhost:" + PORT });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === "/api/seats") return send(res, 200, { seats: SEATS, models: MODELS, runner: RUNNER, provider: providerName(), hasKey: Boolean(hasCredentials()) });
    if (p === "/api/usage") return send(res, 200, usage);
    if (p === "/api/council" && req.method === "POST") {
      if (RUNNER !== "api") return send(res, 403, { error: "This room is a viewer. Ask your agent (Antigravity or Claude Code) to run the roast-room skill, or set COUNCIL_RUNNER=api in .env." });
      if (running && getSession(running)?.status === "running") return send(res, 409, { error: "A council is already in session. Wait for its verdict." });
      const { prompt, mode } = await readJson(req);
      if (!prompt || prompt.trim().length < 10) return send(res, 400, { error: "Give the council a real decision (at least a sentence)." });
      const s = startCouncil(prompt.trim().slice(0, 4000), mode === "quick" ? "quick" : "full");
      running = s.id;
      return send(res, 200, { id: s.id });
    }
    if (p.startsWith("/api/stream/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const s = getSession(id) || watch.getLive(id);
      if (!s) return send(res, 404, { error: "no such session" });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": connected\n\n");
      const ping = setInterval(() => res.write(": ping\n\n"), 15000);
      res.on("close", () => clearInterval(ping));
      return subscribe(s, res);
    }
    if (p === "/api/sessions") {
      const all = [...listSaved(), ...watch.listLive()].sort((a, b) => (a.id < b.id ? 1 : -1));
      const apiRunning = running && getSession(running)?.status === "running" ? running : null;
      return send(res, 200, { sessions: all, running: apiRunning, live: watch.runningId() });
    }
    if (p.startsWith("/api/sessions/")) {
      const id = decodeURIComponent(p.split("/").pop());
      const x = watch.getLive(id);
      const j = loadSaved(id) || (x && { id, title: x.title, mode: x.mode, status: x.status, events: x.events });
      return j ? send(res, 200, j) : send(res, 404, { error: "not found" });
    }
    // static
    const file = path.normalize(path.join(PUBLIC, p === "/" ? "index.html" : p));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found", "text/plain");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`Roast Room on http://localhost:${PORT} (${RUNNER === "api" ? `viewer + API runner, provider: ${providerName()}` : "viewer: ask your agent to run the roast-room skill"})`));
