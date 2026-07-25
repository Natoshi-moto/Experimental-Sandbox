# Lessons from Hermes Prototype → FORGE first sweep

**status_authority:** `NONE`  
**Source:** `projects/Hermes Prototype/` (first install sweep 2026-07-23 + verify/build/results trail)

These are **process laws** for the FORGE first sweep, not product features.

## 1. One falsifiable claim beats a vision deck

Hermes succeeded because the claim was a single sentence with kill criteria. FORGE’s white paper is large; **this sweep claims only Phase 0 spine properties**.

## 2. VERIFY_FIRST before BUILD

Third-party blogs, AI transcripts, and even project marketing lied about licenses, feature lists, and “supported agents.” Ground truth came from:

- reading install scripts end-to-end before running  
- querying GitHub API / reading source for licenses  
- `--help` and installed binary behavior  
- live smoke tests with self-consistent answers  

FORGE first sweep: treat the long tech spec as **intent**, but **tests and running code** as truth for what shipped.

## 3. Do not rewrite the plan after reality

Hermes rule: failed steps get a results entry; the plan is not silently edited to look perfect.  
Claude writes `RESULTS_*.md`. Codex may add a debug appendix. Neither rewrites BUILD_PLAN history.

## 4. Kill criteria stop the line

If a kill criterion hits, **stop, record, do not route around**. Hermes almost accepted a wrong local model because a bare `ollama run` benchmark measured the wrong thing. Measure the **system’s actual path** (Hermes needed 64K + thinking; the benchmark was 8K single-shot).

FORGE equivalent: acceptance is **event replay, immutability, unauthorized rejection, model-cannot-create-canon** — not “looks like a TUI” or “tests exist.”

## 5. Thin first slice; integration risk is real

Hermes deliberately composed two existing tools rather than inventing an orchestrator. FORGE **must** invent a control plane — but the first sweep still stays thin:

- fake adapter only  
- no real provider CLIs  
- no Full Search / host write / embedded terminal  

## 6. Environment surprises are data

Hermes hit: IPv6-only install host, schema 33 versions behind, Ollama ignoring per-request ctx.  
Record environment, commands, and numbers. Do not hide them.

## 7. Dual seat discipline

| Failure mode | Hermes / Lab scar | FORGE rule |
|--------------|-------------------|------------|
| One model agrees with itself in costume | Multi-seat without independence | Claude builds; Codex **attacks** claim with checklist |
| Rubber-stamp green | CI theater | Codex re-runs tests, then tries hostile cases not in suite |
| Silent scope creep | “while we’re here” | Phase 0 only; Phase 1 needs a new results cycle |

## 8. No Lab contamination

Hermes lived under `status_authority: NONE` in Experimental-Sandbox. Same here. No credentials that can write Lab. No “this is now canonical.”

## 9. Secrets stay out of git

DeepSeek keys lived in `~/.hermes/.env`, never the repo. FORGE first sweep needs **no provider keys at all** (fake adapter only). If a later phase adds keys, same rule.

## 10. Operator language is loose; authority is not

Sandbox HANDOFF: “go / ship / make it real” means sandbox progress. Never Lab main. FORGE first sweep may open a PR on Experimental-Sandbox only.

## 11. Honest identity

Hermes stripped injected persona so the agent would not claim to be “Hermes by Nous” when the underlying model was DeepSeek. FORGE code and docs must not claim Core 0.1, FORGE 1.0, isolation, or production readiness after Phase 0 alone.

## 12. Next handoff is separate from first sweep

Hermes work-swap pipeline was a **later** design doc, not mixed into install results. FORGE Phase 1+ is a later package.
