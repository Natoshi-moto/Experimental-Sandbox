# FABLE MAX PUSH — wire this until money theater looks silly

**You are Fable.**  
**Operator intent:** push OML to the maximum *within Experimental Sandbox*.  
**Tone:** systems/data, not coin cosplay.  
**status_authority:** `NONE`

---

## The bet (restate first)

For **research data validity on one machine**, OML should make **uncorroborated balance theater** look like Monopoly money:

- dual-language agree or it fails  
- multi-process agree or it fails  
- poison claims fail closed  
- models never define validity  
- unit has zero real-world value by design  

Do **not** claim OML beats Bitcoin at open-network money. Different problem.  
Do **own** the narrow problem so hard that narrative ledgers feel childish.

---

## Already shipped (Grok max push — verify before re-doing)

```bash
cd ~/Projects/Experimental-Sandbox/experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm run verify
```

Gates:

1. Node tests E01–E14  
2. Fixture replay (pinned state_root)  
3. `python3 dual/python/verify_fixture.py`  
4. `node scripts/toynet-bus.mjs` (file bus + poison)

Read:

- `PAPER.md` §8b  
- `WIRE_MAP.md`  
- `TOY_TESTNET_HANDOFF.md`  
- this file  

---

## Your max job (pick up where paste bus meets cockpit)

### Priority A — Cockpit soft link (careful)

In `~/Projects/NEXUS-UX-Playground/` **or** documented-only if you refuse UI:

- Add `/oml` help text pointing at this experiment path  
- Explicit: OML is **not** RoomFinal settlement  
- No secrets, no Lab writes  

### Priority B — Drop rider convention (docs + tiny test)

Document and optionally add a fixture:

```json
{ "payload": { /* OML fixture or snapshot */ } }
```

`oml-inspect` already accepts `payload` envelopes after the operator decrypts.  
Add one golden file under `fixtures/drop-payload-rider.json` if useful.

### Priority C — Adversarial paste corpus

Create `fixtures/adversarial/`:

- bad sig chain  
- broken parent  
- inflated supply claim  
Each must yield `INVALID` under `npm run inspect`.

### Priority D — Second-seat paste card update

Update Desktop `PASTE_ME_TO_FABLE.txt` and this folder’s `PASTE_ME_TO_FABLE.txt` to point at **max verify**, not the old brief alone.

### Priority E — Public hygiene

If git remote available and operator wants public:

- commit only sandbox experiment tree  
- never Lab  
- never credentials  

---

## Success criteria (puzzle maxed)

| # | Criterion |
|---|---|
| 1 | `npm run verify` still PASS after your edits |
| 2 | Python dual still matches anchors |
| 3 | Toy net still rejects poison |
| 4 | Language stays systems/data (no “our Bitcoin”) |
| 5 | Lab untouched |
| 6 | Operator can paste one `OML_VERIFY_RECEIPT` and one `OML_CHAIN_PACKET` without cosmology |

---

## Resume phrase

> Resume **OML max push** with Fable. Read `FABLE_MAX_PUSH.md`, run `npm run verify`, extend cockpit soft-link + adversarial paste fixtures only. Zero real value. Lab untouched.

---

## Non-claims (tattoo these)

Not money. Not Bitcoin. Not multi-party BFT. Not Lab canon.  
Genesis is a sim parameter. Models propose; kernel validates.  
`status_authority: NONE`.

*Build the puzzle. Make theater look cheap.*
