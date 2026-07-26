# Prototype API Contract v0.2

> **status_authority:** `NONE`

## Status and authority

This file defines the current executable public surfaces and security boundaries of the prototype. It replaces the prior API contract.

Only exact current schemas are supported. There is no V1 envelope fallback, raw V4 routing compatibility, implicit aliasing, or unknown-field tolerance.

An exported pure helper validates or computes values only. It does not prove that a record is accepted. Accepted-state authority comes only from the branded runtime and resolver path.

## Dependency boundary

The canonical dependency direction is:

`canonical/hash/schema/errors -> domain roots and pure decisions -> reducer/runtime -> resolver facade -> work/review/privacy adapters -> GitHub public adapters -> UI/operations`

The reducer is the sole canonical mutation boundary. Domain adapters receive no writable state. They receive a branded resolver or already validated immutable values.

The GitHub outbox is operational and is disconnected from the runtime, reducer, resolver, application root, settlement, and receipts.

Reverse dependencies are forbidden. Core MUST NOT depend on privacy, GitHub, UI, or operational outbox modules.

## Core runtime surface

Module: `prototype/core/reducer.mjs`

- `createRuntime(genesisState, options = undefined) -> runtime`
- `snapshotRuntime(runtime) -> snapshot`
- `recoverRuntime({events,expectedFinalRoot,genesisState,receipts}) -> runtime`
- `applyEvent(runtime, event) -> {state,receipt,replay,result}`
- `currentRoot(runtime) -> applicationStateRoot`

`createRuntime` accepts zero-history genesis only. Options or embedded history are rejected. The returned runtime is frozen, propertyless, and branded through process-local internals.

`snapshotRuntime` returns exact:

`{schema:"nexus-runtime-snapshot-v1",state,events,receipts,current_root}`

The snapshot and every nested value are cloned and deeply frozen.

`recoverRuntime` accepts exactly `{events,expectedFinalRoot,genesisState,receipts}`. It replays the complete journal and recomputes both receipt identities, both receipt chains, and the exact authenticated root of every supplied event.

`applyEvent` verifies first, reduces a clone, checks invariants, and commits atomically. Its return value is deeply frozen. A semantically identical valid duplicate in an already-advanced runtime is idempotent and returns the original authenticated receipt; conflicting semantic event or idempotency reuse fails.

## Event and authentication surface

Module: `prototype/core/auth.mjs`

- `assertEventIngress(event)`
- `eventBodyRoot(event)`
- `semanticEventRoot(event)`
- `authPreimage(event, controllerId)`
- `buildIndependentControllerAuthentication(state, {principalId,controllerId,signedDomain,signedBodyRoot})`
- `verifyIndependentControllerAuthentication(state, {principalId,controllerId,signedDomain,signedBodyRoot,authentication})`
- `buildEvent(state, {eventType,actorId,payload,nonce,idempotencyKey = nonce})`
- `verifyNewEvent(state, event)`

Event ingress exact shape:

```js
{
  schema: "nexus-event-v1",
  event_type,
  actor_id,
  authority_root,
  policy_root,
  expected_predecessor_root,
  tick,
  nonce,
  idempotency_key,
  payload,
  event_id,
  auth
}
```

Authentication exact shape:

```js
{
  scheme: "HYBRID_ED25519_ML_DSA_65_V1",
  key_id,
  controller_id,
  signed_domain: "NEXUS_EVENT_AUTH_V2",
  signed_payload_root,
  ed25519_signature_base64url,
  ml_dsa_65_signature_base64url
}
```

Both signatures are mandatory and cover one identical canonical signed message.
`SIM_AUTH_UNSAFE`, one-key, either/or, legacy, and unknown profiles reject.
The exact public-key encodings, key-ID derivation, signature sizes, ML-DSA
context, rotation, and replay rules are in
[`../HYBRID_IDENTITY_PROFILE.md`](../HYBRID_IDENTITY_PROFILE.md).

