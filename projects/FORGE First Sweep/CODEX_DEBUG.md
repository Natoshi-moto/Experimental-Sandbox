# CODEX DEBUG — FORGE first sweep

**status_authority:** `NONE`  
**Seat:** Codex  
**Builder seat:** Claude (`BUILD_PLAN_FIRST_SWEEP.md`)  
**Job:** Adversarial debug and verification — not a second implementation contest.

## Mindset

Hermes taught: third-party claims and same-model agreement are weak. Your job is to **try to kill** `CLAIM.md` with the code Claude shipped.

You may patch **minimal** fixes when a defect is clear and covered by the claim. You must not:

- expand into Phase 1+ features  
- delete hostile tests to get green  
- rewrite Claude’s RESULTS to hide reds  
- declare Lab authority or Core 0.1 complete  

## Cold start

1. Read `CLAIM.md`, `VERIFY_FIRST.md`, `SPEC_SLICE.md`, Claude’s `RESULTS_*.md`, then `code/`.  
2. Record base commit SHA.  
3. Re-run the suite yourself (do not trust Claude’s “all passed” prose).

```bash
cd "projects/FORGE First Sweep/code"
python3 -m pytest -q
# Prefer also:
#   unshare -n python3 -m pytest -q    # if available: no network namespace
# or: EXTERNAL network disabled / offline mode
```

## Debug protocol (ordered)

### D0 — Reproduce

| Check | Pass if |
|-------|---------|
| Suite runs | exit 0 or documented reds match RESULTS |
| Offline | no provider keys; no unexpected DNS/HTTP |
| Paths | no writes into Lab or home configs outside documented data dir |

If suite does not run, fix environment **or** file a blocker in `RESULTS` appendix; do not invent missing modules silently without tests.

### D1 — Claim map

For each success criterion S1–S6 in `CLAIM.md`, write in your appendix:

| ID | Test names that cover it | Gap? |
|----|--------------------------|------|
| S1 | … | Y/N |
| … | | |

Any `Y` is a defect even if pytest is green.

### D2 — Hostile battery (must attempt)

Implement or run additional cases if missing (add tests under `tests/hostile/` or extend existing):

1. **Model canon:** actor model calls promote/create canon → must fail; DB unchanged for canon head.  
2. **Model capability grant:** must fail.  
3. **Double-spend style:** reuse a one-time human decision nonce → second promote fails.  
4. **Artifact mutate:** overwrite blob file on disk then verify detection or hard failure on read/verify.  
5. **Hash chain break:** surgically corrupt one event payload in SQLite → verify/reduce fails closed.  
6. **Disclosure bypass:** attempt raw read of source bytes without exposure event → deny.  
7. **Reducer cheat:** if any non-event table exists, force it out of sync with events; public “get projection” must follow events or hard-fail, not the stale table.  
8. **Schema junk:** extra fields / wrong types / unknown event type → reject or quarantine, never silent accept into canon.  
9. **Replay drift:** run smoke twice with same inputs; projections compare equal (allowing new run ids if documented).  
10. **Late success:** after cancel/fail, if API allows, attempt to append `attempt.succeeded` out of order → reject.

### D3 — Process / API smells

Flag (and fix only if in-scope):

- public functions that take `force=True` for canon  
- model path sharing code with human path without actor check  
- mutable global state across tests  
- network imports in non-test code (`httpx`, `requests`, `openai`, etc.) without guard  
- subprocess to real agent CLIs  

### D4 — Minimal patches

Allowed:

- fail-closed checks  
- missing tests for claimed properties  
- bugfixes in ledger/artifacts/capability/canon  
- clearer errors  

Not allowed without operator order:

- TUI, daemon service, real adapters  
- renaming the project into a different product  
- “soft” canon for demos  

### D5 — Re-verify

```bash
python3 -m pytest -q
```

Append to Claude’s RESULTS file (do not delete Claude’s section):

```markdown
## Codex debug appendix — YYYY-MM-DD

- Base SHA (Claude): …
- Codex SHA: …
- Suite: pass/fail
- Claim map gaps: …
- Hostile battery: table of attempt → result
- Patches: bullet list with intent
- Residual risks: …
- Verdict: CLAIM_HOLDS | CLAIM_FAILS | CLAIM_HOLDS_WITH_LIMITATIONS
```

### D6 — Verdict rules

| Verdict | When |
|---------|------|
| `CLAIM_HOLDS` | S1–S6 evidenced; hostile battery clean; no critical gaps |
| `CLAIM_HOLDS_WITH_LIMITATIONS` | Claim true as worded; important follow-ups listed (not Phase 1 scope sneak-in) |
| `CLAIM_FAILS` | Any falsifier hit remains |

## Output Codex must leave

1. Updated tests/code if patches were needed  
2. RESULTS appendix with verdict  
3. Optional `DEBUG_NOTES.md` only if long; prefer RESULTS appendix  

## What “debug” does not mean

- Not rewriting the white paper  
- Not rubber-stamping because Claude is “usually right”  
- Not multi-hour architecture redesign  
- Not requiring Rust rewrite in this sweep  

## Kill criteria for the **pair** (Claude+Codex)

The first sweep is red if after Codex’s pass:

- model can still create canon through any public API  
- replay is nondeterministic  
- suite needs network  
- RESULTS lack honesty about residual failures  
