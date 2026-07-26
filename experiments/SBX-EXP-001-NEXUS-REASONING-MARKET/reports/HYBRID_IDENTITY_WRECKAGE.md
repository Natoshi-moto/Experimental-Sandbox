# Mandatory Hybrid Identity Wreckage Report

> **status_authority:** `NONE`

Date: 2026-07-26

Runtime: Node.js `v24.14.0`

Measurement boundary: production authentication had been changed to require `HYBRID_ED25519_ML_DSA_65_V1`, while every pre-existing test fixture was still unchanged and therefore carried no authoritative hybrid public-key pair or private signer.

## Aggregate result

Command:

```text
node experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/prototype/tests/run-all.mjs
```

Result: exit `1`.

The aggregate stopped in `core/economy` at `createCoreEconomyFixture()` during `runDonatedConsentVectors()`. The exact failure was `ERR_AUTHORITY: authoritative identity requires the mandatory hybrid scheme`. Later suites were not reached by the aggregate runner.

## Isolated accounting

| Suite | Before | Unmigrated result | Exact breakage |
|---|---:|---|---:|
| core/economy | 131 reported assertions | FAIL at first legacy genesis dependency | one suite entrypoint; internal counter unavailable because the runner aborted |
| work/review | 69 named tests | FAIL | 66 failed, 3 passed |
| privacy/GitHub | 75 reported assertions | FAIL while constructing its first core fixture | one suite entrypoint; 0 privacy assertions reached |
| UI | 107 baseline assertions | PASS; later isolated probe contained 137 assertions | no identity-fixture dependency |

The only surviving named work/review tests were:

- `scheduler readiness ignores insertion order`
- `scheduler blocks unsatisfied dependencies`
- `task ordering key is exact`

Every other named work/review test, `66/69`, silently depended on the forgeable genesis identity path. The complete ordered list is in [HYBRID_IDENTITY_WRECKAGE.json](./HYBRID_IDENTITY_WRECKAGE.json).

## Conclusion

The exact mechanically enumerable wreckage is:

- Three failing suite entrypoints: core/economy, work/review, and privacy/GitHub.
- Sixty-six failing named tests inside work/review.
- Two assertion-aggregating suites abort before returning per-assertion counts.
- Three pure scheduler tests and the UI-only suite remain independent of runtime identity.

No production invariant was weakened to preserve an old fixture. Fixture migration begins only after this report.
