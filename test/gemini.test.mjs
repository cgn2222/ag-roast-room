// Optional Gemini provider: request/response contract against a mocked fetch (no network, no key spent).
import test from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = "test-key-not-real";
const g = await import("../app/lib/gemini.mjs");
const { S } = await import("../app/lib/schema.mjs");

const sse = (...objs) => new Response(new ReadableStream({ start(c) { for (const o of objs) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(o)}\n\n`)); c.close(); } }));

test("toGeminiSchema upper-cases types and drops additionalProperties", () => {
  const out = g.toGeminiSchema(S.obj({ a: S.str, b: S.arr(S.obj({ c: S.int })), d: S.enum("X", "Y") }));
  assert.equal(out.type, "OBJECT");
  assert.equal(out.additionalProperties, undefined);
  assert.equal(out.properties.b.items.type, "OBJECT");
  assert.equal(out.properties.b.items.properties.c.type, "INTEGER");
  assert.deepEqual(out.properties.d.enum, ["X", "Y"]);
  assert.deepEqual(out.required, ["a", "b", "d"]);
});

test("stream sends key in a header (not the URL), the system prompt, and joins text deltas", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return sse({ candidates: [{ content: { parts: [{ text: "Hel" }] } }] }, { candidates: [{ content: { parts: [{ text: "lo" }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } }); };
  const seen = [];
  const text = await g.stream({ model: "m-1", system: "SYS", messages: [{ role: "user", content: "hi" }], onText: (d) => seen.push(d) });
  assert.equal(text, "Hello");
  assert.deepEqual(seen, ["Hel", "lo"]);
  const { url, init } = calls[0];
  assert.match(url, /models\/m-1:streamGenerateContent\?alt=sse$/);
  assert.ok(!url.includes("test-key-not-real"));
  assert.equal(init.headers["x-goog-api-key"], "test-key-not-real");
  const body = JSON.parse(init.body);
  assert.equal(body.systemInstruction.parts[0].text, "SYS");
  assert.equal(body.contents[0].parts[0].text, "hi");
  assert.equal(g.usage.input, 5);
});

test("json requests a schema and parses the reply; MAX_TOKENS is an error", async () => {
  globalThis.fetch = async (url, init) => {
    const b = JSON.parse(init.body);
    assert.equal(b.generationConfig.responseMimeType, "application/json");
    assert.equal(b.generationConfig.responseSchema.type, "OBJECT");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"x":"y"}' }] }, finishReason: "STOP" }] }));
  };
  assert.deepEqual(await g.json({ model: "m", system: "s", prompt: "p", schema: S.obj({ x: S.str }) }), { x: "y" });
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] }));
  await assert.rejects(g.json({ model: "m", system: "s", prompt: "p", schema: S.obj({ x: S.str }) }), /max tokens/);
});

test("refuses to run without explicit model ids (never guesses a model or a bill)", async () => {
  await assert.rejects(g.stream({ model: "", system: "s", messages: [{ role: "user", content: "x" }] }), /SEAT_MODEL/);
});
