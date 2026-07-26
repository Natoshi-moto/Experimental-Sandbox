# One account / one job / one transaction review v0.1

**status_authority:** `NONE`

## Verdict

The idea is load-bearing after one correction:

> One account = one Job Capsule = one ordered lifecycle = one atomic terminal
> settlement.

It must **not** mean:

> one SQL/database transaction or GitHub operation held open while agents work
> for minutes or hours.

The local paper closest to the idea is R016 Integrated Custody Gate. It
demonstrates that transfers, controller rotation, recovery, and revocation can
share one predecessor order so stale authority cannot race value changes. It
models those as separate durable events. It does not turn an account lifetime
into one monolithic transaction.

## Account hierarchy

```text
Human / project principal
  ├─ root authority and recovery policy
  ├─ available SIM_CREDIT
  ├─ project/maintainer declarations
  └─ creates one ephemeral Job Account
       ├─ one immutable accepted contract
       ├─ sponsor pledge/donation records
       ├─ bid records and locks
       ├─ one lead worker seat
       ├─ zero or more subordinate worker leases
       ├─ one ordered receipt chain
       ├─ deterministic evidence
       ├─ three model-review records
       ├─ one maintainer/human decision
       └─ one terminal settlement or abort
```

The Job Account is an isolation, accounting, provenance, and settlement
boundary. It is not an identity or independence proof.

## Lifecycle

```text
DRAFT
  │ OPEN_AND_LOCK pledges
  ▼
OPEN
  │ bid commits/reveals/revocations are child records
  │ SELECT_BID consumes current predecessor
  ▼
PENDING_ACCEPT
  ├─ requester CANCEL ──────────────────────► CANCELLED
  ├─ bidder REVOKE / requester UNSELECT ───► OPEN
  └─ worker ACCEPT freezes contract
  ▼
ACTIVE
  │ bounded lead/sub-worker attempts and receipts
  │ SUBMIT_FINAL binds one artifact root
  ▼
REVIEW
  ├─ deterministic red ─────────────────────► HOLD
  ├─ review mismatch/dissent/timeout ───────► HOLD
  ├─ valid review 1/2 ──────────────────────► REVIEW
  └─ valid review 3 + human acceptance
  ▼
SETTLED

HOLD
  ├─ authorized REWORK increments attempt ─► ACTIVE
  └─ RESOLVE_ABORT atomically closes funds ─► ABORTED
```

There is no durable `SETTLING` state. The finalizer either commits all terminal
effects or leaves the complete previous state.

## Bid lock semantics

### Before worker acceptance

- A requester reserves `SIM_CREDIT` when opening or selecting a bid.
- Reserved credit is unavailable to other jobs and agent allowances.
- A requester may cancel and unlock before the selected worker accepts.
- A bidder may revoke before acceptance.
- Selection, requester cancellation, and bidder revocation race on the same
  predecessor root. Exactly one transition can win.

### After worker acceptance

- The accepted contract hash freezes budget, scope, deadlines, data class,
  test policy, review policy, payout rule, and abort rule.
- The requester cannot unilaterally revoke merely because work is underway or
  an unfavorable result is expected.
- Funds leave the contract only through:
  - successful settlement;
  - predeclared timeout;
  - mutual cancellation;
  - mechanically proved breach;
  - human dispute/abort decision under the frozen policy.

This protects both sides: no free-work cancellation and no indefinite worker
hostage.

## Human and agent spending

The human remains root authority. An agent receives a bounded allowance:

```text
allowance_id
principal_account
agent_seat
job_id
purpose
amount_ceiling
recipient_class
not_before_tick
expiry_tick
nonce
policy_root
redelegation = false
```

An allowance reserves existing credit. It cannot:

- mint;
- exceed contract funds;
- select the same agent as worker and reviewer;
- change job scope;
- rotate/recover/revoke the human controller;
- modify maintainer authority;
- change licence or disclosure policy;
- release terminal settlement;
- re-delegate unless an explicit later experiment authorizes it.

High-cost and outward-facing actions remain human-approved in v0.

## Donation, pledge, sponsorship, and payment

These words require separate states.

| Instrument | Meaning in v0 | Revocation |
|---|---|---|
| `PLEDGE` | conditional reservation toward a named job/threshold | allowed before declared lock/acceptance |
| `DONATION` | explicit simulated-credit contribution to an accepted open-source milestone, with no ownership/governance/return | irrevocable after its declared acceptance point |
| `SPONSORSHIP` | funding plus separately declared public attribution | no influence on tests, review, or maintainer acceptance |
| `WORK_PAYMENT` | settlement for contract-compliant accepted work | only through terminal finalizer |
| `REVIEW_PAYMENT` | bounded compensation for a valid review packet | never conditional on approval/agreement |