`ACCEPT_DONATED_CAPACITY_CONSENT` is the only one of the 55 current event types
with another full authentication object, at `payload.authentication`. That
value has the same exact seven-field shape, with signed domain
`NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2`. Ingress requires the full object and
rejects a caller-supplied six-field
`nexus-verified-hybrid-auth-reference-v1`.

Authentication preimage exact shape:

```js
{
  schema: "nexus-event-auth-preimage-v2",
  event_body_root,
  event_type,
  actor_id,
  controller_id,
  expected_predecessor_root,
  authority_root,
  tick,
  nonce,
  idempotency_key,
  payload_root,
  policy_root
}
```

`eventBodyRoot(event)` hashes the exact event body without only `event_id` and
top-level `auth`. Its exact payload, including the complete nested
donated-consent authentication, is also hashed under `NEXUS_EVENT_PAYLOAD_V1`
for `payload_root`; the authentication preimage root domain is
`NEXUS_EVENT_AUTH_PREIMAGE_V2`. The exact submitted `event_id` is
`EVT-${eventBodyRoot(event)}`. Neither exact root uses the semantic projection,
so the outer mandatory-AND authentication commits the full nested object.

Idempotency binds `semanticEventRoot(event)` under
`NEXUS_EVENT_SEMANTIC_V2`. Its projected event body normally equals the exact
event body. Only for `ACCEPT_DONATED_CAPACITY_CONSENT` does the semantic
projection replace `payload.authentication` with
`verifiedHybridAuthenticationReference(event.payload.authentication)`:

```js
{
  schema: "nexus-verified-hybrid-auth-reference-v1",
  scheme: "HYBRID_ED25519_ML_DSA_65_V1",
  key_id,
  controller_id,
  signed_domain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
  signed_payload_root
}
```

The projected event-body root and its `EVT-` ID populate the exact
`{schema,event_id,event_body_root}` semantic-root preimage. This is an explicit
event-type and path rule, not a recursive or name-based omission. No other
current event type has a nested full-auth path.

Canonical `nexus-receipt-v2` receipts bind that semantic root plus
`authenticatedEventRoot(event)` under `NEXUS_AUTHENTICATED_EVENT_V2`; the
authenticated root commits the exact submitted event with complete inner and
outer authentication bytes.
Authenticated receipt IDs and chain roots use `NEXUS_RECEIPT_V2` and
`NEXUS_RECEIPT_CHAIN_V2`. Semantic receipt IDs and chain roots use
`NEXUS_SEMANTIC_RECEIPT_ID_V1` and
`NEXUS_SEMANTIC_RECEIPT_CHAIN_V1`. Valid randomized duplicate re-sign replay
returns the original authenticated receipt without appending; recovery rejects
an alternate re-signature paired with the original receipt as `ERR_RECOVERY`.
Event-type payload allowlists are exact; missing and extra fields fail.

New and duplicate donated-consent paths cryptographically verify both
algorithms over the full nested authentication before trusting its semantic
projection. Duplicate verification uses the originally accepted controller
snapshot. Matching the six-field projection alone is never authentication.

Accepted semantic records contain no signature bytes. After full dual
verification, the reducer MUST store exact deterministic provenance for
accepted capability offers and donated-capacity consents:

```js
{
  schema: "nexus-verified-hybrid-auth-reference-v1",
  scheme: "HYBRID_ED25519_ML_DSA_65_V1",
  key_id,
  controller_id,
  signed_domain,
  signed_payload_root
}
```

Stored capability offers derive this reference from verified top-level
`REGISTER_OFFER` authentication. Stored accepted donated-capacity consents
derive it from the verified nested authentication. Each stored reference MUST
have exactly the six keys shown above, with no missing or extra keys, and MUST
equal `verifiedHybridAuthenticationReference()` of the authentication that was
fully verified for that transition.

