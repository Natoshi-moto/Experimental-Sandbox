# SBX-EXP-ONE-MACHINE-LEDGER

| Field | Value |
|---|---|
| Id | `SBX-EXP-ONE-MACHINE-LEDGER` |
| Title | One-Machine Ledger (OML) v0 |
| Zone | `sandbox/experiment/one-machine-ledger` |
| Claim | A dependency-free Node kernel can enforce UTXO conservation, double-spend rejection, Ed25519 authorization, and hash-linked blocks with a single-machine replayable state root for a zero-value unit. |
| Falsifier | Any accepted fixture chain that alters supply, accepts a double-spend, accepts a bad signature, or replays to a different state root under `npm run verify`. |
| Evidence | `npm test` (12 pass), `npm run verify`, `fixtures/chain-v0.json`, `PAPER.md` |
| Non-claims | Not money; not a network; not Lab canon; not multi-party consensus; genesis is operator-declared. |
| Lineage | Consensus Foundry, NEXUS Drop/Room, RoomFinal status culture, Bitcoin-paper posture |
| status_authority | `NONE` |

## Operator GO

Triggered under `GO_PROTOCOL.md` default target on 2026-07-25.
