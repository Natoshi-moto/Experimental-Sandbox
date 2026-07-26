import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import {
  assertCanonicalValue,
  canonicalize,
  parseStrictJson,
} from "../core/canonical.mjs";
import {
  authenticatedEventRoot,
  buildEvent as buildHybridEvent,
  buildIndependentControllerAuthentication as buildHybridIndependentControllerAuthentication,
  eventBodyRoot,
  semanticEventRoot,
} from "../core/auth.mjs";
import { ProtocolError } from "../core/errors.mjs";
import { hash, rootId } from "../core/hash.mjs";
import {
  receiptRoot,
  semanticReceiptRoot,
} from "../core/receipts.mjs";
import {
  verifiedHybridAuthenticationReference,
} from "../core/identity.mjs";
import {
  applyEvent,
  acceptedDisclosurePreparationRoot,
  capabilityOfferRoot,
  capabilityOfferContentRoot,
  capabilityOfferTermsRoot,
  deriveDisclosurePreparationBindings,
  derivedCarrierId,
  disclosurePreparationExecutionReceiptRoot,
  disclosurePreparationVerifierAuthorityRoot,
  donatedCapacityConsentBodyRoot,
  donatedCapacityConsentRecordRoot,
  nonClaimsRoot,
  publicCapsuleRoot,
  publicSafeDisclosureManifestRoot,
  recoverRuntime,
  snapshotRuntime,
  verifyDisclosurePreparationBindings,
  acceptedDisclosureCompilationAnchorRoot,
  acceptedPublicationAnchorRoot,
  bidCommitment,
  createRuntime,
  currentRoot,
  disclosureCompilationRoot,
  entropyFreshnessAuthorityRoot,
  entropyOneUseClaimRoot,
  exportNonceCommitment,
  nonceOneUseAuthorityRoot,
  publicationApprovalContextRoot,
  publicationIntentId,
  publicationUseScopeRoot,
  publicExportScopeRoot,
  publicExportAuthorityRoot,
  publicExportStageRoots,
  requiredCheckManifestRoot,
  verifierAuthorityRoot,
  verifierExecutionReceiptAnchorRoot,
  contractRouteContextRoot,
  dataRouteAuthorityRoot,
  disclosureApprovalReceiptRoot,
  disclosureCompilationAnchorV2Root,
  disclosureCompilationV2Root,
  disclosurePreparationRoot,
  disclosureScannerAuthorityRoot,
  disclosureScanReceiptRoot,
  publicationAnchorV2Root,
  redactionApprovalAuthorityRoot,
  redactionApprovalV2Root,
  redactionManifestV2Root,
  remoteRedactionPolicyRoot,
  toolRouteAuthorityRoot,
  acceptedDisclosurePolicyCarrierRoot,
  acceptedDisclosureProofContextCarrierRoot,
  disclosurePolicyRoot,
  disclosurePreparationAuthorityContextId,
  disclosurePreparationAuthorityRoot,
  disclosurePreparationNonceScopeRoot,
  disclosurePreparationUseScopeRoot,
  disclosureProofContextRoot,
  disclosureSaltEntropyConsumptionsRoot,
  entropyAuthorityContextId,
  entropyFreshnessAuthorityV1Root,
  entropyOneUseClaimV1Root,
  entropyOneUseCommitmentRoot,
  publicationApprovalAuthorityV3Root,
  publicationIntentNonceCommitmentRoot,
  publicationIntentNonceScopeRoot,
  publicationIntentUseScopeRoot,
  publicationIntentV2Id,
  publicationIntentV3Id,
  publicExportAuthorityContextId,
  publicExportAuthorityV3Root,
} from "../core/reducer.mjs";
import {
  assertAcceptedRecordResolver,
  createAcceptedRecordResolver,
  deriveDataRouteDecision,
  resolveAcceptedRecord,
  resolveAcceptedRecordSet,
  resolveAcceptedRouteContext,
} from "../core/resolver.mjs";
import { createRecord } from "../core/records.mjs";
import {
  createFixtureState as createHybridFixtureState,
  findAccountForPrincipal,
  findPrincipalByAlias,
} from "../core/state.mjs";
import { conservedSupply } from "../economy/funding.mjs";
import {
  capabilityOfferBindingRoot,
  capabilityProbeRoot,
} from "../work/prober.mjs";
import {
  HYBRID_TEST_IDENTITY_ALIASES,
  hybridPrivateKeyPairFixture,
  hybridPublicKeyPairFixture,
} from "./hybrid-identity-fixtures.mjs";

const HYBRID_TEST_IDENTITY_SET = new Set(
  HYBRID_TEST_IDENTITY_ALIASES,
);

function createFixtureState(options) {
  return createHybridFixtureState({
    ...options,
    principals: options.principals.map((fixture, index) => {
      const identityAlias = HYBRID_TEST_IDENTITY_SET.has(fixture.alias)
        ? fixture.alias
        : ["rotation-next", "attacker"][index % 2];
      return {
        ...fixture,
        ...hybridPublicKeyPairFixture(identityAlias),
      };
    }),
  });
}

function buildEvent(state, input) {
  const actorAlias = state.principals[input.actorId]?.display_alias;
  return buildHybridEvent(state, {
    ...input,
    privateKeyPair:
      input.privateKeyPair ??
      hybridPrivateKeyPairFixture(actorAlias),
  });
}

function buildIndependentControllerAuthentication(state, input) {
  const actorAlias =
    state.principals[input.principalId]?.display_alias;
  return buildHybridIndependentControllerAuthentication(state, {
    ...input,
    privateKeyPair:
      input.privateKeyPair ??
      hybridPrivateKeyPairFixture(actorAlias),
  });
}

export const CORE_ECONOMY_EVENT_SEQUENCE = Object.freeze([
  "CREATE_JOB",
  "REGISTER_OFFER",
  "CONTRIBUTE",
  "OPEN_BID_ROUND",
  "COMMIT_BID",
  "ADVANCE_TICK",
  "REVEAL_BID",
  "ADVANCE_TICK",
  "SELECT_BID",
  "ACCEPT_BID",
  "ISSUE_ALLOWANCE",
  "AUTHORIZE_SUBWORK",
  "ISSUE_LEASE",
  "SUBMIT_LEASE_RETURN",
  "ACCEPT_SUBWORK_RETURN",
  "ACCEPT_LEAD_RETURN",
  "ACCEPT_DETERMINISTIC_EVIDENCE",
  "ENTER_REVIEW",
  "ASSIGN_REVIEWERS",
  "REPLACE_REVIEWER",
  "ACCEPT_ASSIGNED_REVIEW",
  "COMPUTE_REVIEW_OUTCOME",
  "HUMAN_DECISION",
  "FILE_APPEAL",
  "RESOLVE_APPEAL",
  "ADVANCE_TICK",
  "SETTLE_JOB",
  "ACCEPT_DISCLOSURE_POLICY",
  "ACCEPT_DISCLOSURE_PROOF_CONTEXT",
  "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
  "AUTHORIZE_DISCLOSURE_PREPARATION",
  "CONSUME_ENTROPY_AUTHORITY",
  "RECORD_DISCLOSURE_SCAN",
  "RECORD_DISCLOSURE_APPROVAL",
  "COMMIT_PUBLIC_EXPORT_AUTHORITY",
  "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
  "CONSUME_ENTROPY_AUTHORITY",
  "CREATE_PUBLICATION_INTENT",
]);

const DISCLOSURE_POLICY = Object.freeze({
  schema: "nexus-disclosure-policy-v1",
  fields: [
    {
      classification: "COMMITMENT_ONLY",
      path: "human_publication_approval_root",
      proof_kind: "DERIVED_PUBLICATION_APPROVAL",
      value_kind: "ROOT",
    },
    {
      classification: "OMITTED",
      path: "internal_job_id",
      proof_kind: "OMISSION",
      value_kind: "PLAIN",
    },
    {
      classification: "PUBLIC",
      path: "public_job_id",
      proof_kind: "DERIVED_PUBLIC_JOB",
      value_kind: "PLAIN",
    },
    {
      classification: "COMMITMENT_ONLY",
      path: "secret_scan_evidence_root",
      proof_kind: "DERIVED_SECRET_SCAN",
      value_kind: "ROOT",
    },
  ],
});

const DISCLOSURE_PROOF_CONTEXT = Object.freeze({
  schema: "nexus-disclosure-proof-context-v2",
  proofs: [
    {
      schema: "nexus-disclosure-proof-v2",
      entropy_authority_id: null,
      entropy_authority_root: null,
      path: "internal_job_id",
      preimage: null,
      producer: "OMISSION",
      salt: null,
      value: null,
    },
  ],
});

const ROOTS = Object.freeze({
  acceptance: hash("NEXUS_TEST_ROOT_V1", { name: "acceptance" }),
  artifact: hash("NEXUS_TEST_ROOT_V1", { name: "artifact" }),
  attribution: hash("NEXUS_TEST_ROOT_V1", { name: "attribution" }),
  commands: hash("NEXUS_TEST_ROOT_V1", { name: "commands" }),
  context: hash("NEXUS_TEST_ROOT_V1", { name: "context" }),
  evidence: hash("NEXUS_TEST_ROOT_V1", { name: "evidence" }),
  isolation: hash("NEXUS_TEST_ROOT_V1", { name: "isolation" }),
  manifest: hash("NEXUS_TEST_ROOT_V1", { name: "manifest" }),
  maximumCapability: hash("NEXUS_TEST_ROOT_V1", {
    name: "maximum-capability",
  }),
  policy: hash("NEXUS_TEST_ROOT_V1", { name: "contract-policy" }),
  source: hash("NEXUS_TEST_ROOT_V1", { name: "source" }),
  terms: hash("NEXUS_TEST_ROOT_V1", { name: "contribution-terms" }),
  verifier: hash("NEXUS_TEST_ROOT_V1", { name: "verifier" }),
  workerAck: hash("NEXUS_TEST_ROOT_V1", { name: "worker-acknowledgement" }),
  checkEnvironment: hash("NEXUS_TEST_ROOT_V1", { name: "check-environment" }),
  disclosurePolicy: disclosurePolicyRoot(DISCLOSURE_POLICY),
  secretScanPolicy: hash("NEXUS_TEST_ROOT_V1", { name: "secret-scan-policy" }),
  approvalPolicy: hash("NEXUS_TEST_ROOT_V1", { name: "approval-policy" }),
});

function expectCode(code, fn) {
  assert.throws(fn, (error) => {
    assert(error instanceof ProtocolError);
    assert.equal(error.code, code);
    return true;
  });
}

const VERIFIED_AUTH_REFERENCE_FIELDS = Object.freeze([
  "schema",
  "scheme",
  "key_id",
  "controller_id",
  "signed_domain",
  "signed_payload_root",
]);

function mutatedVerifiedAuthenticationReference(reference, field) {
  const changed = structuredClone(reference);
  if (field === "signed_payload_root") {
    changed[field] = changed[field].replace(
      /^./,
      (character) => (character === "0" ? "1" : "0"),
    );
  } else {
    changed[field] = `${changed[field]}-changed`;
  }
  return changed;
}

function assertCarrierAuthenticationReferenceBinding({
  recordType,
  idField,
  record,
  rootFn,
  expectedRoot,
  invalidMutationFields,
}) {
  for (const field of VERIFIED_AUTH_REFERENCE_FIELDS) {
    const changed = {
      ...record,
      authentication: mutatedVerifiedAuthenticationReference(
        record.authentication,
        field,
      ),
    };
    if (invalidMutationFields.has(field)) {
      expectCode(
        "ERR_AUTHORITY",
        () => derivedCarrierId(recordType, changed),
      );
      expectCode("ERR_AUTHORITY", () => rootFn(changed));
      continue;
    }
    const changedId = derivedCarrierId(recordType, changed);
    assert.notEqual(changedId, record[idField]);
    expectCode("ERR_ID_PREIMAGE", () => rootFn(changed));
    const rebound = { ...changed, [idField]: changedId };
    assert.notEqual(rootFn(rebound), expectedRoot);
  }
  for (const field of VERIFIED_AUTH_REFERENCE_FIELDS) {
    const missing = structuredClone(record);
    delete missing.authentication[field];
    expectCode(
      "ERR_SCHEMA",
      () => derivedCarrierId(recordType, missing),
    );
    expectCode("ERR_SCHEMA", () => rootFn(missing));
  }
  const extended = structuredClone(record);
  extended.authentication.unexpected = true;
  expectCode(
    "ERR_SCHEMA",
    () => derivedCarrierId(recordType, extended),
  );
  expectCode("ERR_SCHEMA", () => rootFn(extended));
}

function snapshotOf(context) {
  return snapshotRuntime(context.runtime);
}

function stateOf(context) {
  return snapshotOf(context).state;
}

function receiptsOf(context) {
  return snapshotOf(context).receipts;
}

function principal(context, alias) {
  return findPrincipalByAlias(stateOf(context), alias);
}

function account(context, alias) {
  return findAccountForPrincipal(
    stateOf(context),
    principal(context, alias).principal_id,
  );
}

function emit(context, actorAlias, eventType, payload, nonce) {
  const event = buildEvent(stateOf(context), {
    eventType,
    actorId: principal(context, actorAlias).principal_id,
    payload,
    nonce,
  });
  const outcome = applyEvent(context.runtime, event);
  context.events.push(event);
  return { event, ...outcome };
}

function buildContextBoundEvent(
  context,
  actorAlias,
  eventType,
  nonce,
  payloadForId,
  idForEvent,
) {
  const actorId = principal(context, actorAlias).principal_id;
  const probe = buildEvent(stateOf(context), {
    eventType,
    actorId,
    payload: payloadForId("PENDING"),
    nonce,
  });
  const id = idForEvent(probe);
  const event = buildEvent(stateOf(context), {
    eventType,
    actorId,
    payload: payloadForId(id),
    nonce,
  });
  assert.equal(idForEvent(event), id);
  assert.notEqual(
    idForEvent({
      ...event,
      idempotency_key: `${event.idempotency_key}-changed`,
    }),
    id,
  );
  return event;
}

function emitContextBound(
  context,
  actorAlias,
  eventType,
  nonce,
  payloadForId,
  idForEvent,
) {
  const event = buildContextBoundEvent(
    context,
    actorAlias,
    eventType,
    nonce,
    payloadForId,
    idForEvent,
  );
  const outcome = applyEvent(context.runtime, event);
  context.events.push(event);
  return { event, ...outcome };
}

export function createCoreEconomyFixture() {
  const state = createFixtureState({
    projectPoolAlias: "project-pool",
    principals: [
      { alias: "project-pool", balance: 100, scopes: ["*"] },
      { alias: "requester", balance: 1000, scopes: ["*"] },
      { alias: "worker", balance: 0, scopes: ["*"] },
      { alias: "subworker", balance: 0, scopes: ["*"] },
      { alias: "verifier", balance: 0, scopes: ["*"] },
      { alias: "reviewer-a", balance: 0, scopes: ["*"] },
      { alias: "reviewer-b", balance: 0, scopes: ["*"] },
      { alias: "reviewer-c", balance: 0, scopes: ["*"] },
      { alias: "reviewer-d", balance: 0, scopes: ["*"] },
      { alias: "resolver", balance: 0, scopes: ["*"] },
      {
        alias: "clock",
        balance: 0,
        scopes: ["ADVANCE_TICK", "CLOCK_ADVANCER"],
      },
    ],
  });
  return {
    runtime: createRuntime(state),
    events: [],
    genesisState: structuredClone(state),
  };
}

function jobPayload(context, jobNonce = "job-1") {
  return {
    repository: "nexus/example",
    base_commit: "0123456789abcdef0123456789abcdef01234567",
    maintainer_principal_id: principal(context, "requester").principal_id,
    project_pool_account_id: account(context, "project-pool").account_id,
    title: "Deterministic core/economy fixture",
    spec_root: "spec-root-v1",
    acceptance_root: ROOTS.acceptance,
    source_root: "initial-source-root-v1",
    context_root: ROOTS.context,
    maximum_artifact_bytes: 100000,
    data_class: "PUBLIC",
    remote_execution: false,
    budget: 100,
    deadline_tick: 30,
    max_attempts: 1,
    max_subworkers: 1,
    max_subworker_budget: 20,
    fixed_verification_cost: 10,
    max_compute_units: 150,
    required_check_names: ["lint", "tests"],
    check_environment_root: ROOTS.checkEnvironment,
    allowed_worker_principal_ids: [
      principal(context, "worker").principal_id,
      principal(context, "subworker").principal_id,
      principal(context, "reviewer-a").principal_id,
      principal(context, "reviewer-b").principal_id,
      principal(context, "reviewer-c").principal_id,
      principal(context, "reviewer-d").principal_id,
    ].sort(),
    allowed_model_ids: [
      "review-model-a",
      "review-model-b",
      "review-model-c",
      "review-model-d",
      "subworker-model",
      "worker-model",
    ].sort(),
    allowed_provider_families: [
      "review-provider-a",
      "review-provider-b",
      "review-provider-c",
      "review-provider-d",
      "subworker-provider",
      "worker-provider",
    ].sort(),
    allowed_operator_ids: [
      "review-operator-a",
      "review-operator-b",
      "review-operator-c",
      "review-operator-d",
      "subworker-operator",
      "worker-operator",
    ].sort(),
    allowed_tools: ["node"],
    allowed_runtimes: ["node"],
    allowed_routes: ["LOCAL"],
    egress_allowlist: [],
    required_isolation_root: ROOTS.isolation,
    trusted_worker_policy_root: "trusted-worker-policy-root-v1",
    maximum_capability_root: ROOTS.maximumCapability,
    allowed_licences: ["MIT"],
    contribution_terms_root: ROOTS.terms,
    attribution_policy_root: "attribution-policy-root-v1",
    lead_worker_amount_ceiling: 30,
    reviewer_amount_each: 10,
    verification_recipient_account_id: account(context, "verifier").account_id,
    timeout_policy_root: "timeout-policy-root-v1",
    abort_policy_root: "abort-policy-root-v1",
    allowed_appeal_grounds: ["QUALITY"],
    filing_deadline_ticks: 2,
    resolution_deadline_ticks: 3,
    resolver_principal_ids: [principal(context, "resolver").principal_id],
    hold_timeout_ticks: 2,
    verifier_root: ROOTS.verifier,
    policy_root: ROOTS.policy,
    disclosure_policy_root: ROOTS.disclosurePolicy,
    secret_scan_policy_root: ROOTS.secretScanPolicy,
    approval_policy_root: ROOTS.approvalPolicy,
    job_nonce: jobNonce,
  };
}

function createJob(context, nonce = "create-job-1") {
  return emit(
    context,
    "requester",
    "CREATE_JOB",
    jobPayload(context),
    nonce,
  );
}

function registerOffer(
  context,
  {
    alias,
    model,
    provider,
    operator,
    jobId,
    nonce,
    maximumCapabilityRoot = ROOTS.maximumCapability,
  },
) {
  const accepted = emit(
    context,
    alias,
    "REGISTER_OFFER",
    {
      offer_mode: "PAID",
      worker_class: "REGISTERED",
      owner_consent_id: null,
      owner_consent_root: null,
      project_allowlist: [],
      job_allowlist: [jobId],
      model_id: model,
      provider_family: provider,
      operator_id: operator,
      route: "LOCAL",
      data_classes: ["PUBLIC"],
      tools: ["node"],
      runtimes: ["node"],
      egress_allowlist: [],
      max_input_bytes: 100000,
      max_output_bytes: 100000,
      max_compute_units: 100,
      max_active_leases: 1,
      isolation_root: ROOTS.isolation,
      trusted_worker_policy_root: "trusted-worker-policy-root-v1",
      maximum_capability_root: maximumCapabilityRoot,
      contribution_terms_allowlist: [ROOTS.terms],
      attribution: "PUBLIC_ALIAS",
      probe_root: `probe-${alias}`,
      not_before_tick: 0,
      expiry_tick: 30,
      seat_nonce: `seat-${alias}`,
      offer_nonce: `offer-${alias}`,
    },
    nonce,
  );
  const record =
    stateOf(context).capability_offers[accepted.result.offer_id];
  return {
    ...accepted,
    result: {
      ...accepted.result,
      offer_root: capabilityOfferRoot(record),
    },
  };
}

