# Reasoning-economy assessment — 2026-07-26

**status_authority:** `NONE`
**Assessor:** Claude Fable 5 (operator-requested independent pass; same-account, so
this is *not* independent corroboration under `NON_CLAIMS.md`)
**Scope:** branch `agent/p2p-reasoning-market` at `4c86a4f`, worktree
`~/Projects/Experimental-Sandbox-p2p`

## Verdict

The reasoning-economy prototype is real, executable, and internally honest.
Every test suite passes, the state machine is fully deterministic, and the
economic boundary (`SIM_CREDIT`, closed-loop, no external value) is both
declared and mechanically enforced. The main defect is that the experiment
record has not caught up with the code: the branch now contains ~380 passing
assertions, but `README.md` and `EXPERIMENT.md` still say `DOCUMENTARY_ONLY`
and record no executable iteration. Secondary gaps are traceability (spec
vectors are not mechanically mapped to tests) and reviewability (one 70k-line
commit).

## What was verified

Commands run in this worktree on 2026-07-26:

- `./scripts/verify.sh` → `experimental-sandbox: PASS` (includes required-file
  checks, router test, documentary verifier, full prototype suite, and a
  secret-pattern scan).
- `prototype/tests/run-all.mjs` → four suites, all green:
  - `core/economy: PASS` — 131 assertions; 58 receipts; terminal `SETTLED`;
    supply conserved at 1100.
  - `work-review: PASS` — 69 deterministic tests.
  - `privacy/github: PASS` — 75 assertions.
  - `ui-self-test: PASS` — 107 assertions; 21 linked receipts; 3 exact
    reviews; 120/120 settlement units routed.
- Replay determinism: the core-economy suite and the privacy/github suite
  reproduce the **same** state root
  (`028832e28e705046fad13bcd10642122398161a7a2b775db6b5bb00e4bd19a03`),
  which is the strongest single piece of evidence that the capsule replays
  byte-for-byte.
- Nondeterminism scan: no `Date.now`, `new Date`, or `Math.random` anywhere in
  `core/`, `economy/`, `work/`, `review/`, `privacy/`, `github/`, or `ui/app.js`.
  Time is a logical `ADVANCE_TICK`; IDs are domain-separated SHA-256 over
  canonical bytes (`core/hash.mjs`, `core/canonical.mjs`).

## Falsifier coverage (spot-checked, not exhaustively traced)

Of the 12 falsifiers in `EXPERIMENT.md`, direct test evidence was found for:
supply conservation and duplicate-spend rejection (invariant `conservedSupply`
+ `ERR_SUPPLY` drift check), double-settlement/replay (exact + conflicting
replay), stale roots/bids/reviews (multiple "stale … rejected" cases),
reviewer-seat diversity and shared-dimension HOLD, deterministic-red
overriding model clears ("nonzero PASS evidence forces HOLD"), privacy
routing (`PROPRIETARY`/`SECRET` cases in core-economy), witness sanitization
(publication root distinct from state root), and terminal-state atomicity.
Appeal/dispute paths are unusually deep: payout freezing, appeal timeout →
forced ABORT, and stale-abort-during-appeal rejection with root unchanged.

Falsifier 2 (unilateral requester unlock after acceptance) is covered
indirectly through the accept-versus-cancel race requirement in spec §27 and
the abort-authorization tests, but I did not find a test named for it — worth
an explicit vector.

## Strengths

1. **Declared boundaries are enforced, not just written.** The non-claims doc
   is unusually disciplined, and the code backs the load-bearing ones: the
   runtime is frozen and propertyless, root APIs reject unknown extensions,
   resolver outputs are immutable canonical snapshots, and every legacy
   authority override tested is rejected.
2. **The economic core is conservative in the literal sense.** Integer-only
   amounts, per-bucket supply accounting, locks that reserve rather than mint,
   one atomic terminal settlement, and a conservation invariant checked
   against total supply.
3. **Honest provenance.** `RAW_ORIGIN.md` preserves the operator's verbatim
   ask separately from interpretation, and flags the ambiguous parts ("one
   big", "anonymous", "token") instead of silently repairing them.
4. **The review gate fails closed.** Three artifact-bound reviews, diversity
   dimensions, and the rule that no model vote can override a deterministic
   red are all exercised in tests, including arrival-order permutations.

## Findings

1. **Record lag (main finding).** `README.md` ("Current result:
   `DOCUMENTARY_ONLY`. No economic or privacy claim has yet passed an
   executable test.") and `EXPERIMENT.md` (last recorded iteration: 0.2,
   documentary) are now false in the safe direction: commit `4c86a4f`
   landed the prototype and ~380 passing assertions on
   2026-07-26 without an iteration 0.3 entry. This is the project's known
   declared-vs-enforced failure mode in reverse — enforcement outran the
   declaration. Fix: add an iteration 0.3 results entry with the suite
   outputs and the shared state root, and update the README status line.
2. **No mechanical spec→test traceability.** `TECHNICAL_SPEC_v0.1.md` §27
   enumerates 93 required adversarial vectors by prose number; tests do not
   cite vector IDs, so "all vectors implemented" cannot be checked by grep or
   script. A small conformance map (vector number → test name) would make the
   coverage claim falsifiable.
3. **Reviewability.** `4c86a4f` adds ~70k lines in one commit (including a
   29,769-line `corpus/RELATED_ARTIFACTS.json`). The suites mitigate this,
   but nobody can meaningfully diff-review that commit; future slices should
   land smaller.
4. **Correlated review remains open (already acknowledged).** The three-model
   document audit used models from one provider family, and this assessment
   is same-account. Both are recorded honestly in the docs; noting here that
   nothing in this pass discharges that limitation.
5. **Low suite observability (minor).** `core-economy.mjs` prints only a
   single summary line for 131 assertions; per-case `ok` lines (as in
   `work-review`) would make regressions easier to localize.

## Bottom line

Within its declared closed-world boundary, the reasoning economy does what it
claims: one job capsule, bid-locked simulated credit, bounded leases,
fail-closed three-review clearance, one atomic settlement, and byte-for-byte
replay to an identical root. The next unit of work is bookkeeping, not
mechanism: record iteration 0.3, map the 93 vectors to tests, and keep future
commits reviewable.
