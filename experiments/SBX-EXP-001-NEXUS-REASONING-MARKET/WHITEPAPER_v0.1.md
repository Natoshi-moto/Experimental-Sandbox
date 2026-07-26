# Nexus Flow State

## A safety-first work commons for crowdsourced human and agent reasoning

**status_authority:** `NONE`
**Version:** `0.1`
**Status:** `SANDBOX_PROPOSAL`
**Economic class:** `SIM_CREDIT_ONLY`

## Abstract

Nexus Flow State is a proposed work commons in which people and their agents
can fund, bid for, decompose, execute, review, and verify coding jobs without
making an AI model, marketplace operator, or Git host the authority over state.

The unit of work is one **Job Capsule**. A Job Capsule is an ephemeral job
account containing an immutable accepted contract, locked simulated credits,
one lead worker seat, bounded subordinate workers, an ordered chain of work
receipts, deterministic evidence, three artifact-bound model reviews, a human
or maintainer decision, and one atomic terminal settlement.

Nexus Sim is the deterministic authority for the capsule lifecycle. Nexus
Sentinel limits who may do what. The dual-kernel split lets imaginative agents
propose and attack candidates while a deliberately uncreative kernel alone
accepts state transitions. GitHub records a sanitized, replayable witness
capsule; it does not become the wallet, privacy boundary, or judge.

The first implementation is intentionally closed-loop. `SIM_CREDIT` is an
integer accounting object with no redemption, exchange, external purchasing
power, or future entitlement. Agents can spend it only through narrow,
human-issued allowances. A real-value system, if ever necessary, requires a
new genesis and separate legal, economic, rights, security, abuse, and human
authorization.

## 1. The problem

Agentic coding currently collapses too many roles:

- a model interprets the task;
- the same model chooses tools;
- the same context may hold credentials;
- a chat remembers what happened;
- a worker claims it ran tests;
- another model agrees;
- a repository stores the result;
- a green check is treated as proof.

That can feel fluid while hiding drift. The system cannot reliably distinguish:

1. what the person meant;
2. what an agent inferred;
3. what work was authorized;
4. what bytes a worker received;
5. what code actually ran;
6. what artifact was produced;
7. what tests observed;
8. what reviewers approved;
9. who had authority to accept;
10. what was finally settled.

Distributed agent work adds harder questions:

- How does a requester lock a budget without giving an agent the wallet?
- When may a bid be revoked?
- Can a sponsor cancel after work begins?
- How are hundreds of sub-workers prevented from becoming hundreds of votes?
- What makes three model approvals refer to the same artifact?
- How can proprietary source avoid a public or remote route?
- What does GitHub prove, and what does it merely record?
- How can open-source funding avoid buying maintainer control?
- How can useful “excess reasoning” be offered without sharing provider
  credentials or falsely claiming remote execution?

Flow State answers with explicit roles, immutable contracts, typed
capabilities, deterministic ordering, evidence-bound review, and honest
non-claims.

## 2. Thesis

The system becomes tractable when one logical unit binds the whole job:

```text
one Job Capsule
= one job account
= one accepted contract
= one ordered lifecycle
= many bounded sub-workers
= one evidence root
= one terminal settlement
```

This is not one long database transaction. Each event is a short atomic
transition that consumes the current predecessor root. The final event closes
all allowances, payouts, refunds, locks, and terminal state atomically.

The capsule is the object that can be replayed, reviewed, packaged, and
witnessed. Chat memory, dashboards, model prose, and GitHub summaries are views
over it.

## 3. Constitutional principles

### 3.1 Human semantic authority

People define goals, meaning, values, acceptable risk, project authority,
rights, and consequential ambiguity. Agents can translate, compare, propose,
code, test, criticize, and route. They cannot silently turn an unresolved
human judgment into policy.

### 3.2 Nexus Sim state authority

Only deterministic Nexus Sim transition logic can mutate the local ledger and
Job Capsule. The Matrix, router, broker, prober, model, worker, reviewer,
GitHub workflow, and signer can submit evidence or authorized requests; none
can directly edit accepted state.

### 3.3 AI attention, not authority

AI may:

- decompose work;
- estimate cost;
- propose routes and bids;
- generate artifacts;
- inspect source;
- run bounded tools;
- report defects;
- propose challenges;
- summarize evidence.

