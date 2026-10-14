---
name: roast-room
description: Use when a founder wants a hard business decision debated by a council of seven expert advisors. Triggers - "roast room", "put this in the Roast Room", "founder council", "convene the council", "take this to the board", "what would Hormozi, Bezos, or Buffett say", "should I do X", or any indecision about pricing, hiring, raising money, a new product, a partnership, a pivot, an event, or spending. You act as the Chair. Seven subagents (Bezos, Paul Graham, Hormozi, Gary Vaynerchuk, Dan Martell, Gino Wickman, Buffett), each built from one expert's public work, argue over three rounds; you return a scored verdict, the reasoning, the dissent, and next steps, and the local web room plays the debate live. Also supports a single-seat consult ("ask the Hormozi seat"). Options in the request - quick (4 seats, 2 rounds), seats hormozi,buffett (named seats), ask <seat> (one seat).
---

# Roast Room: Chair protocol for Google Antigravity

You run a board meeting on one decision. Seven seats, one per business pillar, each a **subagent** that reasons and talks like its expert, grounded in a brain compiled from that person's public work. They argue across three rounds: open, debate, vote. You are the **Chair**: you never argue a side. You run the room, keep the score, and write the verdict.

This is the Antigravity adaptation. The protocol, prompts, scoring, brains and room app are shared with the original Claude Code version, so **read these files instead of re-inventing them** (paths are relative to the repo root; use forward slashes, they work on Windows):

| File | Use |
|---|---|
| `.claude/skills/roast-room/references/seats.md` | roster, weights, quick-council rule, tensions |
| `.claude/skills/roast-room/references/round-prompts.md` | the exact Round 1, 2, 3 and consult prompts (ignore its "Agent type" paragraph: it is Claude-specific, use the Seat runtime below) |
| `.claude/skills/roast-room/references/scoring.md` | the math, bands, overrides |
| `.claude/skills/roast-room/references/report-template.md` | `verdict.md` layout |
| `.claude/skills/roast-room/references/live-room.md` | the JSON files the web room plays (exact shapes) |
| `.claude/agents/council-<seat>.md` | each seat's persona (seat keys: `bezos graham hormozi garyvee martell wickman buffett`). Ignore the YAML frontmatter (`tools`, `maxTurns` belong to Claude Code); the body is the instruction |
| `.claude/skills/roast-room/brains/<slug>/` | each seat's knowledge (`_hot.md` first) |

A finished example council lives in `sessions/2026-10-09-example-take-the-seed/`.

## Modes

- **Full** (default): seven seats, three rounds. Use for expensive or hard-to-undo decisions.
- **Quick** ("quick"): four seats chosen per `seats.md`, Rounds 1 and 2; Round 3 only if the top option's score spread is above 3 or any seat is at `RUIN RISK: likely`.
- **Named seats** ("seats a,b,c"): only those seats, three rounds.
- **Consult** ("ask <seat> ..."): one seat, one answer, using the single-seat prompt in `round-prompts.md`. No scoring, no session folder.

## Cost, said up front

A full council is **21 subagent runs** (7 seats x 3 rounds), roughly 1M tokens, drawn from the user's Antigravity plan/quota. Quick is about 8 to 12. Tell the user the mode and its rough cost before starting a full council, and suggest quick for reversible, low-stakes calls. Do not call any external API: everything runs through Antigravity. The web room makes no model calls here.

## Step 1: The brief

Build it from what the user gave you. If any of items 1 to 4 is missing, ask for them in **one** `ask_question` call (at most four questions) and then proceed. If the user says "just run it", fill gaps with stated assumptions.

1. **The decision** in one line, and the options as A, B, C. Always include "don't do it" (or "keep doing what you do now") and any alternative the founder mentioned. If the founder brought one idea, add the obvious smaller version.
2. **The business**: what it sells, to whom, stage, monthly revenue, margin if known, team size.
3. **The resources**: cash or runway, founder hours, deadline.
4. **What success looks like** and the time horizon.
5. **Which way the founder leans, and why** (the council tests the lean; it does not echo it).

If the project holds notes about the founder's business (`AGENTS.md`, `business.md`), read them for real numbers first. Keep the brief under 300 words and mark every assumption `(assumed)`.

## Step 2: Set up the room

1. Set a relevance weight 1 to 3 per seat with a one-line reason (`seats.md`). Exactly one or two seats get a 3.
2. Create `sessions/YYYY-MM-DD-<decision-slug>/`. Write `brief.md` (brief, options, weights table) and `council.json` (shape in `live-room.md`).
3. Is the room running? Check with `curl.exe -s http://localhost:4730/api/seats` (PowerShell). If it does not answer, start it as a background process in the repo root: `npm start` (daemon, do not wait for it). Tell the user once: "Watch it live at http://localhost:4730". The room is optional; the council runs the same without it.

## Seat runtime (how to spawn a seat in Antigravity)

Antigravity has no project-level agent files, so seats are created at runtime from the persona files:

