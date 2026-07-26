# One-Machine Ledger (OML) v0

**A minimal, locally verifiable value-conservation machine**

**status_authority:** `NONE`  
**Experiment id:** `SBX-EXP-ONE-MACHINE-LEDGER`  
**Unit:** `OML_UNIT` (zero real-world value; non-redeemable)  
**Zone:** Experimental Sandbox only — not Lab canon, not money, not a network

---

## Abstract

We specify and implement a tiny ledger that runs entirely on one machine and proves, by mechanical replay, that a sequence of signed transfers:

1. conserves a fixed unit supply after genesis,
2. never spends the same output twice in an accepted history,
3. never spends an output without the owner’s Ed25519 signature,
4. links blocks by parent hash and height,
5. collapses to a single **state root** that any checker can recompute from the same bytes.

This is not Bitcoin. It borrows Bitcoin’s *intellectual posture*: a short problem statement, a complete enough mechanism to reimplement, adversarial negatives as first-class tests, and honesty about what is not claimed. Models may propose transactions; they never define validity.

---

## 1. Problem

On a single workstation, humans and AI seats move research artifacts and “play money” through chat, paste buses, and prototypes. Without a local kernel:

- balances are screenshots,
- double-spends are social arguments,
- “final” means whoever spoke last.

We want a **fail-closed referee** that is:

- small enough to read in one sitting,
- strict about bytes (canonical JSON),
- checkable with one command,
- useless as a speculative asset (explicit zero value).

---

## 2. Design principles (lineage)

| Source (local corpus) | What OML takes |
|---|---|
| Bitcoin paper (culture) | Rules over reputation; complete mechanism; adversarial clarity |
| Consensus Foundry | Canonical JSON, domain-separated hashes/signatures, synthetic zero-value credits, AI-not-root |
| NEXUS Drop / Room | Custody as one-live-output transitions; evidence ≠ truth; transport independence |
| RoomFinal posture | Ordering ≠ validity ≠ finality ≠ truth; status honesty |

---

## 3. Objects

### 3.1 Unit

`OML_UNIT` is an integer quantity inside the ledger only. It is not redeemable, not listed, and not a claim on anything outside the process.

### 3.2 Genesis

Operator-declared allocations: a list of `(amount, owner_label, Ed25519 public key)`.  
Genesis is **not mined**. Its hash commits to the sorted allocation list.  
Initial supply \(S_0 = \sum amounts\).

### 3.3 Transaction (UTXO)

- **Inputs:** outpoints `(txid, index)` previously created and still unspent.
- **Outputs:** `(amount, recipient public key)` with positive safe integers.
- **Conservation:** \(\sum inputs = \sum outputs\).
- **Authorization (v0):** every input’s owner key id must equal the single signer key id; the signer Ed25519-signs the canonical **tx core**.
- **Txid:** hash of `{core_hash, public_key, signature}` under domain `OML-TX-V0`.

### 3.4 Block

`{height, prev_hash, transactions[]}` with domain-separated `block_hash`.  
Height must be tip+1; `prev_hash` must equal tip.

### 3.5 State root

Canonical hash of `{protocol, unit, height, tip_hash, utxo[]}` where UTXO entries are sorted by outpoint string.  
Replay of genesis + blocks must reproduce the same state root.

---

## 4. Validation rules (normative summary)

1. Reject non-canonical or non-plain JSON structures (unknown fields, sparse arrays, non-safe integers).
2. Reject bad hashes, bad signatures, wrong signer binding.
3. Reject spends of missing outpoints (`MISSING_UTXO`) — this is double-spend after first accept.
4. Reject `NOT_OWNER` and `CONSERVATION` failures.
5. Reject chain breaks (`prev_hash` / height).
6. Accept only exact protocol id `oml/v0` and unit `OML_UNIT`.

Pseudo-code:

```
state ← apply_genesis(G)
for B in blocks:
    assert B.prev_hash == state.tip
    assert B.height == state.height + 1
    for tx in B.transactions:
        state.utxo ← apply_tx(state.utxo, tx)  # may throw
    state ← advance_tip(B)
assert state.state_root == expected
```

