import { invariant } from "./errors.mjs";
import {
  classifiedInputManifestRoot,
  routeExecutionPlanV5Root,
  routePlanConsumptionRoot,
  workerTrustAuthorityRoot,
} from "./route-v5.mjs";
import { hash } from "./hash.mjs";
import { recordIdKey, recordRoot } from "./records.mjs";
import {
  acceptedDisclosureCompilationAnchorRoot,
  acceptedPublicationAnchorRoot,
  nonceOneUseAuthorityRoot,
} from "./public-export.mjs";
import {
  acceptedDisclosurePolicyCarrierRoot,
  acceptedDisclosureProofContextCarrierRoot,
  disclosurePreparationAuthorityRoot,
  entropyBindingScopeRoot,
  entropyFreshnessAuthorityV1Root,
  entropyOneUseConsumptionV1Root,
  publicationIntentV3Id,
  publicExportAuthorityV3Root,
} from "./privacy-nexus.mjs";
import {
  acceptedDisclosurePreparationRoot,
  capabilityOfferRoot,
  dataRouteAuthorityRoot,
  derivedCarrierId,
  disclosureApprovalReceiptRoot,
  disclosureCompilationAnchorV2Root,
  disclosurePreparationExecutionReceiptRoot,
  disclosureScanReceiptRoot,
  donatedCapacityConsentRecordRoot,
  nonClaimsRoot,
  publicationAnchorV2Root,
  publicCapsuleRoot,
  publicSafeDisclosureManifestRoot,
  redactionApprovalV2Root,
  redactionManifestV2Root,
  toolRouteAuthorityRoot,
} from "./carriers.mjs";
import {
  activeLotValue,
  assertAmount,
  checkedAdd,
  checkedMultiply,
  conservedSupply,
} from "../economy/funding.mjs";

const RECORD_MAPS = {
  principals: "PRINCIPAL",
  controllers: "CONTROLLER",
  accounts: "ACCOUNT",
  jobs: "JOB",
  contributions: "CONTRIBUTION",
  funding_lots: "FUNDING_LOT",
  bid_rounds: "BID_ROUND",
  bids: "BID",
  allowances: "ALLOWANCE",
  subwork_commitments: "SUBWORK_COMMITMENT",
  payouts: "PAYOUT",
  tasks: "TASK",
  leases: "LEASE",
  review_assignments: "REVIEW_ASSIGNMENT",
  appeals: "APPEAL",
};

const OWNER = {
  CONTRIBUTION: ["contributions", "funding_lot_ids"],
  BID: ["bids", "funding_lot_ids"],
  JOB: ["jobs", "funding_lot_ids"],
  ALLOWANCE: ["allowances", "funding_lot_ids"],
  PAYOUT: ["payouts", "funding_lot_ids"],
};

const LIVE_CHILD_STATUS = {
  bid_rounds: new Set([
    "SCHEDULED",
    "OPEN_COMMIT",
    "OPEN_REVEAL",
    "SELECTED",
    "ACCEPTED",
  ]),
  bids: new Set(["COMMITTED", "REVEALED", "SELECTED", "ACCEPTED"]),
  contributions: new Set(["RESERVED", "SELECTED_LOCK", "LOCKED", "ACCEPTED"]),
  allowances: new Set(["ACTIVE"]),
  subwork_commitments: new Set(["AUTHORIZED"]),
  payouts: new Set(["PENDING"]),
  tasks: new Set(["WAITING", "READY", "LEASED", "RETURNED"]),
  leases: new Set(["ACTIVE", "RETURNED"]),
  review_assignments: new Set(["ASSIGNED", "RETURNED", "VALID"]),
  appeals: new Set(["FILED", "ABORT_DUE"]),
};

function assertRecordRoots(state) {
  for (const [mapName, objectType] of Object.entries(RECORD_MAPS)) {
    for (const [id, record] of Object.entries(state[mapName])) {
      const idKey = recordIdKey(objectType);
      invariant(
        idKey && record[idKey] === id,
        "ERR_ID_PREIMAGE",
        `${mapName} key does not match record ID`,
      );
      invariant(
        Number.isSafeInteger(record.record_revision) &&
          record.record_revision >= 0,
        "ERR_RECORD_REVISION",
        `${id} has invalid record revision`,
      );
      invariant(
        record.record_root === recordRoot(record, objectType),
        "ERR_RECORD_REVISION",
        `${id} has invalid record root`,
      );
    }
  }
}