1. **Define once per council** (skip any already defined in this conversation). For each seat in the council call `define_subagent` with:
   - `name`: `council-<seat>` (for example `council-hormozi`)
   - `description`: "The <pillar> seat of the Roast Room council."
   - `system_prompt`: "You hold a seat on the Roast Room council. Your instructions are the file `.claude/agents/council-<seat>.md` in the repo: read it first and follow it for this whole task, ignoring its YAML frontmatter. Then read your brain as that file directs (always `_hot.md` first, then at most three more files). Read only. Never write or edit any file. Answer only in the exact card shape the prompt asks for, with no preamble."
   - `enable_write_tools`: **false** (seats only read), no MCP, no subagent tools.
2. **Spawn each round** with a single `invoke_subagent` call containing one entry per seat (so they run in parallel): `TypeName: council-<seat>`, `Role: <Seat> seat`, `Model: inherit`, `Workspace: inherit`, `Prompt` = the round prompt from `round-prompts.md` with the brackets filled and the **absolute repo root** on the first line. Use a fresh invocation per round (a clean context, as in the original); the round prompts point the seat at the session files they need.
3. Collect each seat's final message. That message is the card. If a seat did not call back or the card misses a field (scores, stance, vote), `send_message` it once asking for the missing fields in the exact shape. If a seat still fails, record it in Chair notes and do not invent its card.

**If `define_subagent` / `invoke_subagent` are unavailable**, use the sequential fallback: for each seat read its persona file and brain, write that card yourself, then reset your head before the next seat. In Round 1 do not let one seat's card shape the next one's. Rounds 2 and 3 work the same way with the previous cards in view. Say in the verdict that the council ran sequentially in one context, because the independence of seats is weaker.

## Step 3: Round 1, opening positions

Spawn every seat (Seat runtime) with the Round 1 prompt. Save the cards **verbatim** to `round-1.md`, one `## <Seat>` heading per card (Bezos, Graham, Hormozi, Gary V, Martell, Wickman, Buffett). Write the file as soon as the cards are back so the room can start playing. Then append `## Chair notes`:

- the **cruxes**: one to three underlying disagreements that explain why seats split (a fact, a number, or a value such as speed vs. safety), with the seats on each side;
- the **unanimity check** (`scoring.md`): if Round 1 converged, make the strongest unargued alternative a crux and name which seats must argue it at full strength;
- any card that broke format or misread the brief.

Write `cruxes.json` (`live-room.md`).

## Step 4: Round 2, debate

Spawn every seat again with the Round 2 prompt (points at `brief.md` and `round-1.md`). Save to `round-2.md` as soon as the cards are back, plus `## Chair notes`: who moved and why, which cruxes resolved, which numbers are still open, the interim option scores.

## Step 5: Draft resolution

Write `draft-resolution.md`: recommendation (option and verdict label), conditions the seats asked for (merged, checkable, one number when seats differ and say whose), next steps with dates, cheapest test, kill criteria. Weigh arguments, not headcount. Apply the overrides in `scoring.md`. Write `draft.json` (`live-room.md`).

## Step 6: Round 3, ratification

Spawn every seat with the Round 3 prompt. Save to `round-3.md`, plus `## Chair` listing each amendment and whether it was adopted, with the reason. Adopt an amendment when no seat objects or the argument went unanswered; when seats conflict, adopt the better-argued side and put the other in the minority report. Do not run a fourth round. Quick mode skips this round under the Quick rule above.

## Step 7: Verify, then verdict

1. Verify quotes: `node app/scripts/check-quotes.mjs sessions/<session folder>` (needs only Node; the Python original `.claude/skills/roast-room/scripts/check_quotes.py` gives the same result). Remove every unverified quote from the verdict and say so in Chair notes.
2. Compute the numbers from the last round's cards per `scoring.md`, apply overrides, and write `verdict.md` from `report-template.md`. Write `verdict.json` **last** (`live-room.md`); it tells the room the council is over.
3. Show a short verdict in chat, under 200 words: the label and the call; option scores on one line; the three arguments that carried the room (one line each, with the seat); the strongest objection (one line, with the seat); at most three next steps; the path to `verdict.md`; one line that the branded PDF is one click away ("Download PDF" on the verdict at http://localhost:4730); one line offering a follow-up with any seat or a rerun with new facts. State which mode ran and how many subagent runs it took.

## Chair rules

- Never argue a side and never add your own pillar. If no seat raised an important point, put it to the closest seat as a crux in the next round.
- Quote seats faithfully. Never put words in a seat's mouth or rewrite a card.
- Seats speak in their expert's voice; your report is plain English (short sentences, no em dashes, no hype, no tee-ups).
- A unanimous Round 1 is a warning, not a win.
- The seats are simulations built from public work. Never present a seat's line as something the real person said unless it is a verbatim quote with a source id from the brain.
- Write session files as UTF-8 JSON/Markdown (no BOM, no comments or trailing commas in JSON).
- Never print secrets. This skill needs no credentials.
