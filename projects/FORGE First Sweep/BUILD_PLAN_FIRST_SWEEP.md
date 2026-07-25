# BUILD PLAN — FORGE first sweep (Claude executes)

**status_authority:** `NONE`  
**Seat:** Claude  
**Debugger seat:** Codex (see `CODEX_DEBUG.md`)  
**State:** `READY` — no API key blocker (unlike Hermes step 0)

## Plain English

Build a small local library (and thin CLI if useful) that is the **spine** of FORGE: a database of events, a blob store for files, rules that rebuild “what’s true about a run” from those events, a pretend model that never hits the internet, and hard walls so a pretend model **cannot** promote something to official truth. Prove it with tests. Write down what happened, including failures.

Do **not** build the pretty multi-pane terminal product yet.

## Operating rules (from Hermes)

1. Execute steps in order.  
2. On kill criterion: **stop**, write RESULTS, do not “cleverly” expand scope to make green.  
3. Never edit this plan to erase a failure; append RESULTS.  
4. No secrets in git. No Lab paths. No provider keys required.  
5. Prefer verifying against running tests over prose in the long tech spec.  
6. When unsure, implement the **smaller** interpretation that still satisfies `CLAIM.md`.

## Step 0 — cold start

1. Read `README.md`, `LESSONS_FROM_HERMES.md`, `VERIFY_FIRST.md`, `CLAIM.md`, `SPEC_SLICE.md`, this file.  
2. Confirm branch is under Experimental-Sandbox `sandbox/experiment/*` (or a worktree of it).  
3. Confirm Python ≥ 3.11 (`python3 --version`).  
4. Create `code/` if missing with `pyproject.toml` (package name e.g. `forge-core`, pytest config).

## Step 1 — skeleton

```text
code/
  README.md                 # how to test
  pyproject.toml
  src/forge_core/
    __init__.py
    types.py                # actors, ids, errors
    hashutil.py             # canonical JSON + hashing
    artifacts.py            # content-addressed store
    ledger.py               # SQLite append-only events
    reduce.py               # projections
    capability.py           # capability + disclosure checks
    broker_read.py          # snapshot import + read-by-hash
    workflow.py             # compile + validate IR
    adapter_fake.py
    canon.py                # human-only canon transitions
    api.py                  # façade used by tests/CLI
  tests/
    test_hash_chain.py
    test_artifacts.py
    test_replay.py
    test_capability.py
    test_canon_hostile.py
    test_smoke_run.py
```

Names may vary; responsibilities must not.

## Step 2 — hash + artifacts

- Canonical JSON: sorted keys, no insignificant whitespace, UTF-8, reject NaN/Inf.  
- Content hash: sha256 of raw bytes; store at `objects/sha256/<aa>/<rest>`.  
- Second put of **identical** bytes is OK (idempotent).  
- Second put of **different** bytes that would claim the same hash path must fail (or be unreachable because hash is of content).  
- No update API for existing objects.

**Exit check:** `pytest tests/test_artifacts.py` green.

## Step 3 — ledger

- SQLite table(s) for events; insert is append-only (no UPDATE/DELETE in normal API).  
- Atomic sequence allocation per domain.  
- `prev_hash` / `event_hash` chain.  
- Reject wrong schema_version / missing fields.

**Exit check:** chain verification test; restart process and re-open DB.

## Step 4 — reducers

From events only, rebuild at least:

- run status  
- list of signals  
- current canon revision id (or null)  
- last denial reasons (optional but useful for debug)

Reducers must be pure given event list. No hidden mutable side tables as truth.

**Exit check:** `test_replay.py` — build state, close, reopen, reduce again, equal.

## Step 5 — capability + read broker

- Import a project snapshot: ordered manifest of path → content hash.  
- Expose source to a worker only through an explicit disclosure decision recorded as event(s).  
- Deny reads without disclosure; record denial.

## Step 6 — workflow compiler + fake adapter

- Compile minimal YAML/dict workflow (one node).  
- Reject cycles / non-finite graphs.  
- Fake adapter produces an attempt output artifact and success event.  
- Wire: create run → import source → compile context → run attempt → propose signal.

## Step 7 — canon walls (load-bearing)

Implement and test:

| Action | Model actor | Human actor |
|--------|-------------|-------------|
| `signal.proposed` | allow | allow |
| `canon.revision_created` | **deny** | allow (with decision/nonce) |
| grant capability | **deny** | allow |
| open gate as self-approve | **deny** | allow |

Hostile tests must call the **public API** the model path would use, not only internal helpers.

**Kill criteria if any fail — stop and write RESULTS.**

## Step 8 — smoke integration

One scripted path (pytest or `python -m forge_core.smoke`):

1. init data dir  
2. import 1–2 text sources  
3. run workflow via fake adapter  
4. model tries canon → fails  
5. human decides → canon exists  
6. restart → projections identical  
7. export a small run pack (hashes + event dump) optional but nice  

## Step 9 — suite bar

```bash
cd code && python -m pytest -q
```

Requirements:

- all tests pass offline  
- at least one hostile canon test  
- at least one replay/restart test  
- no real network calls required  

## Step 10 — RESULTS (mandatory)

Copy `RESULTS_TEMPLATE.md` → `RESULTS_YYYY-MM-DD.md` and fill:

- environment (OS, Python, commit SHA)  
- commands run  
- pass/fail per claim criterion S1–S6  
- bugs hit and how fixed  
- what was **not** built  
- known limitations  

Do **not** mark Core 0.1 complete.

## Step 11 — handoff to Codex

Append to RESULTS:

```text
CODEX_HANDOFF: ready
paths: code/, RESULTS_….md
claim: CLAIM.md
```

Tell the operator Codex can start `HANDOFF_CODEX.md`. Do not “pre-fix” Codex’s job by deleting failing tests.

## What Claude will not do without a new operator order

- Phase 1 daemon/TUI/real adapters  
- Wiring Hermes, Claude Code, or Codex as adapters  
- Full Search, web fetch, host apply  
- YOLO / auto host commands  
- Pushing to Lab  
- Claiming production readiness  
- Expanding claim after failures to make RESULTS look green  

## Kill criteria (stop the sweep)

From `CLAIM.md` falsifier list, plus:

- Cannot run tests without network  
- SQLite schema requires manual edit mid-test to pass  
- “Canon” is only a string in model output with no gate  
- Reducers read mutable tables that are not rebuilt from events  

## Done definition

Claude is done when:

1. `pytest` green offline  
2. `RESULTS_*.md` filed honestly  
3. Claim criteria S1–S6 addressed with evidence  
4. Codex handoff line present  

Claude is **not** done when “structure looks right” but hostile canon tests are missing.