---

## 5. What this proves on one machine

Given the repository tree and:

```bash
cd experiments/SBX-EXP-ONE-MACHINE-LEDGER && npm run verify
```

a checker obtains **four independent green gates**:

1. Node unit tests including adversarial cases E01–E14,
2. Node replay of `fixtures/chain-v0.json` to a pinned `expected_state_root`,
3. **Independent Python dual-implementation** agreeing on the same anchors,
4. **Multi-process file-bus toy net**: two Node processes + poison rejection.

That is **local mechanical agreement** with the rules across languages and processes — not global consensus, not multi-party honesty, not legal finality.

Pinned fixture anchors (v0):

| Field | Value |
|---|---|
| genesis_hash | `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568` |
| tip_hash | `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df` |
| state_root | `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2` |
| height / supply | `2` / `250` `OML_UNIT` |

---

## 6. Attacks considered (v0 → max)

| Id | Attack | Result |
|---|---|---|
| E01 | Replay same signed tx after accept | `MISSING_UTXO` |
| E02 | Create value (outputs > inputs) | `CONSERVATION` |
| E03 | Spend peer’s coin | `NOT_OWNER` |
| E04 | Flip signature bits | `BAD_SIG` |
| E05 | Attach block to wrong parent | `CHAIN` |
| E06 | Smuggle unknown field | `BAD_FIELDS` |
| E07 | Duplicate inputs in one tx | `DUP_INPUT` |
| E08 | Duplicate txid in one block | `DUP_TX` |
| E09 | Height jump | `CHAIN` |
| E10 | Block hash tamper | `BLOCK` |
| E11 | Wrong protocol id | `TX` / fail-closed |
| E12 | Empty block | `BLOCK` |
| E13 | Height past `MAX_HEIGHT` | `BLOCK` |
| E14 | Multi-hop path supply drift | supply conserved |
| E15 | Float amount (genesis or tx output) | `GENESIS` / `TX` |
| E16 | Zero amount (genesis or tx output) | `GENESIS` / `TX` |
| E17 | Amount beyond safe-integer range | `GENESIS` / `TX` |
| E18 | Smuggled field on pasted genesis body | `BAD_FIELDS` |
| E19 | Smuggled field on genesis allocation row | `BAD_FIELDS` |
| E20 | Smuggled field on block | `BAD_FIELDS` |
| E21 | Crafted empty block (bypassing `buildBlock`) | `BLOCK` |
| E22 | Non-array `blocks` on replay | `BAD_ARRAY` |
| E23 | Genesis supply pin (replay supply ≠ allocation sum; lied `owner_key_id`) | `SUPPLY_MISMATCH` / `GENESIS` |
| TOY | Poisoned `expected_state_root` on bus | `STATE_ROOT_MISMATCH` |

Paste-shape variants of E15–E22 (plus `tip-lie` → `TIP_MISMATCH` and
`wrong-protocol` → `GENESIS`) live under `fixtures/adversarial/` — 15 files,
each pinned to its exact `error_code` by `test/paste-corpus.test.mjs`.
`oml-inspect` additionally pins computed supply to the genesis allocation sum
unconditionally, even when the paste omits `expected_supply`.

Not claimed solved: network adversaries, eclipse, reorg markets, key theft, side channels, multi-party liveness, Sybil identity.

---

## 7. Non-claims (load-bearing)

- Not Bitcoin, not a cryptocurrency product, not an ICO, not investment advice.
- Not permissionless consensus; not multi-machine BFT.
- Genesis is trusted declaration for the experiment, like a local sim parameter.
- Ed25519 ownership ≠ human uniqueness.
- AI seats have zero authority over validity.
- `status_authority: NONE`. Sandbox material is not Lab canon.

---

## 8. Why this is “Bitcoin-paper-shaped”

