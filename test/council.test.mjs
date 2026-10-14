// The full deliberation pipeline end to end, offline, with the mock provider (no network, no cost).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempSessions, waitFor } from "./helpers.mjs";

process.env.ROAST_SESSIONS_DIR = tempSessions();
process.env.LLM_PROVIDER = "mock";
const council = await import("../app/lib/council.mjs");
const { SESSIONS_DIR } = await import("../app/lib/env.mjs");

const finish = async (s) => { await waitFor(() => s.status !== "running", 60000); return s; };

test("full council: 7 seats x 3 rounds, cruxes, draft, scored verdict, saved files", async () => {
  const s = await finish(council.startCouncil("Should I raise my coaching price from $2,000 to $3,500?", "full"));
  assert.equal(s.status, "done", JSON.stringify(s.events.find((e) => e.type === "error")));
  const ev = (t) => s.events.filter((e) => e.type === t);
  assert.equal(ev("setup")[0].seats.length, 7);
  for (const r of [1, 2, 3]) assert.equal(ev("seat_done").filter((e) => e.round === r).length, 7, `round ${r}`);
  assert.equal(ev("cruxes").length, 1);
  assert.equal(ev("draft").length, 1);
  const v = ev("verdict")[0].verdict;
  assert.ok(v.label && v.call && v.recommended);
  assert.ok(v.scores[v.recommended].score >= 0);
  // round 2 and 3 prompts must carry the other seats' cards: deliberation, not seven monologues
  const dir = path.join(SESSIONS_DIR, fs.readdirSync(SESSIONS_DIR).find((d) => fs.existsSync(path.join(SESSIONS_DIR, d, "verdict.md"))));
  for (const f of ["brief.md", "round-1.md", "round-2.md", "round-3.md", "verdict.md", "events.json"]) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.match(fs.readFileSync(path.join(dir, "verdict.md"), "utf8"), /## Verdict: GO WITH CONDITIONS/);
});

test("quick council seats four advisors", async () => {
  const s = await finish(council.startCouncil("Should I hire a part-time assistant next month?", "quick"));
  assert.equal(s.status, "done");
  assert.equal(s.events.find((e) => e.type === "setup").seats.length, 4);
});

test("deliberation: Round 2 prompts carry every Round 1 card and Round 3 carries the draft", async () => {
  const { prompts } = await import("../app/lib/mock.mjs");
  const r2 = prompts.filter((p) => p.includes("ROUND 2 OF 3"));
  const r3 = prompts.filter((p) => p.includes("ROUND 3 OF 3"));
  assert.ok(r2.length >= 7 && r3.length >= 4);
  for (const p of r2.slice(0, 7)) { // the full council's seven Round 2 prompts
    assert.match(p, /ROUND 1, EVERY SEAT'S CARD/);
    for (const name of ["Bezos", "Graham", "Hormozi", "Gary V", "Martell", "Wickman", "Buffett"]) assert.ok(p.includes(`### ${name} (weight`), `${name}'s card reaches Round 2`);
    assert.match(p, /THE CRUXES THE CHAIR SEES/);
  }
  for (const p of r3) assert.match(p, /THE CHAIR'S DRAFT RESOLUTION/);
});
