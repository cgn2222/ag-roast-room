// The local web server: starts, serves the room, rejects foreign origins and path tricks.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { tempSessions, waitFor, ROOT } from "./helpers.mjs";
import path from "node:path";

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
let port, child, out = "";

const get = (p, headers = {}, method = "GET") => new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { host: `localhost:${port}`, ...headers } }, (r) => {
    let body = ""; r.on("data", (d) => (body += d)); r.on("end", () => resolve({ status: r.statusCode, body, headers: r.headers }));
  });
  req.on("error", reject); req.end();
});

before(async () => {
  port = await freePort();
  child = spawn(process.execPath, [path.join(ROOT, "app", "server.mjs")], {
    env: { ...process.env, PORT: String(port), ROAST_SESSIONS_DIR: tempSessions("2026-10-09-example-take-the-seed", "2026-10-10-example-first-sales-hire"), COUNCIL_RUNNER: "viewer", LLM_PROVIDER: "mock" },
  });
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  await waitFor(() => out.includes("Roast Room on"), 10000);
});
after(() => child?.kill());

test("serves the room page and seats", async () => {
  const page = await get("/");
  assert.equal(page.status, 200);
  assert.match(page.body, /Roast Room/);
  const seats = JSON.parse((await get("/api/seats")).body);
  assert.equal(seats.seats.length, 7);
  assert.equal(seats.runner, "viewer");
  assert.equal(seats.provider, "mock");
});

test("lists the example sessions and serves their events (events.json and skill folders)", async () => {
  const list = JSON.parse((await get("/api/sessions")).body).sessions;
  assert.ok(list.length >= 2, "both examples listed");
  for (const s of list) {
    const j = JSON.parse((await get("/api/sessions/" + encodeURIComponent(s.id))).body);
    assert.ok(j.events.some((e) => e.type === "verdict"), `${s.id} has a verdict`);
  }
});

test("the PDF builder and its vendored library are served", async () => {
  for (const f of ["/pdf.js", "/vendor/jspdf.umd.min.js", "/brand/fonts/Montserrat-Regular.ttf"]) assert.equal((await get(f)).status, 200, f);
});

test("viewer mode refuses to start a council (no accidental API spend)", async () => {
  const r = await new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/api/council", method: "POST", headers: { host: `localhost:${port}`, "content-type": "application/json" } }, (x) => { x.resume(); x.on("end", () => resolve(x.statusCode)); });
    req.end(JSON.stringify({ prompt: "Should I do the thing that costs money?" }));
  });
  assert.equal(r, 403);
});

test("rejects foreign Host and Origin headers", async () => {
  assert.equal((await get("/api/seats", { host: "evil.example" })).status, 403);
  assert.equal((await get("/api/seats", { origin: "https://evil.example" })).status, 403);
  assert.equal((await get("/api/seats", { origin: `http://localhost:${port}` })).status, 200);
});

test("does not serve files outside public/", async () => {
  for (const p of ["/../package.json", "/..%2fpackage.json", "/%2e%2e/package.json", "/../public-evil/x"]) {
    const r = await get(p);
    assert.notEqual(r.status, 200, p);
    assert.doesNotMatch(r.body, /"name": "roast-room"/);
  }
});
