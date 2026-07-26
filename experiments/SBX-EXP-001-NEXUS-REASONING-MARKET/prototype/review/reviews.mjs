import {
  assertCanonicalValue,
  canonicalize,
} from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import { hash, rootId } from "../core/hash.mjs";
import { capabilityOfferRoot } from "../core/reducer.mjs";
import {
  resolveAcceptedRecord,
  resolveAcceptedRecordSet,
} from "../core/resolver.mjs";

const ACCEPTED_RECORD_REF_FIELDS = Object.freeze([
  "record_type",
  "record_id",
  "record_root",
]);

const ACCEPTED_ENVELOPE_FIELDS = Object.freeze([
  "schema",
  "accepted_application_state_root",
  "accepted_logical_tick",
  "record_type",
  "record_id",
  "record_root",
  "record_revision",
  "record_status",
  "record",
]);

const ACCEPTED_RECORD_SET_ENVELOPE_FIELDS = Object.freeze([
  "schema",
  "accepted_application_state_root",
  "accepted_logical_tick",
  "record_type",
  "scope",
  "scope_root",
  "set_root",
  "records",
]);

const ACCEPTED_RECORD_SET_ENTRY_FIELDS = Object.freeze([
  "record_id",
  "record_root",
  "record_revision",
  "record_status",
  "record",
]);

const CANDIDATE_FIELDS = Object.freeze([
  "capability_offer_ref",
  "reviewer_eligibility_ref",
]);

const REVIEW_FIELDS = Object.freeze([
  "schema",
  "review_assignment_id",
  "reviewer_seat_id",
  "model_id",
  "provider_family",
  "operator_id",
  "prompt_lineage_root",
  "toolchain_root",
  "machine_declaration",
  "verifier_implementation",
  "packet_root",
  "required_check_manifest_root",
  "verdict",
  "severity",
  "findings",
  "claims",
  "evidence_refs",
  "limitations",
  "nonce",
]);

const REVIEWER_ELIGIBILITY_FIELDS = Object.freeze([
  "schema",
  "job_id",
  "packet_root",
  "reviewer_principal_id",
  "reviewer_seat_id",
  "capability_offer_id",
  "capability_offer_root",
  "worker_class",
  "maximum_capability_root",
  "required_check_manifest_root",
  "model_id",
  "provider_family",
  "operator_id",
  "offer_auth_valid",
  "controller_active",
  "probe_current",
  "unrevoked",
  "conflict_policy_root",
  "conflict_free",
  "policy_root",
  "not_before_tick",
  "expiry_tick",
  "evaluated_tick",
]);

const REVIEW_PACKET_FIELDS = Object.freeze([
  "schema",
  "job_id",
  "contract_root",
  "artifact_root",
  "source_root",
  "manifest_root",
  "deterministic_evidence_root",
  "required_check_manifest_root",
  "rubric_root",
  "policy_root",
  "conflict_policy_root",
  "required_review_count",
  "required_diversity_dimensions",
  "questions",
  "max_compute_units",
  "expiry_tick",
]);

const FINDING_FIELDS = Object.freeze([
  "schema",
  "finding_id",
  "severity",
  "material",
  "resolved",
  "description",
  "evidence_ref_ids",
]);

const CLAIM_FIELDS = Object.freeze([
  "schema",
  "claim_id",
  "statement",
  "evidence_ref_ids",
]);

const EVIDENCE_REF_FIELDS = Object.freeze([
  "schema",
  "evidence_ref_id",
  "evidence_root",
  "locator",
]);

const LIMITATION_FIELDS = Object.freeze([
  "schema",
  "limitation_id",
  "description",
]);

const SEVERITIES = new Set([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

const SEVERITY_RANK = new Map(
  ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
    (severity, index) => [severity, index],
  ),
);

const REASON_ORDER = Object.freeze([
  "ERR_REVIEW_SELF",
  "ERR_REVIEW_DUPLICATE_MODEL",
  "ERR_REVIEW_PACKET_MISMATCH",
  "ERR_REVIEW_ASSIGNMENT_EXPIRED",
  "ERR_REVIEW_ASSIGNMENT",
  "ERR_CAPABILITY",
]);

const REASON_RANK = new Map(
  REASON_ORDER.map((reason, index) => [reason, index]),
);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertExactKeys(object, requiredFields, optionalFields, label) {
  invariant(
    object && typeof object === "object" && !Array.isArray(object),
    "ERR_SCHEMA",
    `${label} must be an object`,
  );
  const allowed = new Set([...requiredFields, ...optionalFields]);
  for (const field of requiredFields) {
    invariant(
      Object.hasOwn(object, field),
      "ERR_SCHEMA",
      `${label}.${field} is required`,
    );
  }
  for (const field of Object.keys(object)) {
    invariant(
      allowed.has(field),
      "ERR_SCHEMA",
      `${label}.${field} is not allowed`,
    );
  }
}

function assertNonEmptyString(value, label) {
  invariant(
    typeof value === "string" && value.length > 0,
    "ERR_SCHEMA",
    `${label} must be a non-empty string`,
  );
}

function assertSafeNonNegative(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    "ERR_UNSAFE_INTEGER",
    `${label} must be a non-negative safe integer`,
  );
}

function assertSortedUniqueStrings(values, label) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  for (let index = 0; index < values.length; index += 1) {
    assertNonEmptyString(values[index], `${label}[${index}]`);
    if (index > 0) {
      invariant(
        compareStrings(values[index - 1], values[index]) < 0,
        "ERR_NON_CANONICAL",
        `${label} must be sorted and unique`,
      );
    }
  }
}

function assertSortedObjects(values, idKey, label) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  for (let index = 0; index < values.length; index += 1) {
    assertNonEmptyString(values[index]?.[idKey], `${label}[${index}].${idKey}`);
    if (index > 0) {
      invariant(
        compareStrings(values[index - 1][idKey], values[index][idKey]) < 0,
        "ERR_NON_CANONICAL",
        `${label} must be sorted and unique by ${idKey}`,
      );
    }
  }
}

