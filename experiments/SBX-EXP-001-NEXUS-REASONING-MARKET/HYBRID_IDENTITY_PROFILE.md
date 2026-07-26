# Hybrid identity profile v1

**status_authority:** `NONE`
**Profile:** `HYBRID_ED25519_ML_DSA_65_V1`
**Runtime floor:** Node.js `>=24.8.0`

This is the only authoritative identity profile accepted by the executable
prototype. It is a cryptographic verification profile, not a claim of
production key custody, hardware isolation, legal identity, or personhood.

## 1. No downgrade

An authoritative controller and every event authentication MUST use
`HYBRID_ED25519_ML_DSA_65_V1`.

Both Ed25519 and ML-DSA-65 signatures MUST verify. There is no either/or mode,
classical-only mode, post-quantum-only mode, legacy adapter, unknown-scheme
fallback, or `SIM_AUTH_UNSAFE` compatibility lane. Missing, malformed, unknown,
or single-signature profiles fail closed.

## 2. Controller public identity

The controller record binds these public identity fields:

```json
{
  "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
  "key_id": "HYBRIDKEY-...",
  "ed25519_public_key_spki_der_base64url": "...",
  "ml_dsa_65_public_key_spki_der_base64url": "..."
}
```

Private keys MUST NOT enter canonical state, events, receipts, resolver
envelopes, disclosure artifacts, public capsules, or exploit submissions.

`key_id` is derived, never caller-selected:

```text
HYBRIDKEY- || H(
  "NEXUS_HYBRID_AUTH_KEY_ID_V1",
  {
    "schema": "nexus-hybrid-auth-public-key-pair-v1",
    "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
    "ed25519_public_key_spki_der_base64url": "...",
    "ml_dsa_65_public_key_spki_der_base64url": "..."
  }
)
```

Changing either public key changes the key ID. A key ID with a missing,
substituted, reordered, or non-canonical public-key encoding is invalid.

## 3. Encodings

All public keys and signatures use canonical unpadded base64url. A decoder MUST
round-trip to the identical input string. Padding (`=`), standard base64
characters, ignored suffixes, or alternate encodings reject.

| Value | Required DER or signature bytes | Algorithm identity |
|---|---:|---|
| Ed25519 SPKI | 44 | OID `1.3.101.112`, key type `ed25519` |
| ML-DSA-65 SPKI | 1974 | OID `2.16.840.1.101.3.4.3.18`, key type `ml-dsa-65` |
| Ed25519 signature | 64 | Ed25519 |
| ML-DSA-65 signature | 3309 | ML-DSA-65 |

Length checks are necessary but not sufficient. DER structure, OID, key type,
canonical encoding, key-ID derivation, and both cryptographic verifications are
also mandatory.

## 4. Authentication object

Event authentication is exact:

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

Unknown or omitted fields reject. Independent donated-capacity consent uses the
same exact hybrid authentication shape with signed domain
`NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2`. Among the 55 current event types,
`ACCEPT_DONATED_CAPACITY_CONSENT` is the only event with a nested full
authentication object, at `payload.authentication`. Ingress MUST require the
exact seven fields above at that path. A caller-supplied
`nexus-verified-hybrid-auth-reference-v1` has only six fields and MUST reject;
it is provenance derived only after full verification, not authentication.

## 5. One signed message

Both algorithms sign the identical `canonicalBytes()` output of:

```json
{
  "schema": "nexus-hybrid-auth-signed-message-v2",
  "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
  "signed_domain": "...",
  "controller_id": "CTRL-...",
  "key_id": "HYBRIDKEY-...",
  "signed_payload_root": "..."
}
```

The event authentication preimage schema is
`nexus-event-auth-preimage-v2`. Its root domain is
`NEXUS_EVENT_AUTH_PREIMAGE_V2`. Event authentication uses signed domain
`NEXUS_EVENT_AUTH_V2`.

ML-DSA-65 additionally uses the fixed ASCII context
`NEXUS_HYBRID_AUTH_ML_DSA_65_CONTEXT_V1`. The context does not replace the
signed domain; domain authority is already inside the shared signed bytes.

Verification MUST resolve the current or historically accepted controller,
rederive its hybrid key ID, bind both registered public keys, recompute the
signed payload root, reconstruct the one shared message, and verify both
signatures.

## 6. Semantic identity and randomized replay

Top-level `event.auth` signature bytes are excluded from semantic event
identity. Exact event authentication is not projected: `eventBodyRoot(event)`
continues to hash the exact event body without only `event_id` and top-level
`auth`, so it includes the complete payload and any nested authentication
bytes. `authPreimage(event, controller_id)` likewise commits that exact
`event_body_root` and the hash of the exact full payload. The outer mandatory-AND
authentication therefore signs the complete nested donated-consent
authentication.