function assertFundingOwnership(state) {
  const references = new Map();
  for (const [bucket, [mapName, field]] of Object.entries(OWNER)) {
    for (const record of Object.values(state[mapName])) {
      for (const lotId of record[field] ?? []) {
        const owners = references.get(lotId) ?? [];
        owners.push({ bucket, bucket_id: record[`${mapName.slice(0, -1)}_id`] });
        references.set(lotId, owners);
      }
    }
  }

  for (const lot of Object.values(state.funding_lots)) {
    assertAmount(lot.amount);
    const sourceContribution =
      state.contributions[lot.source_contribution_id];
    invariant(
      sourceContribution,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} source contribution is missing`,
    );
    invariant(
      state.accounts[lot.source_account_id],
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} source account is missing`,
    );
    invariant(
      sourceContribution.sponsor_account_id === lot.source_account_id &&
        sourceContribution.kind === lot.contribution_kind,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} source tags disagree with its contribution`,
    );
    if (lot.status !== "ACTIVE") continue;
    invariant(
      lot.amount > 0,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} active amount must be positive`,
    );
    const ownerSpec = OWNER[lot.bucket];
    invariant(
      ownerSpec,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} has unknown bucket`,
    );
    const [mapName, field] = ownerSpec;
    const owner = state[mapName][lot.bucket_id];
    invariant(
      owner && (owner[field] ?? []).includes(lot.lot_id),
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} owner mismatch`,
    );
    const observed = references.get(lot.lot_id) ?? [];
    invariant(
      observed.length === 1,
      "ERR_FUNDING_LOT_OWNER",
      `${lot.lot_id} must have exactly one active owner reference`,
    );
  }
}

function assertAppealLineage(state) {
  for (const job of Object.values(state.jobs)) {
    const appeals = Object.values(state.appeals)
      .filter((appeal) => appeal.job_id === job.job_id)
      .sort((left, right) => left.round - right.round);
    invariant(
      (job.appeal_ids ?? []).length === appeals.length &&
        appeals.every(
          (appeal, index) =>
            appeal.round === index + 1 &&
            appeal.parent_appeal_id ===
              (index === 0 ? null : appeals[index - 1].appeal_id) &&
            job.appeal_ids[index] === appeal.appeal_id,
        ),
      "ERR_APPEAL_INELIGIBLE",
      `${job.job_id} has invalid appeal lineage`,
    );
  }
}

function assertIdempotencyState(state) {
  const eventIds = new Set();
  for (const [key, entry] of Object.entries(state.idempotency)) {
    invariant(
      key.length > 0 &&
        entry.idempotency_key === key &&
        typeof entry.event_id === "string" &&
        typeof entry.event_body_root === "string" &&
        typeof entry.authenticated_event_root === "string" &&
        !eventIds.has(entry.event_id),
      "ERR_IDEMPOTENCY_CONFLICT",
      `invalid canonical idempotency entry ${key}`,
    );
    eventIds.add(entry.event_id);
  }
}

function assertCapabilityAndConsentState(state) {
  const offerRoots = new Set();
  for (const [offerId, offer] of Object.entries(state.capability_offers)) {
    const {
      offer_id: projectedOfferId,
      authentication,
      ...offerProjection
    } = offer;
    const root = capabilityOfferRoot(offerProjection);
    invariant(
      projectedOfferId === offerId &&
        authentication !== null &&
        typeof authentication === "object" &&
        derivedCarrierId("CAPABILITY_OFFER", offerProjection) === offerId &&
        !offerRoots.has(root),
      "ERR_CAPABILITY",
      `${offerId} is not an exact authenticated capability offer`,
    );
    offerRoots.add(root);
  }

  const consentRoots = new Set();
  for (const [consentId, stored] of Object.entries(
    state.donated_capacity_consents,
  )) {
    const { record_root: storedRoot, ...acceptedRecord } = stored;
    const root = donatedCapacityConsentRecordRoot(acceptedRecord);
    invariant(
      stored.consent_id === consentId &&
        stored.status === "ACCEPTED" &&
        storedRoot === root &&
        !consentRoots.has(root),
      "ERR_CAPABILITY",
      `${consentId} is not an exact donated-capacity consent`,
    );
    consentRoots.add(root);
  }
}