function sortedUniqueStrings(values, label) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  const result = values.map((value, index) => {
    assertNonEmptyString(value, `${label}[${index}]`);
    return value;
  });
  return [...new Set(result)].sort(compareStrings);
}

function orderedReasons(reasons) {
  return [...new Set(reasons)].sort((left, right) => {
    const leftRank = REASON_RANK.get(left) ?? REASON_ORDER.length;
    const rightRank = REASON_RANK.get(right) ?? REASON_ORDER.length;
    return leftRank - rightRank || compareStrings(left, right);
  });
}

function immutableCanonicalSnapshot(value) {
  assertCanonicalValue(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((entry) => immutableCanonicalSnapshot(entry)),
    );
  }
  const snapshot = {};
  for (const key of Object.keys(value).sort(compareStrings)) {
    snapshot[key] = immutableCanonicalSnapshot(value[key]);
  }
  return Object.freeze(snapshot);
}

export function assertAcceptedRecordReference(
  reference,
  expectedType,
  label = "acceptedRecordRef",
) {
  assertExactKeys(reference, ACCEPTED_RECORD_REF_FIELDS, [], label);
  for (const field of ACCEPTED_RECORD_REF_FIELDS) {
    assertNonEmptyString(reference[field], `${label}.${field}`);
  }
  invariant(
    reference.record_type === expectedType,
    "ERR_SCHEMA",
    `${label}.record_type must be ${expectedType}`,
  );
  assertCanonicalValue(reference);
  return reference;
}

export function createAcceptedResolutionContext(resolver) {
  return {
    resolver,
    accepted_application_state_root: null,
    accepted_logical_tick: null,
  };
}

function bindAcceptedApplicationState(context, root, tick) {
  assertNonEmptyString(root, "accepted_application_state_root");
  assertSafeNonNegative(tick, "accepted_logical_tick");
  if (context.accepted_application_state_root === null) {
    context.accepted_application_state_root = root;
    context.accepted_logical_tick = tick;
  } else {
    invariant(
      context.accepted_application_state_root === root &&
        context.accepted_logical_tick === tick,
      "ERR_PREDECESSOR",
      "accepted records come from different application states or ticks",
    );
  }
}

export function resolveAcceptedReference(
  context,
  reference,
  expectedType,
  { immutable = false, label = "acceptedRecordRef" } = {},
) {
  assertAcceptedRecordReference(reference, expectedType, label);
  const envelope = resolveAcceptedRecord(context.resolver, {
    record_type: reference.record_type,
    record_id: reference.record_id,
    record_root: reference.record_root,
  });
  assertExactKeys(
    envelope,
    ACCEPTED_ENVELOPE_FIELDS,
    [],
    `${label}Envelope`,
  );
  invariant(
    Object.isFrozen(envelope) &&
      envelope.schema === "nexus-accepted-record-envelope-v2" &&
      envelope.record_type === reference.record_type &&
      envelope.record_id === reference.record_id &&
      envelope.record_root === reference.record_root,
    "ERR_PREDECESSOR",
    `${label} did not resolve to its exact accepted record`,
  );
  bindAcceptedApplicationState(
    context,
    envelope.accepted_application_state_root,
    envelope.accepted_logical_tick,
  );
  if (immutable) {
    invariant(
      envelope.record_revision === 0 &&
        envelope.record_status === "ACCEPTED",
      "ERR_PREDECESSOR",
      `${label} must be an immutable accepted record`,
    );
  } else {
    invariant(
      Number.isSafeInteger(envelope.record_revision) &&
        envelope.record_revision >= 0 &&
        envelope.record?.record_revision === envelope.record_revision &&
        envelope.record?.record_root === envelope.record_root,
      "ERR_PREDECESSOR",
      `${label} must be the current accepted revision`,
    );
  }
  return envelope;
}

export function resolveAcceptedAssignmentSet(
  context,
  { jobId, packetRoot, assignmentSlot },
  label = "reviewAssignmentSet",
) {
  assertNonEmptyString(jobId, `${label}.jobId`);
  assertNonEmptyString(packetRoot, `${label}.packetRoot`);
  assertSafeNonNegative(assignmentSlot, `${label}.assignmentSlot`);
  const scope = {
    assignment_slot: assignmentSlot,
    job_id: jobId,
    review_packet_root: packetRoot,
  };
  const envelope = resolveAcceptedRecordSet(context.resolver, {
    record_type: "REVIEW_ASSIGNMENT",
    scope,
  });
  assertExactKeys(
    envelope,
    ACCEPTED_RECORD_SET_ENVELOPE_FIELDS,
    [],
    `${label}Envelope`,
  );
  invariant(
    Object.isFrozen(envelope) &&
      envelope.schema ===
        "nexus-accepted-record-set-envelope-v2" &&
      envelope.record_type === "REVIEW_ASSIGNMENT" &&
      canonicalize(envelope.scope) === canonicalize(scope) &&
      Array.isArray(envelope.records),
    "ERR_PREDECESSOR",
    `${label} did not resolve to its exact accepted record set`,
  );
  assertNonEmptyString(envelope.scope_root, `${label}.scope_root`);
  assertNonEmptyString(envelope.set_root, `${label}.set_root`);
  bindAcceptedApplicationState(
    context,
    envelope.accepted_application_state_root,
    envelope.accepted_logical_tick,
  );
  for (const [index, entry] of envelope.records.entries()) {
    assertExactKeys(
      entry,
      ACCEPTED_RECORD_SET_ENTRY_FIELDS,
      [],
      `${label}.records[${index}]`,
    );
    const assignment = entry.record;
    invariant(
      Object.isFrozen(entry) &&
        entry.record_id === assignment.review_assignment_id &&
        assignment.job_id === jobId &&
        assignment.packet_root === packetRoot &&
        assignment.slot === assignmentSlot &&
        Number.isSafeInteger(assignment.attempt) &&
        assignment.attempt > 0,
      "ERR_PREDECESSOR",
      `${label}.records[${index}] violates its accepted scope`,
    );
  }
  return envelope;
}

