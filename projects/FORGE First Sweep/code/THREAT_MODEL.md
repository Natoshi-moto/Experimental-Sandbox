# Phase 0 threat model

**status_authority:** `NONE`

## Protected in this sweep

- Model-originated text is never interpreted as human authority.
- The public façade checks actor kind before canon, gate, capability, and
  policy transitions.
- Human decision nonces are persisted as events, consumed once, and checked
  within a serialized SQLite write transaction.
- Events are append-only through the normal API and hash-chained per domain.
- Reducers derive public projections from verified events rather than mutable
  projection tables.
- Artifacts are content-addressed and every read recomputes the digest.
- Source bytes are exposed through the public façade only after both a
  capability grant and a recorded disclosure.
- The fake adapter has no provider, network, shell, or host-apply path.

## Trust boundaries

- The host application supplies `Actor` objects. Phase 0 does not authenticate
  operating-system users; actor identity is trusted input from the future host
  boundary. Model output cannot choose or mutate the host-supplied actor.
- `ArtifactStore` and `EventLedger` are internal storage primitives. The
  supported public boundary is `forge_core.Forge`; direct filesystem or SQLite
  ownership is outside the in-process authorization claim.
- Integrity checks detect disk tampering. They do not prevent an attacker who
  controls the database, object store, code, and all backups from rewriting the
  entire history consistently.

## Added by the debug seat (Anthropic), 2026-07-25

The following were not stated in the original draft of this file. They are
recorded here rather than left implicit.

- **Tail truncation is not detected.** Deleting the newest events from a
  domain leaves a shorter chain that still verifies: every remaining link and
  hash is intact. A pure in-file hash chain cannot detect this without an
  external tip anchor (a signed or off-box record of the expected head).
  Pinned by `tests/test_hash_chain.py::test_tail_truncation_is_not_detected_known_limitation`.
  Middle-row deletion, row corruption, and spliced events from a divergent
  chain **are** detected.
- **The public boundary is declared, not enforced.** Python does not prevent
  importing `EventLedger` or `ArtifactStore` directly past `Forge`. The
  ledger's event catalog binds actor kind per event type, so the canon and
  capability walls hold on that path too, but this is a second wall rather
  than an unreachable one.
- **`workflow.gates.promote_canon` is validated, not consulted.** The canon
  wall is enforced by the actor-kind check in `canon.py`; no promotion path
  receives a `WorkflowIR`. The compiler pins the gate to the single literal
  `human_only`, making it a constant rather than a policy input.
- **`policy.changed` is write-only.** No code path reads a recorded policy
  back, so the policy surface is an audit record, not enforcement.
- **Capability grants cannot be revoked.** No event type withdraws a grant;
  a disclosure is permanent for the life of the domain.
- **The offline guard is Python-level and per-process.** `conftest.py` patches
  `socket` inside the test process only; the subprocess replay tests run
  without it. Those subprocesses touch SQLite alone, and the suite has been
  observed passing inside a network namespace with no interfaces.

## Deliberately out of scope

- OS sandbox escape, multi-user isolation, root attackers, and backup security.
- Network-provider, prompt-injection, or third-party CLI threats.
- A daemon, IPC protocol, TUI, real model adapters, web search, host writes,
  embedded terminals, and production installation.
- Statistical or clean-room independence between agent seats.