AI may not:

- mint, burn, debit, credit, or settle;
- sign with human root keys;
- alter recovery or controller policy;
- override deterministic failure;
- count popularity, payment, or confidence as truth;
- grant itself new capability;
- merge into an open-source project without maintainer authority.

### 3.4 Exact evidence outranks fluent narration

The evidence hierarchy is:

```text
canonical input bytes
  → accepted event receipt
  → deterministic command/result
  → artifact hash and manifest
  → model review bound to those bytes
  → human interpretation
  → summary/dashboard prose
```

Model reasoning may remain private or unavailable. A valid job does not require
publishing hidden reasoning. It requires enough bounded inputs, outputs,
commands, hashes, and decisions to reproduce the declared checks.

### 3.5 Credit is not truth

`SIM_CREDIT` meters internal work. It is not:

- reputation;
- authorship;
- quality;
- identity;
- governance;
- review weight;
- maintainer power;
- evidence;
- future money.

An agent with more credit gets no epistemic privilege.

### 3.6 Fail closed, recover explicitly

Missing evidence, mismatch, dissent, timeout, unsupported isolation, rights
uncertainty, or verifier mutation produces `HOLD`, `REJECTED`, or `ABORTED`.
Silence and retries do not become approval.

### 3.7 Independence is a vector

Three process IDs, aliases, or model names do not prove three independent
reviewers. The system records provider, operator, prompt lineage, toolchain,
machine, and verifier implementation separately. Unknown stays unknown.

### 3.8 Public evidence is privacy-reduced

The GitHub capsule contains only material authorized for publication. Secret,
proprietary, identity, key, prompt, funding-graph, and low-entropy hash-oracle
material stays outside it.

## 4. Participants

| Role | Purpose | May not |
|---|---|---|
| principal | human/project root authority and funding | delegate root wallet/recovery invisibly |
| maintainer | declares project scope and accepts/rejects code | sell acceptance through funding |
| sponsor | conditionally pledges `SIM_CREDIT` | gain review or merge authority |
| donor | contributes under explicit irrevocability terms | receive token, ownership, or governance entitlement |
| capacity donor | offers a revocable, bounded agent seat to public work | transfer provider credentials or silently donate human labour |
| broker | opens queues and applies deterministic eligibility | mutate ledger or hide selection policy |
| prober | tests declared worker capability with bounded challenges | claim hardware/model identity from self-report |
| bidder | commits/reveals a bounded offer | read proprietary source before authorized selection |
| lead worker | owns delivery coordination for one accepted contract | spend root balance or self-review |
| sub-worker | performs one leased task inside the capsule | inherit parent authority or vote weight |
| deterministic verifier | checks schemas, roots, tests, policies, and invariants | infer semantic correctness beyond specified checks |
| model reviewer | supplies blind semantic critique | settle, self-review, or override deterministic red |
| human reviewer | resolves consequential ambiguity and accepts/rejects | erase dissent or evidence |
| Sentinel | mediates typed capability use | become wallet, judge, or omniscient monitor |
| Nexus Sim kernel | orders and validates state transitions | call networks or models during consensus logic |
| GitHub witness | records bytes, checks, PR, merge, and provenance | claim private inference, anonymity, or global finality |

One person may occupy several declared roles in the Sandbox, but role
separation remains visible and does not become independence.

## 5. System planes

```text
┌──────────────────────────────────────────────────────────────┐
│ Presentation — Nexus Matrix                                  │
│ one clean job story, approvals, capability labels, receipts  │
├──────────────────────────────────────────────────────────────┤
│ Semantic — intent, task, licences, acceptance, ambiguity      │
├──────────────────────────────────────────────────────────────┤
│ Coordination — broker, prober, routing, staggered scheduler   │
├──────────────────────────────────────────────────────────────┤
│ Execution — disposable lead/sub-worker and review cells       │
├──────────────────────────────────────────────────────────────┤
│ Verification — schemas, tests, replay, three-review gate      │
├──────────────────────────────────────────────────────────────┤
│ Authority — Nexus Sim state kernel and signer/recovery lane   │
├──────────────────────────────────────────────────────────────┤
│ Evidence — journal, manifests, roots, capsule, GitHub outbox  │
└──────────────────────────────────────────────────────────────┘
```

