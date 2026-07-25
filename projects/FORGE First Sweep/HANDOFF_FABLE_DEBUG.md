# Fable debug brief — FORGE Phase 0, post-outage

**status_authority:** `NONE`
**Filed:** 2026-07-25 by Claude Code (Anthropic), at operator direction
**Branch:** `sandbox/experiment/forge-first-sweep`
**Review base:** `963dde7` (WIP: FORGE Phase 0 partial build — DOES NOT RUN)
**Builder of record so far:** Codex Ultra (OpenAI), interrupted by upstream 503

---

## 0. State of the tree — read before anything

`python -m pytest -q` currently gives **5 collection errors, 0 tests run**:

```
ModuleNotFoundError: No module named 'forge_core.ledger'
```

Present: `types` `hashutil` `artifacts` `capability` `broker_read` `workflow`
`adapter_fake` `canon` `api` + `THREAT_MODEL.md` + 6 test modules.

Missing: **`ledger.py`**, **`reduce.py`**, `tests/test_replay.py`,
`tests/test_hash_chain.py`.

Six modules `import .ledger`, and `__init__.py` imports `.api` which imports
everything — so one missing module takes the whole package down. Nothing has
been proven. The last clean run (50 tests: hashutil 10, artifacts 5, workflow
34, offline 1) predates canon/capability/api landing.

**No `RESULTS_*.md` exists and none should be written yet** beyond an
`INTERRUPTED` filing. There is nothing honest to put in one.

---

## 1. Independence map — read this before you pick a job

| Component | Built by | Family |
|---|---|---|
| types, hashutil, artifacts, capability, broker_read, workflow, adapter_fake, canon, api | Codex Ultra | OpenAI |
| ledger, reduce | **Grok** (to `LEDGER_SPEC_FOR_GROK.md`) | xAI |
| debug / adversarial pass | **you** | Anthropic |

**Three families, no seat marking its own homework.** This is the strongest
verification setup this project has had — protect it. You wrote none of this
code; attack all of it.

Two caveats to carry into your report:

1. **Grok implemented Codex's design.** The implementation is independently
   produced; the *contract* is not. Implementation bugs get caught by this
   split — an inherited design flaw does not. You are the only seat positioned
   to question the design itself.
2. **Any test Grok wrote to make the suite run is self-written.** Its report
   lists them under `SELF_WRITTEN_TESTS`. **Attack those first** — a builder's
   own tests are the weakest evidence in the run.

