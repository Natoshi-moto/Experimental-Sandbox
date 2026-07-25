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
cd experiments/SBX-EXP-ONE-MACHINE-LEDGER && npm test && npm run verify
```

a checker obtains:

- green unit tests including adversarial cases E01–E07,
- replay of `fixtures/chain-v0.json` to a pinned `expected_state_root`.

That is **local mechanical agreement** with the rules, not global consensus, not multi-party honesty, not legal finality.

---

## 6. Attacks considered (v0)

| Id | Attack | Result |
|---|---|---|
| E01 | Replay same signed tx after accept | `MISSING_UTXO` |
| E02 | Create value (outputs > inputs) | `CONSERVATION` |
| E03 | Spend peer’s coin | `NOT_OWNER` |
| E04 | Flip signature bits | `BAD_SIG` |
| E05 | Attach block to wrong parent | `CHAIN` |
| E06 | Smuggle unknown field | `BAD_FIELDS` |
| E07 | Duplicate inputs in one tx | `DUP_INPUT` |

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
- a single-machine verifier so disagreement is about **rules**, not **vibes**.

---

## 9. Extension path (not implemented)

- Multi-sig inputs; per-input signatures.
- Relative lock / simple scripts.
- Independent second implementation (true Bitcoin-grade cross-check).
- Bridge to NEXUS Drop custody objects as bearer packages of OML proofs.
- Never: claim real value without a separate, explicit Lab-gated process that this experiment does not provide.

---

## 10. References (local)

- `consensus-foundry` — synthetic economy & canonical discipline  
- `NEXUS-UX-Playground` / Experimental-Sandbox Natoshi-Assistant — Room, Drop, LOOM  
- RoomFinal / Adversarial Finality materials — status vocabulary  
- Bitcoin whitepaper (public domain culture, not affiliation)

---

*End of paper. Implementation: `src/`. Verification: `VERIFY.md`.*
