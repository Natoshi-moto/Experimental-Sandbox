# Nexus Flow State technical specification v0.1

**status_authority:** `NONE`
**Status:** `SANDBOX_PROPOSAL`
**Implementation target:** dependency-free Node.js and browser-native UI
**Economic class:** `SIM_CREDIT_ONLY`

## 1. Scope

This specification defines a deterministic local prototype for:

- principal and job accounts;
- exact `SIM_CREDIT` conservation;
- contribution reservations;
- commit/reveal bids;
- deterministic worker eligibility and selection;
- worker acceptance and immutable contracts;
- bounded agent spending allowances;
- subordinate work leases;
- logical-tick scheduling;
- deterministic evidence;
- three artifact-bound model reviews;
- human/maintainer acceptance;
- atomic terminal settlement;
- append-only receipts and replay;
- sanitized GitHub witness capsules;
- a read-only Nexus Matrix walkthrough.

It does not define a production token, real-value settlement, anonymous
payments, global consensus, secure remote inference, legal escrow, production
custody, or Nexus Lab promotion.

## 2. Normative vocabulary

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative only
inside this Sandbox proposal.

- **accepted event** — an event that validates against exactly one current
  state root and commits a complete next state.
- **candidate** — untrusted proposed input, result, review, or artifact.
- **principal** — human/project authority represented by a registered
  controller in the simulator.
- **seat** — one declared agent/worker/reviewer role instance.
- **Job Capsule** — all canonical state and evidence for one job ID.
- **job account** — the ephemeral accounting boundary owned by a Job Capsule.
- **logical tick** — deterministic integer scheduling time.
- **terminal settlement** — one atomic `SETTLE_JOB`, `ABORT_JOB`, or
  `CANCEL_JOB` transition.
- **witness capsule** — public-safe deterministic export of a terminal Job
  Capsule.

## 3. Ring 0 invariants

The prototype MUST enforce:

1. AI, UI, router, broker, prober, worker, reviewer, and GitHub are not ledger
   authority.
2. Nexus Sim state transitions are deterministic and pure before commit.
3. Canonical logic uses no wall-clock time, live network, floating point,
   object insertion order, undeclared randomness, or model output.
4. Every accepted event consumes the current predecessor root.
5. Exact retries are idempotent; conflicting reuse rejects.
6. Rejected events have no state effect.
7. `SIM_CREDIT` is a safe non-negative integer and conserved.
8. Agent allowances reserve existing funds and cannot create spending power.
9. Worker acceptance freezes the contract.
10. Requester cancellation is unilateral only before worker acceptance.
11. Every review binds one exact artifact/evidence/policy packet.
12. A deterministic failure vetoes model clearance.
13. Same-account/provider correlation remains visible.
14. Every job has one terminal state and one terminal settlement.
15. Private data follows its data-class route and never enters public export.
16. GitHub failure cannot roll back local settlement.
17. The prototype exposes no redemption, bridge, external purchase, or
    transferable bearer balance.
18. Mutable records keep stable creation IDs and hash-link every record
    revision; mutable body fields never redefine identity.
19. A terminal job has no live child object or active funding lot.
20. Exact committed replay is historical lookup, not a new authorization
    attempt under current key state.

Any Ring 2 implementation that violates a Ring 0 invariant is invalid even if
its UI or tests claim success.

## 4. Canonical data and hashing

## 4.1 Canonical JSON profile `NEXUS-CJ-1`