export function prepareCommittedBid() {
  const context = createCoreEconomyFixture();
  const created = createJob(context);
  const jobId = created.result.job_id;
  const workerOffer = registerOffer(context, {
    alias: "worker",
    model: "worker-model",
    provider: "worker-provider",
    operator: "worker-operator",
    jobId,
    nonce: "register-worker",
  }).result;
  const subworkerOffer = registerOffer(context, {
    alias: "subworker",
    model: "subworker-model",
    provider: "subworker-provider",
    operator: "subworker-operator",
    jobId,
    nonce: "register-subworker",
  }).result;
  const reviewerSpecs = ["a", "b", "c", "d"].map((suffix) => ({
    alias: `reviewer-${suffix}`,
    model: `review-model-${suffix}`,
    provider: `review-provider-${suffix}`,
    operator: `review-operator-${suffix}`,
    jobId,
    nonce: `register-reviewer-${suffix}`,
  }));
  const reviewerOffers = reviewerSpecs.map((spec) => ({
    spec,
    ...registerOffer(context, spec).result,
  }));
  const requesterAccountBefore = structuredClone(account(context, "requester"));
  const contribution = emit(
    context,
    "requester",
    "CONTRIBUTE",
    {
      job_id: jobId,
      amount: 100,
      kind: "PLEDGE",
      sponsor_account_id: requesterAccountBefore.account_id,
      disclosure_acknowledgement_root: "contribution-disclosure-root-v1",
      attribution: "PUBLIC_ALIAS",
      contribution_nonce: "contribution-1",
    },
    "contribute-1",
  ).result;
  const requesterAccountAfter = account(context, "requester");
  assert.equal(requesterAccountAfter.account_id, requesterAccountBefore.account_id);
  assert.equal(
    requesterAccountAfter.previous_record_root,
    requesterAccountBefore.record_root,
  );
  assert.equal(
    requesterAccountAfter.record_revision,
    requesterAccountBefore.record_revision + 1,
  );
  const round = emit(
    context,
    "requester",
    "OPEN_BID_ROUND",
    {
      job_id: jobId,
      open_tick: 0,
      commit_close_tick: 1,
      reveal_close_tick: 2,
      acceptance_deadline_tick: 4,
      round_nonce: "round-1",
    },
    "open-round-1",
  ).result;
  const job = stateOf(context).jobs[jobId];
  const reveal = {
    schema: "nexus-bid-reveal-v1",
    round_id: round.round_id,
    job_id: jobId,
    job_version: job.version,
    draft_contract_root: job.draft_contract_root,
    bidder_principal_id: principal(context, "worker").principal_id,
    worker_seat_id: workerOffer.worker_seat_id,
    capability_offer_root: workerOffer.offer_root,
    price: 30,
    completion_ticks: 5,
    max_compute_units: 40,
    model_id: "worker-model",
    provider_family: "worker-provider",
    operator_id: "worker-operator",
    probe_root: "probe-worker",
    nonce: "bid-reveal-1",
    salt: "00112233445566778899aabbccddeeff",
  };
  const unknownOfferRoot = hash("NEXUS_TEST_ROOT_V1", {
    name: "unknown-capability-offer",
  });
  const unknownOfferEvent = buildEvent(stateOf(context), {
    eventType: "COMMIT_BID",
    actorId: principal(context, "worker").principal_id,
    payload: {
      round_id: round.round_id,
      worker_seat_id: workerOffer.worker_seat_id,
      capability_offer_root: unknownOfferRoot,
      commitment: bidCommitment({
        ...reveal,
        capability_offer_root: unknownOfferRoot,
      }),
      bid_nonce: "unknown-offer-bid",
    },
    nonce: "unknown-offer-bid",
  });
  expectCode(
    "ERR_CAPABILITY",
    () => applyEvent(context.runtime, unknownOfferEvent),
  );
  const committed = emit(
    context,
    "worker",
    "COMMIT_BID",
    {
      round_id: round.round_id,
      worker_seat_id: workerOffer.worker_seat_id,
      capability_offer_root: workerOffer.offer_root,
      commitment: bidCommitment(reveal),
      bid_nonce: "bid-1",
    },
    "commit-bid-1",
  ).result;
  return {
    context,
    jobId,
    contribution,
    round,
    reveal,
    bidId: committed.bid_id,
    workerOffer,
    subworkerOffer,
    reviewerOffers,
  };
}

function advance(context, nonce) {
  return emit(context, "clock", "ADVANCE_TICK", {}, nonce);
}

export function continueToReviewOutcome(
  prepared,
  verdicts = ["CLEAR", "CLEAR", "CLEAR"],
  {
    reviewExpiryTick = 20,
    assignmentExpiryTick = 10,
    assignmentExpiryTicks = null,
    stopBeforeAssignments = false,
    stopAfterAssignments = false,
    stopAfterReviews = false,
  } = {},
) {
  const {
    context,
    jobId,
    reveal,
    bidId,
    reviewerOffers,
  } = prepared;
  advance(context, "tick-1");
  emit(
    context,
    "worker",
    "REVEAL_BID",
    { bid_id: bidId, reveal },
    "reveal-bid-1",
  );
  advance(context, "tick-2");
  const selection = emit(
    context,
    "requester",
    "SELECT_BID",
    { job_id: jobId, expected_bid_id: bidId },
    "select-bid-1",
  ).result;
  const accepted = emit(
    context,
    "worker",
    "ACCEPT_BID",
    {
      job_id: jobId,
      candidate_contract_root: selection.candidate_contract_root,
    },
    "accept-bid-1",
  ).result;
  const allowance = emit(
    context,
    "requester",
    "ISSUE_ALLOWANCE",
    {
      job_id: jobId,
      amount: 20,
      not_before_tick: stateOf(context).tick,
      expiry_tick: 10,
      agent_seat_id: prepared.workerOffer.worker_seat_id,
      purpose: "SUBWORK",
      allowance_nonce: "allowance-1",
    },
    "issue-allowance-1",
  ).result;
  const mismatchedCapabilityOffer = registerOffer(context, {
    alias: "subworker",
    model: "subworker-model",
    provider: "subworker-provider",
    operator: "subworker-operator",
    jobId,
    nonce: "register-subworker-mismatched-capability",
    maximumCapabilityRoot: hash("NEXUS_TEST_ROOT_V1", {
      name: "changed-maximum-capability",
    }),
  }).result;
  const subworkPayload = {
    allowance_id: allowance.allowance_id,
    amount: 20,
    recipient_principal_id: principal(context, "subworker").principal_id,
    recipient_seat_id: prepared.subworkerOffer.worker_seat_id,
    capability_offer_root: prepared.subworkerOffer.offer_root,
    task_nonce: "subwork-task-1",
    commitment_nonce: "subwork-commitment-1",
    evidence_requirement_root: "subwork-evidence-requirement-v1",
    expiry_tick: 10,
    task_kind: "IMPLEMENT",
    phase_rank: 20,
    priority: 20,
    dependencies: [],
    context_root: ROOTS.context,
    input_manifest_root: "subwork-input-root-v1",
    output_schema_root: "subwork-output-schema-root-v1",
    required_capabilities: [],
    max_compute_units: 20,
    max_input_bytes: 1000,
    max_output_bytes: 1000,
    concurrency_group: "subwork",
    conflict_set: [],
    review_requirement: "DETERMINISTIC",
    terminal_behavior: "HOLD",
  };
  const changedCapabilityEvent = buildEvent(stateOf(context), {
    eventType: "AUTHORIZE_SUBWORK",
    actorId: principal(context, "requester").principal_id,
    payload: {
      ...subworkPayload,
      recipient_seat_id: mismatchedCapabilityOffer.worker_seat_id,
      capability_offer_root: mismatchedCapabilityOffer.offer_root,
      task_nonce: "changed-capability-task",
      commitment_nonce: "changed-capability-commitment",
    },
    nonce: "changed-capability-subwork",
  });
  const beforeChangedCapability = currentRoot(context.runtime);
  expectCode(
    "ERR_CONTRACT_AUTHORITY_CEILING",
    () => applyEvent(context.runtime, changedCapabilityEvent),
  );
  assert.equal(currentRoot(context.runtime), beforeChangedCapability);
  const subwork = emit(
    context,
    "requester",
    "AUTHORIZE_SUBWORK",
    subworkPayload,
    "authorize-subwork-1",
  ).result;
  const secondSubworkerEvent = buildEvent(stateOf(context), {
    eventType: "AUTHORIZE_SUBWORK",
    actorId: principal(context, "requester").principal_id,
    payload: {
      ...subworkPayload,
      amount: 1,
      task_nonce: "second-subworker-task",
      commitment_nonce: "second-subworker-commitment",
    },
    nonce: "second-subworker",
  });
  const beforeSecondSubworker = currentRoot(context.runtime);
  expectCode(
    "ERR_CONTRACT_AUTHORITY_CEILING",
    () => applyEvent(context.runtime, secondSubworkerEvent),
  );
  assert.equal(currentRoot(context.runtime), beforeSecondSubworker);
  const subworkTask = stateOf(context).tasks[subwork.task_id];
  const subworkLease = emit(
    context,
    "requester",
    "ISSUE_LEASE",
    {
      job_id: jobId,
      task_id: subworkTask.task_id,
      context_root: subworkTask.context_root,
      input_manifest_root: subworkTask.input_manifest_root,
      not_before_tick: stateOf(context).tick,
      expiry_tick: 9,
      lease_nonce: "subwork-lease-1",
    },
    "issue-subwork-lease-1",
  ).result;
  const subworkReturn = emit(
    context,
    "subworker",
    "SUBMIT_LEASE_RETURN",
    {
      lease_id: subworkLease.lease_id,
      lease_root: subworkLease.lease_root,
      task_id: subworkTask.task_id,
      job_id: jobId,
      attempt: 1,
      worker_seat_id: prepared.subworkerOffer.worker_seat_id,
      source_root: "subwork-source-root-v1",
      artifact_root: "subwork-artifact-root-v1",
      manifest_root: "subwork-manifest-root-v1",
      contribution_terms_root: ROOTS.terms,
      worker_acknowledgement_root: "subworker-ack-root-v1",
      attribution_record_root: "subworker-attribution-root-v1",
      observations: [],
      commands_root: "subworker-commands-root-v1",
      return_nonce: "subwork-return-1",
    },
    "submit-subwork-return-1",
  ).result;
  const commitment =
    stateOf(context).subwork_commitments[subwork.commitment_id];
  assert.equal(
    commitment.capability_offer_root,
    prepared.subworkerOffer.offer_root,
  );
  const subworkEvidenceRoot = hash("NEXUS_SUBWORK_EVIDENCE_V1", {
    schema: "nexus-subwork-evidence-v1",
    commitment_id: commitment.subwork_commitment_id,
    task_id: commitment.task_id,
    lease_root: subworkLease.lease_root,
    work_return_id: subworkReturn.work_return_id,
    artifact_root: "subwork-artifact-root-v1",
    evidence_requirement_root: commitment.evidence_requirement_root,
  });
  const wrongLotsEvent = buildEvent(stateOf(context), {
    eventType: "ACCEPT_SUBWORK_RETURN",
    actorId: principal(context, "requester").principal_id,
    payload: {
      commitment_id: commitment.subwork_commitment_id,
      lease_id: subworkLease.lease_id,
      work_return_id: subworkReturn.work_return_id,
      artifact_root: "subwork-artifact-root-v1",
      evidence_root: subworkEvidenceRoot,
      funding_lot_ids: [],
      recipient_account_id: account(context, "subworker").account_id,
    },
    nonce: "wrong-subwork-lots",
  });
  const beforeWrongLots = currentRoot(context.runtime);
  expectCode(
    "ERR_FUNDING_LOT_OWNER",
    () => applyEvent(context.runtime, wrongLotsEvent),
  );
  assert.equal(currentRoot(context.runtime), beforeWrongLots);
  emit(
    context,
    "requester",
    "ACCEPT_SUBWORK_RETURN",
    {
      commitment_id: commitment.subwork_commitment_id,
      lease_id: subworkLease.lease_id,
      work_return_id: subworkReturn.work_return_id,
      artifact_root: "subwork-artifact-root-v1",
      evidence_root: subworkEvidenceRoot,
      funding_lot_ids: [...commitment.funding_lot_ids],
      recipient_account_id: account(context, "subworker").account_id,
    },
    "accept-subwork-return-1",
  );
  const task = stateOf(context).tasks[accepted.task_id];
  const issuedLease = emit(
    context,
    "requester",
    "ISSUE_LEASE",
    {
      job_id: jobId,
      task_id: task.task_id,
      context_root: task.context_root,
      input_manifest_root: task.input_manifest_root,
      not_before_tick: stateOf(context).tick,
      expiry_tick: 10,
      lease_nonce: "lead-lease-1",
    },
    "issue-lease-1",
  ).result;
  const submitted = emit(
    context,
    "worker",
    "SUBMIT_LEASE_RETURN",
    {
      lease_id: issuedLease.lease_id,
      lease_root: issuedLease.lease_root,
      task_id: task.task_id,
      job_id: jobId,
      attempt: 1,
      worker_seat_id: prepared.workerOffer.worker_seat_id,
      source_root: ROOTS.source,
      artifact_root: ROOTS.artifact,
      manifest_root: ROOTS.manifest,
      contribution_terms_root: ROOTS.terms,
      worker_acknowledgement_root: ROOTS.workerAck,
      attribution_record_root: ROOTS.attribution,
      observations: [],
      commands_root: ROOTS.commands,
      return_nonce: "lead-return-1",
    },
    "submit-lease-return-1",
  ).result;
  emit(
    context,
    "requester",
    "ACCEPT_LEAD_RETURN",
    {
      job_id: jobId,
      lease_id: issuedLease.lease_id,
      work_return_id: submitted.work_return_id,
      recipient_account_id: account(context, "worker").account_id,
      source_root: ROOTS.source,
      artifact_root: ROOTS.artifact,
      manifest_root: ROOTS.manifest,
      contribution_terms_root: ROOTS.terms,
      worker_acknowledgement_root: ROOTS.workerAck,
      attribution_record_root: ROOTS.attribution,
    },
    "accept-lead-return-1",
  );
  const evidenceJob = stateOf(context).jobs[jobId];
  const preRequiredCheckManifest = {
    schema: "nexus-required-check-manifest-v1",
    job_id: jobId,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    manifest_root: ROOTS.manifest,
    verifier_root: evidenceJob.accepted_contract.verifier_root,
    policy_root: evidenceJob.accepted_contract.policy_root,
    environment_root: ROOTS.checkEnvironment,
    ordered_check_names: ["lint", "tests"],
  };
  const preRequiredManifestRoot = requiredCheckManifestRoot(
    preRequiredCheckManifest,
  );
  const preVerifierPrincipal = principal(context, "verifier");
  const preVerifierController =
    stateOf(context).controllers[preVerifierPrincipal.controller_id];
  const preExecutionReceiptAnchor = {
    schema: "nexus-verifier-execution-receipt-anchor-v1",
    job_id: jobId,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    manifest_root: ROOTS.manifest,
    policy_root: evidenceJob.accepted_contract.policy_root,
    required_check_manifest_root: preRequiredManifestRoot,
    verifier_principal_id: preVerifierPrincipal.principal_id,
    verifier_controller_id: preVerifierController.controller_id,
    execution_receipt_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "verifier-execution-receipt",
    }),
  };
  const preExecutionReceiptAnchorRoot =
    verifierExecutionReceiptAnchorRoot(preExecutionReceiptAnchor);
  const preVerifierAuthority = {
    schema: "nexus-verifier-authority-v1",
    job_id: jobId,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    policy_root: evidenceJob.accepted_contract.policy_root,
    required_check_manifest_root: preRequiredManifestRoot,
    verifier_root: evidenceJob.accepted_contract.verifier_root,
    verifier_principal_id: preVerifierPrincipal.principal_id,
    verifier_controller_id: preVerifierController.controller_id,
    verifier_key_id: preVerifierController.key_id,
    controller_status: "ACTIVE",
    eligibility: "ELIGIBLE",
    verification_recipient_account_id:
      evidenceJob.accepted_contract.settlement
        .verification_recipient_account_id,
    execution_receipt_anchor_root: preExecutionReceiptAnchorRoot,
  };
  const preVerifierAuthorityRoot =
    verifierAuthorityRoot(preVerifierAuthority);
  const checks = ["lint", "tests"].map((checkName) => ({
    schema: "nexus-check-result-v1",
    check_name: checkName,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    manifest_root: ROOTS.manifest,
    verifier_root: evidenceJob.accepted_contract.verifier_root,
    policy_root: evidenceJob.accepted_contract.policy_root,
    required_check_manifest_root: preRequiredManifestRoot,
    verifier_authority_root: preVerifierAuthorityRoot,
    execution_receipt_anchor_root: preExecutionReceiptAnchorRoot,
    command: ["node", checkName === "lint" ? "--check" : "--test"],
    environment_root: ROOTS.checkEnvironment,
    exit_code: 0,
    stdout_root: `${checkName}-stdout-root-v1`,
    stderr_root: `${checkName}-stderr-root-v1`,
    reason_codes: [],
    status: "PASS",
  }));
  const checkManifest = {
    schema: "nexus-deterministic-check-manifest-v1",
    job_id: jobId,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    manifest_root: ROOTS.manifest,
    verifier_root: evidenceJob.accepted_contract.verifier_root,
    policy_root: evidenceJob.accepted_contract.policy_root,
    environment_root: ROOTS.checkEnvironment,
    checks,
  };
  const requiredCheckManifest = {
    ...preRequiredCheckManifest,
  };
  const requiredManifestRoot = requiredCheckManifestRoot(
    requiredCheckManifest,
  );
  const verifierPrincipal = principal(context, "verifier");
  const verifierController =
    stateOf(context).controllers[verifierPrincipal.controller_id];
  const checkManifestRoot = hash(
    "NEXUS_DETERMINISTIC_CHECK_MANIFEST_V1",
    checkManifest,
  );
  const executionReceiptAnchor = {
    ...preExecutionReceiptAnchor,
  };
  const executionReceiptAnchorRoot =
    verifierExecutionReceiptAnchorRoot(executionReceiptAnchor);
  const verifierAuthority = {
    ...preVerifierAuthority,
  };
  const verifierAuthorityBindingRoot =
    verifierAuthorityRoot(verifierAuthority);
  const evidenceRoot = hash("NEXUS_DETERMINISTIC_EVIDENCE_V1", {
    schema: "nexus-deterministic-evidence-v1",
    job_id: jobId,
    contract_root: evidenceJob.accepted_contract_root,
    artifact_root: ROOTS.artifact,
    manifest_root: ROOTS.manifest,
    verifier_root: evidenceJob.accepted_contract.verifier_root,
    policy_root: evidenceJob.accepted_contract.policy_root,
    environment_root: ROOTS.checkEnvironment,
    required_check_manifest_root: requiredManifestRoot,
    ordered_check_roots: checks.map(
      (check) => `CHECK-${hash("NEXUS_CHECK_RESULT_V1", check)}`,
    ),
    verifier_authority_root: verifierAuthorityBindingRoot,
    execution_receipt_anchor_root: executionReceiptAnchorRoot,
  });
  const deterministicEvidencePayload = {
    job_id: jobId,
    required_check_manifest: requiredCheckManifest,
    expected_required_check_manifest_root: requiredManifestRoot,
    check_manifest: checkManifest,
    evidence_root: evidenceRoot,
    verifier_authority: verifierAuthority,
    expected_verifier_authority_root: verifierAuthorityBindingRoot,
    execution_receipt_anchor: executionReceiptAnchor,
    expected_execution_receipt_anchor_root: executionReceiptAnchorRoot,
  };
  const spoofedVerifierEvent = buildEvent(stateOf(context), {
    eventType: "ACCEPT_DETERMINISTIC_EVIDENCE",
    actorId: principal(context, "requester").principal_id,
    payload: deterministicEvidencePayload,
    nonce: "spoofed-verifier-evidence",
  });
  const beforeSpoofedVerifier = currentRoot(context.runtime);
  expectCode(
    "ERR_DETERMINISTIC_RED",
    () => applyEvent(context.runtime, spoofedVerifierEvent),
  );
  assert.equal(currentRoot(context.runtime), beforeSpoofedVerifier);
  emit(
    context,
    "verifier",
    "ACCEPT_DETERMINISTIC_EVIDENCE",
    deterministicEvidencePayload,
    "accept-evidence-1",
  );
  const aggregateOverflowEvent = buildEvent(stateOf(context), {
    eventType: "ENTER_REVIEW",
    actorId: principal(context, "requester").principal_id,
    payload: {
      job_id: jobId,
      rubric_root: "rubric-root-v1",
      questions: ["Does the exact artifact satisfy the bound contract?"],
      max_compute_units: 31,
      expiry_tick: reviewExpiryTick,
    },
    nonce: "aggregate-review-compute-overflow",
  });
  const beforeAggregateOverflow = currentRoot(context.runtime);
  expectCode(
    "ERR_CONTRACT_AUTHORITY_CEILING",
    () => applyEvent(context.runtime, aggregateOverflowEvent),
  );
  assert.equal(currentRoot(context.runtime), beforeAggregateOverflow);
  const packet = emit(
    context,
    "requester",
    "ENTER_REVIEW",
    {
      job_id: jobId,
      rubric_root: "rubric-root-v1",
      questions: ["Does the exact artifact satisfy the bound contract?"],
      max_compute_units: 30,
      expiry_tick: reviewExpiryTick,
    },
    "enter-review-1",
  ).result;
  const reviewJob = stateOf(context).jobs[jobId];
  assert.equal(
    reviewJob.required_check_manifest_root,
    packet.required_check_manifest_root,
  );
  assert.equal(
    reviewJob.review_packet.required_check_manifest_root,
    packet.required_check_manifest_root,
  );
  const assignments = reviewerOffers
    .slice(0, 3)
    .map(({ spec, offer_id, offer_root, worker_seat_id }, index) => ({
    reviewer_principal_id: principal(context, spec.alias).principal_id,
    reviewer_seat_id: worker_seat_id,
    model_id: spec.model,
    capability_offer_id: offer_id,
    capability_offer_root: offer_root,
    expiry_tick: assignmentExpiryTicks?.[index] ?? assignmentExpiryTick,
  }));
  if (stopBeforeAssignments) {
    return {
      ...prepared,
      packet,
      assignments,
      resolver: createAcceptedRecordResolver(context.runtime),
    };
  }
  const mismatchedOfferIdAssignment = buildEvent(stateOf(context), {
    eventType: "ASSIGN_REVIEWERS",
    actorId: principal(context, "requester").principal_id,
    payload: {
      job_id: jobId,
      assignments: [
        {
          ...assignments[0],
          capability_offer_id: reviewerOffers[3].offer_id,
        },
        ...assignments.slice(1),
      ],
      assignment_nonce: "mismatched-offer-id-root",
    },
    nonce: "mismatched-offer-id-root",
  });
  expectCode(
    "ERR_REVIEW_ASSIGNMENT",
    () => applyEvent(context.runtime, mismatchedOfferIdAssignment),
  );
  const assignmentResult = emit(
    context,
    "requester",
    "ASSIGN_REVIEWERS",
    {
      job_id: jobId,
      assignments,
      assignment_nonce: "review-triad-1",
    },
    "assign-reviewers-1",
  ).result;
  if (stopAfterAssignments) {
    return {
      ...prepared,
      packet,
      assignmentResult,
      resolver: createAcceptedRecordResolver(context.runtime),
    };
  }
  for (const [index, assignmentId] of
    assignmentResult.review_assignment_ids.entries()) {
    const spec = reviewerOffers[index].spec;
    const assignment = stateOf(context).review_assignments[assignmentId];
    if (index === 0 && verdicts[index] === "CLEAR") {
      const orphanedEvidenceReview = buildEvent(stateOf(context), {
        eventType: "ACCEPT_ASSIGNED_REVIEW",
        actorId: principal(context, spec.alias).principal_id,
        payload: {
          review_assignment_id: assignmentId,
          expected_assignment_record_root: assignment.record_root,
          expected_assignment_revision: assignment.record_revision,
          eligibility_root: assignment.eligibility_root,
          required_check_manifest_root:
            reviewJob.required_check_manifest_root,
          packet_root: packet.packet_root,
          model_id: spec.model,
          reviewer_seat_id: reviewerOffers[index].worker_seat_id,
          provider_family: spec.provider,
          operator_id: spec.operator,
          prompt_lineage_root: `orphan-prompt-lineage-${index}`,
          toolchain_root: `orphan-toolchain-${index}`,
          machine_declaration: `orphan-machine-${index}`,
          verifier_implementation: `orphan-review-verifier-${index}`,
          verdict: "CLEAR",
          severity: "NONE",
          findings: [],
          claims: [],
          evidence_refs: [
            {
              schema: "nexus-review-evidence-ref-v1",
              evidence_ref_id: "orphan",
              evidence_root: ROOTS.artifact,
              locator: "artifact",
            },
          ],
          limitations: [],
          review_nonce: `orphan-review-${index}`,
          recipient_account_id:
            account(context, spec.alias).account_id,
        },
        nonce: `orphan-review-${index}`,
      });
      const beforeOrphan = currentRoot(context.runtime);
      expectCode(
        "ERR_REVIEW_PACKET_MISMATCH",
        () => applyEvent(context.runtime, orphanedEvidenceReview),
      );
      assert.equal(currentRoot(context.runtime), beforeOrphan);
    }
    emit(
      context,
      spec.alias,
      "ACCEPT_ASSIGNED_REVIEW",
      {
        review_assignment_id: assignmentId,
        expected_assignment_record_root: assignment.record_root,
        expected_assignment_revision: assignment.record_revision,
        eligibility_root: assignment.eligibility_root,
        required_check_manifest_root:
          reviewJob.required_check_manifest_root,
        packet_root: packet.packet_root,
        model_id: spec.model,
        reviewer_seat_id: reviewerOffers[index].worker_seat_id,
        provider_family: spec.provider,
        operator_id: spec.operator,
        prompt_lineage_root: `prompt-lineage-${index}`,
        toolchain_root: `toolchain-${index}`,
        machine_declaration: `machine-${index}`,
        verifier_implementation: `review-verifier-${index}`,
        verdict: verdicts[index],
        severity: verdicts[index] === "CLEAR" ? "NONE" : "MEDIUM",
        findings:
          verdicts[index] === "CLEAR"
            ? []
            : [
                {
                  schema: "nexus-review-finding-v1",
                  finding_id: "finding-1",
                  severity: "MEDIUM",
                  material: true,
                  resolved: false,
                  description: "material dissent",
                  evidence_ref_ids: ["artifact"],
                },
              ],
        claims: [],
        evidence_refs:
          verdicts[index] === "CLEAR"
            ? []
            : [
                {
                  schema: "nexus-review-evidence-ref-v1",
                  evidence_ref_id: "artifact",
                  evidence_root: ROOTS.artifact,
                  locator: "artifact",
                },
              ],
        limitations: [],
        review_nonce: `review-${index}`,
        recipient_account_id: account(context, spec.alias).account_id,
      },
      `accept-review-${index}`,
    );
  }
  if (stopAfterReviews) {
    return {
      ...prepared,
      packet,
      assignmentResult,
      resolver: createAcceptedRecordResolver(context.runtime),
    };
  }
  const outcome = emit(
    context,
    "requester",
    "COMPUTE_REVIEW_OUTCOME",
    { job_id: jobId },
    "compute-review-outcome-1",
  ).result;
  return { ...prepared, packet, outcome };
}

