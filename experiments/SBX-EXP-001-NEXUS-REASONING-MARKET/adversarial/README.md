# 🧨 BREAK IT — open adversarial review of the reasoning market

**status_authority:** `NONE` · **Record:** `SBX-BREAK-001` · **Target:** [`SBX-EXP-001`](../)

> This is a standing invitation. You do not need permission, an issue number, or an
> introduction. Pick something from the menu below, try to break it, and file what
> happened — including "I tried and it held."

The prototype is a deterministic simulated market for agent coding work: sponsors
fund a job, workers bid, one lead worker takes bounded sub-worker leases, three
model reviews are bound to one artifact hash, a human accepts, and one atomic
settlement closes the books. It is `SIM_CREDIT` only — closed-loop, non-redeemable,
worth nothing. Read [`../NON_CLAIMS.md`](../NON_CLAIMS.md) before you write the word
"money" anywhere.

Round 001 has been run. Its findings are in
[`../reports/SECURITY_AUDIT_ROUND_001.md`](../reports/SECURITY_AUDIT_ROUND_001.md).
**Read it after you form your own opinion, not before** — it will anchor you, and an
anchored second reviewer is worth very little.

---

## Run it in two commands

```bash
node prototype/tests/run-all.mjs                # baseline: everything green
node adversarial/PROBE_ROUND_001.mjs            # round 001 probes
```

Dependency-free Node.js. No install, no network, no credentials. The whole system is
plain `.mjs` files and a browser UI you can open from disk.

Each probe prints one of:

- `EXPLOITABLE` — the attack worked
- `blocked(ERR_CODE)` — the system stopped it, and named why
- `THREW(Type)` — it broke in a way outside the protocol's own error taxonomy

---

## Where round 001 landed

Confirmed with working probes: the signature scheme contains **no secret**, so anyone
with a read-only state snapshot can forge events as any principal; a deeply nested
payload exhausts the stack before any authentication runs; and idempotency keys live
in one global namespace any actor can squat.

Held up under direct attack: supply is immutable after genesis, conservation is
non-circular, commits are atomic against a clone, determinism is real, the JSON
parser is genuinely strict, and — the important one — a deterministic failing check
still outranks unanimous model approval.

The single most useful sentence in round 001: *the prototype is a correctness
artifact, not yet an adversarial one, because the test harness and an attacker
currently have identical capabilities.*

---

## The menu

Claim anything. Nothing here is reserved. Difficulty is a rough guide, not a filter.

### Tier 1 — the load-bearing questions

| # | Probe | Why it matters |
|---|---|---|
| 1 | Build the composite: forge three reviews with three declared provider families and drive a job to `CLEAR` | Would convert the highest-severity *reasoned* finding into a confirmed one |
| 2 | Implement real Ed25519 behind the existing `auth.scheme` seam, then count how many existing tests break | Every test that breaks was silently relying on forgeable identity. That count is the real blast radius |
| 3 | Depth-limit the canonicaliser, then sweep depth × breadth × shape for other super-linear ingress paths | Closes a pre-auth denial-of-service |

### Tier 2 — economy and lifecycle

| # | Probe | Why it matters |
|---|---|---|
| 4 | Property-test conservation over random valid event sequences | The suite tests scripted paths; nobody has tested the space *between* them |
| 5 | Attack `largestRemainderAllocation` with adversarial lot distributions — many tiny lots, one huge lot, exact ties | Prove whether the remainder loop's index can run past its array |
| 6 | Race the appeal window against settlement on the exact expiry tick, both orders | Ordering bugs hide in half-open windows |
| 7 | Find a state where obligations exceed locked funds in `mandatoryJobReserve` | Would break the promise that accepted work is always payable |
| 8 | Hunt for a terminal state with hybrid paid/unpaid or locked/unlocked balances | This is falsifier 12 and it has never been attacked directly |

### Tier 3 — the boundary nobody has audited

| # | Probe | Why it matters |
|---|---|---|
| 9 | **Field-by-field leak analysis of the published witness capsule** (`core/public-export.mjs`, `privacy/disclosure.mjs`) | **Largest unaudited surface in the codebase.** Round 001 read the routing shape and stopped. Falsifier 11 forbids publishing private source, prompts, identity, keys, or the funding graph |
| 10 | Verify a pull request cannot silently replace the verifier that clears it | Falsifier 10, traced only partially |
| 11 | Map the technical spec's 93 required adversarial vectors to concrete tests and publish the gap list | The coverage claim is currently uncheckable by grep |
| 12 | Attack the privacy router: get a `PROPRIETARY` or `SECRET` payload to an untrusted remote worker | Falsifier 6 |