function resolveCompleteAssignmentSets(
  context,
  jobId,
  packetRoot,
  requiredReviewCount,
) {
  assertSafeNonNegative(requiredReviewCount, "requiredReviewCount");
  return Array.from({ length: requiredReviewCount }, (_, assignmentSlot) =>
    resolveAcceptedAssignmentSet(
      context,
      { jobId, packetRoot, assignmentSlot },
      `reviewAssignmentSets[${assignmentSlot}]`,
    ),
  );
}

export function validateReviewPacketValue(packet) {
  assertExactKeys(packet, REVIEW_PACKET_FIELDS, [], "reviewPacket");
  invariant(
    packet.schema === "nexus-review-packet-v2",
    "ERR_SCHEMA",
    "unsupported review packet schema",
  );
  for (const field of [
    "job_id",
    "contract_root",
    "artifact_root",
    "source_root",
    "manifest_root",
    "deterministic_evidence_root",
    "required_check_manifest_root",
    "rubric_root",
    "policy_root",
    "conflict_policy_root",
  ]) {
    assertNonEmptyString(packet[field], `reviewPacket.${field}`);
  }
  assertSortedUniqueStrings(packet.questions, "reviewPacket.questions");
  assertSafeNonNegative(
    packet.required_review_count,
    "reviewPacket.required_review_count",
  );
  invariant(
    packet.required_review_count === 3,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review packet must bind exactly three reviews",
  );
  assertSortedUniqueStrings(
    packet.required_diversity_dimensions,
    "reviewPacket.required_diversity_dimensions",
  );
  invariant(
    packet.required_diversity_dimensions.length > 0 &&
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
    "review packet has unsupported diversity requirements",
  );
  assertSafeNonNegative(
    packet.max_compute_units,
    "reviewPacket.max_compute_units",
  );
  assertSafeNonNegative(packet.expiry_tick, "reviewPacket.expiry_tick");
  assertCanonicalValue(packet);
  return packet;
}

export function reviewerEligibilityRoot(facts) {
  assertExactKeys(
    facts,
    REVIEWER_ELIGIBILITY_FIELDS,
    [],
    "eligibilityFacts",
  );
  invariant(
    facts.schema === "nexus-reviewer-eligibility-v2",
    "ERR_SCHEMA",
    "unsupported reviewer eligibility schema",
  );
  for (const field of [
    "job_id",
    "packet_root",
    "reviewer_principal_id",
    "reviewer_seat_id",
    "capability_offer_root",
    "worker_class",
    "maximum_capability_root",
    "required_check_manifest_root",
    "model_id",
    "provider_family",
    "operator_id",
    "policy_root",
  ]) {
    assertNonEmptyString(facts[field], `eligibilityFacts.${field}`);
  }
  invariant(
    /^OFFER-[0-9a-f]{64}$/.test(facts.capability_offer_id) &&
      /^[0-9a-f]{64}$/.test(facts.capability_offer_root),
    "ERR_SCHEMA",
    "eligibilityFacts capability offer ID/root must be canonical",
  );
  for (const field of [
    "offer_auth_valid",
    "controller_active",
    "probe_current",
    "unrevoked",
    "conflict_free",
  ]) {
    invariant(
      typeof facts[field] === "boolean",
      "ERR_SCHEMA",
      `eligibilityFacts.${field} must be boolean`,
    );
  }
  for (const field of [
    "not_before_tick",
    "expiry_tick",
    "evaluated_tick",
  ]) {
    assertSafeNonNegative(facts[field], `eligibilityFacts.${field}`);
  }
  invariant(
    facts.not_before_tick < facts.expiry_tick &&
      facts.evaluated_tick >= facts.not_before_tick &&
      facts.evaluated_tick < facts.expiry_tick,
    "ERR_TICK",
    "reviewer eligibility tick window is invalid",
  );
  assertCanonicalValue(facts);
  return hash("NEXUS_REVIEWER_ELIGIBILITY_V2", facts);
}

