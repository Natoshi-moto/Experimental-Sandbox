# FABLE DICTIONARY — non-monetary terms for the OML puzzle

**status_authority:** `NONE`  
**Seat:** Fable (and any later seat that must not drift into coin cosplay)

This file is the **translation layer**. Use it when writing docs, UI help, paste cards, or handoffs. The point of the toy is **not** “our Bitcoin.” The point is: **uncorroborated balance theater looks like Monopoly paper once local mechanical replay exists.**

---

## 1. Forbidden → preferred

| Forbidden (cosplay) | Preferred (systems / data) |
|---|---|
| coin, token, crypto, sats, wallet | row, record, key-held claim, identity label |
| money, currency, price, investment | toy counter (`OML_UNIT`), quantity field, zero real value |
| blockchain / the chain (as brand) | append-only validated log, hash-linked blocks |
| mining / miners | operator-declared genesis; no work race |
| mainnet / listing / ICO | sandbox experiment; fixture dataset |
| consensus (as network miracle) | local replay agreement; multi-process same-bytes check |
| final settlement | `VALID` via replay only; `FINAL` is human-only outside tools |
| our Bitcoin / beats Bitcoin | different problem; open-network money is out of scope |
| balances “are” X | UI may *display* a count; **state root** is the checksum |

If a sentence would sound weird in a library systems meeting, rewrite it until it doesn’t.

---

## 2. Bitcoin-shaped idea → Fable framing (non-monetary)

| Bitcoin-paper idea (culture) | OML fable (what we actually built) |
|---|---|
| Rules over reputation | seats propose; kernel decides |
| Complete enough to reimplement | Node + independent Python must match anchors |
| Adversarial negatives first-class | E01–E14 + paste corpus under `fixtures/adversarial/` |
| Double-spend is mechanical | second spend of same outpoint → `MISSING_UTXO` |
| Supply conservation | outputs ≠ inputs → `CONSERVATION` |
| Authorization | wrong key → `NOT_OWNER`; flipped sig → `BAD_SIG` |
| Linkage | wrong parent / height → `CHAIN` |
| Global money network | **not claimed** — one machine, paste bus, zero value |

**Punchline for Fable:** once validity is a one-command, dual-language, poison-rejecting replay, **screenshots of “balances” and narrative finality** look like board-game tokens. That is a critique of **theater**, not a claim that open-network money is trivial.

---

## 3. Monopoly table (keep this image)

| Monopoly / cosplay move | Mechanical answer |
|---|---|
| “Balances because the UI says so” | state root from sorted UTXO + tip |
| “Trust the model that last spoke” | models never define validity |
| “It’s final because we all agree” | only `VALID` via replay; no auto-`FINAL` |
| “Double-spend is a social fight” | `MISSING_UTXO` is mechanical |
| “One language / one process is truth” | Node + Python must match |
| “Paste it and it becomes real” | paste is `CLAIMED` until local replay |
| “Call it a coin so it feels important” | unit is explicitly zero-value `OML_UNIT` |

---

## 4. Object names (data, not finance)

| Object | Meaning here |
|---|---|
| `OML_UNIT` | integer toy counter inside the log only; non-redeemable |
| genesis | operator-declared sim parameters (like a private test dataset seed) |
| transaction / row | authorized transfer of toy counter between public keys |
| UTXO | unspent row still available to spend under rules |
| block | ordered batch of authorized rows, hash-linked |
| state root | checksum of protocol + unit + height + tip + sorted UTXO |
| paste bus | deliberate air-gap: human copies JSON between seats |
| receipt | `OML_VERIFY_RECEIPT` — one machine, one moment, evidence not finality |

---

## 5. Status labels (never inflate)

| Label | Means |
|---|---|
| `CLAIMED` | someone asserts; not machine-checked |
| `VALID` | this machine’s replay matched declared hashes/rules |
| `INVALID` | rule broken; `error_code` names it |
| `SUSPENDED` | operator paused the thread |
| `FINAL` | **human-only**, outside these tools |

`status_authority: NONE` on every packet and receipt.

---

## 6. One-sentence elevator (use this)

> OML is a dependency-free local referee for an append-only log of toy transfers: dual implementations and multi-process seats must agree on the state root, poison claims fail closed, and models never define validity — so uncorroborated balance theater looks like Monopoly paper. Not money. Not Bitcoin. Lab untouched.

---

*End dictionary. Pair with `PAPER.md` §8b, `WIRE_MAP.md`, `FABLE_MAX_PUSH.md`.*
