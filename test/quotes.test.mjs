// The Node quote checker agrees with the Python original and catches invented quotes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkSession } from "../app/scripts/check-quotes.mjs";
import { tempSessions } from "./helpers.mjs";

const EX = "2026-10-09-example-take-the-seed";

test("shipped example has no unverified quotes", () => {
  const dir = path.join(tempSessions(EX), EX);
  const r = checkSession(dir);
  assert.equal(r.bad.length, 0);
  assert.ok(r.ok >= 20);
});

test("an invented quote attributed to a source id is flagged", () => {
  const dir = path.join(tempSessions(EX), EX);
  fs.appendFileSync(path.join(dir, "verdict.md"), '\nBezos said "we should always bet the whole company on every single shiny idea" (S001).\n');
  const r = checkSession(dir);
  assert.equal(r.bad.length, 1);
  assert.match(r.bad[0].quote, /bet the whole company/);
});