A “donation” that is silently refundable is actually a pledge. A payment that
buys maintainer acceptance is not a donation. None of these instruments creates
real-world value in this experiment.

## Crowdsourced open-source coding flow

1. An opt-in maintainer or project authority pins:
   - repository and base commit;
   - task/specification;
   - accepted licences;
   - contribution and attribution terms;
   - privacy class;
   - tests and deterministic gates;
   - review and merge authority.
2. Sponsors pledge or donate `SIM_CREDIT` under explicit terms.
3. The broker publishes only public-safe job metadata.
4. Worker agents commit and reveal bounded bids.
5. A deterministic declared policy scores eligible bids; a human resolves any
   consequential ambiguity.
6. The selected worker accepts one immutable contract and may obtain bounded
   subordinate leases.
7. Workers produce a branch/artifact plus source, dependency, licence, NOTICE,
   upstream, test, and provenance manifests.
8. Deterministic checks run before model review.
9. Three blind model reviewers inspect the same exact artifact packet.
10. Any deterministic red, material dissent, rights uncertainty, or hash
    mismatch enters `HOLD`.
11. The maintainer decides whether the code is wanted and mergeable.
12. Nexus Sim atomically settles simulated credits and closes the Job Capsule.
13. A durable outbox publishes a sanitized GitHub capsule and retries without
    rolling back local settlement.

The maintainer retains the right to reject unwanted code even when tests and
models pass. Funding does not buy merge authority.

## Three-model clearance

The gate is:

```text
deterministic checks PASS
AND three distinct declared model IDs return valid packets
AND all three bind the exact same artifact/policy roots
AND no material dissent is unresolved
AND worker/reviewer seats do not overlap
AND diversity metadata is present
AND human/maintainer accepts
```

Diversity is a vector, not a count:

| Dimension | Example values |
|---|---|
| model ID/version | exact declared interface value |
| provider family | provider name or `UNKNOWN` |
| operator/principal | registered principal or `UNKNOWN` |
| prompt lineage | blind packet root |
| tool gateway | gateway/image digest |
| machine | local host/attestation declaration |
| verifier implementation | implementation/version hash |

Three distinct models in one provider/operator family are labelled
`CORRELATED_REVIEW`, not independent clearance. They may help the v0
experiment but cannot silently satisfy a future independent-party policy.

## GitHub mechanical record

### Branch/PR

The job branch contains:

```text
jobs/<job_id>/
  CONTRACT.json
  EVENTS.ndjson
  receipts/
  artifacts/MANIFEST.json
  reviews/
  FINAL.json
```

`FINAL.json` binds:

- job and contract roots;
- base commit and worker head;
- ordered child receipt hashes;
- final artifact and manifest roots;
- verifier source/version/root;
- deterministic test results;
- three review packet hashes and diversity labels;
- human/maintainer decision;
- Nexus Sim pre/post state roots;
- settlement receipt;
- disclosure manifest.

### Squash merge

Squash-only mainline is a good UX match for “one job, one clean record,” but
the capsule must preserve internal event ordering because the squash commit
does not preserve each child commit as mainline ancestry.

### Verifier trust gap

A pull request must not be allowed to replace the verifier that clears itself.
The required check should obtain verifier logic from:

- protected `main`;
- a protected control repository;
- a pinned release/container; or
- an independently controlled GitHub App/required workflow.

Changes to workflows, verifier code, action pins, policies, or expected fixtures
must trigger separate protected review. Untrusted PR code runs with read-only
credentials, no secrets, no deploy, and no OIDC.

### What GitHub verifies

GitHub can help show that particular bytes, commits, checks, and provenance
records existed and were processed under configured rules.

It cannot show that:

- a model reasoned honestly;
- reviewers were independent;
- remote data was deleted;
- proprietary data never leaked;
- a runner was uncompromised;
- a green verifier was semantically complete;
- a simulated settlement has global or financial finality.

GitHub is the witness. Nexus Sim is the local judge.

## Clean transaction capsule

The final logical transaction is:

```text
CLOSE_JOB(
  expected_predecessor_root,
  immutable_contract_root,
  final_artifact_root,
  deterministic_evidence_root,
  model_clearance_root,
  human_acceptance_root,
  ordered_child_receipt_root,
  payout_vector,
  refund_vector,
  allowance_closure_vector,
  disclosure_manifest_root
)
```

It either:

- pays each declared accepted worker/reviewer once;
- refunds residual locked credit according to contract;
- closes every allowance and reservation;
- marks one terminal state;
- appends one terminal receipt;
- produces one next state root;

or it performs no mutation and returns a stable rejection.

That is the defensible implementation of the operator's flow-state idea.
