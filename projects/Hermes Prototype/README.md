# Hermes Prototype

**status_authority:** `NONE`
**State:** `FIRST_SWEEP_COMPLETE` — installed, configured, and confirmed working end to end. See `RESULTS_2026-07-23.md`.

Operator layer (Hermes Agent, MIT) + terminal multiplexer (Herdr, Apache-2.0) for orchestrating "vanilla" terminal AI agents (Claude Code, Codex, an xAI terminal agent) alongside DeepSeek API and local Ollama models as reasoning backends. No Anthropic/OpenAI/OpenRouter dependency by design.

Read in this order:

1. [`VERIFY_FIRST.md`](VERIFY_FIRST.md) — load-bearing facts to independently re-check before trusting anything below, including corrections found across two rounds (a wrong license claimed three different ways by three sources; a wrong claim about Anthropic support caught on re-read of primary docs; a live GPU benchmark that ruled out the highest-spec local model on stability grounds).
2. [`WHITEPAPER.md`](WHITEPAPER.md) — problem, proposed system, why the rest of the original source material wasn't included, claim/falsifier/non-claims.
3. [`SPEC.md`](SPEC.md) — components, provider config (schema confirmed against the repo's own docs), install sequence, kill criteria.
4. [`BUILD_PLAN.md`](BUILD_PLAN.md) — the actual execution runbook, plain language, one open blocker (a DeepSeek API key) flagged at step 0.

Sandbox zone: `sandbox/experiment/*`. Nothing here can affect `Natoshi-moto/Lab`. `status_authority: NONE` throughout.