Semantic identity uses an event-type-discriminated projection:

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
```

For every other current event type, `semantic_event_body` is the exact event
body. Implementations MUST NOT recursively remove fields named
`authentication`, MUST NOT apply this rule to another path, and MUST NOT
generalize it to signature-free references. There are no other nested full-auth
paths among the 55 current event types.

```text
semantic_event_root = H(
  "NEXUS_EVENT_SEMANTIC_V2",
  {
    "schema": "nexus-event-semantic-v2",
    "event_id": semantic_event_id,
    "event_body_root": semantic_event_body_root
  }
)
```

Idempotency binds `semantic_event_root`. A canonical `nexus-receipt-v2`
receipt has these exact fields:

```text
schema
receipt_id
semantic_receipt_id
semantic_receipt_root
sequence
event_id
event_type
actor_id
job_id
predecessor_root
next_state_root
semantic_event_root
authenticated_event_root
effects_root
result_root
invariants_root
logical_tick
previous_receipt_root
previous_semantic_receipt_root
```

`authenticated_event_root` is `NEXUS_AUTHENTICATED_EVENT_V2` over the exact
submitted event, including the complete inner donated-consent authentication
and the complete outer event authentication. `receipt_id` uses
`NEXUS_RECEIPT_V2`; the authenticated receipt-chain root uses
`NEXUS_RECEIPT_CHAIN_V2` and links through `previous_receipt_root`. The journal
and these authenticated receipt values preserve and commit the exact inner and
outer hybrid authentication bytes.

`semantic_receipt_id` is `SRCPT-` plus
`H("NEXUS_SEMANTIC_RECEIPT_ID_V1", projection)`. The hash domain is external
to the preimage. The complete projection has these exact keys:

```text
schema, receipt_schema, sequence, event_id, event_type, actor_id, job_id,
predecessor_root, next_state_root, semantic_event_root, effects_root,
result_root, invariants_root, logical_tick, previous_semantic_receipt_root
```

`schema` is `nexus-semantic-receipt-v1` and `receipt_schema` is
`nexus-receipt-v2`. The projection excludes only authentication-dependent
evidence. `semantic_receipt_root` uses
`NEXUS_SEMANTIC_RECEIPT_CHAIN_V1` over that complete semantic receipt and
links through `previous_semantic_receipt_root`.

Canonical application state and downstream terminal-receipt references MUST
use `semantic_receipt_id`, never the authentication-dependent `receipt_id`.
Independent valid randomized ML-DSA re-signatures of top-level event
authentication therefore may reach the same application root and semantic
receipt ID/root, while producing different authenticated event roots, receipt
IDs, and authenticated receipt-chain roots. A valid re-signature of the one
designated nested donated-consent authentication also preserves semantic event
identity when it derives the same exact six-field verified authentication
reference, because only that deterministic reference replaces the full object
in the semantic projection. Signature bytes are excluded from semantic and
carrier identity; the verified reference is not. The same-reference
re-signature therefore preserves the accepted consent carrier ID/root, and a
same-reference re-signature of top-level `REGISTER_OFFER` authentication
preserves the accepted offer carrier ID/root.
Within an already-advanced runtime, a semantically identical valid duplicate
resolves through semantic idempotency and returns the original authenticated
receipt without appending or replacing journal bytes.

The runtime MUST retain the exact originally accepted event authentication
bytes in its journal. Replay verification uses the originally accepted public
controller snapshot and returns the original receipt. It MUST NOT replace the
journaled ML-DSA bytes with later randomized signature bytes.

Both new and duplicate `ACCEPT_DONATED_CAPACITY_CONSENT` paths MUST
cryptographically verify the full seven-field nested authentication with both
algorithms before using its semantic projection. A duplicate MUST verify it
against the originally accepted controller snapshot, not merely compare the
six-field projection or trust current controller state.

Recovery MUST recompute and verify both receipt IDs and both receipt chains.
Each supplied receipt's `authenticated_event_root` MUST equal the full
authenticated root of the exact supplied journal event, including its hybrid
signature bytes. Its semantic receipt projection and
`previous_semantic_receipt_root` MUST reproduce the supplied
`semantic_receipt_id` and `semantic_receipt_root`; its authenticated body and
`previous_receipt_root` MUST reproduce the supplied `receipt_id` and
authenticated receipt-chain root. An alternate valid re-signature paired with
the original receipt MUST fail `ERR_RECOVERY`.

Accepted semantic records MUST NOT retain either signature. After full dual
verification, the reducer MUST derive this exact deterministic provenance for
top-level `REGISTER_OFFER` authentication and nested accepted-consent
authentication:

```json
{
  "schema": "nexus-verified-hybrid-auth-reference-v1",
  "scheme": "HYBRID_ED25519_ML_DSA_65_V1",
  "key_id": "HYBRIDKEY-...",
  "controller_id": "CTRL-...",
  "signed_domain": "...",
  "signed_payload_root": "..."
}
```

Capability offers and accepted donated-capacity consents MUST store this
six-field derived reference as canonical carrier content. Carrier validation
MUST require exactly `schema`, `scheme`, `key_id`, `controller_id`,
`signed_domain`, and `signed_payload_root`, reject missing or extra fields, and
require the reference to equal the value derived from the fully verified
authentication. The offer reference uses `NEXUS_EVENT_AUTH_V2`; the consent
reference uses `NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2`.

The v1 carrier body schemas remain unchanged. Offer IDs use
`NEXUS_CAPABILITY_OFFER_ID_V2` over the exact ID-excluded v1 carrier body
including the reference, and offer roots use `NEXUS_CAPABILITY_OFFER_V2` over
the exact v1 carrier including the reference. Consent IDs use
`NEXUS_DONATED_CAPACITY_CONSENT_ID_V2`, and consent roots use
`NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2`, with the same mandatory reference
commitment. Pre-authentication offer terms and consent body roots remain
auth-free under their V1 domains so that they can be signed without a circular
preimage; those roots are not carrier IDs or accepted-carrier roots. Full
dual-auth bytes remain only in immutable journal events and are reverified
during recovery.

An accepted offer also stores the internally derived:

```text
offer_content_root = H(
  "NEXUS_CAPABILITY_OFFER_CONTENT_V1",
  exact semantic offer body
)
```

The semantic offer body includes `nonce` and excludes only the offer's own ID,
`offer_content_root`, and authentication. `REGISTER_OFFER` MUST NOT accept a
caller-supplied `offer_content_root`. The stored content root is included in
both the `NEXUS_CAPABILITY_OFFER_ID_V2` and `NEXUS_CAPABILITY_OFFER_V2`
preimages, alongside the verified authentication reference. It is distinct
from the auth-free offer terms root, probe root, and consent body root, which
remain under their V1 domains.

Canonical state MUST maintain
`capability_offer_content_index: offer_content_root -> offer_id`. Registration
of the same content root through a different event envelope or verified
reference MUST reject `ERR_ID_PREIMAGE` before mutation. Exact event replay
remains semantically idempotent and returns the historical receipt. Changing
the offer `nonce` creates distinct semantic content and a distinct content
root, but grants no authority: the new registration independently satisfies
authentication, authority, predecessor, policy, and replay requirements.
Invariants and recovery MUST recompute the mapping in both directions from
accepted offers and reject a missing, extra, crossed, or tampered index entry.

A downstream adapter such as the work prober may trust the signature-free
reference only when it resolves from branded reducer-accepted state. The same
shape supplied by a caller is not authentication or provenance. Missing,
extra, malformed, or verification-mismatched references reject. Changing any
of the six deterministic fields changes both carrier ID and carrier root for an
otherwise valid carrier, so a supplied old or crossed ID/root rejects.

A changed projected semantic field, signed domain, key pair, controller, or
invalid signature is not replay-equivalent and rejects. Changed valid signature
bytes alone may be replay-equivalent only through the top-level exclusion or
the one explicit nested donated-consent projection, still require full
cryptographic verification, and preserve carrier identity only when the exact
six-field reference is unchanged.

## 7. Rotation

Controller rotation is one globally ordered event. It atomically supplies both
new public SPKI values and the correctly derived new hybrid key ID. A one-key
rotation, legacy scheme, unknown scheme, mismatched key ID, stale predecessor,
or post-rotation use of the old key rejects.

Exact replay of a pre-rotation event remains verifiable from its accepted
historical controller snapshot. This historical verification does not
reactivate or authorize the old controller for new events.

## 8. Test-only key material

Committed deterministic fixture keys live only under
`prototype/tests/hybrid-identity-fixtures.mjs`. Public and private fixture
helpers are intentionally separate. These keys are public test material and
MUST NOT be used for production custody, user identity, external signing, or
valuable assets.

## 9. Non-claims

This profile does not establish HSM-backed custody, secure key generation,
operator identity, compromise recovery, side-channel resistance, algorithm
implementation correctness, certification, or production readiness. See
[`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).
