# Claim — FORGE first sweep (Phase 0)

**status_authority:** `NONE`  
**ID:** `SBX-EXP-FORGE-FIRST-SWEEP-001`

## Claim (one falsifiable sentence)

A local FORGE Phase 0 core can record append-only hash-chained events, store immutable content-addressed artifacts, rebuild projections by deterministic reducers, run a workflow through a **fake** adapter, and **reject** any attempt by a model-shaped actor to create canon, grant capability, or change policy — all without network providers, host writes outside the forge data dir, or a full TUI.

## Falsifier

Any of the following kills the claim:

1. Event replay after restart (new process, same DB) yields different projections.  
2. An artifact’s bytes can be changed in place while keeping the same content hash path accepted as valid.  
3. Unauthorized read or state mutation (wrong capability / missing disclosure) succeeds.  
4. A payload with `actor_kind=model` (or equivalent) can create a canon revision, open a human gate, or grant a capability.  
5. Green suite requires outbound network or real provider credentials.  
6. Implementation silently includes Full Search, host apply, or real CLI adapters as required for the suite to pass.

## Smallest test surface

Automated tests under `code/tests/` plus a CLI or library entrypoint that:

- creates a run  
- imports a frozen source snapshot  
- compiles a minimal context  
- executes one fake-adapter attempt  
- proposes a signal  
- attempts illegal canon promotion (must fail)  
- records a human decision that creates canon (must succeed)  
- restarts and replays  

## Non-claims

- Not Core 0.1 complete (no daemon/TUI/real adapters requirement).  
- Not FORGE 1.0.  
- Not multi-agent independence or “clean room” statistical independence.  
- Not secure against an attacker who owns the DB and all backups (hash chain is integrity, not BFT).  
- Not a production install story.  
- Not Lab-canonical.  
- Not a token, economy, or real-world value system.  

## Success criteria (must all pass)

| # | Criterion | Evidence |
|---|-----------|----------|
| S1 | Deterministic replay | Test + RESULTS command log |
| S2 | Immutable sources/artifacts | Hostile overwrite test fails closed |
| S3 | Unauthorized ops fail | Capability/disclosure denial tests |
| S4 | Model cannot create canon | Explicit hostile test |
| S5 | Offline suite | Tests pass with network blocked or no keys |
| S6 | Honest RESULTS file | Dated `RESULTS_*.md` with fails if any |

## Related product phases (out of scope)

Phase 1 Core 0.1, Phase 2 TUI, Phase 3 search/code, Phase 4 NEXUS — **new claims later**.
