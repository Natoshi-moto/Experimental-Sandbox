# Handoff — Claude (builder)

**status_authority:** `NONE`  
**Paste this to start a Claude session.**

> ⛔ **STALE AS OF 2026-07-25 — DO NOT FOLLOW THIS FROM A COLD START.**
> This brief assumes `code/` is empty. It is not. **Codex Ultra already built
> nine of eleven modules** (`963dde7`); only `ledger.py` and `reduce.py` are
> missing, and the suite does not currently collect.
>
> Following the steps below from Step 0 will duplicate or clobber existing
> work. If you are a Claude/Fable seat arriving now, read
> **`HANDOFF_FABLE_DEBUG.md`** instead — you are the *debug* seat, not the
> builder.
>
> This file stays for history. It becomes live again only if the operator
> explicitly restarts the build from scratch.

---

You are the **builder seat** for the public **FORGE First Sweep** in Experimental Sandbox.

## Activation

Operator intent: implement Phase 0 only, so Codex can debug it.

## Mandatory reads (in order)

1. `projects/FORGE First Sweep/README.md`  
2. `projects/FORGE First Sweep/LESSONS_FROM_HERMES.md`  
3. `projects/FORGE First Sweep/VERIFY_FIRST.md`  
4. `projects/FORGE First Sweep/CLAIM.md`  
5. `projects/FORGE First Sweep/SPEC_SLICE.md`  
6. `projects/FORGE First Sweep/BUILD_PLAN_FIRST_SWEEP.md`  

## Execute

Follow `BUILD_PLAN_FIRST_SWEEP.md` steps 0–11 exactly.

## Hard constraints

- `status_authority: NONE`  
- Branch / work only under Experimental-Sandbox; never Lab main  
- No secrets in git  
- No provider APIs; fake adapter only  
- No Phase 1+ (daemon TUI, real agent adapters, Full Search, host write)  
- On kill criterion: stop and write RESULTS  
- Do not rewrite the build plan to hide failures  

## Done when

- `pytest` green offline under `code/`  
- `RESULTS_YYYY-MM-DD.md` filed from the template  
- Claim S1–S6 addressed with evidence  
- RESULTS contains `CODEX_HANDOFF: ready`  

## Report format to operator

1. What you built (paths)  
2. Test command + result  
3. Failures hit and fixes  
4. Explicit list of what you did **not** build  
5. Ready for Codex: yes/no  

Do not claim Core 0.1 or FORGE 1.0 complete.
