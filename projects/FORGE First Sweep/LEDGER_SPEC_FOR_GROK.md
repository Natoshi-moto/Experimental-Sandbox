# Ledger + reducer spec — Grok builder seat

**status_authority:** `NONE`
**Filed:** 2026-07-25 by Claude Code (Anthropic), at operator direction
**Branch:** `sandbox/experiment/forge-first-sweep`
**Base SHA:** `4d8546e`
**Your job:** write `src/forge_core/ledger.py` and `src/forge_core/reduce.py`. Nothing else.

---

## 0. Read this first — you have less design freedom than you think

Nine modules already exist and **already call your code**. The interface is not
yours to choose; it is pinned by the call sites. `Event` is already fully
defined in `types.py`, including `to_hash_dict()`, which already declares
exactly which fields the hash commits to.

**Your job is to implement to a contract, not to design one.** If you redesign
the interface, six modules break and the seat that debugs this cannot tell your
bugs from your redesign.

If you believe the contract is wrong: **say so in writing and stop.** Do not
"improve" it silently.

---

## 1. Independence map (why this seat exists)

| Component | Seat | Family |
|---|---|---|
| types, hashutil, artifacts, capability, broker_read, workflow, adapter_fake, canon, api | Codex Ultra | OpenAI |
| **ledger, reduce** | **you** | **xAI** |
| adversarial debug pass | Fable | Anthropic |

Three families, no seat marking its own homework. This is the strongest
verification setup this project has had.

**One honest caveat to record:** you are writing to Codex's design. Your
implementation is independent; the *design* is not. So implementation bugs get
caught by this split — a flawed design gets inherited. If something in the
contract smells wrong, that is exactly the thing worth reporting, because
nobody else is positioned to notice it.

---

## 2. The contract — exact

### `EventLedger`

```python
EventLedger(data_dir)            # api.py:44 — EventLedger(self.data_dir)
```

Methods actually called by existing code:

| Call | Used by | Notes |
|---|---|---|
| `.append(domain_id: str, type: str, actor: Actor, payload: dict) -> ?` | canon, capability, broker_read | **Return value is never used** at any call site — returning the `Event` is preferred, but nothing depends on it |
| `.append_batch(domain_id: str, entries: list[tuple[str, Actor, dict, None]]) -> ?` | canon, adapter_fake | 4-tuple: `(type, actor, payload, X)`. **`X` is `None` at every existing call site.** Treat it as an optional override you do not yet need — simplest correct move is to reject non-`None` with `ValidationError` and note it. Do not invent semantics for it |
| `.events(domain_id: str) -> Iterable[Event]` | canon, capability, broker_read, api | Ordered by `seq` ascending |

`append_batch` must be **atomic**: all entries land or none do. That is the
whole reason it exists as a separate method — `canon.py` uses it to write
`human.decision_recorded` and `canon.revision_created` together.

### `reduce`

```python
from .reduce import Projection, reduce_events   # api.py:16
reduce_events(self._ledger.events(run_id)) -> Projection   # api.py:296
```

`Projection` must expose at minimum:

- `.canon_head` — current canon revision id, or `None` (asserted in `test_canon_hostile.py`)
- `.to_dict()` — used by the smoke path

Build the rest from the plan's Step 4: run status, list of signals, last denial
reasons. **`reduce_events` must be pure given the event list** — it takes an
iterable of `Event`, not a database handle. If it can't be called with a plain
Python list, it is wrong.

### `Event` — already written, do not redefine

`types.py:162`, frozen dataclass, slots. Fields:

```
event_id, domain_id, seq, type, schema_version, actor, payload,
prev_hash, event_hash
```

`to_hash_dict()` already declares exactly what `event_hash` commits to:
everything **except** `event_hash` itself. Hash that dict via `hashutil`'s
canonical JSON. Do not invent a second hashing scheme.

Validation already enforced by `Event.__post_init__`: `seq >= 1`, payload is a
`dict` with string keys, `prev_hash` is `None` or a sha256 digest, `event_hash`
is a sha256 digest. You do not need to re-check those.