export function runCoreEconomyHappyPath() {
  const prepared = continueToReviewOutcome(prepareCommittedBid());
  const { context, jobId, outcome } = prepared;
  assert.equal(outcome.outcome, "CLEAR");
  const decision = emit(
    context,
    "requester",
    "HUMAN_DECISION",
    {
      job_id: jobId,
      decision: "ACCEPT",
      clearance_root: outcome.clearance_root,
      hold_root: null,
      reason_codes: [],
      decision_nonce: "accept-decision-1",
    },
    "human-decision-1",
  ).result;
  const appeal = emit(
    context,
    "worker",
    "FILE_APPEAL",
    {
      job_id: jobId,
      decision_root: decision.decision_id,
      claimed_role: "WORKER",
      ground: "QUALITY",
      disputed_payout_ids: [],
      evidence_packet_root: "appeal-evidence-root-v1",
      appeal_nonce: "appeal-1",
    },
    "file-appeal-1",
  ).result;
  emit(
    context,
    "resolver",
    "RESOLVE_APPEAL",
    {
      appeal_id: appeal.appeal_id,
      resolution: "UPHOLD",
      evidence_root: "appeal-resolution-evidence-root-v1",
      reason_codes: [],
      valid_payout_ids: [],
      invalid_payout_ids: [],
      resolution_nonce: "appeal-resolution-1",
    },
    "resolve-appeal-1",
  );
  const secondAppeal = buildEvent(stateOf(context), {
    eventType: "FILE_APPEAL",
    actorId: principal(context, "worker").principal_id,
    payload: {
      job_id: jobId,
      decision_root: decision.decision_id,
      claimed_role: "WORKER",
      ground: "QUALITY",
      disputed_payout_ids: [],
      evidence_packet_root: "second-appeal-evidence-root-v1",
      appeal_nonce: "appeal-2",
    },
    nonce: "file-appeal-2",
  });
  expectCode(
    "ERR_APPEAL_INELIGIBLE",
    () => applyEvent(context.runtime, secondAppeal),
  );
  advance(context, "tick-3");
  advance(context, "tick-4");
  const terminal = emit(
    context,
    "requester",
    "SETTLE_JOB",
    {
      job_id: jobId,
      contract_root: stateOf(context).jobs[jobId].accepted_contract_root,
      artifact_root: ROOTS.artifact,
      clearance_root: outcome.clearance_root,
      decision_root: decision.decision_id,
    },
    "settle-job-1",
  );
  const terminalJob = stateOf(context).jobs[jobId];
  const exportNonce =
    "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";
  const exportCommitment = exportNonceCommitment({
    exportNonce,
    contractRoot: terminalJob.accepted_contract_root,
    jobId,
  });
  let contentPublicValuesRoot = null;
  let contentProofDescriptorsRoot = null;
  const approvalContext = null;
  const acceptedPolicy = emit(
    context,
    "requester",
    "ACCEPT_DISCLOSURE_POLICY",
    {
      schema: "nexus-accept-disclosure-policy-v1",
      body: {
        job_id: jobId,
        contract_root: terminalJob.accepted_contract_root,
        terminal_receipt_id: terminal.receipt.semantic_receipt_id,
        policy: DISCLOSURE_POLICY,
      },
    },
    "accept-disclosure-policy-1",
  ).result;
  const acceptedProofContext = emit(
    context,
    "requester",
    "ACCEPT_DISCLOSURE_PROOF_CONTEXT",
    {
      schema: "nexus-accept-disclosure-proof-context-v2",
      body: {
        job_id: jobId,
        contract_root: terminalJob.accepted_contract_root,
        terminal_receipt_id: terminal.receipt.semantic_receipt_id,
        disclosure_policy_id: acceptedPolicy.disclosure_policy_id,
        disclosure_policy_root: acceptedPolicy.disclosure_policy_root,
        proof_context: DISCLOSURE_PROOF_CONTEXT,
      },
    },
    "accept-disclosure-proof-context-1",
  ).result;
  const scannerAuthorityRoot = disclosureScannerAuthorityRoot({
    jobId,
    contractRoot: terminalJob.accepted_contract_root,
    secretScanPolicyRoot: ROOTS.secretScanPolicy,
    publicationPrincipalIds:
      terminalJob.accepted_contract.authority_ceiling
        .publication_principal_ids,
  });
  const preparationApprovalAuthorityRoot =
    publicationApprovalAuthorityV3Root({
      jobId,
      contractRoot: terminalJob.accepted_contract_root,
      terminalReceiptId: terminal.receipt.semantic_receipt_id,
      approvalPolicyRoot: ROOTS.approvalPolicy,
      publicationPrincipalIds:
        terminalJob.accepted_contract.authority_ceiling
          .publication_principal_ids,
    });
  const preparationScopeBinding = {
    schema: "nexus-disclosure-preparation-nonce-scope-v1",
    job_id: jobId,
    contract_root: terminalJob.accepted_contract_root,
    terminal_event_id: terminalJob.terminal_event_id,
    terminal_receipt_id: terminal.receipt.semantic_receipt_id,
    disclosure_policy_id: acceptedPolicy.disclosure_policy_id,
    disclosure_policy_record_root:
      acceptedPolicy.disclosure_policy_record_root,
    disclosure_proof_context_id:
      acceptedProofContext.disclosure_proof_context_id,
    disclosure_proof_context_record_root:
      acceptedProofContext.disclosure_proof_context_record_root,
    secret_scan_policy_root: ROOTS.secretScanPolicy,
    approval_policy_root: ROOTS.approvalPolicy,
    scanner_authority_root: scannerAuthorityRoot,
    approval_authority_root: preparationApprovalAuthorityRoot,
  };
  const preparationScopeRoot =
    disclosurePreparationNonceScopeRoot(preparationScopeBinding);
  const preparationEntropyAuthority = {
    schema: "nexus-entropy-freshness-authority-v1",
    purpose: "DISCLOSURE_PREPARATION",
    scope_root: preparationScopeRoot,
    nonce_commitment: exportCommitment,
    minimum_entropy_bits: 256,
    entropy_evidence_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "preparation-entropy-evidence",
    }),
    freshness_evidence_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "preparation-freshness-evidence",
    }),
    one_use_commitment: entropyOneUseCommitmentRoot({
      nonceCommitment: exportCommitment,
      purpose: "DISCLOSURE_PREPARATION",
      scopeRoot: preparationScopeRoot,
    }),
  };
  const preparationEntropyRoot =
    entropyFreshnessAuthorityV1Root(preparationEntropyAuthority);
  const registerPreparationPayload = () => ({
    schema: "nexus-register-entropy-freshness-authority-v1",
    body: {
      job_id: jobId,
      authority: preparationEntropyAuthority,
      binding: preparationScopeBinding,
    },
  });
  const wrongActorRegistration = buildContextBoundEvent(
    context,
    "worker",
    "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
    "wrong-preparation-entropy-actor",
    registerPreparationPayload,
    (event) =>
      entropyAuthorityContextId(
        event,
        jobId,
        "DISCLOSURE_PREPARATION",
      ),
  );
  expectCode(
    "ERR_AUTHORITY",
    () => applyEvent(context.runtime, wrongActorRegistration),
  );
  const wrongPurposeAuthority = {
    ...preparationEntropyAuthority,
    purpose: "PUBLICATION_INTENT",
    one_use_commitment: entropyOneUseCommitmentRoot({
      nonceCommitment: exportCommitment,
      purpose: "PUBLICATION_INTENT",
      scopeRoot: preparationScopeRoot,
    }),
  };
  const wrongPurposeRegistration = buildContextBoundEvent(
    context,
    "requester",
    "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
    "wrong-preparation-entropy-purpose",
    () => ({
      schema: "nexus-register-entropy-freshness-authority-v1",
      body: {
        job_id: jobId,
        authority: wrongPurposeAuthority,
        binding: preparationScopeBinding,
      },
    }),
    (event) =>
      entropyAuthorityContextId(event, jobId, "PUBLICATION_INTENT"),
  );
  expectCode(
    "ERR_SCHEMA",
    () => applyEvent(context.runtime, wrongPurposeRegistration),
  );
  const wrongScopeRoot = hash("NEXUS_TEST_ROOT_V1", {
    name: "wrong-preparation-scope",
  });
  const wrongScopeAuthority = {
    ...preparationEntropyAuthority,
    scope_root: wrongScopeRoot,
    one_use_commitment: entropyOneUseCommitmentRoot({
      nonceCommitment: exportCommitment,
      purpose: "DISCLOSURE_PREPARATION",
      scopeRoot: wrongScopeRoot,
    }),
  };
  const wrongScopeRegistration = buildContextBoundEvent(
    context,
    "requester",
    "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
    "wrong-preparation-entropy-scope",
    () => ({
      schema: "nexus-register-entropy-freshness-authority-v1",
      body: {
        job_id: jobId,
        authority: wrongScopeAuthority,
        binding: preparationScopeBinding,
      },
    }),
    (event) =>
      entropyAuthorityContextId(
        event,
        jobId,
        "DISCLOSURE_PREPARATION",
      ),
  );
  expectCode(
    "ERR_DISCLOSURE_UNCLASSIFIED",
    () => applyEvent(context.runtime, wrongScopeRegistration),
  );
  const preparationEntropyRegistration = emitContextBound(
    context,
    "requester",
    "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
    "register-preparation-entropy-1",
    registerPreparationPayload,
    (event) =>
      entropyAuthorityContextId(
        event,
        jobId,
        "DISCLOSURE_PREPARATION",
      ),
  );
  assert.equal(
    preparationEntropyRegistration.result.authority_root,
    preparationEntropyRoot,
  );
  const preparationAuthorization = emit(
    context,
    "requester",
    "AUTHORIZE_DISCLOSURE_PREPARATION",
    {
      schema: "nexus-authorize-disclosure-preparation-v1",
      body: {
        job_id: jobId,
        contract_root: terminalJob.accepted_contract_root,
        terminal_event_id: terminalJob.terminal_event_id,
        terminal_receipt_id: terminal.receipt.semantic_receipt_id,
        disclosure_policy_id: acceptedPolicy.disclosure_policy_id,
        disclosure_policy_record_root:
          acceptedPolicy.disclosure_policy_record_root,
        disclosure_policy_root: acceptedPolicy.disclosure_policy_root,
        disclosure_proof_context_id:
          acceptedProofContext.disclosure_proof_context_id,
        disclosure_proof_context_record_root:
          acceptedProofContext.disclosure_proof_context_record_root,
        disclosure_proof_context_root:
          acceptedProofContext.disclosure_proof_context_root,
        entropy_freshness_authority_id:
          preparationEntropyRegistration.result.authority_id,
        entropy_freshness_authority_root:
          preparationEntropyRegistration.result.authority_root,
        secret_scan_policy_root: ROOTS.secretScanPolicy,
        approval_policy_root: ROOTS.approvalPolicy,
      },
    },
    "authorize-disclosure-preparation-1",
  );
  assert.equal(
    preparationAuthorization.result.preparation_authority_id,
    disclosurePreparationAuthorityContextId(
      preparationAuthorization.event,
      jobId,
    ),
  );
  const preparationUseClaim = {
    schema: "nexus-entropy-one-use-claim-v1",
    authority_id: preparationEntropyRegistration.result.authority_id,
    authority_root: preparationEntropyRegistration.result.authority_root,
    purpose: "DISCLOSURE_PREPARATION",
    scope_root: preparationScopeRoot,
    nonce_commitment: exportCommitment,
    use_scope_root: disclosurePreparationUseScopeRoot({
      preparationAuthorityId:
        preparationAuthorization.result.preparation_authority_id,
      preparationAuthorityRoot:
        preparationAuthorization.result.preparation_authority_root,
      exportNonceCommitment: exportCommitment,
    }),
  };
  const preparationEntropyConsumption = emit(
    context,
    "requester",
    "CONSUME_ENTROPY_AUTHORITY",
    {
      schema: "nexus-consume-entropy-authority-v1",
      claim: preparationUseClaim,
    },
    "consume-preparation-entropy-1",
  ).result;
  assert.equal(
    preparationEntropyConsumption.use_claim_root,
    entropyOneUseClaimV1Root(preparationUseClaim),
  );
  const reusedPreparationEntropy = buildEvent(stateOf(context), {
    eventType: "CONSUME_ENTROPY_AUTHORITY",
    actorId: principal(context, "requester").principal_id,
    payload: {
      schema: "nexus-consume-entropy-authority-v1",
      claim: preparationUseClaim,
    },
    nonce: "reuse-preparation-entropy",
  });
  expectCode(
    "ERR_NONCE_REPLAY",
    () => applyEvent(context.runtime, reusedPreparationEntropy),
  );
  const acceptedState = stateOf(context);
  const preparationAuthorityRecord =
    acceptedState.disclosure_preparation_authorities[
      preparationAuthorization.result.preparation_authority_id
    ];
  const preparationEntropyAuthorityRecord =
    acceptedState.entropy_freshness_authorities[
      preparationEntropyRegistration.result.authority_root
    ];
  const preparationEntropyConsumptionRecord =
    acceptedState.entropy_one_use_consumptions[
      preparationEntropyConsumption.consumption_id
    ];
  const preparedContent = deriveDisclosurePreparationBindings({
    policy_carrier:
      acceptedState.disclosure_policies[
        acceptedPolicy.disclosure_policy_id
      ].carrier,
    proof_context_carrier:
      acceptedState.disclosure_proof_contexts[
        acceptedProofContext.disclosure_proof_context_id
      ].carrier,
    preparation_authority:
      preparationAuthorityRecord.preparation_authority,
    entropy_authority: preparationEntropyAuthorityRecord,
    entropy_consumption: preparationEntropyConsumptionRecord,
    salt_entropy_uses: [],
  });
  contentPublicValuesRoot = preparedContent.content_public_values_root;
  contentProofDescriptorsRoot =
    preparedContent.content_proof_descriptors_root;
  expectCode("ERR_VERIFIER_MUTATION", () =>
    verifyDisclosurePreparationBindings({
      preparation: {
        ...preparedContent,
        content_public_values: {},
      },
      policy_carrier:
        acceptedState.disclosure_policies[
          acceptedPolicy.disclosure_policy_id
        ].carrier,
      proof_context_carrier:
        acceptedState.disclosure_proof_contexts[
          acceptedProofContext.disclosure_proof_context_id
        ].carrier,
      preparation_authority:
        preparationAuthorityRecord.preparation_authority,
      entropy_authority: preparationEntropyAuthorityRecord,
      entropy_consumption: preparationEntropyConsumptionRecord,
      salt_entropy_uses: [],
    }),
  );
  expectCode("ERR_VERIFIER_MUTATION", () =>
    verifyDisclosurePreparationBindings({
      preparation: {
        ...preparedContent,
        content_proof_descriptors_root: hash("NEXUS_TEST_ROOT_V1", {
          name: "forged-proof-descriptors",
        }),
      },
      policy_carrier:
        acceptedState.disclosure_policies[
          acceptedPolicy.disclosure_policy_id
        ].carrier,
      proof_context_carrier:
        acceptedState.disclosure_proof_contexts[
          acceptedProofContext.disclosure_proof_context_id
        ].carrier,
      preparation_authority:
        preparationAuthorityRecord.preparation_authority,
      entropy_authority: preparationEntropyAuthorityRecord,
      entropy_consumption: preparationEntropyConsumptionRecord,
      salt_entropy_uses: [],
    }),
  );
  expectCode("ERR_NONCE_REPLAY", () =>
    deriveDisclosurePreparationBindings({
      policy_carrier:
        acceptedState.disclosure_policies[
          acceptedPolicy.disclosure_policy_id
        ].carrier,
      proof_context_carrier:
        acceptedState.disclosure_proof_contexts[
          acceptedProofContext.disclosure_proof_context_id
        ].carrier,
      preparation_authority:
        preparationAuthorityRecord.preparation_authority,
      entropy_authority: preparationEntropyAuthorityRecord,
      entropy_consumption: {
        ...preparationEntropyConsumptionRecord,
        consumption_root: hash("NEXUS_TEST_ROOT_V1", {
          name: "mismatched-preparation-consumption",
        }),
      },
      salt_entropy_uses: [],
    }),
  );
  expectCode("ERR_NONCE_REPLAY", () =>
    deriveDisclosurePreparationBindings({
      policy_carrier:
        acceptedState.disclosure_policies[
          acceptedPolicy.disclosure_policy_id
        ].carrier,
      proof_context_carrier:
        acceptedState.disclosure_proof_contexts[
          acceptedProofContext.disclosure_proof_context_id
        ].carrier,
      preparation_authority:
        preparationAuthorityRecord.preparation_authority,
      entropy_authority: preparationEntropyAuthorityRecord,
      entropy_consumption: preparationEntropyConsumptionRecord,
      salt_entropy_uses: [
        {
          path: "internal_job_id",
          authority: preparationEntropyAuthorityRecord,
          consumption: preparationEntropyConsumptionRecord,
        },
      ],
    }),
  );
  const acceptedPreparation = emit(
    context,
    "requester",
    "ACCEPT_DISCLOSURE_PREPARATION",
    {
      schema: "nexus-accept-disclosure-preparation-v1",
      body: {
        preparation_authority_id:
          preparationAuthorization.result.preparation_authority_id,
        preparation_authority_root:
          preparationAuthorization.result.preparation_authority_root,
        preparation: preparedContent,
        execution_evidence_root: hash("NEXUS_TEST_ROOT_V1", {
          name: "preparation-execution-evidence",
        }),
      },
    },
    "accept-disclosure-preparation-1",
  ).result;
  const storedPreparation =
    stateOf(context).disclosure_preparations[
      acceptedPreparation.preparation_id
    ];
  const {
    record_root: ignoredPreparationRecordRoot,
    preparation: ignoredPreparationBody,
    verifier_authority: ignoredVerifierAuthority,
    ...acceptedPreparationProjection
  } = storedPreparation;
  assert.equal(
    acceptedPreparation.preparation_record_root,
    acceptedDisclosurePreparationRoot(acceptedPreparationProjection),
  );
  const scanBody = {
    schema: "nexus-disclosure-scan-receipt-v1",
    job_id: jobId,
    contract_root: terminalJob.accepted_contract_root,
    preparation_id: acceptedPreparation.preparation_id,
    preparation_record_root:
      acceptedPreparation.preparation_record_root,
    preparation_root: acceptedPreparation.preparation_root,
    preparation_execution_receipt_id:
      acceptedPreparation.execution_receipt_id,
    preparation_execution_receipt_root:
      acceptedPreparation.execution_receipt_root,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    secret_scan_policy_root: ROOTS.secretScanPolicy,
    scanner_authority_root: scannerAuthorityRoot,
    result: "PASS",
  };
  const forgedScanActor = buildEvent(stateOf(context), {
    eventType: "RECORD_DISCLOSURE_SCAN",
    actorId: principal(context, "worker").principal_id,
    payload: {
      schema: "nexus-record-disclosure-scan-v1",
      body: scanBody,
    },
    nonce: "forged-scan-actor",
  });
  expectCode(
    "ERR_AUTHORITY",
    () => applyEvent(context.runtime, forgedScanActor),
  );
  const wrongScanContent = buildEvent(stateOf(context), {
    eventType: "RECORD_DISCLOSURE_SCAN",
    actorId: principal(context, "requester").principal_id,
    payload: {
      schema: "nexus-record-disclosure-scan-v1",
      body: {
        ...scanBody,
        content_public_values_root: hash("NEXUS_TEST_ROOT_V1", {
          name: "wrong-carrier-content",
        }),
      },
    },
    nonce: "wrong-scan-content",
  });
  expectCode(
    "ERR_DISCLOSURE_UNCLASSIFIED",
    () => applyEvent(context.runtime, wrongScanContent),
  );
  const scan = emit(
    context,
    "requester",
    "RECORD_DISCLOSURE_SCAN",
    {
      schema: "nexus-record-disclosure-scan-v1",
      body: scanBody,
    },
    "record-disclosure-scan-1",
  ).result;
  const approvalBody = {
    schema: "nexus-disclosure-approval-receipt-v1",
    job_id: jobId,
    contract_root: terminalJob.accepted_contract_root,
    preparation_root: acceptedPreparation.preparation_root,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_receipt_id: scan.record_id,
    scan_receipt_root: scan.record_root,
    approval_policy_root: ROOTS.approvalPolicy,
    approval_authority_root: preparationApprovalAuthorityRoot,
    approval_signature_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "carrier-approval-signature",
    }),
    decision: "APPROVED",
  };
  const approval = emit(
    context,
    "requester",
    "RECORD_DISCLOSURE_APPROVAL",
    {
      schema: "nexus-record-disclosure-approval-v1",
      body: approvalBody,
    },
    "record-disclosure-approval-1",
  ).result;
  const exportAuthorityResult = emit(
    context,
    "requester",
    "COMMIT_PUBLIC_EXPORT_AUTHORITY",
    {
      schema: "nexus-commit-public-export-authority-v3",
      body: {
        preparation_authority_id:
          preparationAuthorization.result.preparation_authority_id,
        preparation_authority_root:
          preparationAuthorization.result.preparation_authority_root,
        preparation_entropy_consumption_id:
          preparationEntropyConsumption.consumption_id,
        preparation_entropy_consumption_root:
          preparationEntropyConsumption.consumption_root,
        preparation_id: acceptedPreparation.preparation_id,
        preparation_record_root:
          acceptedPreparation.preparation_record_root,
        preparation_root: acceptedPreparation.preparation_root,
        content_public_values_root: contentPublicValuesRoot,
        content_proof_descriptors_root: contentProofDescriptorsRoot,
        scan_receipt_id: scan.record_id,
        scan_receipt_root: scan.record_root,
        approval_receipt_id: approval.record_id,
        approval_receipt_root: approval.record_root,
      },
    },
    "commit-public-export-authority-1",
  ).result;
  const exportAuthorityRecord =
    stateOf(context).public_export_authorities[
      exportAuthorityResult.export_authority_id
    ];
  const exportAuthority = exportAuthorityRecord.export_authority;
  const exportAuthorityRoot = exportAuthorityResult.export_authority_root;
  assert.equal(
    exportAuthorityRoot,
    publicExportAuthorityV3Root(exportAuthority),
  );
  const leadTask = terminalJob.task_ids
    .map((id) => stateOf(context).tasks[id])
    .find((task) => task.kind === "LEAD");
  const plannedRedactionManifestBody = {
    schema: "nexus-redaction-manifest-v2",
    redaction_manifest_id: "redaction-manifest-1",
    job_id: jobId,
    task_id: leadTask.task_id,
    source_root: terminalJob.final_source_root,
    reduced_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "carrier-reduced-content",
    }),
    context_root: leadTask.context_root,
    transformation_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "carrier-redaction-transformation",
    }),
    redaction_policy_root: ROOTS.disclosurePolicy,
    remote_policy_root:
      terminalJob.accepted_contract.privacy.remote_execution
        ? remoteRedactionPolicyRoot(terminalJob.accepted_contract)
        : null,
    route_policy_root: terminalJob.accepted_contract.policy_root,
  };
  const acceptedResolver = createAcceptedRecordResolver(
    context.runtime,
  );
  assertAcceptedRecordResolver(acceptedResolver);
  const offerEnvelope = resolveAcceptedRecord(acceptedResolver, {
    record_type: "CAPABILITY_OFFER",
    record_id: prepared.workerOffer.offer_id,
    record_root: prepared.workerOffer.offer_root,
  });
  assert(Object.isFrozen(offerEnvelope));
  assert(Object.isFrozen(offerEnvelope.record));
  assert(
    !canonicalize(stateOf(context)).includes(exportNonce),
    "raw export nonce entered canonical state",
  );
  assert.equal(
    stateOf(context).export_nonce_uses[exportCommitment]
      .public_export_authority_root,
    exportAuthorityRoot,
  );
  return {
    ...prepared,
    resolver: acceptedResolver,
    decision,
    appeal,
    terminal,
    exportAuthority,
    exportAuthorityRoot,
    approvalContext,
    exportNonce,
    exportAuthorityResult,
    contentPublicValuesRoot,
    contentProofDescriptorsRoot,
    acceptedPolicy,
    acceptedProofContext,
    preparationAuthorization,
    preparationEntropyConsumption,
    preparationRoot: acceptedPreparation.preparation_root,
    preparedContent,
    acceptedPreparation,
    scanBody,
    scan,
    approvalBody,
    approval,
    plannedRedactionManifestBody,
  };
}