`NEXUS-CJ-1` is
[RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
with a stricter Nexus value profile:

- input and output are valid UTF-8;
- object keys are restricted to printable ASCII protocol names;
- property ordering is RFC 8785 ordering over UTF-16 code units; the ASCII-key
  restriction makes this unambiguous for protocol objects;
- arrays retain declared order;
- every key and string value is already Unicode NFC;
- non-NFC input is rejected, never silently rewritten after signing;
- lone UTF-16 surrogates, malformed UTF-8, and other invalid Unicode reject;
- only `null`, booleans, strings, arrays, objects, and integers in
  `[-9007199254740991, 9007199254740991]` are admitted;
- floating point, exponent input, `NaN`, infinity, and negative zero reject;
- duplicate object keys reject before ordinary object construction;
- `undefined`, holes, accessors, prototypes, and omitted-versus-`undefined`
  representations are outside the canonical value model;
- serialization and string escaping follow RFC 8785/ECMAScript JSON
  serialization, including lowercase control escapes where required; solidus
  is not escaped;
- canonical bytes contain no BOM or insignificant whitespace.

All ingress paths, including fixture loaders, MUST pass the same strict parser
before an object can be signed or hashed. Internal constructors MUST construct
already-valid values; they do not normalize signed material. The first
prototype may limit executable ingress to pre-parsed in-memory fixtures only
if it labels this limitation and its tests prove the executable API cannot be
mistaken for a raw JSON parser.

Golden vectors MUST cover key ordering, escapes, NFC rejection, duplicate-key
rejection, lone-surrogate rejection, safe-integer edges, negative zero,
exponent input, and byte-for-byte hash stability.

## 4.2 Domain-separated hash

```text
H(domain, value) =
  SHA-256(
    UTF8(domain)
    || 0x00
    || UTF8(CANONICAL_JSON(value))
  )
```

Domains MUST be fixed protocol constants. Reusing one domain for two semantic
types is forbidden. A schema explicitly defined as a generic tagged envelope
is one semantic type and MUST include its registered `object_type` tag.

Required domains and ID prefixes:

```text
NEXUS_STATE_V1
NEXUS_STABLE_ID_V1
NEXUS_NATURAL_KEY_V1
NEXUS_RECORD_V1
NEXUS_EVENT_V1
NEXUS_AUTHENTICATED_EVENT_V2
NEXUS_EVENT_AUTH_PREIMAGE_V2
NEXUS_RECEIPT_V2
NEXUS_RECEIPT_CHAIN_V2
NEXUS_SEMANTIC_RECEIPT_ID_V1
NEXUS_SEMANTIC_RECEIPT_CHAIN_V1
NEXUS_ACCOUNT_V1
NEXUS_PRINCIPAL_V1
NEXUS_CONTROLLER_V1
NEXUS_KEY_V1
NEXUS_SEAT_V1
NEXUS_PROJECT_V1
NEXUS_JOB_V1
NEXUS_CONTRACT_V1
NEXUS_CAPABILITY_OFFER_V1
NEXUS_CAPABILITY_OFFER_CONTENT_V1
NEXUS_CAPABILITY_OFFER_ID_V2
NEXUS_CAPABILITY_OFFER_V2
NEXUS_DONATED_CAPACITY_CONSENT_ID_V2
NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2
NEXUS_CONTRIBUTION_V1
NEXUS_FUNDING_LOT_V1
NEXUS_BID_ROUND_V1
NEXUS_BID_V1
NEXUS_BID_COMMIT_V1
NEXUS_BID_REVEAL_V1
NEXUS_CAPABILITY_V1
NEXUS_ALLOWANCE_V1
NEXUS_SUBWORK_COMMITMENT_V1
NEXUS_PAYOUT_V1
NEXUS_TASK_V1
NEXUS_LEASE_V1
NEXUS_WORK_PACKET_V1
NEXUS_ARTIFACT_MANIFEST_V1
NEXUS_CHECK_RESULT_V1
NEXUS_REVIEW_PACKET_V1
NEXUS_REVIEW_ASSIGNMENT_V1
NEXUS_MODEL_REVIEW_V1
NEXUS_CLEARANCE_ROOT_V1
NEXUS_HOLD_ROOT_V1
NEXUS_DECISION_V1
NEXUS_APPEAL_V1
NEXUS_SETTLEMENT_V1
NEXUS_PUBLICATION_INTENT_V1
NEXUS_PUBLIC_CAPSULE_V1
NEXUS_DISCLOSURE_MANIFEST_V1
NEXUS_NON_CLAIMS_V1
```

The domain registry is append-only within a protocol version and maps
`(operation, object_type)` pairs. Mutable identity/revision operations use the
tagged `NEXUS_STABLE_ID_V1` and `NEXUS_RECORD_V1` envelopes defined below;
immutable bodies use their concrete domains. A linter MUST reject duplicate
domain values, missing object-type tags, or an operation using any other
domain.

## 4.3 IDs

IDs are uppercase type prefixes plus the full SHA-256 digest:

```text
ACCOUNT-<hex>
PRINCIPAL-<hex>
CTRL-<hex>
KEY-<hex>
SEAT-<hex>
PROJECT-<hex>
JOB-<hex>
EVT-<hex>
RCPT-<hex>
OFFER-<hex>
CONTRIB-<hex>
LOT-<hex>
ROUND-<hex>
BID-<hex>
ALLOW-<hex>
SUBWORK-<hex>
PAYOUT-<hex>
TASK-<hex>
LEASE-<hex>
CHECK-<hex>
PACKET-<hex>
ASSIGN-<hex>
REVIEW-<hex>
HOLD-<hex>
DECISION-<hex>
APPEAL-<hex>
SETTLE-<hex>
PUBINTENT-<hex>
```

Display truncation is UI-only. Canonical state uses full digests.

There are two ID classes.

### Stable record IDs

Mutable records use a stable creation identity:

```text
stable_id_root =
  H(
    "NEXUS_STABLE_ID_V1",
    {
      schema: "nexus-stable-id-v1",
      object_type,
      parent_ids,
      natural_key_root,
      creator_principal_id,
      creation_predecessor_root,
      creation_tick,
      creation_nonce
    }
  )

record_id = registered_type_prefix || stable_id_root
```

`parent_ids` is a canonical sorted list; every nullable field is explicit.
`natural_key_root` is recomputed, not trusted from input:

```text
H(
  "NEXUS_NATURAL_KEY_V1",
  {
    schema: "nexus-natural-key-v1",
    object_type,
    registered_immutable_identity_fields
  }
)
```

It commits only the type-specific immutable identity fields.
`creation_nonce` MUST be unique for the creator/object type and is consumed by
the creating event; duplicate stable IDs reject rather than overwrite.
The following records use this class because their state can change:
accounts, principals, controllers, keys, seats, projects, jobs, contributions,
funding lots, bid rounds, bids, allowances, sub-work commitments, payouts,
tasks, leases, review assignments, and appeals.

Every mutable record also contains:

```json
{
  "record_revision": 0,
  "previous_record_root": null,
  "record_root": "..."
}
```

where:

```text
record_root =
  H(
    "NEXUS_RECORD_V1",
    {
      schema: "nexus-record-v1",
      object_type,
      record_id,
      record_revision,
      record_body_without_record_root_or_raw_auth_signatures
    }
  )
```

Raw authentication means transport authentication and signature bytes. A
schema-required `nexus-verified-hybrid-auth-reference-v1` is canonical record
content, not raw authentication, and MUST remain in every ID or root preimage
whose schema includes it. Pre-authentication terms/body roots remain auth-free;
they are not accepted carrier IDs or roots.

Creation uses revision zero and `previous_record_root: null`. Every mutation
keeps the stable ID, increments `record_revision` by exactly one, sets
`previous_record_root` to the former root, and recomputes `record_root`.
`job.version` remains the contract/draft version and is independent from
`record_revision`. Receipts preserve the before/after record roots. A stable
ID is never re-derived from mutable amount, balance, bucket, status,
controller, or deadline fields.

Every concrete mutable schema MUST register its exact immutable
`natural_key_root` fields. The prototype linter and golden vectors cover at
least:

| Record | Immutable natural-key fields |
|---|---|
| account | initial kind and genesis allocation slot |
| principal/controller/key/seat | registry slot and parent principal/controller |
| project | repository proposal identity and creation nonce; control status is mutable |
| job | project, requester, and job creation nonce |
| contribution | job version, sponsor principal/account, and contribution nonce |
| funding lot | source contribution, split parent, creation predecessor/event nonce, and split index |
| bid round/bid | job version/round, bidder seat, and creation nonce |
| allowance/commitment/payout | job, source parent, recipient/purpose, and creation nonce |
| task/lease/assignment/appeal | job, parent object, slot/attempt, and creation nonce |

### Immutable content IDs

Immutable values—including events, receipts, offers, contracts, bid reveals,
work returns, manifests, checks, review packets, model reviews, clearance/hold
outcomes, decisions, settlements, disclosure manifests, public capsules,
non-claims, and publication intents—use:

```text
body_root =
  H(type_domain, canonical_body_without_own_id_raw_auth_signatures_or_cached_root)
object_id = registered_type_prefix || body_root
```

No object hashes its own ID. Parent IDs, logical tick, creator principal,
nonce, policy root, and natural-key fields remain inside immutable bodies.
Raw signature bytes are excluded. The exact six-field verified authentication
reference is not excluded from capability-offer or donated-consent carrier
bodies: it is committed to both their ID preimages and carrier-root preimages.
Their pre-authentication terms/body roots remain auth-free under V1 domains and
MUST NOT be used as accepted carrier identities.

For events:

```text
event_body_root =
  H("NEXUS_EVENT_V1", event_without_event_id_and_auth)
event_id = "EVT-" || event_body_root
```

Authentication signs `event_body_root` plus the explicit controller/policy
bindings below. This exact root includes the full payload and therefore the
complete nested donated-consent authentication, when present.

Semantic event identity uses a separate event-type-discriminated projection:

```text
semantic_event_body = event_without_event_id_and_top_level_auth
if event_type == ACCEPT_DONATED_CAPACITY_CONSENT:
  semantic_event_body.payload.authentication =
    verifiedHybridAuthenticationReference(
      event.payload.authentication
    )
semantic_event_body_root =
  H("NEXUS_EVENT_V1", semantic_event_body)
semantic_event_id = "EVT-" || semantic_event_body_root
semantic_event_root =
  H(
    "NEXUS_EVENT_SEMANTIC_V2",
    {
      schema: "nexus-event-semantic-v2",
      event_id: semantic_event_id,
      event_body_root: semantic_event_body_root
    }
  )
```

For every other current event type the semantic and exact event bodies are the
same. The exception is exact by event type and path; implementations MUST NOT
recursively omit fields named `authentication`. No other nested full-auth path
exists among the 55 current event types.

A canonical receipt has schema `nexus-receipt-v2` and exact fields:

```text
schema, receipt_id, semantic_receipt_id, semantic_receipt_root, sequence,
event_id, event_type, actor_id, job_id, predecessor_root, next_state_root,
semantic_event_root, authenticated_event_root, effects_root, result_root,
invariants_root, logical_tick, previous_receipt_root,
previous_semantic_receipt_root
```

`receipt_id` uses `NEXUS_RECEIPT_V2` over the exact V2 receipt body without
`receipt_id`. The authenticated receipt-chain root uses
`NEXUS_RECEIPT_CHAIN_V2` over the full receipt and links through
`previous_receipt_root`. Because `authenticated_event_root` commits the exact
submitted hybrid event, these values include every inner and outer signature
byte string and may differ across independently randomized valid
re-signatures.

`semantic_receipt_id` is `SRCPT-` plus the
`NEXUS_SEMANTIC_RECEIPT_ID_V1` hash of the complete
`nexus-semantic-receipt-v1` projection. Its exact keys are:

```text
schema, receipt_schema, sequence, event_id, event_type, actor_id, job_id,
predecessor_root, next_state_root, semantic_event_root, effects_root,
result_root, invariants_root, logical_tick, previous_semantic_receipt_root
```

`receipt_schema` is `nexus-receipt-v2`. The
`NEXUS_SEMANTIC_RECEIPT_ID_V1` domain is external to the preimage, not a
projection key. The projection excludes only authentication-dependent
evidence. `semantic_receipt_root` uses `NEXUS_SEMANTIC_RECEIPT_CHAIN_V1` and
`previous_semantic_receipt_root` forms its deterministic chain.

Canonical application state and downstream terminal references MUST use only
`semantic_receipt_id`; they MUST NOT import authenticated receipt identity or
chain evidence into the application-state projection. Implementations MUST
publish one golden stable-ID preimage, mutable record-root transition, and
immutable ID for every registered type.

## 4.4 Signature adapter

The executable prototype accepts only the mandatory
`HYBRID_ED25519_ML_DSA_65_V1` profile in
[`HYBRID_IDENTITY_PROFILE.md`](HYBRID_IDENTITY_PROFILE.md). Ed25519 AND
ML-DSA-65 MUST verify over one identical canonical domain-separated message.
`SIM_AUTH_UNSAFE`, single-signature, either/or, unknown-scheme, and legacy
fallback profiles MUST reject.

Canonical event authentication is:

```json
{
  "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
  "key_id": "HYBRIDKEY-...",
  "controller_id": "CTRL-...",
  "signed_domain": "NEXUS_EVENT_AUTH_V2",
  "signed_payload_root": "...",
  "ed25519_signature_base64url": "...",
  "ml_dsa_65_signature_base64url": "..."
}
```

`ACCEPT_DONATED_CAPACITY_CONSENT` is the only current event with a nested full
authentication object, at `payload.authentication`. It MUST use the same exact
seven-field mandatory-AND shape with signed domain
`NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2`. Ingress MUST reject missing or extra
fields and MUST reject a caller-supplied six-field
`nexus-verified-hybrid-auth-reference-v1`.

The signed payload is:

```json
{
  "schema": "nexus-event-auth-preimage-v2",
  "event_body_root": "...",
  "event_type": "...",
  "actor_id": "...",
  "controller_id": "CTRL-...",
  "expected_predecessor_root": "...",
  "authority_root": "...",
  "tick": 0,
  "nonce": "...",
  "idempotency_key": "...",
  "payload_root": "...",
  "policy_root": "..."
}
```

`signed_payload_root = H("NEXUS_EVENT_AUTH_PREIMAGE_V2", auth_preimage)`.
Both algorithms sign `canonicalBytes()` of the exact
`nexus-hybrid-auth-signed-message-v2` defined by the hybrid profile. ML-DSA-65
uses fixed ASCII context `NEXUS_HYBRID_AUTH_ML_DSA_65_CONTEXT_V1`.
`event_body_root` and `payload_root` in this preimage are exact roots over the
full submitted payload, including the complete nested authentication. The outer
mandatory-AND signature MUST NOT use the semantic projection.

The controller registry MUST bind both canonical SPKI-DER public keys and their
derived hybrid key ID to controller, scope, activation predecessor, and
`ACTIVE|ROTATED|REVOKED` state. Rotation replaces both keys atomically.

Receipts and idempotency bind the type-discriminated semantic event root
defined above. Only top-level authentication is generally excluded; only the
one nested donated-consent path is replaced by its exact six-field verified
reference. New and duplicate donated-consent paths MUST cryptographically
verify the complete nested Ed25519 AND ML-DSA-65 authentication before trusting
that projection. Duplicate verification MUST use the originally accepted
controller snapshot. The journal, `authenticated_event_root`, and authenticated
receipt MUST preserve the exact originally accepted inner and outer bytes.

## 5. Global state

```json
{
  "schema": "nexus-flow-state-v1",
  "tick": 0,
  "supply": 10000,
  "principals": {},
  "controllers": {},
  "accounts": {},
  "capability_offers": {},
  "capability_offer_content_index": {},
  "revoked_offer_ids": {},
  "funding_lots": {},
  "jobs": {},
  "contributions": {},
  "bid_rounds": {},
  "bids": {},
  "allowances": {},
  "subwork_commitments": {},
  "payouts": {},
  "tasks": {},
  "leases": {},
  "review_assignments": {},
  "reviews": {},
  "decisions": {},
  "appeals": {},
  "idempotency": {},
  "publication_intents": {},
  "terminal_jobs": {}
}
```

The application-state root is
`H("NEXUS_STATE_V1", application_state_without_cached_root)`.

The ordered receipt/WAL journal is not a member of the application-state
projection. This prevents a receipt containing `next_state_root` from being
hashed into that same root. Maps are keyed by canonical IDs and serialized by
canonical key order. The journal separately commits to event body, previous
receipt root, predecessor application-state root, next application-state root,
and effects.

## 6. Accounts and conservation

## 6.1 Account

```json
{
  "account_id": "ACCOUNT-...",
  "controller_id": "CTRL-...",
  "kind": "PRINCIPAL|PROJECT_POOL|JOB|SYSTEM_GENESIS",
  "owner_principal_id": null,
  "owner_job_id": "JOB-...",
  "available": 0,
  "status": "ACTIVE|FROZEN|REVOKED|CLOSED"
}
```

Only `available` is immediately spendable. Every reserved unit is held by one
active funding lot in exactly one of the `CONTRIBUTION`, `BID`, `JOB`,
`ALLOWANCE`, or `PAYOUT` buckets.

Exactly one `JOB` account exists for each job and names that job in
`owner_job_id`; no other account may name it. Its `available` field remains
zero in v0 because source-tagged lots carry all reserved value. `CREATE_JOB`
atomically creates the job and its account under one predecessor; terminal
closure sets that account `CLOSED`. The account is an isolation/accounting
namespace, not a second balance bucket or proof of independent ownership.

## 6.2 Conservation equation

Every reserved unit outside an account is represented by one active
source-tagged funding lot:

```json
{
  "lot_id": "LOT-...",
  "source_contribution_id": "CONTRIB-...",
  "source_account_id": "ACCOUNT-...",
  "contribution_kind": "PLEDGE|DONATION_INTENT",
  "amount": 0,
  "bucket": "CONTRIBUTION|BID|JOB|ALLOWANCE|PAYOUT",
  "bucket_id": "...",
  "parent_lot_id": null,
  "status": "ACTIVE|CONSUMED"
}
```

For every accepted application state:

```text
sum(account.available)
+ sum(funding_lot.amount where status == ACTIVE)
= state.supply
```

An active lot has exactly one bucket and bucket owner. Records reference lot
IDs; they do not carry a second countable balance.

The prototype has one genesis supply event. No later mint or burn event exists.

Bucket ownership is state-dependent:

| Record | Counted amount |
|---|---|
| active account | `available` |
| contribution/bid/job/allowance/payout record | zero directly; references active lot IDs |
| active funding lot | lot `amount`, exactly once |
| consumed historical lot/record | zero; value moved to another lot or account |

Historical records retain their declared amount as metadata, but the
conservation function counts it only in the single bucket listed above.

Moving a whole lot changes its bucket and owner. Moving part of a lot reduces
the parent amount and creates a child lot whose `parent_lot_id` binds the
source. If the parent reaches zero it becomes `CONSUMED`.

Partial allocation uses
`PRO_RATA_LARGEST_REMAINDER_V1`: calculate exact shares with arbitrary-precision
integers, take each floor, then allocate remaining units by descending
fractional remainder and canonical lot ID. Output amounts MUST remain safe
integers. This same allocator is used for allowance reservation and payout
accrual.

## 6.3 Economic validation

Every amount MUST:

- be a JavaScript safe integer;
- be `>= 0`;
- use checked addition/subtraction and reject if any intermediate or total is
  not a safe integer;
- satisfy source availability before reservation;
- preserve supply after transition;
- remain owned by exactly one bucket;
- use explicit zero rather than omission when schema requires an amount.

Every active lot MUST have `amount > 0` and be referenced exactly once by the
record named by its `(bucket, bucket_id)`:

| Bucket | Required owner/reference |
|---|---|
| `CONTRIBUTION` | one current contribution's `funding_lot_ids` |
| `BID` | one selected bid's `funding_lot_ids` |
| `JOB` | one accepted job's `funding_lot_ids` |
| `ALLOWANCE` | one allowance's `funding_lot_ids` |
| `PAYOUT` | one pending payout's `funding_lot_ids` |

A record may retain consumed lot IDs as history, but only an active matching
lot contributes value. An active lot referenced by zero or multiple owners, a
bucket/owner mismatch, a missing source contribution/account, or a cycle in
`parent_lot_id` rejects the complete transition.

Every bucket move atomically removes the active lot ID from the former
owner's active list and adds it to the destination owner's active list.
Source provenance is recovered from `source_contribution_id`, not by keeping a
second active ownership reference.

## 7. Principal and controller lifecycle

A principal registers:

```json
{
  "principal_id": "PRINCIPAL-...",
  "controller_id": "CTRL-...",
  "display_alias": "orchard-sparrow",
  "declared_operator": "operator-a",
  "guardian_policy": null,
  "status": "ACTIVE"
}
```

Display aliases are pseudonyms only.

Controller rotation, recovery, revocation, and job/economic events MUST share
the same global predecessor order. A stale controller event cannot commit
after a newer controller event.

The first prototype MAY model lifecycle authority with fixture proofs. It MUST
not claim production recovery or custody.

## 7.1 Capability offer and local-trusted predicate

A canonical worker offer is:

```json
{
  "schema": "nexus-capability-offer-v1",
  "offer_id": "OFFER-...",
  "offer_content_root": "...",
  "principal_id": "PRINCIPAL-...",
  "worker_seat_id": "SEAT-...",
  "offer_mode": "PAID|DONATED_CAPACITY",
  "owner_consent_root": "...",
  "project_allowlist": ["PROJECT-..."],
  "job_allowlist": [],
  "model_id": "...",
  "provider_family": "UNKNOWN",
  "operator_id": "UNKNOWN",
  "route": "LOCAL|REMOTE",
  "data_classes": ["PUBLIC"],
  "tools": [],
  "runtimes": [],
  "egress_allowlist": [],
  "max_input_bytes": 0,
  "max_output_bytes": 0,
  "max_compute_units": 0,
  "max_active_leases": 0,
  "isolation_root": null,
  "trusted_worker_policy_root": null,
  "contribution_terms_allowlist": [],
  "attribution": "PUBLIC_ALIAS|HIDDEN_FROM_PUBLIC_DISPLAY|NONE",
  "probe_root": "...",
  "not_before_tick": 0,
  "expiry_tick": 0,
  "nonce": "...",
  "authentication": {
    "schema": "nexus-verified-hybrid-auth-reference-v1",
    "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
    "key_id": "HYBRIDKEY-...",
    "controller_id": "CTRL-...",
    "signed_domain": "NEXUS_EVENT_AUTH_V2",
    "signed_payload_root": "..."
  }
}
```

The `authentication` member is derived only after the complete top-level
`REGISTER_OFFER` authentication verifies. It has exactly the six fields shown;
missing or extra fields reject. The v1 carrier schema remains unchanged.
`offer_id` derives under `NEXUS_CAPABILITY_OFFER_ID_V2` over the exact
ID-excluded v1 carrier body containing the reference. The accepted carrier root
derives under `NEXUS_CAPABILITY_OFFER_V2` over the exact v1 carrier containing
the reference. Raw signature bytes never enter either preimage. The auth-free
offer terms/body root remains under its V1 domain and is distinct from the
accepted offer ID/root.

An accepted donated-capacity consent carrier has the same exact reference shape
derived from its verified nested authentication, with signed domain
`NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2`. Its v1 carrier schema remains
unchanged. Its ID derives under `NEXUS_DONATED_CAPACITY_CONSENT_ID_V2`, and its
root derives under `NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2`; both preimages
include the reference. Its auth-free consent body root remains under its V1
domain.

`offer_content_root` is core-derived and MUST NOT be supplied by
`REGISTER_OFFER`:

```text
offer_content_root = H(
  "NEXUS_CAPABILITY_OFFER_CONTENT_V1",
  exact semantic offer body
)
```

The exact semantic offer body includes `nonce` and excludes only `offer_id`,
`offer_content_root`, and `authentication`. The stored accepted offer includes
the derived content root, and both `NEXUS_CAPABILITY_OFFER_ID_V2` and
`NEXUS_CAPABILITY_OFFER_V2` commit it together with the verified authentication
reference. The auth-free offer terms root and probe root remain V1 inputs and
are not this content root.

Canonical state contains
`capability_offer_content_index: offer_content_root -> offer_id`.
`REGISTER_OFFER` MUST first honor exact committed-event replay. Otherwise an
occupied content root under a different event envelope or verified reference
MUST fail `ERR_ID_PREIMAGE` before mutation. Changing the offer `nonce` changes
the semantic body and content root, but the distinct registration MUST
independently satisfy authentication, authority, predecessor, policy, nonce,
and idempotency requirements.

Ring 0 invariants and recovery MUST recompute the index bidirectionally. Every
accepted offer has exactly one matching index entry, every index entry resolves
the matching accepted offer ID/content root, and missing, extra, crossed, or
tampered mappings reject.

An offer is eligible only while active, signed by its registered controller,
unrevoked, probe-current, and within all contract ceilings.

`DONATED_CAPACITY` means a zero-price volunteer worker offer. It delegates
only the declared seat and limits; it never transfers a provider account,
credential, API key, wallet, recovery secret, or principal authority. Its
controller may revoke future leases. A lease already accepted before
revocation follows the frozen contract's timeout/abort policy. The owner
consent root MUST bind project/job allowlists, public data route, compute and
concurrency ceilings, tools, egress, contribution terms, attribution, expiry,
revocation boundary, and the non-claim that volunteer work creates no future
credit, governance, reputation, or merge entitlement.

`local_trusted` is true only when:

1. `route == LOCAL`;
2. a contract-authorized human principal approved the exact
   `trusted_worker_policy_root`;
3. the contract, offer, lease, and return bind the same isolation root;
4. every required isolation, filesystem, egress, environment, secret, and
   disposal field is `ENFORCED`, never `UNKNOWN` or `UNENFORCED`;
5. the lease is active and unexpired;
6. the worker has no route outside the approved egress set;
7. the trust approval and evidence are receipted.

The local worker isolation profile in section 23 is mandatory for this
predicate. A local process that does not satisfy it remains `LOCAL_UNTRUSTED`.
Any required unknown field rejects the route with
`ERR_LOCAL_TRUST_UNPROVEN`; the job then enters `HOLD` through the explicit
hold transition in section 17.

## 8. Job and contract

## 8.1 Project and public queue

```json
{
  "project_id": "PROJECT-...",
  "repository": "owner/repository",
  "maintainer_principal_id": "PRINCIPAL-...",
  "project_pool_account_id": "ACCOUNT-...",
  "licence_policy_root": "...",
  "contribution_policy_root": "...",
  "maintainer_attestation_root": "...",
  "repository_control": {
    "status": "FIXTURE_SIMULATED|VERIFIED_PLATFORM_ATTESTATION|UNVERIFIED",
    "platform": "GITHUB|LOCAL_FIXTURE",
    "repository_identity": "owner/repository",
    "principal_id": "PRINCIPAL-...",
    "evidence_root": "...",
    "verified_tick": 0,
    "expiry_tick": 0
  },
  "queue_status": "ACTIVE|PAUSED|CLOSED"
}
```

Anyone with a registered principal may draft a `COMMUNITY_PROPOSAL`, but
`OPEN_JOB` requires the project's registered maintainer to sign the exact
repository, base commit, task, licence/contribution policy, draft contract,
and job version. A maintainer-posted job uses the same attestation. Funding,
donated capacity, model agreement, or requester identity cannot substitute for
that opt-in. Repository merge remains a later maintainer-only action outside
economic settlement.

V0 supports only `FIXTURE_SIMULATED` repository-control evidence and MUST
render `SIMULATED_MAINTAINER_BINDING`, never “verified upstream maintainer.”
`UNVERIFIED` proposals cannot enter `OPEN`, reserve contributions, receive
leases, or render as endorsed. `VERIFIED_PLATFORM_ATTESTATION` is reserved for
a later adapter that validates a protected platform identity/repository
control proof, expiry, and revocation independently of the claimant.

## 8.2 Job state

```text
DRAFT
OPEN
PENDING_ACCEPT
ACTIVE
REVIEW
HOLD
DISPUTED
SETTLED
CANCELLED
ABORTED
```

Terminal states are `SETTLED`, `CANCELLED`, and `ABORTED`.

## 8.3 Job record

```json
{
  "job_id": "JOB-...",
  "job_account_id": "ACCOUNT-...",
  "requester_principal_id": "PRINCIPAL-...",
  "project_id": "PROJECT-...",
  "maintainer_principal_id": "PRINCIPAL-...",
  "origin": "MAINTAINER_POSTED|COMMUNITY_PROPOSAL",
  "maintainer_attestation_root": null,
  "state": "DRAFT",
  "version": 1,
  "draft_contract": {},
  "accepted_contract_root": null,
  "candidate_contract_root": null,
  "selected_round_id": null,
  "selected_bid_id": null,
  "accepted_worker_seat": null,
  "attempt": 0,
  "funding_lot_ids": [],
  "payout_ids": [],
  "review_assignment_ids": [],
  "final_source_root": null,
  "final_artifact_root": null,
  "final_manifest_root": null,
  "deterministic_evidence_root": null,
  "review_packet_root": null,
  "clearance_root": null,
  "hold_root": null,
  "hold_deadline_tick": null,
  "appeal_close_tick": null,
  "active_appeal_id": null,
  "human_decision_root": null,
  "terminal_event_id": null
}
```

## 8.4 Contract

The accepted contract MUST bind:

```json
{
  "schema": "nexus-job-contract-v1",
  "job_id": "JOB-...",
  "job_version": 1,
  "project": {
    "repository": "owner/repository",
    "base_commit": "full-commit-sha",
    "maintainer_principal_id": "PRINCIPAL-..."
  },
  "task": {
    "title": "...",
    "spec_root": "...",
    "acceptance_root": "...",
    "source_root": "...",
    "context_root": "...",
    "maximum_artifact_bytes": 0
  },
  "privacy": {
    "data_class": "PUBLIC|REDACTED|PROPRIETARY|SECRET",
    "remote_execution": false,
    "public_export": "SANITIZED_ONLY"
  },
  "work": {
    "budget": 0,
    "deadline_tick": 0,
    "max_attempts": 0,
    "max_subworkers": 0,
    "max_subworker_budget": 0,
    "fixed_verification_cost": 0,
    "max_compute_units": 0
  },
  "authority_ceiling": {
    "allowed_worker_principal_ids": [],
    "allowed_worker_classes": ["REGISTERED"],
    "allowed_model_ids": [],
    "allowed_provider_families": [],
    "allowed_operator_ids": [],
    "allowed_tools": [],
    "allowed_runtimes": [],
    "allowed_routes": ["LOCAL"],
    "egress_allowlist": [],
    "maximum_data_class": "PUBLIC",
    "required_isolation_root": "...",
    "trusted_worker_policy_root": "...",
    "maximum_capability_root": "...",
    "publication_principal_ids": ["PRINCIPAL-..."],
    "redelegation_allowed": false
  },
  "review": {
    "required_reviews": 3,
    "distinct_model_ids": true,
    "worker_self_review": false,
    "required_diversity_dimensions": [],
    "material_dissent_policy": "HOLD"
  },
  "decision_authority": {
    "settlement_principal_ids": ["PRINCIPAL-..."],
    "review_transition_principal_ids": ["PRINCIPAL-..."],
    "timeout_executor_principal_ids": ["PRINCIPAL-..."],
    "required_decisions": 1,
    "delegation_allowed": false,
    "repository_merge_authority": "MAINTAINER_EXCLUSIVE"
  },
  "rights": {
    "allowed_licences": [],
    "notice_required": true,
    "upstream_pin_required": true,
    "provenance_declaration_required": true,
    "contribution_terms_root": "...",
    "attribution_policy_root": "...",
    "worker_acknowledgements_required": true
  },
  "settlement": {
    "lead_worker_amount_ceiling": 0,
    "reviewer_amount_each": 0,
    "verification_recipient_account_id": "ACCOUNT-...",
    "funding_consumption_policy": "PRO_RATA_LARGEST_REMAINDER_V1",
    "overfunding_policy": "REJECT",
    "requester_residue_policy": "REFUND",
    "donation_residue_policy": "PROJECT_POOL",
    "contribution_dispositions": {
      "PLEDGE": {
        "CANCELLED": "RETURN_SOURCE",
        "SETTLED_RESIDUE": "RETURN_SOURCE",
        "ABORTED_RESIDUE": "RETURN_SOURCE"
      },
      "DONATION_INTENT": {
        "CANCELLED": "RETURN_SOURCE",
        "SETTLED_RESIDUE": "PROJECT_POOL",
        "ABORTED_RESIDUE": "PROJECT_POOL"
      }
    },
    "timeout_policy_root": "...",
    "abort_policy_root": "..."
  },
  "appeal": {
    "eligible_roles": ["REQUESTER", "WORKER", "SPONSOR", "MAINTAINER"],
    "allowed_grounds": [],
    "filing_deadline_ticks": 0,
    "resolution_deadline_ticks": 0,
    "maximum_rounds": 1,
    "resolver_principal_ids": [],
    "resolver_must_not_be_party": true,
    "evidence_access": "DATA_CLASS_REDACTED",
    "payout_effect": "FREEZE_DISPUTED_ONLY",
    "unavailable_resolver_policy": "ABORT_CONTRACT",
    "anti_retaliation": true
  },
  "hold": {
    "resolution_timeout_ticks": 0,
    "timeout_outcome": "ABORT_CONTRACT"
  },
  "verifier_root": "...",
  "policy_root": "...",
  "award": null
}
```

The `DRAFT` contract has `award: null`. A bid reveal binds the exact draft
contract root. Selection constructs one candidate accepted contract with the
pure function:

```text
materialize_contract(draft, winning_bid) =
  draft with award = {
    round_id,
    bid_id,
    worker_principal_id,
    worker_seat_id,
    capability_offer_root,
    lead_worker_amount: winning_bid.price,
    funding_contribution_ids,
    role_bindings: {
      requester_principal_id,
      worker_principal_id,
      sponsor_principal_ids,
      maintainer_principal_id
    },
    eligible_appeal_principal_ids,
    party_principal_ids
  }
```

No other draft field changes. `candidate_contract_root` is
`H("NEXUS_CONTRACT_V1", materialized_contract)`. The selected worker signs and
accepts this exact root; its price MUST equal `award.lead_worker_amount`.
Contributors consent to the draft plus this mechanical materialization rule,
not to an open-ended contract mutation. At `ACCEPT_BID`, the candidate root
becomes `accepted_contract_root`; no field may mutate afterward.

`funding_contribution_ids`, sponsor IDs, role bindings, appeal-eligible IDs,
and party IDs are canonical sorted sets derived from the current job,
selected worker, maintainer, and exact selected contributions. The accepted
contract stores those sets inside immutable `award`; no later role inference
is permitted. Resolver IDs MUST be disjoint from
`award.party_principal_ids` when the non-party rule is enabled.

V0 requires `decision_authority.required_decisions == 1`. Multi-principal
quorum, revocation, and aggregate decision roots are deliberately unsupported;
any other value rejects with `ERR_DECISION_QUORUM_UNSUPPORTED`.

V0 also requires `review.required_reviews == 3`,
`distinct_model_ids == true`, `worker_self_review == false`, and
`material_dissent_policy == "HOLD"`. A different review quorum or majority
rule requires another protocol version.

Appeal durations are safe integers. `appeal.filing_deadline_ticks == 0`
means appeals are disabled and `FILE_APPEAL` always rejects. When filing is
enabled, `filing_deadline_ticks >= 1`,
`resolution_deadline_ticks >= 1`, and `maximum_rounds == 1` are mandatory at
contract creation and `ACCEPT_BID`. `hold.resolution_timeout_ticks` is always
at least one. These rules prevent an empty half-open resolution window.

Every task, lease, allowance, capability offer, route, sub-worker, model,
tool, runtime, egress destination, and isolation profile MUST be a set/range
subset of `authority_ceiling`. Unknown or incomparable capability dimensions
reject; they are never treated as a subset.

Contract creation rejects if `privacy.remote_execution == false` while
`authority_ceiling.allowed_routes` contains any route other than `LOCAL`.

## 9. Contributions

## 9.1 Contribution intent

```json
{
  "contribution_id": "CONTRIB-...",
  "job_id": "JOB-...",
  "job_version": 1,
  "draft_contract_root": "...",
  "contribution_disposition_root": "...",
  "disclosure_acknowledgement_root": "...",
  "sponsor_principal_id": "PRINCIPAL-...",
  "sponsor_account_id": "ACCOUNT-...",
  "kind": "PLEDGE|DONATION_INTENT",
  "amount": 0,
  "funding_lot_ids": ["LOT-..."],
  "attribution": "HIDDEN_FROM_PUBLIC_DISPLAY|PUBLIC_ALIAS|NONE",
  "status": "RESERVED|SELECTED_LOCK|REVOKED|LOCKED|ACCEPTED|RETURNED|PROJECT_POOL|CLOSED",
  "nonce": "...",
  "created_tick": 0
}
```

Before contract acceptance, both forms are reservations and the UI MUST call
the second one a **donation intent**, not a completed donation.

`HIDDEN_FROM_PUBLIC_DISPLAY` hides the alias from the public capsule only. The
simulator/operator may retain linkable account and event records; the Matrix
MUST disclose that limitation before contribution.

Reservation debits the source account once and creates source-tagged
`CONTRIBUTION` funding lots. V0 rejects a reservation that would make total
active contribution lots exceed the draft contract budget. `SELECT_BID`
requires the active contribution lots to equal that budget exactly; there is
no overfunding or ambiguous source subset.

At worker acceptance:

- pledges become contract funds and follow payout/refund rules;
- donation intents become accepted donations and follow the declared donation
  residue policy;
- the conversion is atomic with contract freeze;
- any insufficient or stale contribution causes the entire acceptance to
  reject.

## 9.2 Revocation

`REVOKE_CONTRIBUTION` is valid only while:

- job is `OPEN` or `PENDING_ACCEPT`;
- contract has not been accepted;
- contribution is `RESERVED`;
- contribution is not held by a selected-bid funding lock;
- requester/sponsor authority is valid;
- predecessor and nonce are current.

Any draft-contract mutation increments `job_version`, invalidates every bid,
returns every reserved/selected contribution lot to its source account, and
requires fresh contribution disclosure acknowledgement. Consent to one
contract/disposition root cannot fund another.

## 10. Bids

Each job version has at most one active canonical bid round:

```json
{
  "round_id": "ROUND-...",
  "job_id": "JOB-...",
  "job_version": 1,
  "draft_contract_root": "...",
  "open_tick": 0,
  "commit_close_tick": 0,
  "reveal_close_tick": 0,
  "acceptance_deadline_tick": 0,
  "status": "SCHEDULED|OPEN_COMMIT|OPEN_REVEAL|CLOSED|SELECTED|ACCEPTED|REVOKED|EXPIRED"
}
```

The bounds MUST satisfy
`open_tick < commit_close_tick < reveal_close_tick <
acceptance_deadline_tick`.

Each bid record includes:

```json
{
  "bid_id": "BID-...",
  "round_id": "ROUND-...",
  "job_id": "JOB-...",
  "job_version": 1,
  "draft_contract_root": "...",
  "bidder_principal_id": "PRINCIPAL-...",
  "worker_seat_id": "SEAT-...",
  "commitment": "...",
  "reveal_root": null,
  "status": "COMMITTED|REVEALED|SELECTED|ACCEPTED|REVOKED|EXPIRED|CLOSED",
  "funding_lot_ids": []
}
```

`funding_lot_ids` is empty until selection. Source sponsor, contribution kind,
and disposition remain on each referenced lot and contribution record.

## 10.1 Reveal payload

```json
{
  "schema": "nexus-bid-reveal-v1",
  "round_id": "ROUND-...",
  "job_id": "JOB-...",
  "job_version": 1,
  "draft_contract_root": "...",
  "bidder_principal_id": "PRINCIPAL-...",
  "worker_seat_id": "SEAT-...",
  "capability_offer_root": "...",
  "price": 0,
  "completion_ticks": 0,
  "model_id": "...",
  "provider_family": "UNKNOWN",
  "operator_id": "operator-a",
  "probe_root": "...",
  "nonce": "...",
  "salt": "at-least-128-bits"
}
```

## 10.2 Commitment

```text
commitment =
  H("NEXUS_BID_COMMIT_V1", reveal_payload)
```

The salt is inside the committed payload. A bid ID binds round, job version,
draft contract, bidder, worker seat, commitment, and nonce.

## 10.3 Logical clock and bid phases

```text
OPEN_COMMIT
OPEN_REVEAL
CLOSED
SELECTED
ACCEPTED
REVOKED
EXPIRED
```

The only time transition is `ADVANCE_TICK`, authorized by the registered
`CLOCK_ADVANCER` controller. It increments `state.tick` by exactly one; it
cannot skip, decrement, or accept a requested target. Event order is the
gapless receipt sequence.

At a current tick, ordinary events that commit before `ADVANCE_TICK` are
ordered before that advance. Once it commits, no event carrying the old tick
can pass predecessor and tick validation. Before computing the advance's next
root, the reducer applies every deterministic expiry and phase change whose
boundary is the new tick in canonical `(object_type_rank, object_id)` order.

Bid windows are half-open:

```text
commit:  open_tick <= state.tick < commit_close_tick
reveal:  commit_close_tick <= state.tick < reveal_close_tick
select:  reveal_close_tick <= state.tick < acceptance_deadline_tick
accept:  selection_tick <= state.tick < acceptance_deadline_tick
```

At `acceptance_deadline_tick`, an unaccepted selected bid expires
deterministically: its lots move from `BID` back to their originating
`CONTRIBUTION` buckets, contributions return to `RESERVED`, the bid and round
become `EXPIRED`, and the job returns to `OPEN` only if its draft version is
still current. Network arrival time never affects validity.

## 10.4 Eligibility

A reveal is eligible only when:

- commitment exists and is current;
- recomputed commitment matches;
- reveal is in-window;
- round, job version, and `draft_contract_root` all match;
- bidder/worker is active;
- privacy and remote-route policy permit it;
- capability and probe satisfy contract;
- a `DONATED_CAPACITY` offer bids price zero and matches its owner-consented
  project/job and contribution-term allowlists;
- price and completion ticks fit ceilings;
- bidder is not maintainer/reviewer where conflict policy forbids it;
- nonce, job version, policy root, and predecessor are current.

## 10.5 Selection

Eligible bids sort by:

1. `price` ascending;
2. `completion_ticks` ascending;
3. canonical `worker_seat_id`;
4. canonical bid reveal hash.

`SELECT_BID` atomically:

1. validates the deterministic winning eligible bid;
2. verifies selected price plus declared review/sub-work ceilings fit the job
   budget;
3. requires the canonical total of all active `CONTRIBUTION` lots for the
   current job/version to equal the draft contract budget exactly;
4. moves all those lots, ordered by lot ID, from `CONTRIBUTION` to `BID` with
   `bucket_id = bid_id` and records the same IDs on the bid;
5. marks their contribution records `SELECTED_LOCK`;
6. materializes the candidate accepted contract from the exact draft and bid;
7. requires the selected price not exceed
   `settlement.lead_worker_amount_ceiling`;
8. stores `candidate_contract_root`, selected round and bid, and sets the job
   `PENDING_ACCEPT`.

The requester may `UNSELECT_BID` before worker acceptance. The selected bidder
may `REVOKE_BID` before acceptance. Either action atomically returns each
active lot from `BID` to its original contribution's `CONTRIBUTION` bucket,
clears `candidate_contract_root`, and moves the job to `OPEN`.

`CANCEL_JOB` before acceptance returns every selected lock or reservation to
its source account under the declared pre-acceptance policy and terminally
marks the job `CANCELLED`.

Sponsors cannot revoke a contribution while it is `SELECTED_LOCK`; they wait
for unselection, revocation, or cancellation. This prevents a selected worker
from accepting an already underfunded bid.

`SELECT_BID`, `REVOKE_BID`, `UNSELECT_BID`, and `CANCEL_JOB` consume one
current predecessor. Tests MUST exercise every conflicting pair in both
arrival orders.

## 11. Worker acceptance

`ACCEPT_BID` atomically:

1. verifies selected bid and worker authority;
2. requires the worker's event authentication to bind the exact
   `candidate_contract_root`;
3. requires current tick to be inside the acceptance window;
4. verifies every selected funding lot and its source contribution;
5. verifies the lot total equals the accepted budget exactly;
6. verifies the accepted contract is exactly
   `materialize_contract(bound_draft, selected_bid)`;
7. moves every selected lot from `BID` to `JOB` with `bucket_id = job_id` and
   records the same IDs on `job.funding_lot_ids`;
8. freezes the accepted contract root;
9. marks contributions `LOCKED` or `ACCEPTED`;
10. marks bid and round `ACCEPTED`;
11. moves job to `ACTIVE`;
12. creates the lead task;
13. appends one acceptance receipt.

Failure at any step has no effect.

The acceptance validator MUST prove:

```text
award.lead_worker_amount
+ required_reviews * reviewer_amount_each
+ max_subworker_budget
+ fixed_verification_cost
<= accepted budget
```

For an accepted job:

```text
mandatory_job_reserve =
  unaccrued award.lead_worker_amount
  + unaccrued funded review slots * reviewer_amount_each
  + unaccrued fixed_verification_cost
```

Every transition that moves value out of `JOB` for optional sub-work MUST
leave active `JOB` lots at least equal to this reserve. Accruing one named
mandatory payout lowers its matching obligation and moves exactly that amount
to `PAYOUT` in the same transition. Thus a funded review assignment is backed
by an executable floor, not an unbacked promise.

`unaccrued funded review slots` is
`required_reviews - valid_review_payouts_created`; expiry or replacement of an
assignment does not lower it.

V0 has no bidder stake or worker bond. Only requester/sponsor budget units are
locked by bid selection.

After this transition, requester `CANCEL_JOB` MUST reject with
`ERR_CONTRACT_ALREADY_ACCEPTED`.

## 12. Agent allowance

## 12.1 Schema

```json
{
  "allowance_id": "ALLOW-...",
  "issuer_principal_id": "PRINCIPAL-...",
  "agent_seat_id": "SEAT-...",
  "job_id": "JOB-...",
  "purpose": "SUBWORK|PROBE|REVIEW|BUILD",
  "amount_ceiling": 0,
  "funding_lot_ids": ["LOT-..."],
  "subwork_commitment_ids": [],
  "recipient_class": "REGISTERED_SUBWORKER",
  "not_before_tick": 0,
  "expiry_tick": 0,
  "nonce": "...",
  "policy_root": "...",
  "redelegation": false,
  "status": "ACTIVE|EXHAUSTED|REVOKED|EXPIRED|CLOSED"
}
```

`remaining_uncommitted` is derived, never stored independently: it is the sum
of active `ALLOWANCE` lots referenced by the allowance that are not bound to
an active sub-work commitment.

## 12.2 Issue

`ISSUE_ALLOWANCE` requires an immutable-contract-authorized principal, an
`ACTIVE` job, a positive safe-integer amount within the contract's sub-worker
budget, a valid tick window, a permitted agent seat/recipient class/purpose,
and no re-delegation. The allocator in section 6.2 splits or moves exactly that
amount from active `JOB` lots to `ALLOWANCE`, changes their `bucket_id` to the
new allowance ID, and records the resulting lot IDs. It cannot allocate a unit
already in another allowance or payout, exceed the aggregate sub-worker
ceiling, or reduce `JOB` lots below `mandatory_job_reserve`.

## 12.3 Authorize sub-work

`AUTHORIZE_SUBWORK` creates:

```json
{
  "subwork_commitment_id": "SUBWORK-...",
  "allowance_id": "ALLOW-...",
  "job_id": "JOB-...",
  "task_id": "TASK-...",
  "recipient_seat_id": "SEAT-...",
  "amount": 0,
  "funding_lot_ids": ["LOT-..."],
  "evidence_requirement_root": "...",
  "created_tick": 0,
  "expiry_tick": 0,
  "status": "AUTHORIZED|ACCRUED|RELEASED|EXPIRED|CLOSED"
}
```

The transition MUST bind:

- allowance;
- exact task and permitted purpose;
- recipient class and seat;
- amount;
- current tick;
- unique nonce;
- current policy and predecessor roots.

It succeeds only while the allowance is `ACTIVE` and
`not_before_tick <= state.tick < expiry_tick`, the recipient/task/capability
is within both allowance and contract, amount does not exceed derived
`remaining_uncommitted`, and the recipient is not allowed to re-delegate. It
binds the selected allowance lot IDs to the commitment but leaves them in the
`ALLOWANCE` bucket. Authorization alone never earns or pays value.

## 12.4 Revoke/expire

Revoking or expiring moves only uncommitted active `ALLOWANCE` lots back to
`JOB`. A commitment with unresolved authorized work follows the immutable
timeout/abort policy; it is not silently paid or clawed back. A result and
expiry at the same tick are ordered by receipt predecessor: a result accepted
before `ADVANCE_TICK` may accrue; the expiry applied by the tick transition
wins against every later old-tick result.

Re-delegation is denied in v0.

## 12.5 Payout accrual

A pending payout record is:

```json
{
  "payout_id": "PAYOUT-...",
  "job_id": "JOB-...",
  "recipient_account_id": "ACCOUNT-...",
  "kind": "LEAD_WORK|SUBWORK|REVIEW|VERIFICATION",
  "amount": 0,
  "funding_lot_ids": ["LOT-..."],
  "evidence_root": "...",
  "source_record_id": "...",
  "status": "PENDING|PAID|CANCELLED"
}
```

Value may enter `PAYOUT` only through a named accrual transition:

- `ACCEPT_LEAD_RETURN` atomically validates the exact lead return and performs
  `ACCRUE_LEAD_PAYOUT`, moving `award.lead_worker_amount` from `JOB` lots;
- `ACCEPT_SUBWORK_RETURN` atomically validates an `AUTHORIZED` commitment and
  exact task result satisfying `evidence_requirement_root` under the
  contract-authorized accepting principal, then performs
  `ACCRUE_SUBWORK_PAYOUT`, moves that commitment's `ALLOWANCE` lots to
  `PAYOUT`, and marks the commitment `ACCRUED`;
- `ACCEPT_ASSIGNED_REVIEW` atomically validates and records one current funded
  assignment return **and** performs `ACCRUE_REVIEW_PAYOUT`, moving
  `reviewer_amount_each` from `JOB` lots regardless of `CLEAR`, `DISSENT`, or
  `HOLD`; no canonical `VALID` review state exists without its pending payout.
- `ACCEPT_DETERMINISTIC_EVIDENCE` atomically records the complete valid
  evidence root and performs `ACCRUE_VERIFICATION_PAYOUT`, moving
  `fixed_verification_cost` from `JOB` lots to the immutable
  `verification_recipient_account_id`.

An invalid, stale, replayed, self, duplicate-model, or packet-mismatched review
does not accrue payment. Paying a valid assigned dissent avoids an agreement
incentive. Review recording and payout accrual either both commit or neither
does. Each source record can create at most one payout; payout and source IDs
bind the exact evidence root and make accrual idempotent. Terminal settlement
consumes each active `PAYOUT` lot exactly once into its recipient's `available`
balance.

After all valid accruals, every remaining active `JOB` or returned
`ALLOWANCE` lot is residue. Settlement routes each lot independently from its
source contribution metadata: `PLEDGE` residue returns to
`source_account_id`; accepted `DONATION_INTENT` residue moves to the
contract-declared project-pool account. Canonical lot-ID order and the
pro-rata allocator make source consumption and residue deterministic.

## 13. Work tasks and leases

## 13.1 Task

```json
{
  "task_id": "TASK-...",
  "job_id": "JOB-...",
  "attempt": 1,
  "kind": "LEAD|IMPLEMENT|TEST|SECURITY|PROVENANCE|PACKAGE",
  "phase_rank": 0,
  "priority": 0,
  "dependencies": [],
  "context_root": "...",
  "input_manifest_root": "...",
  "output_schema_root": "...",
  "data_class": "PUBLIC",
  "required_capabilities": [],
  "earliest_tick": 0,
  "deadline_tick": 0,
  "max_compute_units": 0,
  "max_input_bytes": 0,
  "max_output_bytes": 0,
  "concurrency_group": "...",
  "conflict_set": [],
  "review_requirement": "NONE|DETERMINISTIC|MODEL_TRIAD",
  "terminal_behavior": "RETRY|HOLD|ABORT",
  "status": "WAITING|READY|LEASED|RETURNED|ACCEPTED|REJECTED|EXPIRED|CANCELLED|CLOSED"
}
```

`phase_rank`, `priority`, concurrency, review, and terminal behavior are
immutable contract-derived data. Lower numeric rank and priority run first.
The scheduler cannot infer or rewrite them with model output.

## 13.2 Lease

```json
{
  "lease_id": "LEASE-...",
  "job_id": "JOB-...",
  "task_id": "TASK-...",
  "attempt": 1,
  "worker_seat_id": "SEAT-...",
  "context_root": "...",
  "input_manifest_root": "...",
  "not_before_tick": 0,
  "expiry_tick": 0,
  "nonce": "...",
  "policy_root": "...",
  "status": "ACTIVE|RETURNED|ACCEPTED|REJECTED|EXPIRED|REVOKED|CLOSED"
}
```

A lease binds:

- task, job, attempt, worker seat;
- exact context and input roots;
- allowed tools/actions;
- data class and egress policy;
- compute/byte budget;
- start/expiry tick;
- nonce and policy root.

A child lease is never broader than its parent allowance and contract.

## 13.3 Work return

```json
{
  "schema": "nexus-work-return-v1",
  "task_id": "TASK-...",
  "job_id": "JOB-...",
  "attempt": 1,
  "worker_seat_id": "SEAT-...",
  "lease_root": "...",
  "source_root": "...",
  "artifact_root": "...",
  "manifest_root": "...",
  "contribution_terms_root": "...",
  "worker_acknowledgement_root": "...",
  "attribution_record_root": "...",
  "observations": [],
  "commands_root": "...",
  "nonce": "..."
}
```

A return with any stale binding rejects. Exact replay is idempotent. Changed
bytes under the same return/event ID reject.

Lead and sub-worker returns MUST bind the accepted contribution terms and an
attribution record classified for public or private disclosure. Missing,
changed, or unacknowledged terms reject before review.

## 13.4 Enter review

`ENTER_REVIEW` is the only normal `ACTIVE -> REVIEW` transition. Its actor
MUST be listed in immutable
`decision_authority.review_transition_principal_ids`; that authority permits
packet finalization, not clearance or settlement.

The event MUST bind current job, attempt, accepted contract, final lead return,
source, artifact, manifest, deterministic evidence, rubric, policy,
predecessor, tick, and proposed review-packet root. It succeeds only when:

1. the job is `ACTIVE`, within its deadline, and has no due hold/abort;
2. the final lead task and every contract-required dependency are `ACCEPTED`;
3. every accepted lead/sub-work/evidence result committed atomically with its
   pending payout;
4. no required task, lease, allowance commitment, or work return is live or
   unresolved;
5. artifact paths, bytes, source/base, rights, privacy, provenance, and every
   required deterministic check are current and valid;
6. the roots and attempt match the accepted immutable contract;
7. a canonical section-16 review packet recomputes to the proposed packet
   root;
8. no current review or assignment already exists for that packet/attempt.

One commit stores the final source/artifact/manifest/evidence/packet roots,
sets the job to `REVIEW`, and creates no review verdict. `ASSIGN_REVIEWERS`
then creates exactly the funded slots for that packet.

`ENTER_REVIEW`, a final work return, task expiry, and `ADVANCE_TICK` each
consume one predecessor. If review entry commits before a deadline advance it
wins; if the advance first expires required work or creates a hold, the stale
review-entry event rejects. There is no partially finalized review state.

## 14. Deterministic scheduler

## 14.1 Ready set

A task is ready when:

- every dependency is `ACCEPTED`;
- job is `ACTIVE`;
- task is within its tick window;
- attempts/budget remain;
- its data route is supported;
- no conflict-set lease is active;
- an eligible worker exists.

## 14.2 Ordering

Ready tasks sort by:

1. `phase_rank` ascending;
2. `priority` ascending;
3. `deadline_tick` ascending;
4. `max_compute_units` ascending;
5. `task_id` ascending;
6. `attempt` ascending.

The exact tuple is versioned in policy. Security/provenance-before-synthesis
is expressed with lower declared `phase_rank`, never as a hidden second
ordering rule.

## 14.3 Staggering

The scheduler SHOULD:

- run schema/hash/secret/licence checks before model calls;
- run cheap bounded reviewers before frontier synthesis;
- parallelize only independent tasks;
- delay redundant expensive runs until a candidate survives cheap gates;
- cap global and per-job concurrency;
- preserve deterministic scheduling decisions in receipts.

External execution latency is an observation. Simulation ordering uses logical
ticks and explicit return events.

## 14.4 Retry

Retries:

- increment attempt;
- create a new lease and nonce;
- keep prior evidence;
- never overwrite a return;
- stop at `max_attempts`;
- enter `HOLD` when exhausted.

## 15. Artifact and provenance

## 15.1 Artifact manifest

```json
{
  "schema": "nexus-artifact-manifest-v1",
  "job_id": "JOB-...",
  "attempt": 1,
  "base_commit": "...",
  "worker_head": "...",
  "files": [
    {
      "path": "relative/safe/path",
      "sha256": "...",
      "bytes": 0,
      "media_type": "text/plain",
      "publication_class": "PUBLIC|PRIVATE_COMMITMENT_ONLY"
    }
  ],
  "dependencies_root": "...",
  "licence_root": "...",
  "notice_root": "...",
  "upstream_root": "...",
  "commands_root": "...",
  "environment_root": "..."
}
```

Paths MUST be normalized relative paths with no absolute path, `..`, NUL,
ambiguous separator, or duplicate normalized destination.

## 15.2 Deterministic checks

Each check result binds:

```json
{
  "check_id": "CHECK-...",
  "verifier_root": "...",
  "policy_root": "...",
  "artifact_root": "...",
  "command": ["literal", "argv"],
  "environment_root": "...",
  "exit_code": 0,
  "stdout_root": "...",
  "stderr_root": "...",
  "reason_codes": [],
  "status": "PASS|FAIL|ERROR|TIMEOUT"
}
```

Shell interpolation is not canonical evidence. Commands are literal argument
arrays. Sensitive output is hashed/stored privately and excluded from public
capsules.

Any required status other than `PASS` blocks clearance.

## 16. Review gate

## 16.1 Funded review assignments

Before accepting any review, `ASSIGN_REVIEWERS` MUST create exactly
`contract.review.required_reviews` funded slots:

```json
{
  "review_assignment_id": "ASSIGN-...",
  "job_id": "JOB-...",
  "slot": 0,
  "attempt": 1,
  "packet_root": "PACKET-...",
  "reviewer_seat_id": "SEAT-...",
  "model_id": "...",
  "capability_offer_root": "...",
  "amount": 0,
  "not_before_tick": 0,
  "expiry_tick": 0,
  "status": "ASSIGNED|RETURNED|VALID|EXPIRED|REPLACED|CLOSED",
  "replacement_of": null
}
```

Assignment uses a deterministic eligible-seat ordering under the conflict and
diversity policy. The worker, a duplicate seat, and a duplicate model ID are
ineligible. Exactly one live assignment exists per slot. Only its assigned
seat/model may return a review for that slot.

An expired assignment receives no payout and may be replaced by the next
eligible seat in the same deterministic ordering. The replacement keeps the
same slot and declared amount, increments `attempt`, and binds the same current
packet root. Replaced/late reviews reject. Extra unsolicited reviews may be
stored outside canonical state as comments but cannot satisfy clearance or
accrue payment. This caps funded review payouts at exactly the number declared
in the accepted contract.

## 16.2 Review packet

```json
{
  "schema": "nexus-review-packet-v1",
  "job_id": "JOB-...",
  "contract_root": "...",
  "artifact_root": "...",
  "source_root": "...",
  "manifest_root": "...",
  "deterministic_evidence_root": "...",
  "rubric_root": "...",
  "policy_root": "...",
  "questions": [],
  "max_compute_units": 0,
  "expiry_tick": 0
}
```

All three reviewers receive the same packet root.

## 16.3 Model review

```json
{
  "schema": "nexus-model-review-v1",
  "review_id": "REVIEW-...",
  "review_assignment_id": "ASSIGN-...",
  "reviewer_seat_id": "SEAT-...",
  "model_id": "...",
  "provider_family": "UNKNOWN",
  "operator_id": "UNKNOWN",
  "prompt_lineage_root": "...",
  "toolchain_root": "...",
  "machine_declaration": "UNKNOWN",
  "verifier_implementation": "...",
  "packet_root": "...",
  "verdict": "CLEAR|DISSENT|HOLD",
  "severity": "NONE|LOW|MEDIUM|HIGH|CRITICAL",
  "findings": [],
  "claims": [],
  "evidence_refs": [],
  "limitations": [],
  "nonce": "..."
}
```

Each diversity dimension is canonical:

```json
{
  "dimension": "MODEL|PROVIDER|OPERATOR|PROMPT_LINEAGE|TOOLCHAIN|MACHINE|VERIFIER",
  "value": "...",
  "evidence_class": "VERIFIED|DECLARED|UNKNOWN|CONFLICTED",
  "evidence_root": null,
  "relationship": "DISTINCT|SHARED|UNKNOWN|CONFLICTED"
}
```

`VERIFIED` means only that a declared verification method established the
registered value under its own limits. It does not prove institutional
independence. `UNKNOWN`, `SHARED`, and `CONFLICTED` MUST NOT render as
independent. A composite `INDEPENDENT` label is forbidden in v0; the Matrix
shows each dimension and may display `CORRELATED_REVIEW` when any required
dimension is shared or unknown.

## 16.4 Clearance

`COMPUTE_CLEARANCE` succeeds only when:

- job is `REVIEW`;
- all required deterministic checks pass;
- exactly the policy-required number of valid reviews exists;
- each valid review consumes one distinct current funded assignment slot;
- reviewer seats and model IDs are distinct;
- worker seat does not appear as reviewer;
- every review packet root is identical and current;
- required diversity declarations are present;
- no required dimension falsely claims independence;
- every verdict is `CLEAR`;
- no material finding is unresolved;
- no review is expired or replayed.

The clearance root is:

```text
H(
  "NEXUS_CLEARANCE_ROOT_V1",
  {
    packet_root,
    ordered_review_hashes,
    diversity_vector,
    deterministic_evidence_root,
    policy_root
  }
)
```

Ordering is canonical reviewer seat ID, not arrival order.

Any artifact rework clears `final_artifact_root`, `clearance_root`, and all
active review validity, closes current assignments, and requires a fresh
packet plus fresh assignments.

## 16.5 Hold outcome

When a deterministic red, valid dissent, missing required diversity, exhausted
attempt, unsupported privacy route, or other policy-defined blocker prevents
clearance, the reducer creates:

```text
hold_root =
  H(
    "NEXUS_HOLD_ROOT_V1",
    {
      job_id,
      contract_root,
      attempt,
      artifact_root,
      packet_root,
      ordered_review_hashes,
      deterministic_evidence_root,
      ordered_reason_codes,
      policy_root
    }
  )
```

Nullable fields are explicit `null`; arrays use canonical ordering. The same
inputs always produce the same hold. A model cannot choose the reason-code
set: structural validators and versioned policy derive it.

`COMPUTE_REVIEW_OUTCOME` is one pure transition over the current packet and
complete assignment set. It writes exactly one of `clearance_root` or
`hold_root`, never both. A failed outcome moves `REVIEW` to `HOLD`. Non-review
failures enter `HOLD` through the same root schema with `packet_root`,
`artifact_root`, or review hashes set to `null`/empty as appropriate.

Entering `HOLD` also sets
`hold_deadline_tick = current_tick + hold.resolution_timeout_ticks` with
checked integer arithmetic; the timeout MUST be positive. If the hold is not
resolved when an `ADVANCE_TICK` reaches that boundary, the reducer marks the
predeclared `ABORT_JOB` timeout transition mandatory. No later tick advance is
accepted until a listed `timeout_executor_principal_id` submits that exact
abort against the current hold/predecessor. The executor cannot choose payout
or disposition bytes: the frozen contract and active lots derive them.

Once due, every other mutating event scoped to that job—including rework,
resume, appeal, allowance, task, or payout changes—rejects with
`ERR_HOLD_TIMEOUT_ABORT_REQUIRED`; only exact replay and the timeout abort may
proceed.

This gives valid dissent a bounded payment delay in logical time:
`ABORT_JOB` pays every undisputed accrued review payout before residue routing.
An external operator can still halt the simulator and therefore halt logical
time; v0 discloses that liveness limit and does not claim wall-clock payment.

## 17. Human/maintainer decision

```json
{
  "decision_id": "DECISION-...",
  "job_id": "JOB-...",
  "decision_principal_id": "PRINCIPAL-...",
  "decision_authority_root": "...",
  "contract_root": "...",
  "artifact_root": "...",
  "clearance_root": null,
  "hold_root": "HOLD-...",
  "decision_tick": 0,
  "appeal_close_tick": 0,
  "decision": "ACCEPT|REJECT|REWORK|RESUME_REVIEW|ABORT",
  "reason_codes": [],
  "nonce": "..."
}
```

Exactly one of `clearance_root` and `hold_root` MUST be non-null.

`decision_tick` equals the accepting state's current tick.
`appeal_close_tick` is the checked sum of `decision_tick` and the accepted
contract's `appeal.filing_deadline_ticks`; it is stored both in the immutable
decision and current job record. The filing window is
`decision_tick <= state.tick < appeal_close_tick`.

The decision principal MUST be authorized by the immutable
`decision_authority` policy. Job-settlement authority may be assigned to a
contract-bound human principal, but repository merge authority remains
maintainer-exclusive. Delegation or revocation after worker acceptance cannot
rewrite the frozen decision policy.

`ACCEPT` does not make model review independent or code legally safe. It
records scoped project authority.

Allowed state movement is:

| Current | Bound evidence | Decision/event | Result |
|---|---|---|---|
| `REVIEW` | current clearance | `ACCEPT` | records acceptance; remains `REVIEW` until settlement |
| `REVIEW` | current clearance | `REJECT` | creates a decision-bound hold and moves to `HOLD` |
| `HOLD` | current hold | `REWORK` | increments job attempt, invalidates artifact/reviews/assignments, clears hold/deadline, moves to `ACTIVE` |
| `HOLD` | current hold | `RESUME_REVIEW` | only if the same artifact remains and the non-artifact hold cause is deterministically resolved; clears hold/deadline and moves to `REVIEW` |
| `HOLD` | current hold | `ABORT` | authorizes atomic `ABORT_JOB` |
| `DISPUTED` | current appeal resolution | `REWORK|ABORT` | follows the resolver result and immutable appeal policy |

`ACCEPT` MUST reject without a current clearance root. `REWORK`,
`RESUME_REVIEW`, and `ABORT` MUST reject without the current hold/appeal
binding. Rework clears the old human decision root, appeal-close tick, and any
closed appeal reference. No path treats three model votes as authority to
accept, merge, or settle.

## 17.1 Appeal and dispute

```json
{
  "appeal_id": "APPEAL-...",
  "job_id": "JOB-...",
  "round": 1,
  "appellant_principal_id": "PRINCIPAL-...",
  "claimed_role": "REQUESTER|WORKER|SPONSOR|MAINTAINER",
  "ground": "...",
  "decision_root": "...",
  "filed_tick": 0,
  "appeal_close_tick": 0,
  "resolution_close_tick": 0,
  "disputed_payout_ids": [],
  "evidence_packet_root": "...",
  "resolver_principal_id": null,
  "resolution_root": null,
  "status": "FILED|RESOLVED|ABORT_DUE|CLOSED"
}
```

`FILE_APPEAL` is valid only:

- when `filing_deadline_ticks >= 1`; zero means disabled;
- when the actor appears in immutable
  `accepted_contract.award.eligible_appeal_principal_ids` and its claimed role
  matches `award.role_bindings`;
- on a listed ground;
- before terminal settlement and within the logical filing window;
- under the current job, contract, evidence, decision, and predecessor roots;
- while the maximum appeal rounds are not exhausted.

It requires `state.tick < job.appeal_close_tick`, copies that absolute anchor,
sets `filed_tick = state.tick`, computes
`resolution_close_tick = filed_tick +
appeal.resolution_deadline_ticks` with checked arithmetic, moves the job to
`DISPUTED`, stores `active_appeal_id`, clears any prior hold deadline while the
appeal clock governs, freezes only payouts named by the dispute, and creates a
data-class-redacted evidence packet. A second active appeal rejects.
Undisputed valid reviewer work does not become forfeit because another party
appealed the artifact outcome.

The resolver:

- MUST be listed in the accepted contract;
- MUST NOT appear in immutable `award.party_principal_ids` when
  `resolver_must_not_be_party` is true;
- receives only the evidence allowed by data class and role;
- MUST disclose operator/provider relationships;
- emits `UPHOLD|REWORK|ABORT|INVALID_PAYOUT` with evidence and reason codes.

`RESOLVE_APPEAL` is valid only in the half-open window
`filed_tick <= state.tick < resolution_close_tick` and returns the job to
`REVIEW`, `ACTIVE`, `HOLD`, or an authorized abort path, closes/clears the
active appeal, and if it returns to `HOLD` computes a fresh hold deadline from
the resolution tick. If no eligible resolver
exists, the job remains `HOLD` with
`ERR_APPEAL_RESOLVER_UNAVAILABLE`; the operator cannot silently self-appoint.
When `ADVANCE_TICK` reaches the frozen resolution deadline, it marks that
appeal `ABORT_DUE`. V0 permits only `ABORT_CONTRACT`: further job mutation and
tick advance reject until a listed timeout executor submits the exact
contract-derived abort, which pays undisputed valid accrued work/review and
applies the contribution-disposition table.

Filing an appeal MUST NOT reduce an undisputed earned payout, attribution, data
access right, or future unrelated eligibility. Post-terminal correction cannot
rewrite history; it requires a separately receipted restitution/correction
event under a later specification.

## 18. Terminal settlement

## 18.1 Preconditions

`SETTLE_JOB` requires:

- job state `REVIEW`;
- current contract, artifact, evidence, clearance, and human decision roots;
- human decision `ACCEPT`;
- no open required task;
- no unresolved hold;
- no open appeal and either `state.tick >= job.appeal_close_tick` or every
  principal in immutable `award.eligible_appeal_principal_ids` filed one
  distinct, current, signed waiver against the exact decision and
  `appeal_close_tick`;
- exact payout/refund vector matching contract;
- all active allowances closable;
- conservation before and after;
- `terminal_event_id` is null, no `terminal_jobs[job_id]` entry exists, and
  the committed journal has no prior terminal receipt for the job.

`ABORT_JOB` requires an accepted contract; job state `ACTIVE`, `REVIEW`,
`HOLD`, or `DISPUTED`; and exactly one current contract-authorized human
abort decision, appeal resolution, exhausted-attempt policy, hold timeout, or
appeal timeout root. It also requires the complete accrued-payout/residue
vector and the same terminal uniqueness/conservation checks. A timeout
executor authenticates delivery of a predeclared outcome; it cannot invent an
abort ground.

## 18.2 Common terminal closure

All three terminal events call the same pure
`close_job_children(job_id, terminal_kind)` routine after constructing their
economic transfer vector. It enumerates canonical maps in fixed type rank and
ID order and terminalizes every child whose `job_id` matches:

```text
bid round
bid
contribution
allowance
sub-work commitment
task
lease
review assignment
appeal
payout
job account
```

Each mutable child record receives its type's terminal
`CLOSED|RETURNED|PROJECT_POOL|PAID|CANCELLED|EXPIRED` status, next
`record_revision`, and previous/current record roots. Immutable returns,
checks, reviews, decisions, and receipts remain historical evidence and have
no live status.

The closure validates:

- no live child status remains for the job;
- no active funding lot names the job or any child as bucket owner;
- every payout is `PAID` or explicitly `CANCELLED` under the terminal policy;
- every selected/open round and bid is closed;
- every lease, task, allowance, commitment, assignment, and appeal is
  terminal;
- the unique job account is `CLOSED` with `available == 0`;
- the closure ID/root list is complete and canonically ordered.

It returns a canonical closure root to the terminal event. After setting the
terminal job state and terminal event ID, the caller writes that root and job
into `terminal_jobs` in the same candidate-state commit. Afterward every
job-scoped mutating event rejects `ERR_ALREADY_TERMINAL`; only exact replay,
`CREATE_PUBLICATION_INTENT`, and `RECORD_PUBLICATION_WITNESS` are allowed, and
the latter two cannot mutate the terminal job or economics. `ADVANCE_TICK`
ignores terminal child records.

```json
{
  "job_id": "JOB-...",
  "terminal_kind": "SETTLED|ABORTED|CANCELLED",
  "terminal_event_id": "EVT-...",
  "settlement_root": "...",
  "closure_root": "...",
  "terminal_tick": 0
}
```

## 18.3 Atomic effects

One commit:

1. resolves commitments under the frozen policy and moves every unused
   `ALLOWANCE` lot back to `JOB`;
2. consumes each active `PAYOUT` lot and adds its amount once to the bound
   recipient account's `available`;
3. consumes each remaining `JOB` pledge lot and adds it once to its
   `source_account_id`;
4. consumes each remaining accepted-donation `JOB` lot and adds it once to the
   declared project-pool account;
5. invokes `close_job_children(job_id, "SETTLED")`;
6. requires that no active lot remains owned by the terminal job;
7. sets job `SETTLED`;
8. writes the terminal settlement record and `terminal_event_id`;
9. writes the job/closure root into `terminal_jobs`;
10. computes one next application-state root.

The reducer constructs this complete transfer vector in canonical lot-ID order
before mutating the candidate state. It rejects if any lot source,
contribution kind, destination, payout evidence, or amount is missing. No
implementation chooses a residue source or destination heuristically.

`ABORT_JOB` pays every undisputed valid accrued review/work payout, applies the
contract's contribution-disposition table to each remaining unit, records the
appeal, human-decision, or immutable hold-timeout root that authorized abort,
invokes `close_job_children(job_id, "ABORTED")`, and sets `ABORTED`. It uses
the same no-live-child/no-active-lot postcondition as settlement.

Contribution outcomes are therefore:

| Condition | Pledge | Donation intent / accepted donation |
|---|---|---|
| revoked before selected lock | return source | return source; never became donation |
| cancelled before acceptance | return source | return source; never became donation |
| `HOLD`, `REWORK`, or active appeal | remain locked under deadline | remain locked under deadline |
| settled residue | return source | move to declared project pool |
| aborted residue after acceptance | return source after valid accrued payouts | move to declared project pool after valid accrued payouts |
| GitHub publication retry/failure | no economic change | no economic change |

This exact table, amounts, project-pool destination, deadlines, and appeal
route MUST be shown and confirmed before a contribution reservation.

`CANCEL_JOB` is the third terminal-settlement event. It is valid only before
worker acceptance and atomically:

1. returns every `RESERVED` contribution and selected-bid funding lot to its
   source account by consuming the active lot and crediting that account once;
2. invokes `close_job_children(job_id, "CANCELLED")`, including the active bid
   round, leases, assignments, and appeals if malformed fixtures introduced
   any;
3. requires no active lot remains owned by the cancelled job/version;
4. writes a zero-payout cancellation settlement record;
5. sets job `CANCELLED` and records `terminal_event_id`;
6. writes the job/closure root into `terminal_jobs`;
7. computes one next application-state root.

`SETTLE_JOB`, `ABORT_JOB`, and `CANCEL_JOB` all produce an external terminal
receipt through the generic journal algorithm. After that receipt exists, a
separate idempotent `CREATE_PUBLICATION_INTENT` event may add a canonical
publication intent that references the already committed terminal event and
receipt. Publication is never part of terminal economic atomicity.

There is no durable `SETTLING`.

## 18.4 Idempotency

Exact replay of a committed terminal event returns its original receipt and
state root. Changed terminal bytes under the same event or idempotency key
reject.

## 19. Event envelope and transition algorithm

## 19.1 Event

```json
{
  "schema": "nexus-event-v1",
  "event_id": "EVT-...",
  "event_type": "...",
  "actor_id": "...",
  "authority_root": "...",
  "policy_root": "...",
  "expected_predecessor_root": "...",
  "tick": 0,
  "nonce": "...",
  "idempotency_key": "...",
  "payload": {},
  "auth": {}
}
```

## 19.2 Transition

```text
apply_event(current_state, raw_event):
  parse strict canonical ingress
  validate schema and size
  require exact seven-field top-level hybrid authentication
  if event_type == ACCEPT_DONATED_CAPACITY_CONSENT:
      require exact seven-field payload.authentication
      reject a six-field verified-auth reference at that ingress path
  canonicalize event
  derive exact event_body_root excluding event_id and top-level auth
      but including the exact full payload and nested authentication
  require event_id == "EVT-" || event_body_root
  derive semantic_event_body by the one explicit event-type/path rule
  derive semantic_event_body_root, semantic_event_id, and semantic_event_root
  authenticated_event_root =
      H("NEXUS_AUTHENTICATED_EVENT_V2", entire_canonical_event)

  lookup event_id and idempotency_key in verified committed-journal index
  if the replay identifiers resolve to the same committed semantic_event_root:
      verify full outer hybrid authentication against the originally accepted
          controller snapshot
      if event_type == ACCEPT_DONATED_CAPACITY_CONSENT:
          verify full nested hybrid authentication against the originally
              accepted controller snapshot
      return original historical receipt without mutating current state
  if either identifier is committed with different semantic content:
      reject ERR_IDEMPOTENCY_CONFLICT

  require auth.signed_payload_root == hash(canonical auth preimage)
  require auth preimage binds event body, actor, controller, authority,
          policy, predecessor, tick, nonce, idempotency key, and payload
  verify allowlisted scheme, active registered key, scope, and signature
  if event_type == ACCEPT_DONATED_CAPACITY_CONSENT:
      verify the nested authentication under
          NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2
      derive its six-field verified-hybrid-auth reference only after both
          signatures verify

  require expected_predecessor_root == state_root(current_state)
  require event.tick == current_state.tick
  require actor active
  require authority valid for event type
  require nonce unused in domain

  candidate_application_state = deep_clone(current_application_state)
  if event_type == ADVANCE_TICK:
      require CLOCK_ADVANCER authority
      checked_increment candidate_application_state.tick by exactly one
      apply all boundary expiries/phase changes in canonical order
  else:
      apply pure event-specific transition(candidate_application_state)
  record nonce, exact event body root, and semantic event root
      in candidate_application_state idempotency map
  validate every Ring 0 invariant(candidate_application_state)
  next_root = H("NEXUS_STATE_V1", candidate_application_state)

  receipt = canonical accepted receipt(
      event hash,
      next journal sequence,
      current journal head,
      predecessor root,
      next root,
      effects,
      invariant results
  )
  derive receipt_id from receipt_without_receipt_id_and_auth

  append prepared WAL frame containing event, application delta, and receipt
  fsync prepared frame
  append and fsync commit marker for exact frame hash
  expose candidate application state and new journal head
  return receipt
```

The committed-journal replay index is rebuilt and verified during recovery;
an uncommitted PREPARE frame cannot satisfy replay. Semantic replay
intentionally precedes current key/activity/policy/predecessor checks: the event
already passed those checks at its historical predecessor. Replay and recovery
reverify full outer authentication and, for the one donated-consent path, full
nested authentication against the controller/key registry snapshot
reconstructed at that predecessor. Rotation or revocation affects new events
only. A changed valid randomized signature may be semantically equivalent only
through the top-level exclusion or explicit donated-consent projection; invalid
cryptography or changed projected content rejects.

Rejection constructs a non-authoritative diagnostic from the original state.
It does not append to the accepted receipt/WAL chain unless a separate
diagnostic journal explicitly records rejections outside canonical state.

## 20. Receipt

```json
{
  "schema": "nexus-receipt-v2",
  "receipt_id": "RCPT-...",
  "sequence": 1,
  "event_id": "EVT-...",
  "event_type": "...",
  "actor_id": "...",
  "job_id": "JOB-...",
  "predecessor_root": "...",
  "next_state_root": "...",
  "semantic_event_root": "...",
  "authenticated_event_root": "...",
  "effects_root": "...",
  "invariants_root": "...",
  "logical_tick": 0,
  "previous_receipt_root": "..."
}
```

`semantic_event_root` commits the type-discriminated projection: top-level
authentication is excluded, and only
`ACCEPT_DONATED_CAPACITY_CONSENT.payload.authentication` is replaced by its
verified six-field reference. `authenticated_event_root` commits the exact
submitted hybrid-authenticated event including complete inner and outer
signatures. Recovery MUST match both roots and MUST reject an alternate valid
re-signature paired with the original receipt.

Receipt sequence is local and gapless. Wall-clock timestamps may appear in
non-canonical diagnostics only. Receipts form the committed WAL/journal and are
excluded from the application-state root they report.

## 21. Privacy router

## 21.1 Decision

```text
route(task, worker):
  if contract.privacy.remote_execution == false and worker.route != LOCAL:
      REJECT ERR_REMOTE_EXECUTION_FORBIDDEN
  if data_class == SECRET and worker.local_trusted != true:
      REJECT ERR_SECRET_REMOTE
  if data_class == PROPRIETARY and worker.local_trusted != true:
      HOLD ERR_PROPRIETARY_LOCAL_ONLY
  if data_class == REDACTED:
      require redaction_manifest and approved reduced root
  if contract requires TEE:
      HOLD ERR_TEE_UNSUPPORTED
  require capability, egress, destination, byte, spend, and expiry policy
  return bounded work packet
```

## 21.2 Public disclosure manifest

Every export classifies each field/file:

```json
{
  "schema": "nexus-disclosure-manifest-v1",
  "job_id": "JOB-...",
  "public_fields": [],
  "commitment_only_fields": [],
  "omitted_fields": [],
  "low_entropy_hashes_omitted": [],
  "secret_scan_root": "...",
  "human_publication_approval_root": "..."
}
```

Public export fails closed if any item lacks a classification.

Classification is transitive. For every root proposed for publication, the
disclosure compiler MUST walk or otherwise prove the complete committed
structure is public-safe. A root that commits to a private filename, source,
prompt, identity, business fact, low-entropy value, internal state root, or
other omitted material MUST NOT be published merely because the root itself
looks opaque.

Such a root is either:

- omitted;
- replaced by a separately constructed public-safe summary root; or
- committed with a high-entropy one-time salt retained outside the public
  capsule when a membership oracle is still acceptable under explicit policy.

The public manifest records the public-safe replacement and keeps the
internal-to-public mapping local. Export rejects with
`ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE` if that proof is incomplete.

For a non-public job, `public_job_id` is derived from a fresh high-entropy
export nonce and public-safe summary, not from the internal job ID. The private
mapping remains local and access-controlled. This reduces direct linkage but
does not create anonymity.

## 22. Iframe and Matrix contract

The Matrix is read-only with respect to canonical state. It submits typed
candidate commands to the control plane.

Every embedded block MUST:

- use a separate origin for untrusted content;
- declare a minimal iframe sandbox token set;
- avoid the unsafe same-origin/script combination for untrusted same-origin
  documents;
- use exact `postMessage` target origins;
- validate source window, origin, schema, version, audience, nonce, replay, and
  byte size;
- receive no provider, GitHub, wallet, signer, or recovery secret;
- have no ambient parent DOM or storage capability;
- render canonical receipt IDs for every state claim.

Default untrusted-block policy:

| Surface | Default |
|---|---|
| iframe `sandbox` | `allow-scripts` only when script is required; otherwise empty |
| `allow-same-origin` | forbidden for untrusted scripted content |
| top navigation | forbidden |
| popups / popup escape | forbidden |
| downloads | forbidden |
| forms | forbidden unless one exact block contract requires them |
| pointer/device/sensor/clipboard | forbidden by Permissions-Policy |
| referrer | `no-referrer` |
| credentials/cookies | omitted; credentialless or separate-origin session |
| CSP `default-src` | `'none'` |
| CSP `script-src` | pinned self/hash only; no eval |
| CSP `connect-src` | exact declared broker origin or `'none'` |
| CSP `frame-src` / `child-src` | exact declared child origins or `'none'` |
| storage | no parent-origin storage; ephemeral block storage only |

Any relaxation is a versioned per-block capability and requires a regression
test. Tests MUST cover wrong target origin, wrong source window, replay,
oversize, unexpected schema/version, top navigation, popup, download, form,
storage, and wildcard messaging.

Before each consequential action, the Matrix MUST render and bind a
`disclosure_acknowledgement_root` into the submitted event:

| Action | Required pre-action disclosure |
|---|---|
| pledge/donation intent | `SIM_CREDIT_ONLY`, exact disposition table, lock/revocation point, project-pool destination, attribution visibility, linkability limit, appeal route |
| bid commit/reveal | exact selection rule, exposed metadata, data class, probe limits, no fair-market/model-proof claim |
| worker acceptance | immutable contract, end of unilateral requester cancellation, payout/abort/appeal terms, source/privacy route, contribution and attribution terms |
| agent allowance | job, purpose, amount, recipient class, expiry, re-delegation status, future-action revocation limit |
| human/maintainer decision | scoped settlement authority versus maintainer-exclusive merge authority, review correlation, open dissent |
| public export | every included/omitted class, transitive public roots, linkability, canonical non-claims |

The acknowledgement proves only that specified text/root was presented and an
authorized actor submitted the action. It does not prove comprehension or
voluntary consent under coercion.

Suggested blocks:

```text
job-summary
funding-and-locks
bid-round
worker-graph
capability-label
evidence-timeline
review-triad
settlement
public-capsule
```

The first static walkthrough MAY use same-page components rather than actual
iframes. It MUST label this as a UI simulation and preserve the future origin
contract.

## 23. Worker isolation profile

Every adapter SHOULD declare the following profile. A worker counted as
`local_trusted` MUST declare it and MUST satisfy every contract-required field:

```json
{
  "isolation": "PROCESS|CONTAINER|VM",
  "image_root": "...",
  "unix_user": "...",
  "read_only_root": true,
  "input_mounts": [],
  "scratch_mount": "...",
  "output_mount": "...",
  "namespaces": ["user", "mount", "pid", "ipc", "network"],
  "cgroup": {
    "cpu": "...",
    "memory_bytes": 0,
    "pids": 0,
    "io": "..."
  },
  "seccomp_root": "...",
  "mac_policy_root": "...",
  "egress_allowlist": [],
  "environment_allowlist": [],
  "ambient_secrets": "NONE",
  "disposable": true,
  "enforcement": {
    "filesystem": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."},
    "network": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."},
    "resources": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."},
    "syscalls": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."},
    "environment": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."},
    "disposal": {"status": "ENFORCED|UNENFORCED|UNKNOWN", "evidence_root": "..."}
  },
  "approved_by_principal_id": "PRINCIPAL-...",
  "approval_expiry_tick": 0
}
```

Unsupported fields remain `UNENFORCED`, not silently green.

## 24. GitHub witness capsule

## 24.1 Pre-merge `FINAL.json`

```json
{
  "schema": "nexus-public-capsule-v1",
  "status_authority": "NONE",
  "economic_class": "SIM_CREDIT_ONLY",
  "public_job_id": "PUBLIC-JOB-...",
  "public_contract_root": "...",
  "public_repository_witness": null,
  "public_receipt_summary_root": "...",
  "public_artifact_manifest_root": "...",
  "public_deterministic_evidence_root": "...",
  "public_review_root": "...",
  "public_diversity_labels": [],
  "public_human_decision_root": "...",
  "public_settlement_summary_root": "...",
  "verifier_root": "...",
  "policy_root": "...",
  "disclosure_manifest_root": "...",
  "non_claims_root": "..."
}
```

The capsule root is `H("NEXUS_PUBLIC_CAPSULE_V1", FINAL.json)`.

Every field prefixed `public_` is separately constructed from material cleared
by the transitive disclosure compiler in section 21.2. Internal contract,
receipt, artifact, evidence, decision, settlement, and pre/post state roots are
not copied into the public capsule. For a fully public job, a public-safe root
may equal its internal counterpart only after transitive classification. A
local private mapping receipt binds internal and public forms for authorized
auditors.

`public_repository_witness` is present only when repository, base commit,
worker head, paths, and contribution metadata are all public. Otherwise it is
`null`; a hash of private repository metadata is not substituted.

`FINAL.json` MUST NOT try to contain the squash commit that contains
`FINAL.json`; that would be self-referential. A trusted post-merge check or
artifact attestation separately binds the capsule digest to the resulting
mainline commit.

## 24.2 CI

Untrusted PR CI:

- `contents: read`;
- no secrets;
- no write token;
- no deploy/publish/OIDC;
- no shared self-hosted runner for hostile public code;
- verifier from protected main/control source;
- exact required check source/name;
- path, schema, size, replay, root, test, privacy, and rights checks.

The required check evidence MUST bind:

```json
{
  "verifier_source_repository": "owner/control-repository",
  "verifier_source_commit": "full-sha",
  "workflow_ref": "owner/repository/.github/workflows/file.yml@ref",
  "workflow_sha": "full-sha-or-content-digest",
  "check_app_id": 0,
  "check_name": "nexus-capsule-verify",
  "runner_class": "GITHUB_HOSTED",
  "expected_verifier_root": "...",
  "computed_verifier_root": "...",
  "expected_policy_root": "...",
  "computed_policy_root": "..."
}
```

Any mismatch rejects with `ERR_VERIFIER_MUTATION`. A check name without the
expected GitHub App/source identity is insufficient.

Protected post-merge CI:

- recomputes capsule root from main;
- binds repository, workflow, event, commit, and artifact digest;
- emits provenance/attestation;
- contains no claim that provenance equals safety.

## 24.3 Publication intent and operational outbox

A subsequent event writes one immutable canonical publication intent:

```json
{
  "intent_id": "PUBINTENT-...",
  "job_id": "JOB-...",
  "terminal_event_id": "EVT-...",
  "terminal_receipt_id": "RCPT-...",
  "capsule_root": "...",
  "disclosure_manifest_root": "...",
  "non_claims_root": "...",
  "destination_policy": "github-witness",
  "nonce": "..."
}
```

More precisely, terminal settlement creates no intent directly.
`CREATE_PUBLICATION_INTENT` is a subsequent event authorized by the contract's
publication principal after the terminal receipt and disclosure result exist.
It binds job, terminal event, terminal receipt, public capsule, disclosure,
non-claims, destination policy, nonce, idempotency key, and current
predecessor. It has no economic effect.

Delivery attempts and network outcomes live in a separate operational journal
that is not part of the Nexus Sim state root:

```json
{
  "intent_id": "PUBINTENT-...",
  "attempt": 0,
  "status": "PENDING|PUBLISHED|FAILED_RETRYABLE|FAILED_TERMINAL",
  "last_reason_code": null
}
```

The operational publisher cannot mutate balances, jobs, contracts, or
settlement. GitHub outage changes only this delivery journal and never the
canonical state root.

After publication, an optional `RECORD_PUBLICATION_WITNESS` event may record a
validated public URL/check/attestation digest. It consumes the current
predecessor, is idempotent, and has no economic or terminal-state side effect.

## 24.4 Canonical non-claims

`non_claims_root` is:

```text
H(
  "NEXUS_NON_CLAIMS_V1",
  {
    schema: "nexus-non-claims-v1",
    claims_not_made: [
      "REAL_VALUE",
      "ANONYMITY_OR_UNLINKABILITY",
      "FAIR_MARKET_OR_SYBIL_RESISTANCE",
      "REMOTE_MODEL_OR_HARDWARE_PROOF",
      "REMOTE_DELETION",
      "INDEPENDENT_REVIEW_FROM_MODEL_COUNT",
      "PRODUCTION_CUSTODY_CONSENSUS_OR_FINALITY",
      "LEGAL_OR_LICENCE_CORRECTNESS",
      "SECURITY_FROM_COMPROMISED_HOST",
      "NEXUS_LAB_ACCEPTANCE"
    ],
    source_document_root: "..."
  }
)
```

The Matrix and public-capsule verifier MUST compare this root to the expected
version and render the non-claims from canonical data, not optional marketing
copy.

## 25. Persistence and crash model

The committed write-ahead journal is authority. Snapshots are replaceable
caches.

For each event:

1. append one checksummed `PREPARE` frame containing predecessor root, event,
   application delta/next state, receipt, and frame hash;
2. fsync the journal;
3. append a `COMMIT` marker naming that exact frame hash;
4. fsync the journal;
5. expose the next in-memory application state and receipt.

A frame without a durable matching commit marker has no effect.

Snapshots use immutable numbered generations:

1. write `snapshot-<sequence>.tmp` with application state, state root, journal
   sequence, and journal-head root;
2. fsync and rename it to immutable `snapshot-<sequence>`;
3. fsync the snapshot directory;
4. write and fsync a temporary manifest naming that generation;
5. atomically replace the small manifest pointer and fsync its directory.

Old snapshot generations remain until a later verified cleanup. A crash before
the manifest swap uses the old generation plus committed WAL; a crash after
the swap uses the new generation plus any later committed WAL. The required
property is old-or-new, never a hybrid.

On restart:

- choose the manifest-named snapshot only if its root and journal head verify,
  otherwise fall back to the newest older valid generation;
- verify receipt chain, frame checksums, and PREPARE/COMMIT pairing;
- ignore or quarantine every uncommitted tail frame;
- replay committed WAL after the trusted snapshot;
- compare replay root;
- quarantine gaps, partial frames, mismatches, and unknown files;
- derive/retry operational delivery from immutable publication intents and the
  separate delivery journal.

## 26. Stable reason codes

Minimum codes:

```text
ERR_SCHEMA
ERR_NON_CANONICAL
ERR_DUPLICATE_KEY
ERR_INVALID_UNICODE
ERR_UNSAFE_INTEGER
ERR_SIZE_LIMIT
ERR_DOMAIN_REGISTRY
ERR_ID_PREIMAGE
ERR_RECORD_REVISION
ERR_AUTHORITY
ERR_CLOCK_AUTHORITY
ERR_CAPABILITY
ERR_AUDIENCE
ERR_POLICY_ROOT
ERR_PREDECESSOR
ERR_TICK
ERR_TICK_STEP
ERR_NONCE_REPLAY
ERR_IDEMPOTENCY_CONFLICT
ERR_SUPPLY
ERR_INSUFFICIENT_AVAILABLE
ERR_FUNDING_LOT_OWNER
ERR_FUNDING_TOTAL
ERR_FUNDING_OBLIGATION
ERR_CONTRIBUTION_STATE
ERR_CONTRIBUTION_CONSENT
ERR_MAINTAINER_ATTESTATION
ERR_REPOSITORY_CONTROL_UNVERIFIED
ERR_BID_PHASE
ERR_BID_ROUND
ERR_BID_WINDOW
ERR_BID_COMMITMENT
ERR_BID_STALE
ERR_BID_INELIGIBLE
ERR_BID_CONTRACT_BINDING
ERR_BID_ACCEPTANCE_EXPIRED
ERR_CONTRACT_ALREADY_ACCEPTED
ERR_CONTRACT_IMMUTABLE
ERR_CONTRACT_AUTHORITY_CEILING
ERR_ALLOWANCE_SCOPE
ERR_ALLOWANCE_EXPIRED
ERR_ALLOWANCE_UNCOMMITTED
ERR_REDELEGATION_FORBIDDEN
ERR_SUBWORK_EVIDENCE
ERR_TASK_STALE
ERR_ATTEMPTS_EXHAUSTED
ERR_ENTER_REVIEW
ERR_ARTIFACT_PATH
ERR_ARTIFACT_MISMATCH
ERR_DETERMINISTIC_RED
ERR_REVIEW_SELF
ERR_REVIEW_DUPLICATE_MODEL
ERR_REVIEW_ASSIGNMENT
ERR_REVIEW_ASSIGNMENT_EXPIRED
ERR_REVIEW_POLICY_UNSUPPORTED
ERR_REVIEW_PACKET_MISMATCH
ERR_REVIEW_DISSENT
ERR_DIVERSITY_UNKNOWN
ERR_HOLD_BINDING
ERR_HOLD_TIMEOUT_ABORT_REQUIRED
ERR_HUMAN_DECISION
ERR_DECISION_QUORUM_UNSUPPORTED
ERR_ALREADY_TERMINAL
ERR_LIVE_TERMINAL_CHILD
ERR_REMOTE_EXECUTION_FORBIDDEN
ERR_SECRET_REMOTE
ERR_PROPRIETARY_LOCAL_ONLY
ERR_LOCAL_TRUST_UNPROVEN
ERR_TEE_UNSUPPORTED
ERR_RIGHTS_UNRESOLVED
ERR_DISCLOSURE_UNCLASSIFIED
ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE
ERR_APPEAL_INELIGIBLE
ERR_APPEALS_DISABLED
ERR_APPEAL_PARTY_CONFLICT
ERR_APPEAL_EXPIRED
ERR_APPEAL_RESOLUTION_EXPIRED
ERR_APPEAL_RESOLVER_UNAVAILABLE
ERR_VERIFIER_MUTATION
ERR_GITHUB_RETRYABLE
```

Messages may improve; reason-code semantics are versioned protocol.

## 27. Required adversarial vectors

Executable coverage is tracked separately in
[`reports/FALSIFIER_SCOREBOARD_v0.2.md`](reports/FALSIFIER_SCOREBOARD_v0.2.md).
Specification text or implementation presence MUST NOT be counted as a test.

### Ledger

1. negative, float, unsafe, and overflow amounts;
2. insufficient balance;
3. duplicate reservation;
4. allowance oversubscription;
5. supply drift in every bucket;
6. exact and conflicting replay;
7. double terminal settlement.

### Races

8. accept versus requester cancel in both orders;
9. select versus bidder revoke in both orders;
10. allowance spend versus revoke in both orders;
11. controller rotation/revocation versus spend in both orders;
12. timeout versus result in both orders.

### Bids

13. wrong salt/commitment;
14. late commit/reveal;
15. stale job version;
16. duplicate principal aliases;
17. deterministic tie;
18. selective non-reveal.

### Work

19. stale task/attempt/source/lease;
20. oversized input/output;
21. prompt injection fixture;
22. unauthorized tool/destination;
23. expired lease;
24. attempts exhausted;
25. malicious normalized path.

### Review

26. worker self-review;
27. duplicate model ID;
28. same-provider correlated labels;
29. missing required diversity;
30. mismatched artifact/packet root;
31. deterministic red plus three clears;
32. dissent plus two clears;
33. rework invalidates prior reviews;
34. replayed review.

### Privacy and rights

35. proprietary remote route;
36. secret remote route;
37. low-entropy hash oracle;
38. unclassified export field;
39. secret pattern in artifact;
40. missing licence/NOTICE/upstream/provenance.

### GitHub and crash

41. verifier/workflow mutation;
42. stale base after check;
43. capsule tamper;
44. omitted/reordered child receipt;
45. GitHub outage and retry;
46. every persistence crash boundary;
47. partial/corrupt journal;
48. unknown injected file under strict manifest.

### Economic/harm

49. post-acceptance requester revocation;
50. donor attempts to select reviewer/maintainer outcome;
51. reviewer payment conditional on `CLEAR`;
52. credit used as review weight/reputation;
53. external-value/bridge/redemption surface appears.

### Reviewer-driven boundary vectors

54. `contract.privacy.remote_execution` is false but a public/redacted task,
    authority ceiling, offer, or lease targets a non-local route;
55. local-trusted policy has one `UNKNOWN` or `UNENFORCED` control;
56. public root transitively commits to private or low-entropy material;
57. valid dissenting review and its pending payout commit atomically, then the
    declared payment is received on abort;
58. appeal has no eligible non-party resolver;
59. every contribution disposition under cancel, settle, abort, hold, and
    publication failure;
60. settlement authority attempts repository merge without maintainer;
61. workflow/check name matches but verifier bytes, policy bytes, app identity,
    runner class, or workflow SHA differs;
62. operational outbox attempt/status changes while canonical state root
    remains unchanged;
63. irreversible action omits or changes its bound pre-action disclosure.

### State/economic audit vectors

64. receipt or journal bytes are inserted into the application-state
    projection and create a next-root cycle;
65. pre-acceptance cancellation reaches `CANCELLED` without one complete
    terminal settlement and external receipt;
66. one active funding lot is missing, multiply referenced, or owned by a
    record that disagrees with its bucket;
67. partial lot split, pro-rata tie, and mixed pledge/donation residue in
    reversed insertion orders;
68. clock advance skips, decrements, lacks `CLOCK_ADVANCER`, or accepts an
    explicit target;
69. commit, reveal, select, accept, result, and expiry on every half-open tick
    boundary;
70. bid reveal binds another round, job version, or draft contract root;
71. worker acceptance signs a different candidate contract, worker seat,
    capability offer, or lead price;
72. allowance authorization attempts to create a payout without accepted
    exact sub-work evidence;
73. sub-work result versus allowance/commitment expiry in both predecessor
    orders;
74. failed review enters `HOLD`, then exercises rework, resume-review, and
    abort with stale and current hold roots;
75. child task, lease, offer, tool, route, model, egress, or isolation exceeds
    the accepted authority ceiling;
76. unsolicited, duplicate-slot, replaced, expired, or fourth paid review;
77. RFC 8785 golden vectors plus duplicate key, non-NFC, lone surrogate,
    exponent, negative-zero, and unsafe-integer rejection;
78. every registered ID golden preimage, self-ID omission, raw-signature
    omission, mandatory exact six-field verified-auth-reference inclusion for
    capability-offer and donated-consent carrier IDs/roots, internally derived
    offer content-root and bidirectional uniqueness-index checks, missing/extra
    reference rejection, changed-reference identity divergence, V2 carrier
    domain separation, and full-digest check;
79. scheduler insertion order disagrees while the canonical ordering tuple
    must remain identical;
80. crash before/after each PREPARE, COMMIT, snapshot rename, and manifest
    pointer boundary proves old-or-new recovery;
81. donated-capacity offer exceeds owner consent, leaks a provider credential,
    bids nonzero, presents a missing or extra verified-auth reference, attempts
    same-content registration under a different envelope/reference, tampers
    with the offer content index, attempts to retain an offer or consent carrier
    ID/root after changing that reference, crosses an old ID/root, or revokes an
    already accepted lease retroactively;
82. sponsor, requester, or model attempts to open/merge an open-source job
    without exact maintainer attestation;
83. optional allowance allocation attempts to consume the mandatory lead,
    review, or verification reserve.
84. contract declares zero or multiple required human decisions in v0;
85. self-registered or expired repository-control claim attempts to render as
    verified maintainer, open funding, or accept leases;
86. appeal actor, waiver signer, or resolver disagrees with immutable accepted
    role/party sets;
87. valid dissent reaches its hold deadline, blocks further tick advance, and
    deterministically aborts while paying the undisputed review payout.
88. mutable amount/status/bucket changes preserve stable record ID, increment
    revision once, and reject a stale or broken previous-record root;
89. `ENTER_REVIEW` versus final return, task expiry, hold, and tick advance in
    both predecessor orders, with no partial packet state;
90. settle, abort, and cancel each close the unique job account plus every
    live round, lease, appeal, and other child; later job events and
    terminal-child expiries reject;
91. disabled zero-filing appeals, rejected zero-resolution enabled contracts,
    and filing, waiver, resolution, and timeout on every half-open absolute
    decision/appeal tick boundary;
92. exact committed replay after controller rotation/revocation returns the
    historical receipt; independently valid randomized signature-byte-only
    re-signing that derives the same exact six-field reference preserves
    semantic identity and offer/consent carrier IDs/roots; exact event replay
    returns the historical receipt before offer-content uniqueness handling,
    while a changed reference changes carrier identity or conflicts, and
    alternate authenticated bytes paired with the original receipt reject
    recovery.
93. v0 contract attempts a review count other than three, majority clearance,
    worker self-review, or non-hold material dissent.

## 28. Prototype module map

```text
prototype/
  core/
    canonical.mjs
    hash.mjs
    errors.mjs
    state.mjs
    reducer.mjs
    invariants.mjs
    receipts.mjs
  economy/
    accounts.mjs
    contributions.mjs
    bids.mjs
    allowances.mjs
    settlement.mjs
  work/
    broker.mjs
    prober.mjs
    scheduler.mjs
    tasks.mjs
  review/
    checks.mjs
    reviews.mjs
    clearance.mjs
  privacy/
    routing.mjs
    disclosure.mjs
  github/
    capsule.mjs
    verifier.mjs
    outbox.mjs
  fixtures/
    happy-path.json
    adversarial/
  tests/
  ui/
    index.html
    styles.css
    app.js
    demo-state.json
```

The actual implementation MAY consolidate files while preserving boundaries.

## 29. Verification commands

The completed prototype MUST expose:

```bash
node prototype/tests/run-tests.mjs
node prototype/cli.mjs demo
node prototype/cli.mjs verify-capsule prototype/fixtures/capsule
./scripts/verify.sh
```

The repository verifier MUST run the prototype tests once implementation
begins.

## 30. Acceptance criteria for v0.1

The prototype is demonstrated only when:

- all required vectors pass;
- two identical demos produce the same state/capsule roots;
- at least one mutation in each authority boundary is rejected;
- the happy path settles once and conserves supply;
- the public capsule contains no absolute path or secret fixture;
- the Matrix displays non-claims and diversity labels;
- correlated three-model review is never labelled independent;
- unsupported TEE/proprietary-remote routes visibly hold;
- GitHub witness generation is local-only and uses no credentials;
- all repository checks pass from a clean checkout.

Passing these criteria establishes only the local deterministic prototype
claim. It does not establish production safety or real economic fitness.


# Executable Amendment v0.2 (Normative)

## 0. Status, precedence, and conformance

This amendment is normative. It defines the executable v0.2 contract for the prototype.

Where this amendment conflicts with an earlier V1, V4, raw-fact, mutable-runtime, caller-selected-ID, or compatibility example in this document, this amendment supersedes that example. Earlier examples remain historical context only. Implementations MUST follow the exact schemas and public boundaries in `prototype/API_CONTRACT.md` and the executable implementation.

The words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, and MAY are normative.

Conformance requires all of the following:

- Canonical mutation occurs only through the authenticated core reducer.
- Accepted authority is obtained only through a branded resolver at one accepted application root and logical tick.
- Public inputs use exact keys and current schemas; missing keys, extra keys, aliases, and downgraded schemas are rejected.
- Rejected operations leave canonical state, roots, event history, receipt history, balances, funding, attempts, and authority consumption unchanged.
- Pure constructors, root functions, scorers, schedulers, and fact evaluators do not by themselves prove that a record is accepted.

## 1. Opaque runtime, atomic mutation, and replay recovery

`createRuntime(genesisState)` MUST return a frozen, propertyless, branded runtime handle. Callers MUST NOT receive a writable state reference. Runtime branding is process-local and MUST NOT be inferred from object shape.

`snapshotRuntime(runtime)` is observation only. It MUST return a deeply frozen clone with schema `nexus-runtime-snapshot-v1` and exact fields `{schema,state,events,receipts,current_root}`. Mutating a snapshot MUST NOT mutate the runtime.

`applyEvent(runtime,event)` MUST verify exact ingress, authentication, predecessor root, authority root, policy root, logical tick, nonce, idempotency key, and event-specific payload keys before mutation. It MUST reduce against a candidate clone, validate all invariants, and commit state, event history, receipt history, and idempotency indexes atomically. A failure MUST commit nothing.

An identical authenticated replay MAY return the prior replay result. A
semantically identical, independently and validly re-signed duplicate in an
already-advanced runtime MUST resolve through semantic idempotency and return
the original authenticated receipt without appending or replacing journal
bytes. Reuse of an event ID or idempotency key for a conflicting semantic
event MUST fail.

`recoverRuntime({events,expectedFinalRoot,genesisState,receipts})` is the only
history-bearing runtime constructor. Recovery MUST replay the complete ordered
authenticated journal, compare every receipt and state transition, and require
the exact final root. It MUST recompute `receipt_id`,
`semantic_receipt_id`, the authenticated chain rooted through
`previous_receipt_root`, and the deterministic semantic chain rooted through
`previous_semantic_receipt_root`. It MUST also require each
`authenticated_event_root` to match the exact supplied event bytes. An
alternate valid randomized re-signature paired with an original receipt MUST
fail `ERR_RECOVERY`. Missing, reordered, altered, duplicated, or extra events
or receipts MUST fail recovery.

The prototype has no durable canonical database. Runtime state, brands, indexes, and journals are in memory. Exported snapshots are evidence and recovery inputs, not a persistence or concurrency protocol. Production use requires durable atomic storage, locking or serialization, crash recovery, key custody, and authenticated journal retention beyond this prototype.

## 2. Canonical values, derived identities, roots, and authentication domains

Every accepted value MUST be canonical: exact object keys, normalized strings, lowercase hexadecimal roots, sorted unique sets where required, and non-negative safe integers where required. Floating point ambiguity, unsafe integers, duplicate JSON keys, invalid Unicode, non-normalized aliases, and implicit defaults are forbidden.

Carrier and record IDs MUST be derived by the core from a schema-specific ID domain over the exact ID-excluded body. A caller MUST NOT select or override a derived ID. A supplied derived ID MUST match its preimage.

Carrier root helpers use own-ID property presence, not truthiness. For
capability offers the key is `offer_id`; for accepted donated-capacity consents
it is `consent_id`. If `Object.hasOwn(record, ownIdKey)` is false, the helper
MUST derive the own ID internally. If it is true, the value MUST be the exact
canonical derived ID. Present `null`, explicit `undefined`, non-string,
malformed, or canonical-looking mismatched values MUST fail
`ERR_ID_PREIMAGE`. The absent-own-ID and exact-valid-present-own-ID forms MUST
derive the same carrier root.

Record roots MUST be computed under the record's schema-specific hash domain over the exact canonical record body. Transport authentication, event signatures, receipts, replay metadata, and operational status MUST NOT be inserted into a record-root preimage unless the record schema explicitly includes them. ID domains, record-root domains, event-body domains, authentication domains, set domains, and decision domains are distinct and MUST NOT be substituted for one another.

Capability-offer and accepted donated-consent carrier schemas explicitly
include the exact
`{schema:"nexus-verified-hybrid-auth-reference-v1",scheme,key_id,controller_id,signed_domain,signed_payload_root}`
derived after full authentication verification. Their v1 carrier schema strings
remain unchanged. Offer IDs and roots use `NEXUS_CAPABILITY_OFFER_ID_V2` and
`NEXUS_CAPABILITY_OFFER_V2`; consent IDs and roots use
`NEXUS_DONATED_CAPACITY_CONSENT_ID_V2` and
`NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2`. All four preimages retain the
exact reference. Raw Ed25519 and ML-DSA-65 signatures MUST NOT enter a carrier
preimage. Auth-free offer terms and consent body roots remain under their V1
domains, avoid a circular signed preimage, and MUST NOT be substituted for an
accepted carrier ID/root.

The core MUST derive `offer_content_root` under
`NEXUS_CAPABILITY_OFFER_CONTENT_V1` from the exact semantic offer body,
including `nonce` and excluding only `offer_id`, `offer_content_root`, and
`authentication`. It MUST reject a caller-supplied content root. The accepted
offer stores the derived root, and both V2 offer carrier preimages bind it.
Canonical state MUST maintain
`capability_offer_content_index: content_root -> offer_id`. After exact event
replay handling, registration of an occupied content root under a different
envelope or reference fails `ERR_ID_PREIMAGE` before mutation. A changed offer
`nonce` is distinct content but still requires independent authority.
Invariants and recovery MUST bidirectionally recompute the index and reject any
missing, extra, crossed, or tampered mapping.

Event ingress is exactly:

`{schema,event_type,actor_id,authority_root,policy_root,expected_predecessor_root,tick,nonce,idempotency_key,payload,event_id,auth}`

The schema is `nexus-event-v1`. The event ID is `EVT-${eventBodyRoot(event)}`.

Authentication is exactly:

`{scheme:"HYBRID_ED25519_ML_DSA_65_V1",key_id,controller_id,signed_domain:"NEXUS_EVENT_AUTH_V2",signed_payload_root,ed25519_signature_base64url,ml_dsa_65_signature_base64url}`

The authentication preimage is exactly:

`{schema:"nexus-event-auth-preimage-v2",event_body_root,event_type,actor_id,controller_id,expected_predecessor_root,authority_root,tick,nonce,idempotency_key,payload_root,policy_root}`

Its root domain is `NEXUS_EVENT_AUTH_PREIMAGE_V2`. Both signatures MUST verify
over one exact `nexus-hybrid-auth-signed-message-v2`. Controller key IDs derive
under `NEXUS_HYBRID_AUTH_KEY_ID_V1` from both canonical public SPKI values.
`SIM_AUTH_UNSAFE`, missing keys/signatures, one-key rotation, and unknown schemes
reject. Exact sizes, OIDs, encodings, replay semantics, and non-claims are
normative in [`HYBRID_IDENTITY_PROFILE.md`](HYBRID_IDENTITY_PROFILE.md).

`eventBodyRoot(event)` and `authPreimage(event, controller_id)` use the exact
full payload. For the sole nested full-auth path,
`ACCEPT_DONATED_CAPACITY_CONSENT.payload.authentication`, ingress requires the
exact seven-field mandatory-AND object and rejects a caller-supplied six-field
reference. Only semantic event body/ID/root projection replaces that value with
the exact
`{schema:"nexus-verified-hybrid-auth-reference-v1",scheme,key_id,controller_id,signed_domain,signed_payload_root}`
derived after verification. This rule is not recursive or name-based, and no
other nested full-auth path exists among the 55 current event types. Both new
and duplicate paths verify the full nested authentication; duplicates use the
originally accepted controller snapshot. Authenticated event and receipt
evidence preserve full inner and outer bytes, while stored capability offers
and accepted consents retain only derived six-field references. Each retained
reference MUST have exactly those six fields and MUST equal the value derived
from the verified authentication. Missing, extra, malformed, or
verification-mismatched references reject. Each V2 carrier ID preimage and V2
carrier-root preimage includes the reference. Changed randomized signature
bytes preserve carrier identity only when the derived reference is identical;
changing any reference field changes both carrier ID and root for an otherwise
valid carrier, so an old or crossed ID/root rejects.

## 3. Accepted resolver V2 and one-state authority

A resolver MUST be created from a branded runtime by `createAcceptedRecordResolver(runtime)`. The resolver is frozen and branded. A lookalike object, cloned resolver, raw snapshot, raw record, or caller-built envelope MUST fail authority checks.

An accepted-record request is exactly:

`{record_type,record_id,record_root}`

The response is exactly:

`{schema:"nexus-accepted-record-envelope-v2",accepted_application_state_root,accepted_logical_tick,record_type,record_id,record_root,record_revision,record_status,record}`

`accepted_logical_tick` MUST be a non-negative safe integer. The requested ID and root MUST match the current accepted record. Immutable authority records require revision zero and status `ACCEPTED` unless a current operation explicitly requires another status such as `CONSUMED`.

An accepted-record-set request is exactly:

`{record_type:"REVIEW_ASSIGNMENT",scope:{assignment_slot,job_id,review_packet_root}}`

The response is exactly:

`{schema:"nexus-accepted-record-set-envelope-v2",accepted_application_state_root,accepted_logical_tick,record_type:"REVIEW_ASSIGNMENT",scope,scope_root,set_root,records}`

The scope root uses `NEXUS_REVIEW_ASSIGNMENT_SET_SCOPE_V1`. The set root uses `NEXUS_ACCEPTED_RECORD_SET_V2` over the ordered record references and their revisions and statuses.

Every multi-record decision MUST resolve all records and sets at the same `accepted_application_state_root` and `accepted_logical_tick`. Mixed roots, mixed ticks, stale revisions, crossed IDs and roots, revoked records, and expired authority MUST fail. A resolver result is deeply frozen and MUST not expose writable canonical state.

## 4. Consent-first controller, principal, and seat topology

Authority topology is consent-first:

`controller -> principal -> seat -> accepted consent -> capability offer -> assignment or lease -> work or review`

A controller MUST be active and independently authenticated before it can act for a principal. A principal MUST occupy the exact authorized seat. A worker, donated-capacity provider, reviewer, verifier, or delegate MUST have the required accepted consent before an offer, bid, assignment, lease, measurement, work action, or review can rely on that capacity.

Consent MUST bind its controller, principal, seat, scope, policy, validity window, and any delegated ceiling. Later offers and assignments MUST reference the accepted consent rather than restating consent booleans. Revocation or expiry MUST be evaluated from accepted current state and tick. No downstream event may retroactively manufacture missing consent.

The accepted consent and capability-offer references used by this topology MUST
resolve carriers whose exact six-field verified authentication references are
committed to both carrier ID and root under the V2 carrier domains. Eligibility
MUST reject a carrier with a missing or extra reference, a reference that does
not match verified provenance, or an ID/root computed from different reference
content.

## 5. Reference-only bid and task eligibility

Bid and task eligibility MUST be derived from accepted references. Callers MUST NOT submit `eligible`, `conflict_free`, `unrevoked`, `probe_current`, capability, route, or timing booleans as authority.

The work eligibility boundary is `evaluateOfferEligibility(input)` with exact input keys:

`{resolver,evaluationKind,capabilityOfferRef,donatedCapacityConsentRef,jobRef,jobContractRef,conflictPolicyRef,taskRef,bidRef,probe}`

`evaluationKind` is `BID` or `TASK`; bid and task references are mutually exclusive. All accepted references MUST share one resolver root and tick.

Eligibility MUST derive the current controller and consent status, immutable offer ID/root, probe binding and validity window, project/job allowlists, complete contract ceiling, contribution terms, data class, tools, runtimes, egress, isolation, conflict policy, revocation state, task attempt, and current logical tick.

Bid scoring, comparison, ranking, and task ordering are pure deterministic functions. They MUST NOT mutate state or convert unaccepted facts into authority. A winning bid or ready task remains non-authoritative until the authenticated reducer accepts the corresponding event and rechecks current eligibility.

## 6. Review packet V2, replacement history, and exact closure

Review authority uses `nexus-review-packet-v2` and accepted references only. A review packet MUST bind the job, accepted contract, artifact, attempt, required-check manifest, deterministic evidence, policy, and review assignment slots.

Closure requires exactly three accepted model reviews for exactly three required slots. Each counted review MUST bind the exact current assignment, packet, job, artifact, model, reviewer principal, reviewer seat, capability offer ID/root, and eligibility facts.

The `DISTINCT` policy MUST be enforced from packet-bound accepted facts. The required distinct dimensions, including model identity and any configured provider-family or operator dimensions, MUST be satisfied by the exact three counted reviews. Duplicate reviews, duplicate slots, self-review, unbound reviews, excess reviews, missing reviews, stale assignments, or reviews from revoked or expired offers MUST NOT close the packet.

Reviewer replacement history MUST be resolved through the accepted-record-set V2 scope `{assignment_slot,job_id,review_packet_root}`. Attempts are ordered deterministically. Only the current eligible replacement for a slot may count. Every assignment record and the set envelope MUST share the same accepted root and tick.

Material dissent and failed required checks MUST produce the specified HOLD path. Clearance MUST be computed from the ordered three review hashes, packet-bound diversity vector, deterministic evidence root, and policy root. No caller-supplied clearance or diversity boolean is authoritative.

## 7. Verifier-signed classified-input measurement

Classified input size and class are measured authority, not plan-author assertions.

`RECORD_CLASSIFIED_INPUT_MEASUREMENT` has exact payload:

`{job_ref,task_ref,lease_ref,entries}`

Each entry is exact `{input_root,data_class,byte_length}`. Entries MUST be canonical and deterministically ordered. Byte lengths MUST be non-negative safe integers and their sum MUST be overflow checked. The authenticated verifier/controller, referenced job, task, and lease, and current state/tick MUST be validated before the core accepts the resulting `nexus-classified-input-manifest-v2` record.

A route-plan author MUST reference the accepted measurement. It MUST NOT supply measured bytes, total bytes, data classes, or a replacement manifest body.

## 8. Reference-only route execution plan V5

`ISSUE_LEASE` remains a separate pre-plan event with exact payload:

`{job_id,task_id,context_root,input_manifest_root,not_before_tick,expiry_tick,lease_nonce}`

It MUST NOT accept route-plan fields.

`CREATE_ROUTE_EXECUTION_PLAN` has exact payload:

`{lease_ref,classified_input_manifest_ref,data_route_authority_ref,redaction_approval_ref,tool_route_authority_refs,plan_nonce}`

The core MUST resolve current accepted job, task, lease, contract, offer, controller, principal, seat, measurement, route authority, redaction authority, tool authorities, job account, funding lots, allowance, and subwork commitment as applicable. The core, not the caller, derives price, spend, funding ownership, selected route, tools, runtimes, egress, worker trust, input bytes and classes, and the plan validity window.

The accepted plan schema is `nexus-route-execution-plan-v5`. Embedded record references are exact `{record_id,record_root}`. Nullable references are permitted only where the V5 schema explicitly allows them.

A remote-redaction approval is required if and only if the accepted measured inputs and accepted route facts require it. The decision MUST derive this condition from accepted plan/core facts. Caller-supplied remote-redaction booleans, checks, raw contracts, tasks, leases, offers, workers, tools, payloads, prices, funding facts, or ticks are forbidden.

The public privacy adapter accepts exactly:

`decideDataRoute({route_execution_plan_id,route_execution_plan_root},{resolver})`

It MUST call `resolveAcceptedRouteContext` and then the branded `deriveDataRouteDecision`. It returns only `nexus-data-route-decision-v5`. Outcomes are `ALLOW` and fail-closed `HOLD`; `HOLD` MUST NOT be translated to a legacy `DENY` enum.

`deriveDataRouteDecisionFromFacts(context)` is a pure internal computation surface. Calling it does not confer accepted-state authority. Only the branded resolver/context path is authoritative.

`CONSUME_ROUTE_EXECUTION_PLAN` has exact payload:

`{route_execution_plan_id,route_execution_plan_root,expected_decision_root}`

Consumption MUST re-resolve current state and tick, require an exact current `ALLOW` decision, require the leased worker/controller, and atomically create one consumption authority. A stale decision, expired plan, changed application root, changed tick-dependent fact, wrong controller, or replay MUST fail without consuming authority.

## 9. V3 public-safe disclosure and GitHub chain

The public-facing disclosure/GitHub verification boundary is the V3 public-safe chain, including `nexus-public-capsule-verification-v3`. Component records retain their individually current schemas, including publication intent V3 and publication anchor V2. A shared marketing version MUST NOT be used to downgrade a component schema.

The chain is reference-first:

`accepted preparation -> accepted disclosure manifest and compilation anchor -> accepted public capsule and non-claims -> accepted publication intent -> accepted publication anchor -> public verification`

Preparation, compilation, capsule, intent, and verification adapters MUST use the branded resolver and purpose-specific ID/root references. They MUST re-resolve accepted records, recompute canonical roots, and cross-check every linked ID/root at one accepted application root and logical tick.

Public-safe records MUST omit private policy preimages, proof-context preimages, salts, secrets, private artifacts, raw execution payloads, and mutable operational state. Entropy/freshness authority and its one-use consumption MUST bind the exact purpose, scope, nonce commitment, and use scope. Multi-record entropy verification MUST require the same accepted root and tick.

Publication intent is fixed to `destination_policy:"GITHUB_SANITIZED_WITNESS"`. Public verification returns `status_authority:"NONE"`; it does not claim that GitHub publication occurred.

GitHub outbox status is operational only. It is not canonical state, has no reducer or resolver capability, and MUST NOT affect application roots, receipts, settlement, or authority. Its exact statuses are `PENDING`, `PUBLISHED`, `FAILED_RETRYABLE`, and `FAILED_TERMINAL`.

## 10. Exact-key and downgrade rejection

Every public request, event payload, record, envelope, nested reference, and adapter option object MUST use its exact current key set. Unknown fields, missing fields, duplicated fields, legacy aliases, raw-fact compatibility fields, and caller-computed authority booleans MUST fail.

Current implementations MUST reject, without fallback:

- Accepted-record or accepted-set V1 envelopes and envelopes without `accepted_logical_tick`.
- Raw route-decision V4 inputs and any caller-supplied route checks or facts.
- Legacy review packets or non-exact review closure.
- Legacy disclosure, compilation, capsule, non-claims, intent, anchor, and verifier wrappers.
- Crossed, forged, stale, revoked, expired, mixed-root, mixed-tick, and replayed references.
- Any schema downgrade disguised by adding current fields to a legacy object.

Compatibility translation belongs outside the canonical trust boundary. It MUST produce a new exact current request and pass normal authentication; it MUST never cause the core or adapters to accept a legacy object directly.
