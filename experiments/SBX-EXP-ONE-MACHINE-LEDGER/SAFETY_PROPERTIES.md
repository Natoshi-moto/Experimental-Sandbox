# SAFETY PROPERTIES — what this toy actually enforces, and what it does not

**status_authority:** `NONE`
**Experiment:** `SBX-EXP-ONE-MACHINE-LEDGER`
**Frame:** local toy test net / append-only validated log. Zero real value by design.
**Date:** 2026-07-25 (SAFETY MAX slice)

This is a systems document, not marketing. Every claim below is scoped to **one
machine replaying bytes it already holds**. Nothing here is a claim about open
networks, other parties, or value.

---

## 1. Dimensions where this toy is *stricter locally* than balance theater

These are mechanical properties a reader can check with `npm run verify` and
`npm run inspect -- <file>`:

| Property | Mechanism |
|---|---|
| Dual implementation or fail | Independent Node and Python kernels must reproduce the same genesis hash, tip, state root, and supply from the same bytes; divergence is a verify failure, not a footnote. |
| Multi-process agreement or fail | Two Node processes exchange packets over a file bus and must land on the same state root; a poisoned `expected_state_root` is rejected (`STATE_ROOT_MISMATCH`). |
| Poison fails closed | Every unknown, malformed, or lying paste yields `INVALID` + a specific `error_code`. There is no "best effort" acceptance path. |
| Exact fields only | Genesis body, allocation rows, transactions, and blocks are validated against exact key sets on replay. A smuggled field is `BAD_FIELDS`, never silently ignored — including on the pasted-genesis path, not just at build time. |
| Numeric edges closed | Float, zero, negative, and beyond-`Number.MAX_SAFE_INTEGER` amounts are rejected with explicit codes in both implementations (Python enforces the same 2^53−1 bound as Node). |
| Supply pinned to genesis | `oml-inspect` recomputes supply from replayed UTXO and compares it to the sum of genesis allocations **unconditionally** — drift is `SUPPLY_MISMATCH` even when the paste omits `expected_supply`. |
| Blocks are structural, not narrative | Non-array `blocks`, crafted empty blocks, height jumps, wrong parents, and hash tampers are all rejected at `applyBlock`/`replay`, even when the block was never built by our own `buildBlock`. |
| Models never define validity | AI seats can propose packets; only kernel replay produces `VALID`/`INVALID`. No seat, human or model, can bless a state by asserting it. |
| No auto-`FINAL` | The tools emit `CLAIMED`, `VALID`, `INVALID`, `SUSPENDED` only. `FINAL` is a human word used outside these tools. |
| Zero real value by design | `OML_UNIT` is a non-redeemable integer counter inside the log. There is nothing to steal because there is nothing to redeem. |

The point of these properties: on this narrow problem — *can one machine prove
conservation, authorization, and linkage from bytes alone?* — a screenshot of a
balance, or a model saying "trust me, it's final", carries exactly zero weight.
That is what "stricter than balance theater" means, and all it means.

## 2. Explicit non-claims (the part coin marketing leaves out)

This toy does **not** attempt, and must never be described as attempting:

- **Open-network money.** Bitcoin's actual problem — adversarial multi-party
  value transfer over a permissionless network — is out of scope entirely.
- **Multi-party honesty / BFT.** Two processes on one laptop agreeing is a
  same-bytes check, not consensus. There is no adversarial quorum here.
- **Sybil resistance.** Keys are free to mint; nothing binds a key to a person.
- **Reorg or fork-choice markets.** There is one chain per paste; there is no
  competition between histories and no incentive layer.
- **Key theft / endpoint compromise.** If a private key leaks, its rows spend.
  Nothing here detects or prevents that.
- **Network adversaries, eclipse, DoS, side channels.** No network exists.
- **Liveness.** Nothing guarantees anyone ever produces another block.
- **Value, price, redeemability, investment meaning.** `OML_UNIT` is a toy
  counter. Any sentence attaching worth to it is wrong by construction.

If a sentence about this toy would sound off in a library systems meeting,
it is off.

## 3. Punchline

> OML is a dependency-free local referee for an append-only log of toy
> transfers: dual implementations and multi-process seats must agree on the
> state root, poison claims fail closed, and models never define validity — so
> uncorroborated balance theater looks like Monopoly paper. Not money. Not
> Bitcoin. Lab untouched.

---

*Verification: `npm run verify` (Node tests E01–E23 + fixture replay + Python
dual + toynet poison). Attack table: `PAPER.md` §6. Vocabulary law:
`FABLE_DICTIONARY.md`.*
