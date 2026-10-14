#!/usr/bin/env node
// Node port of .claude/skills/roast-room/scripts/check_quotes.py (same rules, no Python needed).
//
// Usage:  node app/scripts/check-quotes.mjs <session folder>
//
// Scans round-*.md and verdict.md for quotes attributed to a source id, like "..." (S095),
// and looks for each one in the brain files. A quote that is in no brain is fine only if it
// appears in an earlier round file or the brief (a seat quoting another seat or the founder).
// Anything else is an invented quote: remove it from the verdict. Exit code 1 if any is unaccounted for.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BRAINS_DIR } from "../lib/env.mjs";

export function norm(s) {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith(".md") ? [path.join(dir, d.name)] : []));
}

export function checkSession(session, brainsDir = BRAINS_DIR) {
  const brain = norm(walk(brainsDir).map((p) => fs.readFileSync(p, "utf8")).join(" "));
  const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
  const files = fs.readdirSync(session).filter((n) => /^round-.*\.md$/.test(n)).sort().map((n) => path.join(session, n));
  if (fs.existsSync(path.join(session, "verdict.md"))) files.push(path.join(session, "verdict.md"));
  const brief = norm(read(path.join(session, "brief.md")));
  const re = /["“]([^"“”\n]{20,400})["”][^\n"]{0,40}?[(\[]S\d{3}/g;
  const bad = [];
  let ok = 0, internal = 0, seen = "";
  for (const f of files) {
    const text = read(f);
    for (const m of text.matchAll(re)) {
      const nq = norm(m[1]);
      if (nq.split(" ").length < 6) continue;
      if (brain.includes(nq)) ok++;
      else if (seen.includes(nq) || brief.includes(nq)) internal++;
      else bad.push({ file: path.basename(f), quote: m[1] });
    }
    seen += " " + norm(text);
  }
  return { ok, internal, bad };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) { console.error("Usage: node app/scripts/check-quotes.mjs <session folder>"); process.exit(2); }
  const r = checkSession(dir);
  console.log(`brain quotes verified: ${r.ok}; quotes of earlier rounds or the brief: ${r.internal}; unverified: ${r.bad.length}`);
  for (const b of r.bad) console.log(`  UNVERIFIED [${b.file}] "${b.quote.slice(0, 160)}"`);
  process.exit(r.bad.length ? 1 : 0);
}