export function runAcceptedCarrierPath(happy) {
  const {
    context,
    jobId,
    terminal,
    exportAuthority,
    exportAuthorityRoot,
    exportAuthorityResult,
    contentPublicValuesRoot,
    contentProofDescriptorsRoot,
    preparationAuthorization,
    preparationRoot,
    preparedContent,
    acceptedPreparation,
    scan,
    approval,
    plannedRedactionManifestBody,
    acceptedPolicy,
    acceptedProofContext,
  } = happy;
  const job = stateOf(context).jobs[jobId];
  const dataRouteInput = {
    schema: "nexus-data-route-authority-v2",
    contract_root: job.accepted_contract_root,
    contract_route_context_root:
      contractRouteContextRoot(job.accepted_contract),
    redaction_approval_authority_root:
      redactionApprovalAuthorityRoot({
        jobId,
        contractRoot: job.accepted_contract_root,
        publicationPrincipalIds:
          job.accepted_contract.authority_ceiling.publication_principal_ids,
      }),
    redaction_policy_root:
      job.accepted_contract.privacy.disclosure_policy_root,
    remote_redaction_policy_root:
      job.accepted_contract.privacy.remote_execution
        ? remoteRedactionPolicyRoot(job.accepted_contract)
        : null,
    route_policy_root: job.accepted_contract.policy_root,
  };
  const callerDerivedId = buildEvent(stateOf(context), {
    eventType: "AUTHORIZE_DATA_ROUTE",
    actorId: principal(context, "requester").principal_id,
    payload: {
      schema: "nexus-authorize-data-route-v2",
      body: {
        ...dataRouteInput,
        route_authority_id: "DATAROUTE-caller-supplied",
      },
    },
    nonce: "caller-supplied-data-route-id",
  });
  const beforeCallerDerivedId = currentRoot(context.runtime);
  expectCode(
    "ERR_ID_PREIMAGE",
    () => applyEvent(context.runtime, callerDerivedId),
  );
  assert.equal(currentRoot(context.runtime), beforeCallerDerivedId);
  const dataRoute = emit(
    context,
    "requester",
    "AUTHORIZE_DATA_ROUTE",
    { schema: "nexus-authorize-data-route-v2", body: dataRouteInput },
    "authorize-data-route-1",
  ).result;
  const dataRouteBody = {
    ...dataRouteInput,
    route_authority_id: dataRoute.record_id,
  };
  assert.equal(dataRoute.record_root, dataRouteAuthorityRoot(dataRouteBody));

  const leadTask = job.task_ids
    .map((id) => stateOf(context).tasks[id])
    .find((task) => task.kind === "LEAD");
  const toolRouteInput = {
    schema: "nexus-tool-route-authority-v1",
    job_id: jobId,
    task_id: leadTask.task_id,
    tool_name: "node",
    selected_route: "LOCAL",
    authorized_route: "LOCAL",
    data_class: job.accepted_contract.privacy.data_class,
    contract_root: job.accepted_contract_root,
    route_policy_root: job.accepted_contract.policy_root,
  };
  const toolRoute = emit(
    context,
    "requester",
    "AUTHORIZE_TOOL_ROUTE",
    { schema: "nexus-authorize-tool-route-v1", body: toolRouteInput },
    "authorize-tool-route-1",
  ).result;
  const toolRouteBody = {
    ...toolRouteInput,
    tool_route_authority_id: toolRoute.record_id,
  };
  assert.equal(toolRoute.record_root, toolRouteAuthorityRoot(toolRouteBody));

  const {
    redaction_manifest_id: ignoredManifestId,
    ...redactionManifestInput
  } = structuredClone(plannedRedactionManifestBody);
  const redactionManifest = emit(
    context,
    "requester",
    "RECORD_REDACTION_MANIFEST",
    {
      schema: "nexus-record-redaction-manifest-v2",
      body: redactionManifestInput,
    },
    "record-redaction-manifest-1",
  ).result;
  const redactionManifestBody = {
    ...redactionManifestInput,
    redaction_manifest_id: redactionManifest.record_id,
  };
  assert.equal(
    redactionManifest.record_root,
    redactionManifestV2Root(redactionManifestBody),
  );

  const redactionApprovalInput = {
    schema: "nexus-redaction-approval-v2",
    job_id: jobId,
    task_id: leadTask.task_id,
    redaction_manifest_id: redactionManifest.record_id,
    redaction_manifest_root: redactionManifest.record_root,
    approved_reduced_root: redactionManifestInput.reduced_root,
    redaction_policy_root: redactionManifestInput.redaction_policy_root,
    remote_policy_root: redactionManifestInput.remote_policy_root,
    route_policy_root: redactionManifestInput.route_policy_root,
    approval_authority_root:
      dataRouteInput.redaction_approval_authority_root,
    approval_signature_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "carrier-redaction-approval-signature",
    }),
    decision: "APPROVED",
  };
  const redactionApproval = emit(
    context,
    "requester",
    "APPROVE_REDACTION",
    {
      schema: "nexus-approve-redaction-v2",
      body: redactionApprovalInput,
    },
    "approve-redaction-1",
  ).result;
  const redactionApprovalBody = {
    ...redactionApprovalInput,
    redaction_approval_id: redactionApproval.record_id,
  };
  assert.equal(
    redactionApproval.record_root,
    redactionApprovalV2Root(redactionApprovalBody),
  );

  const disclosureManifestInput = {
    schema: "nexus-public-safe-disclosure-manifest-v1",
    job_id: jobId,
    preparation_id: acceptedPreparation.preparation_id,
    preparation_record_root:
      acceptedPreparation.preparation_record_root,
    preparation_root: preparationRoot,
    disclosure_policy_root: preparedContent.disclosure_policy_root,
    disclosure_proof_context_root:
      preparedContent.disclosure_proof_context_root,
    content_public_values: preparedContent.content_public_values,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors: preparedContent.content_proof_descriptors,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_receipt_id: scan.record_id,
    scan_receipt_root: scan.record_root,
    approval_receipt_id: approval.record_id,
    approval_receipt_root: approval.record_root,
  };
  const disclosureManifest = emit(
    context,
    "requester",
    "ACCEPT_DISCLOSURE_MANIFEST",
    {
      schema: "nexus-accept-disclosure-manifest-v1",
      body: disclosureManifestInput,
    },
    "accept-disclosure-manifest-1",
  ).result;
  const disclosureManifestBody = {
    ...disclosureManifestInput,
    disclosure_manifest_id: disclosureManifest.record_id,
  };
  assert.equal(
    disclosureManifest.record_root,
    publicSafeDisclosureManifestRoot(disclosureManifestBody),
  );
  assert.notEqual(
    disclosureManifest.record_id,
    redactionManifest.record_id,
  );
  assert.notEqual(
    disclosureManifest.record_root,
    redactionManifest.record_root,
  );
  assert(!Object.hasOwn(disclosureManifestBody, "source_root"));

  const compilationRoot = disclosureCompilationV2Root({
    preparationRoot,
    scanReceiptRoot: scan.record_root,
    approvalReceiptRoot: approval.record_root,
    manifestRoot: disclosureManifest.record_root,
    exportAuthorityRoot,
  });
  const compilationInput = {
    schema: "nexus-accepted-disclosure-compilation-anchor-v2",
    preparation_id: acceptedPreparation.preparation_id,
    preparation_record_root:
      acceptedPreparation.preparation_record_root,
    preparation_root: preparationRoot,
    scan_receipt_id: scan.record_id,
    scan_receipt_root: scan.record_root,
    approval_receipt_id: approval.record_id,
    approval_receipt_root: approval.record_root,
    disclosure_manifest_id: disclosureManifest.record_id,
    disclosure_manifest_root: disclosureManifest.record_root,
    compilation_root: compilationRoot,
    export_authority_id: exportAuthorityResult.export_authority_id,
    export_authority_root: exportAuthorityRoot,
    disclosure_policy_root:
      job.accepted_contract.privacy.disclosure_policy_root,
    disclosure_proof_context_root:
      exportAuthority.disclosure_proof_context_root,
  };
  const compilation = emit(
    context,
    "requester",
    "ACCEPT_DISCLOSURE_COMPILATION",
    {
      schema: "nexus-accept-disclosure-compilation-v2",
      body: compilationInput,
    },
    "accept-disclosure-compilation-1",
  ).result;
  const compilationBody = {
    ...compilationInput,
    anchor_id: compilation.record_id,
  };
  assert.equal(
    compilation.record_root,
    disclosureCompilationAnchorV2Root(compilationBody),
  );

  const capsuleInput = {
    schema: "nexus-public-capsule-v1",
    job_id: jobId,
    accepted_compilation_anchor_id: compilation.record_id,
    accepted_compilation_anchor_root: compilation.record_root,
    compilation_root: compilationRoot,
    disclosure_manifest_id: disclosureManifest.record_id,
    disclosure_manifest_root: disclosureManifest.record_root,
    capsule_content_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "public-capsule-content",
    }),
  };
  const capsule = emit(
    context,
    "requester",
    "ACCEPT_PUBLIC_CAPSULE",
    { schema: "nexus-accept-public-capsule-v1", body: capsuleInput },
    "accept-public-capsule-1",
  ).result;
  const capsuleBody = {
    ...capsuleInput,
    public_capsule_id: capsule.record_id,
  };
  assert.equal(capsule.record_root, publicCapsuleRoot(capsuleBody));

  const nonClaimsInput = {
    schema: "nexus-non-claims-v1",
    job_id: jobId,
    accepted_compilation_anchor_id: compilation.record_id,
    accepted_compilation_anchor_root: compilation.record_root,
    compilation_root: compilationRoot,
    statements: ["No claim of exhaustive disclosure."],
  };
  const nonClaims = emit(
    context,
    "requester",
    "ACCEPT_NON_CLAIMS",
    { schema: "nexus-accept-non-claims-v1", body: nonClaimsInput },
    "accept-non-claims-1",
  ).result;
  const nonClaimsBody = {
    ...nonClaimsInput,
    non_claims_id: nonClaims.record_id,
  };
  assert.equal(nonClaims.record_root, nonClaimsRoot(nonClaimsBody));

  const publicationScopeBinding = {
    schema: "nexus-publication-intent-nonce-scope-v3",
    accepted_compilation_anchor_root: compilation.record_root,
    capsule_root: capsule.record_root,
    destination_policy: "GITHUB_SANITIZED_WITNESS",
    disclosure_manifest_root: disclosureManifest.record_root,
    job_id: jobId,
    non_claims_root: nonClaims.record_root,
    publication_principal_id: principal(context, "requester").principal_id,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id: terminal.receipt.semantic_receipt_id,
  };
  const publicationScopeRoot =
    publicationIntentNonceScopeRoot(publicationScopeBinding);
  const publicationNonce = hash("NEXUS_TEST_NONCE_V1", {
    name: "publication-intent-nonce-v3",
  });
  const publicationNonceCommitment =
    publicationIntentNonceCommitmentRoot({
      nonce: publicationNonce,
      scopeRoot: publicationScopeRoot,
    });
  const publicationEntropyAuthority = {
    schema: "nexus-entropy-freshness-authority-v1",
    purpose: "PUBLICATION_INTENT",
    scope_root: publicationScopeRoot,
    nonce_commitment: publicationNonceCommitment,
    minimum_entropy_bits: 256,
    entropy_evidence_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "publication-entropy-evidence-v3",
    }),
    freshness_evidence_root: hash("NEXUS_TEST_ROOT_V1", {
      name: "publication-freshness-evidence-v3",
    }),
    one_use_commitment: entropyOneUseCommitmentRoot({
      nonceCommitment: publicationNonceCommitment,
      purpose: "PUBLICATION_INTENT",
      scopeRoot: publicationScopeRoot,
    }),
  };
  const publicationEntropyRegistration = emit(
    context,
    "requester",
    "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
    {
      schema: "nexus-register-entropy-freshness-authority-v1",
      body: {
        job_id: jobId,
        authority: publicationEntropyAuthority,
        binding: publicationScopeBinding,
      },
    },
    "register-publication-entropy-v3",
  );
  const publicationUseClaim = {
    schema: "nexus-entropy-one-use-claim-v1",
    authority_id: publicationEntropyRegistration.result.authority_id,
    authority_root: publicationEntropyRegistration.result.authority_root,
    purpose: "PUBLICATION_INTENT",
    scope_root: publicationScopeRoot,
    nonce_commitment: publicationNonceCommitment,
    use_scope_root: publicationIntentUseScopeRoot({
      binding: publicationScopeBinding,
      nonceAuthorityId: publicationEntropyRegistration.result.authority_id,
      nonceAuthorityRoot: publicationEntropyRegistration.result.authority_root,
      nonceCommitment: publicationNonceCommitment,
      scopeRoot: publicationScopeRoot,
    }),
  };
  const entropyConsumption = emit(
    context,
    "requester",
    "CONSUME_ENTROPY_AUTHORITY",
    { schema: "nexus-consume-entropy-authority-v1", claim: publicationUseClaim },
    "consume-publication-entropy-v3",
  ).result;
  const publication = emit(
    context,
    "requester",
    "CREATE_PUBLICATION_INTENT",
    {
      schema: "nexus-create-publication-intent-v3",
      body: {
        schema: "nexus-publication-intent-reference-set-v1",
        job_id: jobId,
        accepted_compilation_anchor_id: compilation.record_id,
        accepted_compilation_anchor_root: compilation.record_root,
        public_capsule_id: capsule.record_id,
        public_capsule_root: capsule.record_root,
        non_claims_id: nonClaims.record_id,
        non_claims_root: nonClaims.record_root,
        nonce: publicationNonce,
        nonce_authority_id: publicationEntropyRegistration.result.authority_id,
        nonce_authority_root: publicationEntropyRegistration.result.authority_root,
        nonce_consumption_id: entropyConsumption.consumption_id,
        nonce_consumption_root: entropyConsumption.consumption_root,
      },
    },
    "create-publication-intent-v3",
  );
  const storedIntent = stateOf(context).publication_intents[
    publication.result.intent_id
  ];
  const {
    intent_id: ignoredIntentId,
    accepted_publication_anchor_root: ignoredAnchorRoot,
    ...intentBody
  } = storedIntent;
  assert.equal(publication.result.intent_id, publicationIntentV3Id(intentBody));
  assert.equal(
    storedIntent.predecessor_root,
    publication.event.expected_predecessor_root,
  );
  assert.equal(
    storedIntent.destination_policy,
    "GITHUB_SANITIZED_WITNESS",
  );
  const publicationAnchor = emit(
    context,
    "requester",
    "ACCEPT_PUBLICATION",
    {
      schema: "nexus-accept-publication-v3",
      body: {
        schema: "nexus-accept-publication-reference-v1",
        publication_intent_id: publication.result.intent_id,
      },
    },
    "accept-publication-v3",
  ).result;
  const storedPublicationAnchor =
    stateOf(context).publication_anchors[publicationAnchor.record_id];
  assert.equal(
    storedPublicationAnchor.body.source_document_root,
    compilation.record_root,
  );

  const resolver = createAcceptedRecordResolver(context.runtime);
  const preparationAuthorityEnvelope = resolveAcceptedRecord(
    resolver,
    {
      record_type: "DISCLOSURE_PREPARATION_AUTHORITY",
      record_id:
        preparationAuthorization.result.preparation_authority_id,
      record_root:
        preparationAuthorization.result.preparation_authority_root,
    },
  );
  const preparationEntropyAuthority =
    preparationAuthorityEnvelope.record;
  const preparationEntropyReceipt =
    preparedContent.preparation_receipt;
  const entropyAuthorityEnvelope = resolveAcceptedRecord(resolver, {
    record_type: "ENTROPY_FRESHNESS_AUTHORITY",
    record_id:
      preparationEntropyAuthority.entropy_freshness_authority_id,
    record_root:
      preparationEntropyAuthority.entropy_freshness_authority_root,
  });
  assert.deepEqual(
    Object.keys(entropyAuthorityEnvelope.record).sort(),
    [
      "authority",
      "authority_id",
      "authority_root",
      "binding",
      "consumption_id",
      "consumption_root",
      "status",
    ],
  );
  assert.equal(
    disclosurePreparationNonceScopeRoot(
      entropyAuthorityEnvelope.record.binding,
    ),
    entropyAuthorityEnvelope.record.authority.scope_root,
  );
  assert.equal(entropyAuthorityEnvelope.record_status, "CONSUMED");
  assert.equal(
    entropyAuthorityEnvelope.record.consumption_id,
    preparationEntropyReceipt.preparation_entropy_consumption_id,
  );
  assert.equal(
    entropyAuthorityEnvelope.record.consumption_root,
    preparationEntropyReceipt.preparation_entropy_consumption_root,
  );
  const records = [
    ["DISCLOSURE_POLICY", acceptedPolicy.disclosure_policy_id, acceptedPolicy.disclosure_policy_record_root],
    ["DISCLOSURE_PROOF_CONTEXT", acceptedProofContext.disclosure_proof_context_id, acceptedProofContext.disclosure_proof_context_record_root],
    ["DISCLOSURE_PREPARATION_AUTHORITY", preparationAuthorization.result.preparation_authority_id, preparationAuthorization.result.preparation_authority_root],
    ["DISCLOSURE_PREPARATION", acceptedPreparation.preparation_id, acceptedPreparation.preparation_record_root],
    ["PUBLIC_EXPORT_AUTHORITY", exportAuthorityResult.export_authority_id, exportAuthorityRoot],
    ["DISCLOSURE_SCAN_RECEIPT", scan.record_id, scan.record_root],
    ["DISCLOSURE_APPROVAL_RECEIPT", approval.record_id, approval.record_root],
    ["DATA_ROUTE_AUTHORITY", dataRoute.record_id, dataRoute.record_root],
    ["TOOL_ROUTE_AUTHORITY", toolRoute.record_id, toolRoute.record_root],
    ["REDACTION_MANIFEST", redactionManifest.record_id, redactionManifest.record_root],
    ["REDACTION_APPROVAL", redactionApproval.record_id, redactionApproval.record_root],
    ["DISCLOSURE_MANIFEST", disclosureManifest.record_id, disclosureManifest.record_root],
    ["DISCLOSURE_COMPILATION_ANCHOR", compilation.record_id, compilation.record_root],
    ["PUBLIC_CAPSULE", capsule.record_id, capsule.record_root],
    ["NON_CLAIMS", nonClaims.record_id, nonClaims.record_root],
    ["PUBLICATION_INTENT", publication.result.intent_id, publication.result.intent_id.slice("PUBINTENT-".length)],
    ["PUBLICATION_ANCHOR", publicationAnchor.record_id, publicationAnchor.record_root],
  ];
  for (const [recordType, recordId, recordRoot] of records) {
    const envelope = resolveAcceptedRecord(resolver, {
      record_type: recordType,
      record_id: recordId,
      record_root: recordRoot,
    });
    assert.equal(envelope.record_status, "ACCEPTED");
    assert(Object.isFrozen(envelope.record));
  }
  Object.assign(happy, {
    resolver,
    publication,
    publicationAnchor,
    entropyConsumption,
    entropyUseClaim: publicationUseClaim,
    nonceAuthorityRoot: publicationEntropyRegistration.result.authority_root,
    disclosureManifest,
    compilation,
    capsule,
    nonClaims,
  });
  return happy;
}