The planes are responsibility boundaries. A prototype may implement several
in one process, but it must not confuse their authority.

## 6. Job Capsule

The capsule has five layers.

### 6.1 Immutable contract

The accepted contract binds:

- project and maintainer authority;
- repository and base commit;
- exact task and acceptance criteria;
- source and context roots;
- privacy class;
- allowed worker/model/tool classes;
- budget, deadline, and attempt ceilings;
- review and diversity policy;
- licence, NOTICE, upstream, and contribution terms;
- payout, refund, timeout, abort, and dispute rules;
- verifier and policy roots.

Once the worker accepts, these fields cannot change. Re-scoping creates a new
job version or a new Job Capsule.

Mutable records do not pretend their current contents are their permanent
identity. Each has a stable creation ID plus a hash-linked revision root;
balance, bucket, status, controller, and deadline changes advance the revision
without breaking every reference.

### 6.2 Funding and locks

Available credit becomes one of:

```text
available
bid lock
pledge lock
contract fund
allowance reserve
pending payout
settled available
```

No transition creates a second spendable copy. Before acceptance, requester
cancellation and bidder revocation can unlock under exact race rules. After
acceptance, unilateral requester cancellation ends; only the frozen abort
policy can release funds.

Selecting a bid atomically moves enough pledge and donation-intent
reservations into a requester-side **selected-bid lock**. Sponsors cannot
revoke a reservation while the selected bid holds it. Before worker
acceptance, the requester may unselect or cancel and the bidder may revoke;
those actions release the lock under one predecessor order. Worker acceptance
moves the same locked units into contract funds. V0 does not require a worker
stake or bond.

Before contribution, the Matrix shows the exact terminal destinations. A
pledge returns its unused residue to its source on settlement or abort. A
donation intent is revocable before acceptance; after acceptance it is a
donation, valid accrued work/review is paid, and unused residue moves to the
declared project pool. `HOLD`, rework, and appeal preserve the lock until the
contract deadline. GitHub publication failure never changes an economic
outcome.

### 6.3 Work graph

One lead worker can create bounded subordinate tasks:

```text
lead worker
  ├─ source analyst
  ├─ implementation worker
  ├─ test worker
  ├─ security breaker
  ├─ provenance/licence checker
  └─ packaging worker
```

Sub-workers are not separate claimants on the whole budget. Each receives one
lease, one context packet, one output schema, one cost ceiling, and one
deadline. The lead cannot create more reserved allowances than the contract
funds.

### 6.4 Verification graph

Verification alternates cheap deterministic work and bounded semantic work:

```text
schema → hash → replay → unit/invariant tests → security/licence gates
  → reviewer A
  → reviewer B
  → reviewer C
  → deterministic comparison
  → human/maintainer decision
```

Lower-cost models can inspect every packet for scope, citations, contradictions,
and drift. Frontier models receive bounded questions and budgets. Their output
is checked against the same roots. This is a cost/risk strategy, not a claim
that smaller models are safer or larger models are correct.

One atomic `ENTER_REVIEW` transition proves required work is closed, freezes
the final source/artifact/manifest/evidence roots, and creates the one packet
the assigned review triad receives. There is no partially finalized review
state.

### 6.5 Terminal capsule

One terminal settlement record, committed by one external receipt, binds:

- all ordered child receipt hashes;
- accepted contract;
- final artifact;
- deterministic evidence;
- review packets and diversity labels;
- human/maintainer decision;
- pre/post ledger roots;
- payout/refund/closure vector;
- public disclosure manifest.

Settlement, abort, and pre-acceptance cancellation share one terminal closure
routine. A terminal capsule has no live bid round, lease, task, allowance,
appeal, review assignment, payout, or funding lot, and later work events
reject.

## 7. Bidding and smart routing

## 7.1 Capability offers

Workers advertise a signed, expiring capability offer:

- declared model/provider class;
- paid or donated-capacity mode;
- owner-consented project/job allowlist;
- accepted job and data classes;
- supported tools/languages;
- maximum input/output and compute;
- price in `SIM_CREDIT`;
- availability window;
- objective probe suite and last result root;
- operator/provider/machine diversity declarations;
- public key or local seat ID.

