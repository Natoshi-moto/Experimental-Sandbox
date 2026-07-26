# Security audit — round 001 (`SBX-BREAK-001`)

**status_authority:** `NONE`

Filed against [`templates/AI_REVIEW.md`](../../../templates/AI_REVIEW.md).

- **Role:** adversarial code audit of the executable prototype
- **Model/provider shown by interface:** Claude Fable 5 (Anthropic), via Claude Code
- **Identity attestation:** `SELF_REPORTED` — interface metadata, not verified identity
- **Repository/context scope:** `SBX-EXP-001-NEXUS-REASONING-MARKET`, branch
  `agent/p2p-reasoning-market`, commit `4c86a4f`
- **Prompt or task:** operator asked for a full code audit and a report written for
  other AI to expand on and probe deeper
- **Same-provider relationships:** the prior whitepaper/spec review round and the
  2026-07-26 assessment were also Anthropic models in this operator's account.
  Agreement between them is correlated critique, **not** corroboration.
- **Status authority:** `NONE`
- **Date:** 2026-07-26

**Independence:** NONE. Per [`NON_CLAIMS.md`](../NON_CLAIMS.md) this document is not
independent corroboration. Treat every verdict below as a lead to re-derive, not a
fact to inherit. If you are a different model reading this: **you are the control
group.** Disagreeing with me is the useful contribution, and section 3 is where I am
most likely to be wrong, because that is where I claim something is *fine*.

**Method:** line-level read of the auth/canonical/state/invariant layers, plus an
executable probe harness ([`../adversarial/PROBE_ROUND_001.mjs`](../adversarial/PROBE_ROUND_001.mjs)).
Findings marked CONFIRMED have a reproducible probe; findings marked REASONED do not
yet — those are the ones most worth attacking first.

**Want to extend this?** Read [`../adversarial/README.md`](../adversarial/README.md).
It is a standing open invitation with an unclaimed probe menu.

---

## 0. How to reproduce everything in this report

```bash
cd experiments/SBX-EXP-001-NEXUS-REASONING-MARKET
node prototype/tests/run-all.mjs              # baseline: all green
node adversarial/PROBE_ROUND_001.mjs          # audit probes
```

The probe harness is intentionally **not** wired into `scripts/verify.sh`. A probe
that flips to `EXPLOITABLE` should trigger investigation, not a red build. Keep it
that way, and append rounds as new files rather than editing this one.

---

## 1. The one thing to understand before reading the findings

**This system's entire security posture rests on a single assumption: the reducer
is the only writer, and nobody hostile can submit events.**

Everything else — conservation, hash-linked receipts, the three-review gate,
privacy routing — is correctly built *on top of* that assumption and largely holds.
But the assumption itself is not defended by the code, and it is not meant to be:
the signature scheme is literally named `SIM_AUTH_UNSAFE` and the reducer refuses
to accept any other scheme.

So the honest framing is not "this code has vulnerabilities." It is:

> The prototype is a **correctness** artifact that behaves as specified against a
> cooperative caller. It is **not yet** an adversarial artifact. Every authority
> test in the suite proves the reducer's rules are internally consistent; none of
> them prove those rules survive an attacker, because the test harness and the
> attacker have identical capabilities.

The next auditor's highest-value work is closing that gap, not finding more logic
bugs in the reducer. The reducer is in good shape. The trust boundary is the hole.

---

## 2. Findings

### F-01 — Authentication provides zero adversarial resistance (CRITICAL, by design, declared)

**Status:** CONFIRMED (probes P1, P1c)
**Location:** `prototype/core/auth.mjs:150-156`, verified at `:346-350`

`simSignature()` is a plain hash over two **public** values:

```js
function simSignature(keyId, signedPayloadRoot) {
  return hash("NEXUS_SIM_AUTH_UNSAFE_V1", {
    warning: "SIM_AUTH_UNSAFE",
    key_id: keyId,
    signed_payload_root: signedPayloadRoot,
  });
}
```

There is no secret. `key_id` is readable from `state.controllers`, and
`signed_payload_root` is derived deterministically from the event body. Any party
holding a read-only state snapshot can therefore mint a valid signature for **any
principal**, for **any event type in that principal's scopes**.

Probe P1 confirms `verifyNewEvent()` returns successfully for an event forged from
nothing but `snapshotRuntime()` output. Probe P1c confirms a forged `CONTRIBUTE`
authored as the victim clears authentication, controller binding, authority-root
binding, and scope check, and is stopped only later by an unrelated business rule
(`ERR_SCHEMA` on a nonexistent job).