function runHoldAbortPath() {
  const prepared = continueToReviewOutcome(
    prepareCommittedBid(),
    ["DISSENT", "CLEAR", "CLEAR"],
  );
  const { context, jobId, outcome } = prepared;
  assert.equal(outcome.outcome, "HOLD");
  advance(context, "hold-tick-3");
  advance(context, "hold-tick-4");
  const rootBeforeRejectedMutation = currentRoot(context.runtime);
  const blocked = buildEvent(stateOf(context), {
    eventType: "ISSUE_ALLOWANCE",
    actorId: principal(context, "requester").principal_id,
    payload: {
      job_id: jobId,
      amount: 1,
      not_before_tick: 4,
      expiry_tick: 5,
      agent_seat_id: "SEAT-NOT-USED",
      purpose: "SUBWORK",
      allowance_nonce: "blocked-allowance",
    },
    nonce: "blocked-after-hold-timeout",
  });
  expectCode(
    "ERR_HOLD_TIMEOUT_ABORT_REQUIRED",
    () => applyEvent(context.runtime, blocked),
  );
  assert.equal(currentRoot(context.runtime), rootBeforeRejectedMutation);
  const terminal = emit(
    context,
    "requester",
    "ABORT_JOB",
    { job_id: jobId, authorization_root: outcome.hold_root },
    "abort-held-job-1",
  );
  assert.equal(terminal.state.jobs[jobId].state, "ABORTED");
  return prepared;
}

export function runReviewReplacementPath(
  { stopAfterReplacement = false } = {},
) {
  const prepared = continueToReviewOutcome(
    prepareCommittedBid(),
    ["CLEAR", "CLEAR", "CLEAR"],
    {
      reviewExpiryTick: 10,
      assignmentExpiryTicks: [3, 9, 9],
      stopAfterAssignments: true,
    },
  );
  const { context, jobId, reviewerOffers } = prepared;
  advance(context, "replacement-tick-3");
  const expiredId =
    prepared.assignmentResult.review_assignment_ids[0];
  const expired = stateOf(context).review_assignments[expiredId];
  assert.equal(expired.status, "EXPIRED");
  assert.equal(stateOf(context).jobs[jobId].state, "HOLD");
  const reviewerD = reviewerOffers[3];
  const replacementPayload = {
    job_id: jobId,
    expired_assignment_id: expiredId,
    expected_assignment_record_root: expired.record_root,
    expected_assignment_revision: expired.record_revision,
    replacement: {
      reviewer_principal_id: principal(context, "reviewer-d").principal_id,
      reviewer_seat_id: reviewerD.worker_seat_id,
      model_id: reviewerD.spec.model,
      capability_offer_id: reviewerD.offer_id,
      capability_offer_root: reviewerD.offer_root,
      expiry_tick: 9,
    },
    replacement_nonce: "replacement-1",
  };
  const staleReplacement = buildEvent(stateOf(context), {
    eventType: "REPLACE_REVIEWER",
    actorId: principal(context, "requester").principal_id,
    payload: {
      ...replacementPayload,
      expected_assignment_record_root: "stale-assignment-root",
    },
    nonce: "stale-replacement",
  });
  const rootBeforeStale = currentRoot(context.runtime);
  expectCode(
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    () => applyEvent(context.runtime, staleReplacement),
  );
  assert.equal(currentRoot(context.runtime), rootBeforeStale);
  const replacement = emit(
    context,
    "requester",
    "REPLACE_REVIEWER",
    replacementPayload,
    "replace-reviewer-1",
  ).result;
  assert.equal(stateOf(context).jobs[jobId].state, "REVIEW");
  assert.equal(
    stateOf(context).review_assignments[replacement.review_assignment_id]
      .replacement_of,
    expiredId,
  );
  const reviewResolver = createAcceptedRecordResolver(context.runtime);
  const historyRequest = {
    record_type: "REVIEW_ASSIGNMENT",
    scope: {
      job_id: jobId,
      review_packet_root: expired.packet_root,
      assignment_slot: expired.slot,
    },
  };
  const reviewHistory =
    reviewResolver.resolveAcceptedRecordSet(historyRequest);
  assert.equal(
    reviewHistory.schema,
    "nexus-accepted-record-set-envelope-v2",
  );
  assert.equal(
    reviewHistory.accepted_logical_tick,
    stateOf(context).tick,
  );
  assert.equal(reviewHistory.records.length, 2);
  assert.deepEqual(
    reviewHistory.records.map((record) => record.record.attempt),
    [1, 2],
  );
  assert(Object.isFrozen(reviewHistory));
  assert.equal(
    canonicalize(reviewHistory),
    canonicalize(resolveAcceptedRecordSet(reviewResolver, historyRequest)),
  );
  expectCode("ERR_UNSAFE_INTEGER", () =>
    reviewResolver.resolveAcceptedRecordSet({
      ...historyRequest,
      scope: {
        ...historyRequest.scope,
        assignment_slot: -1,
      },
    }),
  );
  expectCode("ERR_AUTHORITY", () =>
    resolveAcceptedRecordSet(Object.freeze({}), historyRequest),
  );
  const expiredEnvelope = reviewResolver.resolveAcceptedRecord({
    record_type: "REVIEW_ASSIGNMENT",
    record_id: expiredId,
    record_root: expired.record_root,
  });
  const replacementRecord =
    stateOf(context).review_assignments[
      replacement.review_assignment_id
    ];
  const replacementEnvelope =
    reviewResolver.resolveAcceptedRecord({
      record_type: "REVIEW_ASSIGNMENT",
      record_id: replacement.review_assignment_id,
      record_root: replacementRecord.record_root,
    });
  if (stopAfterReplacement) {
    return {
      ...prepared,
      expired,
      replacement,
      reviewHistory,
      resolver: reviewResolver,
      packet_ref: {
        job_id: jobId,
        review_packet_root: expired.packet_root,
      },
      history_scope: structuredClone(historyRequest.scope),
      expired_assignment_ref: {
        record_type: "REVIEW_ASSIGNMENT",
        record_id: expiredEnvelope.record_id,
        record_root: expiredEnvelope.record_root,
        record_revision: expiredEnvelope.record_revision,
      },
      replacement_assignment_ref: {
        record_type: "REVIEW_ASSIGNMENT",
        record_id: replacementEnvelope.record_id,
        record_root: replacementEnvelope.record_root,
        record_revision: replacementEnvelope.record_revision,
      },
    };
  }
  for (let tick = 4; tick <= 11; tick += 1) {
    advance(context, `replacement-tick-${tick}`);
  }
  const heldJob = stateOf(context).jobs[jobId];
  assert.equal(heldJob.timeout_abort_required, true);
  emit(
    context,
    "requester",
    "ABORT_JOB",
    { job_id: jobId, authorization_root: heldJob.hold_root },
    "abort-replacement-timeout",
  );
  assert.equal(stateOf(context).jobs[jobId].state, "ABORTED");
}

function runDisputedPayoutAbortPath() {
  const prepared = continueToReviewOutcome(prepareCommittedBid());
  const { context, jobId, outcome } = prepared;
  const decision = emit(
    context,
    "requester",
    "HUMAN_DECISION",
    {
      job_id: jobId,
      decision: "ACCEPT",
      clearance_root: outcome.clearance_root,
      hold_root: null,
      reason_codes: [],
      decision_nonce: "disputed-decision",
    },
    "disputed-human-decision",
  ).result;
  const leadPayout = Object.values(stateOf(context).payouts).find(
    (payout) => payout.kind === "LEAD_WORK",
  );
  const appeal = emit(
    context,
    "worker",
    "FILE_APPEAL",
    {
      job_id: jobId,
      decision_root: decision.decision_id,
      claimed_role: "WORKER",
      ground: "QUALITY",
      disputed_payout_ids: [leadPayout.payout_id],
      evidence_packet_root: "disputed-payout-evidence-root-v1",
      appeal_nonce: "disputed-payout-appeal",
    },
    "file-disputed-payout-appeal",
  ).result;
  assert.equal(
    stateOf(context).payouts[leadPayout.payout_id].dispute_status,
    "FROZEN",
  );
  advance(context, "dispute-tick-3");
  advance(context, "dispute-tick-4");
  advance(context, "dispute-tick-5");
  const timedOutAppeal = stateOf(context).appeals[appeal.appeal_id];
  assert.equal(timedOutAppeal.status, "RESOLVED");
  assert.equal(timedOutAppeal.resolution, "ABORT");
  emit(
    context,
    "requester",
    "ABORT_JOB",
    {
      job_id: jobId,
      authorization_root: timedOutAppeal.resolution_root,
    },
    "abort-disputed-payout",
  );
  assert.equal(
    stateOf(context).payouts[leadPayout.payout_id].status,
    "CANCELLED",
  );
  assert.equal(account(context, "worker").available, 0);
  assert.equal(stateOf(context).jobs[jobId].state, "ABORTED");
}