function modelReviewPreimage(review) {
  assertExactKeys(review, REVIEW_FIELDS, ["review_id"], "review");
  const body = {};
  for (const field of REVIEW_FIELDS) body[field] = review[field];
  invariant(
    body.schema === "nexus-model-review-v2",
    "ERR_SCHEMA",
    "unsupported review schema",
  );
  invariant(
    ["CLEAR", "DISSENT", "HOLD"].includes(body.verdict),
    "ERR_SCHEMA",
    "unsupported review verdict",
  );
  invariant(
    SEVERITIES.has(body.severity),
    "ERR_SCHEMA",
    "unsupported review severity",
  );
  for (const field of [
    "review_assignment_id",
    "reviewer_seat_id",
    "model_id",
    "provider_family",
    "operator_id",
    "prompt_lineage_root",
    "toolchain_root",
    "machine_declaration",
    "verifier_implementation",
    "packet_root",
    "required_check_manifest_root",
    "nonce",
  ]) {
    assertNonEmptyString(body[field], `review.${field}`);
  }

  assertSortedObjects(
    body.evidence_refs,
    "evidence_ref_id",
    "review.evidence_refs",
  );
  for (const [index, reference] of body.evidence_refs.entries()) {
    assertExactKeys(
      reference,
      EVIDENCE_REF_FIELDS,
      [],
      `review.evidence_refs[${index}]`,
    );
    invariant(
      reference.schema === "nexus-review-evidence-ref-v1",
      "ERR_SCHEMA",
      "unsupported review evidence-ref schema",
    );
    assertNonEmptyString(
      reference.evidence_root,
      `review.evidence_refs[${index}].evidence_root`,
    );
    assertNonEmptyString(
      reference.locator,
      `review.evidence_refs[${index}].locator`,
    );
  }
  const evidenceRefCounts = new Map();
  for (const reference of body.evidence_refs) {
    evidenceRefCounts.set(
      reference.evidence_ref_id,
      (evidenceRefCounts.get(reference.evidence_ref_id) ?? 0) + 1,
    );
  }

  assertSortedObjects(body.findings, "finding_id", "review.findings");
  for (const [index, finding] of body.findings.entries()) {
    assertExactKeys(
      finding,
      FINDING_FIELDS,
      [],
      `review.findings[${index}]`,
    );
    invariant(
      finding.schema === "nexus-review-finding-v1" &&
        SEVERITIES.has(finding.severity) &&
        typeof finding.material === "boolean" &&
        typeof finding.resolved === "boolean",
      "ERR_SCHEMA",
      `review.findings[${index}] has invalid registered fields`,
    );
    invariant(
      !["HIGH", "CRITICAL"].includes(finding.severity) ||
        finding.material === true,
      "ERR_SCHEMA",
      `review.findings[${index}] HIGH/CRITICAL severity must be material`,
    );
    assertNonEmptyString(
      finding.description,
      `review.findings[${index}].description`,
    );
    assertSortedUniqueStrings(
      finding.evidence_ref_ids,
      `review.findings[${index}].evidence_ref_ids`,
    );
    invariant(
      finding.evidence_ref_ids.every(
        (id) => evidenceRefCounts.get(id) === 1,
      ),
      "ERR_REVIEW_PACKET_MISMATCH",
      `review.findings[${index}] has a dangling or ambiguous evidence reference`,
    );
  }
  const maximumFindingSeverity = body.findings.reduce(
    (maximum, finding) =>
      SEVERITY_RANK.get(finding.severity) >
      SEVERITY_RANK.get(maximum)
        ? finding.severity
        : maximum,
    "NONE",
  );
  invariant(
    body.severity === maximumFindingSeverity,
    "ERR_SCHEMA",
    "review.severity must equal the maximum finding severity",
  );

  assertSortedObjects(body.claims, "claim_id", "review.claims");
  for (const [index, claim] of body.claims.entries()) {
    assertExactKeys(
      claim,
      CLAIM_FIELDS,
      [],
      `review.claims[${index}]`,
    );
    invariant(
      claim.schema === "nexus-review-claim-v1",
      "ERR_SCHEMA",
      "unsupported review claim schema",
    );
    assertNonEmptyString(
      claim.statement,
      `review.claims[${index}].statement`,
    );
    assertSortedUniqueStrings(
      claim.evidence_ref_ids,
      `review.claims[${index}].evidence_ref_ids`,
    );
    invariant(
      claim.evidence_ref_ids.every(
        (id) => evidenceRefCounts.get(id) === 1,
      ),
      "ERR_REVIEW_PACKET_MISMATCH",
      `review.claims[${index}] has a dangling or ambiguous evidence reference`,
    );
  }

  assertSortedObjects(
    body.limitations,
    "limitation_id",
    "review.limitations",
  );
  for (const [index, limitation] of body.limitations.entries()) {
    assertExactKeys(
      limitation,
      LIMITATION_FIELDS,
      [],
      `review.limitations[${index}]`,
    );
    invariant(
      limitation.schema === "nexus-review-limitation-v1",
      "ERR_SCHEMA",
      "unsupported review limitation schema",
    );
    assertNonEmptyString(
      limitation.description,
      `review.limitations[${index}].description`,
    );
  }
  assertCanonicalValue(body);
  return body;
}

export function modelReviewHash(review) {
  return hash("NEXUS_MODEL_REVIEW_V2", modelReviewPreimage(review));
}

export function modelReviewId(review) {
  return rootId(
    "REVIEW",
    "NEXUS_MODEL_REVIEW_V2",
    modelReviewPreimage(review),
  );
}

function assertCandidateDescriptor(candidate, label = "candidate") {
  assertExactKeys(candidate, CANDIDATE_FIELDS, [], label);
  assertAcceptedRecordReference(
    candidate.capability_offer_ref,
    "CAPABILITY_OFFER",
    `${label}.capability_offer_ref`,
  );
  assertAcceptedRecordReference(
    candidate.reviewer_eligibility_ref,
    "REVIEWER_ELIGIBILITY",
    `${label}.reviewer_eligibility_ref`,
  );
}

function resolveCandidate(context, candidate, label = "candidate") {
  assertCandidateDescriptor(candidate, label);
  const offerEnvelope = resolveAcceptedReference(
    context,
    candidate.capability_offer_ref,
    "CAPABILITY_OFFER",
    { immutable: true, label: `${label}.capability_offer_ref` },
  );
  const eligibilityEnvelope = resolveAcceptedReference(
    context,
    candidate.reviewer_eligibility_ref,
    "REVIEWER_ELIGIBILITY",
    { immutable: true, label: `${label}.reviewer_eligibility_ref` },
  );
  const offer = offerEnvelope.record;
  const eligibilityRecord = eligibilityEnvelope.record;
  assertExactKeys(
    eligibilityRecord,
    ["eligibility_id", "eligibility_root", "facts", "status"],
    [],
    `${label}.reviewerEligibility`,
  );
  const eligibilityRoot = reviewerEligibilityRoot(
    eligibilityRecord.facts,
  );
  invariant(
    offer?.offer_id === offerEnvelope.record_id &&
      capabilityOfferRoot(offer) === offerEnvelope.record_root &&
      eligibilityRecord.eligibility_id ===
        eligibilityEnvelope.record_id &&
      eligibilityRecord.eligibility_root ===
        eligibilityEnvelope.record_root &&
      eligibilityRecord.eligibility_root === eligibilityRoot &&
      eligibilityRecord.status === "ACCEPTED",
    "ERR_REVIEW_ASSIGNMENT",
    `${label} accepted records are internally inconsistent`,
  );
  return {
    candidate,
    offerEnvelope,
    eligibilityEnvelope,
    offer,
    eligibilityRecord,
    facts: eligibilityRecord.facts,
  };
}