The terms/body root signed before acceptance remains authentication-free under
its V1 domain so that the signature preimage is not circular. After
verification, the accepted offer stores an exact deterministic six-field
verified authentication reference. Its v1 carrier schema remains unchanged,
while its ID and root commit the reference under
`NEXUS_CAPABILITY_OFFER_ID_V2` and `NEXUS_CAPABILITY_OFFER_V2`. Accepted
donated-capacity consent follows the same rule under
`NEXUS_DONATED_CAPACITY_CONSENT_ID_V2` and
`NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2`, while its auth-free body root
remains V1.

Raw randomized signature bytes are excluded from carrier identities. Missing
or extra reference fields reject; changing a reference changes the
corresponding carrier ID/root. Independently randomized valid signatures
preserve semantic and carrier identity only when they derive the same exact
reference.

The core also derives
`offer_content_root = H("NEXUS_CAPABILITY_OFFER_CONTENT_V1", exact semantic offer body)`.
That body includes the offer `nonce` and excludes only its own ID, content root,
and authentication. Callers cannot supply the root. Accepted offers and their
V2 IDs/roots bind it, while the auth-free terms/probe roots remain V1.
Canonical state indexes each content root to one offer ID. A different envelope
or authentication reference for occupied content fails `ERR_ID_PREIMAGE`
before mutation; exact event replay remains idempotent. A changed offer nonce
is distinct content but requires independent authority. Invariants and
recovery recompute the index in both directions and reject tampering.

An offer does not prove the claimed model, machine, locality, privacy, or
deletion.

A donated-capacity offer delegates a bounded worker seat, never ownership of
an account, provider credential, API key, wallet, or human identity. Its owner
sets compute/task limits, data classes, tools, egress, availability, projects,
attribution, and revocation terms. Revocation stops future leases; an already
accepted lease follows its frozen timeout/abort contract. A zero-price bid
earns no implied future token, governance right, or reputation boost.

## 7.2 Prober

The prober issues safe, job-relevant challenge vectors before selection. It can
measure:

- protocol/schema conformance;
- deterministic tool output;
- supported language/runtime;
- maximum packet handling;
- expected response shape;
- declared latency in simulator ticks;
- consistency with a pinned worker image or verifier.

It cannot infer honest reasoning from timing or self-report. Probe evidence
expires when the worker image, model, provider, toolchain, or policy changes.

## 7.3 Commit/reveal bids

To reduce simple copying:

1. each bidder commits a domain-separated hash of its complete bid plus salt;
2. commitments close at a fixed logical tick;
3. reveals close at a later fixed tick;
4. unmatched, malformed, duplicate, stale, or late reveals reject;
5. a predeclared deterministic scorer selects eligible bids;
6. ties resolve by canonical bid digest, never arrival jitter.

Commit/reveal does not establish privacy, fair inclusion, or collusion
resistance. Selective non-reveal and censorship remain visible risks.

## 7.4 Deterministic eligibility and selection

Hard eligibility comes before scoring:

- exact job and contract version;
- data class allowed;
- capability/tool/runtime match;
- probe not expired;
- price and deadline within ceilings;
- no worker/reviewer conflict;
- valid commitment and reveal;
- allowed principal under v0 admission policy.

The v0 scorer is intentionally boring:

```text
lowest price
then lowest declared completion ticks
then immutable worker seat ID
then canonical reveal digest
```

No hidden AI ranking, stake, popularity, reputation, or donor weight selects a
winner. Display aliases never participate in canonical ordering.

## 8. Timing, staggering, and routing many agents

The scheduler uses logical ticks, not wall-clock time, for deterministic
simulation.

Each task declares:

- phase rank and priority;
- dependencies;
- earliest start tick;
- deadline tick;
- maximum attempts;
- compute and byte budget;
- required data class;
- required capability;
- concurrency group;
- conflict set;
- review requirement;
- terminal behavior.

The scheduler:

1. computes the ready set;
2. rejects expired or impossible tasks;
3. groups tasks by privacy and capability boundary;
4. prevents conflicting workers from sharing secrets or authority;
5. sorts by phase rank, priority, deadline, bounded compute, task ID, and
   attempt;
6. leases at most the declared concurrency;
7. staggers expensive frontier runs after cheap checks narrow the question;
8. records every lease, timeout, retry, and returned packet;
9. enters `HOLD` when attempts or budgets are exhausted.

Many sub-workers can accelerate execution. They never multiply one principal's
review weight or spending authority.

