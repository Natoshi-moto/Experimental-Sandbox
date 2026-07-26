import { canonicalize } from "./canonical.mjs";
import {
  assertEventIngress,
  authenticatedEventRoot,
  verifyIndependentControllerAuthentication,
  verifyNewEvent,
} from "./auth.mjs";
import { invariant, fail } from "./errors.mjs";
import {
  ACCEPTED_ROUTE_CONTEXT_SCHEMA,
  classifiedInputManifestRoot,
  createClassifiedInputManifest,
  createRouteExecutionPlan,
  createRoutePlanConsumption,
  createWorkerTrustAuthority,
  deriveDataRouteDecisionFromFacts,
  routeExecutionPlanV5Root,
  routePlanConsumptionRoot,
  workerTrustAuthorityRoot,
} from "./route-v5.mjs";
import { hash, rootId } from "./hash.mjs";
import { validateState } from "./invariants.mjs";
import {
  createRecord,
  recordIdKey,
  recordRoot,
  reviseRecord,
  stableId,
} from "./records.mjs";
import { applicationRoot } from "./state.mjs";
import {
  buildReceipt,
  receiptRoot,
  recomputeReceiptId,
} from "./receipts.mjs";
import {
  activeLotValue,
  assertAmount,
  checkedAdd,
  checkedMultiply,
  checkedSubtract,
  largestRemainderAllocation,
  mandatoryJobReserve,
} from "../economy/funding.mjs";
import {
  assertBidReveal,
  bidCommitment,
  bidRevealRoot,
  draftContractRoot,
  materializeContract,
  sortEligibleBids,
} from "../economy/bids.mjs";
import {
  acceptedDisclosureCompilationAnchorRoot,
  acceptedPublicationAnchorRoot,
  disclosureCompilationRoot,
  entropyFreshnessAuthorityRoot,
  entropyOneUseClaimRoot,
  entropyOneUseConsumptionRoot,
  exportNonceCommitment,
  nonceOneUseAuthorityRoot,
  publicationApprovalContextRoot,
  publicationIntentId,
  publicationUseScopeRoot,
  publicExportScopeRoot,
  publicExportAuthorityRoot,
  publicExportStageRoots,
} from "./public-export.mjs";
import {
  contractRouteContextRoot,
  acceptedDisclosurePreparationRoot,
  assertDerivedCarrierId,
  capabilityOfferRoot,
  capabilityOfferTermsRoot,
  dataRouteAuthorityRoot,
  derivedCarrierId,
  disclosurePreparationExecutionReceiptRoot,
  disclosureApprovalReceiptRoot,
  disclosureCompilationAnchorV2Root,
  disclosureCompilationV2Root,
  disclosureScannerAuthorityRoot,
  disclosureScanReceiptRoot,
  publicationAnchorV2Root,
  publicCapsuleRoot,
  publicSafeDisclosureManifestRoot,
  nonClaimsRoot,
  donatedCapacityConsentBodyRoot,
  donatedCapacityConsentRecordRoot,
  redactionApprovalAuthorityRoot,
  redactionApprovalV2Root,
  redactionManifestV2Root,
  remoteRedactionPolicyRoot,
  toolRouteAuthorityRoot,
} from "./carriers.mjs";
import {
  acceptedDisclosurePolicyCarrierRoot,
  acceptedDisclosureProofContextCarrierRoot,
  assertProofContextMatchesPolicy,
  disclosurePolicyRoot,
  disclosurePreparationAuthorityContextId,
  disclosurePreparationAuthorityRoot,
  disclosurePreparationVerifierAuthorityRoot,
  disclosurePreparationNonceScopeRoot,
  disclosurePreparationRoot,
  disclosurePreparationUseScopeRoot,
  disclosureProofContextRoot,
  disclosureSaltCommitmentRoot,
  disclosureSaltEntropyConsumptionsRoot,
  disclosureSaltScopeRoot,
  disclosureSaltUseScopeRoot,
  entropyAuthorityContextId,
  entropyBindingScopeRoot,
  entropyFreshnessAuthorityV1Root,
  entropyOneUseClaimV1Root,
  entropyOneUseCommitmentRoot,
  entropyOneUseConsumptionV1Root,
  publicationApprovalAuthorityV3Root,
  publicationIntentNonceCommitmentRoot,
  publicationIntentNonceScopeRoot,
  publicationIntentUseScopeRoot,
  publicationIntentV2Id,
  publicationIntentV3Id,
  publicExportAuthorityContextId,
  publicExportAuthorityV3Root,
  publicJobIdV3,
  publicJobSummaryV3Root,
  deriveDisclosurePreparationBindings,
  verifyDisclosurePreparationBindings,
} from "./privacy-nexus.mjs";
import {
  assertBoundedArray,
  assertBoundedCanonical,
  assertBoundedString,
  assertCanonicalToken,
  assertExactObjectKeys,
  assertHexRoot,
  assertSafeNonNegativeInteger,
  assertSortedUniqueStrings,
} from "./schema.mjs";

const OWNER = {
  CONTRIBUTION: {
    map: "contributions",
    type: "CONTRIBUTION",
    idKey: "contribution_id",
  },
  BID: { map: "bids", type: "BID", idKey: "bid_id" },
  JOB: { map: "jobs", type: "JOB", idKey: "job_id" },
  ALLOWANCE: {
    map: "allowances",
    type: "ALLOWANCE",
    idKey: "allowance_id",
  },
  PAYOUT: { map: "payouts", type: "PAYOUT", idKey: "payout_id" },
};

const TERMINAL_STATES = new Set(["SETTLED", "CANCELLED", "ABORTED"]);
const TERMINAL_EXCEPTIONS = new Set([
  "ACCEPT_DISCLOSURE_POLICY",
  "ACCEPT_DISCLOSURE_PROOF_CONTEXT",
  "REGISTER_ENTROPY_FRESHNESS_AUTHORITY",
  "AUTHORIZE_DISCLOSURE_PREPARATION",
  "ACCEPT_DISCLOSURE_PREPARATION",
  "COMMIT_PUBLIC_EXPORT_AUTHORITY",
  "CREATE_PUBLICATION_INTENT",
  "RECORD_DISCLOSURE_SCAN",
  "RECORD_DISCLOSURE_APPROVAL",
  "ACCEPT_DISCLOSURE_COMPILATION",
  "ACCEPT_DISCLOSURE_MANIFEST",
  "ACCEPT_PUBLIC_CAPSULE",
  "ACCEPT_NON_CLAIMS",
  "AUTHORIZE_DATA_ROUTE",
  "AUTHORIZE_TOOL_ROUTE",
  "RECORD_CLASSIFIED_INPUT_MEASUREMENT",
  "CREATE_ROUTE_EXECUTION_PLAN",
  "CONSUME_ROUTE_EXECUTION_PLAN",
  "RECORD_REDACTION_MANIFEST",
  "APPROVE_REDACTION",
  "ACCEPT_PUBLICATION",
]);

const RUNTIME_INTERNALS = new WeakMap();
const RESOLVER_RUNTIMES = new WeakMap();
const ACCEPTED_ROUTE_CONTEXTS = new WeakSet();

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutable(recordId, recordRootValue, record, status = "ACCEPTED") {
  return {
    record_id: recordId,
    record_root: recordRootValue,
    record_revision: 0,
    record_status: status,
    record,
  };
}

function runtimeInternals(runtime) {
  const internals = RUNTIME_INTERNALS.get(runtime);
  invariant(
    internals,
    "ERR_AUTHORITY",
    "operation requires a branded opaque core runtime",
  );
  return internals;
}

function mutable(recordId, recordRootValue, record, objectType) {
  invariant(
    record.record_root === recordRoot(record, objectType),
    "ERR_RECORD_REVISION",
    `${recordId} has an invalid canonical record root`,
  );
  return {
    record_id: recordId,
    record_root: recordRootValue,
    record_revision: record.record_revision,
    record_status: record.status,
    record,
  };
}

function idDigest(id, prefix) {
  invariant(
    typeof id === "string" && id.startsWith(`${prefix}-`),
    "ERR_ID_PREIMAGE",
    `${id} is not a ${prefix} ID`,
  );
  return id.slice(prefix.length + 1);
}

function findJobBy(state, predicate) {
  return Object.values(state.jobs).find(predicate);
}

function capabilityOfferByRoot(state, offerRoot) {
  const matches = Object.values(state.capability_offers).filter(
    (record) => capabilityOfferRoot(record) === offerRoot,
  );
  invariant(
    matches.length === 1,
    "ERR_CAPABILITY",
    "capability offer root must resolve to exactly one accepted offer",
  );
  return matches[0];
}