function assignmentIsLive(assignment) {
  return ["ASSIGNED", "RETURNED", "VALID"].includes(assignment.status);
}

function compareResolvedCandidates(left, right) {
  for (const field of [
    "reviewer_seat_id",
    "model_id",
    "capability_offer_root",
  ]) {
    const order = compareStrings(left.facts[field], right.facts[field]);
    if (order !== 0) return order;
  }
  return 0;
}

function candidateEligibility({
  resolved,
  jobId,
  workerSeatId,
  packet,
  packetRoot,
  policyRoot,
  tick,
  existingAssignments,
}) {
  const { offer, facts } = resolved;
  const reasons = [];
  if (
    facts.job_id !== jobId ||
    facts.packet_root !== packetRoot ||
    facts.policy_root !== policyRoot ||
    facts.required_check_manifest_root !==
      packet.required_check_manifest_root ||
    facts.conflict_policy_root !== packet.conflict_policy_root
  ) {
    reasons.push("ERR_REVIEW_PACKET_MISMATCH");
  }
  if (
    facts.offer_auth_valid !== true ||
    facts.controller_active !== true ||
    facts.probe_current !== true ||
    facts.unrevoked !== true ||
    facts.conflict_free !== true ||
    facts.worker_class !== "REGISTERED" ||
    offer?.worker_class !== "REGISTERED"
  ) {
    reasons.push("ERR_CAPABILITY");
  }
  if (facts.reviewer_seat_id === workerSeatId) {
    reasons.push("ERR_REVIEW_SELF");
  }
  if (
    offer?.offer_id !== facts.capability_offer_id ||
    resolved.offerEnvelope.record_root !==
      facts.capability_offer_root ||
    offer.principal_id !== facts.reviewer_principal_id ||
    offer.worker_seat_id !== facts.reviewer_seat_id ||
    offer.model_id !== facts.model_id ||
    offer.provider_family !== facts.provider_family ||
    offer.operator_id !== facts.operator_id ||
    offer.worker_class !== facts.worker_class ||
    offer.maximum_capability_root !== facts.maximum_capability_root ||
    offer.not_before_tick !== facts.not_before_tick ||
    offer.expiry_tick !== facts.expiry_tick
  ) {
    reasons.push("ERR_CAPABILITY");
  }
  if (
    facts.evaluated_tick !== tick ||
    tick < facts.not_before_tick ||
    tick >= facts.expiry_tick ||
    tick >= packet.expiry_tick
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT_EXPIRED");
  }

  const packetAssignments = existingAssignments.filter(
    (assignment) => assignment.packet_root === packetRoot,
  );
  if (
    packetAssignments.some(
      (assignment) =>
        assignment.reviewer_seat_id === facts.reviewer_seat_id,
    )
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }
  if (
    packetAssignments.some(
      (assignment) => assignment.model_id === facts.model_id,
    )
  ) {
    reasons.push("ERR_REVIEW_DUPLICATE_MODEL");
  }
  const reasonCodes = orderedReasons(reasons);
  return Object.freeze({
    eligible: reasonCodes.length === 0,
    reason_codes: Object.freeze(reasonCodes),
    reviewer_seat_id: facts.reviewer_seat_id,
    principal_id: facts.reviewer_principal_id,
    model_id: facts.model_id,
    provider_family: facts.provider_family,
    operator_id: facts.operator_id,
    capability_offer_id: facts.capability_offer_id,
    capability_offer_root: facts.capability_offer_root,
    maximum_capability_root: facts.maximum_capability_root,
    required_check_manifest_root:
      facts.required_check_manifest_root,
    eligibility_id: resolved.eligibilityRecord.eligibility_id,
    eligibility_root: resolved.eligibilityRecord.eligibility_root,
    eligibility_facts: immutableCanonicalSnapshot(facts),
    not_before_tick: facts.not_before_tick,
    expiry_tick: facts.expiry_tick,
  });
}

function resolvePacket(context, packetRef) {
  const packetEnvelope = resolveAcceptedReference(
    context,
    packetRef,
    "REVIEW_PACKET",
    { immutable: true, label: "packetRef" },
  );
  validateReviewPacketValue(packetEnvelope.record);
  invariant(
    packetEnvelope.record_id === packetEnvelope.record_root,
    "ERR_REVIEW_PACKET_MISMATCH",
    "review packet accepted ID/root convention is invalid",
  );
  const conflictEnvelope = resolveAcceptedReference(
    context,
    {
      record_type: "CONFLICT_POLICY",
      record_id: `CONFLICT-${packetEnvelope.record.conflict_policy_root}`,
      record_root: packetEnvelope.record.conflict_policy_root,
    },
    "CONFLICT_POLICY",
    { immutable: true, label: "reviewPacket.conflictPolicyRef" },
  );
  invariant(
    conflictEnvelope.record.job_id === packetEnvelope.record.job_id &&
      conflictEnvelope.record.source_policy_root ===
        packetEnvelope.record.policy_root,
    "ERR_REVIEW_PACKET_MISMATCH",
    "review packet conflict policy has the wrong scope",
  );
  return packetEnvelope;
}