**What this does and does not mean.** It does **not** mean the code is wrong — the
scheme is correctly labelled, the reducer refuses non-`SIM_AUTH_UNSAFE` schemes
(`auth.mjs:318-323`), and `NON_CLAIMS.md` already forbids claiming otherwise. What
it means is that **every authority-related test in the suite is currently vacuous
as a security claim.** "Only the requester can cancel" is verified against a caller
who chose to be honest about who they are.

**Fix direction.** Introduce a real asymmetric scheme (Ed25519 via `node:crypto` is
dependency-free) behind the existing `scheme` discriminator, keep `SIM_AUTH_UNSAFE`
for fixtures, and gate it so a runtime configured for `SIM_AUTH_UNSAFE` refuses to
emit a public witness capsule. The `auth.scheme` field already exists as the seam —
this is a contained change, not a rewrite.

---

### F-02 — The three-review independence gate is defeatable by one actor (HIGH)

**Status:** REASONED (structural; no probe yet — **this is the top priority for the next auditor**)
**Location:** `prototype/review/clearance.mjs:46-54`, cross-checked at `:878-879`, `:972-973`

The clearance gate checks seven diversity dimensions:

```
MODEL, PROVIDER, OPERATOR, PROMPT_LINEAGE, TOOLCHAIN, MACHINE, VERIFIER
```

Every one of these is a **self-declared string** supplied by the reviewer and bound
only to the reviewer's own registered capability offer. Nothing in the system
observes, attests, or independently corroborates any of them. `machine_declaration`
is, as the field name honestly admits, a declaration.

Chain this with F-01 and the gate collapses: an adversary forges reviews as three
distinct principals, declares three distinct provider families, and produces a
`CLEAR` clearance that the system records as independent corroboration.

Two mitigations already limit the blast radius, and both deserve credit:

- there is **no runtime principal-creation event** (`PAYLOAD_FIELDS` in
  `auth.mjs:13-77` has no `REGISTER_PRINCIPAL`), so the principal set is
  genesis-fixed — no runtime Sybil;
- the deterministic-red rule genuinely outranks model consensus
  (`ERR_DETERMINISTIC_RED` is first in `REASON_ORDER`, `clearance.mjs:59`), so a
  forged clearance still cannot override a failing check. **This is the single most
  important safety property in the codebase and it holds.**

So the realistic impact is: forged consensus can approve work that deterministic
checks do not catch — i.e. everything subjective (quality, licensing, intent).

**Fix direction.** Accept that independence cannot be proven in-band and stop
trying. Instead make the *declaration* accountable: bind each review to a distinct
controller key under F-01's real signature scheme, record the declared dimensions in
the public capsule verbatim so an outside observer can dispute them, and downgrade
the vocabulary from "independent" to "distinctly-attested." The existing
`composite_independence_label` is the right place to surface that honesty.

---

### F-03 — Pre-authentication recursion exhaustion (MEDIUM)

**Status:** CONFIRMED (probes P2, P2b, P6)
**Location:** `prototype/core/canonical.mjs:33-135` (`encode`), `:150-343` (`StrictParser`), reached from `schema.mjs:78-90`

`canonicalize()` recurses with no depth limit, and `assertBoundedCanonical()`
canonicalizes **before** it checks the byte ceiling:

```js
export function assertBoundedCanonical(value, label, maxBytes = MAX_EVENT_PAYLOAD_BYTES) {
  assertCanonicalValue(value);                       // ← recurses first
  invariant(canonicalBytes(value).length <= maxBytes, ...);   // ← ceiling checked second
}
```

The ceiling can therefore never fire in time. Probe P2b: 60 000 nested arrays
canonicalize to ~120 011 bytes, comfortably under the 262 144-byte limit, while
overflowing V8's stack. `applyEvent()` calls `assertEventIngress()` as its **first**
statement (`reducer.mjs:8698`), before any signature or authority check, so this is
reachable pre-auth by anyone who can hand the runtime an object. `StrictParser.value()`
is recursive too, so the JSON ingress path has the same shape.

Probe P6 confirms the failure is **fail-closed**: the mutation target is a
`structuredClone` candidate (`reducer.mjs:8743`) and the state root is unchanged
after the abort. The damage is availability plus taxonomy — a `RangeError` escapes
as a non-`ProtocolError`, so `reasonOf()` degrades it to `ERR_INTERNAL` and any
caller doing `catch (e) { if (e instanceof ProtocolError) ... }` will not handle it.

**Fix direction.** Add a depth counter to `encode()` and `StrictParser` (a
`MAX_CANONICAL_DEPTH` of 64 is generous for every schema in `PAYLOAD_FIELDS`), fail
with `ERR_SIZE_LIMIT`, and check the cheap byte ceiling before the expensive
canonical walk.

---

### F-04 — Global idempotency namespace enables cross-actor griefing (MEDIUM)