The reference is canonical carrier content, not detachable metadata. The v1
carrier body schemas remain unchanged. A capability-offer ID uses
`NEXUS_CAPABILITY_OFFER_ID_V2`, and `capabilityOfferRoot()` uses
`NEXUS_CAPABILITY_OFFER_V2`; both preimages include the exact reference. A
donated-consent ID uses `NEXUS_DONATED_CAPACITY_CONSENT_ID_V2`, and
`donatedCapacityConsentRoot()` uses
`NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V2`; both preimages include the exact
reference. Raw Ed25519 and ML-DSA-65 signature bytes are excluded. The
pre-authentication offer terms and consent body roots remain auth-free under
their V1 domains and are not accepted-carrier IDs or roots.

Accepted offers additionally store:

```js
offer_content_root = hashCanonical(
  "NEXUS_CAPABILITY_OFFER_CONTENT_V1",
  exactSemanticOfferBody
)
```

`exactSemanticOfferBody` includes `nonce` and excludes only `offer_id`,
`offer_content_root`, and `authentication`. `REGISTER_OFFER` rejects a
caller-supplied content root; the core derives it. Both
`NEXUS_CAPABILITY_OFFER_ID_V2` and `NEXUS_CAPABILITY_OFFER_V2` bind the stored
content root as well as the verified authentication reference. This content
root is not the auth-free offer terms root, probe root, or consent body root;
those remain V1 pre-authentication inputs.

Canonical state contains
`capability_offer_content_index: { [offer_content_root]: offer_id }`. A
different event envelope or verified reference for an occupied content root
fails `ERR_ID_PREIMAGE` before mutation. Exact event replay remains idempotent
and returns the historical receipt. A changed offer `nonce` produces distinct
semantic content and a distinct root, but the resulting registration must
independently pass authentication, authority, predecessor, policy, and replay
checks. State invariants and recovery recompute offers-to-index and
index-to-offers and reject missing, extra, crossed, or tampered entries.

Independent randomized signature bytes that derive the same exact reference
therefore preserve the corresponding carrier ID/root. A missing, extra,
malformed, or verification-mismatched reference rejects. Altering any of the
six deterministic fields changes both ID and root for an otherwise valid
carrier, and a supplied old or crossed ID/root rejects. Full dual-auth bytes
remain only in immutable journal events and are reverified on recovery.
Downstream prober logic may trust this reference only through branded
reducer-accepted state. A caller-supplied lookalike is not authority.

## Receipt V2 boundary

Module: `prototype/core/receipts.mjs`

A canonical receipt uses schema `nexus-receipt-v2` and the exact keys:

```js
{
  schema,
  receipt_id,
  semantic_receipt_id,
  semantic_receipt_root,
  sequence,
  event_id,
  event_type,
  actor_id,
  job_id,
  predecessor_root,
  next_state_root,
  semantic_event_root,
  authenticated_event_root,
  effects_root,
  result_root,
  invariants_root,
  logical_tick,
  previous_receipt_root,
  previous_semantic_receipt_root
}
```

`receipt_id` is the authentication-dependent ID under `NEXUS_RECEIPT_V2`.
`receiptRoot(receipt)` is the authentication-dependent chain root under
`NEXUS_RECEIPT_CHAIN_V2`; `previous_receipt_root` links that chain. These
values commit `authenticated_event_root` and therefore every exact submitted
inner and outer Ed25519 and ML-DSA-65 signature byte.

`semantic_receipt_id` has prefix `SRCPT-` and is derived under
`NEXUS_SEMANTIC_RECEIPT_ID_V1` from the complete
`nexus-semantic-receipt-v1` projection. Its exact keys are:

```js
{
  schema,
  receipt_schema,
  sequence,
  event_id,
  event_type,
  actor_id,
  job_id,
  predecessor_root,
  next_state_root,
  semantic_event_root,
  effects_root,
  result_root,
  invariants_root,
  logical_tick,
  previous_semantic_receipt_root
}
```

`receipt_schema` is `nexus-receipt-v2`. The
`NEXUS_SEMANTIC_RECEIPT_ID_V1` domain is external to the preimage, not a
projection key. The projection excludes only authentication-dependent
evidence. `semantic_receipt_root` is the deterministic chain root under
`NEXUS_SEMANTIC_RECEIPT_CHAIN_V1`; `previous_semantic_receipt_root` links
that chain.

