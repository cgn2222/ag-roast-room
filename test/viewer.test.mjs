// The viewer: replays a finished skill-written council folder (what Antigravity writes) as room events.
import test from "node:test";
import assert from "node:assert/strict";
import { tempSessions } from "./helpers.mjs";

const EX = "2026-10-09-example-take-the-seed";
process.env.ROAST_SESSIONS_DIR = tempSessions(EX);
const watch = await import("../app/lib/watch.mjs");
const seats = await import("../app/lib/seats.mjs");

test("the example folder replays to a verdict with all seven seats in three rounds", () => {
  const x = watch.getLive(EX);
  assert.ok(x, "example folder is detected as a skill-written council");
  assert.equal(x.status, "done");
  const types = x.events.map((e) => e.type);
  for (const t of ["setup", "cruxes", "draft", "verdict"]) assert.ok(types.includes(t), `has ${t}`);
  for (const r of [1, 2, 3]) {
    const done = x.events.filter((e) => e.type === "seat_done" && e.round === r);
    assert.equal(done.length, 7, `round ${r} has 7 cards`);
    assert.equal(new Set(done.map((e) => e.seat)).size, 7);
  }
  const v = x.events.find((e) => e.type === "verdict").verdict;
  assert.ok(["GO", "GO WITH CONDITIONS", "RESHAPE", "WAIT", "DON'T DO IT"].includes(v.label));
  assert.ok(Object.values(v.scores).every((s) => s.score == null || (s.score >= 0 && s.score <= 10)));
});

test("scoring is the weighted average the rules describe", () => {
  const x = watch.getLive(EX);
  const verdict = x.events.find((e) => e.type === "verdict").verdict;
  const round = x.events.filter((e) => e.type === "seat_done" && e.round === 3);
  const setup = x.events.find((e) => e.type === "setup");
  for (const [id, s] of Object.entries(verdict.scores)) {
    let n = 0, d = 0;
    for (const c of round) { const v = c.parsed.optionScores[id]; const w = setup.weights[c.seat].weight; if (typeof v === "number") { n += v * w; d += w; } }
    assert.equal(s.score, Math.round((n / d) * 10) / 10, `option ${id}`);
  }
});

test("seatKey maps display names, keys and decorated headings", () => {
  assert.equal(watch.seatKey("Gary V"), "garyvee");
  assert.equal(watch.seatKey("GARY V (Marketing)"), "garyvee");
  assert.equal(watch.seatKey("Warren Buffett"), "buffett");
  assert.equal(watch.seatKey("nobody"), null);
});

test("parseCard reads a Round 1 card, including the middle-dot separator", () => {
  const card = `SEAT: HORMOZI (Offers)\nSTANCE: Conditional yes\nOPTION SCORES: A 7/10 · B 8/10 · C 3/10\nPILLAR SCORE: 8/10\nCONFIDENCE: 4/5\nRUIN RISK: none\nDOOR: two-way\nTHE CALL: Raise for new clients.`;
  const p = seats.parseCard(card, ["A", "B", "C"]);
  assert.deepEqual(p.optionScores, { A: 7, B: 8, C: 3 });
  assert.equal(p.pillar, 8);
  assert.equal(p.confidence, 4);
  assert.equal(p.ruin, "none");
  assert.equal(p.door, "two-way");
});