export function resolveAssignmentAuthorities(context, assignmentEnvelope) {
  const assignment = assignmentEnvelope.record;
  const eligibilityEnvelope = resolveAcceptedReference(
    context,
    {
      record_type: "REVIEWER_ELIGIBILITY",
      record_id: assignment.eligibility_id,
      record_root: assignment.eligibility_root,
    },
    "REVIEWER_ELIGIBILITY",
    { immutable: true, label: "assignment.reviewerEligibilityRef" },
  );
  const offerEnvelope = resolveAcceptedReference(
    context,
    {
      record_type: "CAPABILITY_OFFER",
      record_id: assignment.capability_offer_id,
      record_root: assignment.capability_offer_root,
    },
    "CAPABILITY_OFFER",
    { immutable: true, label: "assignment.capabilityOfferRef" },
  );
  const eligibilityRecord = eligibilityEnvelope.record;
  const facts = eligibilityRecord.facts;
  invariant(
    eligibilityRecord.eligibility_id === assignment.eligibility_id &&
      eligibilityRecord.eligibility_root === assignment.eligibility_root &&
      eligibilityRecord.status === "ACCEPTED" &&
      reviewerEligibilityRoot(facts) === assignment.eligibility_root &&
      canonicalize(facts) === canonicalize(assignment.eligibility_facts),
    "ERR_REVIEW_ASSIGNMENT",
    "assignment does not bind its accepted reviewer eligibility",
  );
  return {
    eligibilityEnvelope,
    eligibilityRecord,
    facts,
    offerEnvelope,
    offer: offerEnvelope.record,
  };
}

export function evaluateReviewerEligibility(input) {
  assertExactKeys(
    input,
    ["resolver", "candidate", "jobRef", "packetRef"],
    [],
    "reviewer eligibility input",
  );
  const { resolver, candidate, jobRef, packetRef } = input;
  assertCandidateDescriptor(candidate);
  const context = createAcceptedResolutionContext(resolver);
  const jobEnvelope = resolveAcceptedReference(
    context,
    jobRef,
    "JOB",
    { label: "jobRef" },
  );
  const packetEnvelope = resolvePacket(context, packetRef);
  const packet = packetEnvelope.record;
  invariant(
    packet.job_id === jobEnvelope.record.job_id &&
      packet.contract_root === jobEnvelope.record.accepted_contract_root &&
      typeof jobEnvelope.record.accepted_worker_seat === "string",
    "ERR_REVIEW_PACKET_MISMATCH",
    "review packet does not bind the current accepted job",
  );
  const assignmentSets = resolveCompleteAssignmentSets(
    context,
    packet.job_id,
    packetEnvelope.record_id,
    packet.required_review_count,
  );
  let resolved;
  try {
    resolved = resolveCandidate(context, candidate);
  } catch (error) {
    if (error?.code === "ERR_AUTHORITY") throw error;
    return Object.freeze({
      eligible: false,
      reason_codes: Object.freeze(["ERR_REVIEW_ASSIGNMENT"]),
      reviewer_seat_id: null,
      principal_id: null,
      model_id: null,
      provider_family: null,
      operator_id: null,
      capability_offer_root: null,
      maximum_capability_root: null,
      required_check_manifest_root: null,
      eligibility_id: null,
      eligibility_root: null,
      eligibility_facts: null,
      not_before_tick: null,
      expiry_tick: null,
      accepted_application_state_root:
        context.accepted_application_state_root,
      accepted_logical_tick: context.accepted_logical_tick,
    });
  }
  const eligibility = candidateEligibility({
    resolved,
    jobId: packet.job_id,
    workerSeatId: jobEnvelope.record.accepted_worker_seat,
    packet,
    packetRoot: packetEnvelope.record_id,
    policyRoot: packet.policy_root,
    tick: context.accepted_logical_tick,
    existingAssignments: assignmentSets.flatMap((set) =>
      set.records.map((entry) => entry.record),
    ),
  });
  return Object.freeze({
    ...eligibility,
    accepted_application_state_root:
      context.accepted_application_state_root,
    accepted_logical_tick: context.accepted_logical_tick,
  });
}