function runAppealAbortAuthorityPath() {
  const prepared = continueToReviewOutcome(
    prepareCommittedBid(),
    ["DISSENT", "CLEAR", "CLEAR"],
  );
  const { context, jobId, outcome } = prepared;
  const decision = emit(
    context,
    "requester",
    "HUMAN_DECISION",
    {
      job_id: jobId,
      decision: "ABORT",
      clearance_root: null,
      hold_root: outcome.hold_root,
      reason_codes: ["MATERIAL_DISSENT"],
      decision_nonce: "appealed-abort-decision",
    },
    "appealed-abort-decision",
  ).result;
  const appeal = emit(
    context,
    "worker",
    "FILE_APPEAL",
    {
      job_id: jobId,
      decision_root: decision.decision_id,
      claimed_role: "WORKER",
      ground: "QUALITY",
      disputed_payout_ids: [],
      evidence_packet_root: "appealed-abort-evidence",
      appeal_nonce: "appealed-abort",
    },
    "file-appealed-abort",
  ).result;
  assert.equal(
    stateOf(context).jobs[jobId].abort_authorization_root,
    null,
  );
  const staleAbort = buildEvent(stateOf(context), {
    eventType: "ABORT_JOB",
    actorId: principal(context, "requester").principal_id,
    payload: {
      job_id: jobId,
      authorization_root: decision.decision_id,
    },
    nonce: "stale-abort-during-appeal",
  });
  const beforeStaleAbort = currentRoot(context.runtime);
  expectCode(
    "ERR_APPEAL_INELIGIBLE",
    () => applyEvent(context.runtime, staleAbort),
  );
  assert.equal(currentRoot(context.runtime), beforeStaleAbort);
  const resolution = emit(
    context,
    "resolver",
    "RESOLVE_APPEAL",
    {
      appeal_id: appeal.appeal_id,
      resolution: "ABORT",
      evidence_root: "resolved-abort-evidence",
      reason_codes: ["UPHELD_ABORT"],
      valid_payout_ids: [],
      invalid_payout_ids: [],
      resolution_nonce: "resolved-abort",
    },
    "resolve-appealed-abort",
  ).result;
  const changedAuthority = buildEvent(stateOf(context), {
    eventType: "ABORT_JOB",
    actorId: principal(context, "requester").principal_id,
    payload: {
      job_id: jobId,
      authorization_root: decision.decision_id,
    },
    nonce: "changed-resolved-abort-authority",
  });
  expectCode(
    "ERR_HOLD_BINDING",
    () => applyEvent(context.runtime, changedAuthority),
  );
  emit(
    context,
    "requester",
    "ABORT_JOB",
    { job_id: jobId, authorization_root: resolution.resolution_root },
    "exact-resolved-abort-authority",
  );
  assert.equal(stateOf(context).jobs[jobId].state, "ABORTED");
}

export function runDonatedConsentVectors(
  context = createCoreEconomyFixture(),
  {
    offerOverrides = {},
    probeInput = null,
  } = {},
) {
  const worker = principal(context, "worker");
  const workerSeatId = rootId("SEAT", "NEXUS_SEAT_V1", {
    principal_id: worker.principal_id,
    seat_nonce: "donated-seat",
  });
  const offerInput = {
    offer_mode: "DONATED_CAPACITY",
    worker_class: "REGISTERED",
    owner_consent_id: null,
    owner_consent_root: null,
    project_allowlist: [],
    job_allowlist: [],
    model_id: "donated-model",
    provider_family: "donated-provider",
    operator_id: "donated-operator",
    route: "LOCAL",
    data_classes: ["PUBLIC"],
    tools: ["node"],
    runtimes: ["node"],
    egress_allowlist: [],
    max_input_bytes: 1000,
    max_output_bytes: 1000,
    max_compute_units: 10,
    max_active_leases: 1,
    isolation_root: ROOTS.isolation,
    trusted_worker_policy_root: "trusted-worker-policy-root-v1",
    maximum_capability_root: ROOTS.maximumCapability,
    contribution_terms_allowlist: [ROOTS.terms],
    attribution: "PUBLIC_ALIAS",
    probe_root: "donated-probe",
    not_before_tick: 0,
    expiry_tick: 30,
    seat_nonce: "donated-seat",
    offer_nonce: "donated-offer",
    ...offerOverrides,
  };
  const offerTermsBody = {
    schema: "nexus-capability-offer-v1",
    principal_id: worker.principal_id,
    worker_seat_id: workerSeatId,
    offer_mode: offerInput.offer_mode,
    worker_class: offerInput.worker_class,
    owner_consent_id: null,
    owner_consent_root: null,
    project_allowlist: offerInput.project_allowlist,
    job_allowlist: offerInput.job_allowlist,
    model_id: offerInput.model_id,
    provider_family: offerInput.provider_family,
    operator_id: offerInput.operator_id,
    route: offerInput.route,
    data_classes: offerInput.data_classes,
    tools: offerInput.tools,
    runtimes: offerInput.runtimes,
    egress_allowlist: offerInput.egress_allowlist,
    max_input_bytes: offerInput.max_input_bytes,
    max_output_bytes: offerInput.max_output_bytes,
    max_compute_units: offerInput.max_compute_units,
    max_active_leases: offerInput.max_active_leases,
    isolation_root: offerInput.isolation_root,
    trusted_worker_policy_root: offerInput.trusted_worker_policy_root,
    maximum_capability_root: offerInput.maximum_capability_root,
    contribution_terms_allowlist:
      offerInput.contribution_terms_allowlist,
    attribution: offerInput.attribution,
    probe_root: offerInput.probe_root,
    not_before_tick: offerInput.not_before_tick,
    expiry_tick: offerInput.expiry_tick,
    nonce: offerInput.offer_nonce,
  };
  const consentBody = {
    schema: "nexus-donated-capacity-consent-body-v1",
    principal_id: worker.principal_id,
    controller_id: worker.controller_id,
    offer_terms_root: capabilityOfferTermsRoot(offerTermsBody),
    not_before_tick: 0,
    expiry_tick: 30,
    consent_nonce: "donated-consent",
  };
  assert.equal(
    capabilityOfferTermsRoot(offerTermsBody),
    capabilityOfferTermsRoot({
      ...offerTermsBody,
      probe_root: "different-authorized-probe-root",
    }),
  );
  const authentication = buildIndependentControllerAuthentication(
    stateOf(context),
    {
      principalId: worker.principal_id,
      controllerId: worker.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot: donatedCapacityConsentBodyRoot(consentBody),
    },
  );
  const consentPayload = {
    schema: "nexus-accept-donated-capacity-consent-v1",
    body: consentBody,
    authentication,
  };
  const consentEvent = buildEvent(stateOf(context), {
    eventType: "ACCEPT_DONATED_CAPACITY_CONSENT",
    actorId: worker.principal_id,
    payload: consentPayload,
    nonce: "accept-donated-consent",
  });
  const invalidInnerAuthentication = structuredClone(authentication);
  invalidInnerAuthentication.ed25519_signature_base64url =
    invalidInnerAuthentication.ed25519_signature_base64url.replace(
      /^./,
      (character) => (character === "0" ? "1" : "0"),
    );
  const invalidInnerReplayEvent = buildEvent(stateOf(context), {
    eventType: "ACCEPT_DONATED_CAPACITY_CONSENT",
    actorId: worker.principal_id,
    payload: {
      ...consentPayload,
      authentication: invalidInnerAuthentication,
    },
    nonce: "accept-donated-consent",
  });
  const consentAcceptance = applyEvent(context.runtime, consentEvent);
  context.events.push(consentEvent);
  const acceptedConsent = consentAcceptance.result;
  const consentJournal = snapshotOf(context);
  expectCode("ERR_SCHEMA", () =>
    buildEvent(stateOf(context), {
      eventType: "ACCEPT_DONATED_CAPACITY_CONSENT",
      actorId: worker.principal_id,
      payload: {
        ...consentPayload,
        authentication:
          verifiedHybridAuthenticationReference(authentication),
      },
      nonce: "reject-caller-verified-consent-reference",
    }),
  );
  const storedConsent =
    stateOf(context).donated_capacity_consents[
      acceptedConsent.consent_id
    ];
  const {
    record_root: ignoredConsentRecordRoot,
    ...consentRecord
  } = storedConsent;
  assert.equal(
    acceptedConsent.consent_root,
    donatedCapacityConsentRecordRoot(consentRecord),
  );
  const consentResolver = createAcceptedRecordResolver(context.runtime);
  const consentEnvelope = consentResolver.resolveAcceptedRecord({
    record_type: "DONATED_CAPACITY_CONSENT",
    record_id: acceptedConsent.consent_id,
    record_root: acceptedConsent.consent_root,
  });
  assert.equal(consentEnvelope.record_status, "ACCEPTED");
  assert(Object.isFrozen(consentEnvelope.record));
  const alteredConsentAuthentication = structuredClone(consentRecord);
  alteredConsentAuthentication.authentication.key_id =
    alteredConsentAuthentication.authentication.key_id.replace(
      /^./,
      (character) => (character === "0" ? "1" : "0"),
    );
  expectCode("ERR_ID_PREIMAGE", () =>
    donatedCapacityConsentRecordRoot(
      alteredConsentAuthentication,
    ),
  );
  assertCarrierAuthenticationReferenceBinding({
    recordType: "DONATED_CAPACITY_CONSENT",
    idField: "consent_id",
    record: consentRecord,
    rootFn: donatedCapacityConsentRecordRoot,
    expectedRoot: acceptedConsent.consent_root,
    invalidMutationFields: new Set([
      "schema",
      "scheme",
      "controller_id",
      "signed_domain",
      "signed_payload_root",
    ]),
  });

  const donatedOfferPayload = {
    ...offerInput,
    owner_consent_id: acceptedConsent.consent_id,
    owner_consent_root: acceptedConsent.consent_root,
  };
  let probe = null;
  if (probeInput !== null) {
    const offerBindingRoot = capabilityOfferBindingRoot({
      ...offerTermsBody,
      owner_consent_id: acceptedConsent.consent_id,
      owner_consent_root: acceptedConsent.consent_root,
    });
    probe = {
      schema: "nexus-capability-probe-v1",
      offer_binding_root: offerBindingRoot,
      worker_seat_id: workerSeatId,
      ...probeInput,
    };
    donatedOfferPayload.probe_root = capabilityProbeRoot(probe);
  }
  const donatedOfferAcceptance = emit(
    context,
    "worker",
    "REGISTER_OFFER",
    donatedOfferPayload,
    "register-donated-offer",
  );
  const donatedOffer = donatedOfferAcceptance.result;
  const storedOffer =
    stateOf(context).capability_offers[donatedOffer.offer_id];
  assert.equal(
    storedOffer.offer_id,
    derivedCarrierId("CAPABILITY_OFFER", storedOffer),
  );
  const storedOfferRoot = capabilityOfferRoot(storedOffer);
  expectCode("ERR_ID_PREIMAGE", () =>
    capabilityOfferRoot({
      ...storedOffer,
      probe_root: "mismatched-final-probe-root",
    }),
  );
  const alteredOfferAuthentication = structuredClone(storedOffer);
  alteredOfferAuthentication.authentication.key_id =
    alteredOfferAuthentication.authentication.key_id.replace(
      /^./,
      (character) => (character === "0" ? "1" : "0"),
    );
  expectCode("ERR_ID_PREIMAGE", () =>
    capabilityOfferRoot(alteredOfferAuthentication),
  );
  assertCarrierAuthenticationReferenceBinding({
    recordType: "CAPABILITY_OFFER",
    idField: "offer_id",
    record: storedOffer,
    rootFn: capabilityOfferRoot,
    expectedRoot: storedOfferRoot,
    invalidMutationFields: new Set([
      "schema",
      "scheme",
      "signed_domain",
    ]),
  });
  const rootBeforeExactOfferReplay = currentRoot(context.runtime);
  const exactOfferReplay = applyEvent(
    context.runtime,
    donatedOfferAcceptance.event,
  );
  assert.equal(exactOfferReplay.replay, true);
  assert.equal(
    canonicalize(exactOfferReplay.receipt),
    canonicalize(donatedOfferAcceptance.receipt),
  );
  assert.equal(currentRoot(context.runtime), rootBeforeExactOfferReplay);
  const duplicateOffer = buildEvent(stateOf(context), {
    eventType: "REGISTER_OFFER",
    actorId: worker.principal_id,
    payload: donatedOfferPayload,
    nonce: "duplicate-donated-offer",
  });
  function assertDuplicateCapabilityOfferContentRejectedByLiveReducer() {
    const sourceCanonicalState = canonicalize(stateOf(context));
    expectCode(
      "ERR_ID_PREIMAGE",
      () => applyEvent(context.runtime, duplicateOffer),
    );
    assert.equal(canonicalize(stateOf(context)), sourceCanonicalState);
  }
  assertDuplicateCapabilityOfferContentRejectedByLiveReducer();
  const paidOfferPayload = {
    ...offerInput,
    offer_mode: "PAID",
    owner_consent_id: null,
    owner_consent_root: null,
    offer_nonce: "paid-content-root-a",
  };
  const firstPaidOffer = emit(
    context,
    "worker",
    "REGISTER_OFFER",
    paidOfferPayload,
    "register-paid-content-root-a",
  ).result;
  const distinctOffer = emit(
    context,
    "worker",
    "REGISTER_OFFER",
    {
      ...paidOfferPayload,
      offer_nonce: "paid-content-root-b",
    },
    "register-paid-content-root-b",
  ).result;
  const storedFirstPaidOffer =
    stateOf(context).capability_offers[firstPaidOffer.offer_id];
  const storedDistinctOffer =
    stateOf(context).capability_offers[distinctOffer.offer_id];
  assert.notEqual(distinctOffer.offer_id, firstPaidOffer.offer_id);
  assert.notEqual(
    storedDistinctOffer.offer_content_root,
    storedFirstPaidOffer.offer_content_root,
  );
  assert.notEqual(
    capabilityOfferRoot(storedDistinctOffer),
    capabilityOfferRoot(storedFirstPaidOffer),
  );
  function assertTamperedCapabilityOfferStateFailsClosed({
    tamperedState,
    expectedCode,
    sourceCanonicalState,
  }) {
    expectCode(expectedCode, () => createRuntime(tamperedState));
    assert.equal(canonicalize(stateOf(context)), sourceCanonicalState);
    expectCode(expectedCode, () =>
      recoverRuntime({
        genesisState: tamperedState,
        events: [],
        receipts: [],
        expectedFinalRoot: "0".repeat(64),
      }),
    );
    assert.equal(canonicalize(stateOf(context)), sourceCanonicalState);
  }

  function assertMissingCapabilityOfferContentIndexRowFailsClosed() {
    const sourceCanonicalState = canonicalize(stateOf(context));
    const tamperedState = structuredClone(stateOf(context));
    delete tamperedState.capability_offer_content_index[
      storedOffer.offer_content_root
    ];
    assertTamperedCapabilityOfferStateFailsClosed({
      tamperedState,
      expectedCode: "ERR_CAPABILITY",
      sourceCanonicalState,
    });
  }

  function assertExtraStaleCapabilityOfferContentIndexRowFailsClosed() {
    const sourceCanonicalState = canonicalize(stateOf(context));
    const tamperedState = structuredClone(stateOf(context));
    const staleContentRoot = storedOffer.offer_content_root.replace(
      /^./,
      (character) => (character === "0" ? "1" : "0"),
    );
    tamperedState.capability_offer_content_index[staleContentRoot] =
      storedOffer.offer_id;
    assertTamperedCapabilityOfferStateFailsClosed({
      tamperedState,
      expectedCode: "ERR_CAPABILITY",
      sourceCanonicalState,
    });
  }

  function assertWrongCapabilityOfferContentIndexRowFailsClosed() {
    const sourceCanonicalState = canonicalize(stateOf(context));
    const tamperedState = structuredClone(stateOf(context));
    tamperedState.capability_offer_content_index[
      storedOffer.offer_content_root
    ] = distinctOffer.offer_id;
    assertTamperedCapabilityOfferStateFailsClosed({
      tamperedState,
      expectedCode: "ERR_CAPABILITY",
      sourceCanonicalState,
    });
  }

  function assertPerRecordOfferContentRootTamperFailsClosed() {
    const sourceCanonicalState = canonicalize(stateOf(context));
    const tamperedState = structuredClone(stateOf(context));
    tamperedState.capability_offers[
      storedOffer.offer_id
    ].offer_content_root = "0".repeat(64);
    assertTamperedCapabilityOfferStateFailsClosed({
      tamperedState,
      expectedCode: "ERR_ID_PREIMAGE",
      sourceCanonicalState,
    });
  }

  assertMissingCapabilityOfferContentIndexRowFailsClosed();
  assertExtraStaleCapabilityOfferContentIndexRowFailsClosed();
  assertWrongCapabilityOfferContentIndexRowFailsClosed();
  assertPerRecordOfferContentRootTamperFailsClosed();
  expectCode("ERR_SCHEMA", () =>
    buildEvent(stateOf(context), {
      eventType: "REGISTER_OFFER",
      actorId: worker.principal_id,
      payload: {
        ...donatedOfferPayload,
        offer_id: "OFFER-caller-supplied",
      },
      nonce: "caller-supplied-offer-id",
    }),
  );

  const tamperedBody = {
    ...consentBody,
    consent_nonce: "tampered-consent",
  };
  const tamperedAuthentication = buildIndependentControllerAuthentication(
    stateOf(context),
    {
      principalId: worker.principal_id,
      controllerId: worker.controller_id,
      signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
      signedBodyRoot: donatedCapacityConsentBodyRoot(tamperedBody),
    },
  );
  tamperedAuthentication.ed25519_signature_base64url =
    tamperedAuthentication.ed25519_signature_base64url.replace(/^./, (character) =>
      character === "0" ? "1" : "0",
    );
  const tamperedConsent = buildEvent(stateOf(context), {
    eventType: "ACCEPT_DONATED_CAPACITY_CONSENT",
    actorId: worker.principal_id,
    payload: {
      schema: "nexus-accept-donated-capacity-consent-v1",
      body: tamperedBody,
      authentication: tamperedAuthentication,
    },
    nonce: "tampered-donated-consent",
  });
  expectCode(
    "ERR_AUTHORITY",
    () => applyEvent(context.runtime, tamperedConsent),
  );
  return {
    context,
    runtime: context.runtime,
    resolver: createAcceptedRecordResolver(context.runtime),
    acceptedConsent,
    authentication,
    consentEvent,
    consentReceipt: consentAcceptance.receipt,
    consentJournal,
    invalidInnerReplayEvent,
    consentEnvelope,
    consentBody,
    donatedOffer: {
      ...donatedOffer,
      offer_root: storedOfferRoot,
    },
    probe,
  };
}

export function createPreAssignmentReviewFixture() {
  return continueToReviewOutcome(
    prepareCommittedBid(),
    ["CLEAR", "CLEAR", "CLEAR"],
    { stopBeforeAssignments: true },
  );
}

export function createPostAssignmentReviewFixture() {
  return continueToReviewOutcome(
    prepareCommittedBid(),
    ["CLEAR", "CLEAR", "CLEAR"],
    { stopAfterAssignments: true },
  );
}

export function createPostReviewFixture() {
  return continueToReviewOutcome(
    prepareCommittedBid(),
    ["CLEAR", "CLEAR", "CLEAR"],
    { stopAfterReviews: true },
  );
}

export function createReplacementReviewFixture() {
  return runReviewReplacementPath({ stopAfterReplacement: true });
}