Application state and downstream terminal references use only
`semantic_receipt_id`. They MUST NOT bind `receipt_id`,
`authenticated_event_root`, or the authenticated receipt-chain root.
Independent valid randomized signatures can therefore change authenticated
receipt evidence without changing the semantic application transition.

Recovery recomputes both IDs and both chain roots, verifies both previous-root
links, and requires `authenticated_event_root` to match the exact supplied
journal event bytes. A semantically equivalent re-signature paired with an
original authenticated receipt is not exact recovery and fails
`ERR_RECOVERY`.

## Resolver surface

Module: `prototype/core/resolver.mjs`

- `createAcceptedRecordResolver(runtime) -> resolver`
- `assertAcceptedRecordResolver(resolver) -> resolver`
- `resolveAcceptedRecord(resolver, request) -> envelope`
- `resolveAcceptedRecordSet(resolver, request) -> setEnvelope`
- `resolveAcceptedRouteContext(resolver, request) -> acceptedRouteContext`
- `deriveDataRouteDecision(acceptedRouteContext) -> decision`

The frozen resolver object also exposes:

- `resolver.resolveAcceptedRecord(request)`
- `resolver.resolveAcceptedRecordSet(request)`
- `resolver.resolveAcceptedRouteContext(request)`

A cloned or shape-compatible object is not a resolver.

Accepted-record request exact shape:

```js
{ record_type, record_id, record_root }
```

Accepted-record V2 response exact shape:

```js
{
  schema: "nexus-accepted-record-envelope-v2",
  accepted_application_state_root,
  accepted_logical_tick,
  record_type,
  record_id,
  record_root,
  record_revision,
  record_status,
  record
}
```

Accepted review-assignment set request exact shape:

```js
{
  record_type: "REVIEW_ASSIGNMENT",
  scope: {
    assignment_slot,
    job_id,
    review_packet_root
  }
}
```

Accepted-record-set V2 response exact shape:

```js
{
  schema: "nexus-accepted-record-set-envelope-v2",
  accepted_application_state_root,
  accepted_logical_tick,
  record_type: "REVIEW_ASSIGNMENT",
  scope,
  scope_root,
  set_root,
  records
}
```

Each set record is exact:

```js
{
  record_id,
  record_root,
  record_revision,
  record_status,
  record
}
```

`scope_root` uses `NEXUS_REVIEW_ASSIGNMENT_SET_SCOPE_V1`. `set_root` uses `NEXUS_ACCEPTED_RECORD_SET_V2` over ordered reference metadata.

Every multi-record adapter requires one accepted application root and one accepted logical tick.

## Reference types

Accepted resolver reference:

```js
{ record_type, record_id, record_root }
```

Embedded schema-owned record reference:

```js
{ record_id, record_root }
```

Route decision reference:

```js
{
  route_execution_plan_id,
  route_execution_plan_root
}
```

References are exact. IDs and roots cannot be crossed, substituted, or refreshed independently.

## Consent and authority topology

Canonical authority follows:

`controller -> principal -> seat -> consent -> capability offer -> assignment/lease -> action`

Controller status, key, scope, consent, offer revocation, probe validity, conflict policy, and logical tick are resolved from accepted state. Caller booleans do not satisfy these conditions.

Core-derived carrier IDs use schema-specific ID domains over ID-excluded bodies. Record roots use schema-specific domains over exact canonical bodies. Raw transport authentication, signature bytes, receipts, and operational metadata are not record authority. The exact six-field verified authentication reference is not raw authentication metadata: it is mandatory canonical identity material in capability-offer and donated-consent carriers and is committed to both their IDs and roots.

## Work public surfaces

Module: `prototype/work/broker.mjs`

- `bidRevealHash(reveal)`
- `bidScore(reveal)`
- `compareBidScores(leftScore, rightScore)`
- `compareBidReveals(leftReveal, rightReveal)`
- `rankEligibleBids(entries)`
- `selectWinningBid(entries)`

