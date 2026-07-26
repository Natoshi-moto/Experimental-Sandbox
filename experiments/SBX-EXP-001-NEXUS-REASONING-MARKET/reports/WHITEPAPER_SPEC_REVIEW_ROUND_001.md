# Whitepaper and technical-spec review round 001

**status_authority:** `NONE`
**Review class:** `CORRELATED_DOCUMENT_AUDIT`
**Result:** `NO_UNRESOLVED_CRITICAL_OR_HIGH_IN_FINAL_BOUNDED_RECHECK`

## Boundary and non-claim

Three declared model IDs performed read-only reviews of the whitepaper and
technical specification. They ran under one parent operator context and one
provider family. Their findings are useful correlated critique, not
independent corroboration and not the proposed three-party artifact clearance
gate.

The first-pass input was an uncommitted working draft and its exact pre-repair
bytes were not frozen before review. That is an audit limitation. Each
follow-up reviewer re-read the then-current files, and the final reviewed
document bytes are frozen below.

No reviewer edited the files. The parent agent made and verified every repair.

## Reviewers

| Declared model | Agent ID | Primary scope | Relationship |
|---|---|---|---|
| `gpt-5.6-sol` | `019f9c4f-a846-7792-ba53-714158f2702e` | state machine, economics, timing, crash/replay | shared provider/operator context |
| `gpt-5.5` | `019f9c4f-a86a-78d3-a06f-dfb4abd3bebb` | security, privacy, authority, iframe, GitHub | shared provider/operator context |
| `gpt-5.6-terra` | `019f9c4f-a8a2-7873-b212-5f710ec96758` | UX, harm, consent, disputes, open-source work | shared provider/operator context |

The Matrix must render this relationship as correlated. It must not display
`INDEPENDENT`.

## Final reviewed bytes

| Document | SHA-256 |
|---|---|
| `WHITEPAPER_v0.1.md` | `7298db8bb174a6d1bb1e3a5a74bc7d1108c1724fab0abf7f0dd2c4938e99bacc` |
| `TECHNICAL_SPEC_v0.1.md` | `72d3c53b57ebd27cb11387f4264fdd4265c0dbe498f9ad22f38f31176cb3edf9` |

## Critical findings

### Receipt/state/publication cycle

Initial problem:

- application state appeared able to contain receipt data while a receipt
  contained the resulting state root;
- settlement appeared able to create a publication intent that named the same
  not-yet-constructed settlement receipt.

Disposition: `RESOLVED`.

- the application-state projection excludes the receipt/WAL journal;
- the next state root is computed before the external receipt;
- terminal settlement creates no publication intent;
- a later idempotent event references the already committed terminal receipt.

### Cancellation without complete terminal settlement

Initial problem:

- `CANCEL_JOB` could reach a terminal state without the same complete
  economic/closure guarantees as settlement and abort.

Disposition: `RESOLVED`.

- cancellation is the third terminal-settlement event;
- it returns pre-acceptance lots, creates a zero-payout settlement record,
  invokes the common child-closure routine, writes the terminal index, and
  receives an external receipt.

## High findings and dispositions

