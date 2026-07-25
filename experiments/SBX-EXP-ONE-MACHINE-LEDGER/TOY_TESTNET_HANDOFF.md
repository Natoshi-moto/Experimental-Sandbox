# Handoff — OML as a **toy test net**

**status_authority:** `NONE`  
**Experiment:** `SBX-EXP-ONE-MACHINE-LEDGER`  
**Frame:** local **toy test network** (data plumbing), not a currency, not mainnet, not Lab canon  
**Date of handoff:** 2026-07-25  
**Seat writing this:** Grok (operator session)

---

## One sentence

A dependency-free Node kernel on one machine that validates an append-only log of toy transfers (`OML_UNIT`), with hash-linked blocks, double-spend rejection, and a single-command replay check — intended as a **sandbox test net for research data flows**, not money.

---

## Tone law (do not drift)

| Say | Don’t say |
|-----|-----------|
| toy test net / local sim | “our Bitcoin”, “mainnet”, “coin” |
| append-only validated log | “the blockchain” (unless teaching analogy) |
| `OML_UNIT` = toy test counter | currency / sats / investment |
| state root = dataset checksum | immutable global truth |
| seats propose; kernel decides | AI has settlement authority |

If it would sound weird in a library systems meeting, rewrite it.

---

## What exists (verified this handoff)

| Item | Location |
|------|----------|
| Kernel | `src/canonical.mjs`, `src/crypto.mjs`, `src/ledger.mjs` |
| Tests | `test/ledger.test.mjs` — **12 pass** |
| Fixture chain | `fixtures/chain-v0.json` |
| Verify | `npm run verify` — **PASS** |
| Inspect (read-only) | `npm run inspect -- <file>` → `OML_VERIFY_RECEIPT` JSON |
| Paper | `PAPER.md` |
| Wire map (data puzzle) | `WIRE_MAP.md` |
| Fable brief | `FABLE_PASTE_WIREUP.md` |
| GO law (repo root) | `../../GO_PROTOCOL.md` |
| Public branch | `sandbox/experiment/one-machine-ledger` |
| Remote | `https://github.com/Natoshi-moto/Experimental-Sandbox` |

### Pinned fixture anchors

| Field | Value |
|-------|--------|
| genesis_hash | `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568` |
| tip_hash | `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df` |
| state_root | `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2` |
| height | `2` |
| supply | `250` `OML_UNIT` |

Deterministic fixture keys: `identityFromLabel('alice'|'bob'|'carol')` in `src/crypto.mjs`.

### One-machine proof

```bash
cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm test
npm run verify
npm run inspect -- fixtures/chain-v0.json
```

Requirements: Node ≥ 20, **no npm deps**, no network.

---

## Toy test net model (how to think about it)

```
  [seat A]  --paste packet-->  [operator]  --paste packet-->  [seat B]
                                  |
                                  v
                         oml-inspect / verify
                                  |
                                  v
                    VALID | INVALID  (this machine only)
```

- **Nodes** = any process or human seat that holds a JSON chain/packet  
- **Consensus** = *not claimed*; only **local replay** of the same bytes  
- **Genesis** = operator-declared sim parameters (like a private testnet genesis)  
- **Blocks** = ordered batches of authorized rows  
- **UTXO** = unspent rows in the toy counter table  
- **Paste bus** = deliberate air-gap (feature, not bug)

Related cockpit (optional, separate tree):

- Matrix Terminal / NEXUS UX: `~/Projects/NEXUS-UX-Playground/`  
- Room / Drop / LOOM = log + encrypted parcel tools (data), not settlement finality  
- Consensus Foundry: `~/consensus-foundry/` — pattern source only  

**Lab (`~/Lab/`) is read-only** unless operator says `ASK LAB`.

---

## Backup

Created at handoff time (see companion archive + checksum):

- Path pattern: `~/Backups/OML-toy-testnet-YYYYMMDD-HHMMSS.tar.gz`  
- Also mirrored under Experimental-Sandbox `reports/` if present  
- Contents: full `SBX-EXP-ONE-MACHINE-LEDGER/` tree + this handoff + GO_PROTOCOL snapshot  

Verify backup:

```bash
sha256sum ~/Backups/OML-toy-testnet-*.tar.gz
tar -tzf ~/Backups/OML-toy-testnet-*.tar.gz | head
```

Git is the primary public backup: branch `sandbox/experiment/one-machine-ledger` on GitHub.

---

## What’s done vs next (for the next seat)

### Done

- [x] Minimal UTXO log kernel + Ed25519 row authorization  
- [x] Adversarial tests (double-spend, conservation, not-owner, bad sig, chain break, …)  
- [x] Deterministic fixture + `verify`  
- [x] PAPER + WIRE_MAP + Fable paste brief  
- [x] `oml-inspect` → paste-ready `OML_VERIFY_RECEIPT`  
- [x] Standing `GO` protocol for public sandbox builds  

### Sensible next slices (pick one)

1. **Second implementation** (e.g. Python) must match the same `state_root` on the fixture — true dual-check.  
2. **Multi-process toy net**: two local processes exchanging chain packets via files (still one machine or LAN folder).  
3. **Matrix Terminal soft link**: `/oml` help points at this folder (no RoomFinal claims).  
4. **Drop payload convention**: document-only “OML JSON rides in Drop plaintext after open.”  
5. **PR** to Experimental-Sandbox `main` index (show people) — still noncanonical.

### Explicit non-goals

- No token, price, ICO, redeemability  
- No “decentralized” claim for one laptop  
- No Lab main mutation  
- No GSConnect/clipboard drama in-scope (operator OS issue)

---

## Clipboard note for operators (OS, not OML)

If paste is stale or `io.github.bugaevc.wl-clipboard` toasts spam:

- Disable GSConnect **Clipboard** share or the extension  
- Ptyxis paste = **Ctrl+Shift+V**  
- Prefer file open / GitHub URL over fighting Wayland clipboard  

---

## Paste packets (quick)

Envelope schema: `nexus.paste.oml/v0`  
Kinds: `OML_CHAIN_PACKET` | `OML_TX_PROPOSAL` | `OML_VERIFY_RECEIPT`  
Statuses: `CLAIMED` | `VALID` | `INVALID` | `SUSPENDED` — never auto-`FINAL`  
Details: `WIRE_MAP.md` §4  

---

## Resume phrase for any AI

> Resume **SBX-EXP-ONE-MACHINE-LEDGER** as a **toy test net**. Read `TOY_TESTNET_HANDOFF.md`, run `npm run verify`, stay in Experimental Sandbox, zero real value, systems/data language only. Next task: \<one line\>.

---

## Non-claims (repeat)

Not money. Not Bitcoin. Not Lab canon. Not multi-party consensus.  
Genesis is a sim parameter. Models propose; kernel validates.  
`status_authority: NONE`.

---

*End handoff. Backup + git push expected alongside this file.*
