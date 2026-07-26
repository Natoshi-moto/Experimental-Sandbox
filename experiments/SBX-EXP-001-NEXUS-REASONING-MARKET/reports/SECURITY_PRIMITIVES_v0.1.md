# Security primitives and connectivity ladder v0.1

**status_authority:** `NONE`

## The rule

A primitive is credited only with the narrow property it can actually
establish. Layering primitives can reduce risk; it does not turn their
non-claims into proof.

## Primitive ledger

| Primitive | What it can establish | What it cannot establish |
|---|---|---|
| Strict canonical serialization | equal valid objects produce equal bytes under one version | semantic truth, safe schema, cross-version equality |
| Domain-separated hash | content commitment within a named protocol domain | confidentiality, authorship, benign content, deletion |
| Digital signature | holder of a signing key authorized these bytes under a key registry/policy | human identity, honesty, independence, legal authority beyond policy |
| MAC/HMAC | a party with the shared secret authenticated bytes | public attribution or non-repudiation |
| Nonce + replay registry | one scoped message identifier is not accepted twice | freshness without durable state |
| Sequence + predecessor root | accepted transitions have one declared local order | global consensus or trustworthy wall-clock time |
| Expiry/lease | authority is bounded under the clock/trust model used | physical time on a compromised host |
| Append-only journal | accepted records can be replayed and gaps detected under durable storage | immutable history against storage administrator rewrite |
| Merkle/content root | compact commitment to an ordered/set structure | correctness of members |
| Safe integer conservation | declared supply cannot drift through accepted transitions | economic value, fairness, correct ownership policy |
| UTXO/reserved balance | one output/reservation is consumed at most once locally | global double-spend prevention without shared ordering |
| Atomic database commit | grouped local writes become visible old-or-new | distributed atomicity across GitHub/network/providers |
| Idempotency key | exact retry returns the same result without duplicate effect | equivalence of semantically different requests |
| Capability object | a caller may perform one bounded class of action | caller honesty or host integrity |
| Separate signer lane | workers need not receive private keys | signer host or policy correctness |
| Threshold guardians | no single listed guardian can perform a threshold action | guardian independence, coercion resistance, correct recovery owner |
| Commit/reveal | values can be hidden until reveal if commitments/salts remain secret | metadata privacy, fair inclusion, anti-censorship, anti-collusion |
| Deterministic test/falsifier | a specified property failed or passed on specified bytes/environment | absence of untested defects |
| Model review | semantic critique from a declared model context | truth, independence, execution identity, absence of shared errors |
| Protected branch/check | GitHub enforces configured merge conditions | safety of the check itself |
| Artifact attestation | recorded workflow/repository/commit produced a digest | artifact security or honest reasoning |
| CSP/origin isolation | browser resource and communication paths are reduced | kernel/extension/browser compromise |
| Iframe sandbox | selected browser capabilities are withheld from a document | Qubes-equivalent hostile code containment |
| Unix user/process | discretionary identity/process separation | kernel compromise or every covert channel |
| Linux namespaces | selected kernel resource views are isolated | separate kernel trust |
| cgroup v2 | descendants cannot exceed delegated resource ceilings | confidentiality or syscall safety |
| seccomp | disallowed syscall classes are blocked | safe semantics of allowed syscalls |
| Landlock/AppArmor/SELinux | declared filesystem/process access policy can be enforced by host kernel | protection from a compromised kernel/policy administrator |
| Network namespace/firewall | declared routes and egress can be blocked | traffic secrecy or malicious allowed destinations |
| Container | reproducible/disposable userspace boundary | independent kernel |
| VM/Qubes compartment | stronger separate-kernel compartment and narrow RPC | hypervisor/firmware/hardware independence |
| TPM/TEE attestation | a measurement is signed by an accepted hardware/vendor trust chain | bug-free code, honest model behavior, deletion, side-channel absence |
| Encryption in transit | passive network observers cannot read protected traffic under key assumptions | endpoint compromise or metadata privacy |
| Encryption at rest | storage bytes are protected while key is unavailable | protection while unlocked or from key theft |
| Canary | unexpected access/use can reveal one leakage path | prevention or complete detection |
| Rate/budget cap | maximum accepted resource impact is bounded locally | fairness or availability below the cap |

## Connectivity and functionality ladder

The highest-function features are often the most dangerous because they bridge
authority domains. The prototype should make this ladder visible in the Nexus
Matrix instead of hiding it behind one “connected” switch.