function assertPublicExportState(state) {
  const policyRoots = new Set();
  for (const [policyId, record] of Object.entries(state.disclosure_policies)) {
    const recordRootValue =
      acceptedDisclosurePolicyCarrierRoot(record.carrier);
    invariant(
      policyId === record.disclosure_policy_id &&
        record.carrier.disclosure_policy_id === policyId &&
        record.record_root === recordRootValue &&
        record.policy_root === record.carrier.policy_root &&
        record.status === "ACCEPTED" &&
        record.revision === 0 &&
        !policyRoots.has(recordRootValue),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${policyId} has an invalid accepted disclosure policy carrier`,
    );
    policyRoots.add(recordRootValue);
  }
  const proofRoots = new Set();
  for (const [proofId, record] of Object.entries(
    state.disclosure_proof_contexts,
  )) {
    const recordRootValue =
      acceptedDisclosureProofContextCarrierRoot(record.carrier);
    invariant(
      proofId === record.disclosure_proof_context_id &&
        record.carrier.disclosure_proof_context_id === proofId &&
        record.record_root === recordRootValue &&
        record.proof_context_root === record.carrier.proof_context_root &&
        record.status === "ACCEPTED" &&
        record.revision === 0 &&
        !proofRoots.has(recordRootValue),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${proofId} has an invalid accepted proof-context carrier`,
    );
    proofRoots.add(recordRootValue);
  }
  const preparationRoots = new Set();
  for (const [authorityId, record] of Object.entries(
    state.disclosure_preparation_authorities,
  )) {
    const authority = record.preparation_authority;
    const authorityRoot = disclosurePreparationAuthorityRoot(authority);
    const policy = state.disclosure_policies[authority.disclosure_policy_id];
    const proof =
      state.disclosure_proof_contexts[
        authority.disclosure_proof_context_id
      ];
    const entropy =
      state.entropy_freshness_authorities[
        authority.entropy_freshness_authority_root
      ];
    invariant(
      authorityId === record.authority_id &&
        authority.preparation_authority_id === authorityId &&
        record.disclosure_preparation_authority_root === authorityRoot &&
        record.status === "ACCEPTED" &&
        record.revision === 0 &&
        policy?.record_root === authority.disclosure_policy_record_root &&
        policy.policy_root === authority.disclosure_policy_root &&
        proof?.record_root ===
          authority.disclosure_proof_context_record_root &&
        proof.proof_context_root ===
          authority.disclosure_proof_context_root &&
        entropy?.authority_id ===
          authority.entropy_freshness_authority_id &&
        entropy.authority.nonce_commitment ===
          authority.export_nonce_commitment &&
        !preparationRoots.has(authorityRoot),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${authorityId} has an invalid disclosure preparation authority`,
    );
    preparationRoots.add(authorityRoot);
  }
  const exportRoots = new Set();
  for (const [authorityId, record] of Object.entries(
    state.public_export_authorities,
  )) {
    const authority = record.export_authority;
    const root = publicExportAuthorityV3Root(authority);
    const preparation =
      state.disclosure_preparation_authorities[
        authority.preparation_authority_id
      ];
    invariant(
      authorityId === record.authority_id &&
        authority.export_authority_id === authorityId &&
        record.public_export_authority_root === root &&
        record.status === "ACCEPTED" &&
        preparation?.disclosure_preparation_authority_root ===
          authority.preparation_authority_root &&
        state.entropy_one_use_consumptions[
          authority.preparation_entropy_consumption_id
        ]?.consumption_root ===
          authority.preparation_entropy_consumption_root &&
        state.disclosure_scan_receipts[authority.scan_receipt_id]
          ?.record_root === authority.scan_receipt_root &&
        state.disclosure_approval_receipts[authority.approval_receipt_id]
          ?.record_root === authority.approval_receipt_root &&
        !exportRoots.has(root),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${authorityId} has an invalid public export authority`,
    );
    exportRoots.add(root);
  }
  const entropyIds = new Set();
  const entropyCommitments = new Set();
  for (const [root, record] of Object.entries(
    state.entropy_freshness_authorities,
  )) {
    const authorityRoot = entropyFreshnessAuthorityV1Root(record.authority);
    invariant(
      authorityRoot === root &&
        record.authority_root === root &&
        entropyBindingScopeRoot(record.authority.purpose, record.binding) ===
          record.authority.scope_root &&
        ["AVAILABLE", "CONSUMED"].includes(record.status) &&
        !entropyIds.has(record.authority_id) &&
        !entropyCommitments.has(record.authority.nonce_commitment) &&
        (record.status === "AVAILABLE"
          ? record.consumption_id === null && record.consumption_root === null
          : state.entropy_one_use_consumptions[record.consumption_id]
              ?.consumption_root === record.consumption_root),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${root} has an invalid entropy/freshness authority`,
    );
    entropyIds.add(record.authority_id);
    entropyCommitments.add(record.authority.nonce_commitment);
  }
  for (const [consumptionId, record] of Object.entries(
    state.entropy_one_use_consumptions,
  )) {
    const consumption = record.consumption;
    const entropy =
      state.entropy_freshness_authorities[consumption.authority_root];
    invariant(
      record.consumption_id === consumptionId &&
        entropyOneUseConsumptionV1Root(consumption) ===
          record.consumption_root &&
        record.status === "CONSUMED" &&
        entropy?.authority_id === consumption.authority_id &&
        entropy.consumption_id === consumptionId &&
        entropy.consumption_root === record.consumption_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${consumptionId} has an invalid entropy one-use consumption`,
    );
  }
  for (const [root, record] of Object.entries(state.nonce_authorities)) {
    invariant(
      nonceOneUseAuthorityRoot(record.authority) === root &&
        record.nonce_authority_root === root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${root} has an invalid legacy nonce authority`,
    );
  }
  for (const [nonceCommitment, use] of Object.entries(state.export_nonce_uses)) {
    const entropy =
      state.entropy_freshness_authorities[use.authority_root];
    invariant(
      use.export_nonce_commitment === nonceCommitment &&
        entropy?.authority_id === use.authority_id &&
        entropy.authority.nonce_commitment === nonceCommitment &&
        state.entropy_one_use_consumptions[use.consumption_id]
          ?.consumption_root === use.consumption_root &&
        typeof use.use_event_id === "string" &&
        (use.public_export_authority_id === undefined ||
          state.public_export_authorities[use.public_export_authority_id]
            ?.public_export_authority_root ===
            use.public_export_authority_root),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${nonceCommitment} has an invalid entropy use`,
    );
  }
  for (const [root, record] of Object.entries(
    state.accepted_disclosure_compilation_anchors,
  )) {
    invariant(
      acceptedDisclosureCompilationAnchorRoot(record.anchor) === root &&
        record.accepted_compilation_anchor_root === root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${root} has an invalid accepted compilation anchor`,
    );
  }
  for (const [root, record] of Object.entries(
    state.accepted_publication_anchors,
  )) {
    const intent = state.publication_intents[record.publication_intent_id];
    invariant(
      acceptedPublicationAnchorRoot(record.anchor) === root &&
        record.accepted_publication_anchor_root === root &&
        intent?.accepted_publication_anchor_root === root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${root} has an invalid accepted publication anchor`,
    );
  }
  for (const [intentId, intent] of Object.entries(state.publication_intents)) {
    const {
      accepted_publication_anchor_root: ignoredAnchor,
      intent_id: ignoredId,
      ...body
    } = intent;
    invariant(
      publicationIntentV3Id(body) === intentId,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${intentId} has an invalid publication intent identity`,
    );
  }
}

function assertComputeAndCapabilityCeilings(state) {
  for (const job of Object.values(state.jobs)) {
    if (!job.accepted_contract) continue;
    const conflictPolicy = job.accepted_contract.conflict_policy;
    invariant(
      conflictPolicy?.schema === "nexus-conflict-policy-v1" &&
        conflictPolicy.job_id === job.job_id &&
        Array.isArray(conflictPolicy.principal_ids) &&
        new Set(conflictPolicy.principal_ids).size ===
          conflictPolicy.principal_ids.length &&
        JSON.stringify(conflictPolicy.principal_ids) ===
          JSON.stringify([...conflictPolicy.principal_ids].sort()) &&
        hash("NEXUS_CONFLICT_POLICY_V1", conflictPolicy) ===
          job.accepted_contract.conflict_policy_root,
      "ERR_CONTRACT_IMMUTABLE",
      `${job.job_id} has an invalid accepted conflict policy`,
    );
    if (job.review_packet) {
      invariant(
        job.review_packet.schema === "nexus-review-packet-v2" &&
          job.review_packet.required_review_count ===
            job.accepted_contract.review.required_reviews &&
          JSON.stringify(job.review_packet.required_diversity_dimensions) ===
            JSON.stringify(
              job.accepted_contract.review.required_diversity_dimensions,
            ) &&
          job.review_packet.conflict_policy_root ===
            job.accepted_contract.conflict_policy_root &&
          `PACKET-${hash("NEXUS_REVIEW_PACKET_V2", job.review_packet)}` ===
            job.review_packet_root,
        "ERR_REVIEW_PACKET_MISMATCH",
        `${job.job_id} has an invalid accepted review policy binding`,
      );
    }
    const tasks = job.task_ids.map((id) => state.tasks[id]);
    const taskCompute = tasks.reduce(
      (sum, task) => checkedAdd(sum, task.max_compute_units),
      0,
    );
    const reviewCompute = job.review_packet
      ? checkedMultiply(
          job.accepted_contract.review.required_reviews,
          job.review_packet.max_compute_units,
        )
      : 0;
    const reserved = checkedAdd(taskCompute, reviewCompute);
    invariant(
      reserved === job.compute_units_reserved &&
        reserved <= job.accepted_contract.work.max_compute_units &&
        job.subwork_commitment_ids.length <=
          job.accepted_contract.work.max_subworkers,
      "ERR_CONTRACT_AUTHORITY_CEILING",
      `${job.job_id} exceeds its aggregate work ceiling`,
    );
    for (const lease of Object.values(state.leases).filter(
      (item) => item.job_id === job.job_id,
    )) {
      invariant(
        lease.maximum_capability_root ===
          job.accepted_contract.authority_ceiling.maximum_capability_root,
        "ERR_CONTRACT_AUTHORITY_CEILING",
        `${lease.lease_id} has a changed maximum capability root`,
      );
    }
    for (const assignment of Object.values(state.review_assignments).filter(
      (item) => item.job_id === job.job_id,
    )) {
      invariant(
        assignment.maximum_capability_root ===
            job.accepted_contract.authority_ceiling.maximum_capability_root &&
          assignment.required_check_manifest_root ===
            job.required_check_manifest_root,
        "ERR_CONTRACT_AUTHORITY_CEILING",
        `${assignment.review_assignment_id} has a changed review authority`,
      );
    }
  }
}

function assertReviewState(state) {
  const severityRank = new Map([
    ["NONE", 0],
    ["LOW", 1],
    ["MEDIUM", 2],
    ["HIGH", 3],
    ["CRITICAL", 4],
  ]);
  const histories = new Map();
  const attemptKeys = new Set();

  for (const assignment of Object.values(state.review_assignments)) {
    invariant(
      typeof assignment.job_id === "string" &&
        typeof assignment.packet_root === "string" &&
        Number.isSafeInteger(assignment.slot) &&
        assignment.slot >= 0 &&
        Number.isSafeInteger(assignment.attempt) &&
        assignment.attempt > 0,
      "ERR_REVIEW_ASSIGNMENT",
      `${assignment.review_assignment_id} has an invalid review attempt`,
    );
    const offer =
      state.capability_offers[assignment.capability_offer_id];
    const eligibility =
      state.reviewer_eligibilities[assignment.eligibility_id];
    invariant(
      offer?.offer_id === assignment.capability_offer_id &&
        capabilityOfferRoot(offer) ===
          assignment.capability_offer_root &&
        eligibility?.facts.capability_offer_id ===
          assignment.capability_offer_id &&
        eligibility.facts.capability_offer_root ===
          assignment.capability_offer_root,
      "ERR_REVIEW_ASSIGNMENT",
      `${assignment.review_assignment_id} has a mismatched capability offer ID/root`,
    );
    const historyKey = JSON.stringify([
      assignment.job_id,
      assignment.packet_root,
      assignment.slot,
    ]);
    const attemptKey = `${historyKey}:${assignment.attempt}`;
    invariant(
      !attemptKeys.has(attemptKey),
      "ERR_REVIEW_ASSIGNMENT",
      `${assignment.review_assignment_id} duplicates a review slot attempt`,
    );
    attemptKeys.add(attemptKey);
    const history = histories.get(historyKey) ?? [];
    history.push(assignment);
    histories.set(historyKey, history);

    if (assignment.status !== "VALID") continue;
    const review = state.reviews[assignment.review_id];
    invariant(
      typeof assignment.review_id === "string" &&
        review &&
        Array.isArray(review.findings) &&
        Array.isArray(review.evidence_refs) &&
        Array.isArray(review.claims),
      "ERR_REVIEW_ASSIGNMENT",
      `${assignment.review_assignment_id} lacks its validated review`,
    );

    const findingIds = new Set();
    const evidenceIds = new Set();
    const claimIds = new Set();
    for (const evidence of review.evidence_refs) {
      invariant(
        typeof evidence.evidence_ref_id === "string" &&
          evidence.evidence_ref_id.length > 0 &&
          !evidenceIds.has(evidence.evidence_ref_id),
        "ERR_REVIEW_ASSIGNMENT",
        `${assignment.review_id} has invalid evidence identity`,
      );
      evidenceIds.add(evidence.evidence_ref_id);
    }
    for (const claim of review.claims) {
      invariant(
        typeof claim.claim_id === "string" &&
          claim.claim_id.length > 0 &&
          !claimIds.has(claim.claim_id) &&
          Array.isArray(claim.evidence_ref_ids),
        "ERR_REVIEW_ASSIGNMENT",
        `${assignment.review_id} has an invalid claim`,
      );
      claimIds.add(claim.claim_id);
    }

    const referencedEvidence = new Set();
    let maximumSeverity = "NONE";
    for (const finding of review.findings) {
      invariant(
        typeof finding.finding_id === "string" &&
          finding.finding_id.length > 0 &&
          !findingIds.has(finding.finding_id) &&
          severityRank.has(finding.severity) &&
          typeof finding.material === "boolean" &&
          typeof finding.resolved === "boolean" &&
          Array.isArray(finding.evidence_ref_ids) &&
          (!["HIGH", "CRITICAL"].includes(finding.severity) ||
            finding.material === true),
        "ERR_REVIEW_ASSIGNMENT",
        `${assignment.review_id} has an invalid finding`,
      );
      findingIds.add(finding.finding_id);
      if (
        severityRank.get(finding.severity) >
        severityRank.get(maximumSeverity)
      ) {
        maximumSeverity = finding.severity;
      }
      for (const evidenceId of finding.evidence_ref_ids) {
        invariant(
          evidenceIds.has(evidenceId),
          "ERR_REVIEW_ASSIGNMENT",
          `${assignment.review_id} finding references missing evidence`,
        );
        referencedEvidence.add(evidenceId);
      }
    }
    for (const claim of review.claims) {
      for (const evidenceId of claim.evidence_ref_ids) {
        invariant(
          evidenceIds.has(evidenceId),
          "ERR_REVIEW_ASSIGNMENT",
          `${assignment.review_id} claim references missing evidence`,
        );
        referencedEvidence.add(evidenceId);
      }
    }
    invariant(
      review.severity === maximumSeverity &&
        [...evidenceIds].every((evidenceId) =>
          referencedEvidence.has(evidenceId),
        ) &&
        (review.verdict !== "CLEAR" ||
          review.findings.every(
            (finding) =>
              finding.resolved === true ||
              (finding.material === false &&
                severityRank.get(finding.severity) <
                  severityRank.get("HIGH")),
          )),
      "ERR_REVIEW_ASSIGNMENT",
      `${assignment.review_id} has inconsistent severity or evidence closure`,
    );
  }

  for (const history of histories.values()) {
    history.sort((left, right) => left.attempt - right.attempt);
    history.forEach((assignment, index) => {
      invariant(
        assignment.attempt === index + 1 &&
          assignment.replacement_of ===
            (index === 0
              ? null
              : history[index - 1].review_assignment_id),
        "ERR_REVIEW_ASSIGNMENT",
        `${assignment.review_assignment_id} has invalid replacement history`,
      );
    });
  }
}

function assertAcceptedCarriers(state) {
  const definitions = [
    ["disclosure_scan_receipts", disclosureScanReceiptRoot],
    ["disclosure_approval_receipts", disclosureApprovalReceiptRoot],
    [
      "disclosure_preparation_execution_receipts",
      disclosurePreparationExecutionReceiptRoot,
    ],
    ["disclosure_manifests", publicSafeDisclosureManifestRoot],
    ["public_capsules", publicCapsuleRoot],
    ["non_claims", nonClaimsRoot],
    ["disclosure_compilation_anchors", disclosureCompilationAnchorV2Root],
    ["data_route_authorities", dataRouteAuthorityRoot],
    ["tool_route_authorities", toolRouteAuthorityRoot],
    ["classified_input_manifests", classifiedInputManifestRoot],
    ["worker_trust_authorities", workerTrustAuthorityRoot],
    ["route_execution_plans", routeExecutionPlanV5Root],
    ["route_plan_consumptions", routePlanConsumptionRoot],
    ["redaction_manifests", redactionManifestV2Root],
    ["redaction_approvals", redactionApprovalV2Root],
    ["publication_anchors", publicationAnchorV2Root],
  ];
  for (const [mapName, rootFunction] of definitions) {
    const roots = new Set();
    for (const [id, record] of Object.entries(state[mapName])) {
      invariant(
        record.record_id === id &&
          record.record_root === rootFunction(record.body) &&
          record.status === "ACCEPTED" &&
          !roots.has(record.record_root),
        "ERR_DISCLOSURE_UNCLASSIFIED",
        `${mapName}:${id} is not an exact accepted carrier`,
      );
      roots.add(record.record_root);
    }
  }
  const preparationRoots = new Set();
  for (const [preparationId, stored] of Object.entries(
    state.disclosure_preparations,
  )) {
    const acceptedProjection = {
      schema: stored.schema,
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
    const root = acceptedDisclosurePreparationRoot(acceptedProjection);
    const authority =
      state.disclosure_preparation_authorities[
        stored.preparation_authority_id
      ];
    const executionReceipt =
      state.disclosure_preparation_execution_receipts[
        stored.execution_receipt_id
      ];
    invariant(
      preparationId === stored.preparation_id &&
        stored.record_root === root &&
        stored.status === "ACCEPTED" &&
        stored.preparation.preparation_authority_id ===
          stored.preparation_authority_id &&
        stored.preparation.preparation_authority_root ===
          stored.preparation_authority_root &&
        authority?.disclosure_preparation_authority_root ===
          stored.preparation_authority_root &&
        executionReceipt?.record_root === stored.execution_receipt_root &&
        !preparationRoots.has(root),
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${preparationId} is not an exact accepted disclosure preparation`,
    );
    preparationRoots.add(root);
  }
  for (const approval of Object.values(state.disclosure_approval_receipts)) {
    const scan = state.disclosure_scan_receipts[approval.body.scan_receipt_id];
    invariant(
      scan?.record_root === approval.body.scan_receipt_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${approval.record_id} has a stale scan receipt`,
    );
  }
  for (const approval of Object.values(state.redaction_approvals)) {
    const manifest =
      state.redaction_manifests[approval.body.redaction_manifest_id];
    invariant(
      manifest?.record_root === approval.body.redaction_manifest_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${approval.record_id} has a stale redaction manifest`,
    );
  }
  for (const compilation of Object.values(
    state.disclosure_compilation_anchors,
  )) {
    const manifest =
      state.disclosure_manifests[compilation.body.disclosure_manifest_id];
    invariant(
      manifest?.record_root === compilation.body.disclosure_manifest_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${compilation.record_id} has a stale disclosure manifest`,
    );
  }
  for (const anchor of Object.values(state.publication_anchors)) {
    const compilation =
      state.disclosure_compilation_anchors[
        anchor.body.accepted_compilation_anchor_id
      ];
    const manifest =
      state.disclosure_manifests[anchor.body.disclosure_manifest_id];
    const capsule = state.public_capsules[anchor.body.public_capsule_id];
    const nonClaims = state.non_claims[anchor.body.non_claims_id];
    invariant(
      compilation?.record_root ===
          anchor.body.accepted_compilation_anchor_root &&
        manifest?.record_root === anchor.body.disclosure_manifest_root &&
        capsule?.record_root === anchor.body.public_capsule_root &&
        nonClaims?.record_root === anchor.body.non_claims_root,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `${anchor.record_id} has stale publication references`,
    );
  }
}

function assertFundingLineage(state) {
  for (const lot of Object.values(state.funding_lots)) {
    const seen = new Set([lot.lot_id]);
    let cursor = lot;
    while (cursor.parent_lot_id !== null) {
      invariant(
        !seen.has(cursor.parent_lot_id),
        "ERR_FUNDING_LOT_OWNER",
        `${lot.lot_id} has cyclic funding lineage`,
      );
      seen.add(cursor.parent_lot_id);
      const parent = state.funding_lots[cursor.parent_lot_id];
      invariant(
        parent &&
          parent.source_contribution_id === lot.source_contribution_id &&
          parent.source_account_id === lot.source_account_id &&
          parent.contribution_kind === lot.contribution_kind,
        "ERR_FUNDING_LOT_OWNER",
        `${lot.lot_id} has invalid funding lineage`,
      );
      cursor = parent;
    }
  }
}

function assertJobAccounts(state) {
  for (const job of Object.values(state.jobs)) {
    const matching = Object.values(state.accounts).filter(
      (account) => account.kind === "JOB" && account.owner_job_id === job.job_id,
    );
    invariant(
      matching.length === 1 && matching[0].account_id === job.job_account_id,
      "ERR_SCHEMA",
      `${job.job_id} must own exactly one job account`,
    );
    invariant(
      matching[0].available === 0,
      "ERR_SUPPLY",
      `${job.job_id} account cannot carry a duplicate scalar balance`,
    );
  }
}

function assertTerminalClosure(state) {
  for (const terminal of Object.values(state.terminal_jobs)) {
    const job = state.jobs[terminal.job_id];
    invariant(
      ["SETTLED", "CANCELLED", "ABORTED"].includes(job?.state),
      "ERR_ALREADY_TERMINAL",
      `${terminal.job_id} terminal index disagrees with job`,
    );
    invariant(
      activeLotValue(
        state,
        Object.values(state.funding_lots)
          .filter(
            (lot) =>
              lot.status === "ACTIVE" &&
              (lot.bucket_id === terminal.job_id ||
                state[OWNER[lot.bucket]?.[0]]?.[lot.bucket_id]?.job_id ===
                  terminal.job_id),
          )
          .map((lot) => lot.lot_id),
      ) === 0,
      "ERR_LIVE_TERMINAL_CHILD",
      `${terminal.job_id} retains active funding`,
    );
    for (const [mapName, liveStatuses] of Object.entries(LIVE_CHILD_STATUS)) {
      const live = Object.values(state[mapName]).filter(
        (record) =>
          record.job_id === terminal.job_id && liveStatuses.has(record.status),
      );
      invariant(
        live.length === 0,
        "ERR_LIVE_TERMINAL_CHILD",
        `${terminal.job_id} retains live ${mapName}`,
      );
    }
    const account = state.accounts[job.job_account_id];
    invariant(
      account.status === "CLOSED" && account.available === 0,
      "ERR_LIVE_TERMINAL_CHILD",
      `${terminal.job_id} account is not closed`,
    );
  }
}

function assertRouteExecutionAuthorities(state) {
  for (const accepted of Object.values(state.classified_input_manifests)) {
    invariant(
      accepted.accepted_principal_id ===
        accepted.body.measurement_principal_id &&
        accepted.accepted_controller_id ===
          accepted.body.measurement_controller_id,
      "ERR_AUTHORITY",
      "classified input measurement signer metadata is not exact",
    );
  }
  const leaseBindings = new Set();
  for (const accepted of Object.values(state.route_execution_plans)) {
    const plan = accepted.body;
    const leaseBinding = `${plan.lease_ref.record_id}:${plan.lease_ref.record_root}`;
    invariant(
      !leaseBindings.has(leaseBinding),
      "ERR_NONCE_REPLAY",
      "an accepted lease/root has more than one route execution plan",
    );
    leaseBindings.add(leaseBinding);
    const manifest =
      state.classified_input_manifests[
        plan.classified_input_manifest_ref.record_id
      ];
    const trust =
      state.worker_trust_authorities[
        plan.worker_trust_authority_ref.record_id
      ];
    invariant(
      manifest &&
        manifest.record_root ===
          plan.classified_input_manifest_ref.record_root &&
        trust &&
        trust.record_root === plan.worker_trust_authority_ref.record_root &&
        manifest.body.job_ref.record_id === plan.job_ref.record_id &&
        manifest.body.task_ref.record_id === plan.task_ref.record_id &&
        manifest.body.lease_ref.record_id === plan.lease_ref.record_id &&
        trust.body.job_ref.record_id === plan.job_ref.record_id &&
        trust.body.task_ref.record_id === plan.task_ref.record_id &&
        trust.body.lease_ref.record_id === plan.lease_ref.record_id &&
        trust.body.capability_offer_ref.record_id ===
          plan.capability_offer_ref.record_id &&
        trust.body.capability_offer_ref.record_root ===
          plan.capability_offer_ref.record_root,
      "ERR_CONTRACT_AUTHORITY_CEILING",
      "route plan manifest/trust bindings are not exact",
    );
    if (plan.data_route_authority_ref !== null) {
      const authority =
        state.data_route_authorities[
          plan.data_route_authority_ref.record_id
        ];
      invariant(
        authority &&
          authority.record_root === plan.data_route_authority_ref.record_root,
        "ERR_CONTRACT_AUTHORITY_CEILING",
        "route plan data authority is missing",
      );
    }
    if (plan.redaction_approval_ref !== null) {
      const approval =
        state.redaction_approvals[plan.redaction_approval_ref.record_id];
      invariant(
        approval &&
          approval.record_root === plan.redaction_approval_ref.record_root,
        "ERR_CONTRACT_AUTHORITY_CEILING",
        "route plan redaction authority is missing",
      );
    }
    for (const route of plan.tool_routes) {
      if (route.tool_route_authority_ref === null) continue;
      const authority =
        state.tool_route_authorities[
          route.tool_route_authority_ref.record_id
        ];
      invariant(
        authority &&
          authority.record_root === route.tool_route_authority_ref.record_root,
        "ERR_CONTRACT_AUTHORITY_CEILING",
        "route plan tool authority is missing",
      );
    }
  }

  const consumedPlans = new Set();
  for (const accepted of Object.values(state.route_plan_consumptions)) {
    const ref = accepted.body.route_execution_plan_ref;
    const plan = state.route_execution_plans[ref.record_id];
    invariant(
      plan &&
        plan.record_root === ref.record_root &&
        !consumedPlans.has(ref.record_id),
      "ERR_NONCE_REPLAY",
      "route plan consumption is missing its plan or is duplicated",
    );
    consumedPlans.add(ref.record_id);
  }
}

export function validateState(state) {
  assertRouteExecutionAuthorities(state);
  invariant(
    Number.isSafeInteger(state.tick) && state.tick >= 0,
    "ERR_TICK",
    "state tick must be a non-negative safe integer",
  );
  assertAmount(state.supply);
  for (const account of Object.values(state.accounts)) {
    assertAmount(account.available);
  }
  assertRecordRoots(state);
  assertFundingOwnership(state);
  assertFundingLineage(state);
  assertJobAccounts(state);
  assertAppealLineage(state);
  assertIdempotencyState(state);
  assertCapabilityAndConsentState(state);
  assertPublicExportState(state);
  assertComputeAndCapabilityCeilings(state);
  assertReviewState(state);
  assertAcceptedCarriers(state);
  invariant(
    conservedSupply(state) === state.supply,
    "ERR_SUPPLY",
    "SIM_CREDIT supply drift",
  );
  assertTerminalClosure(state);
  return {
    record_roots: "PASS",
    funding_ownership: "PASS",
    funding_lineage: "PASS",
    job_accounts: "PASS",
    appeal_lineage: "PASS",
    idempotency: "PASS",
    capability_and_consent: "PASS",
    public_export: "PASS",
    aggregate_authority_ceiling: "PASS",
    review_state: "PASS",
    accepted_carriers: "PASS",
    conservation: "PASS",
    terminal_closure: "PASS",
  };
}
