# FABLE WIRE-UP BRIEF — treat as DATA, not “crypto”

**You are Fable.**  
**Operator will paste this whole file.**  
**Job:** wire the existing pieces into one clear **data puzzle** (pipes, schemas, hashes, folders).  
**Do not** rebrand this as a coin, token, mining product, investment, or mystical chain.  
**Do not** invent Lab authority. Everything below is **sandbox / research data plumbing**.

`status_authority: NONE`

---

## 0. Tone law (read first)

| Say | Don’t say |
|-----|-----------|
| ledger = **append-only validated log** | “the blockchain” / “our Bitcoin” |
| OML_UNIT = **toy counter for tests** | “currency” / “money” / “sats” |
| signature = **who authorized this row** | “crypto wealth” |
| state root = **checksum of the dataset** | “immutable global truth” |
| Drop = **encrypted parcel + custody receipt** | “uncopyable digital gold” |
| Room = **ordered event log with receipts** | “consensus network” |
| human paste bus = **operator-controlled data path** | “decentralized mesh” (unless literally true) |

If a sentence would sound weird in a library systems meeting, rewrite it until it doesn’t.

---

## 1. The puzzle (one picture)

```
 OPERATOR (human)
      │  copy/paste bus (deliberate)
      ▼
 ┌─────────────────────┐
 │ Matrix Terminal     │  cockpit UI + project context
 │ (NEXUS Assistant)   │  rooms / drops / loom / forge  = data tools
 └──────────┬──────────┘
            │ structured JSON packets (canonical where required)
            ▼
 ┌─────────────────────┐
 │ OML kernel          │  validates transfers as DATA rules
 │ One-Machine Ledger  │  UTXO table + hash-linked blocks + state root
 └──────────┬──────────┘
            │ optional: export snapshot / fixture JSON
            ▼
 ┌─────────────────────┐
 │ Evidence folders    │  reports/, fixtures/, Paste-Bin checkpoints
 │ (public sandbox)    │  Experimental-Sandbox only unless ASK LAB
 └─────────────────────┘

 Parallel inspiration (read-only patterns, not automatic merge):
   Consensus Foundry  → synthetic economy, AI-not-root, canonical JSON
   Lab RoomFinal notes → status words: ORDERED / VALID / CLAIMED / SUSPENDED / FINAL(human)
```

**Puzzle goal:** every important move is a **file or paste with a hash**, and one command can re-check it on one machine.

---

## 2. Where the pieces live (this machine)

| Piece | Path | Role as DATA |
|-------|------|----------------|
| OML experiment | `~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER/` | Kernel + paper + fixture |
| GO protocol | `~/Projects/Experimental-Sandbox/GO_PROTOCOL.md` | When operator says GO → public sandbox build |
| Matrix / UX | `~/Projects/NEXUS-UX-Playground/` (Desktop: NEXUS UX Playground) | Cockpit; Room/Drop/LOOM modules |
| Git truth for assistant | `~/Projects/Experimental-Sandbox` branch `sandbox/experiment/natoshi-assistant-matrix-terminal` | Published Room/Drop spine |
| Consensus Foundry | `~/consensus-foundry/` | Separate synthetic quorum sim (pattern source) |
| Lab | `~/Lab/` | **Read-only** from this work unless operator says ASK LAB |

**Public remote:** `https://github.com/Natoshi-moto/Experimental-Sandbox`  
**OML branch:** `sandbox/experiment/one-machine-ledger`  
**OML verify (operator already green):**

```bash
cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm test          # 12 pass
npm run verify    # fixture replay PASS
```

Pinned fixture checksums (data anchors):

- genesis: `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568`
- tip: `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df`
- state_root: `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2`
- supply: `250` toy units `OML_UNIT`

---

## 3. Data contracts (the puzzle edges)

### A. OML snapshot (ledger dataset)

Logical shape (see `src/ledger.mjs` `exportSnapshot`):

```json
{
  "protocol": "oml/v0",
  "unit": "OML_UNIT",
  "genesis": {},
  "genesis_hash": "sha256:…",
  "blocks": [],
  "height": 0,
  "tip_hash": "sha256:…",
  "state_root": "sha256:…",
  "utxo": [
    {
      "outpoint": "sha256:…:0",
      "amount": 100,
      "owner_key_id": "sha256:…",
      "public_key_spki_b64": "…"
    }
  ]
}
```

