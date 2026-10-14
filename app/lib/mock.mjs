// Offline provider for tests and demos: LLM_PROVIDER=mock. Makes no network calls and costs nothing.
// It returns deterministic, well-formed cards and Chair JSON, so the whole debate pipeline
// (rounds, cruxes, draft, vote, scoring, verdict, session files) can be exercised without a model.
export const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const score = (seat, opt, round) => 3 + ((hash(seat + opt) + round) % 6); // 3..8

function seatOf(prompt) { return (prompt.match(/You hold the ([A-Z ]+?) seat/) || [])[1] || "SEAT"; }
function roundOf(prompt) { return Number((prompt.match(/ROUND (\d) OF 3/) || [])[1] || 1); }
function optionsOf(prompt) {
  const line = (prompt.match(/OPTION SCORES:[^\n]*/) || [""])[0];
  const ids = [...line.matchAll(/\b([A-D]) n\/10/g)].map((m) => m[1]);
  return ids.length ? ids : ["A", "B", "C"];
}

function card(prompt) {
  const seat = seatOf(prompt), round = roundOf(prompt), ids = optionsOf(prompt);
  const key = seat.toLowerCase();
  const scores = ids.map((id) => `${id} ${score(key, id, round)}/10`).join(" · ");
  const common = `OPTION SCORES: ${scores}`;
  if (round === 3) {
    return `SEAT: ${seat}\nVOTE: ${hash(key) % 3 === 0 ? "Endorse with amendment" : "Endorse"}\n${common}\nFINAL SCORE: ${5 + (hash(key) % 4)}/10\nFINAL PILLAR SCORE: ${5 + (hash(key) % 4)}/10\nAMENDMENT OR DISSENT: ${hash(key) % 3 === 0 ? "Add a dated checkpoint." : ""}\nONE LINE FOR THE FOUNDER: Mock line from ${seat}.\n`;
  }
  const head = `SEAT: ${seat}\n` + (round === 2 ? `I DISAGREE MOST WITH: Bezos. Mock argument, mock rebuttal.\nI CONCEDE: A mock point.\nON THE CRUXES: Mock answer.\n` : "");
  return `${head}STANCE: Conditional yes\n${common}\nPILLAR SCORE: ${score(key, "P", round)}/10\nCONFIDENCE: ${2 + (hash(key) % 3)}/5\nRUIN RISK: none\n` +
    (round === 1 ? `DOOR: two-way\n\nTHE CALL: Mock call on option ${ids[0]}.\nWHY:\n1. Mock argument (Mock Framework, S000)\nTHE RISK I SEE: Mock risk.\nWHAT WOULD CHANGE MY MIND: A mock number.\nWHAT I'D DO THIS WEEK: One mock action.\nQUESTION FOR THE FOUNDER: A mock question?\n` : `MOVED: no\nMY CONDITIONS FOR YES: a checkable mock condition by day 30.\n`);
}

/** Every seat prompt sent through this provider (tests inspect it). */
export const prompts = [];

export async function stream({ messages, onText = () => {} }) {
  prompts.push(messages.at(-1).content);
  const text = card(messages.at(-1).content);
  for (const part of text.match(/.{1,40}/gs)) onText(part);
  usage.calls += 1;
  return text;
}

const seatEnum = (schema) => schema.properties.weights.items.properties.seat.enum;

export async function json({ schema }) {
  usage.calls += 1;
  const p = schema.properties;
  if (p.weights) {
    const seats = seatEnum(schema);
    return {
      title: "Mock decision", decision: "A mock decision.", brief: "A mock brief.",
      options: [{ id: "A", label: "Do it as proposed" }, { id: "B", label: "Do the smaller version" }, { id: "C", label: "Do not do it" }],
      assumptions: ["Everything here is mocked (assumed)"],
      weights: seats.map((seat, i) => ({ seat, weight: i < 2 ? 3 : 1 + (i % 2), reason: "mock weight" })),
      quick_seats: seats.slice(0, 4),
    };
  }
  if (p.cruxes) {
    const seats = p.cruxes.items.properties.sides.items.properties.seats.items.enum;
    return { cruxes: [{ question: "Is the mock bet worth it?", sides: [{ position: "Yes", seats: seats.slice(0, 3) }, { position: "No", seats: seats.slice(3) }] }], unanimous: false, note: "The room argues about a mock bet.", pressure: [{ seat: seats[0], ask: "Answer the mock objection." }] };
  }
  if (p.minority) {
    return {
      label: "GO WITH CONDITIONS", call: "Do option B (mock).", override_note: "",
      why: [{ point: "Mock reason", seat: "Buffett", framework: "Mock Framework" }],
      fights: [{ crux: "Is the mock bet worth it?", story: "Mock story." }],
      minority: { seat: "Bezos", quote: "Mock minority words.", would_have_to_be_true: "Mock fact." },
      amendments: [], conditions: ["Mock condition by day 30"], next_steps: [{ when: "This week", action: "Mock step" }],
      cheapest_test: "Mock test.", kill_criteria: "Mock kill rule.", revisit: "In 30 days.",
    };
  }
  return { option: "B", label: "GO WITH CONDITIONS", recommendation: "Mock recommendation.", conditions: ["Mock condition by day 30"], next_steps: ["Mock step by day 7"], cheapest_test: "Mock test.", kill_criteria: "Mock kill rule." };
}
