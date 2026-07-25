# FORGE First Sweep

**status_authority:** `NONE`  
**Sandbox zone:** `sandbox/experiment/*`  
**State:** `INSTRUCTIONS_READY` — build not yet started  
**Date (UTC filed):** 2026-07-25  
**Parent product:** FORGE — Local Multi-Agent Cognitive Workbench (design draft v0.1)

## What this is

Public build instructions for the **first executable slice** of FORGE (Phase 0 foundation only).

Two seats, deliberate split of labor learned from the [Hermes Prototype](../Hermes%20Prototype/):

| Seat | Job | Must not |
|------|-----|----------|
| **Claude** | Execute `BUILD_PLAN_FIRST_SWEEP.md` in order; write real code + tests; file `RESULTS_*.md` | Rewrite the plan to hide failures; expand into Phase 1+; touch Lab |
| **Codex** | Debug and adversarially verify against `CODEX_DEBUG.md` and the claim | Quietly re-implement as a second product; rubber-stamp green tests |

Nothing here can affect `Natoshi-moto/Lab`. Sandbox IDs only (`SBX-*`). No secrets. No provider keys in the repo.

## Why first sweep is Phase 0 only

FORGE’s full plan has five phases (0–4). Hermes taught us: **one falsifiable claim, kill criteria, separate results file, stop when red**.

Phase 0 is the smallest slice that proves the product’s spine exists:

> Deterministic ledger + immutable artifacts + reducers + fake adapter + policy gates — and a model response still cannot create canon.

No full TUI. No Hermes/Codex/Claude adapters. No Full Search. No host write. No embedded terminal. Those are later phases.

## Read order

1. [`LESSONS_FROM_HERMES.md`](LESSONS_FROM_HERMES.md) — what we refuse to forget  
2. [`VERIFY_FIRST.md`](VERIFY_FIRST.md) — load-bearing facts before trusting prose  
3. [`CLAIM.md`](CLAIM.md) — one falsifiable sentence + falsifier + non-claims  
4. [`SPEC_SLICE.md`](SPEC_SLICE.md) — Phase 0 technical bounds  
5. [`BUILD_PLAN_FIRST_SWEEP.md`](BUILD_PLAN_FIRST_SWEEP.md) — **Claude’s runbook**  
6. [`CODEX_DEBUG.md`](CODEX_DEBUG.md) — **Codex’s debug protocol**  
7. [`HANDOFF_CLAUDE.md`](HANDOFF_CLAUDE.md) / [`HANDOFF_CODEX.md`](HANDOFF_CODEX.md) — pasteable cold starts  
8. [`RESULTS_TEMPLATE.md`](RESULTS_TEMPLATE.md) — how to record truth  

Source design (not rewritten here; treat as parent canon for *intent*):

- Operator local design drafts (white paper + tech spec v0.1, 2026-07-25)  
- Normative milestones: Phase 0–4 and Core 0.1 acceptance in the tech spec  

If this package and the long design drafts disagree on **first-sweep scope**, **this package wins for the first sweep**. Broader product intent still comes from the design drafts for later phases.

## Repo layout after Claude’s sweep (target)

```text
projects/FORGE First Sweep/
  README.md
  …instructions…
  RESULTS_YYYY-MM-DD.md          # Claude writes; Codex may append debug notes
  code/                          # implementation lives here (or linked path)
    README.md
    pyproject.toml               # default first-sweep language: Python 3.11+
    src/forge_core/…
    tests/…
```

Language default for this sweep: **Python 3.11+** (stdlib + pytest). Rust remains the long-term recommendation in the product decision log; this sweep optimizes for dual-seat debug speed and falsifiability, not final binary form. Record a decision note if you change language.

## Humane activation phrases

Operator may say any of:

- “Claude: run the FORGE first sweep.”  
- “Codex: debug the FORGE first sweep.”  
- “Build Phase 0 only.”  

## Authority

`status_authority: NONE`  
History and evidence outrank agent summaries.
