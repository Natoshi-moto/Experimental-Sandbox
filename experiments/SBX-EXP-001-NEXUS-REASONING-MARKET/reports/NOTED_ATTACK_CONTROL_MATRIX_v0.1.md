# Recent Noted attack/control matrix v0.1

**status_authority:** `NONE`
**Disclosure:** category-level public report; exploit recipes and sensitive
local paths are intentionally omitted.

## Finding

The recent Noted adversarial work is directly useful because it attacks the
same seams the agent market would add: embedded blocks, cross-window
messaging, external providers, receipts, relays, keys, and supply-chain code.
Sentinel helps at those seams only when the host actually enforces its
capabilities.

| Card | Attack class observed in the Lab corpus | Why it matters here | Required Nexus control | Sentinel contribution | Status for prototype |
|---|---|---|---|---|---|
| CARD-02 | unpinned third-party browser dependency | remote bytes can change after review and execute in a trusted page | self-host or digest-pin; CSP; offline/failure test | can deny undeclared network origin | regression required |
| CARD-03 | permissive/default network proxy | SSRF, tracking, arbitrary retrieval, and prompt injection become ambient | typed fetch broker with exact allowlist, method/path/size/content policy | lease and tunnel bind destination and expiry | default deny |
| CARD-04 | same-origin embedded content with dangerous sandbox combination | child can reach parent/storage or remove its own containment under certain conditions | distinct origin; no unsafe token combination; no ambient storage; hostile code in VM, not iframe | validates declared iframe capability but cannot repair same-origin browser authority | hard gate |
| CARD-05 | wildcard cross-window target | secrets/results may be delivered to the wrong window | exact target origin; source-window and schema checks | signed envelope and audience binding | hard gate |
| CARD-06 | compromised but expected child frame | origin/source checks alone accept malicious logic at the expected endpoint | artifact/image pin, capability minimization, behavior-independent verifier | limits power even for an authenticated compromised child | adversarial fixture |
| CARD-07 | asynchronous readiness/race ambiguity | early messages, cancellation, and stale state can cross | explicit handshake state, sequence, predecessor root, timeout | ordered tunnel state | race suite |
| CARD-08 | missing replay/deduplication/size ceilings | duplicated work, memory exhaustion, stale approvals, repeated settlement | nonce registry, idempotency, byte/count/time caps | sequence/nonce/expiry validation | hard gate |
| CARD-09 | forgeable/informal receipts and weak randomness | fake work, fake reviews, predictable IDs, receipt substitution | canonical signed receipts; cryptographic nonces; domain separation | signer lane and signed receipt contract | hard gate |
| CARD-11 | provider or identity key exposed in ordinary app storage | child/source compromise becomes account or provider compromise | OS/keychain or signer broker; never expose key to iframe/worker; rotation and revocation | strongest Sentinel fit: keyless capability tunnel | hard gate |
| CARD-13 | absent or weak content-security policy | injected or unexpected code gains broad browser reach | strict CSP, no inline/eval unless hashed and justified, frame/connect allowlists | can enforce declared network route outside page | release gate |

## Additional attacks induced by the agent economy

| New surface | Attack | Control |
|---|---|---|
| job descriptions | prompt injection asks worker to reveal unrelated context | mark retrieved bytes as data; scoped context; tool/capability gate |
| bids | copying, front-running, selective reveal, Sybil flood | round commit/reveal, fixed cutoff, count cap, one-principal weighting in v0 |
| delegated spending | agent self-deals or re-delegates | amount/purpose/recipient/job/expiry permit; no re-delegation |
| three-model gate | same operator/model family appears independent | explicit diversity vector; no independence claim; deterministic veto |
| review payment | reviewers approve to get paid | pay valid review completion, not agreement |
| open-source funding | donor purchases maintainer outcome | separate donation/pledge/payment/acceptance states |
| source distribution | proprietary repository leaks to bidder/reviewer/provider | metadata-only bids; local-only proprietary work; public-safe capsule |
| GitHub CI | job branch edits its own verifier | protected verifier source, CODEOWNERS/ruleset, independent check source |
| squash merge | ordered child evidence disappears from main history | final capsule embeds ordered receipt hashes and worker head |
| remote compute | worker lies about model/hardware/deletion | label unverified; pay accepted artifact, not claimed compute |

## Does the current dual architecture help?

Yes, if the attack generator remains on the non-authoritative side. A private
kernel can run breakers against the Matrix, router, bids, artifacts, and
receipts. A deterministic kernel can reject invalid transitions without
learning how to be “helpful.”

No, if both kernels share:

- the same compromised browser origin;
- the same writable verifier;
- the same provider key;
- the same host secrets;
- one mutable dependency/update channel;
- an untyped router that forwards ambient authority.

Dual naming is not dual containment. The test suite must prove the seam.

## Immediate prototype gates

1. No wildcard `postMessage`.
2. No same-origin untrusted iframe with both scripts and same-origin power.
3. No key or token in iframe, source fixture, log, or GitHub capsule.
4. Exact schema, version, origin, source, audience, nonce, sequence, expiry,
   size, and predecessor validation.
5. Protected verifier paths and a test that intentionally mutates them.
6. Deterministic hostile-card fixtures for each row above.
