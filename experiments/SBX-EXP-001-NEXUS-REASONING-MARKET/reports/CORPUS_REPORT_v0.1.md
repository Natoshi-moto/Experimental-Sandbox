# Agent, kernel, router, and economy corpus report v0.1

**status_authority:** `NONE`

## Executive finding

The corpus already contains most of the primitives needed for a safe
simulation. It does **not** contain a finished proof that remote inference is
honest, proprietary work can be distributed without leakage, three models are
independent, an anonymous market is fair, or a real token is authorized.

The strongest synthesis is:

```text
Nexus Sim deterministic kernel
  + Sentinel capability containment
  + Dual-Kernel authority separation
  + R012 bounded work packets
  + R016 ordered controller lifecycle
  + Foundry disposable workers
  + Mithub/GitHub witness capsules
  + closed-world SIM_CREDIT constraints
  = viable local adversarial prototype
```

No one paper supplies that whole result.

## Distinct design-family register

The broad machine inventory records individual unique hashes. This table
reports each materially distinct design family encountered and how it pertains
to sensitive P2P agent work.

| # | Source family | Brief finding | Decision for this experiment |
|---:|---|---|---|
| 1 | Nexus Sim / ARC R003 | Canonical bytes, staged transitions, append-only receipts, roots, conservation, replay, rollback diagnostics, strict manifests. AI remains advisory. | **Adopt as core authority model.** |
| 2 | Nexus Sim economic models | Useful deterministic simulation fixtures, but internal ARC context is not a production market or currency. | **Adapt patterns only.** |
| 3 | Ten Rings constitutional paper | Ten failure questions: function through sanctuary. Strong audit lens; contains broader monetary/social claims that are not proven here. | **Adopt questions, not inherited claims.** |
| 4 | Ring 0/1/2 governance model | Separates immutable constitution, shared protocol, and replaceable leaf logic. This is distinct from the Ten Rings. | **Adopt and keep names separate.** |
| 5 | Dual-Kernel architecture | Private agent/UI kernel may request; typed router may translate; deterministic consensus kernel alone mutates canonical state. | **Load-bearing.** |
| 6 | Dual-Kernel technical/build contracts | Replay before settlement, AI attention not authority, no wall clock/network/randomness/float in consensus, simulation-only diagnostics. | **Adopt as Ring 0 constraints.** |
| 7 | Dual-Layer Value architecture | Separates machine metabolism from social truth/reputation. AI may estimate and route, never debit/mint/sign/commit. | **Load-bearing; keep credit out of truth/governance.** |
| 8 | Nexus Sentinel v0.10 | Capability leases, signed tunnels, sequence/nonce/expiry checks, receipts, signer lane, fail-closed authority containment. | **Load-bearing inside its trust floor.** |
| 9 | Sentinel Ring Relocation | Correctly exposes that a userland sentinel cannot attest an adversarial host or prove ambient absence/deletion. Trust bottoms out in stronger isolation/hardware. | **Adopt its honesty boundary.** |
| 10 | Security and Capability Model | Denies persistence, network, signing, background execution, telemetry, eval, shell, auth, and mutation unless explicitly granted. | **Adopt deny-by-default vocabulary.** |
| 11 | Capability Boundaries / browser cartridges | Narrow browser blocks, explicit CORS/API surface, no ambient filesystem/shell. | **Adopt for UI blocks, not hostile compute.** |
| 12 | Noted Nexus Router papers/manuals | Outer host routes typed events to sovereign blocks. Existing iframe design is a compositional base but not sufficient isolation. | **Adapt; repair origin/message boundaries.** |
| 13 | Nostr Routing Spec | External relay transport and signer broker; blocks never hold private keys. Useful transport/signing split. | **Hold for later transport adapter.** |
| 14 | Canonical router / role cards | Route by declared role/capability and compact packets rather than free-form agent authority. | **Adopt in scheduler contracts.** |
| 15 | Multi-Model Orchestration | One grounding source, one user-facing channel, compact specialist packets; stop adding models when routing/reading cost exceeds benefit. | **Adopt for clean Matrix UX.** |
| 16 | Cathedral model | Separates semantic, coordination, authority, execution, evidence, and presentation planes. Durable roles outrank chat memory. | **Adopt plane separation.** |
| 17 | Foundry whitepaper/build spec | Bounded jobs, durable scheduler, disposable workers, leases, retries, idempotency, evidence, compensation/reconciliation. | **Adopt worker-cell model.** |
| 18 | R012 Bounded Work Exchange | Exact task/route/source/producer/recipient/epoch/nonce/predecessor binding; one accepted return settles once. | **Load-bearing work contract.** |
| 19 | R013 Conserved Claim | Synthetic integer UTXO/conservation and replay checks; explicitly not money, privacy, custody, or global consensus. | **Adopt conservation tests.** |
| 20 | R014 Durable Replay | Durable event journal and replay behavior. | **Adopt for restart semantics.** |
| 21 | R015 Independent Durability Verifier | Crash boundaries, separate verifier model, and old-or-new durability claims. | **Adopt fault-injection pattern.** |
| 22 | R016 Integrated Custody Gate | Transfers, rotation, recovery, and revocation share one predecessor order; 2-of-3 guardian recovery/revocation. Separate events, not one lifetime transaction. | **Load-bearing ordering pattern; do not overread.** |
| 23 | R017 finality/admission / GuardAccept | Finality requires all declared evidence references and evaluators; missing/disagreement suspends or quarantines. Control rail does not grant finality. | **Adapt to three-review `HOLD`.** |
| 24 | Provenance ledger / FFI corpus compiler | Preserve source bytes, distinguish source/annotation/handoff, cite spans, hash deterministic transformations and retries. | **Adopt for proprietary-safe manifests.** |
| 25 | Recovery bundles / LEGO kits | Compose small, hashed, replaceable packets with manifests rather than one opaque archive. | **Adopt capsule packaging and recovery drill.** |
| 26 | Mithub | Git/GitHub owns bytes, trees, commits, PRs, Actions, and issues; semantic layer owns meaning/capability/claims. PR joins code and meaning. | **Adopt GitHub-as-witness split.** |
| 27 | Nex Sim Hub | Runs should record config, seed, version, output hash, break proofs, and links; public-safe evidence only. | **Adopt run receipt envelope.** |
| 28 | Breaker Status | A public break proof must bind reproducible evidence and hashes; status is not money. | **Adopt adversarial evidence, reject value coupling.** |
| 29 | Open Fork doctrine | Preserve licence, NOTICE, upstream pin, attribution, and give-back route. | **Load-bearing for open-source jobs.** |
| 30 | Moots rights layer | Rights metadata and dispute records are useful but do not create legal title. | **Adopt gate; require specialist/human review.** |
| 31 | Agent Economy Canvas | Correctly says consumer hardware cannot prove remote/co-resident compute without attestation; pay only accepted verifiable work. Economics remain open. | **Adopt non-proof and acceptance limits.** |
| 32 | Synthetic Economy v0 | One simulator can test quorum/settlement separation and one-principal weighting; seven cells are not seven independent actors. | **Adopt closed-loop test model.** |
| 33 | Low Compute Economy | Adaptive AI is untrusted labor; deterministic machine verifies; bounded roles and one-principal-one-weight. Commit/reveal does not solve censorship or MEV. | **Adopt role and anti-overclaim rules.** |
| 34 | Social/Synthetic Economy draft | Declares zero-value, non-transferable, non-redeemable recognition and exposes contradictions with inherited wallet/transfer surfaces. | **Adopt red scanner requirement.** |
| 35 | Closed-World Economy Invariants | Defines entry/custody/transfer/exit/narrative closure, secondary-market leakage, user harm, appeals, and mandatory specialist gates. | **Constitutional boundary for v0.** |
| 36 | Account-memory / chat-harvest paper | One chat can map to one artifact/worker execution, but account memory is lossy cognition and must have zero independent-evidence weight. | **Adopt job granularity and evidence warning.** |
| 37 | Full-Spectrum / project graph papers | Repository history can be canonical context while semantic routes remain disposable and hostile-host assumptions remain visible. | **Adopt source/meaning split.** |
| 38 | Nexus kernel v0.4.1 build spec | Identifies journal, raw-ingress, token, and verifier defects; demonstrates specs must be checked against executable paths. | **Use as adversarial checklist.** |
| 39 | Locked-image/single-state handoff | Byte-identical images and one sequencer simplify disagreement only if admission is externally attested; governance/sequencer become central points. | **Hold; self-reported hashes rejected.** |
| 40 | Qubes model | Strong compartments, disposable VMs, narrow qrexec paths, and explicit trust domains. | **Cross-pollinate top-down; do not claim iframe parity.** |
| 41 | Unix/Linux primitives | Process/user separation, namespaces, cgroup top-down restriction, seccomp, MAC, mount and network controls. Containers still share a kernel. | **Adopt local worker hardening in layers.** |
| 42 | Tree CODIT/fungal defense analogy | Compartmentalize damage, seal boundaries, preserve core transport, and abandon infected cells. | **Use as architecture metaphor only.** |
| 43 | Noted Sovereignty Assault cards | Exposed origin, messaging, replay, receipt, key-storage, dependency, CSP, and compromised-child weaknesses. | **Turn into regression vectors.** |
| 44 | Nexus guide + 100 moves | Plain-language warning: one account, one human, AI witnesses only; declared controls must become enforced tests. | **Adopt as epistemic UI rule.** |
| 45 | NEX Epoch/Reset and value papers | Some papers propose provisional or future value; current Lab evidence keeps real-world economic activation red and requires clean genesis. | **Exclude from v0 balances.** |
| 46 | Beneficial Genesis/economic red-team papers | Demonstrate donation, allocation, laundering, concentration, and classification hazards. | **Use as abuse fixtures; no live mechanism.** |
| 47 | Neutral Money report set | Development funding, token necessity, clean genesis, escrow/provider/legal review, and no historic conversion are separate decisions. | **Use as future gate, not prototype authority.** |

