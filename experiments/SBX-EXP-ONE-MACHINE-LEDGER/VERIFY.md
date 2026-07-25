# Verify OML (max)

```bash
cd experiments/SBX-EXP-ONE-MACHINE-LEDGER
npm run verify
```

Gates:

1. Node tests (`test/ledger.test.mjs` + `test/adversarial-max.test.mjs`)
2. Node fixture replay → pinned anchors
3. Python dual (`dual/python/verify_fixture.py`)
4. Multi-process toy net (`scripts/toynet-bus.mjs`)

Helpers:

```bash
npm test
npm run dual
npm run toynet
npm run inspect -- fixtures/chain-v0.json
npm run inspect -- fixtures/drop-payload-rider.json
npm run inspect -- fixtures/adversarial/poison-state-root.json   # expect INVALID
npm run packet -- chain fixtures/chain-v0.json
```

Requirements: Node ≥ 20, Python 3 + `cryptography`, no npm deps, no network for verify.

`status_authority: NONE`