## 9. Three-model clearance

Three reviews are useful as a drift and defect filter. They are not truth by
majority.

Each reviewer is blind to other review text and, where practical, to bids and
payouts. The packet includes:

- task and accepted-contract root;
- final artifact and source roots;
- deterministic evidence root;
- exact review questions;
- policy and rubric root;
- response schema;
- budget and stopping condition.

A clearance is valid only if all reviews:

- use distinct declared model IDs and reviewer seats;
- are not the worker;
- bind the identical roots;
- pass packet/schema checks;
- include diversity declarations;
- arrive before expiry;
- preserve material dissent;
- do not conflict with deterministic evidence.

Any deterministic red, material dissent, unknown required disclosure, timeout,
or root mismatch enters `HOLD`. A human decides rework or abort. Reviewers are
compensated for valid review work, not agreement.

Payouts are accrued only from already funded contract units. Lead delivery,
accepted subordinate work, and each structurally valid review move a declared
amount from contract or allowance reserve into a recipient-bound pending
payout. A valid dissenting review remains eligible for its declared review
payment. A frozen logical HOLD deadline forces deterministic abort-and-pay
before the clock can advance further, so disagreement cannot delay an
undisputed review payout forever in simulator time. An operator can still halt
the simulator and wall-clock liveness is not claimed. Invalid, replayed, self,
stale, or mismatched reviews do not.

## 10. Privacy and proprietary work

V0 uses four executable data classes:

| Class | Route |
|---|---|
| `PUBLIC` | remote eligible; sanitized capsule may include source/artifact |
| `REDACTED` | remote receives only approved reduction |
| `PROPRIETARY` | local/trusted worker only; public capsule carries safe metadata |
| `SECRET` | remote prohibited; no revealing public hash oracle |

`TEE_REQUIRED` exists only as an unsupported hold reason. A label cannot
simulate hardware isolation.

The broker may advertise capability requirements for proprietary work but may
not broadcast source, prompts, filenames, identities, repository secrets, or
business context. Bidders should price against a public-safe work envelope;
material scope changes after trusted disclosure require a new contract.

Pseudonymous aliases reduce casual identity exposure. They do not hide GitHub,
network, timing, funding, or repeated-behavior graphs. The system makes no
anonymity claim.

“Local trusted” is not a checkbox. It requires a human-approved policy root,
an exact local route, enforced filesystem/network/resource/environment
isolation, an expiring lease, and the same isolation root in contract, offer,
lease, and receipt. Unknown or unenforced requirements produce `HOLD`.

## 11. Qubes, Unix, Linux, and the defensive tree

Qubes supplies the strongest relevant pattern: mutually suspicious work belongs
in separate compartments connected by narrow, explicit RPC. Disposable qubes
fit one-off workers and reviewers. A qrexec-like policy fits the Nexus router.

Unix and Linux supply progressively stronger local boundaries:

- users and processes;
- file descriptors and explicit IPC;
- namespaces;
- read-only mounts and scratch volumes;
- cgroup-v2 top-down resource ceilings;
- seccomp;
- Landlock/AppArmor/SELinux;
- network namespaces and egress policy;
- containers;
- separate VMs.

Nested iframes are the presentation analogue, not the final execution boundary.
A clean Matrix can embed one-origin, least-capability views for job, bid,
worker, review, and receipt. Hostile code belongs deeper, in a disposable
process/container/VM.

Trees survive fungal damage partly by compartmentalizing injury and building
boundaries around spread. Nexus applies the metaphor:

- one Job Capsule is one replaceable compartment;
- child capabilities narrow as they descend;
- suspect cells are quarantined;
- recovery keys stay outside ordinary transport;
- clean state regrows from a verified root;
- damage evidence is preserved rather than painted green.

The metaphor guides topology. It proves nothing about implementation.

## 12. Sentinel and dual-kernel defense

Sentinel enforces caller, audience, action, destination, data class, sequence,
nonce, expiry, policy, and budget. The private/agent kernel can be highly
creative: it may generate attacks, fuzz packets, poison fixtures, reorder
races, and hunt for drift. The deterministic kernel remains narrow:

```text
validate canonical event
validate authority
validate predecessor
apply pure transition
check invariants
stage journal + state
commit or reject
```

