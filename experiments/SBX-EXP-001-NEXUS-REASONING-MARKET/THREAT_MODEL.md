# Threat model

**status_authority:** `NONE`
**Version:** `0.1-documentary`
**Scope:** local, closed-loop `SIM_CREDIT` prototype and sanitized GitHub witness

## 1. Protected assets

1. Proprietary source, prompts, test data, credentials, identities, and
   business context.
2. Exact `SIM_CREDIT` supply and ownership.
3. Bid locks, contract funds, agent allowances, payouts, and refunds.
4. Job contract, artifact, policy, verifier, and predecessor roots.
5. Human and maintainer authority.
6. Worker, reviewer, and signer capability boundaries.
7. Code provenance, licences, notices, and upstream attribution.
8. Receipt ordering, replayability, and terminal-state uniqueness.
9. Availability, bounded cost, and an operator's ability to halt.
10. Honest labels for evidence, model diversity, privacy, and economic status.

## 2. Adversaries and failure sources

- a malicious requester who seeks free work, post-acceptance cancellation, or
  reviewer manipulation;
- a malicious worker who submits stale, copied, poisoned, oversized, or
  exfiltrating artifacts;
- colluding bidders, sponsors, workers, reviewers, maintainers, or aliases;
- one principal controlling many agents, keys, accounts, or model seats;
- a compromised agent, model provider, tool gateway, browser extension,
  dependency, compiler, container image, runner, or update channel;
- prompt injection in source, issues, documentation, tests, tool output, or
  retrieved web content;
- a curious or coerced operator;
- a compromised browser, OS kernel, hypervisor, firmware, or hardware root;
- a GitHub administrator, workflow mutation, force-push, stale-base race, or
  repository outage;
- ordinary bugs: integer overflow, non-canonical serialization, race,
  incomplete crash recovery, retry duplication, clock skew, or ambiguous
  policy;
- economic pressure: Sybil farming, wash work, bribed reviews, cartel pricing,
  account sales, off-platform brokerage, or external price narratives.

Good intent is not a control. AI agreement is not an independence primitive.

## 3. Trust and authority boundaries

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Nexus Matrix — presentation, explanation, human approvals           │
│ Untrusted for settlement; may display proposals and signed receipts │
├──────────────────────────────────────────────────────────────────────┤
│ Embedded blocks — unique-origin, least-capability iframe surfaces   │
│ UI compartment only; never treated as a hostile-code VM             │
├──────────────────────────────────────────────────────────────────────┤
│ Router / broker / prober — typed messages and scheduling proposals  │
│ May route and reserve; cannot mint, settle, sign, or clear itself    │
├──────────────────────────────────────────────────────────────────────┤
│ Disposable worker cells — bounded lease, data class, budget, time   │
│ Produce candidate artifacts and receipts; no parent authority       │
├──────────────────────────────────────────────────────────────────────┤
│ Deterministic verifier lane — schemas, hashes, tests, invariants     │
│ Any deterministic failure vetoes model clearance                    │
├──────────────────────────────────────────────────────────────────────┤
│ Nexus Sim kernel — single local state-transition authority          │
│ Canonical bytes, predecessor root, append-only journal, replay       │
├──────────────────────────────────────────────────────────────────────┤
│ Signer / recovery lane — separate keys and explicit human policy    │
│ Never exposed to worker, iframe, model, or untrusted CI              │
├──────────────────────────────────────────────────────────────────────┤
│ Sanctuary / recovery bundle — offline, minimal, independently keyed │
│ Restore and inspect; no routine offensive or marketplace authority  │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
              GitHub sanitized witness capsule
       content history + checks + post-merge provenance only