export function selectReviewAssignments(input) {
  assertExactKeys(
    input,
    [
      "resolver",
      "jobRef",
      "packetRef",
      "jobAttempt",
      "candidates",
      "amount",
      "notBeforeTick",
      "expiryTick",
    ],
    [],
    "review assignment selection input",
  );
  const {
    resolver,
    jobRef,
    packetRef,
    jobAttempt,
    candidates,
    amount,
    notBeforeTick,
    expiryTick,
  } = input;
  for (const [value, label] of [
    [jobAttempt, "jobAttempt"],
    [amount, "amount"],
    [notBeforeTick, "notBeforeTick"],
    [expiryTick, "expiryTick"],
  ]) {
    assertSafeNonNegative(value, label);
  }
  invariant(jobAttempt > 0, "ERR_SCHEMA", "jobAttempt must be positive");
  invariant(Array.isArray(candidates), "ERR_SCHEMA", "candidates must be an array");
  candidates.forEach((candidate, index) =>
    assertCandidateDescriptor(candidate, `candidates[${index}]`),
  );
  const context = createAcceptedResolutionContext(resolver);
  const jobEnvelope = resolveAcceptedReference(
    context,
    jobRef,
    "JOB",
    { label: "jobRef" },
  );
  const packetEnvelope = resolvePacket(context, packetRef);
  const packet = packetEnvelope.record;
  const job = jobEnvelope.record;
  const tick = context.accepted_logical_tick;
  const requiredReviews = packet.required_review_count;
  invariant(
    notBeforeTick < expiryTick && notBeforeTick <= tick && tick < expiryTick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "assignment window must be active and non-empty",
  );
  invariant(
    packet.job_id === job.job_id &&
      packet.contract_root === job.accepted_contract_root &&
      job.attempt === jobAttempt &&
      typeof job.accepted_worker_seat === "string" &&
      tick < packet.expiry_tick &&
      expiryTick <= packet.expiry_tick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "assignment window exceeds the accepted review packet",
  );
  const assignmentSets = resolveCompleteAssignmentSets(
    context,
    job.job_id,
    packetEnvelope.record_id,
    requiredReviews,
  );
  const existingAssignments = assignmentSets.flatMap((set) =>
    set.records.map((entry) => entry.record),
  );
  invariant(
    existingAssignments.length === 0,
    "ERR_REVIEW_ASSIGNMENT",
    "current packet already has accepted assignment history",
  );

  const candidateKeys = candidates.map(
    (candidate) =>
      `${candidate.capability_offer_ref.record_id}\u0000${candidate.reviewer_eligibility_ref.record_id}`,
  );
  if (new Set(candidateKeys).size !== candidateKeys.length) {
    return Object.freeze({
      complete: false,
      reason_codes: Object.freeze(["ERR_REVIEW_ASSIGNMENT"]),
      assignments: Object.freeze([]),
      accepted_application_state_root:
        context.accepted_application_state_root,
      accepted_logical_tick: context.accepted_logical_tick,
    });
  }
  const resolvedCandidates = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      resolvedCandidates.push(
        resolveCandidate(context, candidate, `candidates[${index}]`),
      );
    } catch (error) {
      if (error?.code === "ERR_AUTHORITY") throw error;
    }
  }
  resolvedCandidates.sort(compareResolvedCandidates);

  const selected = [];
  const provisionalAssignments = [...existingAssignments];
  for (const resolved of resolvedCandidates) {
    const eligibility = candidateEligibility({
      resolved,
      jobId: job.job_id,
      workerSeatId: job.accepted_worker_seat,
      packet,
      packetRoot: packetEnvelope.record_id,
      policyRoot: packet.policy_root,
      tick,
      existingAssignments: provisionalAssignments,
    });
    if (
      !eligibility.eligible ||
      notBeforeTick < eligibility.not_before_tick ||
      expiryTick > eligibility.expiry_tick
    ) {
      continue;
    }
    const plan = Object.freeze({
      reviewer_principal_id: eligibility.principal_id,
      reviewer_seat_id: eligibility.reviewer_seat_id,
      model_id: eligibility.model_id,
      capability_offer_id: eligibility.capability_offer_id,
      capability_offer_root: eligibility.capability_offer_root,
      expiry_tick: expiryTick,
    });
    const provisional = Object.freeze({
      job_id: job.job_id,
      slot: selected.length,
      attempt: jobAttempt,
      packet_root: packetEnvelope.record_id,
      reviewer_principal_id: eligibility.principal_id,
      reviewer_seat_id: eligibility.reviewer_seat_id,
      model_id: eligibility.model_id,
      capability_offer_id: eligibility.capability_offer_id,
      capability_offer_root: eligibility.capability_offer_root,
      maximum_capability_root: eligibility.maximum_capability_root,
      required_check_manifest_root:
        eligibility.required_check_manifest_root,
      eligibility_id: eligibility.eligibility_id,
      eligibility_root: eligibility.eligibility_root,
      amount,
      not_before_tick: notBeforeTick,
      expiry_tick: expiryTick,
      status: "ASSIGNED",
      replacement_of: null,
    });
    selected.push(plan);
    provisionalAssignments.push(provisional);
    if (selected.length === requiredReviews) break;
  }
  const complete = selected.length === requiredReviews;
  return Object.freeze({
    complete,
    reason_codes: Object.freeze(
      complete ? [] : ["ERR_REVIEW_ASSIGNMENT"],
    ),
    assignments: Object.freeze(complete ? selected : []),
    accepted_application_state_root:
      context.accepted_application_state_root,
    accepted_logical_tick: context.accepted_logical_tick,
  });
}

export function selectReviewReplacement(input) {
  assertExactKeys(
    input,
    [
      "resolver",
      "expiredAssignmentRef",
      "candidates",
      "jobRef",
      "replacementExpiryTick",
    ],
    [],
    "review replacement selection input",
  );
  const {
    resolver,
    expiredAssignmentRef,
    candidates,
    jobRef,
    replacementExpiryTick,
  } = input;
  assertSafeNonNegative(
    replacementExpiryTick,
    "replacementExpiryTick",
  );
  invariant(Array.isArray(candidates), "ERR_SCHEMA", "candidates must be an array");
  candidates.forEach((candidate, index) =>
    assertCandidateDescriptor(candidate, `candidates[${index}]`),
  );
  const context = createAcceptedResolutionContext(resolver);
  const jobEnvelope = resolveAcceptedReference(
    context,
    jobRef,
    "JOB",
    { label: "jobRef" },
  );
  const expiredEnvelope = resolveAcceptedReference(
    context,
    expiredAssignmentRef,
    "REVIEW_ASSIGNMENT",
    { label: "expiredAssignmentRef" },
  );
  const expired = expiredEnvelope.record;
  const job = jobEnvelope.record;
  const tick = context.accepted_logical_tick;
  invariant(
    expiredEnvelope.record_status === "EXPIRED" &&
      expired.status === "EXPIRED" &&
      expired.job_id === job.job_id &&
      tick >= expired.expiry_tick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "replacement requires the current canonical expired assignment",
  );
  invariant(
    Number.isSafeInteger(expired.attempt) &&
      expired.attempt > 0 &&
      Number.isSafeInteger(expired.attempt + 1),
    "ERR_UNSAFE_INTEGER",
    "replacement attempt is invalid",
  );
  const packetEnvelope = resolvePacket(context, {
    record_type: "REVIEW_PACKET",
    record_id: expired.packet_root,
    record_root: expired.packet_root,
  });
  const packet = packetEnvelope.record;
  invariant(
    packet.job_id === job.job_id &&
      packet.contract_root === job.accepted_contract_root &&
      tick < replacementExpiryTick &&
      tick < packet.expiry_tick &&
      replacementExpiryTick <= packet.expiry_tick,
    "ERR_REVIEW_ASSIGNMENT_EXPIRED",
    "replacement window exceeds the accepted review packet",
  );
  invariant(
    Number.isSafeInteger(expired.slot) &&
      expired.slot >= 0 &&
      expired.slot < packet.required_review_count,
    "ERR_REVIEW_ASSIGNMENT",
    "expired assignment slot is outside the review policy",
  );
  const assignmentSets = resolveCompleteAssignmentSets(
    context,
    expired.job_id,
    expired.packet_root,
    packet.required_review_count,
  );
  const allAssignments = assignmentSets.flatMap((set) =>
    set.records.map((entry) => entry.record),
  );
  const slotHistory = assignmentSets[expired.slot].records.map(
    (entry) => entry.record,
  );
  const matchingHistory = slotHistory.filter(
    (assignment) =>
      assignment.review_assignment_id ===
      expired.review_assignment_id,
  );
  invariant(
    matchingHistory.length === 1 &&
      canonicalize(matchingHistory[0]) === canonicalize(expired) &&
      canonicalize(slotHistory.at(-1)) === canonicalize(expired),
    "ERR_REVIEW_ASSIGNMENT",
    "expired assignment must exactly match one accepted history record",
  );
  const candidateKeys = candidates.map(
    (candidate) =>
      `${candidate.capability_offer_ref.record_id}\u0000${candidate.reviewer_eligibility_ref.record_id}`,
  );
  invariant(
    new Set(candidateKeys).size === candidateKeys.length,
    "ERR_REVIEW_ASSIGNMENT",
    "replacement candidates must be unique accepted references",
  );
  const resolvedCandidates = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      resolvedCandidates.push(
        resolveCandidate(context, candidate, `candidates[${index}]`),
      );
    } catch (error) {
      if (error?.code === "ERR_AUTHORITY") throw error;
    }
  }
  resolvedCandidates.sort(compareResolvedCandidates);
  for (const resolved of resolvedCandidates) {
    const eligibility = candidateEligibility({
      resolved,
      jobId: expired.job_id,
      workerSeatId: job.accepted_worker_seat,
      packet,
      packetRoot: expired.packet_root,
      policyRoot: packet.policy_root,
      tick,
      existingAssignments: allAssignments,
    });
    if (
      !eligibility.eligible ||
      replacementExpiryTick > eligibility.expiry_tick
    ) {
      continue;
    }
    return Object.freeze({
      reviewer_principal_id: eligibility.principal_id,
      reviewer_seat_id: eligibility.reviewer_seat_id,
      model_id: eligibility.model_id,
      capability_offer_id: eligibility.capability_offer_id,
      capability_offer_root: eligibility.capability_offer_root,
      expiry_tick: replacementExpiryTick,
    });
  }
  return null;
}