This is offense as defense only inside authorized fixtures and systems. There
is no retaliation, external persistence, credential theft, or uncontrolled
scanning.

## 13. GitHub as witness

Each job lives on a branch/PR and ends as one sanitized capsule. Squash merge
creates one clean mainline commit, while the capsule preserves the internal
ordered receipt root.

Required GitHub controls:

- untrusted PR checks use read-only tokens and no secrets;
- avoid `pull_request_target` for checked-out untrusted code;
- verifier/workflow/policy paths receive separate protection;
- required check comes from the expected source;
- strict current-base checks or merge queue prevent stale-base merge;
- post-merge trusted workflow recomputes the capsule root;
- artifact provenance binds digest, repository, workflow, event, and commit;
- local durable outbox survives GitHub outage.

GitHub can witness bytes and configured checks. It cannot prove model
independence, private-data non-leakage, runner integrity, semantic safety, or
financial finality.

Public roots are not automatically harmless. A root that transitively commits
to proprietary filenames, prompts, source, identity, business facts,
low-entropy values, or internal state is omitted or replaced by a separately
constructed public-safe summary root. The disclosure compiler fails closed if
it cannot prove every published root is safe.

## 14. Open-source work commons

An open-source maintainer can publish a bounded job against a pinned repository
and licence policy. Community members can pledge simulated credits. Their
agents can contribute capacity or bid to work. The result is:

- an ordinary patch/PR;
- preserved upstream and attribution;
- test and security evidence;
- three bounded semantic reviews;
- maintainer acceptance or rejection;
- a public-safe Job Capsule;
- simulated settlement under predeclared terms.

Before a job appears in the public project queue, the registered maintainer
signs the repository/base/task/licence binding. The Sandbox supports only a
fixture-simulated repository binding and labels it
`SIMULATED_MAINTAINER_BINDING`; it does not imply verified upstream control. A
requester who does not control the upstream can still propose a job, but it is
visibly `COMMUNITY_PROPOSAL` and cannot accept funding or leases until a
separately verifiable maintainer binding exists. Money or donated agents cannot
forge that opt-in.

People may contribute in three separable ways:

1. sponsor a specific frozen job budget with a revocable pre-selection pledge;
2. donate simulated credits under an explicit project-pool residue policy;
3. donate bounded agent capacity through a signed volunteer capability offer.

The third form shares neither provider credentials nor unrestricted account
access. The owner sees and acknowledges the exact project, public data route,
compute ceiling, tools, licence/contribution terms, attribution choice,
expiry, and revocation boundary before a lease is issued. Maintainers see
machine-readable provenance and may decline the patch regardless of funding.

Sponsors buy no governance. Donors buy no ownership. Models buy no truth.
Maintainers retain project authority. Contributors retain attribution and
rights under the declared licence; rights metadata does not manufacture legal
title.

V0 binds exactly one human principal allowed to decide job settlement; a
multi-principal decision quorum is rejected until its aggregation semantics
exist. Repository merge remains maintainer-exclusive even when another human
is authorized to resolve the work contract. Appeals bind immutable
role-to-principal and party sets and are bounded by
listed grounds, deadline, evidence access, a predeclared non-party resolver,
and one maximum round. An unavailable resolver keeps the job held until the
frozen resolution deadline, then aborts under the predeclared disposition
table rather than letting the operator appoint itself silently.

## 15. Clean Nexus Matrix experience

The Matrix should show one coherent story, not internal agent chatter.

### Home

- projects needing help;
- available local agent capacity;
- locked versus available `SIM_CREDIT`;
- privacy and isolation status;
- active jobs, holds, and completed capsules.

### Job view

- plain-language task and maintainer;
- funding progress;
- capability/privacy label;
- bid phase and deterministic selection rule;
- work graph with bounded seats;
- spend and time ceiling;
- evidence timeline;
- three-review status with diversity labels;
- exact hold reason and safest next action;
- appeal deadline, eligible grounds, resolver relationship, evidence access,
  and which payouts are frozen.

### Capability nutrition label

Before approval:

```text
DATA LEAVING: redacted task packet
NETWORK: provider API + GitHub read
FILES: pinned worktree only
SPEND: maximum 40 SIM_CREDIT
TIME: 120 logical ticks
RE-DELEGATION: denied
SECRETS: none
ISOLATION: local disposable container
PROOF LIMIT: model/hardware identity unverified
```

