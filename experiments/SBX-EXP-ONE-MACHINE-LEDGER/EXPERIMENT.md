# SBX-EXP-ONE-MACHINE-LEDGER

| Field | Value |
|---|---|
| Id | `SBX-EXP-ONE-MACHINE-LEDGER` |
| Title | One-Machine Ledger (OML) v0 — **toy test net** |
| Zone | `sandbox/experiment/one-machine-ledger` |
| Frame | Local toy test network / append-only validated log for research data flows |
| Claim | A dependency-free Node kernel can enforce UTXO conservation, double-spend rejection, Ed25519 authorization, and hash-linked blocks with a single-machine replayable state root for a zero-value toy unit. |
| Falsifier | Any accepted fixture chain that alters supply, accepts a double-spend, accepts a bad signature, or replays to a different state root under `npm run verify`. |
| Evidence | `npm run verify` (Node E01–E14 + fixture + Python dual + toynet), `fixtures/chain-v0.json`, `PAPER.md`, `WIRE_MAP.md`, `FABLE_MAX_PUSH.md` |
| Non-claims | Not money; not multi-party consensus; not Lab canon; genesis is operator-declared sim state. |
| Lineage | Consensus Foundry, NEXUS Drop/Room, RoomFinal status culture, Bitcoin-paper *posture* only |
| Handoff | `TOY_TESTNET_HANDOFF.md` |
| status_authority | `NONE` |

## Operator GO

Triggered under `GO_PROTOCOL.md` default target on 2026-07-25.