**Status:** CONFIRMED (probe P4)
**Location:** `prototype/core/reducer.mjs:8700-8717`, `:8800-8801`

`idempotencyIndex` is keyed on `event.idempotency_key` alone, with no actor
qualifier. The key is attacker-chosen and the namespace is shared by every
principal. Any actor who can land **one** successful event can therefore burn an
arbitrary key; a later, entirely unrelated actor submitting a legitimate event with
that key gets a permanent `ERR_IDEMPOTENCY_CONFLICT`.

Probe P4 demonstrates the `clock` principal burning `settle-job-1`, after which the
requester's genuine `CANCEL_JOB` under that key is permanently rejected. Impact
scales with key predictability, and the fixture keys in the test suite
(`"settle-job-1"`, `"abort-disputed-payout"`) are exactly the predictable shape an
attacker would target.

Note this is not a conservation or authority break — no value moves. It is a
liveness/griefing defect, and it is worth fixing precisely because the rest of the
ledger is so careful about exactly-once semantics.

**Fix direction.** Namespace the index by `(actor_id, idempotency_key)`. The
replay-detection semantics the tests rely on are unaffected, because a genuine
replay carries the same actor.

---

### F-05 — Canonicalization discipline break in the auth comparator (LOW)

**Status:** CONFIRMED (probe P3, fail-closed direction)
**Location:** `prototype/core/auth.mjs:230-232`

```js
function canonicalAuthentication(authentication) {
  return JSON.stringify(authentication);
}
```

In a codebase whose entire thesis is canonical bytes, this one comparator uses
`JSON.stringify`, which is key-insertion-order dependent. Probe P3 constructs an
authentication object that is **canonically identical** to the expected one
(`canonicalize(a) === canonicalize(b)`) but ordered differently, and
`verifyIndependentControllerAuthentication()` rejects it with `ERR_AUTHORITY`.

The direction is safe — it over-rejects rather than over-accepts, so there is no
forgery here. But it is a latent interop landmine the moment an authentication
object arrives from a wire format, a different serializer, or a re-keyed object,
and it is inconsistent with the discipline enforced everywhere else.

The same pattern appears at `reducer.mjs:8641-8642`, where `recoverRuntime` compares
sorted key arrays with `JSON.stringify` — benign for a sorted array of ASCII
strings, but the same smell.

**Fix direction.** Use `canonicalize()`. One-line change in both places.

---

## 3. What held up (do not re-tread this ground)

Negative results are the expensive part of an audit. These were probed or read
closely and found sound:

| Property | Evidence |
|---|---|
| Supply is immutable after genesis | `state.supply` is written only at `state.mjs:184`; no event path mutates it (probe P5) |
| Conservation is meaningful, not circular | `conservedSupply = accounts + active lots` compared against the frozen `supply` (`funding.mjs:58-60`, `invariants.mjs:1050`) |
| Arithmetic cannot overflow or go negative | every operation routes through `checkedAdd`/`checkedSubtract`/`checkedMultiply` (`funding.mjs:8-37`); `BigInt` used for the allocation ratio |
| Commit is atomic and fail-closed | all mutation targets a `structuredClone` candidate; `internals.state` is swapped only after `validateState` passes (`reducer.mjs:8743`, `:8774`, `:8797`) |
| Replay cannot be poisoned | idempotent replay requires both indices to agree on the full authenticated event root (`reducer.mjs:8702-8710`) |
| Determinism is real | no `Date.now`, `new Date`, or `Math.random` anywhere in `core/`, `economy/`, `work/`, `review/`, `privacy/`, `github/`, `ui/app.js`; two independent suites reproduce root `028832e2…` |
| Hashing is domain-separated | `hash()` prefixes a domain string with a `0x00` separator before canonical bytes (`hash.mjs:12-16`) |
| JSON ingress is genuinely strict | duplicate keys, BOM, leading zeros, floats, `-0`, lone surrogates, non-NFC, trailing suffix, array holes, getters, and non-plain prototypes all rejected (`canonical.mjs`) |
| No runtime Sybil | no principal-creation event exists in `PAYLOAD_FIELDS` |
| Deterministic red outranks model consensus | `ERR_DETERMINISTIC_RED` ranks first in `REASON_ORDER` (`clearance.mjs:59-60`) |
| UI is XSS-clean | every `innerHTML` interpolation routes through `safe()`/`chip()`/`declarationList()`, all of which escape; `textContent` used for the drawer title |
| UI ships a strict CSP | `default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` (`ui/index.html:7-9`) |

Two caveats on the last two rows: the UI escaping is **convention-enforced, not
lint-enforced**, and the app currently renders only a trusted local fixture. The
day it renders real state containing worker-supplied strings (job titles, aliases,
`model_id`, findings prose), a single missed `safe()` becomes stored XSS. A
tagged-template helper that escapes by default would make this structural.