| Area | Finding | Final disposition |
|---|---|---|
| conservation | overlapping scalar balances could double-count value | `RESOLVED`: one active source-tagged funding lot carries each reserved unit |
| funding source | contribution consumption and residue source were ambiguous | `RESOLVED`: exact funding, canonical lot order, pro-rata splitting, and source-based residue |
| timing | logical clock and bid-round windows were incomplete | `RESOLVED`: exact `ADVANCE_TICK`, half-open windows, canonical expiries |
| contract binding | selected bid was not bound to one frozen contract | `RESOLVED`: bid binds draft root; mechanical award materialization; worker signs exact candidate root |
| allowance | authorization, debit, and payout triggers overlapped | `RESOLVED`: authorization only reserves; accepted exact evidence atomically accrues payout |
| hold | dissent/failure had no complete rework/resume/abort path | `RESOLVED`: canonical hold root, state table, positive deadline, mandatory abort |
| authority ceiling | contract omitted context/model/tool/route/isolation ceilings | `RESOLVED`: immutable ceiling plus subset validation |
| crash safety | persistence did not prove old-or-new recovery | `RESOLVED`: checksummed PREPARE/COMMIT WAL and immutable snapshot generations |
| bid tie | whitepaper and specification used different final tie-breaks | `RESOLVED`: both use immutable worker-seat ID then reveal digest |
| mutable IDs | content-derived IDs conflicted with changing records | `RESOLVED`: stable creation IDs plus hash-linked record revisions |
| review entry | no normal `ACTIVE -> REVIEW` transition existed | `RESOLVED`: atomic `ENTER_REVIEW` closes work and freezes one packet |
| terminal children | rounds, leases, appeals, or payouts could remain live | `RESOLVED`: all terminal events invoke one complete closure routine |
| appeal clocks | filing/resolution deadlines lacked absolute state anchors | `RESOLVED`: decision/file ticks, absolute close ticks, half-open windows |
| zero appeal duration | an enabled zero-resolution window could strand a job | `RESOLVED`: zero filing disables appeals; enabled appeals require positive filing/resolution durations |
| replay/key rotation | current key status could reject an exact historical replay | `RESOLVED`: journal-proven exact replay precedes current authority checks |
| private hash oracle | public roots could commit to private low-entropy facts | `RESOLVED`: transitive disclosure compiler, omission/public-safe replacement/salted commitment |
| local trust | `local_trusted` was not an executable predicate | `RESOLVED`: exact route, approved roots, enforced controls, lease, and evidence |
| outbox authority | delivery status could mutate canonical/economic state | `RESOLVED`: immutable publication intent; operational delivery journal is outside state |
| GitHub verifier | check name alone did not bind trusted verifier bytes | `RESOLVED`: source repository/commit, workflow digest, app identity, runner, policy/verifier roots |
| remote route | router checked the wrong contract path | `RESOLVED`: exact `contract.privacy.remote_execution` check and ceiling consistency |
| decision quorum | declared multi-human count had no aggregation semantics | `RESOLVED`: v0 accepts exactly one settlement decision principal |
| maintainer claim | a self-registered principal could appear upstream-verified | `RESOLVED`: v0 is visibly fixture-simulated; unverified projects cannot open/fund/lease |
| appeal parties | role strings did not identify eligible/conflicted principals | `RESOLVED`: accepted award freezes role bindings, eligible IDs, and party IDs |
| reviewer incentive | valid dissent could be unpaid or indefinitely delayed | `RESOLVED`: valid review and pending payout commit atomically; logical HOLD deadline forces abort-and-pay |

## Important medium repairs

The review also caused these non-exhaustive repairs:

- RFC 8785 plus stricter safe-integer/NFC/Unicode canonicalization;
- complete stable-ID and immutable-ID preimage rules;
- deterministic scheduler tuple and immutable phase/priority data;
- exactly three funded review assignments with bounded replacement;
- explicit diversity dimensions without a composite independence claim;
- exact iframe sandbox, CSP, Permissions-Policy, origin, source-window, replay,
  and size requirements;
- capability-offer schema and a bounded donated-capacity mode;
- maintainer-exclusive merge authority;
- immutable contribution terms, attribution, disclosure acknowledgements, and
  disposition table;
- canonical appeal evidence and anti-retaliation rules;
- a mandatory job reserve protecting lead, review, and verification payouts;
- one job account per Job Capsule, closed at terminal settlement;
- publication roots that exclude private internal state and low-entropy hash
  oracles.

## Final bounded recheck

Each reviewer re-read the repaired area it owned:

- state/economics reviewer: no remaining `CRITICAL` or `HIGH`;
- security/privacy reviewer: no remaining `CRITICAL` or `HIGH`;
- UX/harm reviewer: no remaining `CRITICAL` or `HIGH`.

This means only that no such issue was found in these bounded correlated
passes. It does not prove absence of defects, implementation conformance,
economic safety, independent reasoning, privacy on a hostile host, or
production fitness.

## Verification

Final documentary checks at this iteration:

```text
router: PASS (10 loose-English cases, 5 bounded routes)
experiment-001-documentary: PASS
experimental-sandbox: PASS
git diff --check: clean
```

The executable prototype must now attempt to falsify the specification's 93
adversarial vectors. Documentary convergence is not executable clearance.
