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

`recoverRuntime` accepts exactly `{events,expectedFinalRoot,genesisState,receipts}`. It replays and verifies the complete journal.

`applyEvent` verifies first, reduces a clone, checks invariants, and commits atomically. Its return value is deeply frozen. Identical authenticated bytes may replay; conflicting event or idempotency reuse fails.

## Event and authentication surface

Module: `prototype/core/auth.mjs`

- `assertEventIngress(event)`
- `eventBodyRoot(event)`
- `authenticatedEventRoot(event)`
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
  scheme,
  key_id,
  controller_id,
  signed_domain,
  signed_payload_root,
  signature
}
```

The signed domain is `NEXUS_EVENT_AUTH_V1`. The prototype scheme is explicitly `SIM_AUTH_UNSAFE`.

Authentication preimage exact shape:

```js
{
  schema: "nexus-event-auth-preimage-v1",
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

`event_id` is `EVT-${eventBodyRoot(event)}`. Event-type payload allowlists are exact; missing and extra fields fail.

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

Core-derived carrier IDs use schema-specific ID domains over ID-excluded bodies. Record roots use schema-specific domains over exact canonical bodies. Authentication and operational metadata are not record authority.

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
- Replayed one-use authority and conflicting idempotency bytes.

There is no compatibility fallback inside the canonical trust boundary.

## Persistence limitation

The prototype runtime, resolver brands, journals, idempotency indexes, and outbox are in memory. The API defines deterministic state transition and recovery semantics, not a durable multi-process storage protocol.