Nakamoto’s paper was not a corporate whitepaper full of roadmap vapor. It was a **problem + mechanism + incentive sketch** dense enough that others could implement and attack it. OML is smaller and intentionally non-monetary, but it follows that shape:

- one page of rules in code,
- a short paper you can argue with,
- tests that encode the argument,
- a single-machine verifier so disagreement is about **rules**, not **vibes**,
- a **second implementation** (Python) that must agree,
- a **multi-process bus** that still does not pretend to be global consensus.

---

## 8b. Why money theater looks like Monopoly next to this (scope-limited)

This section is **not** “OML replaces Bitcoin.” Bitcoin solves (or attempts) a different problem: adversarial multi-party money over an open network. That problem is hard, and OML does not claim it.

For the **narrow problem OML actually states** — *can one machine prove conservation, authorization, and chain linkage from bytes alone?* — currency cosplay looks like Monopoly money:

| Monopoly / cosplay move | OML response |
|---|---|
| “Balances because the UI says so” | state root from sorted UTXO + tip |
| “Trust the model / seat that last spoke” | seats propose; kernel decides |
| “It’s final because we all agree” | only `VALID` via replay; `FINAL` is human-only outside tools |
| “Double-spend is a social fight” | `MISSING_UTXO` is mechanical |
| “One language / one process is truth” | Node + Python must match |
| “Paste it and it becomes real” | paste is `CLAIMED` until local replay |
| “Call it a coin so it feels important” | unit is explicitly zero-value `OML_UNIT` |

**Punchline (research, not market):** once validity is a one-command, dual-language, poison-rejecting replay, **price stickers and narrative finality** look like board-game tokens. Bitcoin itself is not Monopoly — open-network money is a different sport. What looks like Monopoly is **uncorroborated balance theater** wearing chain aesthetics.

---

## 9. Extension path

### Implemented in max push

- Independent second implementation (Python dual-check).
- Multi-process file-bus toy net with poison rejection.
- Paste packet helpers (`scripts/packet.mjs`, `oml-inspect`).
- Extended adversarial corpus E08–E14.

### Implemented in SAFETY MAX slice (fail-closed hardening)

- Strict exact-key validation on the *replay* path: pasted genesis body,
  allocation rows, and blocks reject smuggled fields (`BAD_FIELDS`) instead of
  silently dropping them during rebuild.
- `applyBlock` validates block structure independently of `buildBlock`
  (crafted empty blocks, non-hash fields, height bounds).
- `oml-inspect`: non-array `blocks` → `BAD_ARRAY`; computed supply pinned to
  genesis allocation sum unconditionally (`SUPPLY_MISMATCH` on drift).
- Python dual kernel in lockstep (same checks, same codes, same 2^53−1 bound).
- Adversarial paste corpus 5 → 15 files, each pinned to an exact `error_code`.
- Honest scope document: `SAFETY_PROPERTIES.md` (local strictness + non-claims).

### Implemented in Fable slice (cockpit + paste)

- Matrix Terminal `/oml` soft link (UI help only; not settlement).
- Non-monetary Fable dictionary (`FABLE_DICTIONARY.md`) + `FABLE_HANDOFF.md`.
- Expanded adversarial paste corpus + inspect regression test.
- Drop payload rider golden remains VALID under `oml-inspect`.

### Still open

- Multi-sig inputs; per-input signatures.
- Relative lock / simple scripts.
- Optional third implementation (e.g. Rust) on the same anchors.
- Public index / PR hygiene under Experimental-Sandbox only (operator GO).
- Never: claim real value without a separate, explicit Lab-gated process that this experiment does not provide.

---

## 10. References (local)

- `consensus-foundry` — synthetic economy & canonical discipline  
- `NEXUS-UX-Playground` / Experimental-Sandbox Natoshi-Assistant — Room, Drop, LOOM  
- RoomFinal / Adversarial Finality materials — status vocabulary  
- Bitcoin whitepaper (public domain culture, not affiliation)

---

*End of paper. Implementation: `src/`. Verification: `VERIFY.md`.*