### Attention design

The interface uses strong color and icons for:

- green: deterministic evidence passed;
- amber: correlated/unknown review or reversible risk;
- red: invariant/security/rights failure;
- violet: human decision reserved;
- blue: informational progress only.

No celebratory animation can cover a red. Users can always drill from summary
to the canonical receipt.

## 16. Economics and harm boundary

The prototype is designed to test mechanics without creating a disguised
financial product.

It therefore forbids:

- redemption or external purchase;
- transferable bearer balances;
- bridges, wraps, exchanges, price boards, yield, lending, or OTC support;
- conversion of history into future value;
- payment for review agreement;
- donor influence on truth or governance;
- official resale of provider credentials or account credits;
- sharing provider API keys among workers;
- labour extraction disguised as “community agents” without explicit consent,
  limits, attribution, appeal, and exit.

External market behavior is a containment signal, not product validation.
Real-world funding for open source should use ordinary accountable grants,
donations, sponsorship, invoices, or platforms under applicable terms and
review; it is separate from `SIM_CREDIT`.

## 17. Governance through the rings

The Ring 0/1/2 governance model applies:

- Ring 0: human authority, deterministic state, conservation, privacy routing,
  AI non-authority, no real value, fail-closed finality.
- Ring 1: canonical event, capability, job, bid, receipt, review, and capsule
  protocols.
- Ring 2: UI, worker implementation, model adapters, scoring presentation,
  fixtures, and visual design.

The Ten Rings remain audit questions:

1. does the job work?
2. does it recover from failure?
3. does evidence survive infrastructure loss?
4. can the mechanism evolve without rewriting history?
5. can users exit/fork without captured infrastructure?
6. does value remain in artifacts rather than the broker?
7. can another implementation replay the protocol?
8. are assumptions and disagreements preserved?
9. is inbound work filtered more strictly than safe output?
10. can recovery survive compromise of the normal path?

## 18. Falsifiable prototype claim

The first prototype succeeds only if deterministic vectors show:

- exact supply conservation;
- race-safe bid selection/revocation/cancellation;
- bounded agent spending;
- local-only proprietary routing;
- stale/replay rejection;
- three exact-root model reviews with honest diversity labels;
- deterministic veto;
- old-or-new crash recovery;
- one terminal settlement;
- tamper-detecting GitHub capsule replay.

One counterexample materially falsifies the relevant claim.

## 19. Non-claims

Flow State v0.1 does not claim:

- real money or a production token;
- anonymous or unlinkable users/payments;
- fair markets or Sybil resistance;
- proof of remote model/hardware execution;
- remote deletion;
- confidential P2P computation;
- independent review merely from three models;
- production wallet, custody, consensus, or finality;
- licence/legal correctness;
- security from a compromised host;
- Nexus Lab acceptance.

## 20. Roadmap

### Iteration A — deterministic local simulator

Implement the Job Capsule, ledger, bids, allowances, scheduler, review gate,
settlement, replay, and adversarial vectors.

### Iteration B — clean Matrix walkthrough

Render one crowdsourced open-source job and every red/hold path in a static
browser experience backed by the simulator fixture.

### Iteration C — compartment adapters

Add local disposable worker adapters with explicit filesystem/network/resource
policies. Keep provider/API adapters mocked until data and credential gates
pass.

### Iteration D — GitHub witness

Generate a sanitized capsule, verify it in CI from a protected verifier source,
and bind post-merge provenance.

### Iteration E — independent pilots

Invite genuinely separate operators/providers/machines and maintainers. Measure
defect discovery, cost, latency, privacy incidents, and human load. Do not call
same-account tests independent.

### Iteration F — boundary decision

After security, rights, economic, abuse, accessibility, minors, secondary
market, provider-terms, and legal review, decide whether any real-value layer
is necessary. If so, start from a clean separately authorized genesis. If not,
keep Flow State as a work orchestration commons and use ordinary funding rails.

## Conclusion

The proposal's novelty is not an autonomous token or a crowd of models. It is
the combination of one comprehensible job boundary, deterministic state,
least-authority workers, evidence-bound review, explicit human acceptance, and
honest limits.

The system should feel fluid because the machinery handles routing, retries,
receipts, and verification. It should remain safe because flow never becomes
ambient authority.
