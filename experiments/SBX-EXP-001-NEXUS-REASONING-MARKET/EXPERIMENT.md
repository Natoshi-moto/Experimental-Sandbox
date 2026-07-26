# SBX-EXP-001 — experiment record

**status_authority:** `NONE`
**State:** `RUNNING`

## Raw origin

See [`RAW_ORIGIN.md`](RAW_ORIGIN.md). It preserves the operator's language
separately from the synthesis in this record.

## Claim

A deterministic local Nexus Sim can demonstrate a crowdsourced coding
workflow in which one hash-linked Job Capsule contains bounded sub-worker
receipts, bid-locked `SIM_CREDIT`, and three artifact-bound model reviews,
without granting agents ledger authority or publishing proprietary inputs.

## Falsifier

The claim is materially false if any executable vector can:

1. create, destroy, duplicate, or spend the same `SIM_CREDIT` twice without an
   explicit authorized supply event;
2. unlock requester funds after worker acceptance through a unilateral
   requester action;
3. settle or pay a job twice, including after crash/replay;
4. count a worker as its own reviewer, count the same model seat twice, or
   accept three reviews bound to different artifact hashes;
5. let model approval override a deterministic falsifier;
6. route a `PROPRIETARY` or `SECRET` payload to an untrusted remote worker;
7. let a delegated agent exceed amount, purpose, job, recipient class, expiry,
   nonce, or re-delegation limits;
8. accept a stale bid, result, review, contract version, or predecessor root;
9. present same-account or same-provider agreement as independent
   corroboration;
10. let a pull request silently replace the verifier that clears that same
    pull request;
11. publish private source, prompt, identity, key, or funding-graph material in
    the GitHub witness capsule; or
12. reach a terminal state with a hybrid of paid/unpaid, locked/unlocked, or
    open/closed balances.

## Smallest test

One deterministic fixture will run a complete public coding job:

1. two sponsors pledge simulated credits;
2. three worker aliases commit and reveal bids;
3. one bid is selected and accepted;
4. a lead worker receives bounded sub-worker leases;
5. a final artifact is submitted;
6. deterministic checks run;
7. three distinct declared model IDs review the same artifact hash;
8. a human-maintainer fixture accepts;
9. one atomic settlement closes allowances, pays valid work, refunds residue,
   and emits a terminal capsule;
10. a second run replays the capsule byte-for-byte and reaches the same root.

The fixture is paired with adversarial vectors for every falsifier above.

## Method and environment

- Repository: `Natoshi-moto/Experimental-Sandbox`
- Branch: `agent/p2p-reasoning-market`
- Initial base: `83822c4`
- Pre-build research window:
  `2026-07-26T02:46:50+01:00` to
  `2026-07-26T03:17:01+01:00`
- Runtime target: dependency-free Node.js plus browser-native HTML/CSS/JS.
- Authority target: one local deterministic writer with append-only receipts.
- Public boundary: sanitized metadata and content hashes only.

## Results

### Iteration 0.1 — safety and corpus freeze

Observation:

- the local corpus contains a large number of duplicate bundles, generated
  fixtures, and versioned copies; file count is not paper count;
- the strongest reusable mechanisms are deterministic replay, predecessor
  roots, conservation, narrow capabilities, expiring leases, fail-closed
  review, and authority separation;
- Sentinel is load-bearing for authority containment but cannot, from
  userland, prove a hostile host or remote worker behaved;
- the integrated custody model supports one combined ordered lifecycle but
  does not implement one monolithic lifetime transaction;
- GitHub is useful as an immutable-ish witness and required-check surface, but
  a pull request can otherwise mutate its own verifier;
- three distinct model IDs used during this review were all in one provider
  family and therefore supplied correlated critique, not independent
  clearance;
- a live transferable token or externally spendable credit conflicts with
  current closed-world Lab constraints and requires separate legal, economic,
  security, abuse, and human authorization.

Interpretation:

The safe v0 is a closed-loop `SIM_CREDIT` mechanism with explicit non-claims,
not a production P2P currency or anonymous compute exchange.

### Iteration 0.2 — whitepaper and technical contract

Observation:

- the full work-commons thesis is specified in
  [`WHITEPAPER_v0.1.md`](WHITEPAPER_v0.1.md);
- deterministic state, schemas, event transitions, contribution/bid locks,
  allowances, scheduler, three-review gate, terminal settlement, privacy
  router, GitHub witness, reason codes, and 93 adversarial vectors are specified
  in [`TECHNICAL_SPEC_v0.1.md`](TECHNICAL_SPEC_v0.1.md).

Interpretation:

The mechanism is concrete enough to implement and falsify. It remains
documentary until the next iteration executes the state machine and tests.

### Iteration 0.3 — executable state machine

Observation:

- the deterministic reducer, economy, work/review lifecycle, privacy router, and
  browser UI are implemented and pass four suites (~380 assertions):
  `core/economy` (131 assertions, 58 receipts, terminal `SETTLED`, supply
  conserved at 1100), `work-review` (69 tests), `privacy/github` (75
  assertions), and `ui-self-test` (107 assertions);
- `core/economy` and `privacy/github` independently reproduce application root
  `028832e28e705046fad13bcd10642122398161a7a2b775db6b5bb00e4bd19a03`, so the
  capsule replays byte-for-byte;
- the core contains no wall-clock or randomness; time is a logical tick and IDs
  are domain-separated SHA-256 over canonical bytes.

Interpretation:

The mechanism is no longer documentary. The smallest test in this record now
runs end to end.

### Iteration 0.4 — adversarial audit (`SBX-BREAK-001`)

Observation:

- `simSignature` contains no secret, so any holder of a read-only state snapshot
  can forge a valid event as any principal — confirmed by probe;
- the canonicaliser recurses without a depth limit and runs before the byte
  ceiling is checked, giving a pre-authentication stack exhaustion;
- idempotency keys occupy one global namespace, so any actor can permanently
  block another actor's chosen key;
- supply immutability, conservation, commit atomicity, replay integrity, strict
  JSON ingress, absence of runtime Sybil, UI escaping, and the
  deterministic-red-outranks-consensus rule all held under direct attack.

Interpretation:

The prototype is a correctness artifact, not yet an adversarial one: the test
harness and an attacker currently hold identical capabilities. Falsifier 2 lacks
a named test, and falsifiers 6, 10, 11, and 12 have never been attacked directly.
Real asymmetric signatures are the prerequisite for every other security claim.

## Limitations and non-claims

See [`NON_CLAIMS.md`](NON_CLAIMS.md). In particular, this experiment does not
claim anonymity, real value, remote deletion, independent model reasoning,
proof of model execution, production custody, fair pricing, Sybil resistance,
or Nexus Lab acceptance.

## Evidence

- Baseline command: `./scripts/verify.sh`
- Baseline result: `experimental-sandbox: PASS`
- Research timing and corpus counts:
  [`reports/RESEARCH_LEDGER_v0.1.md`](reports/RESEARCH_LEDGER_v0.1.md)
- Local design-family review:
  [`reports/CORPUS_REPORT_v0.1.md`](reports/CORPUS_REPORT_v0.1.md)
- Load-bearing source hashes:
  [`reports/CORE_SOURCE_REGISTER_v0.1.md`](reports/CORE_SOURCE_REGISTER_v0.1.md)
- Security architecture:
  [`reports/SECURITY_PRIMITIVES_v0.1.md`](reports/SECURITY_PRIMITIVES_v0.1.md)
- Noted attack mapping:
  [`reports/NOTED_ATTACK_CONTROL_MATRIX_v0.1.md`](reports/NOTED_ATTACK_CONTROL_MATRIX_v0.1.md)
- Sentinel and dual-kernel verdict:
  [`reports/SENTINEL_AND_DUAL_KERNEL_REVIEW_v0.1.md`](reports/SENTINEL_AND_DUAL_KERNEL_REVIEW_v0.1.md)
- Lifecycle transaction verdict:
  [`reports/LIFECYCLE_TRANSACTION_REVIEW_v0.1.md`](reports/LIFECYCLE_TRANSACTION_REVIEW_v0.1.md)
- Correlated three-model document audit and repair ledger:
  [`reports/WHITEPAPER_SPEC_REVIEW_ROUND_001.md`](reports/WHITEPAPER_SPEC_REVIEW_ROUND_001.md)
- Executable verification of the prototype:
  [`reports/REASONING_ECONOMY_ASSESSMENT_2026-07-26.md`](reports/REASONING_ECONOMY_ASSESSMENT_2026-07-26.md)
- Adversarial code audit and probe harness:
  [`reports/SECURITY_AUDIT_ROUND_001.md`](reports/SECURITY_AUDIT_ROUND_001.md),
  [`adversarial/`](adversarial/)
- Open invitation to attack this experiment:
  [`adversarial/README.md`](adversarial/README.md)

## Lesson

One account can be a useful isolation and settlement boundary; it is never, by
itself, an independence boundary.

A passing authority test proves nothing about authority while the test harness
and an attacker hold the same capabilities. Until identity costs something to
forge, "only X can do Y" is a statement about the reducer's internal consistency,
not about X.