Module: `prototype/work/prober.mjs`

- `capabilityOfferRoot(offer)`
- `capabilityOfferBindingRoot(offer)`
- `capabilityProbeRoot(probe)`
- `donatedCapacityConsentRoot(consent)`
- `evaluateOfferEligibility(input)`

`capabilityOfferRoot()` and `donatedCapacityConsentRoot()` require the exact
six-field verified authentication reference and reject missing or extra
reference fields. The corresponding V2 carrier ID domains use ID-excluded v1
bodies that still contain that reference. The V2 root domains hash exact v1
carrier bodies that also contain it. Raw signatures are never carrier fields.
Auth-free offer terms and consent body roots remain V1 pre-authentication inputs
and MUST NOT be substituted for accepted carrier IDs or roots.

Carrier root helpers distinguish absence from an invalid present own ID with
`Object.hasOwn(record, ownIdKey)`. `capabilityOfferRoot()` uses `offer_id`;
`donatedCapacityConsentRecordRoot()` and its
`donatedCapacityConsentRoot()` public wrapper use `consent_id`. When
`Object.hasOwn(...)` is false, the helper derives the own ID internally. When it
is true, the value MUST be the exact canonical derived ID. Present `null`,
explicit `undefined`, non-string, malformed, or canonical-looking mismatched
values fail `ERR_ID_PREIMAGE`. An absent own ID and the exact valid present own
ID produce the same accepted-record root.

`evaluateOfferEligibility` input exact keys:

```js
{
  resolver,
  evaluationKind,
  capabilityOfferRef,
  donatedCapacityConsentRef,
  jobRef,
  jobContractRef,
  conflictPolicyRef,
  taskRef,
  bidRef,
  probe
}
```

`evaluationKind` is `BID` or `TASK`. Bid and task references are mutually exclusive.

Module: `prototype/work/scheduler.mjs`

- `evaluateTaskReadiness({task,job,tick,tasksById,activeLeases = [],eligibleWorkerSeatIds = [],maxAttempts,remainingComputeUnits,routeSupported})`
- `taskOrderKey(task)`
- `compareTaskOrder(leftTask, rightTask)`
- `orderReadyTasks(tasks)`
- `scheduleReadyTasks(contexts)`

Broker and scheduler functions are pure. The prober obtains accepted authority through the resolver and pins one accepted root/tick.

## Review public surfaces

Module: `prototype/review/reviews.mjs`

- `assertAcceptedRecordReference(reference, expectedType, label = "acceptedRecordRef")`
- `createAcceptedResolutionContext(resolver)`
- `resolveAcceptedReference(context, reference, expectedType, {immutable = false,label = "acceptedRecordRef"} = {})`
- `resolveAcceptedAssignmentSet(context, {jobId,packetRoot,assignmentSlot}, label = "reviewAssignmentSet")`
- `validateReviewPacketValue(packet)`
- `reviewerEligibilityRoot(facts)`
- `modelReviewHash(review)`
- `modelReviewId(review)`
- `resolveAssignmentAuthorities(context, assignmentEnvelope)`
- `evaluateReviewerEligibility(input)`
- `selectReviewAssignments(input)`
- `selectReviewReplacement(input)`
- `validateReviewPacketBinding(input)`

Main exact inputs:

```js
// evaluateReviewerEligibility
{ resolver, candidate, jobRef, packetRef }

// selectReviewAssignments
{
  resolver,
  jobRef,
  packetRef,
  jobAttempt,
  candidates,
  amount,
  notBeforeTick,
  expiryTick
}

// selectReviewReplacement
{
  resolver,
  expiredAssignmentRef,
  candidates,
  jobRef,
  replacementExpiryTick
}

// validateReviewPacketBinding
{ resolver, reviewRef, assignmentRef, packetRef }
```

Module: `prototype/review/clearance.mjs`