```

This is a top-down restriction model. A child receives no capability its
parent does not possess, and each descent narrows scope, budget, data,
destination, duration, and mutation rights. It resembles Qubes
compartmentalization and Linux cgroup-v2 top-down constraints, but the browser
layer alone is not equivalent to either.

The tree-fungus analogy is limited but useful:

- compartment walls limit lateral spread;
- boundary reactions detect and seal injury;
- a damaged worker cell can be abandoned without granting it recovery keys;
- clean replacement grows from a known root;
- the outer bark/presentation layer may be damaged while the inner authority
  layer remains separate.

Biology is an architectural analogy, not evidence that the software is secure.

## 4. Data classes and routing

| Class | Remote bidding | Remote execution | Public capsule | Default |
|---|---:|---:|---:|---|
| `PUBLIC` | yes | yes, within capability | sanitized source/artifact allowed | route normally |
| `REDACTED` | metadata only | only redacted packet | commitments and safe metadata | inspect redaction |
| `PROPRIETARY` | capability metadata only | no in v0 | hashes and non-sensitive result metadata only | local/trusted cell |
| `SECRET` | no | no | no payload, prompt, key, or revealing hash oracle | reject remote route |
| `TEE_REQUIRED` | advertise as unsupported | no in v0 | no execution claim | `HOLD_UNSUPPORTED` |

A content hash can itself reveal membership in a small known set. Secret or
low-entropy data therefore must not be published merely because it is hashed.

## 5. Core invariants

### Ledger and settlement

1. Credits are safe non-negative integers. Floating point is forbidden.
2. Without an explicit allowed supply event:

   ```text
   available
   + bid_locks
   + pledge_locks
   + contract_funds
   + allowance_reserves
   + pending_payouts
   = constant_total_supply
   ```

3. An allowance reserves existing contract funds; it does not copy spending
   power.
4. Every accepted mutation consumes exactly one current predecessor root.
5. A rejected event changes no balance, state, receipt, nonce, or root.
6. Exact retries are idempotent; conflicting reuse of an ID or nonce rejects.
7. A job reaches exactly one terminal state.
8. Final settlement changes all balances, closes all allowances, marks the
   terminal state, and appends the terminal receipt in one short atomic commit.
9. Crash recovery exposes the complete old state or complete new state, never
   a hybrid.

### Contract and bid

10. A bid binds job, contract version, bidder seat, model/capability claim,
    price, deadline, nonce, policy root, and commitment salt.
11. Selection, bidder revocation, and requester cancellation consume the same
    current predecessor and are exercised in both arrival orders.
12. A requester may unilaterally cancel only before worker acceptance.
13. After acceptance, scope, budget, acceptance rule, privacy class, payout
    rule, review policy, and abort rule are immutable.
14. Post-acceptance exit requires a predeclared timeout, mutual cancellation,
    proved breach, or human dispute decision.
15. At most one bid is selected and accepted for a job version.

### Agent authority

16. Human root authority is never handed to an agent.
17. An agent allowance binds:
    `principal`, `agent`, `job_id`, `purpose`, `amount_ceiling`,
    `recipient_class`, `not_before`, `expiry`, `nonce`, and `policy_root`.
18. Re-delegation is denied by default.
19. Child workers cannot spend the job balance or choose reviewers.
20. Rotation, recovery, revocation, and economic events share one ordered
    predecessor root so stale authority cannot race settlement.

### Review

21. Worker self-review is forbidden.
22. Three clearances require three distinct declared model IDs and three
    distinct reviewer seats.
23. Provider family, operator, toolchain, prompt lineage, and machine diversity
    are recorded as separate declared dimensions; unknown remains `UNKNOWN`.
24. Every clearance binds the same job, contract, artifact, source, test,
    policy, and verifier roots.
25. Reviewers are paid for a valid bounded review, never for agreement.
26. Dissent is preserved. A material dissent, hash mismatch, timeout, missing
    disclosure, or policy failure enters `HOLD`.
27. Any rework changes the artifact root and invalidates every previous
    clearance.
28. A deterministic falsifier has veto authority over model agreement.
29. Maintainer/human acceptance remains separately required for an open-source
    merge and v0 settlement.

## 6. Threat/control matrix

| Threat | Failure | Required control | Required test |
|---|---|---|---|
| Double spend | two jobs reserve one balance | atomic reservation and conservation | concurrent lock orders |
| Accept/cancel race | refund and active contract coexist | shared predecessor linearization | both arrival orders |
| Select/revoke race | revoked bid becomes contract | bid state nonce and sibling conflict | both arrival orders |
| Allowance/revoke race | agent spends after revocation | ordered allowance epoch | both arrival orders |
| Stale return | old source or scope accepted | full task/source/attempt binding | mutate each bound field |
| Replay | duplicate receipt or payout | idempotency key and nonce registry | exact and conflicting replay |
| Settlement crash | paid/open hybrid | atomic finalizer and durable journal | fault at every write boundary |
| Fake quorum | one actor clears three times | seat/model uniqueness and disclosure | alias/provider collision vectors |
| Correlated quorum | common-mode defect appears independent | diversity vector and honest label | same-provider fixture |
| Artifact swap | reviews cover different bytes | one final artifact root | replace after each review |
| Reviewer bribery | agreement becomes paid outcome | pay valid review, preserve dissent | dissent still compensated |
| Prompt injection | source tells agent to escape policy | data/instruction separation and tool gate | hostile issue/source fixtures |
| Capability confused deputy | worker invokes parent power | typed, audience-bound capability | wrong actor/purpose/destination |
| Data exfiltration | proprietary prompt leaves trusted cell | data-class route gate and egress deny | remote proprietary route rejects |
| Hash oracle leak | public hash reveals secret candidate | no public low-entropy secret hashes | dictionary-membership fixture |
| Bid front-running | bidder copies visible offer | commit/reveal and fixed cutoff | late/reordered reveal vectors |
| Selective non-reveal | bidder manipulates final set | explicit expiry and non-reveal outcome | cutoff boundary vectors |
| Sybil bidding | one principal appears as a crowd | one-principal weighting in v0; no fairness claim | duplicate principal aliases |
| Wash work | requester/worker recycle credits or status | credits not reputation; graph receipts | circular-job fixture |
| Denial of service | unbounded bids/work/reviews | count, byte, time, attempt, and budget caps | every cap boundary |
| Malicious artifact | malware, secret, copied code | tests, secret scan, provenance and licence gate | known-bad fixtures |
| Maintainer capture | funder buys merge | separate maintainer authority | funded-but-rejected fixture |
| GitHub self-verification | PR weakens its own gate | protected verifier source and path policy | workflow/verifier mutation |
| Stale GitHub base | checked bytes differ at merge | strict checks or merge queue; bind SHAs | base changes after check |
| Runner compromise | logs or token leak | read-only token, no secrets, hosted disposable runner | permission/config check |
| GitHub outage | settled job cannot publish | durable idempotent outbox | fail/retry publication |
| Repository rewrite | witness history diverges | local receipt root and external mirrors | conflicting witness record |
| Host compromise | all userland claims can lie | explicit trust floor; separate VM/hardware where needed | non-claim, recovery drill |
| Off-platform market | simulated credit gains external price | no redemption/transfer; monitor and halt | prohibited-surface scanner |
| Labour extraction | “donated agents” replace fair consent/pay | explicit contract, budget, attribution, opt-out | harm review and appeal |

## 7. Browser, process, VM, and hardware boundaries

### Embedded iframe

An iframe is appropriate for a presentation block only when:

- it has a distinct origin;
- `allow-scripts` and `allow-same-origin` are not combined for same-origin
  content;
- sandbox tokens are minimal and declared;
- `postMessage` uses an exact target origin;
- ingress validates origin, source window, schema, version, size, nonce, and
  replay;
- no provider key, wallet key, private note, ambient storage, or parent DOM
  authority is reachable;
- navigation, popups, downloads, forms, pointer lock, and device APIs are
  denied unless the block contract requires them.

This contains ordinary block mistakes. It does not safely execute arbitrary
hostile code.

### Local worker

A stronger worker boundary should combine, as available:

- separate Unix user and process;
- mount, PID, user, IPC, and network namespaces;
- read-only root plus explicit scratch/output mounts;
- cgroup CPU, memory, process, and I/O limits;
- seccomp syscall allowlist;
- Landlock, AppArmor, or SELinux policy;
- nftables/egress allowlist;
- no inherited environment secrets;
- disposable lifecycle and independently hashed image.

Containers share a host kernel. Qubes-style VM separation is stronger for
mutually hostile workloads, but still bottoms out in hypervisor, firmware,
hardware, and update trust.

### Hardware and remote work

Hardware attestation can bind a measurement to a vendor-backed key under a
verification policy. It does not prove:

- the measured software has no vulnerability;
- the model reasoned honestly;
- the surrounding supply chain is clean;
- data was deleted;
- the operator did not observe input or output;
- the attestation vendor is independent or available.

`TEE_REQUIRED` remains unsupported in v0 rather than being simulated by a
label.

## 8. “Offense as the best defense”

Only authorized, non-retaliatory adversarial activity is in scope:

- fixture mutation;
- fault injection;
- race scheduling;
- fuzzing and differential replay;
- canary documents;
- honeypot worker cells with no real secrets;
- malicious bid, receipt, artifact, iframe, and workflow samples;
- breaker agents that can propose attacks but cannot settle, sign, publish
  secrets, or target third parties.

No counter-hacking, persistence on external systems, destructive retaliation,
credential theft, uncontrolled scanning, or harm to people is authorized.
The dual kernel helps because an imaginative breaker can attack candidates
while a deterministic kernel alone controls durable state.

## 9. Halt conditions

Any one condition enters `HOLD` or stops the economy surface:

1. a supply or settlement invariant fails;
2. a secret or proprietary payload crosses an unauthorized boundary;
3. a real-value, redemption, external-service, bridge, bearer, or conversion
   path appears;
4. an agent receives root wallet, signer, recovery, merge, or policy authority;
5. model agreement clears a deterministic red;
6. review diversity is misrepresented;
7. rights, licence, upstream, or maintainer authority is unresolved;
8. a workflow evaluates untrusted code with secrets or write credentials;
9. controls exist only as prose while UI/API exposes a forbidden surface;
10. substantial labour, coercion, discrimination, minors, gambling-like,
    account-theft, or inaccessible-appeal harm appears;
11. operator benefit depends on unofficial trade or review agreement;
12. monitoring or reproducible verification becomes unavailable.

Halt is not automatic confiscation. Any user-specific freeze requires a stated
reason, notice where safe, review date, appeal path, and restitution path for
error.

## 10. Residual risk

The prototype cannot create independent institutions, secure a compromised
host, prevent all external markets, prove remote execution, make proprietary
crowdsourcing safe, or settle legal classification. Its useful target is
narrower: make unsafe transitions mechanically reject, preserve evidence, keep
authority human and deterministic, and make every remaining trust assumption
visible.