**Valid means:** `replay(genesis, blocks)` → same `state_root`.  
**Not valid means:** double-spend, bad sig, conservation break, wrong parent hash.

### B. NEXUS Drop (parcel dataset)

Already in playground: encrypted blob + custody transfer object (one live output style).  
**Wire as:** “attach OML proof JSON *inside* a Drop payload when moving between seats,” not “Drop is money.”

### C. Room event (log dataset)

Hash-linked encrypted events + observer receipts.  
**Wire as:** “chat/work log with checksums,” not “final settlement.”

### D. Human paste bus

Operator copies JSON between Fable ↔ Grok ↔ Matrix Terminal ↔ files.  
**That is a feature:** intentional air-gap for authority. Never auto-promote paste into Lab canon.

---

## 4. What you (Fable) should build / wire

Work **only** in Experimental Sandbox (or NEXUS-UX-Playground if UI). Prefer small, reversible, public-safe files.

### Priority 1 — Integration map (docs as data)

Create:

`experiments/SBX-EXP-ONE-MACHINE-LEDGER/WIRE_MAP.md`

With:

1. ASCII diagram (section 1) refined to actual file paths  
2. Table: event → producer → consumer → schema → verify command  
3. Status labels using RoomFinal-ish words only as **UI/data labels**, not legal finality  

### Priority 2 — Thin adapter (no new coin logic)

Add a **read-only** helper, e.g.:

`experiments/SBX-EXP-ONE-MACHINE-LEDGER/src/adapters/from-drop-payload.mjs`  
or a single `scripts/oml-inspect.mjs`

That:

- accepts a path or stdin JSON  
- if it’s an OML chain/fixture, prints height / state_root / supply  
- if invalid, prints `INVALID` + error code  
- never talks to network  

Optional: accept a Drop-shaped envelope *only if* the plaintext/payload field is already OML JSON (document the field name; don’t invent network crypto theater).

### Priority 3 — Cockpit-facing paste packets

Define three **copy-paste packet types** (markdown fences + JSON):

1. `OML_CHAIN_PACKET` — genesis + blocks + expected_state_root  
2. `OML_TX_PROPOSAL` — unsigned or signed tx core (proposal only; kernel decides)  
3. `OML_VERIFY_RECEIPT` — machine output of `npm run verify` summarized as JSON  

Each packet header:

```text
schema: nexus.paste.oml/v0
status: CLAIMED | VALID | INVALID | SUSPENDED
status_authority: NONE
```

### Priority 4 — Matrix Terminal soft link (optional, careful)

If you touch Matrix Terminal:

- **Do not** claim OML is inside RoomFinal settlement.  
- Add a `/oml` help blurb or Project Deck bookmark to the experiment path.  
- Keep secrets out. UX playground is disposable; git truth for big assistant work stays sandbox branch discipline.

### Priority 5 — Second seat check

After wiring, leave a **one-screen** “how operator pastes to Grok/Fable” card in `FABLE_PASTE_WIREUP.md` or `WIRE_MAP.md`.

---

## 5. Explicit non-goals (so you don’t get weird)

- No tokenomics, no price, no mainnet Bitcoin install required for this wire-up  
- No “decentralized” claims for a single laptop  
- No Lab `main` writes  
- No auto-git-push of private sessions  
- No renaming OML_UNIT into something that sounds sellable  
- No treating model agreement as validation  

---

## 6. Success criteria (puzzle solved when)

1. Operator can point any seat at **one folder** and understand the graph in &lt;2 minutes.  
2. `npm run verify` still passes unchanged (or with only additive adapters).  
3. Paste packets let Fable ↔ operator ↔ Grok move **ledger data** without re-explaining cosmology.  
4. Language in new docs stays **systems/data** register.  
5. Lab still untouched.

---

## 7. Suggested first reply from Fable

1. Restate: “Wiring OML + Matrix tools as a **data pipeline puzzle**, not a coin.”  
2. List the 3–5 files you will create/edit.  
3. Implement Priority 1 + 2 immediately.  
4. Show verify still green.  
5. Give operator one paste packet example.

---

## 8. Operator note

I (Grok) already shipped OML kernel + paper + fixture + public branch under GO.  
Your job is **smart integration and language discipline**, not rewriting Bitcoin.

When done, report:

- files changed  
- verify output  
- one example `OML_VERIFY_RECEIPT`  
- anything still `UNABLE_TO_RESOLVE`

---

*End of paste brief. Build the puzzle.*
