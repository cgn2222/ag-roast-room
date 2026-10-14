# Roast Room

![The Roast Room](docs/room.jpg)

Bring a hard business decision and seven AI advisors argue it out, then hand you a scored verdict and a one-click PDF. The seats are Jeff Bezos, Paul Graham, Alex Hormozi, Gary Vaynerchuk, Dan Martell, Gino Wickman, and Warren Buffett, each built from that person's public work: their letters, essays, talks, and videos. The council runs in your agent (Google Antigravity 2.0 or Claude Code), and a small local web app shows them around a table talking it through.

| Seat | Pillar | The question they own |
|---|---|---|
| Jeff Bezos | Strategy and decisions | Is this the right bet, and how reversible is it? |
| Paul Graham | Product and startups | Do people actually want this, and is it growing? |
| Alex Hormozi | Offers, pricing, and sales | Will people pay, how much, and how do we close? |
| Gary Vaynerchuk | Marketing and attention | Where does the attention come from? |
| Dan Martell | People, hiring, and founder time | Who does this, and what does it cost your calendar? |
| Gino Wickman | Operations and scaling | Can the business run this without you holding it together? |
| Warren Buffett | Money and capital | What does it do to cash, risk, and long-term value? |

## What you need

Pick one agent to run the council. The room (web page + PDF) is the same for both.

- **[Google Antigravity 2.0](https://antigravity.google)** (Agent Manager). Windows guide in [docs/ANTIGRAVITY.md](docs/ANTIGRAVITY.md) (Portuguese). No API key: it uses your Antigravity plan.
- **or [Claude Code](https://claude.com/claude-code)** (the original setup). Your Claude plan covers it; no API key needed.
- [Node.js](https://nodejs.org) 20 or newer, for the room. There's nothing to install beyond that.

## Setup

```bash
git clone https://github.com/nateherkai/roast-room.git
cd roast-room
```

(Windows PowerShell works the same. Use your fork's URL if you have one.) Open this folder in your agent.

## Run a roast

1. Start the room: `npm start`, then open http://localhost:4730. Leave it open.
2. Open your agent in the same folder.
   - **Antigravity:** ask it in plain language, for example `Run the roast-room skill on this decision: ...` (add "quick" for a smaller council).
   - **Claude Code:** `claude`, then `/roast-room` and your decision.
3. Answer the Chair's questions, then watch the council argue it out in the room.
4. When the verdict lands, click **Download PDF**.

You also get a short verdict in your agent's chat, and the full report lands in `sessions/<date>-<decision>/verdict.md`.


## What to put in your question

The council is only as good as what you give it. Include:

- **The decision** in one line.
- **Your options.** Two or three. "Keep doing what I do now" counts.
- **Your numbers.** Revenue, cash, and team size.
- **Your limits.** Deadline, hours, and budget.
- **What success looks like**, and by when.
- **Which way you're leaning**, and why. The council tests your lean instead of agreeing with it.

Left something out? The Chair asks before the council starts. Example:

```
/roast-room I run a coaching business at $30k a month with 15 clients at $2,000 each.
Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000?
Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March.
I'm leaning toward raising for everyone because I'm underpaid.
```

More ways to run it (Claude Code syntax first; in Antigravity say the same thing in words):

- `/roast-room --quick ...` seats four advisors for two rounds. Use it for smaller, reversible calls. It uses far less of your plan.
- `/roast-room --seats hormozi,buffett ...` seats only the advisors you name.
- `/roast-room ask hormozi ...` gets one answer from one seat.

The room is optional. The council runs the same without it.

## Watch an example first

Run `npm start`, open http://localhost:4730, and click **Past sessions**. Three finished councils ship with the repo, so you can see how it works (and download their PDFs) before you run your own.

## How it works

- **The council runs in your agent.** Each seat is a sub-agent built from `.claude/agents/council-*.md` that reads its own brain (`.claude/skills/roast-room/brains/<name>/`): frameworks, principles, positions, stories, and voice notes compiled from public sources, with every quote tied to a source. Your agent acts as the Chair. It runs the rounds, keeps score, and writes the verdict. In Claude Code the Chair protocol is `.claude/skills/roast-room/SKILL.md`; in Antigravity it is `.agents/skills/roast-room/SKILL.md` (same rounds, prompts, and scoring; seats are created at runtime with `define_subagent`).
- **Each seat scores every option**, weighted by how much that seat's pillar matters to your decision. The Chair caps the verdict when a seat flags ruin risk, and it forces a real argument when everyone agrees too fast.
- **The room only watches.** As the Chair works, it writes each step to `sessions/`, and the app plays those files back. Between rounds it shows which round is running, how long it has been, and what each advisor is weighing. In the default mode the room makes no AI calls of its own.
- **Every council is saved** in `sessions/`. Past sessions replays any of them and downloads its PDF.
- **Usage:** a full council is 21 sub-agent runs, so it takes a real bite out of your plan's usage. Use quick mode for small calls.

## Optional: let the room run councils itself

If you'd rather type a decision straight into the room, copy `.env.example` to `.env`, set `COUNCIL_RUNNER=api`, pick `LLM_PROVIDER` (`anthropic`, `gemini`, or `mock`), add that provider's key, and restart `npm start`. That mode bills the account that owns the key (about 25 calls per full council). `LLM_PROVIDER=mock` is offline and free, with fake text, for testing. The `gemini` provider needs `SEAT_MODEL` and `CHAIR_MODEL` set by you and has only been contract-tested, not run against the live API.

## Tests

`npm test` runs 19 offline tests (no keys, no cost): card parsing and scoring against the shipped examples, the viewer replay, a full seven-seat debate on the mock provider, the Gemini request contract, the quote checker, and the local server's security checks.

## What's inside

| Path | What |
|---|---|
| `.claude/skills/roast-room/` | The shared knowledge: protocol (Claude Code), prompts, scoring, report template, and the seven brains |
| `.claude/agents/` | The seven seat personas (used by both agents) |
| `.agents/skills/roast-room/` | The Antigravity Chair skill |
| `AGENTS.md` / `CLAUDE.md` | Project rules for Antigravity / Claude Code |
| `app/` | The room: a zero-dependency Node server, the web page, and the PDF builder |
| `test/` | Offline tests |
| `docs/ANTIGRAVITY.md` | Antigravity + Windows guide (Portuguese) and differences from the original |
| `sessions/` | Your councils (kept out of git) and the three examples |

## About the advisors

These are simulations built from each person's public work. They are not the people, they don't speak for them, and none of them is affiliated with or endorses this project. A seat only quotes a person verbatim when the line is in its brain with a source, and `node app/scripts/check-quotes.mjs sessions/<session>` (or the original `python .claude/skills/roast-room/scripts/check_quotes.py sessions/<session>`) checks every quote in a council against the brains. Each brain's `sources.md` lists what it was built from.

Built by AI Automation Society. The code is MIT licensed; see `LICENSE`. The PDF builder bundles [jsPDF](https://github.com/parallax/jsPDF) (MIT) and [Montserrat](https://github.com/JulietaUla/Montserrat) (SIL Open Font License); their licenses sit next to them in `app/public/`.
