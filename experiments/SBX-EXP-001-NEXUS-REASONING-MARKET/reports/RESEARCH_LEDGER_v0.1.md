# Research ledger v0.1

**status_authority:** `NONE`
**Research class:** local read-only archaeology plus official public references

## Timing

| Event | Europe/London |
|---|---|
| Safety review began | `2026-07-26T02:46:50+01:00` |
| First product edit allowed | `2026-07-26T03:17:01+01:00` |
| Pre-build review duration | 30 minutes 11 seconds |

No product file was edited during the pre-build window. The isolated worktree
was clean at the start and the baseline verifier passed.

## Repository baseline

| Field | Value |
|---|---|
| Repository | `Natoshi-moto/Experimental-Sandbox` |
| Worktree branch | `agent/p2p-reasoning-market` |
| Initial commit | `83822c4` |
| Baseline command | `./scripts/verify.sh` |
| Baseline result | `experimental-sandbox: PASS` |
| Lab write authority | none |

The existing GitHub workflow runs on `push` and `pull_request`, grants only
`contents: read`, disables persisted checkout credentials, pins the checkout
action by commit, and invokes the repository verifier. The repository is
squash-merge-only and `main` requires the strict `verify` check. This is a
useful starting point, not a complete verifier trust boundary.

## Corpus passes

### Broad discovery pass

A filename/extension and keyword pass covered relevant material under the
operator's home workspace while excluding `.git`, dependency caches,
`node_modules`, common build outputs, and Python package caches.

| Extension | Candidate artifacts |
|---|---:|
| Markdown | 3,933 |
| HTML | 605 |
| JSON | 9,032 |
| DOCX | 652 |
| PDF | 215 |
| text | 414 |
| **Total** | **14,851** |

An early temporary aggregation reported 536 unique hashes and 415 duplicate
groups. That aggregation was not durably bound to the exact 14,851-path input
list and used a different filename-gated population. It is therefore
**discarded as a quantitative result**, not presented as a deduplication ratio.
Keeping the rough number would create false precision.

The 14,851 figure remains only a broad extension/path discovery count. These
are **candidate artifacts**, not 14,851 independent papers. The largest
inflation sources are generated Nexus Sim summaries, receipts, fixtures,
exports, duplicated downloads, and versioned bundles.

### Curated load-bearing pass

A narrower high-signal set contained 148 files and 143 unique hashes. It
covered:

- agent and multi-model orchestration;
- Nexus private/router/consensus kernels;
- Sentinel and authority containment;
- Nexus Sim deterministic state and receipts;
- Ten Rings and the separate Ring 0/1/2 governance model;
- router, iframe, Nostr, browser, and capability boundaries;
- bounded work exchange and conserved-credit experiments;
- custody, replay, durability, and GuardAccept finality;
- Foundry, Cathedral, Mithub, Nex Sim Hub, and provenance ledgers;
- synthetic/closed-world economies and their harm gates;
- recent Noted adversarial cards and control proposals;
- recovery bundles, canonical build kits, and LEGO-style composable packets.

Five duplicate hashes remained in the curated set. Duplicate copies were
treated as one evidentiary source, not corroboration.

### Reproducible privacy-reduced publication pass

The checked-in generator scanned an explicit set of design/evidence roots and
used both relative names and bounded text previews for mechanical relevance:

| Measure | Result |
|---|---:|
| candidate files in explicit roots | 1,534 |
| mechanically related files | 1,141 |
| unique related content hashes | 1,040 |
| duplicate copies beyond the first | 101 |
| files skipped for size | 0 |

These counts are reproducible from
`tools/build-corpus-inventory.mjs` and the exact checked-in manifest. They
supersede the unbound rough hash aggregation above.

### Publication reduction

The checked-in corpus inventory deliberately publishes:

- content hash;
- safe basename;
- coarse source bucket;
- byte size;
- copy count;
- mechanical applicability category.

It deliberately does not publish:

- absolute local paths;
- source contents;
- prompts, notes, credentials, identity data, or private repository data;
- a claim that every discovered artifact was authored independently;
- a claim that filename relevance means technical correctness.

Locally reviewed sensitive-safety material was excluded from the public
machine inventory entirely. Only its high-level, non-sensitive lessons were
used in the synthesis.

## Primary mechanisms examined

1. Strict canonical JSON and domain-separated hashing.
2. Signed, nonce-bound, expiry-bound capability objects.
3. Append-only receipt journals, predecessor roots, replay, and idempotency.
4. Integer conservation and UTXO-like ownership.
5. Atomic staging, rollback diagnostics, and crash consistency.
6. Key rotation, guardian recovery, and terminal revocation.
7. Typed routers, qrexec-like narrow RPC, and deny-by-default egress.
8. Iframe sandboxing, origin isolation, CSP, and message validation.
9. Unix process boundaries, Linux namespaces/cgroups/seccomp/MAC, and VM
   compartments.
10. Commit/reveal bidding and its limits.
11. Three-review gates, same-provider correlation, and deterministic veto.
12. Git protected branches, strict checks, squash merges, merge queues, and
    artifact provenance.
13. Rights, licence, upstream pinning, and provenance manifests.
14. Closed-world economic boundaries, secondary-market leakage, user harm,
    appeal, and halt conditions.

## Independent-source caveat

Three bounded read-only specialist reviews were run in parallel:

| Declared model | Review |
|---|---|
| `gpt-5.6-sol` | job lifecycle, bid/accept/cancel races, settlement invariants |
| `gpt-5.5` | GitHub witness, workflow mutation, CI and attestation limits |
| `gpt-5.6-terra` | privacy, crowdfunding, delegated spending, open-source work |

They used distinct model IDs but one provider family and one operator context.
Their convergence is useful correlated critique. It is not independent
corroboration and cannot satisfy the proposed production three-party gate.

## Official external references

Technical points that could have changed or required exact wording were
checked against primary/official sources:

- [Qubes OS architecture](https://www.qubes-os.org/doc/architecture/)
- [Qubes disposable qubes](https://www.qubes-os.org/doc/how-to-use-disposables/)
- [Qubes qrexec](https://www.qubes-os.org/doc/qrexec/)
- [WHATWG iframe sandboxing](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
- [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [Linux namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub squash merging](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)

The biological analogy was checked against established
compartmentalization-of-decay concepts. It is used only as a design analogy,
not a security proof.

## Diminishing-returns decision

The review stopped expanding its raw file count after:

- duplicate copies dominated the next results;
- the same control families recurred across bundles;
- newly opened sources added caveats or variants rather than a new authority
  primitive;
- the major unresolved boundaries were already clear: hostile-host trust,
  independent review, real-value economics, privacy, rights, and protected
  verification.

The complete task continues through implementation and adversarial testing;
only unbounded pre-build archaeology stopped here.
