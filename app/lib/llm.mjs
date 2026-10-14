// Provider switch for the optional API runner (COUNCIL_RUNNER=api).
//   LLM_PROVIDER=anthropic (default, original behaviour) | gemini | mock
// The default room mode ("viewer") never imports a provider's network code at runtime:
// it only plays session folders written by your agent (Antigravity or Claude Code).
import { env } from "./env.mjs";
import * as anthropic from "./anthropic.mjs";
import * as gemini from "./gemini.mjs";
import * as mock from "./mock.mjs";
export { S } from "./schema.mjs";

const PROVIDERS = { anthropic, gemini, mock };
export const providerName = () => {
  const p = (process.env.LLM_PROVIDER || env("LLM_PROVIDER") || "anthropic").toLowerCase();
  return PROVIDERS[p] ? p : "anthropic";
};
const impl = () => PROVIDERS[providerName()];

export const stream = (o) => impl().stream(o);
export const json = (o) => impl().json(o);
export const usage = new Proxy({}, { get: (_, k) => impl().usage[k], ownKeys: () => Reflect.ownKeys(impl().usage), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: impl().usage[k] }) });

const DEFAULT_MODELS = { anthropic: { seat: "claude-sonnet-5-5", chair: "claude-opus-5-5" }, gemini: { seat: "", chair: "" }, mock: { seat: "mock", chair: "mock" } };
export const defaultModels = () => DEFAULT_MODELS[providerName()];
export const hasCredentials = () => ({ anthropic: Boolean(env("ANTHROPIC_API_KEY")), gemini: Boolean(env("GEMINI_API_KEY")), mock: true })[providerName()];