export function createDonatedCapacityFixture() {
  const stage = createPreAssignmentReviewFixture();
  const beforeDonation = stateOf(stage.context);
  const job = beforeDonation.jobs[stage.jobId];
  const task = Object.values(beforeDonation.tasks)
    .find(
      (candidate) =>
        candidate.job_id === stage.jobId &&
        candidate.kind === "LEAD",
    );
  const donated = runDonatedConsentVectors(stage.context, {
    offerOverrides: {
      project_allowlist: [job.project_id],
      job_allowlist: [stage.jobId],
      model_id: "worker-model",
      provider_family: "worker-provider",
      operator_id: "worker-operator",
      max_input_bytes: task.max_input_bytes,
      max_output_bytes: task.max_output_bytes,
      max_compute_units:
        job.accepted_contract.work.max_compute_units,
    },
    probeInput: {
      capability_root:
        job.accepted_contract.authority_ceiling
          .maximum_capability_root,
      capabilities: [...task.required_capabilities],
      status: "PASS",
      observed_tick: beforeDonation.tick,
      expiry_tick: 15,
      policy_root: job.accepted_contract.policy_root,
      nonce: "donated-positive-probe",
    },
  });
  const capabilityOfferRef = {
    record_type: "CAPABILITY_OFFER",
    record_id: donated.donatedOffer.offer_id,
    record_root: donated.donatedOffer.offer_root,
  };
  const donatedCapacityConsentRef = {
    record_type: "DONATED_CAPACITY_CONSENT",
    record_id: donated.acceptedConsent.consent_id,
    record_root: donated.acceptedConsent.consent_root,
  };
  const bid = {
    bidder_principal_id:
      principal(stage.context, "worker").principal_id,
    worker_seat_id: donated.donatedOffer.worker_seat_id,
    capability_offer_root: donated.donatedOffer.offer_root,
    price: 0,
    completion_ticks: 1,
    model_id: "worker-model",
    provider_family: "worker-provider",
    operator_id: "worker-operator",
    probe_root: capabilityProbeRoot(donated.probe),
    job_id: stage.jobId,
    job_version: job.accepted_contract.job_version,
    draft_contract_root: job.draft_contract_root,
  };
  return {
    ...stage,
    ...donated,
    resolver: createAcceptedRecordResolver(stage.context.runtime),
    capabilityOfferRef,
    donatedCapacityConsentRef,
    eligibility_input: {
      capabilityOfferRef,
      donatedCapacityConsentRef,
      contract: {
        ...structuredClone(job.accepted_contract),
        award: null,
      },
      task: structuredClone(task),
      job: structuredClone(job),
      bid,
      probe: structuredClone(donated.probe),
      tick: beforeDonation.tick,
    },
  };
}

export function createRevokedOfferFixture() {
  const fixture = createDonatedCapacityFixture();
  const revocation = emit(
    fixture.context,
    "worker",
    "REVOKE_OFFER",
    {
      capability_offer_id: fixture.capabilityOfferRef.record_id,
      capability_offer_root: fixture.capabilityOfferRef.record_root,
    },
    "revoke-donated-offer",
  );
  return {
    ...fixture,
    revocation,
    resolver: createAcceptedRecordResolver(fixture.context.runtime),
  };
}

function createRoutePlanningPrefix(leaseOrdinal = 0) {
  const happy = runCoreEconomyHappyPath();
  const complete = snapshotRuntime(happy.context.runtime);
  const leaseIndex = happy.context.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.event_type === "ISSUE_LEASE")[
      leaseOrdinal
    ]?.index;
  assert(leaseIndex >= 0);
  const events = structuredClone(
    happy.context.events.slice(0, leaseIndex + 1),
  );
  const receipts = structuredClone(
    complete.receipts.slice(0, leaseIndex + 1),
  );
  const runtime = recoverRuntime({
    genesisState: structuredClone(happy.context.genesisState),
    events,
    receipts,
    expectedFinalRoot: receipts.at(-1).next_state_root,
  });
  return {
    runtime,
    events,
    genesisState: structuredClone(happy.context.genesisState),
  };
}

function recoverRoutePlanningPrefix(prefix) {
  const journal = snapshotRuntime(prefix.runtime);
  return {
    runtime: recoverRuntime({
      genesisState: structuredClone(prefix.genesisState),
      events: structuredClone(journal.events),
      receipts: structuredClone(journal.receipts),
      expectedFinalRoot: journal.current_root,
    }),
    events: structuredClone(journal.events),
    genesisState: structuredClone(prefix.genesisState),
  };
}

function routePlanningFacts(context) {
  const state = stateOf(context);
  const lease = Object.values(state.leases).find(
    (record) => record.status === "ACTIVE",
  );
  assert(lease);
  const task = state.tasks[lease.task_id];
  const job = state.jobs[lease.job_id];
  const offer = Object.values(state.capability_offers).find(
    (record) => capabilityOfferRoot(record) === lease.capability_offer_root,
  );
  const accountRecord = state.accounts[job.job_account_id];
  const commitment = Object.values(state.subwork_commitments).find(
    (record) =>
      record.task_id === task.task_id && record.status === "AUTHORIZED",
  ) ?? null;
  const allowanceRecord =
    commitment === null ? null : state.allowances[commitment.allowance_id];
  const fundingLotIds =
    commitment === null
      ? job.funding_lot_ids
      : commitment.funding_lot_ids;
  const fundingLots = fundingLotIds
    .map((lotId) => state.funding_lots[lotId])
    .sort((left, right) => left.lot_id.localeCompare(right.lot_id));
  assert(offer && accountRecord && fundingLots.length > 0);
  return {
    state,
    lease,
    task,
    job,
    offer,
    accountRecord,
    commitment,
    allowanceRecord,
    fundingLots,
  };
}

function classifiedInputMeasurementPayload(context) {
  const { lease, task, job } = routePlanningFacts(context);
  const byteLength = task.max_input_bytes;
  return {
    job_ref: {
      record_id: job.job_id,
      record_root: job.record_root,
    },
    task_ref: {
      record_id: task.task_id,
      record_root: task.record_root,
    },
    lease_ref: {
      record_id: lease.lease_id,
      record_root: lease.record_root,
    },
    entries: [
      {
        input_root: task.input_manifest_root,
        data_class: task.data_class,
        byte_length: byteLength,
        measurement_receipt_root: hash(
          "NEXUS_TEST_INPUT_MEASUREMENT_RECEIPT_V1",
          {
            input_root: task.input_manifest_root,
            data_class: task.data_class,
            byte_length: byteLength,
          },
        ),
      },
    ],
  };
}

function recordClassifiedInputMeasurement(
  context,
  { actor = "verifier", mutate = null, nonce = "route-input-measurement" } = {},
) {
  const payload = classifiedInputMeasurementPayload(context);
  if (mutate !== null) mutate(payload, routePlanningFacts(context));
  const result = emit(
    context,
    actor,
    "RECORD_CLASSIFIED_INPUT_MEASUREMENT",
    payload,
    nonce,
  ).result;
  return { payload, result };
}

function routePlanningPayloadV2(context, measurement) {
  const { lease } = routePlanningFacts(context);
  return {
    lease_ref: {
      record_id: lease.lease_id,
      record_root: lease.record_root,
    },
    classified_input_manifest_ref: {
      record_id: measurement.result.classified_input_manifest_id,
      record_root: measurement.result.classified_input_manifest_root,
    },
    data_route_authority_ref: null,
    redaction_approval_ref: null,
    tool_route_authority_refs: [],
    plan_nonce: hash("NEXUS_TEST_ROUTE_PLAN_NONCE_V2", {
      lease_id: lease.lease_id,
      measurement_root:
        measurement.result.classified_input_manifest_root,
    }).slice(0, 32),
  };
}

function createRoutePlanOnContext(
  context,
  { measurement = null, mutatePlan = null, planNonce = null } = {},
) {
  const acceptedMeasurement =
    measurement ?? recordClassifiedInputMeasurement(context);
  const payload = routePlanningPayloadV2(context, acceptedMeasurement);
  if (planNonce !== null) payload.plan_nonce = planNonce;
  if (mutatePlan !== null) {
    mutatePlan(payload, routePlanningFacts(context), acceptedMeasurement);
  }
  const result = emit(
    context,
    "requester",
    "CREATE_ROUTE_EXECUTION_PLAN",
    payload,
    `create-route-plan-${payload.plan_nonce}`,
  ).result;
  const resolver = createAcceptedRecordResolver(context.runtime);
  const acceptedContext = resolveAcceptedRouteContext(resolver, {
    route_execution_plan_id: result.route_execution_plan_id,
    route_execution_plan_root: result.route_execution_plan_root,
  });
  return {
    context,
    resolver,
    measurement: acceptedMeasurement,
    payload,
    result,
    acceptedContext,
    decision: deriveDataRouteDecision(acceptedContext),
  };
}

export function createRouteExecutionFixture() {
  return createRoutePlanOnContext(createRoutePlanningPrefix());
}

export function createAuthenticatedCoreFixture() {
  const accepted = runAcceptedCarrierPath(
    runCoreEconomyHappyPath(),
  );
  const donated = runDonatedConsentVectors(accepted.context);
  const job = snapshotRuntime(accepted.context.runtime).state.jobs[
    accepted.jobId
  ];
  const resolver = createAcceptedRecordResolver(
    accepted.context.runtime,
  );
  return {
    runtime: accepted.context.runtime,
    resolver,
    accepted_offer: {
      record_type: "CAPABILITY_OFFER",
      record_id: accepted.workerOffer.offer_id,
      record_root: accepted.workerOffer.offer_root,
    },
    accepted_consent: {
      record_type: "DONATED_CAPACITY_CONSENT",
      record_id: donated.acceptedConsent.consent_id,
      record_root: donated.acceptedConsent.consent_root,
    },
    accepted_donated_offer: {
      record_type: "CAPABILITY_OFFER",
      record_id: donated.donatedOffer.offer_id,
      record_root: donated.donatedOffer.offer_root,
    },
    job_contract: {
      job_id: accepted.jobId,
      contract_root: job.accepted_contract_root,
    },
    accepted_preparation: {
      record_type: "DISCLOSURE_PREPARATION",
      record_id: accepted.acceptedPreparation.preparation_id,
      record_root:
        accepted.acceptedPreparation.preparation_record_root,
    },
    accepted,
    donated,
  };
}

function runCanonicalVectors() {
  assert.equal(
    canonicalize({ z: 0, a: ["\n", true, null] }),
    '{"a":["\\n",true,null],"z":0}',
  );
  assert.equal(
    canonicalize(parseStrictJson('{"a":1,"b":[true,null]}')),
    '{"a":1,"b":[true,null]}',
  );
  expectCode("ERR_DUPLICATE_KEY", () => parseStrictJson('{"a":1,"a":2}'));
  expectCode("ERR_UNSAFE_INTEGER", () => parseStrictJson('{"a":1e2}'));
  expectCode("ERR_NON_CANONICAL", () => parseStrictJson('{"a":-0}'));
  expectCode("ERR_UNSAFE_INTEGER", () =>
    parseStrictJson('{"a":9007199254740992}'),
  );
  expectCode("ERR_NON_CANONICAL", () =>
    assertCanonicalValue({ value: "e\u0301" }),
  );
  expectCode("ERR_INVALID_UNICODE", () =>
    assertCanonicalValue({ value: "\ud800" }),
  );
  assert.equal(
    hash("NEXUS_TEST_VECTOR_V1", { a: 1 }),
    hash("NEXUS_TEST_VECTOR_V1", { a: 1 }),
  );
}

function runAdversarialVectors(happy) {
  const wrongReveal = prepareCommittedBid();
  advance(wrongReveal.context, "wrong-reveal-tick-1");
  const tamperedReveal = { ...wrongReveal.reveal, salt: "ffeeddccbbaa99887766554433221100" };
  const rootBeforeWrongReveal = currentRoot(wrongReveal.context.runtime);
  const wrongRevealEvent = buildEvent(stateOf(wrongReveal.context), {
    eventType: "REVEAL_BID",
    actorId: principal(wrongReveal.context, "worker").principal_id,
    payload: { bid_id: wrongReveal.bidId, reveal: tamperedReveal },
    nonce: "wrong-reveal",
  });
  expectCode(
    "ERR_BID_COMMITMENT",
    () => applyEvent(wrongReveal.context.runtime, wrongRevealEvent),
  );
  assert.equal(currentRoot(wrongReveal.context.runtime), rootBeforeWrongReveal);
  expectCode("ERR_SIZE_LIMIT", () =>
    bidCommitment({ ...wrongReveal.reveal, salt: "00" }),
  );
  expectCode("ERR_SIZE_LIMIT", () =>
    exportNonceCommitment({
      exportNonce: "00112233445566778899aabbccddeeff",
    }),
  );

  const schemaContext = createCoreEconomyFixture();
  expectCode("ERR_AUTHORITY", () =>
    createAcceptedRecordResolver({
      state: structuredClone(stateOf(schemaContext)),
      receipts: [],
      event_index: new Map(),
      idempotency_index: new Map(),
    }),
  );
  expectCode("ERR_SIZE_LIMIT", () =>
    buildEvent(stateOf(schemaContext), {
      eventType: "CREATE_JOB",
      actorId: principal(schemaContext, "requester").principal_id,
      payload: jobPayload(schemaContext, "empty-idempotency"),
      nonce: "empty-idempotency",
      idempotencyKey: "",
    }),
  );
  expectCode("ERR_SCHEMA", () =>
    buildEvent(stateOf(schemaContext), {
      eventType: "CREATE_JOB",
      actorId: principal(schemaContext, "requester").principal_id,
      payload: {
        ...jobPayload(schemaContext, "unknown-payload-field"),
        unexpected_authority: true,
      },
      nonce: "unknown-payload-field",
    }),
  );
  expectCode("ERR_SIZE_LIMIT", () =>
    buildEvent(stateOf(schemaContext), {
      eventType: "CREATE_JOB",
      actorId: principal(schemaContext, "requester").principal_id,
      payload: {
        ...jobPayload(schemaContext, "oversized-payload"),
        title: "x".repeat(262145),
      },
      nonce: "oversized-payload",
    }),
  );
  expectCode("ERR_UNSAFE_INTEGER", () =>
    createFixtureState({
      projectPoolAlias: "overflow-a",
      principals: [
        {
          alias: "overflow-a",
          balance: Number.MAX_SAFE_INTEGER,
          scopes: ["*"],
        },
        { alias: "overflow-b", balance: 1, scopes: ["*"] },
      ],
    }),
  );
  expectCode("ERR_ID_PREIMAGE", () =>
    createRecord(
      { idKey: "source_id", id: "ACC-invalid", objectType: "ACCOUNT" },
      {},
    ),
  );

  const negative = createCoreEconomyFixture();
  const created = createJob(negative);
  const unsafeWindowEvent = buildEvent(stateOf(negative), {
    eventType: "OPEN_BID_ROUND",
    actorId: principal(negative, "requester").principal_id,
    payload: {
      job_id: created.result.job_id,
      open_tick: 0,
      commit_close_tick: "1",
      reveal_close_tick: 2,
      acceptance_deadline_tick: 4,
      round_nonce: "unsafe-window",
    },
    nonce: "unsafe-window",
  });
  expectCode(
    "ERR_UNSAFE_INTEGER",
    () => applyEvent(negative.runtime, unsafeWindowEvent),
  );
  const rootBeforeNegative = currentRoot(negative.runtime);
  const negativeEvent = buildEvent(stateOf(negative), {
    eventType: "CONTRIBUTE",
    actorId: principal(negative, "requester").principal_id,
    payload: {
      job_id: created.result.job_id,
      amount: -1,
      kind: "PLEDGE",
      sponsor_account_id: account(negative, "requester").account_id,
      disclosure_acknowledgement_root: "ack",
      attribution: "NONE",
      contribution_nonce: "negative",
    },
    nonce: "negative-contribution",
  });
  expectCode(
    "ERR_UNSAFE_INTEGER",
    () => applyEvent(negative.runtime, negativeEvent),
  );
  assert.equal(currentRoot(negative.runtime), rootBeforeNegative);

  const authContext = createCoreEconomyFixture();
  const badAuth = buildEvent(stateOf(authContext), {
    eventType: "CREATE_JOB",
    actorId: principal(authContext, "requester").principal_id,
    payload: jobPayload(authContext, "bad-auth-job"),
    nonce: "bad-auth",
  });
  badAuth.auth.key_id = "KEY-SIM-TAMPERED";
  expectCode("ERR_AUTHORITY", () => applyEvent(authContext.runtime, badAuth));

  const stale = createCoreEconomyFixture();
  const staleEvent = buildEvent(stateOf(stale), {
    eventType: "CREATE_JOB",
    actorId: principal(stale, "requester").principal_id,
    payload: jobPayload(stale, "stale-job"),
    nonce: "stale-job",
  });
  createJob(stale, "winning-job");
  expectCode("ERR_PREDECESSOR", () => applyEvent(stale.runtime, staleEvent));

  const settledRoot = currentRoot(happy.context.runtime);
  const receiptCount = receiptsOf(happy.context).length;
  const replay = applyEvent(happy.context.runtime, happy.terminal.event);
  assert.equal(replay.replay, true);
  assert.equal(receiptsOf(happy.context).length, receiptCount);
  assert.equal(currentRoot(happy.context.runtime), settledRoot);
  assert(Object.isFrozen(happy.context.runtime));
  assert.deepEqual(Object.keys(happy.context.runtime), []);
  assert.equal(happy.context.runtime.state, undefined);
  assert.equal(happy.context.runtime.receipts, undefined);
  const authenticatedJournal = snapshotOf(happy.context);
  assert(Object.isFrozen(authenticatedJournal));
  assert(Object.isFrozen(authenticatedJournal.state));
  assert(Object.isFrozen(authenticatedJournal.events));
  assert(Object.isFrozen(authenticatedJournal.receipts));
  assert.throws(
    () => {
      authenticatedJournal.state.tick += 1;
    },
    TypeError,
  );
  assert.equal(currentRoot(happy.context.runtime), settledRoot);
  const reconstructed = recoverRuntime({
    genesisState: structuredClone(happy.context.genesisState),
    events: structuredClone(authenticatedJournal.events),
    receipts: structuredClone(authenticatedJournal.receipts),
    expectedFinalRoot: authenticatedJournal.current_root,
  });
  const reconstructedReplay = applyEvent(
    reconstructed,
    happy.terminal.event,
  );
  assert.equal(reconstructedReplay.replay, true);
  assert.equal(snapshotRuntime(reconstructed).receipts.length, receiptCount);
  assert.equal(currentRoot(reconstructed), settledRoot);
  const alteredEvents = structuredClone(authenticatedJournal.events);
  alteredEvents[0].auth.ml_dsa_65_signature_base64url =
    alteredEvents[0].auth.ml_dsa_65_signature_base64url.replace(/^./, (character) =>
      character === "0" ? "1" : "0",
    );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(happy.context.genesisState),
      events: alteredEvents,
      receipts: structuredClone(authenticatedJournal.receipts),
      expectedFinalRoot: authenticatedJournal.current_root,
    }),
  );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(happy.context.genesisState),
      events: structuredClone(authenticatedJournal.events),
      receipts: structuredClone(authenticatedJournal.receipts).slice(1),
      expectedFinalRoot: authenticatedJournal.current_root,
    }),
  );
  const reorderedEvents = structuredClone(authenticatedJournal.events);
  const reorderedReceipts = structuredClone(authenticatedJournal.receipts);
  [reorderedEvents[0], reorderedEvents[1]] = [
    reorderedEvents[1],
    reorderedEvents[0],
  ];
  [reorderedReceipts[0], reorderedReceipts[1]] = [
    reorderedReceipts[1],
    reorderedReceipts[0],
  ];
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(happy.context.genesisState),
      events: reorderedEvents,
      receipts: reorderedReceipts,
      expectedFinalRoot: authenticatedJournal.current_root,
    }),
  );
  const alteredReceipts = structuredClone(authenticatedJournal.receipts);
  alteredReceipts[0].receipt_id =
    alteredReceipts[0].receipt_id.replace(/^./, (character) =>
      character === "0" ? "1" : "0",
    );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(happy.context.genesisState),
      events: structuredClone(authenticatedJournal.events),
      receipts: alteredReceipts,
      expectedFinalRoot: authenticatedJournal.current_root,
    }),
  );
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(happy.context.genesisState),
      events: structuredClone(authenticatedJournal.events),
      receipts: structuredClone(authenticatedJournal.receipts),
      expectedFinalRoot: authenticatedJournal.current_root,
      extra: true,
    }),
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(Object.freeze(Object.create(null)), happy.terminal.event),
  );
  const conflictingReplay = structuredClone(happy.terminal.event);
  conflictingReplay.auth.ed25519_signature_base64url =
    conflictingReplay.auth.ed25519_signature_base64url.replace(/^./, (character) =>
      character === "0" ? "1" : "0",
    );
  expectCode(
    "ERR_AUTHORITY",
    () => applyEvent(happy.context.runtime, conflictingReplay),
  );
  assert.equal(currentRoot(happy.context.runtime), settledRoot);

  const reusedExport = buildEvent(stateOf(happy.context), {
    eventType: "CREATE_PUBLICATION_INTENT",
    actorId: principal(happy.context, "requester").principal_id,
    payload: {
      ...structuredClone(happy.publication.event.payload),
      body: {
        ...structuredClone(happy.publication.event.payload.body),
        nonce: hash("NEXUS_TEST_NONCE_V1", {
          name: "publication-intent-reuse",
        }),
      },
    },
    nonce: "reuse-public-export-authority",
  });
  expectCode(
    "ERR_DISCLOSURE_UNCLASSIFIED",
    () => applyEvent(happy.context.runtime, reusedExport),
  );
  assert.equal(currentRoot(happy.context.runtime), settledRoot);

  assert.throws(
    () => receiptsOf(happy.context).push({ operational_only: true }),
    TypeError,
  );
  assert.equal(currentRoot(happy.context.runtime), settledRoot);
  assert(!Object.hasOwn(stateOf(happy.context), "receipts"));

  const drifted = structuredClone(stateOf(happy.context));
  drifted.supply += 1;
  expectCode("ERR_SUPPLY", () => createRuntime(drifted));
}

