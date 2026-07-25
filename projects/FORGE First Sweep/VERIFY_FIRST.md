# VERIFY_FIRST — FORGE first sweep

**status_authority:** `NONE`  
**Do this before writing production-shaped code, and re-check after Claude claims done.**

## Load-bearing facts (check, don’t assume)

| # | Fact | How to verify | If false |
|---|------|---------------|----------|
| 1 | This package scopes **Phase 0 only**, not Core 0.1 full TUI | Re-read `CLAIM.md` + `SPEC_SLICE.md` | Stop; rewrite claim before coding |
| 2 | Default language is **Python 3.11+** for this sweep | `python3 --version` on the build machine | Install 3.11+ or document language change in RESULTS |
| 3 | No network providers required for green suite | Tests run offline | Remove live HTTP from first-sweep path |
| 4 | Event ledger is append-only; projections rebuildable | Design intent + tests that mutate DB then rebuild views | Do not ship mutable “source of truth” tables for events |
| 5 | Artifacts are content-addressed and immutable | Write-once object store; second write same hash OK, different bytes same path = reject | Fix store before adapters |
| 6 | A model-shaped payload cannot open gates or create canon | Explicit hostile tests in suite | Kill criterion — not optional |
| 7 | Canon / policy / capability changes require **human actor** | Gate API rejects `actor=model` or equivalent | Kill criterion |
| 8 | Experimental-Sandbox only; no Lab write | Branch under `sandbox/experiment/*`; remotes | Stop if path points at Lab |
| 9 | No secrets in repo | `rg` for key patterns; no `.env` committed | Rotate if leaked; scrub history |
| 10 | Results file is separate from plan | `RESULTS_*.md` exists and records fails honestly | Fail the sweep even if tests green |

## Hermes-pattern traps to re-check here

| Trap | Hermes instance | FORGE equivalent |
|------|-----------------|------------------|
| Docs over binary | “Grok” listed in blogs; not in Herdr registry | Do not claim IPC/TUI features not implemented |
| Wrong benchmark | Bare ollama vs Hermes 64K path | Unit tests that never open SQLite ≠ “ledger works” |
| Silent config drift | Config 33 schema versions behind | Pin schema version in every event; reject unknown |
| Privilege surprise | Desktop setuid path gated off | Any FS write outside `code/` + temp XDG dirs must be listed |
| “It works” without falsifier | Partial DeepSeek-only until local path fixed | All four Phase 0 acceptance bullets must pass |

## What is deliberately unverified in this package

- Full FORGE 1.0 TUI topology  
- Real Hermes / Claude Code / Codex adapters  
- OS sandbox enforcement on third-party CLIs  
- Cross-OS parity  
- Whether Rust is better long-term than Python for the daemon  

Mark those `NOT_IN_SWEEP` if anyone asks.