---

## 3. Hard requirements

1. **Append-only.** No UPDATE, no DELETE in the normal API. Grep your own file before you finish.
2. **Hash chain.** `prev_hash` of event *n* = `event_hash` of event *n−1* within the same domain. First event in a domain has `prev_hash = None`.
3. **Provide a chain verifier.** Something that walks a domain and recomputes. Without it, the chain is decoration — nothing else in the system can check it.
4. **Atomic sequence allocation per domain.** Two concurrent appends must not produce a duplicate `seq` or a forked chain.
5. **Survives restart.** Close the DB, reopen it in a fresh connection, `events()` returns the same sequence and the chain still verifies.
6. **Reject unknown `schema_version`.** `SCHEMA_VERSION = 1` in `types.py`.
7. **Offline.** No network, no provider credentials, SQLite + stdlib only.

---

## 4. Traps — these produce code that looks right and is hollow

| # | Trap | Why it matters |
|---|---|---|
| 1 | **Chain written but never verified.** You compute `prev_hash`/`event_hash` on insert and nothing ever walks it. | Silent. Every test passes. Ship the verifier in the same commit as the writer |
| 2 | **Transaction boundary drops denial events.** `canon.py` calls `ledger.append("permission.denied", …)` **and then raises `AuthorizationError`**. If that raise unwinds an uncommitted transaction, the audit trail vanishes at exactly the moment it mattered. | **This is the single highest-risk line in the whole build.** Your `append` must commit before returning, independent of what the caller does next |
| 3 | **Reducer reads a side table.** `reduce_events` quietly queries the DB for "current status" instead of folding the event list. | Explicit **kill criterion** in the build plan |
| 4 | **Non-canonical JSON.** Key order or float formatting leaks into the hash. Same logical event hashes differently on replay. | Use `hashutil` — it already handles sorted keys and rejects NaN/Inf. Don't hand-roll `json.dumps` |
| 5 | **`seq` from `len(events)`.** Breaks under concurrency and after any read filter. | Allocate inside the transaction |

The interrupted Codex seat named #2 itself as the thing it was coming back for:
*"chain verification, lifecycle rejection, and one-time human decisions."* It
was right. Start there.

---

## 5. Boundaries

- **Do not modify the nine existing modules.** If your ledger cannot satisfy a
  call site, that is a **finding** — write it down and report it. Do not adjust
  their code to fit yours. A builder "helpfully" rewriting call sites destroys
  the debug seat's baseline.
- Do not write `tests/test_replay.py` or `tests/test_hash_chain.py` **as proof
  of your own work**. You may write them so the suite runs — but say plainly in
  your report that they are self-written, so Fable knows to attack them first.
- Do not touch any Nexus Lab path or branch.
- Do not file `RESULTS_*.md` — that is the debug seat's step.
- No secrets, no provider APIs, no Phase 1 features.

---

## 6. Kill criteria — stop and report

- The pinned contract cannot be satisfied without changing existing modules
- Tests need network or credentials
- You cannot make sequence allocation deterministic under concurrency
- You find yourself deleting or weakening an existing test to go green

A stop with a written reason is a good outcome here. Silent scope expansion is not.

---

## 7. Report back with

```text
SEAT_NAME: Grok
MODEL_FAMILY: xAI
BASE_SHA: 4d8546e
FILES_WRITTEN:
CONTRACT_DEVIATIONS: none | <list>
EXISTING_MODULES_TOUCHED: none | <list + why>
SELF_WRITTEN_TESTS: <list — Fable attacks these first>
SUITE: collected=? passed=? failed=?
CHAIN_VERIFIER: present | absent
DENIAL_EVENT_SURVIVES_RAISE: verified | not tested
```

That second-to-last line is the one that matters most.

## Non-claims

- `status_authority: NONE`
- This spec is guidance, not authorization to merge or promote.
- Nothing here asserts the Phase 0 claim holds or fails.