- `checkResultId(check)`
- `requiredCheckManifestRoot(manifest)`
- `reviewPacketRoot(packet)`
- `computeDeterministicEvidenceRoot(input)`
- `buildDiversityVector({reviews,assignments,reviewerOffers})`
- `diversityLabels(vector)`
- `requiredDiversityReasonCodes({diversityVector,requiredDimensions,requiredReviewCount})`
- `reviewFindingsVetoClearance(review)`
- `computeClearanceRoot({packetRoot,orderedReviewHashes,diversityVector,deterministicEvidenceRoot,policyRoot})`
- `computeHoldRoot({jobId,contractRoot,attempt,artifactRoot,packetRoot,orderedReviewHashes,deterministicEvidenceRoot,orderedReasonCodes,policyRoot})`
- `computeThreeReviewOutcome(input)`

Review closure is packet V2, exactly three accepted reviews, exact assignment binding, and the configured `DISTINCT` dimensions. Replacement history uses the V2 accepted set.

## Classified measurement and route V5

Security-critical event payloads are exact.

`RECORD_CLASSIFIED_INPUT_MEASUREMENT`:

```js
{
  job_ref,
  task_ref,
  lease_ref,
  entries
}
```

Each entry is exact `{input_root,data_class,byte_length}`.

`ISSUE_LEASE`:

```js
{
  job_id,
  task_id,
  context_root,
  input_manifest_root,
  not_before_tick,
  expiry_tick,
  lease_nonce
}
```

`CREATE_ROUTE_EXECUTION_PLAN`:

```js
{
  lease_ref,
  classified_input_manifest_ref,
  data_route_authority_ref,
  redaction_approval_ref,
  tool_route_authority_refs,
  plan_nonce
}
```

`CONSUME_ROUTE_EXECUTION_PLAN`:

```js
{
  route_execution_plan_id,
  route_execution_plan_root,
  expected_decision_root
}
```

Current schemas:

- `nexus-classified-input-manifest-v2`
- `nexus-worker-trust-authority-v1`
- `nexus-route-execution-plan-v5`
- `nexus-accepted-route-context-v1`
- `nexus-data-route-decision-v5`
- `nexus-route-plan-consumption-v1`

Module: `prototype/core/route-v5.mjs`

- `classifiedInputManifestRoot(body)`
- `createClassifiedInputManifest(fields)`
- `workerTrustAuthorityRoot(body)`
- `createWorkerTrustAuthority(fields)`
- `routeExecutionPlanV5Root(body)`
- `createRouteExecutionPlan(fields)`
- `routePlanConsumptionRoot(body)`
- `createRoutePlanConsumption(fields)`
- `deriveDataRouteDecisionFromFacts(context)`

These are pure schema/root/decision helpers. `deriveDataRouteDecisionFromFacts` is not an accepted-authority API.

Module: `prototype/privacy/routing.mjs`

- `decideDataRoute(reference, options)`

Exact call:

```js
decideDataRoute(
  {
    route_execution_plan_id,
    route_execution_plan_root
  },
  {
    resolver
  }
)
```

The adapter resolves a branded route context and returns the shared `nexus-data-route-decision-v5` unchanged. Outcomes are `ALLOW` and `HOLD`.

## Privacy authority and disclosure surfaces

Module: `prototype/privacy/authority.mjs`

- `assertRoot(value, label)`
- `assertRecordId(value, label)`
- `nonceOneUseCommitment({purpose,scope_root,nonce_commitment})`
- `entropyFreshnessAuthorityRoot(authority)`
- `entropyOneUseClaimRoot(claim)`
- `entropyOneUseConsumptionRoot(consumption)`
- `assertAcceptedCoreRecordEnvelope(envelope, request)`
- `resolveAcceptedCoreRecord(resolver, request)`
- `verifyAcceptedEntropyUse(references, {resolver})`

`assertAcceptedCoreRecordEnvelope` requires the exact frozen V2 envelope, a safe accepted tick, and the requested current ID/root/status. Entropy authority and consumption must share one accepted root/tick.