export function validateReviewPacketBinding(input) {
  assertExactKeys(
    input,
    ["resolver", "reviewRef", "assignmentRef", "packetRef"],
    [],
    "review packet binding input",
  );
  const { resolver, reviewRef, assignmentRef, packetRef } = input;
  const context = createAcceptedResolutionContext(resolver);
  const packetEnvelope = resolvePacket(context, packetRef);
  const assignmentEnvelope = resolveAcceptedReference(
    context,
    assignmentRef,
    "REVIEW_ASSIGNMENT",
    { label: "assignmentRef" },
  );
  const reviewEnvelope = resolveAcceptedReference(
    context,
    reviewRef,
    "MODEL_REVIEW",
    { immutable: true, label: "reviewRef" },
  );
  const packet = packetEnvelope.record;
  const assignment = assignmentEnvelope.record;
  const review = reviewEnvelope.record;
  const tick = context.accepted_logical_tick;
  const reasons = [];
  const derivedReviewId = modelReviewId(review);
  if (
    review.review_id !== derivedReviewId ||
    reviewEnvelope.record_root !== modelReviewHash(review)
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }
  let authorities = null;
  try {
    authorities = resolveAssignmentAuthorities(
      context,
      assignmentEnvelope,
    );
  } catch {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }
  if (
    !["ASSIGNED", "RETURNED", "VALID"].includes(
      assignmentEnvelope.record_status,
    ) ||
    review.review_assignment_id !==
      assignment.review_assignment_id ||
    review.reviewer_seat_id !== assignment.reviewer_seat_id ||
    review.model_id !== assignment.model_id
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }
  if (
    !authorities ||
    authorities.offer.offer_id !==
      assignment.capability_offer_id ||
    authorities.offer.worker_seat_id !==
      assignment.reviewer_seat_id ||
    authorities.offer.model_id !== assignment.model_id ||
    authorities.offer.provider_family !== review.provider_family ||
    authorities.offer.operator_id !== review.operator_id
  ) {
    reasons.push("ERR_CAPABILITY");
  }
  if (
    assignment.packet_root !== packetEnvelope.record_id ||
    review.packet_root !== packetEnvelope.record_id ||
    review.packet_root !== assignment.packet_root ||
    assignment.required_check_manifest_root !==
      packet.required_check_manifest_root ||
    review.required_check_manifest_root !==
      packet.required_check_manifest_root
  ) {
    reasons.push("ERR_REVIEW_PACKET_MISMATCH");
  }
  if (
    !Number.isSafeInteger(assignment.not_before_tick) ||
    !Number.isSafeInteger(assignment.expiry_tick) ||
    assignment.not_before_tick < 0 ||
    assignment.not_before_tick >= assignment.expiry_tick ||
    assignment.expiry_tick > packet.expiry_tick ||
    tick < assignment.not_before_tick ||
    tick >= assignment.expiry_tick ||
    tick >= packet.expiry_tick
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT_EXPIRED");
  }
  const reasonCodes = orderedReasons(reasons);
  return Object.freeze({
    valid: reasonCodes.length === 0,
    reason_codes: Object.freeze(reasonCodes),
    review_id: derivedReviewId,
    review_hash: modelReviewHash(review),
    packet_root: review.packet_root,
    capability_offer_root:
      authorities?.offerEnvelope.record_root ?? null,
    reviewer_eligibility_root:
      authorities?.eligibilityEnvelope.record_root ?? null,
    accepted_application_state_root:
      context.accepted_application_state_root,
    accepted_logical_tick: context.accepted_logical_tick,
  });
}