## What is load-bearing

### Nexus Sim

Nexus Sim is load-bearing because it supplies the only credible local answer to
“who decides state?”: strict input bytes, deterministic transition rules,
atomic staging, an append-only journal, replay, and conservation. The model
works only if the AI/router/UI remain outside that authority.

### Sentinel

Sentinel is load-bearing for *authority containment*: who may call what, with
which capability, in which sequence, before what expiry, and with which
receipt. It is not load-bearing as a claim that hostile hosts are safe. A
compromised layer below Sentinel can lie about Sentinel itself.

### R012 + R016

R012 binds work to exact context. R016 serializes value and controller
lifecycle under one predecessor root. Together they support one Job Capsule
whose internal workers cannot silently change scope or race stale authority.
Neither paper makes GitHub the ledger or an hours-long transaction safe.

### Mithub + GitHub

GitHub is load-bearing as a public byte witness and mechanical replay surface.
Its required checks and squash merge can make one clean mainline job record.
The capsule must preserve ordered child receipts because squash merging removes
the branch's internal commit topology from mainline history.

## What must not be cross-pollinated

1. The Ten Rings and Ring 0/1/2 models have different meanings; numbering them
   as one model would create a false constitution.
2. Compute credit must not become reputation, truth weight, governance, or
   proof of good work.
3. Attestation-as-admission for a locked-image compute domain must not become
   monetary consensus truth.
4. Same-account model agreement must not become independent evidence.
5. Browser iframe compartmentalization must not be advertised as Qubes-level
   hostile-code isolation.
6. GitHub provenance must not become semantic safety or financial finality.
7. A donation must not become a bid, purchase of acceptance, or future token
   allocation.
8. A simulated bid lock must not be advertised as legal escrow.

## Answer to the “whole account lifecycle” question

The closest load-bearing local paper is R016 Integrated Custody Gate. It
supports **one combined ordered lifecycle**: transfers and controller
rotation/recovery/revocation all consume a shared predecessor root. It does not
encode an account's whole lifetime as one indivisible transaction.

The useful evolution is:

- one human/project account remains the principal;
- each job creates one ephemeral job account/capsule;
- every child event is a short atomic, hash-linked transition;
- exactly one short terminal transition closes the contract, allowances,
  payouts, refunds, and receipt;
- GitHub squash-merges the sanitized capsule as one clean mainline record.

This keeps the flow-state insight and rejects the unsafe database
interpretation.
