# SPEC_SLICE — Phase 0 only

**status_authority:** `NONE`  
**This is the first-sweep technical bound.** It is intentionally smaller than the full FORGE tech spec.

## Design axioms that bind this sweep

1. **Dirty brain, clean spine, clean rooms** — spine is deterministic software; first sweep has no real dirty Meta-Executive.  
2. **Models propose; software constrains; humans authorize.**  
3. **Immutable source; derived views.**  
4. **Epistemic status does not rise through prose.**  
5. **Human merge authority** for canon.

## Deliverables (must ship)

| Deliverable | Minimum meaning |
|-------------|-----------------|
| Threat notes | Short `THREAT_MODEL.md` in `code/`: what we defend in-process, what we don’t |
| Core schemas | Versioned event + artifact + capability + decision records (JSON schema or typed dataclasses + version field) |
| SQLite ledger | Append-only events with sequence + hash chain within a domain |
| Object store | Content-addressed blobs under a data directory |
| Deterministic reducers | Rebuild projections (e.g. run status, canon head, signal list) from events only |
| Fake adapter | Implements attempt lifecycle: start → output → succeed/fail; no network |
| Workflow compiler | YAML or dict → validated finite workflow IR (one node is enough) |
| Read Broker skeleton | Project-snapshot import: ordered manifest + content hashes; read by hash only |
| Capability / disclosure engine | Checks before read exposure and before state-changing ops |

## Acceptance (Phase 0)

From product plan — all required:

- replay is deterministic  
- sources and artifacts are immutable  
- unauthorized reads and state mutations fail  
- a model cannot create canon  

## Explicit non-deliverables (first sweep)

| Item | Phase |
|------|-------|
| Linux daemon + rich IPC | 1 |
| Thin status/review TUI | 1 |
| Real structured endpoint / CLI agent adapter | 1 |
| Fan-out/join across real workers | 1 |
| Full Search / web fetch | 3 |
| Host write / apply patch | 3 |
| Embedded private terminal | 2 |
| Hermes / Codex / Claude adapters | 2 |
| Session Compiler / concept graph | 4 |

## Suggested data layout (may use temp dirs in tests)

```text
$FORGE_DATA/   # or pytest tmp_path
  forge.db
  objects/sha256/ab/<rest>
  exports/
```

Config may live under a test config dir; XDG paths are fine if tests override them.

## Minimum event types to implement

Enough to exercise the claim (names may match product catalog):

- `run.created`, `run.started`, `run.completed`, `run.failed`  
- `source.imported`, `source.exposed`  
- `context.compiled`  
- `attempt.started`, `attempt.output_received`, `attempt.succeeded`, `attempt.failed`  
- `signal.proposed`  
- `human.gate_opened`, `human.decision_recorded`  
- `canon.revision_created`  
- `permission.denied` (or equivalent audit on rejection)

Every event: `event_id`, `domain_id`, `seq`, `type`, `schema_version`, `actor`, `payload` or artifact ref, `prev_hash`, `event_hash`.

## Canon rules

- `canon.revision_created` **only** if actor is human (or a human-bound decision record with nonce).  
- Model output may create `signal.proposed` only.  
- No auto-promotion from “two fake workers agreed.”

## Fake adapter contract

```text
Input:  compiled context ref + node spec
Output: immutable attempt output artifact + success/fail
Must:   not call network; not write outside data dir; not mutate prior artifacts
```

## Workflow IR (minimum)

Finite, versioned, single-node OK:

```yaml
id: smoke.council_lite
version: 1
nodes:
  - id: think
    kind: fake_model
    lens: null
gates:
  promote_canon: human_only
```

Compiler rejects cycles, missing nodes, and unbounded loops.

## Testing bar

- Unit tests for hash chain, immutability, reducers  
- Integration test: full smoke path + restart replay  
- Hostile tests: model canon, capability bypass, artifact overwrite, invalid schema  
- Offline: no live sockets to the internet  

Prefer `pytest`. Target: **fast** suite (< 30s on a normal laptop).

## Language

Default: Python 3.11+.  
If Claude switches language, document why in RESULTS and keep the same claim/falsifier.