function runRouteExecutionPlanVectors() {
  const prefix = createRoutePlanningPrefix();
  const happy = createRoutePlanOnContext(
    recoverRoutePlanningPrefix(prefix),
  );
  const happyPlan = happy.acceptedContext.route_execution_plan.record;
  const happyFacts = routePlanningFacts(happy.context);
  assert.equal(
    happy.acceptedContext.schema,
    "nexus-accepted-route-context-v1",
  );
  assert.equal(happy.decision.outcome, "ALLOW");
  assert.equal(
    happy.decision.derived_total_input_bytes,
    happy.measurement.payload.entries[0].byte_length,
  );
  assert.equal(
    happyPlan.spend_amount,
    happyFacts.commitment.amount,
  );
  assert.deepEqual(
    happyPlan.funding_lot_refs.map((ref) => ref.record_id),
    happyFacts.commitment.funding_lot_ids,
  );
  assert.equal(
    happyPlan.classified_input_manifest_ref.record_root,
    happy.measurement.result.classified_input_manifest_root,
  );
  assert(Object.isFrozen(happy.acceptedContext));
  expectCode("ERR_AUTHORITY", () =>
    deriveDataRouteDecision(structuredClone(happy.acceptedContext)),
  );
  for (const [recordType, recordId, recordRootValue] of [
    [
      "ROUTE_EXECUTION_PLAN",
      happy.result.route_execution_plan_id,
      happy.result.route_execution_plan_root,
    ],
    [
      "CLASSIFIED_INPUT_MANIFEST",
      happy.result.classified_input_manifest_id,
      happy.result.classified_input_manifest_root,
    ],
    [
      "WORKER_TRUST_AUTHORITY",
      happy.result.worker_trust_authority_id,
      happy.result.worker_trust_authority_root,
    ],
  ]) {
    assert.equal(
      resolveAcceptedRecord(happy.resolver, {
        record_type: recordType,
        record_id: recordId,
        record_root: recordRootValue,
      }).record_type,
      recordType,
    );
  }

  const rejectMeasurement = (
    code,
    name,
    actor,
    mutate = null,
  ) => {
    const context = recoverRoutePlanningPrefix(prefix);
    const payload = classifiedInputMeasurementPayload(context);
    if (mutate !== null) mutate(payload, routePlanningFacts(context));
    const before = currentRoot(context.runtime);
    expectCode(code, () =>
      emit(
        context,
        actor,
        "RECORD_CLASSIFIED_INPUT_MEASUREMENT",
        payload,
        `reject-input-measurement-${name}`,
      ),
    );
    assert.equal(currentRoot(context.runtime), before);
  };
  rejectMeasurement("ERR_AUTHORITY", "requester-underreport", "requester", (payload) => {
    payload.entries[0].byte_length = 1;
    payload.entries[0].measurement_receipt_root = hash(
      "NEXUS_TEST_UNDERREPORTED_MEASUREMENT_V1",
      payload.entries[0],
    );
  });
  rejectMeasurement("ERR_AUTHORITY", "worker-underreport", "subworker", (payload) => {
    payload.entries[0].byte_length = 1;
    payload.entries[0].measurement_receipt_root = hash(
      "NEXUS_TEST_UNDERREPORTED_MEASUREMENT_V1",
      payload.entries[0],
    );
  });
  rejectMeasurement(
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "wrong-input-root",
    "verifier",
    (payload) => {
      payload.entries[0].input_root = "forged-input-root";
    },
  );
  rejectMeasurement(
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "byte-ceiling",
    "verifier",
    (payload) => {
      payload.entries[0].byte_length += 1;
    },
  );
  rejectMeasurement(
    "ERR_UNSAFE_INTEGER",
    "unsafe-byte",
    "verifier",
    (payload) => {
      payload.entries[0].byte_length = Number.MAX_SAFE_INTEGER + 1;
    },
  );
  rejectMeasurement("ERR_SCHEMA", "extra-key", "verifier", (payload) => {
    payload.reported_safe = true;
  });

  const rejectPlan = (code, name, mutate) => {
    const context = recoverRoutePlanningPrefix(prefix);
    const measurement = recordClassifiedInputMeasurement(context, {
      nonce: `measurement-before-${name}`,
    });
    const payload = routePlanningPayloadV2(context, measurement);
    mutate(payload, routePlanningFacts(context), measurement);
    const before = currentRoot(context.runtime);
    expectCode(code, () =>
      emit(
        context,
        "requester",
        "CREATE_ROUTE_EXECUTION_PLAN",
        payload,
        `reject-route-plan-v2-${name}`,
      ),
    );
    assert.equal(currentRoot(context.runtime), before);
  };
  rejectPlan("ERR_PREDECESSOR", "forged-lease", (payload) => {
    payload.lease_ref.record_root = "0".repeat(64);
  });
  rejectPlan("ERR_AUTHORITY", "forged-measurement", (payload) => {
    payload.classified_input_manifest_ref.record_root = "0".repeat(64);
  });
  rejectPlan("ERR_AUTHORITY", "missing-tool-authority", (payload) => {
    payload.tool_route_authority_refs = [
      {
        record_id: `TOOLROUTE-${"0".repeat(64)}`,
        record_root: "0".repeat(64),
      },
    ];
  });
  for (const [name, key, value] of [
    ["raw-bytes", "classified_inputs", []],
    ["raw-spend", "spend_amount", 0],
    ["raw-route", "selected_route", "LOCAL"],
    ["raw-funding", "funding_lot_refs", []],
    ["raw-window", "expiry_tick", 9],
    ["legacy-boolean", "capability_satisfied", true],
  ]) {
    rejectPlan("ERR_SCHEMA", name, (payload) => {
      payload[key] = value;
    });
  }

  const lead = createRoutePlanOnContext(createRoutePlanningPrefix(1));
  const leadPlan = lead.acceptedContext.route_execution_plan.record;
  assert.equal(lead.decision.outcome, "ALLOW");
  assert.equal(
    leadPlan.spend_amount,
    lead.acceptedContext.job_contract.record.award.lead_worker_amount,
  );
  assert.equal(leadPlan.allowance_ref, null);
  assert.equal(leadPlan.subwork_commitment_ref, null);

  const race = createRoutePlanOnContext(recoverRoutePlanningPrefix(prefix));
  const oldDecisionRoot = race.decision.decision_root;
  advance(race.context, "route-v2-decision-tick-race");
  const racedContext = resolveAcceptedRouteContext(race.resolver, {
    route_execution_plan_id: race.result.route_execution_plan_id,
    route_execution_plan_root: race.result.route_execution_plan_root,
  });
  assert.notEqual(
    deriveDataRouteDecision(racedContext).decision_root,
    oldDecisionRoot,
  );
  const raceFacts = routePlanningFacts(race.context);
  const raceWorkerAlias =
    raceFacts.state.principals[raceFacts.lease.worker_principal_id]
      .display_alias;
  const raceRoot = currentRoot(race.context.runtime);
  expectCode("ERR_AUTHORITY", () =>
    emit(
      race.context,
      raceWorkerAlias,
      "CONSUME_ROUTE_EXECUTION_PLAN",
      {
        route_execution_plan_id: race.result.route_execution_plan_id,
        route_execution_plan_root: race.result.route_execution_plan_root,
        expected_decision_root: oldDecisionRoot,
      },
      "consume-stale-route-v2-decision",
    ),
  );
  assert.equal(currentRoot(race.context.runtime), raceRoot);

  const happyWorkerAlias =
    happyFacts.state.principals[happyFacts.lease.worker_principal_id]
      .display_alias;
  const beforeWrongOwner = currentRoot(happy.context.runtime);
  expectCode("ERR_AUTHORITY", () =>
    emit(
      happy.context,
      "requester",
      "CONSUME_ROUTE_EXECUTION_PLAN",
      {
        route_execution_plan_id: happy.result.route_execution_plan_id,
        route_execution_plan_root: happy.result.route_execution_plan_root,
        expected_decision_root: happy.decision.decision_root,
      },
      "consume-route-v2-wrong-owner",
    ),
  );
  assert.equal(currentRoot(happy.context.runtime), beforeWrongOwner);
  const consumed = emit(
    happy.context,
    happyWorkerAlias,
    "CONSUME_ROUTE_EXECUTION_PLAN",
    {
      route_execution_plan_id: happy.result.route_execution_plan_id,
      route_execution_plan_root: happy.result.route_execution_plan_root,
      expected_decision_root: happy.decision.decision_root,
    },
    "consume-route-v2-plan",
  ).result;
  assert.equal(consumed.decision.outcome, "ALLOW");
  const consumedRoot = currentRoot(happy.context.runtime);
  expectCode("ERR_AUTHORITY", () =>
    emit(
      happy.context,
      happyWorkerAlias,
      "CONSUME_ROUTE_EXECUTION_PLAN",
      {
        route_execution_plan_id: happy.result.route_execution_plan_id,
        route_execution_plan_root: happy.result.route_execution_plan_root,
        expected_decision_root: happy.decision.decision_root,
      },
      "consume-route-v2-plan-replay",
    ),
  );
  assert.equal(currentRoot(happy.context.runtime), consumedRoot);

  const consumedJournal = snapshotRuntime(happy.context.runtime);
  const recoveredRuntime = recoverRuntime({
    genesisState: structuredClone(happy.context.genesisState),
    events: structuredClone(consumedJournal.events),
    receipts: structuredClone(consumedJournal.receipts),
    expectedFinalRoot: consumedJournal.current_root,
  });
  const recoveredResolver = createAcceptedRecordResolver(recoveredRuntime);
  const recoveredContext = resolveAcceptedRouteContext(recoveredResolver, {
    route_execution_plan_id: happy.result.route_execution_plan_id,
    route_execution_plan_root: happy.result.route_execution_plan_root,
  });
  const recoveredDecision = deriveDataRouteDecision(recoveredContext);
  assert.equal(recoveredDecision.outcome, "HOLD");
  assert(
    recoveredDecision.reason_codes.includes("PLAN_ALREADY_CONSUMED"),
  );

  const expiredContext = recoverRoutePlanningPrefix(prefix);
  const expiredMeasurement =
    recordClassifiedInputMeasurement(expiredContext);
  const expiredFacts = routePlanningFacts(expiredContext);
  const expiredAt = Math.min(
    expiredFacts.lease.expiry_tick,
    expiredFacts.task.deadline_tick,
  );
  const expiredPayload = routePlanningPayloadV2(
    expiredContext,
    expiredMeasurement,
  );
  while (
    stateOf(expiredContext).tick < expiredAt
  ) {
    advance(
      expiredContext,
      `expire-route-v2-measurement-${stateOf(expiredContext).tick}`,
    );
  }
  expectCode("ERR_PREDECESSOR", () =>
    emit(
      expiredContext,
      "requester",
      "CREATE_ROUTE_EXECUTION_PLAN",
      expiredPayload,
      "create-route-from-expired-measurement",
    ),
  );
}

export function runCoreEconomyTests() {
  runCanonicalVectors();
  const first = runCoreEconomyHappyPath();
  const second = runCoreEconomyHappyPath();
  assert.equal(currentRoot(first.context.runtime), currentRoot(second.context.runtime));
  const firstTerminalReceipt = receiptsOf(first.context).find(
    (receipt) =>
      receipt.event_id ===
      stateOf(first.context).jobs[first.jobId].terminal_event_id,
  );
  const secondTerminalReceipt = receiptsOf(second.context).find(
    (receipt) =>
      receipt.event_id ===
      stateOf(second.context).jobs[second.jobId].terminal_event_id,
  );
  assert(firstTerminalReceipt);
  assert(secondTerminalReceipt);
  assert.notEqual(
    firstTerminalReceipt.receipt_id,
    secondTerminalReceipt.receipt_id,
  );
  assert.equal(
    firstTerminalReceipt.semantic_receipt_id,
    secondTerminalReceipt.semantic_receipt_id,
  );
  assert.equal(
    firstTerminalReceipt.semantic_receipt_root,
    secondTerminalReceipt.semantic_receipt_root,
  );
  assert.notEqual(
    canonicalize(receiptsOf(first.context)),
    canonicalize(receiptsOf(second.context)),
  );
  const firstDonation = runDonatedConsentVectors(first.context);
  const secondDonation = runDonatedConsentVectors(second.context);
  assert.notEqual(
    firstDonation.authentication.ml_dsa_65_signature_base64url,
    secondDonation.authentication.ml_dsa_65_signature_base64url,
  );
  assert.equal(
    firstDonation.consentEvent.event_id,
    secondDonation.consentEvent.event_id,
  );
  assert.equal(
    semanticEventRoot(firstDonation.consentEvent),
    semanticEventRoot(secondDonation.consentEvent),
  );
  assert.notEqual(
    eventBodyRoot(firstDonation.consentEvent),
    eventBodyRoot(secondDonation.consentEvent),
  );
  assert.notEqual(
    firstDonation.consentEvent.auth.signed_payload_root,
    secondDonation.consentEvent.auth.signed_payload_root,
  );
  assert.notEqual(
    authenticatedEventRoot(firstDonation.consentEvent),
    authenticatedEventRoot(secondDonation.consentEvent),
  );
  assert.equal(
    firstDonation.acceptedConsent.consent_id,
    secondDonation.acceptedConsent.consent_id,
  );
  assert.equal(
    firstDonation.acceptedConsent.consent_root,
    secondDonation.acceptedConsent.consent_root,
  );
  assert.equal(
    firstDonation.consentReceipt.semantic_receipt_id,
    secondDonation.consentReceipt.semantic_receipt_id,
  );
  assert.equal(
    semanticReceiptRoot(firstDonation.consentReceipt),
    semanticReceiptRoot(secondDonation.consentReceipt),
  );
  assert.equal(
    firstDonation.consentReceipt.next_state_root,
    secondDonation.consentReceipt.next_state_root,
  );
  assert.notEqual(
    firstDonation.consentReceipt.authenticated_event_root,
    secondDonation.consentReceipt.authenticated_event_root,
  );
  assert.notEqual(
    firstDonation.consentReceipt.receipt_id,
    secondDonation.consentReceipt.receipt_id,
  );
  assert.notEqual(
    receiptRoot(firstDonation.consentReceipt),
    receiptRoot(secondDonation.consentReceipt),
  );
  assert.equal(
    currentRoot(first.context.runtime),
    currentRoot(second.context.runtime),
  );
  assert.equal(
    canonicalize(
      firstDonation.consentJournal.events.at(-1).payload
        .authentication,
    ),
    canonicalize(firstDonation.authentication),
  );
  const mixedConsentEvents = structuredClone(
    firstDonation.consentJournal.events,
  );
  mixedConsentEvents[mixedConsentEvents.length - 1] =
    structuredClone(secondDonation.consentEvent);
  expectCode("ERR_RECOVERY", () =>
    recoverRuntime({
      genesisState: structuredClone(first.context.genesisState),
      events: mixedConsentEvents,
      receipts: structuredClone(
        firstDonation.consentJournal.receipts,
      ),
      expectedFinalRoot:
        firstDonation.consentJournal.current_root,
    }),
  );
  const rootBeforeValidConsentReplay = currentRoot(
    first.context.runtime,
  );
  const validConsentReplay = applyEvent(
    first.context.runtime,
    secondDonation.consentEvent,
  );
  assert.equal(validConsentReplay.replay, true);
  assert.equal(
    canonicalize(validConsentReplay.receipt),
    canonicalize(firstDonation.consentReceipt),
  );
  assert.equal(
    currentRoot(first.context.runtime),
    rootBeforeValidConsentReplay,
  );
  expectCode("ERR_AUTHORITY", () =>
    applyEvent(
      first.context.runtime,
      firstDonation.invalidInnerReplayEvent,
    ),
  );
  assert.equal(
    currentRoot(first.context.runtime),
    rootBeforeValidConsentReplay,
  );
  const firstDisclosure = runAcceptedCarrierPath(first);
  const secondDisclosure = runAcceptedCarrierPath(second);
  assert.equal(currentRoot(first.context.runtime), currentRoot(second.context.runtime));
  assert.equal(
    stateOf(first.context).jobs[first.jobId].terminal_receipt_id,
    firstTerminalReceipt.semantic_receipt_id,
  );
  assert.equal(
    stateOf(second.context).jobs[second.jobId].terminal_receipt_id,
    secondTerminalReceipt.semantic_receipt_id,
  );
  const transitiveCarrierKeys = Object.keys(stateOf(first.context)).filter(
    (key) =>
      key.includes("disclosure") ||
      key.includes("publication") ||
      key.includes("public_") ||
      key.includes("non_claim"),
  );
  assert(transitiveCarrierKeys.length > 0);
  assert.deepEqual(
    transitiveCarrierKeys,
    Object.keys(stateOf(second.context)).filter(
      (key) =>
        key.includes("disclosure") ||
        key.includes("publication") ||
        key.includes("public_") ||
        key.includes("non_claim"),
    ),
  );
  for (const key of transitiveCarrierKeys) {
    assert.equal(
      canonicalize(stateOf(first.context)[key]),
      canonicalize(stateOf(second.context)[key]),
    );
  }
  for (const key of [
    "disclosureManifest",
    "compilation",
    "capsule",
    "nonClaims",
    "publicationAnchor",
  ]) {
    assert.equal(
      firstDisclosure[key].record_root,
      secondDisclosure[key].record_root,
    );
  }
  assert.notEqual(
    canonicalize(receiptsOf(first.context)),
    canonicalize(receiptsOf(second.context)),
  );
  assert.equal(conservedSupply(stateOf(first.context)), stateOf(first.context).supply);
  assert.equal(stateOf(first.context).jobs[first.jobId].state, "SETTLED");
  assert.equal(
    stateOf(first.context).accounts[
      stateOf(first.context).jobs[first.jobId].job_account_id
    ].status,
    "CLOSED",
  );
  assert(
    Object.values(stateOf(first.context).funding_lots).every(
      (lot) => lot.status === "CONSUMED",
    ),
  );
  assert(
    Object.values(stateOf(first.context).payouts).every(
      (payout) => payout.status === "PAID",
    ),
  );
  assert.equal(account(first.context, "requester").available, 910);
  assert.equal(account(first.context, "worker").available, 30);
  assert.equal(account(first.context, "subworker").available, 20);
  assert.equal(account(first.context, "verifier").available, 10);
  for (const alias of ["reviewer-a", "reviewer-b", "reviewer-c"]) {
    assert.equal(account(first.context, alias).available, 10);
  }
  runHoldAbortPath();
  runReviewReplacementPath();
  runDisputedPayoutAbortPath();
  runAppealAbortAuthorityPath();
  runRouteExecutionPlanVectors();
  runAdversarialVectors(first);
  return {
    tests: 147,
    state_root: currentRoot(first.context.runtime),
    receipt_count: receiptsOf(first.context).length,
    terminal_state: stateOf(first.context).jobs[first.jobId].state,
    supply: stateOf(first.context).supply,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = runCoreEconomyTests();
  console.log(
    `core/economy: PASS (${result.tests} assertions; ${result.receipt_count} receipts; ${result.terminal_state}; supply ${result.supply}; root ${result.state_root})`,
  );
}