---

## 4. The structural ceiling

Three limits are not bugs and cannot be fixed inside this prototype. State them,
do not try to engineer around them:

1. **Declared ≠ verified.** Provider family, operator, toolchain, and machine are
   all self-declarations. No in-band mechanism can upgrade them to facts.
2. **Userland cannot attest its host.** Already recorded in
   `SENTINEL_AND_DUAL_KERNEL_REVIEW_v0.1.md`; still true.
3. **Same-account agreement is not corroboration.** Including this document.

The project's existing `NON_CLAIMS.md` already says all three. The audit's
contribution is confirming the *code* does not quietly contradict them — it does
not.

---

## 5. Probe backlog for the next AI

Prioritized. Each entry names an entry point so you can start without re-deriving.

**Tier 1 — do these first**

1. **Build the F-02 composite exploit.** Forge three reviews from three genesis
   principals with distinct declared `provider_family` values and drive a job to
   `CLEAR`. Entry: `review/clearance.mjs`, fixture pattern in
   `tests/work-review.mjs`. Expected: succeeds. Proving it converts F-02 from
   REASONED to CONFIRMED and is the strongest argument for the F-01 fix.
2. **Implement Ed25519 behind the `auth.scheme` discriminator** and re-run the full
   suite. The interesting question is not whether it works — it is **how many
   existing tests still pass**, because every test that breaks was silently
   relying on forgeable identity. That count is the real measure of F-01's blast
   radius.
3. **Depth-limit `canonicalize` and `StrictParser`**, then extend P2 into a
   parameterized sweep (depth × breadth × payload shape) to find any other
   super-linear path in the ingress walk.

**Tier 2 — economic and lifecycle**

4. Race the appeal window against settlement: file an appeal on the exact tick the
   hold deadline expires, both orders. Entry: `FILE_APPEAL` / `ABORT_JOB` in
   `reducer.mjs`; existing coverage in `runDisputedPayoutAbortPath`.
5. Property-test conservation: random valid event sequences, assert
   `conservedSupply(state) === state.supply` after every step and that no terminal
   state has hybrid paid/unpaid balances. The suite tests scripted paths; this
   tests the space between them.
6. Attack `largestRemainderAllocation` (`funding.mjs:62-107`) with adversarial lot
   distributions — many tiny lots, one huge lot, exact ties — and check the
   remainder loop cannot over-assign. The `while (assigned < amount)` loop indexes
   `remainderOrder[index]` without a bounds guard; prove whether `index` can run
   past the array.
7. Probe `mandatoryJobReserve` (`funding.mjs:109-131`) for a state where outstanding
   obligations exceed locked funds.

**Tier 3 — boundary and publication**

8. Audit `core/public-export.mjs` and `privacy/disclosure.mjs` against falsifier 11
   (no private source, prompt, identity, key, or funding-graph material in the
   witness capsule). I read the routing shape but did **not** complete a field-by-field
   leak analysis of the published capsule. **This is the largest unaudited surface
   in the codebase** and deserves a dedicated round.
9. Verify falsifier 10 (a PR cannot silently replace the verifier that clears it)
   end-to-end in `github/verifier.mjs` — I found the `verifier_root` binding but did
   not trace the full replacement path.
10. Map spec §27's 93 required adversarial vectors to concrete tests and publish the
    gap list. Nobody can currently check the coverage claim by grep.

**Rules of engagement**

- Sandbox only. This is a public, non-canonical repo that feeds Lab solely by
  promotion; do not touch Lab's crypto chain or anchors.
- Add probe rounds as new files (`adversarial/PROBE_ROUND_00N.mjs`); do not edit
  earlier rounds — their recorded verdicts are the audit trail.
- Keep the probe harness out of `scripts/verify.sh`.
- If you flip a finding's status, say which probe did it and paste the output.
- Record what you looked at and found **clean**, not just what broke. Section 3
  exists so you don't repeat my work; extend it so the round after doesn't repeat
  yours.

---

## 6. Bottom line

The reducer is well built. Conservation, atomicity, determinism, strict
canonicalization, and the deterministic-red-outranks-consensus rule all hold up
under direct attack, and the negative results in section 3 were harder to establish
than the positive findings.

The gap is that the prototype has never faced an adversary who lies about identity,
because the signature scheme makes lying free. F-01 is declared and labelled, so
this is not a broken promise — but until it is closed, the suite's authority tests
should be read as consistency checks, not security properties, and no version of
this system should accept an event from a party the operator does not already
trust completely.

Fix F-01 first. Everything in Tier 1 flows from it.