function acceptedRecord(state, recordType, recordId) {
  if (recordType === "CAPABILITY_OFFER") {
    const record = state.capability_offers[recordId];
    invariant(record, "ERR_SCHEMA", "accepted capability offer is missing");
    invariant(
      !state.revoked_offer_ids[recordId],
      "ERR_CAPABILITY",
      "revoked capability offer is not authoritative",
    );
    const root = capabilityOfferRoot(record);
    invariant(
      record.offer_id === derivedCarrierId("CAPABILITY_OFFER", record),
      "ERR_ID_PREIMAGE",
      "capability offer ID preimage is invalid",
    );
    return immutable(record.offer_id, root, record);
  }
  if (recordType === "JOB") {
    const record = state.jobs[recordId];
    invariant(record, "ERR_SCHEMA", "accepted current job is missing");
    return mutable(record.job_id, record.record_root, record, "JOB");
  }
  if (recordType === "TASK") {
    const record = state.tasks[recordId];
    invariant(record, "ERR_SCHEMA", "accepted current task is missing");
    return mutable(record.task_id, record.record_root, record, "TASK");
  }
  if (recordType === "BID") {
    const record = state.bids[recordId];
    invariant(record, "ERR_SCHEMA", "accepted current bid is missing");
    return mutable(record.bid_id, record.record_root, record, "BID");
  }
  if (recordType === "DONATED_CAPACITY_CONSENT") {
    const stored = state.donated_capacity_consents[recordId];
    invariant(stored, "ERR_SCHEMA", "accepted donated-capacity consent is missing");
    const { record_root: ignored, ...record } = stored;
    const root = donatedCapacityConsentRecordRoot(record);
    invariant(root === stored.record_root, "ERR_ID_PREIMAGE", "donated consent root is invalid");
    return immutable(record.consent_id, root, record);
  }
  if (recordType === "REVIEWER_ELIGIBILITY") {
    const record = state.reviewer_eligibilities[recordId];
    invariant(record, "ERR_SCHEMA", "accepted reviewer eligibility is missing");
    invariant(
      hash("NEXUS_REVIEWER_ELIGIBILITY_V2", record.facts) ===
        record.eligibility_root,
      "ERR_REVIEW_ASSIGNMENT",
      "reviewer eligibility preimage is invalid",
    );
    return immutable(
      record.eligibility_id,
      record.eligibility_root,
      record,
    );
  }
  if (recordType === "REVIEW_ASSIGNMENT") {
    const record = state.review_assignments[recordId];
    invariant(record, "ERR_SCHEMA", "accepted review assignment is missing");
    return mutable(
      record.review_assignment_id,
      record.record_root,
      record,
      "REVIEW_ASSIGNMENT",
    );
  }
  if (recordType === "REVIEW_PACKET") {
    const job = findJobBy(state, (item) => item.review_packet_root === recordId);
    invariant(job?.review_packet, "ERR_SCHEMA", "accepted review packet is missing");
    invariant(
      `PACKET-${hash("NEXUS_REVIEW_PACKET_V2", job.review_packet)}` ===
        job.review_packet_root,
      "ERR_REVIEW_PACKET_MISMATCH",
      "review packet preimage is invalid",
    );
    return immutable(
      job.review_packet_root,
      job.review_packet_root,
      job.review_packet,
    );
  }
  if (recordType === "MODEL_REVIEW") {
    const record = state.reviews[recordId];
    invariant(record, "ERR_SCHEMA", "accepted model review is missing");
    const { review_id: ignored, ...body } = record;
    const root = hash("NEXUS_MODEL_REVIEW_V2", body);
    invariant(
      root === idDigest(record.review_id, "REVIEW"),
      "ERR_ID_PREIMAGE",
      "model review ID preimage is invalid",
    );
    return immutable(record.review_id, root, record);
  }
  if (recordType === "REQUIRED_CHECK_MANIFEST") {
    const job = findJobBy(
      state,
      (item) => `CHECKMANIFEST-${item.required_check_manifest_root}` === recordId,
    );
    invariant(
      job?.required_check_manifest,
      "ERR_SCHEMA",
      "accepted required-check manifest is missing",
    );
    return immutable(
      recordId,
      job.required_check_manifest_root,
      job.required_check_manifest,
    );
  }
  if (recordType === "JOB_CONTRACT") {
    const job = findJobBy(
      state,
      (item) => `CONTRACT-${item.accepted_contract_root}` === recordId,
    );
    invariant(job?.accepted_contract, "ERR_SCHEMA", "accepted contract is missing");
    invariant(
      hash("NEXUS_CONTRACT_V1", job.accepted_contract) ===
        job.accepted_contract_root,
      "ERR_CONTRACT_IMMUTABLE",
      "accepted contract preimage is invalid",
    );
    return immutable(recordId, job.accepted_contract_root, job.accepted_contract);
  }
  if (recordType === "CONFLICT_POLICY") {
    const job = findJobBy(
      state,
      (item) =>
        item.accepted_contract?.conflict_policy_root &&
        `CONFLICT-${item.accepted_contract.conflict_policy_root}` === recordId,
    );
    invariant(
      job?.accepted_contract?.conflict_policy,
      "ERR_SCHEMA",
      "accepted conflict policy is missing",
    );
    invariant(
      hash(
        "NEXUS_CONFLICT_POLICY_V1",
        job.accepted_contract.conflict_policy,
      ) === job.accepted_contract.conflict_policy_root,
      "ERR_ID_PREIMAGE",
      "accepted conflict policy preimage is invalid",
    );
    return immutable(
      recordId,
      job.accepted_contract.conflict_policy_root,
      job.accepted_contract.conflict_policy,
    );
  }
  if (recordType === "DISCLOSURE_POLICY") {
    const record = state.disclosure_policies[recordId];
    invariant(record, "ERR_SCHEMA", "accepted disclosure policy is missing");
    invariant(
      acceptedDisclosurePolicyCarrierRoot(record.carrier) ===
        record.record_root,
      "ERR_ID_PREIMAGE",
      "accepted disclosure policy preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.carrier);
  }
  if (recordType === "DISCLOSURE_PROOF_CONTEXT") {
    const record = state.disclosure_proof_contexts[recordId];
    invariant(record, "ERR_SCHEMA", "accepted proof context is missing");
    invariant(
      acceptedDisclosureProofContextCarrierRoot(record.carrier) ===
        record.record_root,
      "ERR_ID_PREIMAGE",
      "accepted proof-context preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.carrier);
  }
  if (recordType === "DISCLOSURE_PREPARATION_AUTHORITY") {
    const record = state.disclosure_preparation_authorities[recordId];
    invariant(record, "ERR_SCHEMA", "preparation authority is missing");
    invariant(
      disclosurePreparationAuthorityRoot(record.preparation_authority) ===
        record.disclosure_preparation_authority_root,
      "ERR_ID_PREIMAGE",
      "preparation authority preimage is invalid",
    );
    return immutable(
      record.authority_id,
      record.disclosure_preparation_authority_root,
      record.preparation_authority,
      record.status,
    );
  }
  if (recordType === "DISCLOSURE_PREPARATION") {
    const stored = state.disclosure_preparations[recordId];
    invariant(stored, "ERR_SCHEMA", "accepted disclosure preparation is missing");
    const record = {
      schema: "nexus-accepted-disclosure-preparation-v1",
      preparation_id: stored.preparation_id,
      preparation_root: stored.preparation_root,
      preparation_authority_id: stored.preparation_authority_id,
      preparation_authority_root: stored.preparation_authority_root,
      content_public_values_root:
        stored.preparation.content_public_values_root,
      content_proof_descriptors_root:
        stored.preparation.content_proof_descriptors_root,
      verifier_authority_root: stored.verifier_authority_root,
      execution_receipt_id: stored.execution_receipt_id,
      execution_receipt_root: stored.execution_receipt_root,
      status: stored.status,
    };
    invariant(
      acceptedDisclosurePreparationRoot(record) === stored.record_root,
      "ERR_ID_PREIMAGE",
      "accepted disclosure preparation root is invalid",
    );
    return immutable(recordId, stored.record_root, {
      ...record,
      preparation: stored.preparation,
      verifier_authority: stored.verifier_authority,
    });
  }
  if (recordType === "PUBLIC_EXPORT_AUTHORITY") {
    const record = state.public_export_authorities[recordId];
    invariant(record, "ERR_SCHEMA", "accepted public export authority is missing");
    invariant(
      publicExportAuthorityV3Root(record.export_authority) ===
        record.public_export_authority_root,
      "ERR_ID_PREIMAGE",
      "public export authority preimage is invalid",
    );
    return immutable(
      record.authority_id,
      record.public_export_authority_root,
      record.export_authority,
      record.status,
    );
  }
  if (recordType === "REDACTION_MANIFEST") {
    const record = state.redaction_manifests[recordId];
    invariant(record, "ERR_SCHEMA", "accepted redaction manifest is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "DISCLOSURE_MANIFEST") {
    const record = state.disclosure_manifests[recordId];
    invariant(record, "ERR_SCHEMA", "accepted disclosure manifest is missing");
    invariant(
      publicSafeDisclosureManifestRoot(record.body) === record.record_root,
      "ERR_ID_PREIMAGE",
      "public-safe disclosure manifest root is invalid",
    );
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "PUBLIC_CAPSULE") {
    const record = state.public_capsules[recordId];
    invariant(record, "ERR_SCHEMA", "accepted public capsule is missing");
    invariant(publicCapsuleRoot(record.body) === record.record_root, "ERR_ID_PREIMAGE", "public capsule root is invalid");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "NON_CLAIMS") {
    const record = state.non_claims[recordId];
    invariant(record, "ERR_SCHEMA", "accepted non-claims carrier is missing");
    invariant(nonClaimsRoot(record.body) === record.record_root, "ERR_ID_PREIMAGE", "non-claims root is invalid");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "PUBLICATION_INTENT") {
    const record = state.publication_intents[recordId];
    invariant(record, "ERR_SCHEMA", "accepted publication intent is missing");
    const {
      intent_id: ignoredId,
      accepted_publication_anchor_root: ignoredAnchor,
      ...body
    } = record;
    invariant(
      publicationIntentV3Id(body) === record.intent_id,
      "ERR_ID_PREIMAGE",
      "publication intent ID preimage is invalid",
    );
    return immutable(record.intent_id, idDigest(record.intent_id, "PUBINTENT"), {
      intent_id: record.intent_id,
      ...body,
    });
  }
  if (recordType === "DISCLOSURE_COMPILATION_ANCHOR") {
    const record = state.disclosure_compilation_anchors[recordId];
    invariant(record, "ERR_SCHEMA", "accepted compilation anchor is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "PUBLICATION_ANCHOR") {
    const record = state.publication_anchors[recordId];
    invariant(record, "ERR_SCHEMA", "accepted publication anchor is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "DISCLOSURE_SCAN_RECEIPT") {
    const record = state.disclosure_scan_receipts[recordId];
    invariant(record, "ERR_SCHEMA", "accepted disclosure scan is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "DISCLOSURE_APPROVAL_RECEIPT") {
    const record = state.disclosure_approval_receipts[recordId];
    invariant(record, "ERR_SCHEMA", "accepted disclosure approval is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "DATA_ROUTE_AUTHORITY") {
    const record = state.data_route_authorities[recordId];
    invariant(record, "ERR_SCHEMA", "accepted data route authority is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "CLASSIFIED_INPUT_MANIFEST") {
    const record = state.classified_input_manifests[recordId];
    invariant(record, "ERR_SCHEMA", "accepted classified input manifest is missing");
    invariant(
      classifiedInputManifestRoot(record.body) === record.record_root,
      "ERR_ID_PREIMAGE",
      "classified input manifest preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "WORKER_TRUST_AUTHORITY") {
    const record = state.worker_trust_authorities[recordId];
    invariant(record, "ERR_SCHEMA", "accepted worker trust authority is missing");
    invariant(
      workerTrustAuthorityRoot(record.body) === record.record_root,
      "ERR_ID_PREIMAGE",
      "worker trust authority preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "ROUTE_EXECUTION_PLAN") {
    const record = state.route_execution_plans[recordId];
    invariant(record, "ERR_SCHEMA", "accepted route execution plan is missing");
    invariant(
      routeExecutionPlanV5Root(record.body) === record.record_root,
      "ERR_ID_PREIMAGE",
      "route execution plan preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "ROUTE_PLAN_CONSUMPTION") {
    const record = state.route_plan_consumptions[recordId];
    invariant(record, "ERR_SCHEMA", "accepted route plan consumption is missing");
    invariant(
      routePlanConsumptionRoot(record.body) === record.record_root,
      "ERR_ID_PREIMAGE",
      "route plan consumption preimage is invalid",
    );
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "TOOL_ROUTE_AUTHORITY") {
    const record = state.tool_route_authorities[recordId];
    invariant(record, "ERR_SCHEMA", "accepted tool route authority is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "REDACTION_APPROVAL") {
    const record = state.redaction_approvals[recordId];
    invariant(record, "ERR_SCHEMA", "accepted redaction approval is missing");
    return immutable(recordId, record.record_root, record.body);
  }
  if (recordType === "ENTROPY_FRESHNESS_AUTHORITY") {
    const record = Object.values(state.entropy_freshness_authorities).find(
      (item) => item.authority_id === recordId,
    );
    invariant(record, "ERR_SCHEMA", "accepted entropy authority is missing");
    invariant(
      entropyFreshnessAuthorityV1Root(record.authority) ===
        record.authority_root,
      "ERR_ID_PREIMAGE",
      "entropy authority preimage is invalid",
    );
    invariant(
      entropyBindingScopeRoot(
        record.authority.purpose,
        record.binding,
      ) === record.authority.scope_root &&
        record.binding.job_id === record.job_id,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "entropy authority binding is invalid",
    );
    invariant(
      ["AVAILABLE", "CONSUMED"].includes(record.status) &&
        (record.status === "CONSUMED") ===
          (record.consumption_id !== null &&
            record.consumption_root !== null),
      "ERR_NONCE_REPLAY",
      "entropy authority consumption status is invalid",
    );
    if (record.status === "AVAILABLE") {
      invariant(
        record.consumption_id === null &&
          record.consumption_root === null,
        "ERR_NONCE_REPLAY",
        "available entropy authority has consumption evidence",
      );
    } else {
      const consumption =
        state.entropy_one_use_consumptions[record.consumption_id];
      invariant(
        consumption &&
          consumption.consumption_id === record.consumption_id &&
          consumption.consumption_root === record.consumption_root &&
          entropyOneUseConsumptionV1Root(consumption.consumption) ===
            record.consumption_root &&
          consumption.consumption.authority_id ===
            record.authority_id &&
          consumption.consumption.authority_root ===
            record.authority_root &&
          consumption.consumption.purpose ===
            record.authority.purpose &&
          consumption.consumption.scope_root ===
            record.authority.scope_root &&
          consumption.consumption.nonce_commitment ===
            record.authority.nonce_commitment,
        "ERR_NONCE_REPLAY",
        "consumed entropy authority evidence is invalid",
      );
    }
    return immutable(
      record.authority_id,
      record.authority_root,
      {
        authority_id: record.authority_id,
        authority_root: record.authority_root,
        authority: record.authority,
        binding: record.binding,
        status: record.status,
        consumption_id: record.consumption_id,
        consumption_root: record.consumption_root,
      },
      record.status,
    );
  }
  if (recordType === "ENTROPY_ONE_USE_CONSUMPTION") {
    const record = state.entropy_one_use_consumptions[recordId];
    invariant(record, "ERR_SCHEMA", "accepted entropy consumption is missing");
    invariant(
      entropyOneUseConsumptionV1Root(record.consumption) ===
        record.consumption_root,
      "ERR_ID_PREIMAGE",
      "entropy consumption preimage is invalid",
    );
    return immutable(
      record.consumption_id,
      record.consumption_root,
      record.consumption,
      "CONSUMED",
    );
  }
  invariant(false, "ERR_SCHEMA", `unsupported accepted record type ${recordType}`);
}

function routeFact(recordId, recordRootValue, record, status = "ACCEPTED") {
  return {
    record_id: recordId,
    record_root: recordRootValue,
    record_status: status,
    record: structuredClone(record),
  };
}

function assertRouteRef(ref, recordId, recordRootValue, label) {
  invariant(
    ref &&
      ref.record_id === recordId &&
      ref.record_root === recordRootValue,
    "ERR_PREDECESSOR",
    `${label} is stale or changed`,
  );
}

function acceptedCarrierFact(state, mapName, ref, rootFunction, label) {
  if (ref === null) return null;
  const accepted = state[mapName][ref.record_id];
  invariant(accepted, "ERR_SCHEMA", `${label} is missing`);
  invariant(
    accepted.record_root === ref.record_root &&
      rootFunction(accepted.body) === accepted.record_root &&
      accepted.status === "ACCEPTED",
    "ERR_PREDECESSOR",
    `${label} is stale or changed`,
  );
  return routeFact(
    accepted.record_id,
    accepted.record_root,
    accepted.body,
    accepted.status,
  );
}

function acceptedRouteContextFromState(state, request) {
  assertExactObjectKeys(
    request,
    ["route_execution_plan_id", "route_execution_plan_root"],
    [],
    "accepted-route request",
  );
  assertCanonicalToken(
    request.route_execution_plan_id,
    "route execution plan ID",
    256,
  );
  assertCanonicalToken(
    request.route_execution_plan_root,
    "route execution plan root",
    256,
  );
  const acceptedPlan =
    state.route_execution_plans[request.route_execution_plan_id];
  invariant(acceptedPlan, "ERR_SCHEMA", "accepted route execution plan is missing");
  invariant(
    acceptedPlan.record_root === request.route_execution_plan_root &&
      routeExecutionPlanV5Root(acceptedPlan.body) === acceptedPlan.record_root &&
      acceptedPlan.status === "ACCEPTED",
    "ERR_PREDECESSOR",
    "accepted route execution plan is stale or changed",
  );
  const plan = acceptedPlan.body;

  const job = state.jobs[plan.job_ref.record_id];
  invariant(job, "ERR_SCHEMA", "route plan job is missing");
  assertRouteRef(plan.job_ref, job.job_id, job.record_root, "route plan job");
  invariant(
    job.accepted_contract &&
      job.accepted_contract_root === plan.contract_ref.record_root,
    "ERR_PREDECESSOR",
    "route plan contract is stale or changed",
  );
  assertRouteRef(
    plan.contract_ref,
    `CONTRACT-${job.accepted_contract_root}`,
    job.accepted_contract_root,
    "route plan contract",
  );

  const task = state.tasks[plan.task_ref.record_id];
  invariant(task, "ERR_SCHEMA", "route plan task is missing");
  assertRouteRef(plan.task_ref, task.task_id, task.record_root, "route plan task");
  const lease = state.leases[plan.lease_ref.record_id];
  invariant(lease, "ERR_SCHEMA", "route plan lease is missing");
  assertRouteRef(
    plan.lease_ref,
    lease.lease_id,
    lease.record_root,
    "route plan lease",
  );
  invariant(
    lease.status === "ACTIVE" &&
      state.tick >= lease.not_before_tick &&
      state.tick < lease.expiry_tick &&
      state.tick < task.deadline_tick &&
      state.tick >= plan.not_before_tick &&
      state.tick < plan.expiry_tick,
    "ERR_PREDECESSOR",
    "route plan lease or execution window is no longer live",
  );

  const offer = state.capability_offers[plan.capability_offer_ref.record_id];
  invariant(offer, "ERR_SCHEMA", "route plan capability offer is missing");
  const offerRoot = capabilityOfferRoot(offer);
  assertRouteRef(
    plan.capability_offer_ref,
    offer.offer_id,
    offerRoot,
    "route plan capability offer",
  );
  invariant(
    !state.revoked_offer_ids[offer.offer_id] &&
      state.tick >= offer.not_before_tick &&
      state.tick < offer.expiry_tick,
    "ERR_PREDECESSOR",
    "route plan capability offer is revoked or expired",
  );

  const manifest = acceptedCarrierFact(
    state,
    "classified_input_manifests",
    plan.classified_input_manifest_ref,
    classifiedInputManifestRoot,
    "classified input manifest",
  );
  const trust = acceptedCarrierFact(
    state,
    "worker_trust_authorities",
    plan.worker_trust_authority_ref,
    workerTrustAuthorityRoot,
    "worker trust authority",
  );
  invariant(
    state.tick >= manifest.record.not_before_tick &&
      state.tick < manifest.record.expiry_tick,
    "ERR_PREDECESSOR",
    "classified input measurement is expired",
  );
  invariant(
    state.tick >= trust.record.not_before_tick &&
      state.tick < trust.record.expiry_tick,
    "ERR_PREDECESSOR",
    "worker trust authority is expired",
  );

  const workerPrincipal = state.principals[lease.worker_principal_id];
  invariant(workerPrincipal, "ERR_SCHEMA", "route worker principal is missing");
  const workerController =
    state.controllers[workerPrincipal.controller_id];
  invariant(workerController, "ERR_SCHEMA", "route worker controller is missing");
  const measurementPrincipal =
    state.principals[manifest.record.measurement_principal_id];
  invariant(
    measurementPrincipal,
    "ERR_SCHEMA",
    "input measurement principal is missing",
  );
  const measurementController =
    state.controllers[manifest.record.measurement_controller_id];
  invariant(
    measurementController,
    "ERR_SCHEMA",
    "input measurement controller is missing",
  );

  const dataRouteAuthority = acceptedCarrierFact(
    state,
    "data_route_authorities",
    plan.data_route_authority_ref,
    dataRouteAuthorityRoot,
    "data route authority",
  );
  const toolRouteAuthorities = plan.tool_routes
    .filter((route) => route.tool_route_authority_ref !== null)
    .map((route) =>
      acceptedCarrierFact(
        state,
        "tool_route_authorities",
        route.tool_route_authority_ref,
        toolRouteAuthorityRoot,
        `tool route authority for ${route.tool_name}`,
      ),
    );
  const redactionApproval = acceptedCarrierFact(
    state,
    "redaction_approvals",
    plan.redaction_approval_ref,
    redactionApprovalV2Root,
    "redaction approval",
  );

  const account = state.accounts[plan.job_account_ref.record_id];
  invariant(account, "ERR_SCHEMA", "route plan job account is missing");
  assertRouteRef(
    plan.job_account_ref,
    account.account_id,
    account.record_root,
    "route plan job account",
  );
  const fundingLots = plan.funding_lot_refs.map((ref) => {
    const lot = state.funding_lots[ref.record_id];
    invariant(lot, "ERR_SCHEMA", `route funding lot ${ref.record_id} is missing`);
    assertRouteRef(ref, lot.lot_id, lot.record_root, "route funding lot");
    return routeFact(lot.lot_id, lot.record_root, lot, lot.status);
  });
  const allowance =
    plan.allowance_ref === null
      ? null
      : state.allowances[plan.allowance_ref.record_id];
  if (allowance !== null) {
    assertRouteRef(
      plan.allowance_ref,
      allowance.allowance_id,
      allowance.record_root,
      "route allowance",
    );
  }
  const commitment =
    plan.subwork_commitment_ref === null
      ? null
      : state.subwork_commitments[
          plan.subwork_commitment_ref.record_id
        ];
  if (commitment !== null) {
    assertRouteRef(
      plan.subwork_commitment_ref,
      commitment.subwork_commitment_id,
      commitment.record_root,
      "route subwork commitment",
    );
  }

  const acceptedConsumption =
    Object.values(state.route_plan_consumptions).find(
      (record) =>
        record.body.route_execution_plan_ref.record_id ===
          plan.route_execution_plan_id &&
        record.body.route_execution_plan_ref.record_root ===
          acceptedPlan.record_root,
    ) ?? null;
  const context = deepFreeze({
    schema: ACCEPTED_ROUTE_CONTEXT_SCHEMA,
    accepted_application_state_root: applicationRoot(state),
    accepted_logical_tick: state.tick,
    route_execution_plan: routeFact(
      acceptedPlan.record_id,
      acceptedPlan.record_root,
      plan,
      acceptedPlan.status,
    ),
    classified_input_manifest: manifest,
    worker_trust_authority: trust,
    job: routeFact(job.job_id, job.record_root, job, job.status ?? job.state),
    task: routeFact(task.task_id, task.record_root, task, task.status),
    lease: routeFact(lease.lease_id, lease.record_root, lease, lease.status),
    job_contract: routeFact(
      plan.contract_ref.record_id,
      job.accepted_contract_root,
      job.accepted_contract,
    ),
    capability_offer: routeFact(
      offer.offer_id,
      offerRoot,
      offer,
      "ACCEPTED",
    ),
    worker_principal: routeFact(
      workerPrincipal.principal_id,
      workerPrincipal.record_root,
      workerPrincipal,
      workerPrincipal.status,
    ),
    worker_controller: routeFact(
      workerController.controller_id,
      workerController.record_root,
      workerController,
      workerController.status,
    ),
    measurement_principal: routeFact(
      measurementPrincipal.principal_id,
      measurementPrincipal.record_root,
      measurementPrincipal,
      measurementPrincipal.status,
    ),
    measurement_controller: routeFact(
      measurementController.controller_id,
      measurementController.record_root,
      measurementController,
      measurementController.status,
    ),
    revoked_offer_ids: Object.keys(state.revoked_offer_ids).sort(),
    data_route_authority: dataRouteAuthority,
    tool_route_authorities: toolRouteAuthorities,
    redaction_approval: redactionApproval,
    job_account: routeFact(
      account.account_id,
      account.record_root,
      account,
      account.status,
    ),
    funding_lots: fundingLots,
    allowance:
      allowance === null
        ? null
        : routeFact(
            allowance.allowance_id,
            allowance.record_root,
            allowance,
            allowance.status,
          ),
    subwork_commitment:
      commitment === null
        ? null
        : routeFact(
            commitment.subwork_commitment_id,
            commitment.record_root,
            commitment,
            commitment.status,
          ),
    consumption:
      acceptedConsumption === null
        ? null
        : routeFact(
            acceptedConsumption.record_id,
            acceptedConsumption.record_root,
            acceptedConsumption.body,
            acceptedConsumption.status,
          ),
  });
  ACCEPTED_ROUTE_CONTEXTS.add(context);
  return context;
}

export function createAcceptedRecordResolver(runtime) {
  invariant(
    RUNTIME_INTERNALS.has(runtime),
    "ERR_AUTHORITY",
    "accepted-record resolver requires a branded core runtime",
  );
  const resolver = Object.freeze({
    resolveAcceptedRecord(request) {
      return resolveAcceptedRecord(resolver, request);
    },
    resolveAcceptedRecordSet(request) {
      return resolveAcceptedRecordSet(resolver, request);
    },
    resolveAcceptedRouteContext(request) {
      return resolveAcceptedRouteContext(resolver, request);
    },
  });
  RESOLVER_RUNTIMES.set(resolver, runtime);
  return resolver;
}

export function assertAcceptedRecordResolver(resolver) {
  invariant(
    RESOLVER_RUNTIMES.has(resolver),
    "ERR_AUTHORITY",
    "accepted-record resolver brand is invalid",
  );
  return resolver;
}

export function resolveAcceptedRouteContext(resolver, request) {
  assertAcceptedRecordResolver(resolver);
  const runtime = RESOLVER_RUNTIMES.get(resolver);
  return acceptedRouteContextFromState(runtimeInternals(runtime).state, request);
}

export function deriveDataRouteDecision(context) {
  invariant(
    ACCEPTED_ROUTE_CONTEXTS.has(context),
    "ERR_AUTHORITY",
    "data-route decision requires a branded accepted route context",
  );
  return deepFreeze(
    structuredClone(deriveDataRouteDecisionFromFacts(context)),
  );
}

export function resolveAcceptedRecord(resolver, request) {
  assertAcceptedRecordResolver(resolver);
  assertExactObjectKeys(
    request,
    ["record_type", "record_id", "record_root"],
    [],
    "accepted-record request",
  );
  assertCanonicalToken(request.record_type, "accepted record type");
  assertCanonicalToken(request.record_id, "accepted record ID", 256);
  assertCanonicalToken(request.record_root, "accepted record root", 256);
  const runtime = RESOLVER_RUNTIMES.get(resolver);
  const internals = runtimeInternals(runtime);
  const resolved = acceptedRecord(
    internals.state,
    request.record_type,
    request.record_id,
  );
  invariant(
    resolved.record_id === request.record_id &&
      resolved.record_root === request.record_root,
    "ERR_PREDECESSOR",
    "accepted record ID/root is stale or changed",
  );
  return deepFreeze({
    schema: "nexus-accepted-record-envelope-v2",
    accepted_application_state_root: applicationRoot(internals.state),
    accepted_logical_tick: internals.state.tick,
    record_type: request.record_type,
    record_id: resolved.record_id,
    record_root: resolved.record_root,
    record_revision: resolved.record_revision,
    record_status: resolved.record_status,
    record: structuredClone(resolved.record),
  });
}

export function resolveAcceptedRecordSet(resolver, request) {
  assertAcceptedRecordResolver(resolver);
  assertExactObjectKeys(
    request,
    ["record_type", "scope"],
    [],
    "accepted-record set request",
  );
  invariant(
    request.record_type === "REVIEW_ASSIGNMENT",
    "ERR_SCHEMA",
    "only canonical review-assignment history sets are supported",
  );
  assertExactObjectKeys(
    request.scope,
    ["assignment_slot", "job_id", "review_packet_root"],
    [],
    "review-assignment history scope",
  );
  assertCanonicalToken(request.scope.job_id, "history job ID", 256);
  assertCanonicalToken(
    request.scope.review_packet_root,
    "history review packet root",
    256,
  );
  assertSafeNonNegativeInteger(
    request.scope.assignment_slot,
    "history assignment slot",
  );
  const runtime = RESOLVER_RUNTIMES.get(resolver);
  const state = runtimeInternals(runtime).state;
  const records = Object.values(state.review_assignments)
    .filter(
      (record) =>
        record.job_id === request.scope.job_id &&
        record.packet_root === request.scope.review_packet_root &&
        record.slot === request.scope.assignment_slot,
    )
    .sort(
      (left, right) =>
        left.attempt - right.attempt ||
        left.review_assignment_id.localeCompare(
          right.review_assignment_id,
        ),
    )
    .map((record) =>
      acceptedRecord(
        state,
        "REVIEW_ASSIGNMENT",
        record.review_assignment_id,
      ),
    );
  const scope = structuredClone(request.scope);
  const scopeRoot = hash("NEXUS_REVIEW_ASSIGNMENT_SET_SCOPE_V1", {
    schema: "nexus-review-assignment-set-scope-v1",
    ...scope,
  });
  const references = records.map((record) => ({
    record_id: record.record_id,
    record_root: record.record_root,
    record_revision: record.record_revision,
    record_status: record.record_status,
  }));
  return deepFreeze({
    schema: "nexus-accepted-record-set-envelope-v2",
    accepted_application_state_root: applicationRoot(state),
    accepted_logical_tick: state.tick,
    record_type: "REVIEW_ASSIGNMENT",
    scope,
    scope_root: scopeRoot,
    set_root: hash("NEXUS_ACCEPTED_RECORD_SET_V2", {
      schema: "nexus-accepted-record-set-v2",
      record_type: "REVIEW_ASSIGNMENT",
      scope_root: scopeRoot,
      records: references,
    }),
    records: structuredClone(records),
  });
}

function getJob(state, jobId) {
  const job = state.jobs[jobId];
  invariant(job, "ERR_SCHEMA", `unknown job ${jobId}`);
  return job;
}

function getAccount(state, accountId) {
  const account = state.accounts[accountId];
  invariant(account, "ERR_SCHEMA", `unknown account ${accountId}`);
  return account;
}

function ownsAccount(state, principalId, account) {
  return (
    account.owner_principal_id === principalId &&
    state.principals[principalId]?.controller_id === account.controller_id
  );
}

function creationId(event, {
  prefix,
  objectType,
  naturalKey,
  parentIds = [],
  nonce,
}) {
  return stableId({
    prefix,
    objectType,
    parentIds,
    naturalKey,
    creatorPrincipalId: event.actor_id,
    creationPredecessorRoot: event.expected_predecessor_root,
    creationTick: event.tick,
    creationNonce: nonce,
  });
}

function putNewRecord(state, mapName, idKey, id, objectType, body) {
  invariant(!state[mapName][id], "ERR_ID_PREIMAGE", `${id} already exists`);
  const record = createRecord({ idKey, id, objectType }, body);
  state[mapName][id] = record;
  return record;
}

function updateRecord(state, mapName, id, objectType, patch) {
  const current = state[mapName][id];
  invariant(current, "ERR_SCHEMA", `${id} record is missing`);
  const revised = reviseRecord(current, patch, objectType);
  state[mapName][id] = revised;
  return revised;
}

function updateOwnerLotIds(state, bucket, ownerId, lotIds) {
  const spec = OWNER[bucket];
  invariant(spec, "ERR_FUNDING_LOT_OWNER", `unknown owner bucket ${bucket}`);
  updateRecord(state, spec.map, ownerId, spec.type, {
    funding_lot_ids: [...lotIds].sort(),
  });
}

function isSubset(values, ceiling) {
  const allowed = new Set(ceiling);
  return values.every((value) => allowed.has(value));
}

function offerSatisfiesContract(state, job, offer, task = null) {
  const contract = job.accepted_contract ?? job.draft_contract;
  const ceiling = contract.authority_ceiling;
  return Boolean(
    offer &&
      !state.revoked_offer_ids[offer.offer_id] &&
      state.principals[offer.principal_id]?.status === "ACTIVE" &&
      ceiling.allowed_worker_principal_ids.includes(offer.principal_id) &&
      ceiling.allowed_worker_classes.includes(offer.worker_class) &&
      ceiling.allowed_model_ids.includes(offer.model_id) &&
      ceiling.allowed_provider_families.includes(offer.provider_family) &&
      ceiling.allowed_operator_ids.includes(offer.operator_id) &&
      ceiling.allowed_routes.includes(offer.route) &&
      isSubset(offer.tools, ceiling.allowed_tools) &&
      isSubset(offer.runtimes, ceiling.allowed_runtimes) &&
      isSubset(offer.egress_allowlist, ceiling.egress_allowlist) &&
      offer.data_classes.includes(contract.privacy.data_class) &&
      offer.isolation_root === ceiling.required_isolation_root &&
      offer.trusted_worker_policy_root === ceiling.trusted_worker_policy_root &&
      offer.maximum_capability_root === ceiling.maximum_capability_root &&
      offer.contribution_terms_allowlist.includes(
        contract.rights.contribution_terms_root,
      ) &&
      (offer.project_allowlist.length === 0 ||
        offer.project_allowlist.includes(job.project_id)) &&
      (offer.job_allowlist.length === 0 ||
        offer.job_allowlist.includes(job.job_id)) &&
      state.tick >= offer.not_before_tick &&
      state.tick < offer.expiry_tick &&
      (task === null ||
        (task.data_class === contract.privacy.data_class &&
          isSubset(task.required_capabilities ?? [], offer.tools) &&
          task.max_compute_units <= offer.max_compute_units &&
          task.max_input_bytes <= offer.max_input_bytes &&
          task.max_output_bytes <= offer.max_output_bytes)),
  );
}

function assertOfferSatisfiesContract(state, job, offer, task = null) {
  invariant(
    offerSatisfiesContract(state, job, offer, task),
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "offer/task exceeds the complete frozen authority ceiling",
  );
  return offer;
}

function immutableOfferRootValid(offer, expectedId, expectedRoot) {
  if (!offer) return false;
  return (
    offer.offer_id === expectedId &&
    offer.offer_id === derivedCarrierId("CAPABILITY_OFFER", offer) &&
    capabilityOfferRoot(offer) === expectedRoot
  );
}

function reviewerEligibility(state, job, offer, assignment, evaluatedTick) {
  const principal = state.principals[assignment.reviewer_principal_id];
  const controller = state.controllers[principal?.controller_id];
  const facts = {
    schema: "nexus-reviewer-eligibility-v2",
    job_id: job.job_id,
    packet_root: job.review_packet_root,
    reviewer_principal_id: assignment.reviewer_principal_id,
    reviewer_seat_id: assignment.reviewer_seat_id,
    capability_offer_id: assignment.capability_offer_id,
    capability_offer_root: assignment.capability_offer_root,
    worker_class: offer.worker_class,
    maximum_capability_root: offer.maximum_capability_root,
    required_check_manifest_root: job.required_check_manifest_root,
    model_id: assignment.model_id,
    provider_family: offer.provider_family,
    operator_id: offer.operator_id,
    offer_auth_valid: immutableOfferRootValid(
      offer,
      assignment.capability_offer_id,
      assignment.capability_offer_root,
    ),
    controller_active: controller?.status === "ACTIVE",
    probe_current:
      typeof offer.probe_root === "string" &&
      offer.probe_root.length > 0 &&
      evaluatedTick >= offer.not_before_tick &&
      evaluatedTick < offer.expiry_tick,
    unrevoked: !state.revoked_offer_ids[offer.offer_id],
    conflict_policy_root: job.accepted_contract.conflict_policy_root,
    conflict_free:
      job.accepted_contract.conflict_policy.job_id === job.job_id &&
      !job.accepted_contract.conflict_policy.principal_ids.includes(
        assignment.reviewer_principal_id,
      ),
    policy_root: job.accepted_contract.policy_root,
    not_before_tick: offer.not_before_tick,
    expiry_tick: offer.expiry_tick,
    evaluated_tick: evaluatedTick,
  };
  invariant(
    facts.offer_auth_valid &&
      facts.controller_active &&
      facts.probe_current &&
      facts.unrevoked &&
      facts.conflict_free,
    "ERR_REVIEW_ASSIGNMENT",
    "reviewer eligibility facts are not all true",
  );
  return {
    facts,
    root: hash("NEXUS_REVIEWER_ELIGIBILITY_V2", facts),
  };
}

function assertFrozenContract(contract) {
  for (const [label, value, positive] of [
    ["work budget", contract.work.budget, true],
    ["work deadline tick", contract.work.deadline_tick, true],
    ["maximum attempts", contract.work.max_attempts, true],
    ["maximum subworkers", contract.work.max_subworkers, false],
    ["maximum subworker budget", contract.work.max_subworker_budget, false],
    ["fixed verification cost", contract.work.fixed_verification_cost, false],
    ["aggregate maximum compute units", contract.work.max_compute_units, true],
    ["reviewer amount", contract.settlement.reviewer_amount_each, false],
    ["appeal filing window", contract.appeal.filing_deadline_ticks, false],
    ["appeal resolution window", contract.appeal.resolution_deadline_ticks, false],
    ["hold resolution window", contract.hold.resolution_timeout_ticks, true],
  ]) {
    assertSafeNonNegativeInteger(value, label, { positive });
  }
  assertHexRoot(
    contract.authority_ceiling.maximum_capability_root,
    "contract maximum capability root",
  );
  invariant(
    contract.schema === "nexus-job-contract-v1" &&
      contract.review.required_reviews === 3 &&
      contract.review.distinct_model_ids === true &&
      contract.review.worker_self_review === false &&
      contract.review.material_dissent_policy === "HOLD",
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "unsupported frozen review policy",
  );
  invariant(
    contract.decision_authority.required_decisions === 1 &&
      contract.decision_authority.delegation_allowed === false,
    "ERR_DECISION_QUORUM_UNSUPPORTED",
    "v0 requires one non-delegable human decision",
  );
  invariant(
    Number.isSafeInteger(contract.hold.resolution_timeout_ticks) &&
      contract.hold.resolution_timeout_ticks >= 1 &&
      Number.isSafeInteger(contract.appeal.filing_deadline_ticks) &&
      contract.appeal.filing_deadline_ticks >= 0 &&
      Number.isSafeInteger(contract.appeal.resolution_deadline_ticks) &&
      (contract.appeal.filing_deadline_ticks === 0
        ? contract.appeal.maximum_rounds === 0
        : contract.appeal.maximum_rounds === 1 &&
          contract.appeal.resolution_deadline_ticks >= 1),
    "ERR_APPEAL_INELIGIBLE",
    "unsupported appeal/hold timing policy",
  );
  assertSortedUniqueStrings(
    contract.work.required_check_names,
    "required deterministic checks",
    { minItems: 1, maxItems: 32 },
  );
  for (const [key, values] of Object.entries({
    allowed_worker_principal_ids:
      contract.authority_ceiling.allowed_worker_principal_ids,
    allowed_model_ids: contract.authority_ceiling.allowed_model_ids,
    allowed_provider_families:
      contract.authority_ceiling.allowed_provider_families,
    allowed_operator_ids: contract.authority_ceiling.allowed_operator_ids,
    allowed_tools: contract.authority_ceiling.allowed_tools,
    allowed_runtimes: contract.authority_ceiling.allowed_runtimes,
    allowed_routes: contract.authority_ceiling.allowed_routes,
    egress_allowlist: contract.authority_ceiling.egress_allowlist,
    allowed_worker_classes:
      contract.authority_ceiling.allowed_worker_classes,
  })) {
    assertSortedUniqueStrings(values, `contract ${key}`, {
      minItems:
        ["allowed_worker_principal_ids", "allowed_model_ids", "allowed_routes"].includes(
          key,
        )
          ? 1
          : 0,
    });
  }
  assertBoundedString(
    contract.privacy.disclosure_policy_root,
    "disclosure policy root",
  );
  if (contract.award !== null) {
    assertSafeNonNegativeInteger(
      contract.award.lead_max_compute_units,
      "lead maximum compute units",
      { positive: true },
    );
    invariant(
      contract.award.lead_max_compute_units <=
        contract.work.max_compute_units,
      "ERR_CONTRACT_AUTHORITY_CEILING",
      "lead compute reservation exceeds aggregate contract ceiling",
    );
    invariant(
      contract.appeal.resolver_must_not_be_party === false ||
        contract.appeal.resolver_principal_ids.every(
          (id) => !contract.award.party_principal_ids.includes(id),
        ),
      "ERR_APPEAL_PARTY_CONFLICT",
      "appeal resolver is a frozen contract party",
    );
    const required = checkedAdd(
      checkedAdd(
        contract.award.lead_worker_amount,
        checkedMultiply(
          contract.review.required_reviews,
          contract.settlement.reviewer_amount_each,
        ),
      ),
      checkedAdd(
        contract.work.max_subworker_budget,
        contract.work.fixed_verification_cost,
      ),
    );
    invariant(
      required <= contract.work.budget,
      "ERR_FUNDING_OBLIGATION",
      "frozen contract obligations exceed budget",
    );
  }
  return contract;
}

function timedHoldRoot(job, reasonCode, evidenceRoot) {
  return `HOLD-${hash("NEXUS_HOLD_ROOT_V1", {
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    attempt: job.attempt,
    artifact_root: job.final_artifact_root,
    packet_root: job.review_packet_root,
    ordered_review_hashes: [],
    deterministic_evidence_root: job.deterministic_evidence_root,
    ordered_reason_codes: [reasonCode],
    policy_root: job.accepted_contract.policy_root,
    timeout_evidence_root: evidenceRoot,
  })}`;
}

function enterTimedHold(state, job, reasonCode, evidenceRoot) {
  if (job.state === "HOLD" || TERMINAL_STATES.has(job.state)) return job.hold_root;
  const holdRoot = timedHoldRoot(job, reasonCode, evidenceRoot);
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "HOLD",
    clearance_root: null,
    hold_root: holdRoot,
    hold_deadline_tick: checkedAdd(
      state.tick,
      job.accepted_contract.hold.resolution_timeout_ticks,
    ),
  });
  return holdRoot;
}

function moveWholeLots(state, {
  lotIds,
  sourceBucket,
  sourceId,
  targetBucket,
  targetId,
}) {
  const source = OWNER[sourceBucket];
  const target = OWNER[targetBucket];
  invariant(source && target, "ERR_FUNDING_LOT_OWNER", "unknown lot bucket");
  const sourceRecord = state[source.map][sourceId];
  const targetRecord = state[target.map][targetId];
  invariant(sourceRecord && targetRecord, "ERR_FUNDING_LOT_OWNER", "owner missing");
  const moveSet = new Set(lotIds);
  for (const lotId of [...lotIds].sort()) {
    const lot = state.funding_lots[lotId];
    invariant(
      lot?.status === "ACTIVE" &&
        lot.bucket === sourceBucket &&
        lot.bucket_id === sourceId,
      "ERR_FUNDING_LOT_OWNER",
      `${lotId} is not owned by ${sourceBucket}:${sourceId}`,
    );
    updateRecord(state, "funding_lots", lotId, "FUNDING_LOT", {
      bucket: targetBucket,
      bucket_id: targetId,
    });
  }
  updateOwnerLotIds(
    state,
    sourceBucket,
    sourceId,
    sourceRecord.funding_lot_ids.filter((lotId) => !moveSet.has(lotId)),
  );
  updateOwnerLotIds(state, targetBucket, targetId, [
    ...targetRecord.funding_lot_ids,
    ...lotIds,
  ]);
}

function allocateLots(state, event, {
  sourceBucket,
  sourceId,
  targetBucket,
  targetId,
  amount,
  allocationNonce,
}) {
  assertAmount(amount, { positive: true });
  const sourceSpec = OWNER[sourceBucket];
  const targetSpec = OWNER[targetBucket];
  const sourceRecord = state[sourceSpec.map][sourceId];
  const targetRecord = state[targetSpec.map][targetId];
  invariant(sourceRecord && targetRecord, "ERR_FUNDING_LOT_OWNER", "owner missing");
  const sourceLots = sourceRecord.funding_lot_ids.map(
    (lotId) => state.funding_lots[lotId],
  );
  const allocation = largestRemainderAllocation(sourceLots, amount);
  const movedIds = [];
  const fullyMoved = new Set();

  for (const [index, item] of allocation.entries()) {
    const lot = state.funding_lots[item.lot_id];
    invariant(
      lot.status === "ACTIVE" &&
        lot.bucket === sourceBucket &&
        lot.bucket_id === sourceId,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} has stale source ownership`,
    );
    if (item.amount === lot.amount) {
      updateRecord(state, "funding_lots", lot.lot_id, "FUNDING_LOT", {
        bucket: targetBucket,
        bucket_id: targetId,
      });
      movedIds.push(lot.lot_id);
      fullyMoved.add(lot.lot_id);
      continue;
    }
    invariant(item.amount < lot.amount, "ERR_FUNDING_TOTAL", "split exceeds lot");
    updateRecord(state, "funding_lots", lot.lot_id, "FUNDING_LOT", {
      amount: checkedSubtract(lot.amount, item.amount),
    });
    const childId = creationId(event, {
      prefix: "LOT",
      objectType: "FUNDING_LOT",
      naturalKey: {
        source_contribution_id: lot.source_contribution_id,
        parent_lot_id: lot.lot_id,
        split_index: index,
        allocation_nonce: allocationNonce,
      },
      parentIds: [lot.lot_id, targetId],
      nonce: `${allocationNonce}:${index}`,
    });
    putNewRecord(
      state,
      "funding_lots",
      "lot_id",
      childId,
      "FUNDING_LOT",
      {
        source_contribution_id: lot.source_contribution_id,
        source_account_id: lot.source_account_id,
        contribution_kind: lot.contribution_kind,
        amount: item.amount,
        bucket: targetBucket,
        bucket_id: targetId,
        parent_lot_id: lot.lot_id,
        status: "ACTIVE",
      },
    );
    movedIds.push(childId);
  }

  updateOwnerLotIds(
    state,
    sourceBucket,
    sourceId,
    sourceRecord.funding_lot_ids.filter((lotId) => !fullyMoved.has(lotId)),
  );
  updateOwnerLotIds(state, targetBucket, targetId, [
    ...targetRecord.funding_lot_ids,
    ...movedIds,
  ]);
  return movedIds;
}

function returnSelectedBidLots(state, bid, job) {
  const grouped = new Map();
  for (const lotId of bid.funding_lot_ids) {
    const lot = state.funding_lots[lotId];
    const ids = grouped.get(lot.source_contribution_id) ?? [];
    ids.push(lotId);
    grouped.set(lot.source_contribution_id, ids);
  }
  for (const [contributionId, lotIds] of [...grouped.entries()].sort()) {
    moveWholeLots(state, {
      lotIds,
      sourceBucket: "BID",
      sourceId: bid.bid_id,
      targetBucket: "CONTRIBUTION",
      targetId: contributionId,
    });
    updateRecord(state, "contributions", contributionId, "CONTRIBUTION", {
      status: "RESERVED",
    });
  }
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "OPEN",
    candidate_contract: null,
    candidate_contract_root: null,
    selected_bid_id: null,
  });
}

function makeContract(
  jobId,
  actorId,
  payload,
  projectId,
  verificationPrincipalId,
) {
  const conflictPolicy = {
    schema: "nexus-conflict-policy-v1",
    job_id: jobId,
    principal_ids: [
      ...new Set([actorId, payload.maintainer_principal_id]),
    ].sort(),
    source_policy_root: payload.policy_root,
  };
  return {
    schema: "nexus-job-contract-v1",
    job_id: jobId,
    job_version: 1,
    project: {
      repository: payload.repository,
      base_commit: payload.base_commit,
      maintainer_principal_id: payload.maintainer_principal_id,
      project_pool_account_id: payload.project_pool_account_id,
      repository_control_status: "FIXTURE_SIMULATED",
    },
    task: {
      title: payload.title,
      spec_root: payload.spec_root,
      acceptance_root: payload.acceptance_root,
      source_root: payload.source_root,
      context_root: payload.context_root,
      maximum_artifact_bytes: payload.maximum_artifact_bytes,
    },
    privacy: {
      data_class: payload.data_class,
      remote_execution: payload.remote_execution,
      public_export: "SANITIZED_ONLY",
      disclosure_policy_root: payload.disclosure_policy_root,
      secret_scan_policy_root: payload.secret_scan_policy_root,
      approval_policy_root: payload.approval_policy_root,
    },
    work: {
      budget: payload.budget,
      deadline_tick: payload.deadline_tick,
      max_attempts: payload.max_attempts,
      max_subworkers: payload.max_subworkers,
      max_subworker_budget: payload.max_subworker_budget,
      fixed_verification_cost: payload.fixed_verification_cost,
      max_compute_units: payload.max_compute_units,
      required_check_names: [...payload.required_check_names],
      check_environment_root: payload.check_environment_root,
    },
    authority_ceiling: {
      allowed_worker_principal_ids: [...payload.allowed_worker_principal_ids].sort(),
      allowed_worker_classes: ["REGISTERED"],
      allowed_model_ids: [...payload.allowed_model_ids].sort(),
      allowed_provider_families: [...payload.allowed_provider_families].sort(),
      allowed_operator_ids: [...payload.allowed_operator_ids].sort(),
      allowed_tools: [...payload.allowed_tools].sort(),
      allowed_runtimes: [...payload.allowed_runtimes].sort(),
      allowed_routes: [...payload.allowed_routes].sort(),
      egress_allowlist: [...payload.egress_allowlist].sort(),
      maximum_data_class: payload.data_class,
      required_isolation_root: payload.required_isolation_root,
      trusted_worker_policy_root: payload.trusted_worker_policy_root,
      maximum_capability_root: payload.maximum_capability_root,
      publication_principal_ids: [actorId],
      redelegation_allowed: false,
    },
    review: {
      required_reviews: 3,
      distinct_model_ids: true,
      worker_self_review: false,
      required_diversity_dimensions: [
        "MACHINE",
        "MODEL",
        "OPERATOR",
        "PROMPT_LINEAGE",
        "PROVIDER",
        "TOOLCHAIN",
        "VERIFIER",
      ],
      material_dissent_policy: "HOLD",
    },
    conflict_policy: conflictPolicy,
    conflict_policy_root: hash(
      "NEXUS_CONFLICT_POLICY_V1",
      conflictPolicy,
    ),
    decision_authority: {
      settlement_principal_ids: [actorId],
      review_transition_principal_ids: [actorId],
      timeout_executor_principal_ids: [actorId],
      required_decisions: 1,
      delegation_allowed: false,
      repository_merge_authority: "MAINTAINER_EXCLUSIVE",
    },
    rights: {
      allowed_licences: [...payload.allowed_licences].sort(),
      notice_required: true,
      upstream_pin_required: true,
      provenance_declaration_required: true,
      contribution_terms_root: payload.contribution_terms_root,
      attribution_policy_root: payload.attribution_policy_root,
      worker_acknowledgements_required: true,
    },
    settlement: {
      lead_worker_amount_ceiling: payload.lead_worker_amount_ceiling,
      reviewer_amount_each: payload.reviewer_amount_each,
      verification_recipient_account_id:
        payload.verification_recipient_account_id,
      verification_principal_id: verificationPrincipalId,
      funding_consumption_policy: "PRO_RATA_LARGEST_REMAINDER_V1",
      overfunding_policy: "REJECT",
      requester_residue_policy: "REFUND",
      donation_residue_policy: "PROJECT_POOL",
      contribution_dispositions: {
        PLEDGE: {
          CANCELLED: "RETURN_SOURCE",
          SETTLED_RESIDUE: "RETURN_SOURCE",
          ABORTED_RESIDUE: "RETURN_SOURCE",
        },
        DONATION_INTENT: {
          CANCELLED: "RETURN_SOURCE",
          SETTLED_RESIDUE: "PROJECT_POOL",
          ABORTED_RESIDUE: "PROJECT_POOL",
        },
      },
      timeout_policy_root: payload.timeout_policy_root,
      abort_policy_root: payload.abort_policy_root,
    },
    appeal: {
      eligible_roles: ["REQUESTER", "WORKER", "SPONSOR", "MAINTAINER"],
      allowed_grounds: [...payload.allowed_appeal_grounds].sort(),
      filing_deadline_ticks: payload.filing_deadline_ticks,
      resolution_deadline_ticks: payload.resolution_deadline_ticks,
      maximum_rounds: payload.filing_deadline_ticks === 0 ? 0 : 1,
      resolver_principal_ids: [...payload.resolver_principal_ids].sort(),
      resolver_must_not_be_party: true,
      evidence_access: "DATA_CLASS_REDACTED",
      payout_effect: "FREEZE_DISPUTED_ONLY",
      unavailable_resolver_policy: "ABORT_CONTRACT",
      anti_retaliation: true,
    },
    hold: {
      resolution_timeout_ticks: payload.hold_timeout_ticks,
      timeout_outcome: "ABORT_CONTRACT",
    },
    verifier_root: payload.verifier_root,
    policy_root: payload.policy_root,
    project_id: projectId,
    award: null,
  };
}

function handleCreateJob(state, event) {
  const p = event.payload;
  assertAmount(p.budget, { positive: true });
  for (const amount of [
    p.maximum_artifact_bytes,
    p.max_attempts,
    p.max_subworkers,
    p.max_subworker_budget,
    p.fixed_verification_cost,
    p.max_compute_units,
    p.lead_worker_amount_ceiling,
    p.reviewer_amount_each,
  ]) {
    assertAmount(amount);
  }
  invariant(
    p.max_attempts >= 1 && p.deadline_tick > state.tick,
    "ERR_SCHEMA",
    "job attempts/deadline are invalid",
  );
  for (const [label, value] of [
    ["job deadline tick", p.deadline_tick],
    ["appeal filing deadline ticks", p.filing_deadline_ticks],
    ["appeal resolution deadline ticks", p.resolution_deadline_ticks],
    ["hold timeout ticks", p.hold_timeout_ticks],
  ]) {
    assertSafeNonNegativeInteger(value, label);
  }
  assertHexRoot(p.maximum_capability_root, "maximum capability root");
  for (const [label, values, minimum] of [
    ["required_check_names", p.required_check_names, 1],
    ["allowed_worker_principal_ids", p.allowed_worker_principal_ids, 1],
    ["allowed_model_ids", p.allowed_model_ids, 1],
    ["allowed_provider_families", p.allowed_provider_families, 1],
    ["allowed_operator_ids", p.allowed_operator_ids, 1],
    ["allowed_tools", p.allowed_tools, 0],
    ["allowed_runtimes", p.allowed_runtimes, 0],
    ["allowed_routes", p.allowed_routes, 1],
    ["egress_allowlist", p.egress_allowlist, 0],
    ["allowed_licences", p.allowed_licences, 1],
    ["allowed_appeal_grounds", p.allowed_appeal_grounds, 0],
    ["resolver_principal_ids", p.resolver_principal_ids, 0],
  ]) {
    assertSortedUniqueStrings(values, label, { minItems: minimum });
  }
  invariant(
    p.maintainer_principal_id === event.actor_id,
    "ERR_REPOSITORY_CONTROL_UNVERIFIED",
    "v0 fixture requires requester to be simulated maintainer",
  );
  invariant(
    Number.isSafeInteger(p.hold_timeout_ticks) && p.hold_timeout_ticks >= 1,
    "ERR_HOLD_BINDING",
    "hold timeout must be positive",
  );
  if (p.filing_deadline_ticks > 0) {
    invariant(
      p.resolution_deadline_ticks >= 1,
      "ERR_APPEAL_RESOLUTION_EXPIRED",
      "enabled appeals need a positive resolution window",
    );
  }
  invariant(
    p.remote_execution || p.allowed_routes.every((route) => route === "LOCAL"),
    "ERR_REMOTE_EXECUTION_FORBIDDEN",
    "remote execution denial conflicts with route ceiling",
  );
  const jobId = creationId(event, {
    prefix: "JOB",
    objectType: "JOB",
    naturalKey: {
      requester_principal_id: event.actor_id,
      repository: p.repository,
      base_commit: p.base_commit,
    },
    nonce: p.job_nonce,
  });
  const projectId = rootId("PROJECT", "NEXUS_PROJECT_V1", {
    repository: p.repository,
    maintainer_principal_id: p.maintainer_principal_id,
    fixture: true,
  });
  const accountId = creationId(event, {
    prefix: "ACCOUNT",
    objectType: "ACCOUNT",
    naturalKey: { kind: "JOB", job_id: jobId },
    parentIds: [jobId],
    nonce: `${p.job_nonce}:account`,
  });
  const verificationAccount = getAccount(
    state,
    p.verification_recipient_account_id,
  );
  invariant(
    verificationAccount.status === "ACTIVE" &&
      verificationAccount.owner_principal_id &&
      state.principals[verificationAccount.owner_principal_id]?.status ===
        "ACTIVE",
    "ERR_AUTHORITY",
    "verification recipient must be an active principal account",
  );
  const contract = makeContract(
    jobId,
    event.actor_id,
    p,
    projectId,
    verificationAccount.owner_principal_id,
  );
  assertFrozenContract(contract);
  const contractRoot = draftContractRoot(contract);
  const maintainerAttestationRoot = hash("NEXUS_MAINTAINER_FIXTURE_V1", {
    warning: "SIMULATED_MAINTAINER_BINDING",
    principal_id: event.actor_id,
    repository: p.repository,
    base_commit: p.base_commit,
    contract_root: contractRoot,
  });
  putNewRecord(state, "accounts", "account_id", accountId, "ACCOUNT", {
    controller_id: state.principals[event.actor_id].controller_id,
    kind: "JOB",
    owner_principal_id: null,
    owner_job_id: jobId,
    available: 0,
    status: "ACTIVE",
  });
  putNewRecord(state, "jobs", "job_id", jobId, "JOB", {
    job_account_id: accountId,
    requester_principal_id: event.actor_id,
    project_id: projectId,
    maintainer_principal_id: p.maintainer_principal_id,
    origin: "MAINTAINER_POSTED",
    maintainer_attestation_root: maintainerAttestationRoot,
    repository_control_status: "FIXTURE_SIMULATED",
    state: "OPEN",
    version: 1,
    draft_contract: contract,
    draft_contract_root: contractRoot,
    accepted_contract: null,
    accepted_contract_root: null,
    candidate_contract: null,
    candidate_contract_root: null,
    active_round_id: null,
    selected_round_id: null,
    selected_bid_id: null,
    accepted_worker_seat: null,
    accepted_worker_principal_id: null,
    attempt: 0,
    contribution_ids: [],
    funding_lot_ids: [],
    allowance_ids: [],
    subwork_commitment_ids: [],
    payout_ids: [],
    review_assignment_ids: [],
    task_ids: [],
    final_source_root: null,
    final_artifact_root: null,
    final_manifest_root: null,
    deterministic_evidence_root: null,
    deterministic_evidence_manifest: null,
    required_check_manifest: null,
    required_check_manifest_root: null,
    deterministic_checks_passed: null,
    review_packet_root: null,
    clearance_root: null,
    hold_root: null,
    hold_deadline_tick: null,
    timeout_abort_required: false,
    abort_authorization_root: null,
    appeal_close_tick: null,
    active_appeal_id: null,
    appeal_ids: [],
    human_decision_root: null,
    terminal_event_id: null,
    lead_payout_accrued: false,
    verification_payout_accrued: false,
    verifier_authority_root: null,
    verifier_execution_receipt_anchor_root: null,
    valid_review_payouts_created: 0,
    subworker_budget_allocated: 0,
    compute_units_reserved: 0,
    terminal_receipt_id: null,
    accepted_compilation_anchor_root: null,
    accepted_publication_anchor_root: null,
    publication_intent_ids: [],
  });
  return {
    jobId,
    effects: [`created job ${jobId}`, `created job account ${accountId}`],
    result: { job_id: jobId, job_account_id: accountId },
  };
}

function handleRegisterOffer(state, event) {
  const p = event.payload;
  invariant(
    p.offer_mode === "PAID" || p.offer_mode === "DONATED_CAPACITY",
    "ERR_CAPABILITY",
    "unsupported offer mode",
  );
  invariant(
    p.worker_class === "REGISTERED",
    "ERR_CAPABILITY",
    "unsupported worker class",
  );
  assertHexRoot(p.maximum_capability_root, "offer maximum capability root");
  for (const field of [
    "max_input_bytes",
    "max_output_bytes",
    "max_compute_units",
    "max_active_leases",
    "not_before_tick",
    "expiry_tick",
  ]) {
    assertAmount(p[field]);
  }
  invariant(
    p.max_active_leases >= 1 &&
      p.not_before_tick < p.expiry_tick &&
      p.expiry_tick > state.tick,
    "ERR_CAPABILITY",
    "offer limits/window are invalid",
  );
  for (const [label, values] of [
    ["project_allowlist", p.project_allowlist],
    ["job_allowlist", p.job_allowlist],
    ["data_classes", p.data_classes],
    ["tools", p.tools],
    ["runtimes", p.runtimes],
    ["egress_allowlist", p.egress_allowlist],
    ["contribution_terms_allowlist", p.contribution_terms_allowlist],
  ]) {
    assertSortedUniqueStrings(values, label);
  }
  const seatId = rootId("SEAT", "NEXUS_SEAT_V1", {
    principal_id: event.actor_id,
    seat_nonce: p.seat_nonce,
  });
  const body = {
    schema: "nexus-capability-offer-v1",
    principal_id: event.actor_id,
    worker_seat_id: seatId,
    offer_mode: p.offer_mode,
    worker_class: p.worker_class,
    owner_consent_id: p.owner_consent_id,
    owner_consent_root: p.owner_consent_root,
    project_allowlist: [...p.project_allowlist].sort(),
    job_allowlist: [...p.job_allowlist].sort(),
    model_id: p.model_id,
    provider_family: p.provider_family,
    operator_id: p.operator_id,
    route: p.route,
    data_classes: [...p.data_classes].sort(),
    tools: [...p.tools].sort(),
    runtimes: [...p.runtimes].sort(),
    egress_allowlist: [...p.egress_allowlist].sort(),
    max_input_bytes: p.max_input_bytes,
    max_output_bytes: p.max_output_bytes,
    max_compute_units: p.max_compute_units,
    max_active_leases: p.max_active_leases,
    isolation_root: p.isolation_root,
    trusted_worker_policy_root: p.trusted_worker_policy_root,
    maximum_capability_root: p.maximum_capability_root,
    contribution_terms_allowlist: [...p.contribution_terms_allowlist].sort(),
    attribution: p.attribution,
    probe_root: p.probe_root,
    not_before_tick: p.not_before_tick,
    expiry_tick: p.expiry_tick,
    nonce: p.offer_nonce,
  };
  const offerId = derivedCarrierId("CAPABILITY_OFFER", body);
  const consent =
    p.owner_consent_id === null
      ? null
      : state.donated_capacity_consents[p.owner_consent_id];
  invariant(
    (p.offer_mode === "PAID" &&
      p.owner_consent_id === null &&
      p.owner_consent_root === null) ||
      (p.offer_mode === "DONATED_CAPACITY" &&
        consent?.record_root === p.owner_consent_root &&
        consent.principal_id === event.actor_id &&
        consent.controller_id === event.auth.controller_id &&
        consent.signed_body.offer_terms_root ===
          capabilityOfferTermsRoot(body) &&
        consent.signed_body.not_before_tick <= p.not_before_tick &&
        consent.signed_body.expiry_tick >= p.expiry_tick &&
        consent.status === "ACCEPTED"),
    "ERR_AUTHORITY",
    "offer lacks exact independently authenticated donated-capacity consent",
  );
  invariant(!state.capability_offers[offerId], "ERR_ID_PREIMAGE", "offer exists");
  state.capability_offers[offerId] = {
    offer_id: offerId,
    ...body,
    authentication: structuredClone(event.auth),
  };
  return {
    jobId: null,
    effects: [`registered capability offer ${offerId}`],
    result: { offer_id: offerId, worker_seat_id: seatId },
  };
}

function handleRevokeOffer(state, event) {
  const p = event.payload;
  const offer = state.capability_offers[p.capability_offer_id];
  invariant(offer, "ERR_CAPABILITY", "capability offer is missing");
  invariant(
    offer.principal_id === event.actor_id &&
      capabilityOfferRoot(offer) === p.capability_offer_root &&
      !state.revoked_offer_ids[offer.offer_id],
    "ERR_AUTHORITY",
    "actor cannot revoke this exact active capability offer",
  );
  const revocation = {
    schema: "nexus-capability-offer-revocation-v1",
    capability_offer_id: offer.offer_id,
    capability_offer_root: p.capability_offer_root,
    principal_id: event.actor_id,
    revoked_tick: state.tick,
    event_id: event.event_id,
  };
  state.revoked_offer_ids[offer.offer_id] = hash(
    "NEXUS_CAPABILITY_OFFER_REVOCATION_V1",
    revocation,
  );
  return {
    jobId: null,
    effects: [`revoked capability offer ${offer.offer_id}`],
    result: {
      capability_offer_id: offer.offer_id,
      revocation_root: state.revoked_offer_ids[offer.offer_id],
    },
  };
}

function handleAcceptDonatedCapacityConsent(state, event) {
  invariant(
    event.payload.schema === "nexus-accept-donated-capacity-consent-v1",
    "ERR_SCHEMA",
    "unsupported donated-capacity consent payload",
  );
  const signedBody = event.payload.body;
  const signedBodyRoot = donatedCapacityConsentBodyRoot(signedBody);
  invariant(
    signedBody.principal_id === event.actor_id &&
      signedBody.controller_id === event.auth.controller_id &&
      state.tick >= signedBody.not_before_tick &&
      state.tick < signedBody.expiry_tick,
    "ERR_AUTHORITY",
    "donated-capacity consent is not current for its actor/controller",
  );
  verifyIndependentControllerAuthentication(state, {
    principalId: signedBody.principal_id,
    controllerId: signedBody.controller_id,
    signedDomain: "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V1",
    signedBodyRoot,
    authentication: event.payload.authentication,
  });
  const base = {
    schema: "nexus-accepted-donated-capacity-consent-v1",
    principal_id: signedBody.principal_id,
    controller_id: signedBody.controller_id,
    signed_body: structuredClone(signedBody),
    signed_body_root: signedBodyRoot,
    status: "ACCEPTED",
    authentication: structuredClone(event.payload.authentication),
  };
  const consentId = derivedCarrierId(
    "DONATED_CAPACITY_CONSENT",
    base,
  );
  const record = { ...base, consent_id: consentId };
  const root = donatedCapacityConsentRecordRoot(record);
  invariant(
    !state.donated_capacity_consents[consentId] &&
      !Object.values(state.donated_capacity_consents).some(
        (item) => item.record_root === root,
      ),
    "ERR_NONCE_REPLAY",
    "donated-capacity consent is already accepted",
  );
  state.donated_capacity_consents[consentId] = {
    ...record,
    record_root: root,
  };
  return {
    jobId: null,
    effects: [`accepted donated-capacity consent ${consentId}`],
    result: { consent_id: consentId, consent_root: root },
  };
}

function handleContribute(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(job.state === "OPEN", "ERR_CONTRIBUTION_STATE", "job is not open");
  assertAmount(p.amount, { positive: true });
  invariant(
    p.kind === "PLEDGE" || p.kind === "DONATION_INTENT",
    "ERR_CONTRIBUTION_STATE",
    "bad contribution kind",
  );
  invariant(
    typeof p.disclosure_acknowledgement_root === "string" &&
      p.disclosure_acknowledgement_root.length > 0,
    "ERR_CONTRIBUTION_CONSENT",
    "contribution disclosure acknowledgement is required",
  );
  const account = getAccount(state, p.sponsor_account_id);
  invariant(
    ownsAccount(state, event.actor_id, account),
    "ERR_AUTHORITY",
    "actor does not own sponsor account",
  );
  invariant(
    account.status === "ACTIVE" && account.available >= p.amount,
    "ERR_INSUFFICIENT_AVAILABLE",
    "sponsor balance is insufficient",
  );
  const reserved = Object.values(state.contributions)
    .filter(
      (item) =>
        item.job_id === job.job_id &&
        ["RESERVED", "SELECTED_LOCK"].includes(item.status),
    )
    .reduce((sum, item) => checkedAdd(sum, item.amount), 0);
  invariant(
    checkedAdd(reserved, p.amount) <= job.draft_contract.work.budget,
    "ERR_FUNDING_TOTAL",
    "contribution would overfund job",
  );
  const contributionId = creationId(event, {
    prefix: "CONTRIB",
    objectType: "CONTRIBUTION",
    naturalKey: {
      job_id: job.job_id,
      job_version: job.version,
      sponsor_principal_id: event.actor_id,
      sponsor_account_id: account.account_id,
    },
    parentIds: [job.job_id, account.account_id],
    nonce: p.contribution_nonce,
  });
  const lotId = creationId(event, {
    prefix: "LOT",
    objectType: "FUNDING_LOT",
    naturalKey: {
      source_contribution_id: contributionId,
      parent_lot_id: null,
      split_index: 0,
    },
    parentIds: [contributionId],
    nonce: `${p.contribution_nonce}:lot`,
  });
  putNewRecord(
    state,
    "contributions",
    "contribution_id",
    contributionId,
    "CONTRIBUTION",
    {
      job_id: job.job_id,
      job_version: job.version,
      draft_contract_root: job.draft_contract_root,
      contribution_disposition_root: hash(
        "NEXUS_CONTRIBUTION_DISPOSITION_V1",
        job.draft_contract.settlement.contribution_dispositions[p.kind],
      ),
      disclosure_acknowledgement_root: p.disclosure_acknowledgement_root,
      sponsor_principal_id: event.actor_id,
      sponsor_account_id: account.account_id,
      kind: p.kind,
      amount: p.amount,
      funding_lot_ids: [lotId],
      attribution: p.attribution,
      status: "RESERVED",
      nonce: p.contribution_nonce,
      created_tick: state.tick,
    },
  );
  putNewRecord(state, "funding_lots", "lot_id", lotId, "FUNDING_LOT", {
    source_contribution_id: contributionId,
    source_account_id: account.account_id,
    contribution_kind: p.kind,
    amount: p.amount,
    bucket: "CONTRIBUTION",
    bucket_id: contributionId,
    parent_lot_id: null,
    status: "ACTIVE",
  });
  updateRecord(state, "accounts", account.account_id, "ACCOUNT", {
    available: checkedSubtract(account.available, p.amount),
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    contribution_ids: [...job.contribution_ids, contributionId].sort(),
  });
  return {
    jobId: job.job_id,
    effects: [`reserved ${p.amount} SIM_CREDIT in ${contributionId}`],
    result: { contribution_id: contributionId, lot_id: lotId },
  };
}

function handleOpenBidRound(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  for (const [label, value] of [
    ["round open tick", p.open_tick],
    ["commit close tick", p.commit_close_tick],
    ["reveal close tick", p.reveal_close_tick],
    ["acceptance deadline tick", p.acceptance_deadline_tick],
  ]) {
    assertSafeNonNegativeInteger(value, label);
  }
  invariant(
    job.requester_principal_id === event.actor_id && job.state === "OPEN",
    "ERR_AUTHORITY",
    "requester must open an open job round",
  );
  invariant(!job.active_round_id, "ERR_BID_ROUND", "job already has a round");
  invariant(
    p.open_tick === state.tick &&
      p.open_tick < p.commit_close_tick &&
      p.commit_close_tick < p.reveal_close_tick &&
      p.reveal_close_tick < p.acceptance_deadline_tick,
    "ERR_BID_WINDOW",
    "invalid bid-round windows",
  );
  const roundId = creationId(event, {
    prefix: "ROUND",
    objectType: "BID_ROUND",
    naturalKey: {
      job_id: job.job_id,
      job_version: job.version,
      draft_contract_root: job.draft_contract_root,
    },
    parentIds: [job.job_id],
    nonce: p.round_nonce,
  });
  putNewRecord(state, "bid_rounds", "round_id", roundId, "BID_ROUND", {
    job_id: job.job_id,
    job_version: job.version,
    draft_contract_root: job.draft_contract_root,
    open_tick: p.open_tick,
    commit_close_tick: p.commit_close_tick,
    reveal_close_tick: p.reveal_close_tick,
    acceptance_deadline_tick: p.acceptance_deadline_tick,
    status: "OPEN_COMMIT",
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    active_round_id: roundId,
  });
  return {
    jobId: job.job_id,
    effects: [`opened bid round ${roundId}`],
    result: { round_id: roundId },
  };
}

function handleCommitBid(state, event) {
  const p = event.payload;
  const round = state.bid_rounds[p.round_id];
  invariant(round, "ERR_BID_ROUND", "bid round is missing");
  const job = getJob(state, round.job_id);
  invariant(
    round.status === "OPEN_COMMIT" &&
      state.tick >= round.open_tick &&
      state.tick < round.commit_close_tick,
    "ERR_BID_PHASE",
    "commit window is closed",
  );
  const offer = capabilityOfferByRoot(state, p.capability_offer_root);
  invariant(
    offer?.principal_id === event.actor_id &&
      offer.worker_seat_id === p.worker_seat_id,
    "ERR_CAPABILITY",
    "bid offer does not belong to actor/seat",
  );
  const bidId = creationId(event, {
    prefix: "BID",
    objectType: "BID",
    naturalKey: {
      round_id: round.round_id,
      job_id: job.job_id,
      job_version: job.version,
      bidder_principal_id: event.actor_id,
      worker_seat_id: p.worker_seat_id,
    },
    parentIds: [round.round_id, job.job_id],
    nonce: p.bid_nonce,
  });
  putNewRecord(state, "bids", "bid_id", bidId, "BID", {
    round_id: round.round_id,
    job_id: job.job_id,
    job_version: job.version,
    draft_contract_root: job.draft_contract_root,
    bidder_principal_id: event.actor_id,
    worker_seat_id: p.worker_seat_id,
    capability_offer_root: p.capability_offer_root,
    commitment: p.commitment,
    reveal_root: null,
    reveal: null,
    status: "COMMITTED",
    funding_lot_ids: [],
  });
  return {
    jobId: job.job_id,
    effects: [`committed bid ${bidId}`],
    result: { bid_id: bidId },
  };
}

function handleRevealBid(state, event) {
  const p = event.payload;
  const bid = state.bids[p.bid_id];
  invariant(bid, "ERR_BID_STALE", "bid is missing");
  const round = state.bid_rounds[bid.round_id];
  invariant(
    round.status === "OPEN_REVEAL" &&
      state.tick >= round.commit_close_tick &&
      state.tick < round.reveal_close_tick,
    "ERR_BID_PHASE",
    "reveal window is closed",
  );
  invariant(
    bid.bidder_principal_id === event.actor_id,
    "ERR_AUTHORITY",
    "only bidder may reveal",
  );
  const reveal = p.reveal;
  assertBidReveal(reveal);
  invariant(
    reveal.round_id === round.round_id &&
      reveal.job_id === bid.job_id &&
      reveal.job_version === bid.job_version &&
      reveal.draft_contract_root === bid.draft_contract_root &&
      reveal.bidder_principal_id === event.actor_id &&
      reveal.worker_seat_id === bid.worker_seat_id &&
      reveal.capability_offer_root === bid.capability_offer_root,
    "ERR_BID_CONTRACT_BINDING",
    "reveal binding mismatch",
  );
  const revealOffer = capabilityOfferByRoot(
    state,
    bid.capability_offer_root,
  );
  invariant(
    reveal.model_id === revealOffer?.model_id &&
      reveal.provider_family === revealOffer.provider_family &&
      reveal.operator_id === revealOffer.operator_id &&
      reveal.probe_root === revealOffer.probe_root,
    "ERR_BID_INELIGIBLE",
    "reveal capability declarations disagree with its offer",
  );
  invariant(
    bidCommitment(reveal) === bid.commitment,
    "ERR_BID_COMMITMENT",
    "bid reveal does not match commitment",
  );
  assertAmount(reveal.price);
  invariant(
    Number.isSafeInteger(reveal.completion_ticks) &&
      reveal.completion_ticks > 0,
    "ERR_BID_INELIGIBLE",
    "completion ticks must be positive",
  );
  updateRecord(state, "bids", bid.bid_id, "BID", {
    reveal_root: bidRevealRoot(reveal),
    reveal,
    status: "REVEALED",
  });
  return {
    jobId: bid.job_id,
    effects: [`revealed bid ${bid.bid_id}`],
  };
}

function processTick(state, event) {
  const clockController =
    state.controllers[state.principals[event.actor_id]?.controller_id];
  invariant(
    clockController?.scopes.includes("CLOCK_ADVANCER"),
    "ERR_CLOCK_AUTHORITY",
    "ADVANCE_TICK requires the explicit CLOCK_ADVANCER scope",
  );
  for (const job of Object.values(state.jobs)) {
    if (job.timeout_abort_required && !TERMINAL_STATES.has(job.state)) {
      fail(
        "ERR_HOLD_TIMEOUT_ABORT_REQUIRED",
        `${job.job_id} requires timeout abort before tick advance`,
      );
    }
  }
  invariant(
    Number.isSafeInteger(state.tick + 1),
    "ERR_TICK_STEP",
    "tick overflow",
  );
  state.tick = checkedAdd(state.tick, 1);
  const effects = [`advanced logical tick to ${state.tick}`];

  for (const round of Object.values(state.bid_rounds).sort((a, b) =>
    a.round_id.localeCompare(b.round_id),
  )) {
    if (["CLOSED", "REVOKED", "EXPIRED"].includes(round.status)) continue;
    if (round.status === "OPEN_COMMIT" && state.tick >= round.commit_close_tick) {
      updateRecord(state, "bid_rounds", round.round_id, "BID_ROUND", {
        status: "OPEN_REVEAL",
      });
      effects.push(`round ${round.round_id} entered reveal`);
    } else if (
      round.status === "OPEN_REVEAL" &&
      state.tick >= round.reveal_close_tick
    ) {
      updateRecord(state, "bid_rounds", round.round_id, "BID_ROUND", {
        status: "CLOSED",
      });
      effects.push(`round ${round.round_id} closed`);
    } else if (
      round.status === "SELECTED" &&
      state.tick >= round.acceptance_deadline_tick
    ) {
      const job = getJob(state, round.job_id);
      const bid = state.bids[job.selected_bid_id];
      returnSelectedBidLots(state, bid, job);
      updateRecord(state, "bids", bid.bid_id, "BID", { status: "EXPIRED" });
      updateRecord(state, "bid_rounds", round.round_id, "BID_ROUND", {
        status: "EXPIRED",
      });
      effects.push(`selected bid ${bid.bid_id} expired`);
    }
  }

  for (const job of Object.values(state.jobs).sort((a, b) =>
    a.job_id.localeCompare(b.job_id),
  )) {
    if (
      ["ACTIVE", "REVIEW"].includes(job.state) &&
      state.tick >= job.accepted_contract.work.deadline_tick
    ) {
      const holdRoot = enterTimedHold(
        state,
        job,
        "ERR_TASK_STALE",
        hash("NEXUS_DEADLINE_EVIDENCE_V1", {
          job_id: job.job_id,
          deadline_tick: job.accepted_contract.work.deadline_tick,
          observed_tick: state.tick,
        }),
      );
      effects.push(`job ${job.job_id} entered deadline HOLD ${holdRoot}`);
      continue;
    }
    if (
      job.state === "REVIEW" &&
      job.review_packet &&
      state.tick >= job.review_packet.expiry_tick
    ) {
      for (const assignmentId of job.review_assignment_ids) {
        const assignment = state.review_assignments[assignmentId];
        if (assignment?.status === "ASSIGNED") {
          updateRecord(
            state,
            "review_assignments",
            assignmentId,
            "REVIEW_ASSIGNMENT",
            { status: "EXPIRED" },
          );
        }
      }
      const holdRoot = enterTimedHold(
        state,
        state.jobs[job.job_id],
        "ERR_REVIEW_ASSIGNMENT_EXPIRED",
        job.review_packet_root,
      );
      effects.push(`job ${job.job_id} entered review-expiry HOLD ${holdRoot}`);
      continue;
    }
    if (
      job.state === "HOLD" &&
      job.hold_deadline_tick !== null &&
      state.tick >= job.hold_deadline_tick
    ) {
      updateRecord(state, "jobs", job.job_id, "JOB", {
        timeout_abort_required: true,
      });
      effects.push(`job ${job.job_id} requires hold-timeout abort`);
    }
    if (job.active_appeal_id) {
      const appeal = state.appeals[job.active_appeal_id];
      if (
        appeal?.status === "FILED" &&
        state.tick >= appeal.resolution_close_tick
      ) {
        const timeoutResolution = {
          schema: "nexus-appeal-timeout-resolution-v1",
          appeal_id: appeal.appeal_id,
          job_id: job.job_id,
          resolution: "ABORT",
          appeal_record_root: appeal.record_root,
          policy_root: job.accepted_contract.policy_root,
          resolution_tick: state.tick,
          reason_code: "ERR_APPEAL_RESOLUTION_EXPIRED",
        };
        const resolutionRoot = hash(
          "NEXUS_APPEAL_RESOLUTION_AUTHORITY_V1",
          timeoutResolution,
        );
        updateRecord(state, "appeals", appeal.appeal_id, "APPEAL", {
          status: "RESOLVED",
          resolution: "ABORT",
          resolution_root: resolutionRoot,
        });
        updateRecord(state, "jobs", job.job_id, "JOB", {
          active_appeal_id: null,
          timeout_abort_required: false,
          abort_authorization_root: resolutionRoot,
        });
        effects.push(
          `appeal ${appeal.appeal_id} resolved to timeout ABORT ${resolutionRoot}`,
        );
      }
    }
  }
  for (const assignment of Object.values(state.review_assignments).sort(
    (left, right) =>
      left.review_assignment_id.localeCompare(right.review_assignment_id),
  )) {
    if (assignment.status !== "ASSIGNED" || state.tick < assignment.expiry_tick) {
      continue;
    }
    updateRecord(
      state,
      "review_assignments",
      assignment.review_assignment_id,
      "REVIEW_ASSIGNMENT",
      { status: "EXPIRED" },
    );
    const job = state.jobs[assignment.job_id];
    if (job?.state === "REVIEW") {
      const holdRoot = enterTimedHold(
        state,
        job,
        "ERR_REVIEW_ASSIGNMENT_EXPIRED",
        state.review_assignments[assignment.review_assignment_id].record_root,
      );
      effects.push(`assignment ${assignment.review_assignment_id} expired into ${holdRoot}`);
    }
  }
  for (const lease of Object.values(state.leases).sort((a, b) =>
    a.lease_id.localeCompare(b.lease_id),
  )) {
    if (lease.status !== "ACTIVE" || state.tick < lease.expiry_tick) continue;
    updateRecord(state, "leases", lease.lease_id, "LEASE", {
      status: "EXPIRED",
    });
    const task = state.tasks[lease.task_id];
    if (task?.status === "LEASED") {
      updateRecord(state, "tasks", task.task_id, "TASK", {
        status: state.tick < task.deadline_tick ? "READY" : "EXPIRED",
      });
    }
    effects.push(`lease ${lease.lease_id} expired`);
  }
  return { jobId: null, effects };
}

function eligibleBidEntries(state, job, round) {
  return Object.values(state.bids)
    .filter(
      (bid) =>
        bid.round_id === round.round_id &&
        bid.status === "REVEALED" &&
        bid.job_version === job.version &&
        bid.draft_contract_root === job.draft_contract_root,
    )
    .map((bid) => ({ bid, reveal: bid.reveal }))
    .filter(({ bid, reveal }) => {
      const offer = capabilityOfferByRoot(state, bid.capability_offer_root);
      if (!offerSatisfiesContract(state, job, offer)) return false;
      if (
        reveal.model_id !== offer.model_id ||
        reveal.provider_family !== offer.provider_family ||
        reveal.operator_id !== offer.operator_id ||
        reveal.probe_root !== offer.probe_root
      ) return false;
      if (
        reveal.max_compute_units > offer.max_compute_units ||
        reveal.max_compute_units > job.draft_contract.work.max_compute_units
      ) return false;
      if (offer.offer_mode === "DONATED_CAPACITY" && reveal.price !== 0) {
        return false;
      }
      if (
        job.draft_contract.privacy.remote_execution === false &&
        offer.route !== "LOCAL"
      ) return false;
      if (!job.draft_contract.authority_ceiling.allowed_routes.includes(offer.route)) {
        return false;
      }
      if (reveal.price > job.draft_contract.settlement.lead_worker_amount_ceiling) {
        return false;
      }
      if (
        checkedAdd(state.tick, reveal.completion_ticks) >
        job.draft_contract.work.deadline_tick
      ) return false;
      return true;
    });
}

function handleSelectBid(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.requester_principal_id === event.actor_id && job.state === "OPEN",
    "ERR_AUTHORITY",
    "requester must select",
  );
  const round = state.bid_rounds[job.active_round_id];
  invariant(
    round?.status === "CLOSED" &&
      state.tick >= round.reveal_close_tick &&
      state.tick < round.acceptance_deadline_tick,
    "ERR_BID_PHASE",
    "selection window is closed",
  );
  const contributions = job.contribution_ids
    .map((id) => state.contributions[id])
    .filter((item) => item.status === "RESERVED");
  const lotIds = contributions.flatMap((item) => item.funding_lot_ids).sort();
  invariant(
    activeLotValue(state, lotIds) === job.draft_contract.work.budget,
    "ERR_FUNDING_TOTAL",
    "job must be exactly funded",
  );
  const entries = sortEligibleBids(eligibleBidEntries(state, job, round));
  invariant(entries.length > 0, "ERR_BID_INELIGIBLE", "no eligible bid");
  const winner = entries[0];
  invariant(
    !p.expected_bid_id || p.expected_bid_id === winner.bid.bid_id,
    "ERR_BID_INELIGIBLE",
    "requested bid is not deterministic winner",
  );
  const sponsorIds = contributions.map((item) => item.sponsor_principal_id);
  const contract = materializeContract({
    draft: job.draft_contract,
    roundId: round.round_id,
    bid: winner.bid,
    reveal: winner.reveal,
    contributionIds: contributions.map((item) => item.contribution_id),
    requesterPrincipalId: job.requester_principal_id,
    maintainerPrincipalId: job.maintainer_principal_id,
    sponsorPrincipalIds: sponsorIds,
  });
  assertFrozenContract(contract);
  const contractRoot = hash("NEXUS_CONTRACT_V1", contract);
  const required = checkedAdd(
    checkedAdd(
      contract.award.lead_worker_amount,
      checkedMultiply(
        contract.review.required_reviews,
        contract.settlement.reviewer_amount_each,
      ),
    ),
    checkedAdd(
      contract.work.max_subworker_budget,
      contract.work.fixed_verification_cost,
    ),
  );
  invariant(
    Number.isSafeInteger(required) && required <= contract.work.budget,
    "ERR_FUNDING_OBLIGATION",
    "contract obligations exceed budget",
  );

  const bidBefore = state.bids[winner.bid.bid_id];
  updateRecord(state, "bids", winner.bid.bid_id, "BID", {
    status: "SELECTED",
  });
  for (const contribution of contributions.sort((a, b) =>
    a.contribution_id.localeCompare(b.contribution_id),
  )) {
    const ids = [...contribution.funding_lot_ids];
    moveWholeLots(state, {
      lotIds: ids,
      sourceBucket: "CONTRIBUTION",
      sourceId: contribution.contribution_id,
      targetBucket: "BID",
      targetId: winner.bid.bid_id,
    });
    updateRecord(
      state,
      "contributions",
      contribution.contribution_id,
      "CONTRIBUTION",
      { status: "SELECTED_LOCK" },
    );
  }
  invariant(
    activeLotValue(state, state.bids[winner.bid.bid_id].funding_lot_ids) ===
      contract.work.budget,
    "ERR_FUNDING_TOTAL",
    "selected bid lock is incomplete",
  );
  updateRecord(state, "bid_rounds", round.round_id, "BID_ROUND", {
    status: "SELECTED",
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "PENDING_ACCEPT",
    selected_round_id: round.round_id,
    selected_bid_id: winner.bid.bid_id,
    candidate_contract: contract,
    candidate_contract_root: contractRoot,
  });
  return {
    jobId: job.job_id,
    effects: [
      `selected bid ${bidBefore.bid_id}`,
      `locked ${contract.work.budget} SIM_CREDIT`,
    ],
    result: {
      bid_id: winner.bid.bid_id,
      candidate_contract_root: contractRoot,
    },
  };
}

function handleUnselectBid(state, event, revoked = false) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  const bid = state.bids[job.selected_bid_id];
  invariant(job.state === "PENDING_ACCEPT" && bid, "ERR_BID_STALE", "no selection");
  if (revoked) {
    invariant(
      bid.bidder_principal_id === event.actor_id,
      "ERR_AUTHORITY",
      "only selected bidder may revoke",
    );
  } else {
    invariant(
      job.requester_principal_id === event.actor_id,
      "ERR_AUTHORITY",
      "only requester may unselect",
    );
  }
  returnSelectedBidLots(state, bid, job);
  updateRecord(state, "bids", bid.bid_id, "BID", {
    status: revoked ? "REVOKED" : "REVEALED",
  });
  updateRecord(state, "bid_rounds", bid.round_id, "BID_ROUND", {
    status: "CLOSED",
  });
  return {
    jobId: job.job_id,
    effects: [`${revoked ? "revoked" : "unselected"} bid ${bid.bid_id}`],
  };
}

function handleAcceptBid(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  const bid = state.bids[job.selected_bid_id];
  const round = state.bid_rounds[job.selected_round_id];
  invariant(
    job.state === "PENDING_ACCEPT" &&
      bid?.bidder_principal_id === event.actor_id,
    "ERR_AUTHORITY",
    "selected worker must accept",
  );
  const leadComputeUnits = job.candidate_contract.award.lead_max_compute_units;
  invariant(
    leadComputeUnits <= job.candidate_contract.work.max_compute_units,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "lead compute reservation exceeds aggregate contract ceiling",
  );
  assertFrozenContract(job.candidate_contract);
  assertOfferSatisfiesContract(
    state,
    job,
    capabilityOfferByRoot(state, bid.capability_offer_root),
  );
  invariant(
    state.tick < round.acceptance_deadline_tick,
    "ERR_BID_ACCEPTANCE_EXPIRED",
    "acceptance deadline expired",
  );
  invariant(
    p.candidate_contract_root === job.candidate_contract_root &&
      hash("NEXUS_CONTRACT_V1", job.candidate_contract) ===
        job.candidate_contract_root,
    "ERR_BID_CONTRACT_BINDING",
    "worker did not accept exact candidate contract",
  );
  const lotIds = [...bid.funding_lot_ids];
  moveWholeLots(state, {
    lotIds,
    sourceBucket: "BID",
    sourceId: bid.bid_id,
    targetBucket: "JOB",
    targetId: job.job_id,
  });
  for (const contributionId of job.contribution_ids) {
    const contribution = state.contributions[contributionId];
    if (contribution.status === "SELECTED_LOCK") {
      updateRecord(
        state,
        "contributions",
        contributionId,
        "CONTRIBUTION",
        {
          status:
            contribution.kind === "DONATION_INTENT" ? "ACCEPTED" : "LOCKED",
        },
      );
    }
  }
  const taskId = creationId(event, {
    prefix: "TASK",
    objectType: "TASK",
    naturalKey: { job_id: job.job_id, kind: "LEAD", attempt: 1 },
    parentIds: [job.job_id],
    nonce: `${event.nonce}:lead`,
  });
  putNewRecord(state, "tasks", "task_id", taskId, "TASK", {
    job_id: job.job_id,
    attempt: 1,
    kind: "LEAD",
    phase_rank: 10,
    priority: 10,
    dependencies: [],
    context_root: job.candidate_contract.task.context_root,
    input_manifest_root: job.candidate_contract.task.source_root,
    output_schema_root: job.candidate_contract.task.acceptance_root,
    data_class: job.candidate_contract.privacy.data_class,
    required_capabilities: [],
    earliest_tick: state.tick,
    deadline_tick: job.candidate_contract.work.deadline_tick,
    max_compute_units: leadComputeUnits,
    max_input_bytes: 0,
    max_output_bytes: job.candidate_contract.task.maximum_artifact_bytes,
    concurrency_group: "lead",
    conflict_set: [],
    review_requirement: "MODEL_TRIAD",
    terminal_behavior: "HOLD",
    status: "READY",
  });
  updateRecord(state, "bids", bid.bid_id, "BID", { status: "ACCEPTED" });
  updateRecord(state, "bid_rounds", round.round_id, "BID_ROUND", {
    status: "ACCEPTED",
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "ACTIVE",
    accepted_contract: job.candidate_contract,
    accepted_contract_root: job.candidate_contract_root,
    accepted_worker_seat: bid.worker_seat_id,
    accepted_worker_principal_id: bid.bidder_principal_id,
    attempt: 1,
    task_ids: [taskId],
    compute_units_reserved: leadComputeUnits,
  });
  return {
    jobId: job.job_id,
    effects: [
      `accepted contract ${job.candidate_contract_root}`,
      `created lead task ${taskId}`,
    ],
    result: { task_id: taskId },
  };
}

function handleIssueLease(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  assertSafeNonNegativeInteger(p.not_before_tick, "lease not-before tick");
  assertSafeNonNegativeInteger(p.expiry_tick, "lease expiry tick");
  invariant(
    job.state === "ACTIVE" &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_AUTHORITY",
    "actor cannot issue a lease",
  );
  const task = state.tasks[p.task_id];
  invariant(
    task?.job_id === job.job_id &&
      task.status === "READY" &&
      task.attempt === job.attempt,
    "ERR_TASK_STALE",
    "task is not ready for this job attempt",
  );
  const commitment = Object.values(state.subwork_commitments).find(
    (item) => item.task_id === task.task_id && item.status === "AUTHORIZED",
  );
  const award = job.accepted_contract.award;
  const expectedPrincipalId =
    task.kind === "LEAD"
      ? award.worker_principal_id
      : commitment?.recipient_principal_id;
  const expectedSeatId =
    task.kind === "LEAD" ? award.worker_seat_id : commitment?.recipient_seat_id;
  const offerRoot =
    task.kind === "LEAD"
      ? award.capability_offer_root
      : commitment?.capability_offer_root;
  const offer = capabilityOfferByRoot(state, offerRoot);
  invariant(
    offer &&
      !state.revoked_offer_ids[offer.offer_id] &&
      offer.principal_id === expectedPrincipalId &&
      offer.worker_seat_id === expectedSeatId &&
      state.tick >= offer.not_before_tick &&
      state.tick < offer.expiry_tick,
    "ERR_CAPABILITY",
    "accepted worker offer is not lease-eligible",
  );
  assertOfferSatisfiesContract(state, job, offer, task);
  invariant(
    p.not_before_tick === state.tick &&
      Number.isSafeInteger(p.expiry_tick) &&
      p.expiry_tick > state.tick &&
      p.expiry_tick <= task.deadline_tick &&
      p.expiry_tick <= offer.expiry_tick,
    "ERR_TICK",
    "lease window is invalid",
  );
  invariant(
    p.context_root === task.context_root &&
      p.input_manifest_root === task.input_manifest_root,
    "ERR_TASK_STALE",
    "lease input binding is stale",
  );
  const activeSeatLeases = Object.values(state.leases).filter(
    (lease) =>
      lease.worker_seat_id === offer.worker_seat_id &&
      lease.status === "ACTIVE",
  ).length;
  invariant(
    activeSeatLeases < offer.max_active_leases,
    "ERR_CAPABILITY",
    "worker seat lease ceiling is exhausted",
  );
  const leaseId = creationId(event, {
    prefix: "LEASE",
    objectType: "LEASE",
    naturalKey: {
      job_id: job.job_id,
      task_id: task.task_id,
      attempt: task.attempt,
      worker_seat_id: offer.worker_seat_id,
    },
    parentIds: [job.job_id, task.task_id],
    nonce: p.lease_nonce,
  });
  const lease = putNewRecord(
    state,
    "leases",
    "lease_id",
    leaseId,
    "LEASE",
    {
      job_id: job.job_id,
      task_id: task.task_id,
      attempt: task.attempt,
      worker_principal_id: offer.principal_id,
      worker_seat_id: offer.worker_seat_id,
      capability_offer_root: offerRoot,
      context_root: task.context_root,
      input_manifest_root: task.input_manifest_root,
      data_class: task.data_class,
      route: offer.route,
      tools: [...offer.tools],
      runtimes: [...offer.runtimes],
      egress_allowlist: [...offer.egress_allowlist],
      isolation_root: offer.isolation_root,
      maximum_capability_root: offer.maximum_capability_root,
      not_before_tick: p.not_before_tick,
      expiry_tick: p.expiry_tick,
      nonce: p.lease_nonce,
      policy_root: job.accepted_contract.policy_root,
      work_return_id: null,
      work_return: null,
      status: "ACTIVE",
    },
  );
  updateRecord(state, "tasks", task.task_id, "TASK", { status: "LEASED" });
  return {
    jobId: job.job_id,
    effects: [`issued lease ${leaseId} for task ${task.task_id}`],
    result: { lease_id: leaseId, lease_root: lease.record_root },
  };
}

function handleSubmitLeaseReturn(state, event) {
  const p = event.payload;
  const lease = state.leases[p.lease_id];
  invariant(lease, "ERR_TASK_STALE", "lease is missing");
  const job = getJob(state, lease.job_id);
  const task = state.tasks[lease.task_id];
  invariant(
    job.state === "ACTIVE" &&
      task?.status === "LEASED" &&
      lease.status === "ACTIVE" &&
      lease.worker_principal_id === event.actor_id &&
      state.tick >= lease.not_before_tick &&
      state.tick < lease.expiry_tick,
    "ERR_TASK_STALE",
    "lease return is stale or unauthorized",
  );
  invariant(
    p.lease_root === lease.record_root &&
      p.task_id === task.task_id &&
      p.job_id === job.job_id &&
      p.attempt === task.attempt &&
      p.worker_seat_id === lease.worker_seat_id,
    "ERR_TASK_STALE",
    "work return lease binding mismatch",
  );
  for (const [name, value] of Object.entries({
    source_root: p.source_root,
    artifact_root: p.artifact_root,
    manifest_root: p.manifest_root,
    contribution_terms_root: p.contribution_terms_root,
    worker_acknowledgement_root: p.worker_acknowledgement_root,
    attribution_record_root: p.attribution_record_root,
    commands_root: p.commands_root,
  })) {
    invariant(
      typeof value === "string" && value.length > 0,
      "ERR_ARTIFACT_MISMATCH",
      `${name} is required`,
    );
  }
  invariant(
    p.contribution_terms_root ===
      job.accepted_contract.rights.contribution_terms_root,
    "ERR_RIGHTS_UNRESOLVED",
    "work return changed contribution terms",
  );
  const workReturn = {
    schema: "nexus-work-return-v1",
    task_id: task.task_id,
    job_id: job.job_id,
    attempt: task.attempt,
    worker_seat_id: lease.worker_seat_id,
    lease_root: lease.record_root,
    source_root: p.source_root,
    artifact_root: p.artifact_root,
    manifest_root: p.manifest_root,
    contribution_terms_root: p.contribution_terms_root,
    worker_acknowledgement_root: p.worker_acknowledgement_root,
    attribution_record_root: p.attribution_record_root,
    observations: [...p.observations],
    commands_root: p.commands_root,
    nonce: p.return_nonce,
  };
  const returnId = rootId("RETURN", "NEXUS_WORK_PACKET_V1", workReturn);
  updateRecord(state, "leases", lease.lease_id, "LEASE", {
    work_return_id: returnId,
    work_return: workReturn,
    status: "RETURNED",
  });
  updateRecord(state, "tasks", task.task_id, "TASK", { status: "RETURNED" });
  return {
    jobId: job.job_id,
    effects: [`accepted lease return candidate ${returnId}`],
    result: { work_return_id: returnId },
  };
}

function createPayout(state, event, {
  job,
  recipientAccountId,
  kind,
  amount,
  evidenceRoot,
  sourceRecordId,
  sourceBucket,
  sourceId,
  payoutNonce,
  exactLotIds = null,
}) {
  assertAmount(amount);
  const recipient = getAccount(state, recipientAccountId);
  invariant(
    recipient.status === "ACTIVE",
    "ERR_FUNDING_LOT_OWNER",
    "payout recipient account is not active",
  );
  if (amount === 0) return null;
  const payoutId = creationId(event, {
    prefix: "PAYOUT",
    objectType: "PAYOUT",
    naturalKey: {
      job_id: job.job_id,
      recipient_account_id: recipientAccountId,
      kind,
      source_record_id: sourceRecordId,
    },
    parentIds: [job.job_id, sourceRecordId],
    nonce: payoutNonce,
  });
  putNewRecord(state, "payouts", "payout_id", payoutId, "PAYOUT", {
    job_id: job.job_id,
    recipient_account_id: recipientAccountId,
    kind,
    amount,
    funding_lot_ids: [],
    evidence_root: evidenceRoot,
    source_record_id: sourceRecordId,
    dispute_status: "UNDISPUTED",
    status: "PENDING",
  });
  if (exactLotIds === null) {
    allocateLots(state, event, {
      sourceBucket,
      sourceId,
      targetBucket: "PAYOUT",
      targetId: payoutId,
      amount,
      allocationNonce: payoutNonce,
    });
  } else {
    const sorted = [...exactLotIds].sort();
    invariant(
      new Set(sorted).size === sorted.length &&
        activeLotValue(state, sorted) === amount,
      "ERR_FUNDING_LOT_OWNER",
      "exact payout funding lots are invalid",
    );
    moveWholeLots(state, {
      lotIds: sorted,
      sourceBucket,
      sourceId,
      targetBucket: "PAYOUT",
      targetId: payoutId,
    });
  }
  const currentJob = state.jobs[job.job_id];
  updateRecord(state, "jobs", job.job_id, "JOB", {
    payout_ids: [...currentJob.payout_ids, payoutId].sort(),
  });
  return payoutId;
}

function handleIssueAllowance(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(job.state === "ACTIVE", "ERR_ALLOWANCE_SCOPE", "job is not active");
  const contract = job.accepted_contract;
  invariant(
    contract.decision_authority.settlement_principal_ids.includes(event.actor_id),
    "ERR_AUTHORITY",
    "actor cannot issue allowance",
  );
  assertAmount(p.amount, { positive: true });
  invariant(
    Number.isSafeInteger(p.not_before_tick) &&
      p.not_before_tick >= state.tick &&
      Number.isSafeInteger(p.expiry_tick) &&
      p.not_before_tick < p.expiry_tick &&
      p.expiry_tick <= contract.work.deadline_tick,
    "ERR_ALLOWANCE_EXPIRED",
    "invalid allowance window",
  );
  invariant(
    checkedAdd(job.subworker_budget_allocated, p.amount) <=
      contract.work.max_subworker_budget,
    "ERR_ALLOWANCE_SCOPE",
    "aggregate sub-worker budget exceeded",
  );
  const postJobLots = checkedSubtract(
    activeLotValue(state, job.funding_lot_ids),
    p.amount,
  );
  invariant(
    postJobLots >= mandatoryJobReserve(job, contract),
    "ERR_FUNDING_OBLIGATION",
    "allowance would consume mandatory reserve",
  );
  const allowanceId = creationId(event, {
    prefix: "ALLOW",
    objectType: "ALLOWANCE",
    naturalKey: {
      job_id: job.job_id,
      issuer_principal_id: event.actor_id,
      agent_seat_id: p.agent_seat_id,
      purpose: p.purpose,
    },
    parentIds: [job.job_id],
    nonce: p.allowance_nonce,
  });
  putNewRecord(state, "allowances", "allowance_id", allowanceId, "ALLOWANCE", {
    issuer_principal_id: event.actor_id,
    agent_seat_id: p.agent_seat_id,
    job_id: job.job_id,
    purpose: p.purpose,
    amount_ceiling: p.amount,
    funding_lot_ids: [],
    subwork_commitment_ids: [],
    recipient_class: "REGISTERED_SUBWORKER",
    not_before_tick: p.not_before_tick,
    expiry_tick: p.expiry_tick,
    nonce: p.allowance_nonce,
    policy_root: contract.policy_root,
    redelegation: false,
    status: "ACTIVE",
  });
  allocateLots(state, event, {
    sourceBucket: "JOB",
    sourceId: job.job_id,
    targetBucket: "ALLOWANCE",
    targetId: allowanceId,
    amount: p.amount,
    allocationNonce: `${p.allowance_nonce}:funding`,
  });
  const currentJob = state.jobs[job.job_id];
  updateRecord(state, "jobs", job.job_id, "JOB", {
    allowance_ids: [...currentJob.allowance_ids, allowanceId].sort(),
    subworker_budget_allocated: checkedAdd(
      currentJob.subworker_budget_allocated,
      p.amount,
    ),
  });
  return {
    jobId: job.job_id,
    effects: [`issued allowance ${allowanceId} for ${p.amount}`],
    result: { allowance_id: allowanceId },
  };
}

function selectAllowanceFunding(state, event, allowance, commitmentId, amount) {
  const bound = new Set(
    allowance.subwork_commitment_ids.flatMap((commitmentIdValue) => {
      const commitment = state.subwork_commitments[commitmentIdValue];
      return commitment?.status === "AUTHORIZED"
        ? commitment.funding_lot_ids
        : [];
    }),
  );
  const availableLots = allowance.funding_lot_ids
    .filter((lotId) => !bound.has(lotId))
    .map((lotId) => state.funding_lots[lotId]);
  const allocation = largestRemainderAllocation(availableLots, amount);
  const selected = [];
  const added = [];
  for (const [index, item] of allocation.entries()) {
    const lot = state.funding_lots[item.lot_id];
    if (item.amount === lot.amount) {
      selected.push(lot.lot_id);
      continue;
    }
    updateRecord(state, "funding_lots", lot.lot_id, "FUNDING_LOT", {
      amount: checkedSubtract(lot.amount, item.amount),
    });
    const childId = creationId(event, {
      prefix: "LOT",
      objectType: "FUNDING_LOT",
      naturalKey: {
        source_contribution_id: lot.source_contribution_id,
        parent_lot_id: lot.lot_id,
        commitment_id: commitmentId,
        split_index: index,
      },
      parentIds: [lot.lot_id, allowance.allowance_id],
      nonce: `${commitmentId}:reserve:${index}`,
    });
    putNewRecord(
      state,
      "funding_lots",
      "lot_id",
      childId,
      "FUNDING_LOT",
      {
        source_contribution_id: lot.source_contribution_id,
        source_account_id: lot.source_account_id,
        contribution_kind: lot.contribution_kind,
        amount: item.amount,
        bucket: "ALLOWANCE",
        bucket_id: allowance.allowance_id,
        parent_lot_id: lot.lot_id,
        status: "ACTIVE",
      },
    );
    selected.push(childId);
    added.push(childId);
  }
  if (added.length > 0) {
    const current = state.allowances[allowance.allowance_id];
    updateRecord(state, "allowances", allowance.allowance_id, "ALLOWANCE", {
      funding_lot_ids: [...current.funding_lot_ids, ...added].sort(),
    });
  }
  return selected.sort();
}

function handleAuthorizeSubwork(state, event) {
  const p = event.payload;
  const allowance = state.allowances[p.allowance_id];
  invariant(allowance, "ERR_ALLOWANCE_SCOPE", "allowance is missing");
  const job = getJob(state, allowance.job_id);
  for (const [label, value] of [
    ["subwork expiry tick", p.expiry_tick],
    ["subwork phase rank", p.phase_rank],
    ["subwork priority", p.priority],
    ["subwork maximum compute units", p.max_compute_units],
    ["subwork maximum input bytes", p.max_input_bytes],
    ["subwork maximum output bytes", p.max_output_bytes],
  ]) {
    assertSafeNonNegativeInteger(value, label);
  }
  invariant(
    job.state === "ACTIVE" &&
      allowance.status === "ACTIVE" &&
      allowance.issuer_principal_id === event.actor_id,
    "ERR_ALLOWANCE_SCOPE",
    "allowance is not active for actor",
  );
  const subworkerOffer = capabilityOfferByRoot(
    state,
    p.capability_offer_root,
  );
  invariant(
    subworkerOffer?.principal_id === p.recipient_principal_id &&
      subworkerOffer.worker_seat_id === p.recipient_seat_id,
    "ERR_CAPABILITY",
    "sub-work recipient/offer binding mismatch",
  );
  invariant(
    state.tick >= allowance.not_before_tick &&
      state.tick < allowance.expiry_tick,
    "ERR_ALLOWANCE_EXPIRED",
    "allowance is outside its window",
  );
  assertAmount(p.amount, { positive: true });
  invariant(
    job.subwork_commitment_ids.length <
      job.accepted_contract.work.max_subworkers,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "maximum subworker count is exhausted",
  );
  const nextComputeUnits = checkedAdd(
    job.compute_units_reserved,
    p.max_compute_units,
  );
  invariant(
    nextComputeUnits <= job.accepted_contract.work.max_compute_units,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "subwork exceeds aggregate compute ceiling",
  );
  const boundValue = allowance.subwork_commitment_ids.reduce(
    (sum, id) => {
      const commitment = state.subwork_commitments[id];
      return commitment?.status === "AUTHORIZED"
        ? checkedAdd(sum, commitment.amount)
        : sum;
    },
    0,
  );
  invariant(
    p.amount <= checkedSubtract(allowance.amount_ceiling, boundValue),
    "ERR_ALLOWANCE_UNCOMMITTED",
    "allowance uncommitted amount is insufficient",
  );
  invariant(
    job.accepted_contract.authority_ceiling.allowed_worker_principal_ids.includes(
      p.recipient_principal_id,
    ),
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "sub-worker principal exceeds contract ceiling",
  );
  const commitmentId = creationId(event, {
    prefix: "SUBWORK",
    objectType: "SUBWORK_COMMITMENT",
    naturalKey: {
      allowance_id: allowance.allowance_id,
      job_id: job.job_id,
      recipient_seat_id: p.recipient_seat_id,
      capability_offer_root: p.capability_offer_root,
      task_nonce: p.task_nonce,
    },
    parentIds: [allowance.allowance_id, job.job_id],
    nonce: p.commitment_nonce,
  });
  const lotIds = selectAllowanceFunding(
    state,
    event,
    state.allowances[allowance.allowance_id],
    commitmentId,
    p.amount,
  );
  const taskId = creationId(event, {
    prefix: "TASK",
    objectType: "TASK",
    naturalKey: {
      job_id: job.job_id,
      kind: p.task_kind,
      attempt: job.attempt,
      task_nonce: p.task_nonce,
    },
    parentIds: [job.job_id, allowance.allowance_id],
    nonce: p.task_nonce,
  });
  putNewRecord(
    state,
    "subwork_commitments",
    "subwork_commitment_id",
    commitmentId,
    "SUBWORK_COMMITMENT",
    {
      allowance_id: allowance.allowance_id,
      job_id: job.job_id,
      task_id: taskId,
      recipient_principal_id: p.recipient_principal_id,
      recipient_seat_id: p.recipient_seat_id,
      capability_offer_root: p.capability_offer_root,
      amount: p.amount,
      funding_lot_ids: lotIds,
      evidence_requirement_root: p.evidence_requirement_root,
      created_tick: state.tick,
      expiry_tick: Math.min(p.expiry_tick, allowance.expiry_tick),
      status: "AUTHORIZED",
    },
  );
  putNewRecord(state, "tasks", "task_id", taskId, "TASK", {
    job_id: job.job_id,
    attempt: job.attempt,
    kind: p.task_kind,
    phase_rank: p.phase_rank,
    priority: p.priority,
    dependencies: [...p.dependencies].sort(),
    context_root: p.context_root,
    input_manifest_root: p.input_manifest_root,
    output_schema_root: p.output_schema_root,
    data_class: job.accepted_contract.privacy.data_class,
    required_capabilities: [...p.required_capabilities].sort(),
    earliest_tick: state.tick,
    deadline_tick: Math.min(p.expiry_tick, allowance.expiry_tick),
    max_compute_units: p.max_compute_units,
    max_input_bytes: p.max_input_bytes,
    max_output_bytes: p.max_output_bytes,
    concurrency_group: p.concurrency_group,
    conflict_set: [...p.conflict_set].sort(),
    review_requirement: p.review_requirement,
    terminal_behavior: p.terminal_behavior,
    status: "READY",
  });
  assertOfferSatisfiesContract(
    state,
    job,
    subworkerOffer,
    state.tasks[taskId],
  );
  const currentAllowance = state.allowances[allowance.allowance_id];
  updateRecord(state, "allowances", allowance.allowance_id, "ALLOWANCE", {
    subwork_commitment_ids: [
      ...currentAllowance.subwork_commitment_ids,
      commitmentId,
    ].sort(),
  });
  const currentJob = state.jobs[job.job_id];
  updateRecord(state, "jobs", job.job_id, "JOB", {
    subwork_commitment_ids: [
      ...currentJob.subwork_commitment_ids,
      commitmentId,
    ].sort(),
    task_ids: [...currentJob.task_ids, taskId].sort(),
    compute_units_reserved: nextComputeUnits,
  });
  return {
    jobId: job.job_id,
    effects: [`authorized sub-work ${commitmentId}`, `created task ${taskId}`],
    result: { commitment_id: commitmentId, task_id: taskId },
  };
}

function handleAcceptSubworkReturn(state, event) {
  const p = event.payload;
  const commitment = state.subwork_commitments[p.commitment_id];
  invariant(commitment, "ERR_SUBWORK_EVIDENCE", "commitment is missing");
  const job = getJob(state, commitment.job_id);
  const allowance = state.allowances[commitment.allowance_id];
  const lease = state.leases[p.lease_id];
  const task = state.tasks[commitment.task_id];
  invariant(
    commitment.status === "AUTHORIZED" &&
      allowance.issuer_principal_id === event.actor_id &&
      state.tick < commitment.expiry_tick &&
      lease?.task_id === commitment.task_id &&
      lease.status === "RETURNED" &&
      task?.status === "RETURNED" &&
      p.work_return_id === lease.work_return_id &&
      p.artifact_root === lease.work_return.artifact_root,
    "ERR_SUBWORK_EVIDENCE",
    "sub-work commitment is not acceptable",
  );
  const expectedEvidenceRoot = hash("NEXUS_SUBWORK_EVIDENCE_V1", {
    schema: "nexus-subwork-evidence-v1",
    commitment_id: commitment.subwork_commitment_id,
    task_id: commitment.task_id,
    lease_root: lease.work_return.lease_root,
    work_return_id: lease.work_return_id,
    artifact_root: lease.work_return.artifact_root,
    evidence_requirement_root: commitment.evidence_requirement_root,
  });
  invariant(
    p.evidence_root === expectedEvidenceRoot,
    "ERR_SUBWORK_EVIDENCE",
    "sub-work evidence root mismatch",
  );
  invariant(
    [...p.funding_lot_ids].sort().join("\u0000") ===
      [...commitment.funding_lot_ids].sort().join("\u0000"),
    "ERR_FUNDING_LOT_OWNER",
    "sub-work payout did not bind the exact commitment lots",
  );
  const recipient = getAccount(state, p.recipient_account_id);
  invariant(
    ownsAccount(state, commitment.recipient_principal_id, recipient),
    "ERR_AUTHORITY",
    "sub-worker payout account mismatch",
  );
  const payoutId = createPayout(state, event, {
    job,
    recipientAccountId: recipient.account_id,
    kind: "SUBWORK",
    amount: commitment.amount,
    evidenceRoot: p.evidence_root,
    sourceRecordId: commitment.subwork_commitment_id,
    sourceBucket: "ALLOWANCE",
    sourceId: allowance.allowance_id,
    payoutNonce: `${event.nonce}:subwork`,
    exactLotIds: p.funding_lot_ids,
  });
  updateRecord(
    state,
    "subwork_commitments",
    commitment.subwork_commitment_id,
    "SUBWORK_COMMITMENT",
    { status: "ACCRUED" },
  );
  updateRecord(state, "tasks", commitment.task_id, "TASK", {
    status: "ACCEPTED",
  });
  updateRecord(state, "leases", lease.lease_id, "LEASE", {
    status: "ACCEPTED",
  });
  const currentAllowance = state.allowances[allowance.allowance_id];
  if (activeLotValue(state, currentAllowance.funding_lot_ids) === 0) {
    updateRecord(state, "allowances", allowance.allowance_id, "ALLOWANCE", {
      status: "EXHAUSTED",
    });
  }
  return {
    jobId: job.job_id,
    effects: [
      `accepted sub-work ${commitment.subwork_commitment_id}`,
      `accrued payout ${payoutId}`,
    ],
    result: { payout_id: payoutId },
  };
}

function handleAcceptLeadReturn(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.state === "ACTIVE" &&
      !job.lead_payout_accrued &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_TASK_STALE",
    "lead return cannot be accepted",
  );
  const lease = state.leases[p.lease_id];
  const leadTask = lease ? state.tasks[lease.task_id] : null;
  invariant(
    lease?.job_id === job.job_id &&
      lease.status === "RETURNED" &&
      leadTask?.kind === "LEAD" &&
      leadTask.status === "RETURNED" &&
      p.work_return_id === lease.work_return_id,
    "ERR_TASK_STALE",
    "lead lease return is not acceptable",
  );
  const workReturn = lease.work_return;
  const workerAccount = getAccount(state, p.recipient_account_id);
  invariant(
    ownsAccount(state, job.accepted_worker_principal_id, workerAccount),
    "ERR_AUTHORITY",
    "lead payout account mismatch",
  );
  for (const [name, value] of Object.entries({
    source_root: p.source_root,
    artifact_root: p.artifact_root,
    manifest_root: p.manifest_root,
    contribution_terms_root: p.contribution_terms_root,
    worker_acknowledgement_root: p.worker_acknowledgement_root,
    attribution_record_root: p.attribution_record_root,
  })) {
    invariant(
      typeof value === "string" && value.length > 0,
      "ERR_ARTIFACT_MISMATCH",
      `${name} is required`,
    );
  }
  invariant(
    p.contribution_terms_root ===
      job.accepted_contract.rights.contribution_terms_root,
    "ERR_RIGHTS_UNRESOLVED",
    "lead contribution terms changed",
  );
  invariant(
    p.source_root === workReturn.source_root &&
      p.artifact_root === workReturn.artifact_root &&
      p.manifest_root === workReturn.manifest_root &&
      p.contribution_terms_root === workReturn.contribution_terms_root &&
      p.worker_acknowledgement_root ===
        workReturn.worker_acknowledgement_root &&
      p.attribution_record_root === workReturn.attribution_record_root,
    "ERR_ARTIFACT_MISMATCH",
    "accepted lead roots do not match the lease return",
  );
  const payoutId = createPayout(state, event, {
    job,
    recipientAccountId: workerAccount.account_id,
    kind: "LEAD_WORK",
    amount: job.accepted_contract.award.lead_worker_amount,
    evidenceRoot: p.artifact_root,
    sourceRecordId: leadTask.task_id,
    sourceBucket: "JOB",
    sourceId: job.job_id,
    payoutNonce: `${event.nonce}:lead`,
  });
  updateRecord(state, "tasks", leadTask.task_id, "TASK", {
    status: "ACCEPTED",
  });
  updateRecord(state, "leases", lease.lease_id, "LEASE", {
    status: "ACCEPTED",
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    lead_payout_accrued: true,
    final_source_root: p.source_root,
    final_artifact_root: p.artifact_root,
    final_manifest_root: p.manifest_root,
  });
  return {
    jobId: job.job_id,
    effects: [`accepted lead artifact ${p.artifact_root}`, `accrued ${payoutId}`],
    result: { payout_id: payoutId },
  };
}

function requiredCheckManifestRoot(manifest) {
  assertExactObjectKeys(
    manifest,
    [
      "schema",
      "job_id",
      "contract_root",
      "artifact_root",
      "manifest_root",
      "verifier_root",
      "policy_root",
      "environment_root",
      "ordered_check_names",
    ],
    [],
    "required check manifest",
  );
  invariant(
    manifest.schema === "nexus-required-check-manifest-v1",
    "ERR_DETERMINISTIC_RED",
    "unsupported required check manifest",
  );
  assertSortedUniqueStrings(
    manifest.ordered_check_names,
    "required check manifest names",
    { minItems: 1, maxItems: 32 },
  );
  return hash("NEXUS_REQUIRED_CHECK_MANIFEST_V1", manifest);
}

function verifierExecutionReceiptAnchorRoot(anchor) {
  assertExactObjectKeys(
    anchor,
    [
      "schema",
      "job_id",
      "contract_root",
      "artifact_root",
      "manifest_root",
      "policy_root",
      "required_check_manifest_root",
      "verifier_principal_id",
      "verifier_controller_id",
      "execution_receipt_root",
    ],
    [],
    "verifier execution receipt anchor",
  );
  invariant(
    anchor.schema === "nexus-verifier-execution-receipt-anchor-v1",
    "ERR_DETERMINISTIC_RED",
    "unsupported verifier execution receipt anchor",
  );
  for (const [label, root] of Object.entries(anchor)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return hash(
    "NEXUS_VERIFIER_EXECUTION_RECEIPT_ANCHOR_V1",
    anchor,
  );
}

function verifierAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "schema",
      "job_id",
      "contract_root",
      "artifact_root",
      "policy_root",
      "required_check_manifest_root",
      "verifier_root",
      "verifier_principal_id",
      "verifier_controller_id",
      "verifier_key_id",
      "controller_status",
      "eligibility",
      "verification_recipient_account_id",
      "execution_receipt_anchor_root",
    ],
    [],
    "verifier authority",
  );
  invariant(
    authority.schema === "nexus-verifier-authority-v1" &&
      authority.controller_status === "ACTIVE" &&
      authority.eligibility === "ELIGIBLE",
    "ERR_DETERMINISTIC_RED",
    "unsupported or inactive verifier authority",
  );
  for (const [label, root] of Object.entries(authority)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return hash("NEXUS_VERIFIER_AUTHORITY_V1", authority);
}

function validateDeterministicEvidence(state, job, event, payload) {
  const requiredManifest = payload.required_check_manifest;
  const requiredRoot = requiredCheckManifestRoot(requiredManifest);
  invariant(
    payload.expected_required_check_manifest_root === requiredRoot &&
      requiredManifest.job_id === job.job_id &&
      requiredManifest.contract_root === job.accepted_contract_root &&
      requiredManifest.artifact_root === job.final_artifact_root &&
      requiredManifest.manifest_root === job.final_manifest_root &&
      requiredManifest.verifier_root === job.accepted_contract.verifier_root &&
      requiredManifest.policy_root === job.accepted_contract.policy_root &&
      requiredManifest.environment_root ===
        job.accepted_contract.work.check_environment_root &&
      requiredManifest.ordered_check_names.join("\u0000") ===
        job.accepted_contract.work.required_check_names.join("\u0000"),
    "ERR_DETERMINISTIC_RED",
    "required check manifest is not the frozen contract manifest",
  );
  const manifest = payload.check_manifest;
  assertExactObjectKeys(
    manifest,
    ["schema", "job_id", "contract_root", "artifact_root", "manifest_root", "verifier_root", "policy_root", "environment_root", "checks"],
    [],
    "deterministic check manifest",
  );
  invariant(
    manifest.schema === "nexus-deterministic-check-manifest-v1" &&
      manifest.job_id === job.job_id &&
      manifest.contract_root === job.accepted_contract_root &&
      manifest.artifact_root === job.final_artifact_root &&
      manifest.manifest_root === job.final_manifest_root &&
      manifest.verifier_root === job.accepted_contract.verifier_root &&
      manifest.policy_root === job.accepted_contract.policy_root &&
      manifest.environment_root === job.accepted_contract.work.check_environment_root,
    "ERR_ARTIFACT_MISMATCH",
    "deterministic manifest binding mismatch",
  );
  assertBoundedArray(manifest.checks, "deterministic checks", {
    minItems: 1,
    maxItems: 32,
  });
  const checkNames = [];
  const checkRoots = [];
  let allPassed = true;
  for (const [index, check] of manifest.checks.entries()) {
    assertExactObjectKeys(
      check,
      ["schema", "check_name", "contract_root", "artifact_root", "manifest_root", "verifier_root", "policy_root", "required_check_manifest_root", "verifier_authority_root", "execution_receipt_anchor_root", "command", "environment_root", "exit_code", "stdout_root", "stderr_root", "reason_codes", "status"],
      [],
      `deterministic check ${index}`,
    );
    assertBoundedArray(check.command, `check ${index} command`, {
      minItems: 1,
      maxItems: 32,
    });
    for (const [argumentIndex, argument] of check.command.entries()) {
      assertBoundedString(
        argument,
        `check ${index} command argument ${argumentIndex}`,
        { maxBytes: 4096 },
      );
    }
    assertSortedUniqueStrings(check.reason_codes, `check ${index} reason codes`);
    invariant(
      check.schema === "nexus-check-result-v1" &&
        check.contract_root === manifest.contract_root &&
        check.artifact_root === manifest.artifact_root &&
        check.manifest_root === manifest.manifest_root &&
        check.verifier_root === manifest.verifier_root &&
        check.policy_root === manifest.policy_root &&
        check.environment_root === manifest.environment_root &&
        check.required_check_manifest_root === requiredRoot &&
        check.verifier_authority_root ===
          payload.expected_verifier_authority_root &&
        check.execution_receipt_anchor_root ===
          payload.expected_execution_receipt_anchor_root &&
        assertSafeNonNegativeInteger(
          check.exit_code,
          `deterministic check ${index} exit code`,
        ) === check.exit_code &&
        ["PASS", "FAIL", "ERROR", "TIMEOUT"].includes(check.status),
      "ERR_ARTIFACT_MISMATCH",
      `deterministic check ${index} binding mismatch`,
    );
    checkNames.push(check.check_name);
    checkRoots.push(
      `CHECK-${hash("NEXUS_CHECK_RESULT_V1", check)}`,
    );
    invariant(
      check.status !== "PASS" ||
        (check.exit_code === 0 && check.reason_codes.length === 0),
      "ERR_DETERMINISTIC_RED",
      `passing check ${index} carries a red exit/reason`,
    );
    allPassed &&=
      check.status === "PASS" &&
      check.exit_code === 0 &&
      check.reason_codes.length === 0;
  }
  invariant(
    checkNames.join("\u0000") ===
      job.accepted_contract.work.required_check_names.join("\u0000") &&
      new Set(checkNames).size === checkNames.length,
    "ERR_DETERMINISTIC_RED",
    "deterministic manifest is incomplete or reordered",
  );
  const evidenceBody = {
    schema: "nexus-deterministic-evidence-v1",
    job_id: job.job_id,
    contract_root: manifest.contract_root,
    artifact_root: manifest.artifact_root,
    manifest_root: manifest.manifest_root,
    verifier_root: manifest.verifier_root,
    policy_root: manifest.policy_root,
    environment_root: manifest.environment_root,
    required_check_manifest_root: requiredRoot,
    ordered_check_roots: checkRoots,
  };
  const executionAnchorRoot = verifierExecutionReceiptAnchorRoot(
    payload.execution_receipt_anchor,
  );
  const controller = state.controllers[event.auth.controller_id];
  const verifierAuthority = payload.verifier_authority;
  const authorityRoot = verifierAuthorityRoot(verifierAuthority);
  invariant(
    payload.expected_execution_receipt_anchor_root === executionAnchorRoot &&
      payload.execution_receipt_anchor.job_id === job.job_id &&
      payload.execution_receipt_anchor.contract_root ===
        job.accepted_contract_root &&
      payload.execution_receipt_anchor.artifact_root ===
        job.final_artifact_root &&
      payload.execution_receipt_anchor.manifest_root ===
        job.final_manifest_root &&
      payload.execution_receipt_anchor.policy_root ===
        job.accepted_contract.policy_root &&
      payload.execution_receipt_anchor.required_check_manifest_root ===
        requiredRoot &&
      payload.execution_receipt_anchor.verifier_principal_id ===
        event.actor_id &&
      payload.execution_receipt_anchor.verifier_controller_id ===
        controller.controller_id &&
      payload.expected_verifier_authority_root === authorityRoot &&
      verifierAuthority.job_id === job.job_id &&
      verifierAuthority.contract_root === job.accepted_contract_root &&
      verifierAuthority.artifact_root === job.final_artifact_root &&
      verifierAuthority.policy_root === job.accepted_contract.policy_root &&
      verifierAuthority.required_check_manifest_root === requiredRoot &&
      verifierAuthority.verifier_root === job.accepted_contract.verifier_root &&
      verifierAuthority.verifier_principal_id === event.actor_id &&
      verifierAuthority.verifier_controller_id === controller.controller_id &&
      verifierAuthority.verifier_key_id === controller.key_id &&
      verifierAuthority.verification_recipient_account_id ===
        job.accepted_contract.settlement.verification_recipient_account_id &&
      verifierAuthority.execution_receipt_anchor_root === executionAnchorRoot &&
      controller.status === "ACTIVE" &&
      event.actor_id ===
        job.accepted_contract.settlement.verification_principal_id,
    "ERR_DETERMINISTIC_RED",
    "verifier authority/receipt/controller binding mismatch",
  );
  evidenceBody.verifier_authority_root = authorityRoot;
  evidenceBody.execution_receipt_anchor_root = executionAnchorRoot;
  const evidenceRoot = hash("NEXUS_DETERMINISTIC_EVIDENCE_V1", evidenceBody);
  invariant(
    payload.evidence_root === evidenceRoot,
    "ERR_DETERMINISTIC_RED",
    "deterministic evidence root mismatch",
  );
  assertBoundedCanonical(manifest, "deterministic check manifest", 131072);
  invariant(
    allPassed,
    "ERR_DETERMINISTIC_RED",
    "only a fully passing deterministic manifest may accrue verification",
  );
  return {
    evidenceRoot,
    manifest,
    allPassed,
    requiredManifest,
    requiredRoot,
    authorityRoot,
    verifierAuthority,
    executionAnchorRoot,
    executionReceiptAnchor: payload.execution_receipt_anchor,
  };
}

function handleAcceptDeterministicEvidence(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.state === "ACTIVE" &&
      job.lead_payout_accrued &&
      !job.verification_payout_accrued &&
      event.actor_id ===
        job.accepted_contract.settlement.verification_principal_id,
    "ERR_DETERMINISTIC_RED",
    "deterministic evidence cannot be accepted",
  );
  const evidence = validateDeterministicEvidence(state, job, event, p);
  const verificationAccount = getAccount(
    state,
    job.accepted_contract.settlement.verification_recipient_account_id,
  );
  invariant(
    ownsAccount(state, event.actor_id, verificationAccount),
    "ERR_AUTHORITY",
    "verifier does not own the frozen verification recipient account",
  );
  const payoutId = createPayout(state, event, {
    job,
    recipientAccountId:
      job.accepted_contract.settlement.verification_recipient_account_id,
    kind: "VERIFICATION",
    amount: job.accepted_contract.work.fixed_verification_cost,
    evidenceRoot: evidence.evidenceRoot,
    sourceRecordId: job.job_id,
    sourceBucket: "JOB",
    sourceId: job.job_id,
    payoutNonce: `${event.nonce}:verification`,
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    deterministic_evidence_root: evidence.evidenceRoot,
    deterministic_evidence_manifest: evidence.manifest,
    deterministic_checks_passed: evidence.allPassed,
    verification_payout_accrued: true,
    required_check_manifest: evidence.requiredManifest,
    required_check_manifest_root: evidence.requiredRoot,
    verifier_authority_root: evidence.authorityRoot,
    verifier_execution_receipt_anchor_root: evidence.executionAnchorRoot,
  });
  state.verifier_authorities[evidence.authorityRoot] = {
    verifier_authority_root: evidence.authorityRoot,
    authority: evidence.verifierAuthority,
    execution_receipt_anchor_root: evidence.executionAnchorRoot,
    execution_receipt_anchor: evidence.executionReceiptAnchor,
    accepted_event_id: event.event_id,
  };
  return {
    jobId: job.job_id,
    effects: [
      `accepted deterministic evidence ${evidence.evidenceRoot}`,
      `accrued ${payoutId}`,
    ],
    result: { payout_id: payoutId },
  };
}

function handleEnterReview(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  assertSafeNonNegativeInteger(
    p.max_compute_units,
    "review maximum compute units",
    { positive: true },
  );
  assertSafeNonNegativeInteger(p.expiry_tick, "review expiry tick");
  invariant(
    job.state === "ACTIVE" &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_ENTER_REVIEW",
    "actor cannot enter review",
  );
  invariant(
    state.tick < job.accepted_contract.work.deadline_tick &&
      !job.timeout_abort_required,
    "ERR_ENTER_REVIEW",
    "job deadline/hold blocks review",
  );
  invariant(
    job.lead_payout_accrued &&
      job.verification_payout_accrued &&
      job.final_source_root &&
      job.final_artifact_root &&
      job.final_manifest_root &&
      job.deterministic_evidence_root &&
      job.required_check_manifest_root &&
      job.verifier_authority_root &&
      job.verifier_execution_receipt_anchor_root,
    "ERR_ENTER_REVIEW",
    "final work/evidence is incomplete",
  );
  const unresolvedTasks = job.task_ids
    .map((id) => state.tasks[id])
    .filter((task) => task.status !== "ACCEPTED");
  const unresolvedCommitments = job.subwork_commitment_ids
    .map((id) => state.subwork_commitments[id])
    .filter((item) => item.status === "AUTHORIZED");
  const liveLeases = Object.values(state.leases).filter(
    (lease) =>
      lease.job_id === job.job_id &&
      ["ACTIVE", "RETURNED"].includes(lease.status),
  );
  invariant(
    unresolvedTasks.length === 0 &&
      unresolvedCommitments.length === 0 &&
      liveLeases.length === 0,
    "ERR_ENTER_REVIEW",
    "work graph is not closed",
  );
  const packet = {
    schema: "nexus-review-packet-v2",
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    artifact_root: job.final_artifact_root,
    source_root: job.final_source_root,
    manifest_root: job.final_manifest_root,
    deterministic_evidence_root: job.deterministic_evidence_root,
    required_check_manifest_root: job.required_check_manifest_root,
    rubric_root: p.rubric_root,
    policy_root: job.accepted_contract.policy_root,
    conflict_policy_root: job.accepted_contract.conflict_policy_root,
    required_review_count: job.accepted_contract.review.required_reviews,
    required_diversity_dimensions: [
      ...job.accepted_contract.review.required_diversity_dimensions,
    ],
    questions: [...p.questions],
    max_compute_units: p.max_compute_units,
    expiry_tick: p.expiry_tick,
  };
  const reviewComputeUnits = checkedMultiply(
    job.accepted_contract.review.required_reviews,
    p.max_compute_units,
  );
  const nextComputeUnits = checkedAdd(
    job.compute_units_reserved,
    reviewComputeUnits,
  );
  invariant(
    nextComputeUnits <= job.accepted_contract.work.max_compute_units,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "review triad exceeds aggregate compute ceiling",
  );
  invariant(
    Number.isSafeInteger(packet.expiry_tick) &&
      packet.expiry_tick > state.tick &&
      packet.expiry_tick <= job.accepted_contract.work.deadline_tick,
    "ERR_ENTER_REVIEW",
    "review packet expiry is invalid",
  );
  invariant(
    packet.required_review_count === 3,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review policy must require exactly three reviews",
  );
  assertSortedUniqueStrings(
    packet.required_diversity_dimensions,
    "required review diversity dimensions",
    { minItems: 1 },
  );
  invariant(
    packet.required_diversity_dimensions.every((dimension) =>
      [
        "MACHINE",
        "MODEL",
        "OPERATOR",
        "PROMPT_LINEAGE",
        "PROVIDER",
        "TOOLCHAIN",
        "VERIFIER",
      ].includes(dimension),
    ),
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review policy contains an unsupported diversity dimension",
  );
  invariant(
    hash(
      "NEXUS_CONFLICT_POLICY_V1",
      job.accepted_contract.conflict_policy,
    ) === packet.conflict_policy_root &&
      job.accepted_contract.conflict_policy.job_id === job.job_id,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review conflict policy is missing or has the wrong scope",
  );
  const packetRoot = `PACKET-${hash("NEXUS_REVIEW_PACKET_V2", packet)}`;
  if (p.expected_packet_root) {
    invariant(
      p.expected_packet_root === packetRoot,
      "ERR_REVIEW_PACKET_MISMATCH",
      "proposed review packet root mismatch",
    );
  }
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "REVIEW",
    review_packet: packet,
    review_packet_root: packetRoot,
    review_assignment_ids: [],
    clearance_root: null,
    hold_root: null,
    compute_units_reserved: nextComputeUnits,
  });
  return {
    jobId: job.job_id,
    effects: [`entered review with packet ${packetRoot}`],
    result: {
      packet_root: packetRoot,
      required_check_manifest_root: job.required_check_manifest_root,
    },
  };
}

function handleAssignReviewers(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.state === "REVIEW" &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_REVIEW_ASSIGNMENT",
    "actor cannot assign reviewers",
  );
  invariant(
    job.review_assignment_ids.length === 0 &&
      Array.isArray(p.assignments) &&
      p.assignments.length === job.review_packet.required_review_count,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "v0 requires exactly three fresh assignments",
  );
  const seats = new Set();
  const models = new Set();
  const assignmentIds = [];
  for (const [slot, assignment] of p.assignments.entries()) {
    assertExactObjectKeys(
      assignment,
      ["reviewer_principal_id", "reviewer_seat_id", "model_id", "capability_offer_id", "capability_offer_root", "expiry_tick"],
      [],
      `review assignment ${slot}`,
    );
    const offer = capabilityOfferByRoot(
      state,
      assignment.capability_offer_root,
    );
    invariant(
      offer &&
        offer.offer_id === assignment.capability_offer_id &&
        offer.principal_id === assignment.reviewer_principal_id &&
        offer.worker_seat_id === assignment.reviewer_seat_id &&
        state.tick >= offer.not_before_tick &&
        state.tick < offer.expiry_tick,
      "ERR_REVIEW_ASSIGNMENT",
      `slot ${slot} offer is invalid`,
    );
    const reviewTaskBounds = {
      data_class: job.accepted_contract.privacy.data_class,
      required_capabilities: [],
      max_compute_units: job.review_packet.max_compute_units,
      max_input_bytes: 0,
      max_output_bytes: 0,
    };
    assertOfferSatisfiesContract(state, job, offer, reviewTaskBounds);
    invariant(
      Number.isSafeInteger(assignment.expiry_tick) &&
        assignment.expiry_tick > state.tick &&
        assignment.expiry_tick <= job.review_packet.expiry_tick &&
        assignment.expiry_tick <= offer.expiry_tick,
      "ERR_REVIEW_ASSIGNMENT_EXPIRED",
      `slot ${slot} assignment expiry is invalid`,
    );
    invariant(
      assignment.reviewer_principal_id !== job.accepted_worker_principal_id &&
        assignment.reviewer_seat_id !== job.accepted_worker_seat,
      "ERR_REVIEW_SELF",
      "worker cannot review itself",
    );
    invariant(
      !seats.has(assignment.reviewer_seat_id),
      "ERR_REVIEW_ASSIGNMENT",
      "duplicate reviewer seat",
    );
    invariant(
      !models.has(assignment.model_id) &&
        assignment.model_id === offer.model_id,
      "ERR_REVIEW_DUPLICATE_MODEL",
      "duplicate/mismatched review model",
    );
    seats.add(assignment.reviewer_seat_id);
    models.add(assignment.model_id);
    const assignmentId = creationId(event, {
      prefix: "ASSIGN",
      objectType: "REVIEW_ASSIGNMENT",
      naturalKey: {
        job_id: job.job_id,
        slot,
        attempt: 1,
        packet_root: job.review_packet_root,
      },
      parentIds: [job.job_id],
      nonce: `${p.assignment_nonce}:${slot}`,
    });
    const eligibility = reviewerEligibility(
      state,
      job,
      offer,
      assignment,
      state.tick,
    );
    const eligibilityId = `ELIGIBILITY-${eligibility.root}`;
    invariant(
      !state.reviewer_eligibilities[eligibilityId],
      "ERR_NONCE_REPLAY",
      "reviewer eligibility already exists",
    );
    state.reviewer_eligibilities[eligibilityId] = {
      eligibility_id: eligibilityId,
      eligibility_root: eligibility.root,
      facts: eligibility.facts,
      status: "ACCEPTED",
    };
    putNewRecord(
      state,
      "review_assignments",
      "review_assignment_id",
      assignmentId,
      "REVIEW_ASSIGNMENT",
      {
        job_id: job.job_id,
        slot,
        attempt: 1,
        packet_root: job.review_packet_root,
        reviewer_principal_id: assignment.reviewer_principal_id,
        reviewer_seat_id: assignment.reviewer_seat_id,
        model_id: assignment.model_id,
        capability_offer_id: assignment.capability_offer_id,
        capability_offer_root: assignment.capability_offer_root,
        maximum_capability_root:
          job.accepted_contract.authority_ceiling.maximum_capability_root,
        required_check_manifest_root: job.required_check_manifest_root,
        amount: job.accepted_contract.settlement.reviewer_amount_each,
        not_before_tick: state.tick,
        expiry_tick: assignment.expiry_tick,
        eligibility_facts: eligibility.facts,
        eligibility_id: eligibilityId,
        eligibility_root: eligibility.root,
        status: "ASSIGNED",
        replacement_of: null,
        review_id: null,
      },
    );
    assignmentIds.push(assignmentId);
  }
  updateRecord(state, "jobs", job.job_id, "JOB", {
    review_assignment_ids: assignmentIds,
  });
  return {
    jobId: job.job_id,
    effects: assignmentIds.map((id) => `assigned reviewer ${id}`),
    result: { review_assignment_ids: assignmentIds },
  };
}

function handleReplaceReviewer(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  assertSafeNonNegativeInteger(
    p.expected_assignment_revision,
    "expected assignment revision",
  );
  const expired = state.review_assignments[p.expired_assignment_id];
  invariant(
    job.state === "HOLD" &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ) &&
      expired?.job_id === job.job_id &&
      expired.status === "EXPIRED" &&
      state.tick >= expired.expiry_tick &&
      state.tick < job.review_packet.expiry_tick &&
      p.expected_assignment_record_root === expired.record_root &&
      p.expected_assignment_revision === expired.record_revision,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "replacement does not bind the current canonical expired assignment",
  );
  const replacement = p.replacement;
  assertExactObjectKeys(
    replacement,
    ["reviewer_principal_id", "reviewer_seat_id", "model_id", "capability_offer_id", "capability_offer_root", "expiry_tick"],
    [],
    "replacement reviewer",
  );
  const offer = capabilityOfferByRoot(
    state,
    replacement.capability_offer_root,
  );
  invariant(
    offer?.offer_id === replacement.capability_offer_id &&
      offer.principal_id === replacement.reviewer_principal_id &&
      offer.worker_seat_id === replacement.reviewer_seat_id &&
      replacement.model_id === offer.model_id &&
      replacement.reviewer_principal_id !==
        job.accepted_worker_principal_id &&
      replacement.reviewer_seat_id !== job.accepted_worker_seat,
    "ERR_REVIEW_ASSIGNMENT",
    "replacement reviewer offer/identity binding is invalid",
  );
  const otherAssignments = job.review_assignment_ids
    .filter((id) => id !== expired.review_assignment_id)
    .map((id) => state.review_assignments[id]);
  invariant(
    !otherAssignments.some(
      (item) =>
        item.reviewer_seat_id === replacement.reviewer_seat_id ||
        item.model_id === replacement.model_id,
    ),
    "ERR_REVIEW_DUPLICATE_MODEL",
    "replacement duplicates a current reviewer seat/model",
  );
  const reviewTaskBounds = {
    data_class: job.accepted_contract.privacy.data_class,
    required_capabilities: [],
    max_compute_units: job.review_packet.max_compute_units,
    max_input_bytes: 0,
    max_output_bytes: 0,
  };
  assertOfferSatisfiesContract(state, job, offer, reviewTaskBounds);
  invariant(
    Number.isSafeInteger(replacement.expiry_tick) &&
      replacement.expiry_tick > state.tick &&
      replacement.expiry_tick <= job.review_packet.expiry_tick &&
      replacement.expiry_tick <= offer.expiry_tick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "replacement expiry is invalid",
  );
  const replacementId = creationId(event, {
    prefix: "ASSIGN",
    objectType: "REVIEW_ASSIGNMENT",
    naturalKey: {
      job_id: job.job_id,
      slot: expired.slot,
      attempt: expired.attempt + 1,
      packet_root: job.review_packet_root,
    },
    parentIds: [job.job_id, expired.review_assignment_id],
    nonce: p.replacement_nonce,
  });
  const eligibility = reviewerEligibility(
    state,
    job,
    offer,
    replacement,
    state.tick,
  );
  const eligibilityId = `ELIGIBILITY-${eligibility.root}`;
  invariant(
    !state.reviewer_eligibilities[eligibilityId],
    "ERR_NONCE_REPLAY",
    "replacement reviewer eligibility already exists",
  );
  state.reviewer_eligibilities[eligibilityId] = {
    eligibility_id: eligibilityId,
    eligibility_root: eligibility.root,
    facts: eligibility.facts,
    status: "ACCEPTED",
  };
  putNewRecord(
    state,
    "review_assignments",
    "review_assignment_id",
    replacementId,
    "REVIEW_ASSIGNMENT",
    {
      job_id: job.job_id,
      slot: expired.slot,
      attempt: expired.attempt + 1,
      packet_root: job.review_packet_root,
      reviewer_principal_id: replacement.reviewer_principal_id,
      reviewer_seat_id: replacement.reviewer_seat_id,
      model_id: replacement.model_id,
      capability_offer_id: replacement.capability_offer_id,
      capability_offer_root: replacement.capability_offer_root,
      maximum_capability_root:
        job.accepted_contract.authority_ceiling.maximum_capability_root,
      required_check_manifest_root: job.required_check_manifest_root,
      amount: expired.amount,
      not_before_tick: state.tick,
      expiry_tick: replacement.expiry_tick,
      eligibility_facts: eligibility.facts,
      eligibility_id: eligibilityId,
      eligibility_root: eligibility.root,
      status: "ASSIGNED",
      replacement_of: expired.review_assignment_id,
      review_id: null,
    },
  );
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "REVIEW",
    review_assignment_ids: job.review_assignment_ids.map((id) =>
      id === expired.review_assignment_id ? replacementId : id,
    ),
    hold_root: null,
    hold_deadline_tick: null,
    timeout_abort_required: false,
    abort_authorization_root: null,
  });
  return {
    jobId: job.job_id,
    effects: [
      `replaced expired assignment ${expired.review_assignment_id} with ${replacementId}`,
    ],
    result: {
      review_assignment_id: replacementId,
      eligibility_root: eligibility.root,
    },
  };
}

function handleAcceptAssignedReview(state, event) {
  const p = event.payload;
  const assignment = state.review_assignments[p.review_assignment_id];
  assertSafeNonNegativeInteger(
    p.expected_assignment_revision,
    "expected assignment revision",
  );
  invariant(assignment, "ERR_REVIEW_ASSIGNMENT", "assignment is missing");
  const job = getJob(state, assignment.job_id);
  invariant(
    job.state === "REVIEW" &&
      assignment.status === "ASSIGNED" &&
      p.expected_assignment_record_root === assignment.record_root &&
      p.expected_assignment_revision === assignment.record_revision &&
      p.eligibility_root === assignment.eligibility_root &&
      p.required_check_manifest_root ===
        assignment.required_check_manifest_root &&
      assignment.required_check_manifest_root ===
        job.required_check_manifest_root &&
      assignment.reviewer_principal_id === event.actor_id &&
      state.tick >= assignment.not_before_tick &&
      state.tick < assignment.expiry_tick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "assignment cannot accept review",
  );
  const assignedOffer = capabilityOfferByRoot(
    state,
    assignment.capability_offer_root,
  );
  assertOfferSatisfiesContract(state, job, assignedOffer, {
    data_class: job.accepted_contract.privacy.data_class,
    required_capabilities: [],
    max_compute_units: job.review_packet.max_compute_units,
    max_input_bytes: 0,
    max_output_bytes: 0,
  });
  invariant(
    hash(
      "NEXUS_REVIEWER_ELIGIBILITY_V2",
      assignment.eligibility_facts,
    ) === assignment.eligibility_root,
    "ERR_REVIEW_ASSIGNMENT",
    "stored reviewer eligibility root is invalid",
  );
  invariant(
    p.packet_root === assignment.packet_root &&
      p.model_id === assignment.model_id &&
      p.reviewer_seat_id === assignment.reviewer_seat_id,
    "ERR_REVIEW_PACKET_MISMATCH",
    "review assignment binding mismatch",
  );
  const reviewOffer = capabilityOfferByRoot(
    state,
    assignment.capability_offer_root,
  );
  invariant(
    reviewOffer &&
      reviewOffer.offer_id === assignment.capability_offer_id &&
      p.provider_family === reviewOffer.provider_family &&
      p.operator_id === reviewOffer.operator_id,
    "ERR_REVIEW_ASSIGNMENT",
    "review provider/operator declarations do not match the assigned offer",
  );
  invariant(
    ["CLEAR", "DISSENT", "HOLD"].includes(p.verdict),
    "ERR_SCHEMA",
    "invalid review verdict",
  );
  const severities = new Set([
    "NONE",
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
  ]);
  invariant(
    severities.has(p.severity),
    "ERR_SCHEMA",
    "invalid registered review severity",
  );
  const severityRank = new Map([
    ["NONE", 0],
    ["LOW", 1],
    ["MEDIUM", 2],
    ["HIGH", 3],
    ["CRITICAL", 4],
  ]);
  for (const [label, values] of [
    ["review findings", p.findings],
    ["review claims", p.claims],
    ["review evidence refs", p.evidence_refs],
    ["review limitations", p.limitations],
  ]) {
    assertBoundedArray(values, label, { maxItems: 128 });
  }
  const assertSortedObjects = (values, idKey, label) => {
    const ids = values.map((value) => value[idKey]);
    for (const [index, id] of ids.entries()) {
      assertBoundedString(id, `${label}[${index}].${idKey}`);
    }
    invariant(
      new Set(ids).size === ids.length &&
        ids.every((id, index) => id === [...ids].sort()[index]),
      "ERR_NON_CANONICAL",
      `${label} must be sorted and unique by ${idKey}`,
    );
  };
  for (const [index, reference] of p.evidence_refs.entries()) {
    assertExactObjectKeys(
      reference,
      [
        "schema",
        "evidence_ref_id",
        "evidence_root",
        "locator",
      ],
      [],
      `review evidence ref ${index}`,
    );
    invariant(
      reference.schema === "nexus-review-evidence-ref-v1",
      "ERR_SCHEMA",
      "unsupported review evidence-ref schema",
    );
    assertBoundedString(reference.locator, `review evidence ref ${index} locator`);
    assertHexRoot(
      reference.evidence_root,
      `review evidence ref ${index} root`,
    );
  }
  assertSortedObjects(p.evidence_refs, "evidence_ref_id", "review evidence refs");
  const evidenceRefIds = new Set(
    p.evidence_refs.map((reference) => reference.evidence_ref_id),
  );
  for (const [index, finding] of p.findings.entries()) {
    assertExactObjectKeys(
      finding,
      [
        "schema",
        "finding_id",
        "severity",
        "material",
        "resolved",
        "description",
        "evidence_ref_ids",
      ],
      [],
      `review finding ${index}`,
    );
    invariant(
      finding.schema === "nexus-review-finding-v1" &&
        severities.has(finding.severity) &&
        typeof finding.material === "boolean" &&
        typeof finding.resolved === "boolean" &&
        (!["HIGH", "CRITICAL"].includes(finding.severity) ||
          finding.material === true),
      "ERR_SCHEMA",
      `review finding ${index} has invalid registered fields`,
    );
    assertBoundedString(finding.description, `review finding ${index} description`);
    assertSortedUniqueStrings(
      finding.evidence_ref_ids,
      `review finding ${index} evidence refs`,
    );
    invariant(
      finding.evidence_ref_ids.every((id) => evidenceRefIds.has(id)),
      "ERR_REVIEW_PACKET_MISMATCH",
      `review finding ${index} has a dangling evidence reference`,
    );
  }
  assertSortedObjects(p.findings, "finding_id", "review findings");
  for (const [index, claim] of p.claims.entries()) {
    assertExactObjectKeys(
      claim,
      ["schema", "claim_id", "statement", "evidence_ref_ids"],
      [],
      `review claim ${index}`,
    );
    invariant(
      claim.schema === "nexus-review-claim-v1",
      "ERR_SCHEMA",
      `review claim ${index} has an unsupported schema`,
    );
    assertBoundedString(claim.statement, `review claim ${index} statement`);
    assertSortedUniqueStrings(
      claim.evidence_ref_ids,
      `review claim ${index} evidence refs`,
    );
    invariant(
      claim.evidence_ref_ids.every((id) => evidenceRefIds.has(id)),
      "ERR_REVIEW_PACKET_MISMATCH",
      `review claim ${index} has a dangling evidence reference`,
    );
  }
  assertSortedObjects(p.claims, "claim_id", "review claims");
  for (const [index, limitation] of p.limitations.entries()) {
    assertExactObjectKeys(
      limitation,
      ["schema", "limitation_id", "description"],
      [],
      `review limitation ${index}`,
    );
    invariant(
      limitation.schema === "nexus-review-limitation-v1",
      "ERR_SCHEMA",
      `review limitation ${index} has an unsupported schema`,
    );
    assertBoundedString(
      limitation.description,
      `review limitation ${index} description`,
    );
  }
  assertSortedObjects(p.limitations, "limitation_id", "review limitations");
  const expectedSeverity =
    p.findings.length === 0
      ? "NONE"
      : p.findings.reduce((maximum, finding) =>
          severityRank.get(finding.severity) > severityRank.get(maximum)
            ? finding.severity
            : maximum,
        "NONE");
  invariant(
    p.severity === expectedSeverity,
    "ERR_REVIEW_DISSENT",
    "top-level review severity differs from maximum finding severity",
  );
  const referencedEvidence = new Set(
    [...p.findings, ...p.claims].flatMap(
      (item) => item.evidence_ref_ids,
    ),
  );
  invariant(
    referencedEvidence.size === evidenceRefIds.size &&
      [...evidenceRefIds].every((id) => referencedEvidence.has(id)),
    "ERR_REVIEW_PACKET_MISMATCH",
    "review evidence refs are not an exact nested evidence closure",
  );
  const hasUnresolvedVetoFinding = p.findings.some(
    (finding) =>
      !finding.resolved &&
      (finding.material ||
        ["HIGH", "CRITICAL"].includes(finding.severity)),
  );
  invariant(
    p.verdict !== "CLEAR" || !hasUnresolvedVetoFinding,
    "ERR_REVIEW_DISSENT",
    "CLEAR verdict cannot carry unresolved material/high/critical findings",
  );
  const reviewBody = {
    schema: "nexus-model-review-v2",
    review_assignment_id: assignment.review_assignment_id,
    reviewer_seat_id: assignment.reviewer_seat_id,
    model_id: assignment.model_id,
    provider_family: p.provider_family,
    operator_id: p.operator_id,
    prompt_lineage_root: p.prompt_lineage_root,
    toolchain_root: p.toolchain_root,
    machine_declaration: p.machine_declaration,
    verifier_implementation: p.verifier_implementation,
    packet_root: p.packet_root,
    required_check_manifest_root: p.required_check_manifest_root,
    verdict: p.verdict,
    severity: p.severity,
    findings: [...p.findings],
    claims: [...p.claims],
    evidence_refs: [...p.evidence_refs],
    limitations: [...p.limitations],
    nonce: p.review_nonce,
  };
  const reviewId = rootId("REVIEW", "NEXUS_MODEL_REVIEW_V2", reviewBody);
  invariant(!state.reviews[reviewId], "ERR_NONCE_REPLAY", "review already exists");
  state.reviews[reviewId] = { review_id: reviewId, ...reviewBody };
  const reviewerAccount = getAccount(state, p.recipient_account_id);
  invariant(
    ownsAccount(state, event.actor_id, reviewerAccount),
    "ERR_AUTHORITY",
    "review payout account mismatch",
  );
  const payoutId = createPayout(state, event, {
    job,
    recipientAccountId: reviewerAccount.account_id,
    kind: "REVIEW",
    amount: assignment.amount,
    evidenceRoot: reviewId,
    sourceRecordId: assignment.review_assignment_id,
    sourceBucket: "JOB",
    sourceId: job.job_id,
    payoutNonce: `${event.nonce}:review`,
  });
  updateRecord(
    state,
    "review_assignments",
    assignment.review_assignment_id,
    "REVIEW_ASSIGNMENT",
    { status: "VALID", review_id: reviewId },
  );
  const currentJob = state.jobs[job.job_id];
  updateRecord(state, "jobs", job.job_id, "JOB", {
    valid_review_payouts_created: checkedAdd(
      currentJob.valid_review_payouts_created,
      1,
    ),
  });
  return {
    jobId: job.job_id,
    effects: [`accepted review ${reviewId}`, `accrued payout ${payoutId}`],
    result: { review_id: reviewId, payout_id: payoutId },
  };
}

function reviewDiversity(reviews) {
  const dimensions = [
    ["MODEL", "model_id"],
    ["PROVIDER", "provider_family"],
    ["OPERATOR", "operator_id"],
    ["PROMPT_LINEAGE", "prompt_lineage_root"],
    ["TOOLCHAIN", "toolchain_root"],
    ["MACHINE", "machine_declaration"],
    ["VERIFIER", "verifier_implementation"],
  ];
  return dimensions.map(([dimension, key]) => {
    const values = reviews.map((review) => review[key]);
    const known = values.every((value) => value && value !== "UNKNOWN");
    return {
      dimension,
      values: [...values].sort(),
      evidence_class: known ? "DECLARED" : "UNKNOWN",
      relationship:
        known && new Set(values).size === values.length
          ? "DISTINCT"
          : known
            ? "SHARED"
            : "UNKNOWN",
    };
  });
}

function handleComputeReviewOutcome(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.state === "REVIEW" &&
      job.accepted_contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_AUTHORITY",
    "actor cannot compute review outcome",
  );
  invariant(
    job.review_assignment_ids.length ===
      job.review_packet.required_review_count,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review triad is incomplete",
  );
  const assignments = job.review_assignment_ids
    .map((id) => state.review_assignments[id])
    .sort((a, b) => a.reviewer_seat_id.localeCompare(b.reviewer_seat_id));
  invariant(
    assignments.every((item) => item.status === "VALID" && item.review_id),
    "ERR_REVIEW_ASSIGNMENT",
    "not every assignment has a valid review",
  );
  const reviews = assignments.map((item) => state.reviews[item.review_id]);
  invariant(
    new Set(reviews.map((item) => item.model_id)).size === 3 &&
      new Set(reviews.map((item) => item.reviewer_seat_id)).size === 3 &&
      reviews.every((item) => item.packet_root === job.review_packet_root) &&
      reviews.every(
        (item) =>
          item.required_check_manifest_root ===
          job.required_check_manifest_root,
      ),
    "ERR_REVIEW_PACKET_MISMATCH",
    "review triad bindings are invalid",
  );
  const diversity = reviewDiversity(reviews);
  const requiredDiversityFailures =
    job.review_packet.required_diversity_dimensions.filter(
      (dimension) =>
        diversity.find((item) => item.dimension === dimension)?.relationship !==
        "DISTINCT",
    );
  const diversitySatisfied = requiredDiversityFailures.length === 0;
  const correlated = diversity.some(
    (item) => item.relationship !== "DISTINCT",
  );
  const allClear = reviews.every(
    (item) =>
      item.verdict === "CLEAR" &&
      !["HIGH", "CRITICAL"].includes(item.severity) &&
      !item.findings.some(
        (finding) =>
          !finding.resolved &&
          (finding.material ||
            ["HIGH", "CRITICAL"].includes(finding.severity)),
      ),
  );
  if (job.deterministic_checks_passed && allClear && diversitySatisfied) {
    const clearanceRoot = hash("NEXUS_CLEARANCE_ROOT_V1", {
      packet_root: job.review_packet_root,
      ordered_review_hashes: reviews.map((review) =>
        review.review_id.slice("REVIEW-".length),
      ),
      diversity_vector: diversity,
      deterministic_evidence_root: job.deterministic_evidence_root,
      policy_root: job.accepted_contract.policy_root,
    });
    updateRecord(state, "jobs", job.job_id, "JOB", {
      clearance_root: clearanceRoot,
      hold_root: null,
      diversity_label: correlated ? "CORRELATED_REVIEW" : "DECLARED_DISTINCT",
    });
    return {
      jobId: job.job_id,
      effects: [`computed clearance ${clearanceRoot}`],
      result: {
        outcome: "CLEAR",
        clearance_root: clearanceRoot,
        diversity_label: correlated
          ? "CORRELATED_REVIEW"
          : "DECLARED_DISTINCT",
      },
    };
  }
  const reasons = [];
  if (!job.deterministic_checks_passed) reasons.push("ERR_DETERMINISTIC_RED");
  if (!allClear) reasons.push("ERR_REVIEW_DISSENT");
  if (!diversitySatisfied) reasons.push("ERR_REVIEW_DIVERSITY");
  const holdRoot = `HOLD-${hash("NEXUS_HOLD_ROOT_V1", {
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    attempt: job.attempt,
    artifact_root: job.final_artifact_root,
    packet_root: job.review_packet_root,
    ordered_review_hashes: reviews.map((review) =>
      review.review_id.slice("REVIEW-".length),
    ),
    deterministic_evidence_root: job.deterministic_evidence_root,
    ordered_reason_codes: reasons.sort(),
    policy_root: job.accepted_contract.policy_root,
  })}`;
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "HOLD",
    clearance_root: null,
    hold_root: holdRoot,
    hold_deadline_tick:
      checkedAdd(
        state.tick,
        job.accepted_contract.hold.resolution_timeout_ticks,
      ),
    diversity_label: correlated ? "CORRELATED_REVIEW" : "DECLARED_DISTINCT",
  });
  return {
    jobId: job.job_id,
    effects: [`entered HOLD ${holdRoot}`],
    result: { outcome: "HOLD", hold_root: holdRoot, reason_codes: reasons },
  };
}

function handleHumanDecision(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.accepted_contract.decision_authority.settlement_principal_ids.includes(
      event.actor_id,
    ),
    "ERR_AUTHORITY",
    "actor lacks settlement decision authority",
  );
  const accepting =
    p.decision === "ACCEPT" &&
    job.state === "REVIEW" &&
    job.clearance_root &&
    p.clearance_root === job.clearance_root &&
    p.hold_root === null;
  const aborting =
    p.decision === "ABORT" &&
    job.state === "HOLD" &&
    job.hold_root &&
    p.hold_root === job.hold_root &&
    p.clearance_root === null;
  invariant(
    accepting || aborting,
    "ERR_HUMAN_DECISION",
    "decision is not bound to the current clearance or hold",
  );
  invariant(
    job.human_decision_root === null,
    "ERR_HUMAN_DECISION",
    "the required v0 human decision already exists",
  );
  const appealCloseTick = checkedAdd(
    state.tick,
    job.accepted_contract.appeal.filing_deadline_ticks,
  );
  const body = {
    schema: "nexus-human-decision-v1",
    job_id: job.job_id,
    decision_principal_id: event.actor_id,
    decision_authority_root: hash(
      "NEXUS_DECISION_AUTHORITY_V1",
      job.accepted_contract.decision_authority,
    ),
    contract_root: job.accepted_contract_root,
    artifact_root: job.final_artifact_root,
    clearance_root: accepting ? job.clearance_root : null,
    hold_root: aborting ? job.hold_root : null,
    decision_tick: state.tick,
    appeal_close_tick: appealCloseTick,
    decision: p.decision,
    reason_codes: [...p.reason_codes].sort(),
    nonce: p.decision_nonce,
  };
  const decisionId = rootId("DECISION", "NEXUS_DECISION_V1", body);
  invariant(!state.decisions[decisionId], "ERR_NONCE_REPLAY", "decision exists");
  state.decisions[decisionId] = { decision_id: decisionId, ...body };
  updateRecord(state, "jobs", job.job_id, "JOB", {
    human_decision_root: decisionId,
    appeal_close_tick: appealCloseTick,
    abort_authorization_root: aborting ? decisionId : null,
  });
  return {
    jobId: job.job_id,
    effects: [`recorded human decision ${decisionId}`],
    result: { decision_id: decisionId, appeal_close_tick: appealCloseTick },
  };
}

function matchesAppealRole(award, principalId, role) {
  const bindings = award.role_bindings;
  if (role === "REQUESTER") {
    return bindings.requester_principal_id === principalId;
  }
  if (role === "WORKER") {
    return bindings.worker_principal_id === principalId;
  }
  if (role === "MAINTAINER") {
    return bindings.maintainer_principal_id === principalId;
  }
  return role === "SPONSOR" && bindings.sponsor_principal_ids.includes(principalId);
}

function handleFileAppeal(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  const policy = job.accepted_contract?.appeal;
  const decision = state.decisions[job.human_decision_root];
  const priorAppeals = (job.appeal_ids ?? []).map((id) => state.appeals[id]);
  invariant(policy, "ERR_APPEAL_INELIGIBLE", "job has no appeal policy");
  invariant(
    policy.filing_deadline_ticks >= 1,
    "ERR_APPEALS_DISABLED",
    "appeals are disabled",
  );
  invariant(
    priorAppeals.length < policy.maximum_rounds,
    "ERR_APPEAL_INELIGIBLE",
    "maximum appeal rounds are exhausted",
  );
  invariant(
    decision &&
      p.decision_root === decision.decision_id &&
      !job.active_appeal_id &&
      ["REVIEW", "HOLD"].includes(job.state) &&
      state.tick >= decision.decision_tick &&
      state.tick < job.appeal_close_tick,
    "ERR_APPEAL_EXPIRED",
    "appeal is outside the current filing window",
  );
  invariant(
    job.accepted_contract.award.eligible_appeal_principal_ids.includes(
      event.actor_id,
    ) &&
      matchesAppealRole(
        job.accepted_contract.award,
        event.actor_id,
        p.claimed_role,
      ) &&
      policy.allowed_grounds.includes(p.ground),
    "ERR_APPEAL_INELIGIBLE",
    "appellant role or ground is not contract-eligible",
  );
  const disputedPayoutIds = [...p.disputed_payout_ids].sort();
  invariant(
    new Set(disputedPayoutIds).size === disputedPayoutIds.length &&
      disputedPayoutIds.every((id) => {
        const payout = state.payouts[id];
        return payout?.job_id === job.job_id && payout.status === "PENDING";
      }),
    "ERR_APPEAL_INELIGIBLE",
    "appeal names an invalid disputed payout",
  );
  for (const payoutId of disputedPayoutIds) {
    updateRecord(state, "payouts", payoutId, "PAYOUT", {
      dispute_status: "FROZEN",
    });
  }
  const resolutionCloseTick = checkedAdd(
    state.tick,
    policy.resolution_deadline_ticks,
  );
  const appealId = creationId(event, {
    prefix: "APPEAL",
    objectType: "APPEAL",
    naturalKey: {
      job_id: job.job_id,
      round: priorAppeals.length + 1,
      decision_root: decision.decision_id,
      appellant_principal_id: event.actor_id,
    },
    parentIds: [
      job.job_id,
      decision.decision_id,
      ...(priorAppeals.length === 0
        ? []
        : [priorAppeals[priorAppeals.length - 1].appeal_id]),
    ],
    nonce: p.appeal_nonce,
  });
  putNewRecord(state, "appeals", "appeal_id", appealId, "APPEAL", {
    job_id: job.job_id,
    round: priorAppeals.length + 1,
    parent_appeal_id:
      priorAppeals.length === 0
        ? null
        : priorAppeals[priorAppeals.length - 1].appeal_id,
    appellant_principal_id: event.actor_id,
    claimed_role: p.claimed_role,
    ground: p.ground,
    decision_root: decision.decision_id,
    prior_job_state: job.state,
    filed_tick: state.tick,
    appeal_close_tick: job.appeal_close_tick,
    resolution_close_tick: resolutionCloseTick,
    disputed_payout_ids: disputedPayoutIds,
    evidence_packet_root: p.evidence_packet_root,
    resolver_principal_id: null,
    resolution_root: null,
    status: "FILED",
  });
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: "DISPUTED",
    active_appeal_id: appealId,
    appeal_ids: [...(job.appeal_ids ?? []), appealId],
    hold_deadline_tick: null,
    timeout_abort_required: false,
    abort_authorization_root: null,
  });
  return {
    jobId: job.job_id,
    effects: [`filed appeal ${appealId}`],
    result: {
      appeal_id: appealId,
      resolution_close_tick: resolutionCloseTick,
    },
  };
}

function handleResolveAppeal(state, event) {
  const p = event.payload;
  const appeal = state.appeals[p.appeal_id];
  invariant(appeal, "ERR_APPEAL_INELIGIBLE", "appeal is missing");
  const job = getJob(state, appeal.job_id);
  const policy = job.accepted_contract.appeal;
  invariant(
    job.state === "DISPUTED" &&
      job.active_appeal_id === appeal.appeal_id &&
      appeal.status === "FILED" &&
      state.tick >= appeal.filed_tick &&
      state.tick < appeal.resolution_close_tick,
    "ERR_APPEAL_RESOLUTION_EXPIRED",
    "appeal is not resolvable in the current window",
  );
  const validPayoutIds = [...p.valid_payout_ids].sort();
  const invalidPayoutIds = [...p.invalid_payout_ids].sort();
  const classified = [...validPayoutIds, ...invalidPayoutIds].sort();
  invariant(
    new Set(classified).size === classified.length &&
      classified.join("\u0000") ===
        [...appeal.disputed_payout_ids].sort().join("\u0000") &&
      (p.resolution !== "INVALID_PAYOUT" ||
        validPayoutIds.length === 0),
    "ERR_APPEAL_INELIGIBLE",
    "appeal payout classification is not an exact partition",
  );
  invariant(
    policy.resolver_principal_ids.includes(event.actor_id) &&
      (!policy.resolver_must_not_be_party ||
        !job.accepted_contract.award.party_principal_ids.includes(
          event.actor_id,
        )),
    "ERR_APPEAL_PARTY_CONFLICT",
    "resolver is unavailable or a bound party",
  );
  invariant(
    ["UPHOLD", "ABORT", "INVALID_PAYOUT"].includes(p.resolution),
    "ERR_SCHEMA",
    "unsupported v0 appeal resolution",
  );
  const resolutionBody = {
    schema: "nexus-appeal-resolution-v1",
    appeal_id: appeal.appeal_id,
    job_id: job.job_id,
    resolver_principal_id: event.actor_id,
    resolution: p.resolution,
    evidence_root: p.evidence_root,
    reason_codes: [...p.reason_codes].sort(),
    resolution_tick: state.tick,
    nonce: p.resolution_nonce,
  };
  const resolutionRoot = hash(
    "NEXUS_APPEAL_RESOLUTION_AUTHORITY_V1",
    resolutionBody,
  );
  for (const payoutId of validPayoutIds) {
    updateRecord(state, "payouts", payoutId, "PAYOUT", {
      dispute_status: "VALID",
    });
  }
  if (invalidPayoutIds.length > 0) {
    for (const payoutId of invalidPayoutIds) {
      const payout = state.payouts[payoutId];
      if (payout.status !== "PENDING") continue;
      moveWholeLots(state, {
        lotIds: [...payout.funding_lot_ids],
        sourceBucket: "PAYOUT",
        sourceId: payout.payout_id,
        targetBucket: "JOB",
        targetId: job.job_id,
      });
      updateRecord(state, "payouts", payout.payout_id, "PAYOUT", {
        dispute_status: "INVALID",
        status: "CANCELLED",
      });
    }
  }
  updateRecord(state, "appeals", appeal.appeal_id, "APPEAL", {
    resolver_principal_id: event.actor_id,
    resolution_root: resolutionRoot,
    resolution: p.resolution,
    status: "RESOLVED",
  });
  const priorState = appeal.prior_job_state;
  const returnsToHold =
    p.resolution === "INVALID_PAYOUT" || priorState === "HOLD";
  const nextHoldRoot = returnsToHold
    ? `HOLD-${hash("NEXUS_HOLD_ROOT_V1", {
        job_id: job.job_id,
        contract_root: job.accepted_contract_root,
        attempt: job.attempt,
        artifact_root: job.final_artifact_root,
        packet_root: job.review_packet_root,
        ordered_review_hashes: [],
        deterministic_evidence_root: job.deterministic_evidence_root,
        ordered_reason_codes: ["ERR_REVIEW_DISSENT"],
        policy_root: job.accepted_contract.policy_root,
        appeal_resolution_root: resolutionRoot,
      })}`
    : null;
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state:
      p.resolution === "ABORT"
        ? "DISPUTED"
        : returnsToHold
          ? "HOLD"
          : "REVIEW",
    active_appeal_id: null,
    hold_root: nextHoldRoot ?? job.hold_root,
    hold_deadline_tick: returnsToHold
      ? checkedAdd(
          state.tick,
          job.accepted_contract.hold.resolution_timeout_ticks,
        )
      : null,
    timeout_abort_required: false,
    abort_authorization_root:
      p.resolution === "ABORT" ? resolutionRoot : null,
  });
  return {
    jobId: job.job_id,
    effects: [`resolved appeal ${appeal.appeal_id} as ${p.resolution}`],
    result: { resolution_root: resolutionRoot, resolution: p.resolution },
  };
}

function creditConsumedLot(state, lot, accountId) {
  invariant(lot.status === "ACTIVE", "ERR_FUNDING_LOT_OWNER", "lot is not active");
  const account = getAccount(state, accountId);
  invariant(
    ["ACTIVE", "FROZEN"].includes(account.status),
    "ERR_FUNDING_LOT_OWNER",
    "terminal destination account is unavailable",
  );
  updateRecord(state, "accounts", account.account_id, "ACCOUNT", {
    available: checkedAdd(account.available, lot.amount),
  });
  updateRecord(state, "funding_lots", lot.lot_id, "FUNDING_LOT", {
    status: "CONSUMED",
  });
}

function closeJobChildren(state, jobId, contributionOutcomes) {
  const definitions = [
    ["bid_rounds", "BID_ROUND", "CLOSED"],
    ["bids", "BID", "CLOSED"],
    ["allowances", "ALLOWANCE", "CLOSED"],
    ["subwork_commitments", "SUBWORK_COMMITMENT", "CLOSED"],
    ["tasks", "TASK", "CLOSED"],
    ["leases", "LEASE", "CLOSED"],
    ["review_assignments", "REVIEW_ASSIGNMENT", "CLOSED"],
    ["appeals", "APPEAL", "CLOSED"],
  ];
  const closed = [];
  for (const [mapName, objectType, status] of definitions) {
    const records = Object.values(state[mapName])
      .filter((record) => record.job_id === jobId)
      .sort((left, right) => {
        const leftId = left[recordIdKey(objectType)];
        const rightId = right[recordIdKey(objectType)];
        return leftId.localeCompare(rightId);
      });
    for (const record of records) {
      const id = record[recordIdKey(objectType)];
      if (record.status !== status) {
        updateRecord(state, mapName, id, objectType, { status });
      }
      closed.push(id);
    }
  }
  for (const contribution of Object.values(state.contributions)
    .filter((record) => record.job_id === jobId)
    .sort((a, b) => a.contribution_id.localeCompare(b.contribution_id))) {
    const status = contributionOutcomes.get(contribution.contribution_id) ?? "CLOSED";
    if (contribution.status !== status) {
      updateRecord(
        state,
        "contributions",
        contribution.contribution_id,
        "CONTRIBUTION",
        { status },
      );
    }
    closed.push(contribution.contribution_id);
  }
  for (const payout of Object.values(state.payouts)
    .filter((record) => record.job_id === jobId)
    .sort((a, b) => a.payout_id.localeCompare(b.payout_id))) {
    invariant(
      ["PAID", "CANCELLED"].includes(payout.status),
      "ERR_LIVE_TERMINAL_CHILD",
      `${payout.payout_id} is not terminal`,
    );
    closed.push(payout.payout_id);
  }
  return closed.sort();
}

function terminalize(state, event, job, terminalKind, authorizationRoot) {
  invariant(
    job.terminal_event_id === null && !state.terminal_jobs[job.job_id],
    "ERR_ALREADY_TERMINAL",
    "job already has terminal settlement evidence",
  );
  invariant(
    !job.active_appeal_id,
    "ERR_APPEAL_INELIGIBLE",
    "a job with an active appeal cannot terminalize",
  );
  const contract = job.accepted_contract ?? job.draft_contract;
  const contributionOutcomes = new Map();
  const paid = [];
  const residue = [];

  for (const payout of Object.values(state.payouts)
    .filter(
      (item) =>
        item.job_id === job.job_id &&
        item.status === "PENDING" &&
        (item.dispute_status === "INVALID" ||
          (terminalKind === "ABORTED" && item.dispute_status === "FROZEN")),
    )
    .sort((left, right) => left.payout_id.localeCompare(right.payout_id))) {
    moveWholeLots(state, {
      lotIds: [...payout.funding_lot_ids],
      sourceBucket: "PAYOUT",
      sourceId: payout.payout_id,
      targetBucket: "JOB",
      targetId: job.job_id,
    });
    updateRecord(state, "payouts", payout.payout_id, "PAYOUT", {
      dispute_status: "INVALID",
      status: "CANCELLED",
    });
  }
  for (const payout of Object.values(state.payouts)
    .filter((item) => item.job_id === job.job_id && item.status === "PENDING")
    .sort((left, right) => left.payout_id.localeCompare(right.payout_id))) {
    invariant(
      !["FROZEN", "INVALID"].includes(payout.dispute_status),
      "ERR_APPEAL_INELIGIBLE",
      `${payout.payout_id} is not authorized for terminal payment`,
    );
    let paidAmount = 0;
    for (const lotId of [...payout.funding_lot_ids].sort()) {
      const lot = state.funding_lots[lotId];
      if (lot.status !== "ACTIVE") continue;
      paidAmount = checkedAdd(paidAmount, lot.amount);
      creditConsumedLot(state, lot, payout.recipient_account_id);
    }
    invariant(
      paidAmount === payout.amount,
      "ERR_FUNDING_TOTAL",
      `${payout.payout_id} funding does not equal declared payout`,
    );
    updateRecord(state, "payouts", payout.payout_id, "PAYOUT", {
      status: "PAID",
    });
    paid.push({
      payout_id: payout.payout_id,
      recipient_account_id: payout.recipient_account_id,
      amount: paidAmount,
      kind: payout.kind,
    });
  }

  const activeJobLots = Object.values(state.funding_lots)
    .filter((lot) => {
      if (lot.status !== "ACTIVE") return false;
      const contribution = state.contributions[lot.source_contribution_id];
      return contribution?.job_id === job.job_id;
    })
    .sort((left, right) => left.lot_id.localeCompare(right.lot_id));
  for (const lot of activeJobLots) {
    const contribution = state.contributions[lot.source_contribution_id];
    let destination = lot.source_account_id;
    let outcome = "RETURNED";
    if (
      terminalKind !== "CANCELLED" &&
      contribution.kind === "DONATION_INTENT"
    ) {
      destination = contract.project.project_pool_account_id;
      outcome = "PROJECT_POOL";
    }
    creditConsumedLot(state, lot, destination);
    contributionOutcomes.set(contribution.contribution_id, outcome);
    residue.push({
      lot_id: lot.lot_id,
      contribution_id: contribution.contribution_id,
      destination_account_id: destination,
      amount: lot.amount,
      outcome,
    });
  }

  const closedChildIds = closeJobChildren(
    state,
    job.job_id,
    contributionOutcomes,
  );
  const jobAccount = getAccount(state, job.job_account_id);
  updateRecord(state, "accounts", jobAccount.account_id, "ACCOUNT", {
    status: "CLOSED",
  });
  closedChildIds.push(jobAccount.account_id);
  closedChildIds.sort();
  const settlementBody = {
    schema: "nexus-settlement-v1",
    job_id: job.job_id,
    terminal_kind: terminalKind,
    authorization_root: authorizationRoot,
    paid,
    residue,
    closed_child_ids: closedChildIds,
    terminal_tick: state.tick,
  };
  const settlementRoot = hash("NEXUS_SETTLEMENT_V1", settlementBody);
  const closureRoot = hash("NEXUS_TERMINAL_CLOSURE_V1", {
    job_id: job.job_id,
    terminal_kind: terminalKind,
    closed_child_ids: closedChildIds,
    job_account_id: job.job_account_id,
  });
  const finalState =
    terminalKind === "SETTLED"
      ? "SETTLED"
      : terminalKind === "CANCELLED"
        ? "CANCELLED"
        : "ABORTED";
  updateRecord(state, "jobs", job.job_id, "JOB", {
    state: finalState,
    terminal_event_id: event.event_id,
    timeout_abort_required: false,
    active_appeal_id: null,
    abort_authorization_root: null,
    settlement_root: settlementRoot,
    closure_root: closureRoot,
  });
  state.terminal_jobs[job.job_id] = {
    job_id: job.job_id,
    terminal_kind: finalState,
    terminal_event_id: event.event_id,
    settlement_root: settlementRoot,
    closure_root: closureRoot,
    terminal_tick: state.tick,
  };
  return { settlementRoot, closureRoot, paid, residue };
}

function handleSettleJob(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    job.state === "REVIEW" &&
      job.accepted_contract.decision_authority.settlement_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_AUTHORITY",
    "actor cannot settle job",
  );
  const decision = state.decisions[job.human_decision_root];
  invariant(
    decision?.decision === "ACCEPT" &&
      decision.clearance_root === job.clearance_root &&
      p.contract_root === job.accepted_contract_root &&
      p.artifact_root === job.final_artifact_root &&
      p.clearance_root === job.clearance_root &&
      p.decision_root === job.human_decision_root &&
      !job.active_appeal_id &&
      state.tick >= job.appeal_close_tick,
    "ERR_HUMAN_DECISION",
    "settlement decision/appeal window is incomplete",
  );
  const outcome = terminalize(
    state,
    event,
    job,
    "SETTLED",
    job.human_decision_root,
  );
  return {
    jobId: job.job_id,
    effects: [
      `settled job ${job.job_id}`,
      `settlement root ${outcome.settlementRoot}`,
    ],
    result: {
      settlement_root: outcome.settlementRoot,
      closure_root: outcome.closureRoot,
    },
  };
}

function handleAbortJob(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(job.accepted_contract, "ERR_AUTHORITY", "job has no accepted contract");
  invariant(
    ["ACTIVE", "REVIEW", "HOLD", "DISPUTED"].includes(job.state),
    "ERR_ALREADY_TERMINAL",
    "job cannot abort from current state",
  );
  invariant(
    !job.active_appeal_id,
    "ERR_APPEAL_INELIGIBLE",
    "active appeal must resolve before abort",
  );
  const timeoutAuthorized =
    job.timeout_abort_required &&
    job.accepted_contract.decision_authority.timeout_executor_principal_ids.includes(
      event.actor_id,
    );
  const timeoutRoot = job.hold_root;
  const resolvedAbortAppeal = Object.values(state.appeals).find(
    (appeal) =>
      appeal.job_id === job.job_id &&
      appeal.status === "RESOLVED" &&
      appeal.resolution === "ABORT" &&
      appeal.resolution_root === job.abort_authorization_root,
  );
  const resolvedAppealAuthorized =
    Boolean(resolvedAbortAppeal) &&
    job.accepted_contract.decision_authority.timeout_executor_principal_ids.includes(
      event.actor_id,
    );
  const abortDecision = state.decisions[job.abort_authorization_root];
  const decisionAuthorized =
    abortDecision?.decision === "ABORT" &&
    job.appeal_ids.length === 0 &&
    state.tick >= job.appeal_close_tick &&
    job.accepted_contract.decision_authority.settlement_principal_ids.includes(
      event.actor_id,
    );
  const authorizationRoot = resolvedAppealAuthorized
    ? resolvedAbortAppeal.resolution_root
    : timeoutAuthorized
      ? timeoutRoot
      : decisionAuthorized
      ? job.abort_authorization_root
      : null;
  invariant(
    authorizationRoot && p.authorization_root === authorizationRoot,
    "ERR_HOLD_BINDING",
    "abort lacks exact current timeout/decision authority",
  );
  const outcome = terminalize(
    state,
    event,
    job,
    "ABORTED",
    authorizationRoot,
  );
  return {
    jobId: job.job_id,
    effects: [`aborted job ${job.job_id}`, `paid undisputed accrued work`],
    result: {
      settlement_root: outcome.settlementRoot,
      closure_root: outcome.closureRoot,
    },
  };
}

function handleCancelJob(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_id);
  invariant(
    ["OPEN", "PENDING_ACCEPT"].includes(job.state) &&
      !job.accepted_contract &&
      job.requester_principal_id === event.actor_id,
    "ERR_CONTRACT_ALREADY_ACCEPTED",
    "requester cancellation is no longer available",
  );
  const outcome = terminalize(
    state,
    event,
    job,
    "CANCELLED",
    hash("NEXUS_CANCEL_AUTHORITY_V1", {
      requester_principal_id: event.actor_id,
      job_id: job.job_id,
      predecessor_root: event.expected_predecessor_root,
    }),
  );
  return {
    jobId: job.job_id,
    effects: [`cancelled job ${job.job_id}`, `returned pre-acceptance funding`],
    result: {
      settlement_root: outcome.settlementRoot,
      closure_root: outcome.closureRoot,
    },
  };
}

function handleRevokeContribution(state, event) {
  const p = event.payload;
  const contribution = state.contributions[p.contribution_id];
  invariant(contribution, "ERR_CONTRIBUTION_STATE", "contribution is missing");
  const job = getJob(state, contribution.job_id);
  invariant(
    contribution.sponsor_principal_id === event.actor_id &&
      contribution.status === "RESERVED" &&
      job.state === "OPEN",
    "ERR_CONTRIBUTION_STATE",
    "contribution is not revocable",
  );
  for (const lotId of contribution.funding_lot_ids) {
    const lot = state.funding_lots[lotId];
    if (lot.status === "ACTIVE") creditConsumedLot(state, lot, lot.source_account_id);
  }
  updateRecord(
    state,
    "contributions",
    contribution.contribution_id,
    "CONTRIBUTION",
    { status: "REVOKED" },
  );
  return {
    jobId: job.job_id,
    effects: [`revoked contribution ${contribution.contribution_id}`],
  };
}

function handleConsumeEntropyAuthority(state, event) {
  const p = event.payload;
  invariant(
    p.schema === "nexus-consume-entropy-authority-v1",
    "ERR_SCHEMA",
    "unsupported entropy consumption event payload",
  );
  const claimRoot = entropyOneUseClaimV1Root(p.claim);
  const authority =
    state.entropy_freshness_authorities[p.claim.authority_root];
  invariant(
    authority?.authority_id === p.claim.authority_id &&
      authority.status === "AVAILABLE" &&
      authority.authority.purpose === p.claim.purpose &&
      authority.authority.scope_root === p.claim.scope_root &&
      authority.authority.nonce_commitment === p.claim.nonce_commitment,
    "ERR_NONCE_REPLAY",
    "entropy authority is missing, changed, or already consumed",
  );
  const job = getJob(state, authority.job_id);
  invariant(
    TERMINAL_STATES.has(job.state) &&
      job.accepted_contract.authority_ceiling.publication_principal_ids.includes(
        event.actor_id,
      ),
    "ERR_AUTHORITY",
    "actor cannot consume entropy for this terminal job",
  );
  let expectedUseScopeRoot;
  if (p.claim.purpose === "DISCLOSURE_PREPARATION") {
    const matches = Object.values(
      state.disclosure_preparation_authorities,
    ).filter(
      (record) =>
        record.preparation_authority.entropy_freshness_authority_id ===
          authority.authority_id &&
        record.preparation_authority.entropy_freshness_authority_root ===
          authority.authority_root,
    );
    invariant(
      matches.length === 1,
      "ERR_NONCE_REPLAY",
      "preparation entropy does not resolve one accepted authority",
    );
    expectedUseScopeRoot = disclosurePreparationUseScopeRoot({
      preparationAuthorityId: matches[0].authority_id,
      preparationAuthorityRoot:
        matches[0].disclosure_preparation_authority_root,
      exportNonceCommitment: authority.authority.nonce_commitment,
    });
  } else if (p.claim.purpose === "PUBLICATION_INTENT") {
    expectedUseScopeRoot = publicationIntentUseScopeRoot({
      binding: authority.binding,
      nonceAuthorityId: authority.authority_id,
      nonceAuthorityRoot: authority.authority_root,
      nonceCommitment: authority.authority.nonce_commitment,
      scopeRoot: authority.authority.scope_root,
    });
  } else {
    const matches = [];
    for (const preparation of Object.values(
      state.disclosure_preparation_authorities,
    )) {
      const proof =
        state.disclosure_proof_contexts[
          preparation.preparation_authority
            .disclosure_proof_context_id
        ];
      for (const item of proof.carrier.proof_context.proofs) {
        if (
          item.entropy_authority_id === authority.authority_id &&
          item.entropy_authority_root === authority.authority_root
        ) {
          matches.push({ preparation, proof, item });
        }
      }
    }
    invariant(
      matches.length === 1,
      "ERR_NONCE_REPLAY",
      "salt entropy does not resolve one accepted preparation",
    );
    const match = matches[0];
    expectedUseScopeRoot = disclosureSaltUseScopeRoot({
      disclosureProofContextRecordRoot: match.proof.record_root,
      disclosureProofContextRoot: match.proof.proof_context_root,
      nonceCommitment: authority.authority.nonce_commitment,
      path: match.item.path,
      preparationAuthorityId: match.preparation.authority_id,
      preparationAuthorityRoot:
        match.preparation.disclosure_preparation_authority_root,
    });
  }
  invariant(
    p.claim.use_scope_root === expectedUseScopeRoot &&
      !state.export_nonce_uses[p.claim.nonce_commitment],
    "ERR_NONCE_REPLAY",
    "entropy claim scope or global one-use state is invalid",
  );
  const consumptionBase = {
    schema: "nexus-entropy-one-use-consumption-v1",
    authority_id: p.claim.authority_id,
    authority_root: p.claim.authority_root,
    purpose: p.claim.purpose,
    scope_root: p.claim.scope_root,
    nonce_commitment: p.claim.nonce_commitment,
    use_scope_root: p.claim.use_scope_root,
    use_claim_root: claimRoot,
    consuming_event_id: event.event_id,
    previous_application_state_root: event.expected_predecessor_root,
  };
  const consumptionId = derivedCarrierId(
    "ENTROPY_ONE_USE_CONSUMPTION",
    consumptionBase,
  );
  const consumption = {
    ...consumptionBase,
    consumption_id: consumptionId,
  };
  invariant(
    !state.entropy_one_use_consumptions[consumptionId],
    "ERR_NONCE_REPLAY",
    "entropy consumption identity is already used",
  );
  const consumptionRoot = entropyOneUseConsumptionV1Root(consumption);
  state.entropy_one_use_consumptions[consumptionId] = {
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
    consumption,
    status: "CONSUMED",
  };
  state.entropy_freshness_authorities[p.claim.authority_root] = {
    ...authority,
    status: "CONSUMED",
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
  };
  state.export_nonce_uses[p.claim.nonce_commitment] = {
    authority_id: p.claim.authority_id,
    authority_root: p.claim.authority_root,
    purpose: p.claim.purpose,
    export_nonce_commitment: p.claim.nonce_commitment,
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
    use_claim_root: claimRoot,
    use_event_id: event.event_id,
    publication_event_id: null,
    used_tick: state.tick,
  };
  return {
    jobId: job.job_id,
    effects: [`consumed entropy authority as ${consumptionId}`],
    result: {
      consumption_id: consumptionId,
      consumption_root: consumptionRoot,
      use_claim_root: claimRoot,
    },
  };
}

function assertCarrierEnvelope(event, expectedSchema) {
  invariant(
    event.payload.schema === expectedSchema,
    "ERR_SCHEMA",
    `unsupported ${event.event_type} carrier schema`,
  );
  return event.payload.body;
}

function carrierJob(state, event, runtimeContext, jobId, contractRoot = null) {
  const job = getJob(state, jobId);
  const terminalReceiptId =
    runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id;
  invariant(
    TERMINAL_STATES.has(job.state) &&
      job.accepted_contract &&
      (contractRoot === null || contractRoot === job.accepted_contract_root) &&
      job.accepted_contract.authority_ceiling.publication_principal_ids.includes(
        event.actor_id,
      ) &&
      terminalReceiptId,
    "ERR_AUTHORITY",
    "carrier is not authorized for the exact terminal job/contract",
  );
  return job;
}

function putAcceptedCarrier(state, event, mapName, id, root, body) {
  invariant(
    !state[mapName][id] &&
      !Object.values(state[mapName]).some(
        (record) => record.record_root === root,
      ),
    "ERR_NONCE_REPLAY",
    `${mapName} carrier ID/root already accepted`,
  );
  state[mapName][id] = {
    record_id: id,
    record_root: root,
    body: structuredClone(body),
    status: "ACCEPTED",
    accepted_event_id: event.event_id,
    accepted_principal_id: event.actor_id,
    accepted_controller_id: event.auth.controller_id,
    accepted_tick: event.tick,
  };
  return state[mapName][id];
}

function coreConstructedCarrierBody(recordType, idField, input) {
  invariant(
    !Object.hasOwn(input, idField),
    "ERR_ID_PREIMAGE",
    `${recordType} ID is core-constructed and must not be supplied`,
  );
  const id = derivedCarrierId(recordType, input);
  return { ...structuredClone(input), [idField]: id };
}

function publicationApprovalAuthorityFor(job, terminalReceiptId, valuesRoot, descriptorsRoot) {
  return publicationApprovalAuthorityV3Root({
    jobId: job.job_id,
    contractRoot: job.accepted_contract_root,
    terminalReceiptId,
    approvalPolicyRoot:
      job.accepted_contract.privacy.approval_policy_root,
    publicationPrincipalIds:
      job.accepted_contract.authority_ceiling.publication_principal_ids,
  });
}

function entropyRecordById(state, authorityId) {
  return Object.values(state.entropy_freshness_authorities).find(
    (record) => record.authority_id === authorityId,
  );
}

function saltConsumptionReferences(state, preparationRecord) {
  const authority = preparationRecord.preparation_authority;
  const proofRecord =
    state.disclosure_proof_contexts[
      authority.disclosure_proof_context_id
    ];
  invariant(
    proofRecord?.record_root ===
      authority.disclosure_proof_context_record_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "preparation proof-context carrier is missing or changed",
  );
  return proofRecord.carrier.proof_context.proofs
    .filter((proof) => proof.producer === "SALTED_COMMITMENT")
    .map((proof) => {
      const entropy =
        state.entropy_freshness_authorities[
          proof.entropy_authority_root
        ];
      const consumption =
        state.entropy_one_use_consumptions[entropy?.consumption_id];
      invariant(
        entropy?.authority_id === proof.entropy_authority_id &&
          entropy.status === "CONSUMED" &&
          consumption?.consumption_root === entropy.consumption_root &&
          consumption.consumption.purpose === "DISCLOSURE_SALT" &&
          consumption.consumption.use_scope_root ===
            disclosureSaltUseScopeRoot({
              disclosureProofContextRecordRoot: proofRecord.record_root,
              disclosureProofContextRoot:
                proofRecord.carrier.proof_context_root,
              nonceCommitment: entropy.authority.nonce_commitment,
              path: proof.path,
              preparationAuthorityId: preparationRecord.authority_id,
              preparationAuthorityRoot:
                preparationRecord.disclosure_preparation_authority_root,
            }),
        "ERR_NONCE_REPLAY",
        `salt entropy for ${proof.path} is not exactly consumed`,
      );
      return {
        path: proof.path,
        consumption_id: consumption.consumption_id,
        consumption_root: consumption.consumption_root,
      };
    });
}

function preparationContentBinding(
  state,
  preparationRecord,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
) {
  const authority = preparationRecord.preparation_authority;
  const entropy =
    state.entropy_freshness_authorities[
      authority.entropy_freshness_authority_root
    ];
  const consumption =
    state.entropy_one_use_consumptions[entropy?.consumption_id];
  invariant(
    entropy?.authority_id === authority.entropy_freshness_authority_id &&
      entropy.status === "CONSUMED" &&
      consumption?.consumption_root === entropy.consumption_root &&
      consumption.consumption.purpose === "DISCLOSURE_PREPARATION" &&
      consumption.consumption.use_scope_root ===
        disclosurePreparationUseScopeRoot({
          preparationAuthorityId: preparationRecord.authority_id,
          preparationAuthorityRoot:
            preparationRecord.disclosure_preparation_authority_root,
          exportNonceCommitment: authority.export_nonce_commitment,
        }),
    "ERR_NONCE_REPLAY",
    "preparation entropy is missing, changed, or unconsumed",
  );
  const saltEntropyConsumptions =
    saltConsumptionReferences(state, preparationRecord);
  const saltEntropyConsumptionsRoot =
    disclosureSaltEntropyConsumptionsRoot(saltEntropyConsumptions);
  const preparationRoot = disclosurePreparationRoot({
    preparationAuthorityId: preparationRecord.authority_id,
    preparationAuthorityRoot:
      preparationRecord.disclosure_preparation_authority_root,
    jobId: authority.job_id,
    contractRoot: authority.contract_root,
    disclosurePolicyRoot: authority.disclosure_policy_root,
    disclosureProofContextRoot:
      authority.disclosure_proof_context_root,
    preparationEntropyConsumptionId: consumption.consumption_id,
    preparationEntropyConsumptionRoot: consumption.consumption_root,
    exportNonceCommitment: authority.export_nonce_commitment,
    saltEntropyConsumptionsRoot,
    contentPublicValuesRoot,
    contentProofDescriptorsRoot,
  });
  return {
    preparationRoot,
    preparationEntropyConsumption: consumption,
    saltEntropyConsumptions,
  };
}

function exactPreparationForContent(
  state,
  jobId,
  preparationRoot,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
) {
  const matches = Object.values(state.disclosure_preparations).filter(
    (record) =>
      record.preparation.preparation_root === preparationRoot &&
      record.preparation.content_public_values_root ===
        contentPublicValuesRoot &&
      record.preparation.content_proof_descriptors_root ===
        contentProofDescriptorsRoot &&
      state.disclosure_preparation_authorities[
        record.preparation_authority_id
      ]?.preparation_authority.job_id === jobId &&
      record.status === "ACCEPTED",
  );
  invariant(
    matches.length === 1,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "preparation root does not resolve to one exact accepted authority",
  );
  return matches[0];
}

function handleAcceptDisclosurePreparation(
  state,
  event,
  runtimeContext,
) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-accept-disclosure-preparation-v1",
  );
  assertExactObjectKeys(
    input,
    [
      "execution_evidence_root",
      "preparation",
      "preparation_authority_id",
      "preparation_authority_root",
    ],
    [],
    "accept disclosure preparation body",
  );
  assertHexRoot(
    input.execution_evidence_root,
    "preparation execution evidence root",
  );
  const authorityRecord =
    state.disclosure_preparation_authorities[
      input.preparation_authority_id
    ];
  invariant(
    authorityRecord?.disclosure_preparation_authority_root ===
      input.preparation_authority_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "preparation authority is missing or changed",
  );
  const authority = authorityRecord.preparation_authority;
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    authority.job_id,
    authority.contract_root,
  );
  invariant(
    authority.preparation_verifier_principal_id === event.actor_id &&
      authority.preparation_verifier_controller_id ===
        event.auth.controller_id &&
      disclosurePreparationVerifierAuthorityRoot(
        authorityRecord.verifier_authority,
      ) === authority.preparation_verifier_authority_root,
    "ERR_AUTHORITY",
    "preparation verifier actor/controller/authority differs",
  );
  const policy =
    state.disclosure_policies[authority.disclosure_policy_id];
  const proof =
    state.disclosure_proof_contexts[
      authority.disclosure_proof_context_id
    ];
  const entropy =
    state.entropy_freshness_authorities[
      authority.entropy_freshness_authority_root
    ];
  const consumption =
    state.entropy_one_use_consumptions[entropy?.consumption_id];
  const saltEntropyUses = proof.carrier.proof_context.proofs
    .filter((item) => item.producer === "SALTED_COMMITMENT")
    .map((item) => {
      const saltAuthority =
        state.entropy_freshness_authorities[
          item.entropy_authority_root
        ];
      const saltConsumption =
        state.entropy_one_use_consumptions[
          saltAuthority?.consumption_id
        ];
      return {
        path: item.path,
        authority: saltAuthority,
        consumption: saltConsumption,
      };
    });
  const preparation = verifyDisclosurePreparationBindings({
    preparation: input.preparation,
    policy_carrier: policy?.carrier,
    proof_context_carrier: proof?.carrier,
    preparation_authority: authority,
    entropy_authority: entropy,
    entropy_consumption: consumption,
    salt_entropy_uses: saltEntropyUses,
  });
  const preparationIdentity = {
    schema: "nexus-accepted-disclosure-preparation-v1",
    preparation_root: preparation.preparation_root,
    preparation_authority_id: authority.preparation_authority_id,
    preparation_authority_root:
      authorityRecord.disclosure_preparation_authority_root,
    content_public_values_root:
      preparation.content_public_values_root,
    content_proof_descriptors_root:
      preparation.content_proof_descriptors_root,
    verifier_authority_root:
      authority.preparation_verifier_authority_root,
  };
  const preparationId = derivedCarrierId(
    "DISCLOSURE_PREPARATION",
    preparationIdentity,
  );
  const executionBase = {
    schema: "nexus-disclosure-preparation-execution-receipt-v1",
    preparation_id: preparationId,
    preparation_root: preparation.preparation_root,
    preparation_authority_id: authority.preparation_authority_id,
    preparation_authority_root:
      authorityRecord.disclosure_preparation_authority_root,
    content_public_values_root:
      preparation.content_public_values_root,
    content_proof_descriptors_root:
      preparation.content_proof_descriptors_root,
    verifier_authority_root:
      authority.preparation_verifier_authority_root,
    verifier_principal_id: event.actor_id,
    verifier_controller_id: event.auth.controller_id,
    execution_evidence_root: input.execution_evidence_root,
    result: "PASS",
  };
  const executionReceipt = {
    ...executionBase,
    preparation_execution_receipt_id: derivedCarrierId(
      "DISCLOSURE_PREPARATION_EXECUTION_RECEIPT",
      executionBase,
    ),
  };
  const executionReceiptRoot =
    disclosurePreparationExecutionReceiptRoot(executionReceipt);
  const accepted = {
    ...preparationIdentity,
    preparation_id: preparationId,
    execution_receipt_id:
      executionReceipt.preparation_execution_receipt_id,
    execution_receipt_root: executionReceiptRoot,
    status: "ACCEPTED",
  };
  const acceptedRoot = acceptedDisclosurePreparationRoot(accepted);
  invariant(
    !state.disclosure_preparations[preparationId] &&
      !Object.values(state.disclosure_preparations).some(
        (record) =>
          record.preparation_root === preparation.preparation_root,
      ),
    "ERR_NONCE_REPLAY",
    "disclosure preparation is already accepted",
  );
  putAcceptedCarrier(
    state,
    event,
    "disclosure_preparation_execution_receipts",
    executionReceipt.preparation_execution_receipt_id,
    executionReceiptRoot,
    executionReceipt,
  );
  state.disclosure_preparations[preparationId] = {
    ...accepted,
    record_root: acceptedRoot,
    preparation,
    verifier_authority: authorityRecord.verifier_authority,
  };
  return {
    jobId: job.job_id,
    effects: [
      `accepted disclosure preparation ${preparationId}`,
      `accepted preparation execution ${executionReceipt.preparation_execution_receipt_id}`,
    ],
    result: {
      preparation_id: preparationId,
      preparation_record_root: acceptedRoot,
      preparation_root: preparation.preparation_root,
      execution_receipt_id:
        executionReceipt.preparation_execution_receipt_id,
      execution_receipt_root: executionReceiptRoot,
      content_public_values_root:
        preparation.content_public_values_root,
      content_proof_descriptors_root:
        preparation.content_proof_descriptors_root,
    },
  };
}

function handleRecordDisclosureScan(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-record-disclosure-scan-v1",
  );
  assertExactObjectKeys(
    input,
    [
      "content_proof_descriptors_root",
      "content_public_values_root",
      "preparation_id",
      "preparation_record_root",
      "contract_root",
      "job_id",
      "preparation_execution_receipt_id",
      "preparation_execution_receipt_root",
      "preparation_root",
      "result",
      "schema",
      "scanner_authority_root",
      "secret_scan_policy_root",
    ],
    [],
    "record disclosure scan body",
  );
  const body = coreConstructedCarrierBody(
    "DISCLOSURE_SCAN_RECEIPT",
    "scan_receipt_id",
    {
      ...input,
      scanner_principal_id: event.actor_id,
      scanner_controller_id: event.auth.controller_id,
    },
  );
  const root = disclosureScanReceiptRoot(body);
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const preparation = exactPreparationForContent(
    state,
    job.job_id,
    body.preparation_root,
    body.content_public_values_root,
    body.content_proof_descriptors_root,
  );
  const execution =
    state.disclosure_preparation_execution_receipts[
      body.preparation_execution_receipt_id
    ];
  const preparationAuthority =
    state.disclosure_preparation_authorities[
      preparation.preparation_authority_id
    ]?.preparation_authority;
  invariant(
    preparation.preparation_id === body.preparation_id &&
      preparation.record_root === body.preparation_record_root &&
      body.secret_scan_policy_root ===
        job.accepted_contract.privacy.secret_scan_policy_root &&
      body.scanner_authority_root ===
        preparationAuthority.scanner_authority_root &&
      body.scanner_principal_id ===
        preparationAuthority.preparation_verifier_principal_id &&
      body.scanner_controller_id ===
        preparationAuthority.preparation_verifier_controller_id &&
      execution?.record_root ===
        body.preparation_execution_receipt_root &&
      execution.record_id ===
        preparation.execution_receipt_id &&
      execution.body.preparation_root === body.preparation_root &&
      execution.body.content_public_values_root ===
        body.content_public_values_root &&
      execution.body.content_proof_descriptors_root ===
        body.content_proof_descriptors_root &&
      execution.body.verifier_principal_id === event.actor_id &&
      execution.body.verifier_controller_id ===
        event.auth.controller_id,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "disclosure scan is not bound to the exact preparation/policy",
  );
  putAcceptedCarrier(
    state,
    event,
    "disclosure_scan_receipts",
    body.scan_receipt_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`accepted disclosure scan ${body.scan_receipt_id}`],
    result: { record_id: body.scan_receipt_id, record_root: root },
  };
}

function handleRecordDisclosureApproval(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-record-disclosure-approval-v1",
  );
  const body = coreConstructedCarrierBody(
    "DISCLOSURE_APPROVAL_RECEIPT",
    "approval_receipt_id",
    input,
  );
  const root = disclosureApprovalReceiptRoot(body);
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const scan = state.disclosure_scan_receipts[body.scan_receipt_id];
  const preparation = exactPreparationForContent(
    state,
    job.job_id,
    body.preparation_root,
    body.content_public_values_root,
    body.content_proof_descriptors_root,
  );
  invariant(
    scan?.record_root === body.scan_receipt_root &&
      scan.body.preparation_root === body.preparation_root &&
      scan.body.content_public_values_root ===
        body.content_public_values_root &&
      scan.body.content_proof_descriptors_root ===
        body.content_proof_descriptors_root &&
      body.approval_policy_root ===
        job.accepted_contract.privacy.approval_policy_root &&
      body.approval_authority_root ===
        state.disclosure_preparation_authorities[
          preparation.preparation_authority_id
        ].preparation_authority.approval_authority_root &&
      body.approval_authority_root ===
        publicationApprovalAuthorityFor(
          job,
          runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id,
          body.content_public_values_root,
          body.content_proof_descriptors_root,
        ),
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "disclosure approval is not bound to its accepted scan/authority",
  );
  putAcceptedCarrier(
    state,
    event,
    "disclosure_approval_receipts",
    body.approval_receipt_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`accepted disclosure approval ${body.approval_receipt_id}`],
    result: { record_id: body.approval_receipt_id, record_root: root },
  };
}

function assertPlanRecordRef(ref, recordId, recordRootValue, label) {
  invariant(
    ref &&
      Object.keys(ref).length === 2 &&
      ref.record_id === recordId &&
      ref.record_root === recordRootValue,
    "ERR_PREDECESSOR",
    `${label} reference is stale, forged, or non-exact`,
  );
}

function handleRecordClassifiedInputMeasurement(state, event) {
  const p = event.payload;
  const job = getJob(state, p.job_ref.record_id);
  const task = state.tasks[p.task_ref.record_id];
  const lease = state.leases[p.lease_ref.record_id];
  invariant(task && lease, "ERR_SCHEMA", "input measurement scope is missing");
  assertPlanRecordRef(p.job_ref, job.job_id, job.record_root, "measurement job");
  assertPlanRecordRef(
    p.task_ref,
    task.task_id,
    task.record_root,
    "measurement task",
  );
  assertPlanRecordRef(
    p.lease_ref,
    lease.lease_id,
    lease.record_root,
    "measurement lease",
  );
  const contract = job.accepted_contract;
  const measurementPrincipal = state.principals[event.actor_id];
  const measurementController =
    measurementPrincipal &&
    state.controllers[measurementPrincipal.controller_id];
  invariant(
    contract &&
      lease.job_id === job.job_id &&
      lease.task_id === task.task_id &&
      lease.status === "ACTIVE" &&
      task.status === "LEASED" &&
      event.tick >= lease.not_before_tick &&
      event.tick < lease.expiry_tick &&
      event.tick >= task.earliest_tick &&
      event.tick < task.deadline_tick &&
      event.actor_id === contract.settlement.verification_principal_id &&
      event.actor_id !== job.requester_principal_id &&
      event.actor_id !== lease.worker_principal_id &&
      measurementPrincipal?.status === "ACTIVE" &&
      measurementController?.status === "ACTIVE" &&
      event.auth.controller_id === measurementController?.controller_id &&
      typeof contract.verifier_root === "string" &&
      contract.verifier_root.length > 0,
    "ERR_AUTHORITY",
    "classified input measurement lacks independent contract verifier authority",
  );
  invariant(
    !Object.values(state.classified_input_manifests).some(
      (record) =>
        record.body.lease_ref.record_id === lease.lease_id &&
        record.body.lease_ref.record_root === lease.record_root,
    ),
    "ERR_NONCE_REPLAY",
    "the accepted lease already has an input measurement",
  );
  const offer = Object.values(state.capability_offers).find(
    (record) => capabilityOfferRoot(record) === lease.capability_offer_root,
  );
  invariant(offer, "ERR_SCHEMA", "measurement capability offer is missing");
  invariant(
    Array.isArray(p.entries) &&
      p.entries.length === 1 &&
      Object.keys(p.entries[0]).length === 4 &&
      p.entries[0].input_root === task.input_manifest_root &&
      p.entries[0].input_root === lease.input_manifest_root &&
      p.entries[0].data_class === task.data_class &&
      p.entries[0].data_class === lease.data_class &&
      Number.isSafeInteger(p.entries[0].byte_length) &&
      p.entries[0].byte_length >= 0 &&
      p.entries[0].byte_length <= task.max_input_bytes &&
      p.entries[0].byte_length <= offer.max_input_bytes &&
      typeof p.entries[0].measurement_receipt_root === "string" &&
      /^[0-9a-f]{64}$/.test(p.entries[0].measurement_receipt_root),
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "classified input measurement does not bind exact accepted input facts",
  );
  let totalBytes = 0;
  for (const entry of p.entries) {
    totalBytes = checkedAdd(totalBytes, entry.byte_length);
  }
  const manifest = createClassifiedInputManifest({
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
    input_manifest_root: task.input_manifest_root,
    entries: structuredClone(p.entries),
    total_bytes: totalBytes,
    measurement_method: "CANONICAL_BYTES_V1",
    measurement_authority_root: contract.verifier_root,
    measurement_principal_id: event.actor_id,
    measurement_controller_id: event.auth.controller_id,
    not_before_tick: event.tick,
    expiry_tick: Math.min(
      task.deadline_tick,
      lease.expiry_tick,
      offer.expiry_tick,
    ),
  });
  const root = classifiedInputManifestRoot(manifest);
  putAcceptedCarrier(
    state,
    event,
    "classified_input_manifests",
    manifest.classified_input_manifest_id,
    root,
    manifest,
  );
  return {
    jobId: job.job_id,
    effects: [
      `recorded classified input measurement ${manifest.classified_input_manifest_id}`,
    ],
    result: {
      classified_input_manifest_id: manifest.classified_input_manifest_id,
      classified_input_manifest_root: root,
    },
  };
}

function handleCreateRouteExecutionPlanV2(state, event) {
  const p = event.payload;
  const lease = state.leases[p.lease_ref.record_id];
  invariant(lease, "ERR_SCHEMA", "route execution lease is missing");
  assertPlanRecordRef(p.lease_ref, lease.lease_id, lease.record_root, "lease");
  const job = getJob(state, lease.job_id);
  const task = state.tasks[lease.task_id];
  invariant(task, "ERR_SCHEMA", "route execution task is missing");
  const contract = job.accepted_contract;
  invariant(
    job.requester_principal_id === event.actor_id &&
      contract &&
      contract.decision_authority.review_transition_principal_ids.includes(
        event.actor_id,
      ) &&
      !TERMINAL_STATES.has(job.state) &&
      lease.status === "ACTIVE" &&
      task.status === "LEASED" &&
      event.tick >= lease.not_before_tick &&
      event.tick < lease.expiry_tick &&
      event.tick >= task.earliest_tick &&
      event.tick < task.deadline_tick,
    "ERR_AUTHORITY",
    "route execution plan requires a live lease and job decision authority",
  );
  invariant(
    !Object.values(state.route_execution_plans).some(
      (record) =>
        record.body.lease_ref.record_id === lease.lease_id &&
        record.body.lease_ref.record_root === lease.record_root,
    ),
    "ERR_NONCE_REPLAY",
    "the accepted lease already has a route execution plan",
  );
  const offer = Object.values(state.capability_offers).find(
    (record) => capabilityOfferRoot(record) === lease.capability_offer_root,
  );
  invariant(offer, "ERR_SCHEMA", "route capability offer is missing");
  invariant(
    offer.principal_id === lease.worker_principal_id &&
      offer.worker_seat_id === lease.worker_seat_id &&
      !state.revoked_offer_ids[offer.offer_id] &&
      event.tick >= offer.not_before_tick &&
      event.tick < offer.expiry_tick,
    "ERR_AUTHORITY",
    "route capability offer is not live for the accepted lease",
  );
  const workerPrincipal = state.principals[lease.worker_principal_id];
  const workerController =
    workerPrincipal && state.controllers[workerPrincipal.controller_id];
  invariant(
    workerPrincipal?.status === "ACTIVE" &&
      workerController?.status === "ACTIVE" &&
      offer.authentication.controller_id === workerController.controller_id &&
      offer.authentication.key_id === workerController.key_id &&
      typeof offer.probe_root === "string" &&
      offer.probe_root.length > 0,
    "ERR_AUTHORITY",
    "route worker lacks current probe/offer/controller trust authority",
  );

  const acceptedManifest =
    state.classified_input_manifests[
      p.classified_input_manifest_ref.record_id
    ];
  invariant(
    acceptedManifest &&
      acceptedManifest.record_root ===
        p.classified_input_manifest_ref.record_root &&
      classifiedInputManifestRoot(acceptedManifest.body) ===
        acceptedManifest.record_root &&
      acceptedManifest.status === "ACCEPTED" &&
      acceptedManifest.accepted_principal_id ===
        contract.settlement.verification_principal_id &&
      acceptedManifest.accepted_controller_id ===
        acceptedManifest.body.measurement_controller_id &&
      acceptedManifest.body.measurement_authority_root ===
        contract.verifier_root &&
      acceptedManifest.body.measurement_principal_id !==
        job.requester_principal_id &&
      acceptedManifest.body.measurement_principal_id !==
        lease.worker_principal_id &&
      acceptedManifest.body.job_ref.record_id === job.job_id &&
      acceptedManifest.body.job_ref.record_root === job.record_root &&
      acceptedManifest.body.task_ref.record_id === task.task_id &&
      acceptedManifest.body.task_ref.record_root === task.record_root &&
      acceptedManifest.body.lease_ref.record_id === lease.lease_id &&
      acceptedManifest.body.lease_ref.record_root === lease.record_root &&
      acceptedManifest.body.input_manifest_root === task.input_manifest_root &&
      event.tick >= acceptedManifest.body.not_before_tick &&
      event.tick < acceptedManifest.body.expiry_tick,
    "ERR_AUTHORITY",
    "route plan lacks an exact live independent input measurement",
  );

  if (lease.route === "REMOTE") {
    invariant(
      contract.privacy.remote_execution === true &&
        p.data_route_authority_ref !== null,
      "ERR_CONTRACT_AUTHORITY_CEILING",
      "remote execution lacks accepted route authority",
    );
  } else {
    invariant(
      lease.route === "LOCAL" && p.data_route_authority_ref === null,
      "ERR_CONTRACT_AUTHORITY_CEILING",
      "local execution has a forged route authority shape",
    );
  }
  if (p.data_route_authority_ref !== null) {
    const accepted =
      state.data_route_authorities[p.data_route_authority_ref.record_id];
    invariant(
      accepted &&
        accepted.record_root === p.data_route_authority_ref.record_root &&
        dataRouteAuthorityRoot(accepted.body) === accepted.record_root &&
        accepted.body.contract_root === job.accepted_contract_root &&
        accepted.status === "ACCEPTED",
      "ERR_AUTHORITY",
      "data route authority is absent, forged, or stale",
    );
  }

  invariant(
    Array.isArray(p.tool_route_authority_refs),
    "ERR_SCHEMA",
    "tool route authority refs must be an array",
  );
  let priorAuthorityId = null;
  const toolAuthorities = new Map();
  for (const ref of p.tool_route_authority_refs) {
    invariant(
      ref &&
        Object.keys(ref).length === 2 &&
        (priorAuthorityId === null || priorAuthorityId < ref.record_id),
      "ERR_SCHEMA",
      "tool route authority refs must be exact and strictly sorted",
    );
    priorAuthorityId = ref.record_id;
    const accepted = state.tool_route_authorities[ref.record_id];
    invariant(
      accepted &&
        accepted.record_root === ref.record_root &&
        toolRouteAuthorityRoot(accepted.body) === accepted.record_root &&
        accepted.body.job_id === job.job_id &&
        accepted.body.task_id === task.task_id &&
        lease.tools.includes(accepted.body.tool_name) &&
        accepted.body.selected_route === accepted.body.authorized_route &&
        accepted.body.selected_route !== lease.route &&
        accepted.body.data_class === task.data_class &&
        accepted.body.contract_root === job.accepted_contract_root &&
        !toolAuthorities.has(accepted.body.tool_name),
      "ERR_AUTHORITY",
      "tool route authority is absent, forged, redundant, or stale",
    );
    toolAuthorities.set(accepted.body.tool_name, {
      ref: structuredClone(ref),
      body: accepted.body,
    });
  }
  const toolRoutes = lease.tools.map((toolName) => {
    const authority = toolAuthorities.get(toolName) ?? null;
    return {
      tool_name: toolName,
      selected_route:
        authority === null ? lease.route : authority.body.selected_route,
      tool_route_authority_ref:
        authority === null ? null : authority.ref,
    };
  });

  const requiresRedaction = acceptedManifest.body.entries.some(
    (entry) => entry.data_class === "REDACTED",
  );
  invariant(
    requiresRedaction === (p.redaction_approval_ref !== null),
    "ERR_AUTHORITY",
    "redaction approval presence does not match measured inputs",
  );
  if (p.redaction_approval_ref !== null) {
    const accepted =
      state.redaction_approvals[p.redaction_approval_ref.record_id];
    invariant(
      accepted &&
        accepted.record_root === p.redaction_approval_ref.record_root &&
        redactionApprovalV2Root(accepted.body) === accepted.record_root &&
        accepted.body.job_id === job.job_id &&
        accepted.body.task_id === task.task_id &&
        accepted.body.decision === "APPROVED",
      "ERR_AUTHORITY",
      "redaction approval is absent, forged, or stale",
    );
  }

  const matchingCommitments = Object.values(
    state.subwork_commitments,
  ).filter(
    (commitment) =>
      commitment.job_id === job.job_id &&
      commitment.task_id === task.task_id &&
      commitment.recipient_principal_id === lease.worker_principal_id &&
      commitment.recipient_seat_id === lease.worker_seat_id &&
      commitment.capability_offer_root === lease.capability_offer_root &&
      commitment.status === "AUTHORIZED",
  );
  invariant(
    matchingCommitments.length <= 1,
    "ERR_ESCROW",
    "route plan price authority is ambiguous",
  );
  const commitment = matchingCommitments[0] ?? null;
  let allowance = null;
  let spendAmount;
  let fundingLotIds;
  if (commitment !== null) {
    allowance = state.allowances[commitment.allowance_id];
    invariant(
      allowance &&
        allowance.status === "ACTIVE" &&
        allowance.job_id === job.job_id &&
        allowance.agent_seat_id === job.accepted_worker_seat &&
        allowance.subwork_commitment_ids.includes(
          commitment.subwork_commitment_id,
        ) &&
        event.tick >= allowance.not_before_tick &&
        event.tick < allowance.expiry_tick &&
        commitment.amount > 0 &&
        commitment.amount <= allowance.amount_ceiling &&
        event.tick < commitment.expiry_tick,
      "ERR_ESCROW",
      "subwork route price/funding authority is not live",
    );
    spendAmount = commitment.amount;
    fundingLotIds = commitment.funding_lot_ids;
  } else {
    const award = contract.award;
    invariant(
      award &&
        award.worker_principal_id === lease.worker_principal_id &&
        award.worker_seat_id === lease.worker_seat_id &&
        award.capability_offer_root === lease.capability_offer_root &&
        award.lead_worker_amount > 0,
      "ERR_ESCROW",
      "route plan lacks exact accepted lead or subwork price authority",
    );
    spendAmount = award.lead_worker_amount;
    fundingLotIds = job.funding_lot_ids;
  }
  const account = state.accounts[job.job_account_id];
  invariant(
    account &&
      account.owner_job_id === job.job_id &&
      account.kind === "JOB" &&
      account.status === "ACTIVE",
    "ERR_ESCROW",
    "route spend does not bind the live job account",
  );
  const fundingLots = fundingLotIds
    .map((lotId) => state.funding_lots[lotId])
    .sort((left, right) => left.lot_id.localeCompare(right.lot_id));
  invariant(
    fundingLots.length > 0 &&
      fundingLots.every((lot) => lot && lot.status === "ACTIVE"),
    "ERR_ESCROW",
    "route price authority lacks live funding lots",
  );
  let fundedAmount = 0;
  for (const lot of fundingLots) fundedAmount = checkedAdd(fundedAmount, lot.amount);
  invariant(
    spendAmount <= fundedAmount && spendAmount <= contract.work.budget,
    "ERR_ESCROW",
    "derived route price exceeds accepted funding",
  );

  const jobRef = { record_id: job.job_id, record_root: job.record_root };
  const taskRef = { record_id: task.task_id, record_root: task.record_root };
  const leaseRef = { record_id: lease.lease_id, record_root: lease.record_root };
  const offerRef = {
    record_id: offer.offer_id,
    record_root: capabilityOfferRoot(offer),
  };
  const trust = createWorkerTrustAuthority({
    job_ref: jobRef,
    task_ref: taskRef,
    lease_ref: leaseRef,
    capability_offer_ref: offerRef,
    worker_principal_id: lease.worker_principal_id,
    worker_seat_id: lease.worker_seat_id,
    controller_id: workerController.controller_id,
    controller_key_id: workerController.key_id,
    probe_root: offer.probe_root,
    worker_class: offer.worker_class,
    route: offer.route,
    data_classes: structuredClone(offer.data_classes),
    tools: structuredClone(offer.tools),
    runtimes: structuredClone(offer.runtimes),
    egress_allowlist: structuredClone(offer.egress_allowlist),
    isolation_root: offer.isolation_root,
    trusted_worker_policy_root: offer.trusted_worker_policy_root,
    maximum_capability_root: offer.maximum_capability_root,
    not_before_tick: Math.max(lease.not_before_tick, offer.not_before_tick),
    expiry_tick: Math.min(lease.expiry_tick, offer.expiry_tick),
  });
  const trustRoot = workerTrustAuthorityRoot(trust);
  const notBeforeTick = Math.max(
    task.earliest_tick,
    lease.not_before_tick,
    offer.not_before_tick,
    acceptedManifest.body.not_before_tick,
    allowance?.not_before_tick ?? 0,
  );
  const expiryTick = Math.min(
    task.deadline_tick,
    lease.expiry_tick,
    offer.expiry_tick,
    acceptedManifest.body.expiry_tick,
    allowance?.expiry_tick ?? Number.MAX_SAFE_INTEGER,
    commitment?.expiry_tick ?? Number.MAX_SAFE_INTEGER,
  );
  invariant(
    event.tick >= notBeforeTick && event.tick < expiryTick,
    "ERR_PREDECESSOR",
    "derived route execution window is not live",
  );
  const plan = createRouteExecutionPlan({
    job_ref: jobRef,
    task_ref: taskRef,
    lease_ref: leaseRef,
    contract_ref: {
      record_id: `CONTRACT-${job.accepted_contract_root}`,
      record_root: job.accepted_contract_root,
    },
    capability_offer_ref: offerRef,
    classified_input_manifest_ref: structuredClone(
      p.classified_input_manifest_ref,
    ),
    worker_trust_authority_ref: {
      record_id: trust.worker_trust_authority_id,
      record_root: trustRoot,
    },
    data_route_authority_ref: structuredClone(p.data_route_authority_ref),
    redaction_approval_ref: structuredClone(p.redaction_approval_ref),
    tool_routes: toolRoutes,
    selected_route: lease.route,
    requested_tools: structuredClone(lease.tools),
    requested_runtimes: structuredClone(lease.runtimes),
    requested_egress: structuredClone(lease.egress_allowlist),
    job_account_ref: {
      record_id: account.account_id,
      record_root: account.record_root,
    },
    funding_lot_refs: fundingLots.map((lot) => ({
      record_id: lot.lot_id,
      record_root: lot.record_root,
    })),
    allowance_ref:
      allowance === null
        ? null
        : {
            record_id: allowance.allowance_id,
            record_root: allowance.record_root,
          },
    subwork_commitment_ref:
      commitment === null
        ? null
        : {
            record_id: commitment.subwork_commitment_id,
            record_root: commitment.record_root,
          },
    spend_amount: spendAmount,
    not_before_tick: notBeforeTick,
    expiry_tick: expiryTick,
    nonce: p.plan_nonce,
    created_application_state_root: applicationRoot(state),
    created_logical_tick: event.tick,
  });
  const planRoot = routeExecutionPlanV5Root(plan);
  putAcceptedCarrier(
    state,
    event,
    "worker_trust_authorities",
    trust.worker_trust_authority_id,
    trustRoot,
    trust,
  );
  putAcceptedCarrier(
    state,
    event,
    "route_execution_plans",
    plan.route_execution_plan_id,
    planRoot,
    plan,
  );
  return {
    jobId: job.job_id,
    effects: [`created route execution plan ${plan.route_execution_plan_id}`],
    result: {
      route_execution_plan_id: plan.route_execution_plan_id,
      route_execution_plan_root: planRoot,
      classified_input_manifest_id:
        acceptedManifest.body.classified_input_manifest_id,
      classified_input_manifest_root: acceptedManifest.record_root,
      worker_trust_authority_id: trust.worker_trust_authority_id,
      worker_trust_authority_root: trustRoot,
    },
  };
}

function handleConsumeRouteExecutionPlan(state, event) {
  const p = event.payload;
  const context = acceptedRouteContextFromState(state, {
    route_execution_plan_id: p.route_execution_plan_id,
    route_execution_plan_root: p.route_execution_plan_root,
  });
  const decision = deriveDataRouteDecision(context);
  invariant(
    decision.decision_root === p.expected_decision_root &&
      decision.outcome === "ALLOW" &&
      context.consumption === null,
    "ERR_AUTHORITY",
    "route execution decision is stale, denied, or already consumed",
  );
  const lease = context.lease.record;
  invariant(
    event.actor_id === lease.worker_principal_id &&
      event.auth.controller_id ===
        context.worker_trust_authority.record.controller_id,
    "ERR_AUTHORITY",
    "only the exact leased worker controller may consume route authority",
  );
  const consumption = createRoutePlanConsumption({
    route_execution_plan_ref: {
      record_id: p.route_execution_plan_id,
      record_root: p.route_execution_plan_root,
    },
    decision_root: decision.decision_root,
    evaluated_application_state_root:
      decision.evaluated_application_state_root,
    evaluated_logical_tick: decision.evaluated_logical_tick,
    executor_principal_id: event.actor_id,
    executor_controller_id: event.auth.controller_id,
  });
  const root = routePlanConsumptionRoot(consumption);
  putAcceptedCarrier(
    state,
    event,
    "route_plan_consumptions",
    consumption.route_plan_consumption_id,
    root,
    consumption,
  );
  return {
    jobId: context.job.record.job_id,
    effects: [`consumed route execution plan ${p.route_execution_plan_id}`],
    result: {
      record_id: consumption.route_plan_consumption_id,
      record_root: root,
      decision,
    },
  };
}

function handleAuthorizeDataRoute(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(event, "nexus-authorize-data-route-v2");
  const body = coreConstructedCarrierBody(
    "DATA_ROUTE_AUTHORITY",
    "route_authority_id",
    input,
  );
  const root = dataRouteAuthorityRoot(body);
  const job = Object.values(state.jobs).find(
    (item) => item.accepted_contract_root === body.contract_root,
  );
  invariant(job, "ERR_SCHEMA", "data-route contract is missing");
  carrierJob(state, event, runtimeContext, job.job_id, body.contract_root);
  const contract = job.accepted_contract;
  const expectedRemoteRedactionPolicyRoot =
    contract.privacy.remote_execution === true
      ? remoteRedactionPolicyRoot(contract)
      : null;
  invariant(
    body.contract_route_context_root === contractRouteContextRoot(contract) &&
      body.redaction_approval_authority_root ===
        redactionApprovalAuthorityRoot({
          jobId: job.job_id,
          contractRoot: job.accepted_contract_root,
          publicationPrincipalIds:
            contract.authority_ceiling.publication_principal_ids,
        }) &&
      body.redaction_policy_root ===
        contract.privacy.disclosure_policy_root &&
      body.remote_redaction_policy_root ===
        expectedRemoteRedactionPolicyRoot &&
      body.route_policy_root === contract.policy_root,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "data route exceeds the exact contract route ceiling",
  );
  putAcceptedCarrier(
    state,
    event,
    "data_route_authorities",
    body.route_authority_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`authorized data route ${body.route_authority_id}`],
    result: { record_id: body.route_authority_id, record_root: root },
  };
}

function handleAuthorizeToolRoute(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(event, "nexus-authorize-tool-route-v1");
  const body = coreConstructedCarrierBody(
    "TOOL_ROUTE_AUTHORITY",
    "tool_route_authority_id",
    input,
  );
  const root = toolRouteAuthorityRoot(body);
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const task = state.tasks[body.task_id];
  const contract = job.accepted_contract;
  invariant(
    task?.job_id === job.job_id &&
      body.data_class === contract.privacy.data_class &&
      body.selected_route === body.authorized_route &&
      contract.authority_ceiling.allowed_routes.includes(
        body.authorized_route,
      ) &&
      contract.authority_ceiling.allowed_tools.includes(body.tool_name) &&
      body.route_policy_root === contract.policy_root,
    "ERR_CONTRACT_AUTHORITY_CEILING",
    "tool route exceeds the exact task/contract ceiling",
  );
  putAcceptedCarrier(
    state,
    event,
    "tool_route_authorities",
    body.tool_route_authority_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`authorized tool route ${body.tool_route_authority_id}`],
    result: { record_id: body.tool_route_authority_id, record_root: root },
  };
}

function handleRecordRedactionManifest(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-record-redaction-manifest-v2",
  );
  const body = coreConstructedCarrierBody(
    "REDACTION_MANIFEST",
    "redaction_manifest_id",
    input,
  );
  const root = redactionManifestV2Root(body);
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const task = state.tasks[body.task_id];
  const leadSource =
    task?.kind === "LEAD" ? job.final_source_root : null;
  const matchingRoute = Object.values(state.data_route_authorities).find(
    (record) =>
      record.body.contract_root === job.accepted_contract_root &&
      record.body.route_policy_root === body.route_policy_root,
  );
  invariant(
    task?.job_id === job.job_id &&
      body.source_root === leadSource &&
      body.context_root === task.context_root &&
      body.redaction_policy_root ===
        job.accepted_contract.privacy.disclosure_policy_root &&
      body.remote_policy_root ===
        (job.accepted_contract.privacy.remote_execution === true
          ? remoteRedactionPolicyRoot(job.accepted_contract)
          : null) &&
      body.route_policy_root === job.accepted_contract.policy_root &&
      matchingRoute,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "redaction manifest is not bound to exact source/task/route policies",
  );
  putAcceptedCarrier(
    state,
    event,
    "redaction_manifests",
    body.redaction_manifest_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`recorded redaction manifest ${body.redaction_manifest_id}`],
    result: { record_id: body.redaction_manifest_id, record_root: root },
  };
}

function handleApproveRedaction(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(event, "nexus-approve-redaction-v2");
  const body = coreConstructedCarrierBody(
    "REDACTION_APPROVAL",
    "redaction_approval_id",
    input,
  );
  const root = redactionApprovalV2Root(body);
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const manifest = state.redaction_manifests[body.redaction_manifest_id];
  invariant(
    manifest?.record_root === body.redaction_manifest_root &&
      manifest.body.job_id === job.job_id &&
      manifest.body.task_id === body.task_id &&
      manifest.body.reduced_root === body.approved_reduced_root &&
      manifest.body.redaction_policy_root === body.redaction_policy_root &&
      manifest.body.remote_policy_root === body.remote_policy_root &&
      manifest.body.route_policy_root === body.route_policy_root &&
      body.approval_authority_root ===
        redactionApprovalAuthorityRoot({
          jobId: job.job_id,
          contractRoot: job.accepted_contract_root,
          publicationPrincipalIds:
            job.accepted_contract.authority_ceiling
              .publication_principal_ids,
        }),
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "redaction approval is not bound to its exact accepted manifest",
  );
  putAcceptedCarrier(
    state,
    event,
    "redaction_approvals",
    body.redaction_approval_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`approved redaction ${body.redaction_approval_id}`],
    result: { record_id: body.redaction_approval_id, record_root: root },
  };
}

function handleAcceptDisclosureCompilation(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-accept-disclosure-compilation-v2",
  );
  const body = coreConstructedCarrierBody(
    "DISCLOSURE_COMPILATION_ANCHOR",
    "anchor_id",
    input,
  );
  const root = disclosureCompilationAnchorV2Root(body);
  const exportAuthority =
    state.public_export_authorities[body.export_authority_id];
  invariant(exportAuthority, "ERR_SCHEMA", "export authority is missing");
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    exportAuthority.export_authority.job_id,
    exportAuthority.export_authority.contract_root,
  );
  const scan = state.disclosure_scan_receipts[body.scan_receipt_id];
  const approval =
    state.disclosure_approval_receipts[body.approval_receipt_id];
  const manifest =
    state.disclosure_manifests[body.disclosure_manifest_id];
  const preparation =
    state.disclosure_preparations[body.preparation_id];
  invariant(
    scan?.record_root === body.scan_receipt_root &&
      approval?.record_root === body.approval_receipt_root &&
      approval.body.scan_receipt_id === scan.record_id &&
      approval.body.preparation_root === body.preparation_root &&
      preparation?.record_root === body.preparation_record_root &&
      preparation.preparation_root === body.preparation_root &&
      manifest?.record_root === body.disclosure_manifest_root &&
      manifest.body.preparation_id === body.preparation_id &&
      exportAuthority.public_export_authority_root ===
        body.export_authority_root &&
      exportAuthority.status === "ACCEPTED" &&
      body.disclosure_policy_root ===
        job.accepted_contract.privacy.disclosure_policy_root &&
      body.disclosure_proof_context_root ===
        exportAuthority.export_authority.disclosure_proof_context_root &&
      body.compilation_root ===
        disclosureCompilationV2Root({
          preparationRoot: body.preparation_root,
          scanReceiptRoot: body.scan_receipt_root,
          approvalReceiptRoot: body.approval_receipt_root,
          manifestRoot: body.disclosure_manifest_root,
          exportAuthorityRoot: body.export_authority_root,
        }) &&
      job.accepted_compilation_anchor_root === null,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "compilation anchor does not bind exact accepted provenance",
  );
  const acceptedPreparation =
    state.disclosure_preparations[body.preparation_id];
  putAcceptedCarrier(
    state,
    event,
    "disclosure_compilation_anchors",
    body.anchor_id,
    root,
    body,
  );
  updateRecord(state, "jobs", job.job_id, "JOB", {
    accepted_compilation_anchor_root: root,
  });
  return {
    jobId: job.job_id,
    effects: [`accepted disclosure compilation ${body.anchor_id}`],
    result: { record_id: body.anchor_id, record_root: root },
  };
}

function handleAcceptDisclosureManifest(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-accept-disclosure-manifest-v1",
  );
  const body = coreConstructedCarrierBody(
    "DISCLOSURE_MANIFEST",
    "disclosure_manifest_id",
    input,
  );
  const root = publicSafeDisclosureManifestRoot(body);
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const preparation =
    state.disclosure_preparations[body.preparation_id];
  const scan = state.disclosure_scan_receipts[body.scan_receipt_id];
  const approval =
    state.disclosure_approval_receipts[body.approval_receipt_id];
  invariant(
    preparation?.record_root === body.preparation_record_root &&
      preparation.preparation_root === body.preparation_root &&
      preparation.preparation.content_public_values_root ===
        body.content_public_values_root &&
      preparation.preparation.content_proof_descriptors_root ===
        body.content_proof_descriptors_root &&
      canonicalize(preparation.preparation.content_public_values) ===
        canonicalize(body.content_public_values) &&
      canonicalize(
        preparation.preparation.content_proof_descriptors,
      ) === canonicalize(body.content_proof_descriptors) &&
      body.disclosure_policy_root ===
        preparation.preparation.disclosure_policy_root &&
      body.disclosure_proof_context_root ===
        preparation.preparation.disclosure_proof_context_root &&
      scan?.record_root === body.scan_receipt_root &&
      scan.body.preparation_root === body.preparation_root &&
      approval?.record_root === body.approval_receipt_root &&
      approval.body.scan_receipt_id === body.scan_receipt_id &&
      approval.body.preparation_root === body.preparation_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "public-safe manifest differs from accepted preparation/receipts",
  );
  putAcceptedCarrier(
    state,
    event,
    "disclosure_manifests",
    body.disclosure_manifest_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`accepted public-safe disclosure manifest ${body.disclosure_manifest_id}`],
    result: { record_id: body.disclosure_manifest_id, record_root: root },
  };
}

function handleAcceptPublicCapsule(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-accept-public-capsule-v1",
  );
  const body = coreConstructedCarrierBody(
    "PUBLIC_CAPSULE",
    "public_capsule_id",
    input,
  );
  const root = publicCapsuleRoot(body);
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const compilation =
    state.disclosure_compilation_anchors[
      body.accepted_compilation_anchor_id
    ];
  invariant(
    compilation?.record_root ===
        body.accepted_compilation_anchor_root &&
      compilation.body.compilation_root === body.compilation_root &&
      compilation.body.disclosure_manifest_id ===
        body.disclosure_manifest_id &&
      compilation.body.disclosure_manifest_root ===
        body.disclosure_manifest_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "public capsule is not bound to accepted compilation/manifest",
  );
  putAcceptedCarrier(
    state,
    event,
    "public_capsules",
    body.public_capsule_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`accepted public capsule ${body.public_capsule_id}`],
    result: { record_id: body.public_capsule_id, record_root: root },
  };
}

function handleAcceptNonClaims(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-accept-non-claims-v1",
  );
  const body = coreConstructedCarrierBody(
    "NON_CLAIMS",
    "non_claims_id",
    input,
  );
  const root = nonClaimsRoot(body);
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const compilation =
    state.disclosure_compilation_anchors[
      body.accepted_compilation_anchor_id
    ];
  invariant(
    compilation?.record_root ===
        body.accepted_compilation_anchor_root &&
      compilation.body.compilation_root === body.compilation_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "non-claims are not bound to accepted compilation",
  );
  putAcceptedCarrier(
    state,
    event,
    "non_claims",
    body.non_claims_id,
    root,
    body,
  );
  return {
    jobId: job.job_id,
    effects: [`accepted non-claims ${body.non_claims_id}`],
    result: { record_id: body.non_claims_id, record_root: root },
  };
}

function handleAcceptPublication(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(event, "nexus-accept-publication-v3");
  assertExactObjectKeys(
    input,
    ["publication_intent_id", "schema"],
    [],
    "accept publication body",
  );
  invariant(
    input.schema === "nexus-accept-publication-reference-v1",
    "ERR_SCHEMA",
    "unsupported publication acceptance reference",
  );
  const intent = state.publication_intents[input.publication_intent_id];
  invariant(intent, "ERR_SCHEMA", "publication intent is missing");
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    intent.job_id,
  );
  const compilation =
    state.disclosure_compilation_anchors[
      intent.accepted_compilation_anchor_id
    ];
  const capsule = state.public_capsules[intent.public_capsule_id];
  const nonClaims = state.non_claims[intent.non_claims_id];
  const manifest =
    state.disclosure_manifests[intent.disclosure_manifest_id];
  const exportAuthority =
    state.public_export_authorities[
      compilation?.body.export_authority_id
    ];
  const consumption =
    state.entropy_one_use_consumptions[intent.nonce_consumption_id];
  invariant(
    compilation?.record_root ===
        intent.accepted_compilation_anchor_root &&
      capsule?.record_root === intent.public_capsule_root &&
      capsule.body.accepted_compilation_anchor_id ===
        compilation.record_id &&
      nonClaims?.record_root === intent.non_claims_root &&
      nonClaims.body.accepted_compilation_anchor_id ===
        compilation.record_id &&
      manifest?.record_root === intent.disclosure_manifest_root &&
      compilation.body.disclosure_manifest_id === manifest.record_id &&
      exportAuthority.export_authority.job_id === job.job_id &&
      exportAuthority.export_authority.contract_root ===
        job.accepted_contract_root &&
      exportAuthority.status === "ACCEPTED" &&
      exportAuthority.public_export_authority_root ===
        compilation.body.export_authority_root &&
      consumption?.consumption_root === intent.nonce_consumption_root &&
      consumption.consumption.authority_id === intent.nonce_authority_id &&
      consumption.consumption.authority_root ===
        intent.nonce_authority_root &&
      consumption.consumption.purpose === "PUBLICATION_INTENT" &&
      event.actor_id === intent.publication_principal_id &&
      intent.accepted_publication_anchor_root === null &&
      job.accepted_publication_anchor_root === null,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "publication anchor is not bound to exact accepted terminal inputs",
  );
  const anchorBase = {
    schema: "nexus-accepted-publication-anchor-v2",
    publication_intent_id: intent.intent_id,
    publication_intent_root: intent.intent_id.slice("PUBINTENT-".length),
    public_capsule_id: capsule.record_id,
    public_capsule_root: capsule.record_root,
    disclosure_manifest_id: manifest.record_id,
    disclosure_manifest_root: manifest.record_root,
    non_claims_id: nonClaims.record_id,
    non_claims_root: nonClaims.record_root,
    accepted_compilation_anchor_id: compilation.record_id,
    accepted_compilation_anchor_root: compilation.record_root,
    compilation_root: compilation.body.compilation_root,
    export_authority_id: compilation.body.export_authority_id,
    export_authority_root: compilation.body.export_authority_root,
    nonce_consumption_id: consumption.consumption_id,
    nonce_consumption_root: consumption.consumption_root,
    policy_root: job.accepted_contract.policy_root,
    verifier_root: job.accepted_contract.verifier_root,
    source_document_root: compilation.record_root,
    terminal_receipt_id:
      runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id,
    logical_tick: event.tick,
    idempotency_key: event.idempotency_key,
  };
  const body = coreConstructedCarrierBody(
    "PUBLICATION_ANCHOR",
    "publication_anchor_id",
    anchorBase,
  );
  const root = publicationAnchorV2Root(body);
  putAcceptedCarrier(
    state,
    event,
    "publication_anchors",
    body.publication_anchor_id,
    root,
    body,
  );
  state.publication_intents[intent.intent_id] = {
    ...intent,
    accepted_publication_anchor_root: root,
  };
  updateRecord(state, "jobs", job.job_id, "JOB", {
    accepted_publication_anchor_root: root,
  });
  return {
    jobId: job.job_id,
    effects: [`accepted publication ${body.publication_anchor_id}`],
    result: { record_id: body.publication_anchor_id, record_root: root },
  };
}

function handleAcceptDisclosurePolicy(state, event, runtimeContext) {
  const body = assertCarrierEnvelope(
    event,
    "nexus-accept-disclosure-policy-v1",
  );
  assertExactObjectKeys(
    body,
    ["contract_root", "job_id", "policy", "terminal_receipt_id"],
    [],
    "accept disclosure policy body",
  );
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const terminalReceiptId =
    runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id;
  const policyRoot = disclosurePolicyRoot(body.policy);
  invariant(
    body.terminal_receipt_id === terminalReceiptId &&
      policyRoot === job.accepted_contract.privacy.disclosure_policy_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "disclosure policy is not bound to the frozen terminal contract",
  );
  invariant(
    job.terminal_receipt_id === null ||
      job.terminal_receipt_id === terminalReceiptId,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "job terminal receipt was already bound to different bytes",
  );
  if (job.terminal_receipt_id === null) {
    const terminalReceipt = runtimeContext.terminal_receipt;
    invariant(
      job.state === "SETTLED" &&
        terminalReceipt?.receipt_id === terminalReceiptId &&
        terminalReceipt.event_id === job.terminal_event_id &&
        terminalReceipt.job_id === job.job_id &&
        terminalReceipt.next_state_root ===
          runtimeContext.predecessor_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "terminal receipt journal proof is missing or changed",
    );
    updateRecord(state, "jobs", job.job_id, "JOB", {
      terminal_receipt_id: terminalReceiptId,
    });
  }
  const carrierBase = {
    schema: "nexus-accepted-disclosure-policy-v1",
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id: terminalReceiptId,
    policy_root: policyRoot,
    policy: body.policy,
  };
  const policyId = derivedCarrierId("DISCLOSURE_POLICY", carrierBase);
  const carrier = {
    ...carrierBase,
    disclosure_policy_id: policyId,
  };
  const recordRootValue = acceptedDisclosurePolicyCarrierRoot(carrier);
  invariant(
    !state.disclosure_policies[policyId] &&
      !Object.values(state.disclosure_policies).some(
        (record) => record.record_root === recordRootValue,
      ),
    "ERR_NONCE_REPLAY",
    "disclosure policy carrier already exists",
  );
  state.disclosure_policies[policyId] = {
    disclosure_policy_id: policyId,
    record_root: recordRootValue,
    policy_root: policyRoot,
    carrier,
    status: "ACCEPTED",
    revision: 0,
  };
  return {
    jobId: job.job_id,
    effects: [`accepted disclosure policy ${policyId}`],
    result: {
      disclosure_policy_id: policyId,
      disclosure_policy_record_root: recordRootValue,
      disclosure_policy_root: policyRoot,
    },
  };
}

function handleAcceptDisclosureProofContext(state, event, runtimeContext) {
  const body = assertCarrierEnvelope(
    event,
    "nexus-accept-disclosure-proof-context-v2",
  );
  assertExactObjectKeys(
    body,
    [
      "contract_root",
      "disclosure_policy_id",
      "disclosure_policy_root",
      "job_id",
      "proof_context",
      "terminal_receipt_id",
    ],
    [],
    "accept disclosure proof-context body",
  );
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const terminalReceiptId =
    runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id;
  const policy = state.disclosure_policies[body.disclosure_policy_id];
  invariant(
    policy?.policy_root === body.disclosure_policy_root &&
      policy.carrier.job_id === job.job_id &&
      body.terminal_receipt_id === terminalReceiptId,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "proof context does not resolve its accepted disclosure policy",
  );
  assertProofContextMatchesPolicy(body.proof_context, policy.carrier.policy);
  for (const proof of body.proof_context.proofs) {
    if (proof.producer !== "SALTED_COMMITMENT") continue;
    const entropy =
      state.entropy_freshness_authorities[proof.entropy_authority_root];
    invariant(
      entropy?.authority_id === proof.entropy_authority_id &&
        entropy.job_id === job.job_id &&
        entropy.status === "AVAILABLE" &&
        entropy.authority.purpose === "DISCLOSURE_SALT" &&
        entropy.authority.scope_root ===
          disclosureSaltScopeRoot({
            schema: "nexus-disclosure-salt-scope-v2",
            disclosure_policy_root: policy.policy_root,
            path: proof.path,
          }) &&
        entropy.authority.nonce_commitment ===
          disclosureSaltCommitmentRoot({
            path: proof.path,
            salt: proof.salt,
          }),
      "ERR_NONCE_REPLAY",
      `salt authority for ${proof.path} is unavailable or changed`,
    );
  }
  const proofContextRootValue =
    disclosureProofContextRoot(body.proof_context);
  const carrierBase = {
    schema: "nexus-accepted-disclosure-proof-context-v1",
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id: terminalReceiptId,
    proof_context_root: proofContextRootValue,
    proof_context: body.proof_context,
  };
  const proofContextId = derivedCarrierId(
    "DISCLOSURE_PROOF_CONTEXT",
    carrierBase,
  );
  const carrier = {
    ...carrierBase,
    disclosure_proof_context_id: proofContextId,
  };
  const recordRootValue =
    acceptedDisclosureProofContextCarrierRoot(carrier);
  invariant(
    !state.disclosure_proof_contexts[proofContextId] &&
      !Object.values(state.disclosure_proof_contexts).some(
        (record) => record.record_root === recordRootValue,
      ),
    "ERR_NONCE_REPLAY",
    "disclosure proof-context carrier already exists",
  );
  state.disclosure_proof_contexts[proofContextId] = {
    disclosure_proof_context_id: proofContextId,
    record_root: recordRootValue,
    proof_context_root: proofContextRootValue,
    carrier,
    status: "ACCEPTED",
    revision: 0,
  };
  return {
    jobId: job.job_id,
    effects: [`accepted disclosure proof context ${proofContextId}`],
    result: {
      disclosure_proof_context_id: proofContextId,
      disclosure_proof_context_record_root: recordRootValue,
      disclosure_proof_context_root: proofContextRootValue,
    },
  };
}

function handleRegisterEntropyFreshnessAuthority(
  state,
  event,
  runtimeContext,
) {
  const body = assertCarrierEnvelope(
    event,
    "nexus-register-entropy-freshness-authority-v1",
  );
  assertExactObjectKeys(
    body,
    ["authority", "binding", "job_id"],
    [],
    "register entropy authority body",
  );
  const job = carrierJob(state, event, runtimeContext, body.job_id);
  const authorityRoot = entropyFreshnessAuthorityV1Root(body.authority);
  const expectedId = entropyAuthorityContextId(
    event,
    job.job_id,
    body.authority.purpose,
  );
  const scopeRoot = entropyBindingScopeRoot(
    body.authority.purpose,
    body.binding,
  );
  invariant(
    body.authority.scope_root === scopeRoot,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "entropy authority ID/scope is not context-bound",
  );
  if (body.authority.purpose === "DISCLOSURE_PREPARATION") {
    const policy =
      state.disclosure_policies[body.binding.disclosure_policy_id];
    const proof =
      state.disclosure_proof_contexts[
        body.binding.disclosure_proof_context_id
      ];
    invariant(
      body.binding.job_id === job.job_id &&
        body.binding.contract_root === job.accepted_contract_root &&
        body.binding.terminal_event_id === job.terminal_event_id &&
        body.binding.terminal_receipt_id === job.terminal_receipt_id &&
        policy?.record_root ===
          body.binding.disclosure_policy_record_root &&
        proof?.record_root ===
          body.binding.disclosure_proof_context_record_root &&
        policy.carrier.job_id === job.job_id &&
        proof.carrier.job_id === job.job_id &&
        body.binding.secret_scan_policy_root ===
          job.accepted_contract.privacy.secret_scan_policy_root &&
        body.binding.approval_policy_root ===
          job.accepted_contract.privacy.approval_policy_root &&
        body.binding.scanner_authority_root ===
          disclosureScannerAuthorityRoot({
            jobId: job.job_id,
            contractRoot: job.accepted_contract_root,
            secretScanPolicyRoot:
              job.accepted_contract.privacy.secret_scan_policy_root,
            publicationPrincipalIds:
              job.accepted_contract.authority_ceiling
                .publication_principal_ids,
          }) &&
        body.binding.approval_authority_root ===
          publicationApprovalAuthorityFor(
            job,
            job.terminal_receipt_id,
            null,
            null,
          ),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "preparation entropy binding is not an accepted terminal carrier set",
    );
  } else if (body.authority.purpose === "PUBLICATION_INTENT") {
    const compilation = Object.values(
      state.disclosure_compilation_anchors,
    ).find(
      (record) =>
        record.record_root ===
        body.binding.accepted_compilation_anchor_root,
    );
    const capsule = Object.values(state.public_capsules).find(
      (record) => record.record_root === body.binding.capsule_root,
    );
    const nonClaims = Object.values(state.non_claims).find(
      (record) => record.record_root === body.binding.non_claims_root,
    );
    const manifest = Object.values(state.disclosure_manifests).find(
      (record) =>
        record.record_root === body.binding.disclosure_manifest_root,
    );
    invariant(
      body.binding.job_id === job.job_id &&
        body.binding.terminal_event_id === job.terminal_event_id &&
        body.binding.terminal_receipt_id === job.terminal_receipt_id &&
        body.binding.publication_principal_id === event.actor_id &&
        body.binding.destination_policy ===
          "GITHUB_SANITIZED_WITNESS" &&
        compilation?.record_root ===
          body.binding.accepted_compilation_anchor_root &&
        capsule?.body.accepted_compilation_anchor_id ===
          compilation.record_id &&
        nonClaims?.body.accepted_compilation_anchor_id ===
          compilation.record_id &&
        manifest?.record_id ===
          compilation.body.disclosure_manifest_id,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "publication entropy binding is not terminal/principal-bound",
    );
  } else {
    const policy = Object.values(state.disclosure_policies).find(
      (record) =>
        record.carrier.job_id === job.job_id &&
        record.policy_root === body.binding.disclosure_policy_root,
    );
    invariant(
      policy &&
        policy.carrier.policy.fields.some(
          (field) => field.path === body.binding.path,
        ),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "salt entropy binding is outside the accepted policy",
    );
  }
  invariant(
    !state.entropy_freshness_authorities[authorityRoot] &&
      !Object.values(state.entropy_freshness_authorities).some(
        (record) =>
          record.authority_id === expectedId ||
          record.authority.nonce_commitment ===
            body.authority.nonce_commitment,
      ) &&
      !state.export_nonce_uses[body.authority.nonce_commitment],
    "ERR_NONCE_REPLAY",
    "entropy authority ID/root/commitment is already reserved",
  );
  state.entropy_freshness_authorities[authorityRoot] = {
    authority_id: expectedId,
    authority_root: authorityRoot,
    job_id: job.job_id,
    authority: body.authority,
    binding: body.binding,
    status: "AVAILABLE",
    consumption_id: null,
    consumption_root: null,
  };
  return {
    jobId: job.job_id,
    effects: [`registered entropy authority ${expectedId}`],
    result: {
      authority_id: expectedId,
      authority_root: authorityRoot,
    },
  };
}

function handleAuthorizeDisclosurePreparation(
  state,
  event,
  runtimeContext,
) {
  const body = assertCarrierEnvelope(
    event,
    "nexus-authorize-disclosure-preparation-v1",
  );
  assertExactObjectKeys(
    body,
    [
      "approval_policy_root",
      "contract_root",
      "disclosure_policy_id",
      "disclosure_policy_record_root",
      "disclosure_policy_root",
      "disclosure_proof_context_id",
      "disclosure_proof_context_record_root",
      "disclosure_proof_context_root",
      "entropy_freshness_authority_id",
      "entropy_freshness_authority_root",
      "job_id",
      "secret_scan_policy_root",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "authorize disclosure preparation body",
  );
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    body.job_id,
    body.contract_root,
  );
  const policy = state.disclosure_policies[body.disclosure_policy_id];
  const proof =
    state.disclosure_proof_contexts[
      body.disclosure_proof_context_id
    ];
  const entropy =
    state.entropy_freshness_authorities[
      body.entropy_freshness_authority_root
    ];
  const scannerAuthorityRoot = disclosureScannerAuthorityRoot({
    jobId: job.job_id,
    contractRoot: job.accepted_contract_root,
    secretScanPolicyRoot:
      job.accepted_contract.privacy.secret_scan_policy_root,
    publicationPrincipalIds:
      job.accepted_contract.authority_ceiling.publication_principal_ids,
  });
  const approvalAuthorityRoot = publicationApprovalAuthorityFor(
    job,
    job.terminal_receipt_id,
    null,
    null,
  );
  const expectedScope = disclosurePreparationNonceScopeRoot({
    schema: "nexus-disclosure-preparation-nonce-scope-v1",
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id: job.terminal_receipt_id,
    disclosure_policy_id: policy?.disclosure_policy_id,
    disclosure_policy_record_root: policy?.record_root,
    disclosure_proof_context_id:
      proof?.disclosure_proof_context_id,
    disclosure_proof_context_record_root: proof?.record_root,
    secret_scan_policy_root:
      job.accepted_contract.privacy.secret_scan_policy_root,
    approval_policy_root:
      job.accepted_contract.privacy.approval_policy_root,
    scanner_authority_root: scannerAuthorityRoot,
    approval_authority_root: approvalAuthorityRoot,
  });
  invariant(
    body.terminal_event_id === job.terminal_event_id &&
      body.terminal_receipt_id === job.terminal_receipt_id &&
      policy?.record_root === body.disclosure_policy_record_root &&
      policy.policy_root === body.disclosure_policy_root &&
      proof?.record_root === body.disclosure_proof_context_record_root &&
      proof.proof_context_root === body.disclosure_proof_context_root &&
      policy.carrier.job_id === job.job_id &&
      proof.carrier.job_id === job.job_id &&
      body.secret_scan_policy_root ===
        job.accepted_contract.privacy.secret_scan_policy_root &&
      body.approval_policy_root ===
        job.accepted_contract.privacy.approval_policy_root &&
      entropy?.authority_id === body.entropy_freshness_authority_id &&
      entropy.job_id === job.job_id &&
      entropy.status === "AVAILABLE" &&
      entropy.authority.purpose === "DISCLOSURE_PREPARATION" &&
      entropy.authority.scope_root === expectedScope,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "preparation authority inputs are missing, changed, or unbound",
  );
  const authorityId = disclosurePreparationAuthorityContextId(
    event,
    job.job_id,
  );
  const verifierAuthority = {
    schema: "nexus-disclosure-preparation-verifier-authority-v1",
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    preparation_authority_id: authorityId,
    verifier_principal_id: event.actor_id,
    verifier_controller_id: event.auth.controller_id,
    verifier_policy_root: job.accepted_contract.verifier_root,
  };
  const verifierAuthorityRoot =
    disclosurePreparationVerifierAuthorityRoot(verifierAuthority);
  const authority = {
    schema: "nexus-disclosure-preparation-authority-v1",
    preparation_authority_id: authorityId,
    preparation_verifier_principal_id: event.actor_id,
    preparation_verifier_controller_id: event.auth.controller_id,
    preparation_verifier_authority_root: verifierAuthorityRoot,
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id: job.terminal_receipt_id,
    disclosure_policy_id: policy.disclosure_policy_id,
    disclosure_policy_record_root: policy.record_root,
    disclosure_policy_root: policy.policy_root,
    disclosure_proof_context_id: proof.disclosure_proof_context_id,
    disclosure_proof_context_record_root: proof.record_root,
    disclosure_proof_context_root: proof.proof_context_root,
    entropy_freshness_authority_id: entropy.authority_id,
    entropy_freshness_authority_root: entropy.authority_root,
    export_nonce_commitment: entropy.authority.nonce_commitment,
    secret_scan_policy_root:
      job.accepted_contract.privacy.secret_scan_policy_root,
    scanner_authority_root: scannerAuthorityRoot,
    approval_policy_root:
      job.accepted_contract.privacy.approval_policy_root,
    approval_authority_root: approvalAuthorityRoot,
  };
  const authorityRoot = disclosurePreparationAuthorityRoot(authority);
  invariant(
    !state.disclosure_preparation_authorities[authorityId] &&
      !Object.values(state.disclosure_preparation_authorities).some(
        (record) =>
          record.disclosure_preparation_authority_root === authorityRoot,
      ),
    "ERR_NONCE_REPLAY",
    "disclosure preparation authority already exists",
  );
  state.disclosure_preparation_authorities[authorityId] = {
    authority_id: authorityId,
    disclosure_preparation_authority_root: authorityRoot,
    preparation_authority: authority,
    verifier_authority: verifierAuthority,
    status: "ACCEPTED",
    revision: 0,
  };
  return {
    jobId: job.job_id,
    effects: [`authorized disclosure preparation ${authorityId}`],
    result: {
      preparation_authority_id: authorityId,
      preparation_authority_root: authorityRoot,
    },
  };
}

function handleCreatePublicationIntent(state, event, runtimeContext) {
  const input = assertCarrierEnvelope(
    event,
    "nexus-create-publication-intent-v3",
  );
  assertExactObjectKeys(
    input,
    [
      "accepted_compilation_anchor_id",
      "accepted_compilation_anchor_root",
      "job_id",
      "nonce",
      "nonce_authority_id",
      "nonce_authority_root",
      "nonce_consumption_id",
      "nonce_consumption_root",
      "non_claims_id",
      "non_claims_root",
      "public_capsule_id",
      "public_capsule_root",
      "schema",
    ],
    [],
    "create publication intent body",
  );
  invariant(
    input.schema === "nexus-publication-intent-reference-set-v1",
    "ERR_SCHEMA",
    "unsupported publication intent reference set",
  );
  const job = carrierJob(state, event, runtimeContext, input.job_id);
  const compilation =
    state.disclosure_compilation_anchors[
      input.accepted_compilation_anchor_id
    ];
  const capsule = state.public_capsules[input.public_capsule_id];
  const nonClaims = state.non_claims[input.non_claims_id];
  const manifest =
    state.disclosure_manifests[
      compilation?.body.disclosure_manifest_id
    ];
  const authority =
    state.entropy_freshness_authorities[input.nonce_authority_root];
  const consumption =
    state.entropy_one_use_consumptions[input.nonce_consumption_id];
  const scopeBinding = {
    schema: "nexus-publication-intent-nonce-scope-v3",
    accepted_compilation_anchor_root:
      input.accepted_compilation_anchor_root,
    capsule_root: input.public_capsule_root,
    destination_policy: "GITHUB_SANITIZED_WITNESS",
    disclosure_manifest_root: manifest?.record_root,
    job_id: input.job_id,
    non_claims_root: input.non_claims_root,
    publication_principal_id: event.actor_id,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id:
      runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id,
  };
  const scopeRoot = publicationIntentNonceScopeRoot(scopeBinding);
  const nonceCommitment = publicationIntentNonceCommitmentRoot({
    nonce: input.nonce,
    scopeRoot,
  });
  const useScopeRoot = publicationIntentUseScopeRoot({
    binding: scopeBinding,
    nonceAuthorityId: input.nonce_authority_id,
    nonceAuthorityRoot: input.nonce_authority_root,
    nonceCommitment,
    scopeRoot,
  });
  invariant(
    compilation?.record_root ===
        input.accepted_compilation_anchor_root &&
      capsule?.record_root === input.public_capsule_root &&
      capsule.body.accepted_compilation_anchor_id ===
        compilation.record_id &&
      nonClaims?.record_root === input.non_claims_root &&
      nonClaims.body.accepted_compilation_anchor_id ===
        compilation.record_id &&
      manifest?.record_root ===
        compilation.body.disclosure_manifest_root &&
      authority?.authority_id === input.nonce_authority_id &&
      authority.job_id === job.job_id &&
      authority.status === "CONSUMED" &&
      authority.authority.purpose === "PUBLICATION_INTENT" &&
      authority.authority.scope_root === scopeRoot &&
      authority.authority.nonce_commitment === nonceCommitment &&
      canonicalize(authority.binding) === canonicalize(scopeBinding) &&
      consumption?.consumption_root === input.nonce_consumption_root &&
      consumption.consumption.authority_id === input.nonce_authority_id &&
      consumption.consumption.authority_root === input.nonce_authority_root &&
      consumption.consumption.nonce_commitment === nonceCommitment &&
      consumption.consumption.scope_root === scopeRoot &&
      consumption.consumption.use_scope_root === useScopeRoot,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "publication intent is not bound to exact consumed entropy/terminal context",
  );
  const body = {
    schema: "nexus-publication-intent-v3",
    job_id: job.job_id,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id:
      runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id,
    accepted_compilation_anchor_id: compilation.record_id,
    accepted_compilation_anchor_root: compilation.record_root,
    public_capsule_id: capsule.record_id,
    public_capsule_root: capsule.record_root,
    disclosure_manifest_id: manifest.record_id,
    disclosure_manifest_root: manifest.record_root,
    non_claims_id: nonClaims.record_id,
    non_claims_root: nonClaims.record_root,
    predecessor_root: event.expected_predecessor_root,
    destination_policy: "GITHUB_SANITIZED_WITNESS",
    publication_principal_id: event.actor_id,
    logical_tick: event.tick,
    idempotency_key: event.idempotency_key,
    nonce: input.nonce,
    nonce_authority_id: input.nonce_authority_id,
    nonce_authority_root: input.nonce_authority_root,
    nonce_consumption_id: input.nonce_consumption_id,
    nonce_consumption_root: input.nonce_consumption_root,
  };
  const intentId = publicationIntentV3Id(body);
  invariant(
    !state.publication_intents[intentId],
    "ERR_IDEMPOTENCY_CONFLICT",
    "publication intent already exists",
  );
  state.publication_intents[intentId] = {
    intent_id: intentId,
    ...body,
    accepted_publication_anchor_root: null,
  };
  updateRecord(state, "jobs", job.job_id, "JOB", {
    publication_intent_ids: [...job.publication_intent_ids, intentId].sort(),
  });
  return {
    jobId: job.job_id,
    effects: [`created immutable publication intent ${intentId}`],
    result: { intent_id: intentId },
  };
}

function handleCommitPublicExportAuthority(state, event, runtimeContext) {
  const body = assertCarrierEnvelope(
    event,
    "nexus-commit-public-export-authority-v3",
  );
  assertExactObjectKeys(
    body,
    [
      "approval_receipt_id",
      "approval_receipt_root",
      "content_proof_descriptors_root",
      "content_public_values_root",
      "preparation_authority_id",
      "preparation_authority_root",
      "preparation_entropy_consumption_id",
      "preparation_entropy_consumption_root",
      "preparation_id",
      "preparation_record_root",
      "preparation_root",
      "scan_receipt_id",
      "scan_receipt_root",
    ],
    [],
    "commit public export authority body",
  );
  const preparation =
    state.disclosure_preparation_authorities[
      body.preparation_authority_id
    ];
  invariant(
    preparation?.disclosure_preparation_authority_root ===
      body.preparation_authority_root,
    "ERR_SCHEMA",
    "disclosure preparation authority is missing or changed",
  );
  const preparationAuthority = preparation.preparation_authority;
  const job = carrierJob(
    state,
    event,
    runtimeContext,
    preparationAuthority.job_id,
    preparationAuthority.contract_root,
  );
  const binding = preparationContentBinding(
    state,
    preparation,
    body.content_public_values_root,
    body.content_proof_descriptors_root,
  );
  const scan = state.disclosure_scan_receipts[body.scan_receipt_id];
  const approval =
    state.disclosure_approval_receipts[body.approval_receipt_id];
  const acceptedPreparation =
    state.disclosure_preparations[body.preparation_id];
  invariant(
    acceptedPreparation?.record_root ===
        body.preparation_record_root &&
      acceptedPreparation.preparation_authority_id ===
        preparation.authority_id &&
      acceptedPreparation.preparation_root === body.preparation_root &&
      acceptedPreparation.preparation.content_public_values_root ===
        body.content_public_values_root &&
      acceptedPreparation.preparation.content_proof_descriptors_root ===
        body.content_proof_descriptors_root &&
      binding.preparationRoot === body.preparation_root &&
      binding.preparationEntropyConsumption.consumption_id ===
        body.preparation_entropy_consumption_id &&
      binding.preparationEntropyConsumption.consumption_root ===
        body.preparation_entropy_consumption_root &&
      scan?.record_root === body.scan_receipt_root &&
      scan.body.preparation_root === body.preparation_root &&
      scan.body.content_public_values_root ===
        body.content_public_values_root &&
      scan.body.content_proof_descriptors_root ===
        body.content_proof_descriptors_root &&
      approval?.record_root === body.approval_receipt_root &&
      approval.body.scan_receipt_id === body.scan_receipt_id &&
      approval.body.scan_receipt_root === body.scan_receipt_root &&
      approval.body.preparation_root === body.preparation_root &&
      approval.body.content_public_values_root ===
        body.content_public_values_root &&
      approval.body.content_proof_descriptors_root ===
        body.content_proof_descriptors_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "public export authority does not bind exact preparation/scan/approval",
  );
  const authorityId = publicExportAuthorityContextId(event, job.job_id);
  const authority = {
    schema: "nexus-public-export-authority-v3",
    export_authority_id: authorityId,
    preparation_authority_id: preparation.authority_id,
    preparation_authority_root:
      preparation.disclosure_preparation_authority_root,
    preparation_root: body.preparation_root,
    job_id: job.job_id,
    contract_root: job.accepted_contract_root,
    terminal_event_id: job.terminal_event_id,
    terminal_receipt_id:
      runtimeContext.terminal_receipt_id ?? job.terminal_receipt_id,
    disclosure_policy_id: preparationAuthority.disclosure_policy_id,
    disclosure_policy_record_root:
      preparationAuthority.disclosure_policy_record_root,
    disclosure_policy_root: preparationAuthority.disclosure_policy_root,
    disclosure_proof_context_id:
      preparationAuthority.disclosure_proof_context_id,
    disclosure_proof_context_record_root:
      preparationAuthority.disclosure_proof_context_record_root,
    disclosure_proof_context_root:
      preparationAuthority.disclosure_proof_context_root,
    preparation_entropy_consumption_id:
      body.preparation_entropy_consumption_id,
    preparation_entropy_consumption_root:
      body.preparation_entropy_consumption_root,
    export_nonce_commitment: preparationAuthority.export_nonce_commitment,
    content_public_values_root: body.content_public_values_root,
    content_proof_descriptors_root: body.content_proof_descriptors_root,
    scan_receipt_id: body.scan_receipt_id,
    scan_receipt_root: body.scan_receipt_root,
    approval_receipt_id: body.approval_receipt_id,
    approval_receipt_root: body.approval_receipt_root,
    public_job_summary_root: publicJobSummaryV3Root({
      preparationRoot: body.preparation_root,
      contentPublicValuesRoot: body.content_public_values_root,
      contentProofDescriptorsRoot: body.content_proof_descriptors_root,
    }),
  };
  const authorityRoot = publicExportAuthorityV3Root(authority);
  invariant(
    !state.public_export_authorities[authorityId] &&
      !Object.values(state.public_export_authorities).some(
        (record) =>
          record.public_export_authority_root === authorityRoot,
      ),
    "ERR_NONCE_REPLAY",
    "public export authority already exists",
  );
  state.public_export_authorities[authorityId] = {
    authority_id: authorityId,
    public_export_authority_root: authorityRoot,
    export_authority: authority,
    status: "ACCEPTED",
  };
  state.export_nonce_uses[authority.export_nonce_commitment] = {
    ...state.export_nonce_uses[authority.export_nonce_commitment],
    public_export_authority_id: authorityId,
    public_export_authority_root: authorityRoot,
  };
  return {
    jobId: job.job_id,
    effects: [`committed public export authority ${authorityId}`],
    result: {
      export_authority_id: authorityId,
      export_authority_root: authorityRoot,
    },
  };
}

function dispatch(state, event, runtimeContext) {
  switch (event.event_type) {
    case "CREATE_JOB":
      return handleCreateJob(state, event);
    case "REGISTER_OFFER":
      return handleRegisterOffer(state, event);
    case "REVOKE_OFFER":
      return handleRevokeOffer(state, event);
    case "ACCEPT_DONATED_CAPACITY_CONSENT":
      return handleAcceptDonatedCapacityConsent(state, event);
    case "CONTRIBUTE":
      return handleContribute(state, event);
    case "OPEN_BID_ROUND":
      return handleOpenBidRound(state, event);
    case "COMMIT_BID":
      return handleCommitBid(state, event);
    case "REVEAL_BID":
      return handleRevealBid(state, event);
    case "ADVANCE_TICK":
      return processTick(state, event);
    case "SELECT_BID":
      return handleSelectBid(state, event);
    case "UNSELECT_BID":
      return handleUnselectBid(state, event, false);
    case "REVOKE_BID":
      return handleUnselectBid(state, event, true);
    case "ACCEPT_BID":
      return handleAcceptBid(state, event);
    case "ISSUE_LEASE":
      return handleIssueLease(state, event);
    case "SUBMIT_LEASE_RETURN":
      return handleSubmitLeaseReturn(state, event);
    case "ISSUE_ALLOWANCE":
      return handleIssueAllowance(state, event);
    case "AUTHORIZE_SUBWORK":
      return handleAuthorizeSubwork(state, event);
    case "ACCEPT_SUBWORK_RETURN":
      return handleAcceptSubworkReturn(state, event);
    case "ACCEPT_LEAD_RETURN":
      return handleAcceptLeadReturn(state, event);
    case "ACCEPT_DETERMINISTIC_EVIDENCE":
      return handleAcceptDeterministicEvidence(state, event);
    case "ENTER_REVIEW":
      return handleEnterReview(state, event);
    case "ASSIGN_REVIEWERS":
      return handleAssignReviewers(state, event);
    case "REPLACE_REVIEWER":
      return handleReplaceReviewer(state, event);
    case "ACCEPT_ASSIGNED_REVIEW":
      return handleAcceptAssignedReview(state, event);
    case "COMPUTE_REVIEW_OUTCOME":
      return handleComputeReviewOutcome(state, event);
    case "HUMAN_DECISION":
      return handleHumanDecision(state, event);
    case "FILE_APPEAL":
      return handleFileAppeal(state, event);
    case "RESOLVE_APPEAL":
      return handleResolveAppeal(state, event);
    case "SETTLE_JOB":
      return handleSettleJob(state, event);
    case "ABORT_JOB":
      return handleAbortJob(state, event);
    case "CANCEL_JOB":
      return handleCancelJob(state, event);
    case "REVOKE_CONTRIBUTION":
      return handleRevokeContribution(state, event);
    case "ACCEPT_DISCLOSURE_POLICY":
      return handleAcceptDisclosurePolicy(state, event, runtimeContext);
    case "ACCEPT_DISCLOSURE_PROOF_CONTEXT":
      return handleAcceptDisclosureProofContext(
        state,
        event,
        runtimeContext,
      );
    case "REGISTER_ENTROPY_FRESHNESS_AUTHORITY":
      return handleRegisterEntropyFreshnessAuthority(
        state,
        event,
        runtimeContext,
      );
    case "AUTHORIZE_DISCLOSURE_PREPARATION":
      return handleAuthorizeDisclosurePreparation(
        state,
        event,
        runtimeContext,
      );
    case "ACCEPT_DISCLOSURE_PREPARATION":
      return handleAcceptDisclosurePreparation(
        state,
        event,
        runtimeContext,
      );
    case "CREATE_PUBLICATION_INTENT":
      return handleCreatePublicationIntent(state, event, runtimeContext);
    case "CONSUME_ENTROPY_AUTHORITY":
      return handleConsumeEntropyAuthority(state, event);
    case "RECORD_DISCLOSURE_SCAN":
      return handleRecordDisclosureScan(state, event, runtimeContext);
    case "RECORD_DISCLOSURE_APPROVAL":
      return handleRecordDisclosureApproval(state, event, runtimeContext);
    case "ACCEPT_DISCLOSURE_COMPILATION":
      return handleAcceptDisclosureCompilation(state, event, runtimeContext);
    case "ACCEPT_DISCLOSURE_MANIFEST":
      return handleAcceptDisclosureManifest(state, event, runtimeContext);
    case "ACCEPT_PUBLIC_CAPSULE":
      return handleAcceptPublicCapsule(state, event, runtimeContext);
    case "ACCEPT_NON_CLAIMS":
      return handleAcceptNonClaims(state, event, runtimeContext);
    case "AUTHORIZE_DATA_ROUTE":
      return handleAuthorizeDataRoute(state, event, runtimeContext);
    case "AUTHORIZE_TOOL_ROUTE":
      return handleAuthorizeToolRoute(state, event, runtimeContext);
    case "RECORD_CLASSIFIED_INPUT_MEASUREMENT":
      return handleRecordClassifiedInputMeasurement(state, event);
    case "CREATE_ROUTE_EXECUTION_PLAN":
      return handleCreateRouteExecutionPlanV2(state, event);
    case "CONSUME_ROUTE_EXECUTION_PLAN":
      return handleConsumeRouteExecutionPlan(state, event);
    case "RECORD_REDACTION_MANIFEST":
      return handleRecordRedactionManifest(state, event, runtimeContext);
    case "APPROVE_REDACTION":
      return handleApproveRedaction(state, event, runtimeContext);
    case "ACCEPT_PUBLICATION":
      return handleAcceptPublication(state, event, runtimeContext);
    case "COMMIT_PUBLIC_EXPORT_AUTHORITY":
      return handleCommitPublicExportAuthority(state, event, runtimeContext);
    default:
      fail("ERR_SCHEMA", `unsupported event type ${event.event_type}`);
  }
}

function assertGenesisState(state) {
  invariant(
    state.tick === 0 && Object.keys(state.idempotency).length === 0,
    "ERR_RECOVERY",
    "createRuntime accepts only a zero-history genesis state",
  );
  const genesisRegistries = new Set([
    "accounts",
    "controllers",
    "principals",
  ]);
  for (const [key, value] of Object.entries(state)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      key !== "schema" &&
      !genesisRegistries.has(key)
    ) {
      invariant(
        Object.keys(value).length === 0,
        "ERR_RECOVERY",
        `createRuntime rejects historical registry ${key}`,
      );
    }
  }
}

export function createRuntime(genesisState, options = undefined) {
  invariant(
    options === undefined,
    "ERR_RECOVERY",
    "historical runtime options are forbidden; use recoverRuntime",
  );
  const state = structuredClone(genesisState);
  validateState(state);
  assertGenesisState(state);
  const runtime = Object.freeze(Object.create(null));
  RUNTIME_INTERNALS.set(runtime, {
    state,
    receipts: [],
    events: [],
    eventIndex: new Map(),
    idempotencyIndex: new Map(),
  });
  return runtime;
}

export function snapshotRuntime(runtime) {
  const internals = runtimeInternals(runtime);
  return deepFreeze({
    schema: "nexus-runtime-snapshot-v1",
    state: structuredClone(internals.state),
    events: structuredClone(internals.events),
    receipts: structuredClone(internals.receipts),
    current_root: applicationRoot(internals.state),
  });
}

export function recoverRuntime(request) {
  const recoveryKeys = [
    "events",
    "expectedFinalRoot",
    "genesisState",
    "receipts",
  ];
  const requestPrototype =
    request !== null && typeof request === "object"
      ? Object.getPrototypeOf(request)
      : undefined;
  invariant(
    requestPrototype === Object.prototype &&
      JSON.stringify(Object.keys(request).sort()) ===
        JSON.stringify(recoveryKeys),
    "ERR_RECOVERY",
    "runtime recovery request must be exact",
  );
  const {
    genesisState,
    events,
    receipts,
    expectedFinalRoot,
  } = request;
  invariant(
    Array.isArray(events) &&
      Array.isArray(receipts) &&
      events.length === receipts.length,
    "ERR_RECOVERY",
    "recovery requires one exact receipt per authenticated event",
  );
  assertHexRoot(expectedFinalRoot, "expected recovery final root");
  const runtime = createRuntime(genesisState);
  let previousReceiptRoot = null;
  for (const [index, suppliedEvent] of events.entries()) {
    assertEventIngress(suppliedEvent);
    const suppliedReceipt = receipts[index];
    invariant(
      suppliedReceipt &&
        suppliedReceipt.sequence === index + 1 &&
        suppliedReceipt.event_id === suppliedEvent.event_id &&
        suppliedReceipt.event_root ===
          authenticatedEventRoot(suppliedEvent) &&
        suppliedReceipt.previous_receipt_root ===
          previousReceiptRoot &&
        suppliedReceipt.receipt_id ===
          recomputeReceiptId(suppliedReceipt),
      "ERR_RECOVERY",
      `recovery receipt ${index + 1} identity/link/event binding is invalid`,
    );
    const outcome = applyEvent(runtime, structuredClone(suppliedEvent));
    invariant(
      outcome.replay === false &&
        canonicalize(outcome.receipt) ===
          canonicalize(suppliedReceipt),
      "ERR_RECOVERY",
      `recovery receipt ${index + 1} differs from deterministic replay`,
    );
    previousReceiptRoot = receiptRoot(suppliedReceipt);
  }
  invariant(
    currentRoot(runtime) === expectedFinalRoot,
    "ERR_RECOVERY",
    "recovered final application root differs",
  );
  return runtime;
}

export function applyEvent(runtime, event) {
  const internals = runtimeInternals(runtime);
  assertEventIngress(event);
  const eventRoot = authenticatedEventRoot(event);
  const byEvent = internals.eventIndex.get(event.event_id);
  const byKey = internals.idempotencyIndex.get(event.idempotency_key);
  if (byEvent || byKey) {
    invariant(
      byEvent &&
        byKey &&
        byEvent.event_root === eventRoot &&
        byKey.event_root === eventRoot,
      "ERR_IDEMPOTENCY_CONFLICT",
      "event or idempotency key was reused with changed bytes",
    );
    return deepFreeze({
      state: structuredClone(internals.state),
      receipt: structuredClone(byEvent.receipt),
      replay: true,
      result: structuredClone(byEvent.result),
    });
  }

  verifyNewEvent(internals.state, event);
  const eventJobId =
    event.payload?.job_id ?? event.payload?.body?.job_id ?? null;
  if (eventJobId) {
    const job = internals.state.jobs[eventJobId];
    if (
      job &&
      TERMINAL_STATES.has(job.state) &&
      !TERMINAL_EXCEPTIONS.has(event.event_type)
    ) {
      fail("ERR_ALREADY_TERMINAL", `${eventJobId} is terminal`);
    }
    if (
      job?.timeout_abort_required &&
      event.event_type !== "ABORT_JOB"
    ) {
      fail(
        "ERR_HOLD_TIMEOUT_ABORT_REQUIRED",
        `${eventJobId} requires its bound timeout abort`,
      );
    }
  }

  const predecessorRoot = applicationRoot(internals.state);
  const candidate = structuredClone(internals.state);
  const runtimeContext = {
    terminal_receipt_id: null,
    terminal_receipt: null,
    predecessor_root: predecessorRoot,
  };
  if (
    eventJobId &&
    TERMINAL_EXCEPTIONS.has(event.event_type) &&
    TERMINAL_STATES.has(internals.state.jobs[eventJobId]?.state)
  ) {
    const terminalReceipt = internals.receipts.find(
      (receipt) =>
        receipt.event_id ===
          internals.state.jobs[eventJobId].terminal_event_id,
    );
    invariant(
      terminalReceipt?.job_id === eventJobId,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      "canonical terminal receipt is unavailable",
    );
    runtimeContext.terminal_receipt_id = terminalReceipt.receipt_id;
    runtimeContext.terminal_receipt = terminalReceipt;
  }
  const outcome = dispatch(candidate, event, runtimeContext);
  candidate.idempotency[event.idempotency_key] = {
    idempotency_key: event.idempotency_key,
    event_id: event.event_id,
    event_body_root: event.event_id.slice(4),
    authenticated_event_root: eventRoot,
  };
  const invariantResults = validateState(candidate);
  const nextStateRoot = applicationRoot(candidate);
  const previousReceipt =
    internals.receipts.length === 0
      ? null
      : receiptRoot(
          internals.receipts[internals.receipts.length - 1],
        );
  const receipt = buildReceipt({
    sequence: internals.receipts.length + 1,
    event,
    jobId: outcome.jobId,
    predecessorRoot,
    nextStateRoot,
    effects: outcome.effects,
    invariantResults,
    previousReceiptRoot: previousReceipt,
  });
  const indexEntry = {
    event_root: eventRoot,
    receipt,
    result: outcome.result ?? null,
  };
  internals.state = candidate;
  internals.events.push(structuredClone(event));
  internals.receipts.push(structuredClone(receipt));
  internals.eventIndex.set(event.event_id, indexEntry);
  internals.idempotencyIndex.set(event.idempotency_key, indexEntry);
  return deepFreeze({
    state: structuredClone(candidate),
    receipt: structuredClone(receipt),
    replay: false,
    result: structuredClone(outcome.result ?? null),
  });
}

export function currentRoot(runtime) {
  return applicationRoot(runtimeInternals(runtime).state);
}

export {
  acceptedDisclosurePreparationRoot,
  acceptedDisclosureCompilationAnchorRoot,
  acceptedPublicationAnchorRoot,
  capabilityOfferRoot,
  capabilityOfferTermsRoot,
  deriveDisclosurePreparationBindings,
  derivedCarrierId,
  disclosurePreparationExecutionReceiptRoot,
  disclosurePreparationVerifierAuthorityRoot,
  disclosureCompilationRoot,
  donatedCapacityConsentBodyRoot,
  donatedCapacityConsentRecordRoot,
  entropyFreshnessAuthorityRoot,
  entropyOneUseClaimRoot,
  entropyOneUseConsumptionRoot,
  exportNonceCommitment,
  nonClaimsRoot,
  nonceOneUseAuthorityRoot,
  publicationApprovalContextRoot,
  publicationIntentId,
  publicationIntentV3Id,
  publicationUseScopeRoot,
  publicCapsuleRoot,
  publicExportScopeRoot,
  publicSafeDisclosureManifestRoot,
  verifyDisclosurePreparationBindings,
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
  disclosureSaltCommitmentRoot,
  disclosureSaltEntropyConsumptionsRoot,
  disclosureSaltScopeRoot,
  disclosureSaltUseScopeRoot,
  entropyAuthorityContextId,
  entropyFreshnessAuthorityV1Root,
  entropyOneUseClaimV1Root,
  entropyOneUseCommitmentRoot,
  entropyOneUseConsumptionV1Root,
  publicationApprovalAuthorityV3Root,
  publicationIntentNonceCommitmentRoot,
  publicationIntentNonceScopeRoot,
  publicationIntentUseScopeRoot,
  publicationIntentV2Id,
  publicExportAuthorityContextId,
  publicExportAuthorityV3Root,
  publicJobIdV3,
  publicJobSummaryV3Root,
  bidCommitment,
  draftContractRoot,
  mandatoryJobReserve,
};