Module: `prototype/privacy/disclosure.mjs`

- `computeDisclosurePolicyRoot(policy)`
- `computeAcceptedDisclosurePolicyRoot(record)`
- `computeDisclosureProofContextRoot(proofContext)`
- `computeAcceptedDisclosureProofContextRoot(record)`
- `computeDisclosurePreparationAuthorityRoot(authority)`
- `computePublicExportAuthorityRoot(authority)`
- `computePublicJobSummaryRoot(input)`
- `prepareDisclosureContent(references, {resolver})`
- `verifyDisclosurePreparation(preparation, references, {resolver})`
- `verifyDisclosureManifest(manifest, expected)`
- `finalizeDisclosure(references, {resolver})`
- `verifyDisclosureCompilation(compilation, context, {resolver})`

Module: `prototype/privacy/nonclaims.mjs`

- `createCanonicalNonClaims(input)`
- `verifyCanonicalNonClaims(record, expected)`

Disclosure constructors and verifiers accept purpose-specific exact references, resolve accepted records, and recompute canonical provenance. Private preimages are excluded from public-safe outputs.

## GitHub public and operational surfaces

Module: `prototype/github/capsule.mjs`

- `validateDiversityLabels(labels)`
- `validateRepositoryWitness(witness)`
- `validatePublicCapsuleShape(capsule)`
- `resolveCompilationAnchor(resolver, anchorId, anchorRoot, expected = null)`
- `createPublicCapsule(references, {resolver})`

Capsule references exact shape:

```js
{
  non_claims_id,
  non_claims_root,
  public_capsule_id,
  public_capsule_root
}
```

Module: `prototype/github/intent.mjs`

- `publicationIntentNonceScopeRoot(intent)`
- `publicationIntentRoot(intent)`
- `createPublicationIntent({publication_intent_id,publication_intent_root}, {resolver})`
- `verifyPublicationIntent(intent, {accepted_intent_root,expected = {},resolver})`

Publication destination is fixed to `GITHUB_SANITIZED_WITNESS`.

Module: `prototype/github/verifier.mjs`

- `verifyPublicCapsule(input, {resolver})`

Verifier input exact shape:

```js
{
  capsule,
  disclosure,
  non_claims,
  publication_anchor_id,
  publication_anchor_root,
  publication_intent
}
```

The verifier returns `nexus-public-capsule-verification-v3` and `status_authority:"NONE"`.

Module: `prototype/github/outbox.mjs`

- `assertOperationalOutboxStatus(status)`
- `createOperationalOutboxStatus(intentId)`
- `recordOperationalAttempt(current, {status,reason_code})`

Outbox exact shape:

```js
{
  schema,
  intent_id,
  attempt,
  status,
  last_reason_code
}
```

Statuses are `PENDING`, `PUBLISHED`, `FAILED_RETRYABLE`, and `FAILED_TERMINAL`. Outbox values are not canonical protocol state.

## Rejection and downgrade rules

All public object boundaries use exact keys.

The implementation rejects:

- Unbranded runtimes, resolvers, and accepted route contexts.
- Accepted envelope V1, missing or unsafe accepted ticks, and extra envelope keys.
- Stale, crossed, mixed-root, mixed-tick, revoked, expired, or wrong-status references.
- Caller-selected derived IDs or mismatched ID/root preimages.
- Raw V4 routing facts, checks, booleans, prices, funding, routes, or ticks.
- Legacy review, disclosure, capsule, intent, anchor, verifier, or publication wrappers.
- Unknown event payload keys and compatibility aliases.
- `SIM_AUTH_UNSAFE`, one-key hybrid profiles, missing hybrid signatures,
  non-canonical key/signature encodings, and unknown identity schemes.
- Replayed one-use authority and conflicting idempotency bytes.

There is no compatibility fallback inside the canonical trust boundary.

## Persistence limitation

The prototype runtime, resolver brands, journals, idempotency indexes, and outbox are in memory. The API defines deterministic state transition and recovery semantics, not a durable multi-process storage protocol.