If the plan changes and you end up writing production code yourself, say so
explicitly in your results ("modules X and Y are self-reviewed, not
independently verified"). Do not quietly build and then report as reviewer.

---

## 2. Why these two modules are the load-bearing ones

Not because they're hard. Because **every other guarantee in the system is
only as real as they are.**

- `canon.py` denies a model actor *and writes a `permission.denied` event*.
  That audit trail is worth nothing if the log can be edited afterward.
- `capability.py` grants are events. Same.
- The whole confused-deputy defense is: **truth is a function of the event
  history, and the event history is append-only.** Break either half and a
  model can influence "what's true" without leaving a mark.

The walls are already built. The ledger is the ground they stand on.

Note the interrupted seat's own last words: *"taking the transaction boundary
back into the builder seat… chain verification, lifecycle rejection, and
one-time human decisions."* It knew this was the delicate part. Agree with it.

---

## 3. Where a ledger + reducer fakes it

This is the actual job. Each of these produces code that **looks correct and
passes a naive test**. Attack in this order.

| # | Fake | How to catch it |
|---|---|---|
| 1 | **Chain is written but never verified.** `prev_hash`/`event_hash` set on insert; nothing ever walks the chain. | Corrupt one row's payload directly in SQLite, then run verify. Must fail. (THREAT_NOTES abuse case 5) |
| 2 | **Reducers read mutable side tables.** `reduce()` claims to rebuild from events, actually reads a `runs` table written directly. | Drop/blank every non-event table, reduce from events only, compare. This is an explicit **kill criterion**. |
| 3 | **Replay tested in-process.** Build state → reduce → reduce again, same objects in memory. Proves nothing. | Close the DB, **new connection and fresh objects** (ideally a subprocess), reopen, reduce, assert equal. Plan Step 3 exit check says *restart*. |
| 4 | **Append-only is convention, not enforcement.** No UPDATE/DELETE in the API, but nothing stops one. | Grep the whole package for `UPDATE`/`DELETE`. Then ask: does any *public* path rewrite history? (Attacker-with-disk is a documented non-claim — don't chase it.) |
| 5 | **Denial events lost to the transaction boundary.** `canon.py` appends `permission.denied` *then raises*. If the raise unwinds an uncommitted transaction, the audit trail vanishes exactly when it matters most. | Trigger a denial, close, reopen, assert the event is still there. **This is the highest-value single test in the brief.** |
| 6 | **Canonical JSON isn't canonical.** Key order, float formatting, or NaN/Inf leak in. Same logical event hashes differently across runs. | Build the same event two ways (different dict insertion order), assert identical hash. Assert NaN/Inf rejected. |
| 7 | **The nonce is decorative.** Human decision nonce is checked for *presence*, not *consumption*. | Replay the same nonce twice. Second must be denied. (THREAT_NOTES abuse case 3) |
| 8 | **Reducer isn't pure.** Takes a DB handle and queries, rather than taking an event list. | Check the signature. If it can't be called with a plain list of events, it can't be independently verified. |

---

## 4. Then re-attack what Codex already built

Do not assume the nine existing modules are fine because they're finished.

- `test_canon_hostile.py` is genuinely good — it calls the **public API**
  (`forge.open_canon_gate`, `forge.promote_canon`) and asserts both the raise
  *and* the absence of the event. Verify it still holds once a real ledger is
  underneath it, not a stub.
- 34 workflow tests is a lot of surface. Check whether any of them assert
  behavior that only holds because `ledger` was absent.
- `artifacts.py`: second put of identical bytes OK; different bytes claiming
  the same path must fail. Confirm that's tested, not just written.
- `THREAT_MODEL.md` — Codex wrote it. Check it against
  `THREAT_NOTES_FOR_BUILDERS.md` and flag anything quietly dropped.

---

## 5. Kill criteria — stop and file, do not push through

From `CLAIM.md` plus the build plan:

- Tests require network or provider credentials to pass
- SQLite schema needs manual editing mid-test to go green
- "Canon" turns out to be a string in model output with no gate
- Reducers read mutable tables not rebuilt from events
- You cannot make a test deterministic

**And the meta one:** if you find yourself narrowing the claim, deleting a
failing test, or expanding scope so RESULTS looks green — **stop.** The plan
says it twice: *"Never edit this plan to erase a failure; append RESULTS"* and
*"Do not 'pre-fix' by deleting failing tests."*

A red result filed honestly is a successful round here.

---

## 6. Non-goals

- Phase 1 daemon / TUI / real adapters
- Wiring Hermes, Claude Code, or Codex as real adapters
- Full Search, web fetch, host apply
- Any Nexus Lab path, branch, or promotion
- Claiming Core 0.1 or production readiness
- Real money, tokens, economic value

---

## 7. Done definition

1. `pytest` runs **offline** and you can state the true pass/fail count
2. At least one hostile canon test and one restart/replay test actually execute
3. `RESULTS_YYYY-MM-DD.md` filed with S1–S6 addressed **including fails**
4. Independence stated plainly: who built what, which parts are self-reviewed

You are **not** done when "structure looks right" and the suite is green but
the replay test never crossed a process boundary.

## Continuity block

```text
SEAT_NAME:
MODEL_FAMILY:
REVIEW_BASE_SHA: 963dde7
WROTE_LEDGER_REDUCE: yes | no
DATE_UTC:
SUITE_RESULT: collected=? passed=? failed=?
VERDICT: claim untested | partially evidenced | falsified
```

## Non-claims

- `status_authority: NONE`
- This brief is guidance, not authorization to merge or promote anything.
- Nothing here asserts the Phase 0 claim holds or fails.