| Level | Capability | UX/function gained | Principal risk | Minimum control |
|---:|---|---|---|---|
| 0 | deterministic local simulation | instant replay, safe demos, offline work | stale data only | canonical fixtures and reset |
| 1 | read-only local project files | useful coding context | unintended file disclosure | explicit workspace root, read manifest, secret scan |
| 2 | allowlisted HTTPS fetch broker | docs/dependency metadata | tracking, prompt injection, SSRF | typed proxy, domain/path/method/size limits, no cookies |
| 3 | provider inference API | frontier reasoning | prompt/source exfiltration, key theft, provider retention | local key broker, data-class gate, redaction, spend cap |
| 4 | WebSocket/relay | live agent status and queues | replay, impersonation, long-lived attack channel | authenticated envelopes, nonce/sequence/expiry, reconnect cap |
| 5 | WebRTC/P2P data channel | direct low-latency worker exchange | IP/metadata exposure, NAT services, hostile peers | opt-in, identity/capability handshake, TURN policy, payload limits |
| 6 | GitHub read/write adapter | branches, PRs, checks, public witness | token theft, malicious workflow, accidental publication | GitHub App/fine-grained scope, protected paths, no secret payloads |
| 7 | writable project workspace | real coding and tests | source corruption, secret inclusion, licence drift | disposable branch/worktree, path allowlist, diff review, rollback |
| 8 | package installation/build | broad language ecosystem | supply-chain code execution | lockfile, digest pin, isolated worker, no secrets/network by default |
| 9 | bounded shell in worker cell | full coding/tooling | arbitrary code execution | disposable VM/container, syscall/filesystem/network/resource policy |
| 10 | delegated `SIM_CREDIT` spend | autonomous bidding and sub-work | drain, self-dealing, replay | narrow allowance, reserve, expiry, no re-delegation, human ceiling |
| 11 | signer/recovery operation | authenticated final actions | total authority compromise | separate lane/device, explicit human ceremony, threshold/recovery |
| 12 | privileged host/device control | maximum automation | machine/account takeover | excluded from untrusted agent scope |

The clean interface can enrich UX by showing:

- a capability “nutrition label” before a job opens;
- exactly what data may leave the machine;
- a live spend and compute ceiling;
- which boundary each worker occupies;
- why a route is local, redacted, remote, held, or rejected;
- one-click revoke for future agent authority;
- deterministic receipt drill-down without exposing private reasoning;
- a “stronger isolation required” explanation instead of a fake green badge.

## Top-down Qubes/tree architecture for Nexus

```text
Ring 0: Nexus Sim invariants and human authority
    │ permits only typed Ring 1 contracts
Ring 1: router, job, receipt, capability, and verifier protocols
    │ delegates narrower leases
Ring 2: Matrix blocks, agents, adapters, and worker implementations
```

At runtime:

```text
Matrix shell (presentation)
  ├─ public project iframe — unique origin, read-only proposal surface
  ├─ bidder iframe — no source, only sanitized job metadata
  ├─ reviewer iframe — blind artifact packet, no bid/payout visibility
  └─ receipt iframe — static replay/provenance viewer

Local control plane (separate process)
  ├─ router/prober
  ├─ capability broker
  ├─ data-class guard
  └─ deterministic verifier

Worker plane (disposable compartments)
  ├─ lead worker cell
  ├─ test worker cell
  ├─ provenance/licence worker cell
  └─ three blind semantic review cells

Authority plane
  ├─ Nexus Sim state kernel
  ├─ journal/outbox
  └─ signer/recovery lane
```

Nested iframes improve presentation composability and origin separation. Nested
sandboxes improve execution isolation only when the deeper boundary is a
separate process/container/VM with a narrow typed gateway. The iframe should
never receive ambient authority merely because it is visually “inside” a
trusted Matrix.

## Proactive defense through the dual kernel

The private/agent kernel may run aggressive authorized breakers:

- mutate receipts;
- fuzz schemas;
- reorder races;
- poison prompts;
- submit hostile artifacts;
- simulate provider lies;
- probe route and capability boundaries.

The deterministic kernel evaluates only canonical events and invariant
results. This is the useful form of “offense as defense”: creative attack
generation on the non-authoritative side, strict acceptance on the
authoritative side. The system must never retaliate against external machines
or let a breaker inherit signer, settlement, GitHub-write, or recovery power.