### Tier 4 — angles round 001 did not take at all

These are wide open and deliberately less specified. Some may be dead ends. Saying
so is a result.

- **Timing and metadata.** The system claims no anonymity, but *how much* leaks?
  Reconstruct the funding graph, sponsor identities, or bid strategy from published
  capsule metadata and receipt ordering alone.
- **Economic game theory, not code.** Is the commit/reveal bid mechanism incentive
  compatible? Model collusion between a lead worker and a reviewer, selective
  non-reveal as a strategy, or a sponsor who is also a bidder. No exploit code
  required — a clear argument is a finding.
- **Griefing and liveness.** Round 001 found one denial-of-service by accident.
  Look for more: can a participant strand a job in a non-terminal state forever, or
  force an abort that pays nobody?
- **The UI as an attack surface.** Escaping is currently sound but enforced by
  convention, not tooling. Point the app at hostile state — job titles, aliases,
  model IDs, findings prose — and see what renders. Then check whether the strict CSP
  actually holds.
- **Replay and recovery.** `recoverRuntime` rebuilds from events plus receipts. Feed
  it a truncated, reordered, or subtly-forked history and see whether it notices.
- **Prompt injection into review.** Reviews carry free-text findings and claims. Can
  a worker write an artifact that manipulates a reviewing model's verdict? This is a
  live attack class the deterministic layer cannot see.
- **The spec versus the code.** Read `TECHNICAL_SPEC_v0.1.md` and find where the
  implementation quietly diverges. Divergence is not always a bug, but undocumented
  divergence is a finding.
- **The vocabulary itself.** Does any document imply a claim that `NON_CLAIMS.md`
  forbids? Language drift is how a simulation becomes a promise. This is a real
  probe and it needs no code at all.
- **Attack the audit.** Round 001's section 3 lists twelve things it claims are
  *fine*. Each one is an unfalsified assertion by a single correlated reviewer.
  Break one and you have found something more valuable than another bug.

---

## Filing what you find

Add a new round; never edit an earlier one. Their recorded verdicts are the audit
trail, including the wrong ones.

```
adversarial/PROBE_ROUND_00N.mjs          your probes, runnable standalone
reports/SECURITY_AUDIT_ROUND_00N.md      your findings, using templates/AI_REVIEW.md
```

Use the repository's [`AI_REVIEW`](../../../templates/AI_REVIEW.md) template. It asks
for your model and provider *as shown by your interface*, your same-provider
relationships, and a `SUPPORTED | REFUTED | CANNOT_DETERMINE` verdict per finding.
That last option is not a failure — "I could not determine this" is more useful than
a confident guess, and this project would rather have an honest gap than a clean
narrative.

No Git? Post through
[Discussions](https://github.com/Natoshi-moto/Experimental-Sandbox/discussions) or an
issue. A custodian will translate it into repository machinery. Your original words
stay visible beside any agent interpretation.

### House rules

1. Keep the probe harness out of `scripts/verify.sh`. A probe flipping to
   `EXPLOITABLE` should start an investigation, not break the build.
2. Record what you found **clean**, not only what broke. Round 001's section 3 exists
   so you don't repeat its work — extend it so round 003 doesn't repeat yours.
3. If you flip a finding's status, name the probe and paste the output.
4. Sandbox only. This repository is public and noncanonical; it reaches Nexus Lab
   solely through a separate promotion gate. Do not touch Lab anchors or chains.
5. Disclose your model and provider. Do not claim independence merely because
   several agent seats agree — [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) is
   explicit about this, and round 001 is itself a worked example of the failure.
6. Never publish secrets, keys, or personal data. Assume everything committed here
   is copied, indexed, and preserved.

---

## What would make this experiment wrong

The sandbox asks every contributor the same question, so here is the answer for this
one. The claim is that a deterministic local simulator can run a whole crowdsourced
coding job — funding, bidding, bounded sub-work, three-model review, human
acceptance, settlement — without granting agents ledger authority or publishing
private inputs. Twelve falsifiers are listed in [`../EXPERIMENT.md`](../EXPERIMENT.md).
Any one of them demonstrated with a reproducible probe materially falsifies the
claim.

Falsifiers 6, 10, 11, and 12 have never been attacked directly. That is where the
experiment is most likely to be wrong, and it is why they carry the most weight on
the menu above.
