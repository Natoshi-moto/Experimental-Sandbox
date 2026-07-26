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

## Lesson

One account can be a useful isolation and settlement boundary; it is never, by
itself, an independence boundary.
