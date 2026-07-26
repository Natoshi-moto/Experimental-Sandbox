# Handoff — Fable slice complete (OML toy test net)

**status_authority:** `NONE`  
**Date:** 2026-07-25  
**Seat writing this:** Grok continuing Fable’s max-push lane  
**Re-verified:** 2026-07-25, Fable seat (Claude) — full A–E re-check, see “Fable re-verify pass” below  
**SAFETY MAX slice:** 2026-07-25, Fable seat (Claude) — fail-closed hardening, see “SAFETY MAX pass” below  
**Experiment:** `SBX-EXP-ONE-MACHINE-LEDGER`  
**Frame:** local toy test network / data puzzle — **not** money, **not** Bitcoin replacement, **not** Lab canon

---

## One sentence

The sandbox toy still makes uncorroborated balance theater look like Monopoly paper: dual-language + multi-process agree or fail, poison fails closed, and the cockpit now has a `/oml` soft-link in systems language only.

---

## What this seat finished

| Item | Where |
|---|---|
| Cockpit `/oml` + `/help` line | `~/Projects/NEXUS-UX-Playground/matrix_terminal.py` |
| Soft-link doc (already present, kept) | `~/Projects/NEXUS-UX-Playground/OML.md` |
| Non-monetary Fable dictionary | `FABLE_DICTIONARY.md` (this tree) |
| Adversarial paste expansion | `fixtures/adversarial/` — now 5+ files including `bad-sig.json`, `height-lie.json` |
| Paste corpus regression test | `test/paste-corpus.test.mjs` |
| Drop rider still VALID | `fixtures/drop-payload-rider.json` |
| Paste cards re-pointed | Desktop + experiment `PASTE_ME_TO_FABLE.txt` → next seat |
| Prior max gates unchanged | `npm run verify` (Node + Python dual + toynet) |

### Adversarial paste map (expect INVALID)

| File | Typical `error_code` |
|---|---|
| `broken-parent.json` | `CHAIN` |
| `inflated-supply.json` | `SUPPLY_MISMATCH` |
| `poison-state-root.json` | `STATE_ROOT_MISMATCH` |
| `bad-sig.json` | `BAD_SIG` |
| `height-lie.json` | `HEIGHT_MISMATCH` |

### Pinned anchors (unchanged)

| Field | Value |
|---|---|
| genesis_hash | `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568` |
| tip_hash | `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df` |
| state_root | `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2` |
| height / supply | `2` / `250` `OML_UNIT` |

---

## Fable re-verify pass (2026-07-25, Claude seat)

Everything above was independently re-checked; nothing regressed, nothing rewritten.

| Check | Result |
|---|---|
| `npm run verify` (all 4 gates) | **PASS** — 22 Node tests (incl. paste-corpus), fixture replay, Python dual `cross_impl_agreement=true`, toynet poison → `STATE_ROOT_MISMATCH` |
| Cockpit `/oml` + `/help` line | present in `matrix_terminal.py` (handler `_show_oml_soft_link`, help at the `/oml` line); `OML.md` + `PROJECT_MEMORY.md` note intact |
| `fixtures/drop-payload-rider.json` | `VALID`, shape `envelope(payload):fixture`, pinned state_root matches |
| `fixtures/adversarial/*` (5 files) | all `INVALID` with expected codes: `CHAIN`, `SUPPLY_MISMATCH`, `STATE_ROOT_MISMATCH`, `BAD_SIG`, `HEIGHT_MISMATCH` |
| `test/paste-corpus.test.mjs` in gate | yes — listed in `scripts/verify.mjs` |
| Language sweep (forbidden terms) | only inside tone-law tables / disclaimers; no cosplay drift |
| Paste cards (Desktop + experiment) | byte-identical, point at next seat |
| Lab | untouched (read-only, as required) |

**New this pass** (additive only, in `reports/`):

- `reports/PASTE_READY_OML_CHAIN_PACKET.json` — `OML_CHAIN_PACKET`, status `CLAIMED`, wraps `fixtures/chain-v0.json`
- `reports/PASTE_READY_OML_VERIFY_RECEIPT.json` — `OML_VERIFY_RECEIPT`, status `VALID`, pinned anchors

Operator can paste either file into any seat chat as-is; regenerate with:

```bash
node scripts/packet.mjs chain fixtures/chain-v0.json   # chain packet
npm run inspect -- fixtures/chain-v0.json              # fresh receipt
```

---

## SAFETY MAX pass (2026-07-25, Fable seat)

Additive fail-closed hardening. Anchors unchanged; good fixture and drop rider
still `VALID` against the same pinned roots.

**Kernel (Node `src/ledger.mjs` + Python dual in lockstep):**

- New `validateGenesisBody` runs at the top of `replay`: pasted genesis body
  and every allocation row are exact-keys-only; smuggled fields → `BAD_FIELDS`
  (previously silently dropped during rebuild); lied `owner_key_id` → `GENESIS`.
