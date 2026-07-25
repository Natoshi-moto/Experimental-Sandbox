# VERIFY — One-Machine Ledger

## Requirements

- Node.js ≥ 20  
- No network  
- No npm dependencies (stdlib only)

## Commands

```bash
cd experiments/SBX-EXP-ONE-MACHINE-LEDGER
node --test test/ledger.test.mjs
node scripts/verify.mjs
# optional:
node scripts/build-fixture.mjs   # regenerates fixtures/chain-v0.json (should be byte-stable)
node scripts/run-demo.mjs        # random-key demo report under reports/
```

Or:

```bash
npm test
npm run verify
```

## Expected

- **12** unit tests pass (0 fail).
- Fixture replay prints `=== OML verify: PASS ===`.
- Fixture pins (deterministic seeds `alice`/`bob`/`carol` via `identityFromLabel`):

| Field | Value |
|---|---|
| `genesis_hash` | `sha256:5fcc89b0a1608a1b6b505b5a6061794899c4c6db80c9f9be31f2c71cf75f8568` |
| `tip_hash` | `sha256:1f940c5533579f5de292357d6521635a09e9017ca01fac716ef45138f2acf1df` |
| `state_root` | `sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2` |
| height | `2` |
| supply | `250` `OML_UNIT` |

Regenerating with `node scripts/build-fixture.mjs` must not change these digests.

## Pass criteria

| Check | Meaning |
|---|---|
| Unit tests green | Rules hold under adversarial cases |
| Fixture root match | Same bytes → same state on this machine |
| No network | Proof is local |

## Non-pass (do not claim)

- Decentralization, multi-operator honesty, real-world value, Lab canon.

`status_authority: NONE`
