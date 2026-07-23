# Hermes Prototype

**status_authority:** `NONE`
**State:** `PROPOSAL_ONLY` — nothing installed, nothing run.

Operator layer (Hermes Agent, MIT) + terminal multiplexer (Herdr, Apache-2.0) for orchestrating "vanilla" terminal AI agents (Claude Code, Codex, an xAI terminal agent) alongside DeepSeek API and local Ollama models as reasoning backends. No Anthropic/OpenAI/OpenRouter dependency by design.

Read in this order:

1. [`VERIFY_FIRST.md`](VERIFY_FIRST.md) — load-bearing facts to independently re-check before trusting anything below, including corrections already found once (a wrong license claimed by three different sources three different ways).
2. [`WHITEPAPER.md`](WHITEPAPER.md) — problem, proposed system, why the rest of the original source material wasn't included, claim/falsifier/non-claims.
3. [`SPEC.md`](SPEC.md) — components, provider config, install sequence, kill criteria.

Sandbox zone: `sandbox/experiment/*`. Nothing here can affect `Natoshi-moto/Lab`. `status_authority: NONE` throughout.
