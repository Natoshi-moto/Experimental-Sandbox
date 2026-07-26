# Attacker's quickstart

**status_authority:** `NONE`

Goal: produce a minimal deterministic counterexample, not a prose-only concern.
Use public-safe fixture data and never submit secrets or private keys.

## Baseline

```bash
node prototype/tests/run-all.mjs
node tools/verify-exploit-artifact.mjs \
  adversarial/examples/valid-empty-journal.json
```

## Fixture builders

All builders below are exported by `prototype/tests/core-economy.mjs`.

| Starting point | State reached | Best attack targets |
|---|---|---|
| `createCoreEconomyFixture()` | zero-history authenticated genesis | malformed genesis, supply, controller, first-event authority |
| `prepareCommittedBid()` | accepted job, funding, round, committed bid | commitment, reveal, stale version, tick boundary |
| `continueToReviewOutcome(prepared, outcomes?)` | result, packet, assignments, reviews | packet binding, dissent, diversity, HOLD |
| `runCoreEconomyHappyPath()` | settled terminal job | double settle, replay, terminal-child closure |
| `runAcceptedCarrierPath(happy)` | accepted disclosure/publication chain | private transit, capsule, verifier, publication intent |
| `createPreAssignmentReviewFixture()` | packet before reviewer assignment | self-review, duplicate seats, conflicts |
| `createPostAssignmentReviewFixture()` | three accepted assignments | replacement, expiry, crossed references |
| `createPostReviewFixture()` | three accepted reviews | artifact mismatch, deterministic-red override |
| `createReplacementReviewFixture()` | expired seat plus replacement | complete history, duplicate replacement |
| `createDonatedCapacityFixture()` | accepted donated offer and consent | consent scope, nonzero bid, revocation |
| `createRevokedOfferFixture()` | revoked offer | stale capability use |
| `createRouteExecutionFixture()` | accepted Route V5 plan | bytes, funding, route, expiry, one-use |
| `createAuthenticatedCoreFixture()` | authenticated core context | hybrid signatures, replay, rotation |

Deterministic test-only hybrid key helpers are in
`prototype/tests/hybrid-identity-fixtures.mjs`. Never reuse them outside tests.

## Entry points by target

| Target | Entry point |
|---|---|
| event/replay/receipt | `applyEvent`, `recoverRuntime`, `snapshotRuntime` |
| accepted references | `createAcceptedRecordResolver`, `resolveAcceptedRecord` |
| donated work | `evaluateOfferEligibility` |
| scheduling | `evaluateTaskReadiness`, `scheduleReadyTasks` |
| reviewer selection | `evaluateReviewerEligibility`, `selectReviewAssignments`, `selectReviewReplacement` |
| clearance/HOLD | `computeThreeReviewOutcome` |
| Route V5 | `decideDataRoute`; consume via `CONSUME_ROUTE_EXECUTION_PLAN` |
| disclosure | `verifyDisclosurePreparation`, `verifyDisclosureCompilation` |
| publication | `verifyPublicationIntent`, `verifyPublicCapsule` |

## Minimal attack loop

1. Start from the latest fixture before the target transition.
2. Clone only the event or referenced record you intend to change.
3. Record the pre-attack application root.
4. Apply one mutation.
5. Record the exact accepted root/receipt or exact rejection code.
6. Replay from the original genesis, full events, and full receipts.
7. Encode the result as `nexus-exploit-artifact-v1`.
8. Verify the artifact with `tools/verify-exploit-artifact.mjs`.

Do not mutate runtime internals; the runtime is intentionally opaque. Do not
construct a duck-typed resolver. If an attack requires either, it has not
crossed the public trust boundary.

## What counts

A strong counterexample has a precise `F-01` through `F-12` or `V-001` through
`V-093` target, exact input bytes, a pinned implementation revision, complete
genesis/events/receipts, expected roots, and deterministic reproduction.

A thrown exception is not automatically a vulnerability. Show that the
observed outcome differs from the normative protocol expectation or that a
documented invariant is violated.

Submission format and privacy rules are in
[`adversarial/README.md`](adversarial/README.md).
