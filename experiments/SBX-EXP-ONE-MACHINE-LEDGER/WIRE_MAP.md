# WIRE_MAP — how the OML data pieces connect

One machine. Append-only validated log + toy test counter (`OML_UNIT`) + checksummed
event/parcel tools, moved between seats by an operator-controlled copy/paste bus.
Nothing here is a currency, a network, or a settlement system.

`status_authority: NONE` — no label in this document or emitted by any tool here
grants finality. Only the human operator marks anything FINAL, outside these files.

---

## 1. The graph (actual paths)

```
 OPERATOR (human)
      │  copy/paste bus (deliberate air-gap; JSON packets, section 4)
      ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Matrix Terminal cockpit    ~/Projects/NEXUS-UX-Playground/   │
 │   matrix_terminal.py       UI + project context              │
 │   nexus_room.py            ordered event log with receipts   │
 │   nexus_drop.py            encrypted parcel + custody receipt│
 │   nexus_loom_store.py      local content store               │
 └──────────────┬───────────────────────────────────────────────┘
                │ decrypted Drop plaintext / pasted JSON
                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ OML kernel   ~/Projects/Experimental-Sandbox/                │
 │              experiments/SBX-EXP-ONE-MACHINE-LEDGER/         │
 │   src/ledger.mjs      UTXO table + hash-linked blocks        │
 │   src/canonical.mjs   canonical JSON (one byte-form per doc) │
 │   src/crypto.mjs      hashing + row-authorization signatures │
 │   scripts/verify.mjs      tests + fixture replay → PASS/FAIL │
 │   scripts/oml-inspect.mjs read-only: any OML JSON → receipt  │
 └──────────────┬───────────────────────────────────────────────┘
                │ snapshot / fixture / receipt JSON
                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Evidence folders (public sandbox only)                       │
 │   fixtures/chain-v0.json   pinned replayable dataset         │
 │   reports/                 receipts, checkpoint notes        │
 └──────────────────────────────────────────────────────────────┘

 Read-only pattern sources (no automatic merge):
   ~/consensus-foundry/   synthetic quorum sim; canonical-JSON habits
   ~/Lab/                 READ-ONLY from this work unless operator says ASK LAB
```

Git truth: branch `sandbox/experiment/one-machine-ledger` in
`~/Projects/Experimental-Sandbox` (public remote: github.com/Natoshi-moto/Experimental-Sandbox).
Matrix-Terminal assistant work lives on `sandbox/experiment/natoshi-assistant-matrix-terminal`.

Pinned anchors for `fixtures/chain-v0.json`:

| anchor | value |
|---|---|
| genesis | `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568` |
| tip | `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df` |
| state_root | `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2` |
| supply | 250 `OML_UNIT` (toy counter for tests) |

---

## 2. Event table (producer → consumer → check)

| Event | Producer | Consumer | Schema / shape | Verify command |
|---|---|---|---|---|
| Fixture dataset built | `scripts/build-fixture.mjs` | `fixtures/chain-v0.json` | fixture (`oml/v0` + `expected_*` fields) | `npm run verify` |
| Full check (tests + replay) | `scripts/verify.mjs` | operator, `reports/` | console PASS/FAIL + `fixture_summary_sha256` | `npm run verify` |
| Inspect any OML JSON | `scripts/oml-inspect.mjs` | any seat via paste bus | `OML_VERIFY_RECEIPT` (section 4.3) | `npm run inspect -- <file>` or stdin |
| Chain dataset moved between seats | any seat | operator → other seat | `OML_CHAIN_PACKET` (section 4.1) | `npm run inspect -- <pasted file>` |
| Transfer proposed | any seat | operator → kernel | `OML_TX_PROPOSAL` (section 4.2) | kernel only (`applyTx` via replay); a proposal is CLAIMED until the kernel accepts it into a block |
| Parcel sealed / custody moved | `nexus_drop.py` | operator | Drop manifest (AEAD blob + receipts) | `/drop` in Matrix Terminal |
| Work-log event appended | `nexus_room.py` | operator | hash-linked event + observer receipt | `/room probe` |
| OML data rides in a Drop | operator (seals decrypted-side JSON) | receiving seat | Drop `plaintext` **is** OML JSON; after opening: `{"payload": <oml json>}` | `npm run inspect -- <decrypted file>` |

Note on the last row: `oml-inspect` never decrypts. The operator opens the Drop with
the playground tools; the inspector only reads the already-decrypted JSON.

---

## 3. Status labels (data labels, not finality)

Used in packet headers and receipts. UI/data vocabulary only.

| Label | Means (here) | Who can emit |
|---|---|---|
| `CLAIMED` | someone asserts this dataset/proposal; not yet machine-checked | any seat |
| `VALID` | kernel replay reproduced the declared hashes on this machine | `verify.mjs` / `oml-inspect.mjs` |
| `INVALID` | replay failed: error code names the rule broken | `verify.mjs` / `oml-inspect.mjs` |
| `SUSPENDED` | operator paused this thread of data; don't build on it | operator |
| `FINAL` | **human-only**, outside these tools; no script emits it | operator |

