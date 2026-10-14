// Test helpers: a temp sessions folder seeded with a copy of a shipped example council.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function tempSessions(...examples) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-room-test-"));
  for (const name of examples) fs.cpSync(path.join(ROOT, "sessions", name), path.join(dir, name), { recursive: true });
  return dir;
}

export const waitFor = async (fn, ms = 30000, step = 50) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, step));
  }
  throw new Error("timed out waiting for condition");
};