- `applyBlock` now validates block structure itself (exact keys, hash formats,
  height bounds, dense non-empty transactions) — a crafted empty block with a
  self-consistent hash no longer slips past `buildBlock`.
- `replay` rejects non-array `blocks` (`BAD_ARRAY`) and non-hash genesis_hash.
- Python dual enforces the same 2^53−1 safe-integer bound as Node (was
  unbounded int), plus all checks above — same codes, same fixture anchors.

**Inspector (`scripts/oml-inspect.mjs`):**

- Non-array `blocks` → `INVALID BAD_ARRAY` before replay.
- Computed supply is pinned to the genesis allocation sum **unconditionally**
  → `SUPPLY_MISMATCH` on drift even when `expected_supply` is omitted.

**Corpus:** `fixtures/adversarial/` 5 → **15** files; `test/paste-corpus.test.mjs`
now pins each file to its exact `error_code` (threshold ≥15). New files:
`tip-lie` (`TIP_MISMATCH`), `smuggled-genesis-field` / `smuggled-alloc-field` /
`smuggled-block-field` (`BAD_FIELDS`), `wrong-protocol` / `float-amount` /
`zero-amount` / `unsafe-integer-amount` (`GENESIS`), `blocks-not-array`
(`BAD_ARRAY`), `empty-block-append` (`BLOCK`).

**Tests:** new `test/safety-max.test.mjs` E15–E23 (numeric edges, replay-path
smuggling, crafted blocks, genesis supply pin) — Node suite 22 → **31** tests;
attack table updated in `PAPER.md` §6.

**Docs:** `SAFETY_PROPERTIES.md` — local strictness dimensions + explicit
non-claims vs open-network money; library-systems language.

Python lockstep spot-checked directly: dual kernel rejects
`smuggled-genesis-field`, `empty-block-append`, `blocks-not-array`,
`wrong-protocol`, `zero-amount` with the same codes as Node.

---

## Verify (must stay green)

```bash
cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm run verify
# optional spot checks:
npm run inspect -- fixtures/chain-v0.json              # VALID
npm run inspect -- fixtures/drop-payload-rider.json    # VALID
npm run inspect -- fixtures/adversarial/bad-sig.json   # INVALID BAD_SIG
```

Cockpit (optional UI check):

```bash
# in Matrix Terminal chat: /oml
# or: /help  → should list /oml soft-link line
```

**Lab:** do not write under `~/Lab/` unless operator says `ASK LAB`.

---

## Tone law (carry forward)

Read `FABLE_DICTIONARY.md` first. Short form:

| Say | Don’t say |
|---|---|
| toy test net / append-only validated log | “our Bitcoin”, “mainnet”, “coin” |
| `OML_UNIT` = toy test counter | currency / investment |
| state root = dataset checksum | immutable global truth |
| seats propose; kernel decides | AI has settlement authority |

---

## Done vs next

### Done (Grok max + Fable slice)

- [x] Kernel + E01–E14 + max verify (4 gates)
- [x] Python dual + multi-process toynet + poison reject
- [x] PAPER §8b Monopoly punchline (scope-limited)
- [x] Drop payload rider + adversarial paste corpus + inspect test
- [x] Matrix Terminal `/oml` soft-link (UI help, not settlement)
- [x] Fable non-monetary dictionary + this handoff
- [x] Paste cards updated

### Sensible next slices (pick one)

1. **Public push** of Experimental-Sandbox branch `sandbox/experiment/one-machine-ledger` (operator GO only; never Lab).
2. **PR / index** entry on sandbox `main` so people can find the toy (still noncanonical).
3. Optional **Rust third implementation** agreeing on the same anchors.
4. Optional: more adversarial paste shapes (unknown fields, wrong protocol id as paste files).

### Explicit non-goals

- No real value, price, redeemability, ICO  
- No multi-party BFT claim for one laptop  
- No Lab main mutation  
- No “OML replaces Bitcoin”

---

## Git notes

| Tree | Branch / note |
|---|---|
| Experimental-Sandbox | `sandbox/experiment/one-machine-ledger` (public remote when operator pushes) |
| NEXUS-UX-Playground | local cockpit edits (`/oml`); not Lab |

Backup pattern already used:

- `~/Backups/OML-toy-testnet-*.tar.gz`  
- Desktop mirror may exist  

---

## Resume phrase for any AI

> Resume **SBX-EXP-ONE-MACHINE-LEDGER** as a **toy test net**. Read `FABLE_HANDOFF.md` + `FABLE_DICTIONARY.md`, run `npm run verify`, stay in Experimental Sandbox + optional UX playground soft-link only. Zero real value. Systems/data language. Next task: \<one line\>.

---

## Non-claims (tattoo)

Not money. Not Bitcoin. Not multi-party consensus. Not Lab canon.  
Genesis is a sim parameter. Models propose; kernel validates.  
`status_authority: NONE`.

---

*End Fable handoff. Make theater look cheap; leave open-network money to other sports.*