`VALID` means "this file is internally consistent per the kernel's rules" — nothing more.
Model agreement is not validation; only replay is.

Kernel error codes (from `src/ledger.mjs` `LedgerError`): `BAD_HASH`, `BAD_ID`,
`BAD_OBJECT`, `BAD_FIELDS`, `BAD_ARRAY`, `BAD_SIG`, `GENESIS`, `TX`, `DUP_INPUT`,
`DUP_TX`, `MISSING_UTXO`, `NOT_OWNER`, `UTXO_COLLISION`, `CONSERVATION`, `BLOCK`,
`CHAIN`, `STATE`. Inspector adds: `BAD_JSON`, `UNRECOGNIZED_SHAPE`,
`STATE_ROOT_MISMATCH`, `TIP_MISMATCH`, `HEIGHT_MISMATCH`, `SUPPLY_MISMATCH`.

---

## 4. Paste packets (`schema: nexus.paste.oml/v0`)

Common envelope — every packet is one fenced JSON block:

```json
{
  "schema": "nexus.paste.oml/v0",
  "kind": "OML_CHAIN_PACKET | OML_TX_PROPOSAL | OML_VERIFY_RECEIPT",
  "status": "CLAIMED | VALID | INVALID | SUSPENDED",
  "status_authority": "NONE",
  "body": {}
}
```

### 4.1 `OML_CHAIN_PACKET` — move a ledger dataset

`body` is fixture-shaped (exactly what `fixtures/chain-v0.json` holds):

```json
{
  "schema": "nexus.paste.oml/v0",
  "kind": "OML_CHAIN_PACKET",
  "status": "CLAIMED",
  "status_authority": "NONE",
  "body": {
    "genesis": {},
    "genesis_hash": "sha256:…",
    "blocks": [],
    "expected_height": 2,
    "expected_tip_hash": "sha256:…",
    "expected_state_root": "sha256:…",
    "expected_supply": 250
  }
}
```

Receiver runs `npm run inspect -- <file>` (or pipes it in). Packet enters as
`CLAIMED`; only the local replay upgrades it to `VALID`.

### 4.2 `OML_TX_PROPOSAL` — propose a transfer (kernel decides)

`body` is a tx core (see `src/ledger.mjs` `txCore`) plus optional signature fields:

```json
{
  "schema": "nexus.paste.oml/v0",
  "kind": "OML_TX_PROPOSAL",
  "status": "CLAIMED",
  "status_authority": "NONE",
  "body": {
    "core": {
      "inputs": [{ "txid": "sha256:…", "index": 0 }],
      "outputs": [{ "amount": 100, "public_key_spki_b64": "…" }],
      "memo": "test transfer",
      "protocol": "oml/v0",
      "unit": "OML_UNIT"
    },
    "public_key_spki_b64": "… (present only if signed)",
    "signature_b64": "… (present only if signed)"
  }
}
```

A proposal is never applied by paste. It stays `CLAIMED` until the operator feeds it
through the kernel (`applyTx` inside a block build) and a replay confirms the result.

### 4.3 `OML_VERIFY_RECEIPT` — machine output of a check

Emitted verbatim by `scripts/oml-inspect.mjs` (its stdout is the packet):

```json
{
  "schema": "nexus.paste.oml/v0",
  "kind": "OML_VERIFY_RECEIPT",
  "status_authority": "NONE",
  "status": "VALID",
  "source": "fixtures/chain-v0.json",
  "shape": "fixture",
  "height": 2,
  "tip_hash": "sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df",
  "state_root": "sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2",
  "supply": 250,
  "unit": "OML_UNIT",
  "utxo_count": 4
}
```

On failure `status` is `INVALID` and `error_code` + `error` replace the summary fields.
A receipt describes one replay on one machine at one moment — it is evidence, not finality.

---

## 5. Operator paste card (second-seat how-to)

**Send OML data to Grok / Fable / any seat:**

1. `cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER`
2. `npm run inspect -- fixtures/chain-v0.json` → copy the receipt JSON
3. Paste receipt + (optionally) the whole `OML_CHAIN_PACKET` into the seat's chat
4. Say what you want done with it; the packet stays `CLAIMED` on their side

**Receive OML data from a seat:**

1. Save the pasted JSON to a file (anywhere; scratch is fine)
2. `npm run inspect -- <that file>` — envelope, fixture, and snapshot shapes all work
3. `VALID` → safe to file under `fixtures/` or `reports/` on the sandbox branch
4. `INVALID` → keep the receipt, tell the seat the `error_code`, don't build on it

**Ground rules:** paste is the only bus between seats (intentional air-gap for
authority). Nothing pasted is auto-promoted anywhere; `~/Lab/` is read-only from
this work unless the operator says ASK LAB. Matrix Terminal users: this experiment
lives at the path in section 1 — OML is *not* part of RoomFinal settlement.
