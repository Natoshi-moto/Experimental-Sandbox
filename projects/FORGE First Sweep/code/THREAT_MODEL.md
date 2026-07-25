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

## Deliberately out of scope

- OS sandbox escape, multi-user isolation, root attackers, and backup security.
- Network-provider, prompt-injection, or third-party CLI threats.
- A daemon, IPC protocol, TUI, real model adapters, web search, host writes,
  embedded terminals, and production installation.
- Statistical or clean-room independence between agent seats.

