import { assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import { hash, rootId } from "../core/hash.mjs";
import {
  createAcceptedResolutionContext,
  modelReviewHash,
  modelReviewId,
  resolveAcceptedReference,
  resolveAcceptedAssignmentSet,
  resolveAssignmentAuthorities,
  validateReviewPacketValue,
} from "./reviews.mjs";

const CHECK_RESULT_FIELDS = Object.freeze([
  "schema",
  "check_name",
  "contract_root",
  "artifact_root",
  "manifest_root",
  "verifier_root",
  "policy_root",
  "command",
  "environment_root",
  "required_check_manifest_root",
  "verifier_authority_root",
  "execution_receipt_anchor_root",
  "exit_code",
  "stdout_root",
  "stderr_root",
  "reason_codes",
  "status",
]);

const REQUIRED_CHECK_MANIFEST_FIELDS = Object.freeze([
  "schema",
  "job_id",
  "contract_root",
  "artifact_root",
  "manifest_root",
  "verifier_root",
  "policy_root",
  "environment_root",
  "ordered_check_names",
]);

const DIMENSIONS = Object.freeze([
  ["MODEL", "model_id"],
  ["PROVIDER", "provider_family"],
  ["OPERATOR", "operator_id"],
  ["PROMPT_LINEAGE", "prompt_lineage_root"],
  ["TOOLCHAIN", "toolchain_root"],
  ["MACHINE", "machine_declaration"],
  ["VERIFIER", "verifier_implementation"],
]);

const DIMENSION_NAMES = new Set(
  DIMENSIONS.map(([dimension]) => dimension),
);

const REASON_ORDER = Object.freeze([
  "ERR_DETERMINISTIC_RED",
  "ERR_REVIEW_SELF",
  "ERR_REVIEW_DUPLICATE_MODEL",
  "ERR_REVIEW_PACKET_MISMATCH",
  "ERR_REVIEW_ASSIGNMENT_EXPIRED",
  "ERR_REVIEW_ASSIGNMENT",
  "ERR_REVIEW_DIVERSITY",
  "ERR_REVIEW_DISSENT",
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

function assertNonEmptyString(value, label, code = "ERR_SCHEMA") {
  invariant(
    typeof value === "string" && value.length > 0,
    code,
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

function assertSortedUniqueStrings(
  values,
  label,
  code = "ERR_DETERMINISTIC_RED",
) {
  invariant(Array.isArray(values), code, `${label} must be an array`);
  for (let index = 0; index < values.length; index += 1) {
    assertNonEmptyString(values[index], `${label}[${index}]`, code);
    if (index > 0) {
      invariant(
        compareStrings(values[index - 1], values[index]) < 0,
        code,
        `${label} must be sorted and unique`,
      );
    }
  }
}

function orderedReasons(reasons) {
  return [...new Set(reasons)].sort((left, right) => {
    const leftRank = REASON_RANK.get(left) ?? REASON_ORDER.length;
    const rightRank = REASON_RANK.get(right) ?? REASON_ORDER.length;
    return leftRank - rightRank || compareStrings(left, right);
  });
}

function checkResultPreimage(check) {
  assertExactKeys(
    check,
    CHECK_RESULT_FIELDS,
    [],
    "check",
  );
  invariant(
    check.schema === "nexus-check-result-v1",
    "ERR_DETERMINISTIC_RED",
    "unsupported deterministic check schema",
  );
  for (const field of [
    "check_name",
    "contract_root",
    "artifact_root",
    "manifest_root",
    "verifier_root",
    "policy_root",
    "environment_root",
    "required_check_manifest_root",
    "verifier_authority_root",
    "execution_receipt_anchor_root",
    "stdout_root",
    "stderr_root",
  ]) {
    assertNonEmptyString(
      check[field],
      `check.${field}`,
      "ERR_DETERMINISTIC_RED",
    );
  }
  invariant(
    Array.isArray(check.command) &&
      check.command.length > 0 &&
      check.command.every(
        (entry) => typeof entry === "string" && entry.length > 0,
      ),
    "ERR_DETERMINISTIC_RED",
    "check.command must be a non-empty literal argv array",
  );
  assertSafeNonNegative(check.exit_code, "check.exit_code");
  assertSortedUniqueStrings(
    check.reason_codes,
    "check.reason_codes",
  );
  invariant(
    ["PASS", "FAIL", "ERROR", "TIMEOUT"].includes(check.status),
    "ERR_DETERMINISTIC_RED",
    "unsupported deterministic check status",
  );
  invariant(
    check.status !== "PASS" ||
      (check.exit_code === 0 && check.reason_codes.length === 0),
    "ERR_DETERMINISTIC_RED",
    "PASS requires exit_code 0 and no reason codes",
  );
  assertCanonicalValue(check);
  return check;
}

export function checkResultId(check) {
  return rootId(
    "CHECK",
    "NEXUS_CHECK_RESULT_V1",
    checkResultPreimage(check),
  );
}

export function requiredCheckManifestRoot(manifest) {
  assertExactKeys(
    manifest,
    REQUIRED_CHECK_MANIFEST_FIELDS,
    [],
    "requiredCheckManifest",
  );
  invariant(
    manifest.schema === "nexus-required-check-manifest-v1",
    "ERR_DETERMINISTIC_RED",
    "unsupported required-check manifest schema",
  );
  for (const field of [
    "job_id",
    "contract_root",
    "artifact_root",
    "manifest_root",
    "verifier_root",
    "policy_root",
    "environment_root",
  ]) {
    assertNonEmptyString(
      manifest[field],
      `requiredCheckManifest.${field}`,
    );
  }
  invariant(
    manifest.ordered_check_names.length > 0,
    "ERR_DETERMINISTIC_RED",
    "required-check manifest must not be empty",
  );
  assertSortedUniqueStrings(
    manifest.ordered_check_names,
    "requiredCheckManifest.ordered_check_names",
  );
  assertCanonicalValue(manifest);
  return hash("NEXUS_REQUIRED_CHECK_MANIFEST_V1", manifest);
}

export function reviewPacketRoot(packet) {
  validateReviewPacketValue(packet);
  return rootId("PACKET", "NEXUS_REVIEW_PACKET_V2", packet);
}

export function computeDeterministicEvidenceRoot({
  jobId,
  contractRoot,
  artifactRoot,
  manifestRoot,
  verifierRoot,
  policyRoot,
  environmentRoot,
  requiredCheckManifest,
  expectedRequiredCheckManifestRoot,
  verifierAuthorityRoot,
  executionReceiptAnchorRoot,
  checks,
}) {
  invariant(
    Array.isArray(checks) && checks.length > 0,
    "ERR_DETERMINISTIC_RED",
    "checks must be non-empty",
  );
  for (const [value, label] of [
    [jobId, "jobId"],
    [contractRoot, "contractRoot"],
    [artifactRoot, "artifactRoot"],
    [manifestRoot, "manifestRoot"],
    [verifierRoot, "verifierRoot"],
    [policyRoot, "policyRoot"],
    [environmentRoot, "environmentRoot"],
    [expectedRequiredCheckManifestRoot, "expectedRequiredCheckManifestRoot"],
    [verifierAuthorityRoot, "verifierAuthorityRoot"],
    [executionReceiptAnchorRoot, "executionReceiptAnchorRoot"],
  ]) {
    assertNonEmptyString(value, label, "ERR_DETERMINISTIC_RED");
  }
  const requiredRoot = requiredCheckManifestRoot(
    requiredCheckManifest,
  );
  invariant(
    requiredRoot === expectedRequiredCheckManifestRoot &&
      requiredCheckManifest.job_id === jobId &&
      requiredCheckManifest.contract_root === contractRoot &&
      requiredCheckManifest.artifact_root === artifactRoot &&
      requiredCheckManifest.manifest_root === manifestRoot &&
      requiredCheckManifest.verifier_root === verifierRoot &&
      requiredCheckManifest.policy_root === policyRoot &&
      requiredCheckManifest.environment_root === environmentRoot,
    "ERR_DETERMINISTIC_RED",
    "required-check manifest binding mismatch",
  );

  const checkNames = [];
  const checkRoots = [];
  for (const check of checks) {
    checkResultPreimage(check);
    invariant(
      check.contract_root === contractRoot &&
        check.artifact_root === artifactRoot &&
        check.manifest_root === manifestRoot &&
        check.verifier_root === verifierRoot &&
        check.policy_root === policyRoot &&
        check.environment_root === environmentRoot &&
        check.required_check_manifest_root === requiredRoot &&
        check.verifier_authority_root === verifierAuthorityRoot &&
        check.execution_receipt_anchor_root ===
          executionReceiptAnchorRoot,
      "ERR_DETERMINISTIC_RED",
      "deterministic check binding mismatch",
    );
    checkNames.push(check.check_name);
    checkRoots.push(checkResultId(check));
  }
  invariant(
    checkNames.length ===
      requiredCheckManifest.ordered_check_names.length &&
      checkNames.every(
        (name, index) =>
          name ===
          requiredCheckManifest.ordered_check_names[index],
      ) &&
      new Set(checkNames).size === checkNames.length &&
      new Set(checkRoots).size === checkRoots.length,
    "ERR_DETERMINISTIC_RED",
    "deterministic check names/order/root set is not exact",
  );
  return hash("NEXUS_DETERMINISTIC_EVIDENCE_V1", {
    schema: "nexus-deterministic-evidence-v1",
    job_id: jobId,
    contract_root: contractRoot,
    artifact_root: artifactRoot,
    manifest_root: manifestRoot,
    verifier_root: verifierRoot,
    policy_root: policyRoot,
    environment_root: environmentRoot,
    required_check_manifest_root: requiredRoot,
    ordered_check_roots: checkRoots,
    verifier_authority_root: verifierAuthorityRoot,
    execution_receipt_anchor_root: executionReceiptAnchorRoot,
  });
}

function normalizedDimensionValue(value) {
  if (typeof value !== "string" || value.length === 0) return "UNKNOWN";
  return value;
}

function evidenceClass(value) {
  if (value === "CONFLICTED") return "CONFLICTED";
  if (value === "UNKNOWN") return "UNKNOWN";
  return "DECLARED";
}

function relationshipFor(values) {
  if (values.some((value) => value === "CONFLICTED")) {
    return "CONFLICTED";
  }
  if (values.some((value) => value === "UNKNOWN")) return "UNKNOWN";
  return new Set(values).size === values.length
    ? "DISTINCT"
    : "SHARED";
}

function orderedReviews(reviews) {
  return [...reviews].sort((left, right) => {
    const seatOrder = compareStrings(
      left.reviewer_seat_id,
      right.reviewer_seat_id,
    );
    if (seatOrder !== 0) return seatOrder;
    return compareStrings(modelReviewHash(left), modelReviewHash(right));
  });
}

export function buildDiversityVector({
  reviews,
  assignments,
  reviewerOffers,
}) {
  invariant(Array.isArray(reviews), "ERR_SCHEMA", "reviews must be an array");
  invariant(
    Array.isArray(assignments),
    "ERR_SCHEMA",
    "assignments must be an array",
  );
  invariant(
    Array.isArray(reviewerOffers),
    "ERR_SCHEMA",
    "reviewerOffers must be an array",
  );
  reviews.forEach(modelReviewHash);
  const ordered = orderedReviews(reviews);
  const assignmentById = new Map(
    assignments.map((assignment) => [
      assignment.review_assignment_id,
      assignment,
    ]),
  );
  const offerById = new Map();
  const ambiguousOfferIds = new Set();
  for (const offer of reviewerOffers) {
    if (
      !offer ||
      typeof offer.offer_id !== "string" ||
      offerById.has(offer.offer_id)
    ) {
      if (offer?.offer_id) ambiguousOfferIds.add(offer.offer_id);
      continue;
    }
    offerById.set(offer.offer_id, offer);
  }
  const vector = [];
  for (const [dimension, field] of DIMENSIONS) {
    const evidenceRoots = [];
    const values = ordered.map((review) => {
      if (
        !["model_id", "provider_family", "operator_id"].includes(
          field,
        )
      ) {
        evidenceRoots.push(null);
        return normalizedDimensionValue(review[field]);
      }
      const assignment = assignmentById.get(
        review.review_assignment_id,
      );
      const offer = assignment
        ? offerById.get(assignment.capability_offer_id)
        : null;
      if (
        !offer ||
        ambiguousOfferIds.has(assignment.capability_offer_id)
      ) {
        evidenceRoots.push(null);
        return "UNKNOWN";
      }
      evidenceRoots.push(assignment.capability_offer_root);
      return normalizedDimensionValue(offer[field]);
    });
    const relationship = relationshipFor(values);
    for (let index = 0; index < ordered.length; index += 1) {
      vector.push(
        Object.freeze({
          dimension,
          value: values[index],
          evidence_class: evidenceClass(values[index]),
          evidence_root: evidenceRoots[index],
          relationship,
        }),
      );
    }
  }
  return Object.freeze(vector);
}

export function diversityLabels(diversityVector) {
  invariant(
    Array.isArray(diversityVector),
    "ERR_SCHEMA",
    "diversityVector must be an array",
  );
  const labels = new Set();
  const dimensions = new Map();
  for (const entry of diversityVector) {
    if (!dimensions.has(entry.dimension)) {
      dimensions.set(entry.dimension, entry.relationship);
    } else {
      invariant(
        dimensions.get(entry.dimension) === entry.relationship,
        "ERR_SCHEMA",
        `inconsistent relationship for ${entry.dimension}`,
      );
    }
  }
  for (const [dimension, relationship] of [
    ...dimensions.entries(),
  ].sort()) {
    if (relationship === "SHARED") {
      labels.add(`CORRELATED_${dimension}`);
      labels.add("CORRELATED_REVIEW");
    } else if (relationship === "UNKNOWN") {
      labels.add(`UNKNOWN_${dimension}`);
      labels.add("CORRELATED_REVIEW");
    } else if (relationship === "CONFLICTED") {
      labels.add(`CONFLICTED_${dimension}`);
      labels.add("CORRELATED_REVIEW");
    }
  }
  return Object.freeze([...labels].sort(compareStrings));
}

export function requiredDiversityReasonCodes({
  diversityVector,
  requiredDimensions,
  requiredReviewCount,
}) {
  invariant(
    Array.isArray(diversityVector) &&
      Array.isArray(requiredDimensions) &&
      Number.isSafeInteger(requiredReviewCount) &&
      requiredReviewCount > 0,
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "required diversity evaluation input is invalid",
  );
  const failed = requiredDimensions.some((dimension) => {
    invariant(
      DIMENSION_NAMES.has(dimension),
      "ERR_REVIEW_POLICY_UNSUPPORTED",
      `unknown diversity dimension ${dimension}`,
    );
    const entries = diversityVector.filter(
      (item) => item.dimension === dimension,
    );
    return (
      entries.length !== requiredReviewCount ||
      entries.some(
        (entry) =>
          entry.relationship !== "DISTINCT" ||
          entry.evidence_class !== "DECLARED" ||
          (["MODEL", "PROVIDER", "OPERATOR"].includes(dimension) &&
            entry.evidence_root === null),
      )
    );
  });
  return Object.freeze(failed ? ["ERR_REVIEW_DIVERSITY"] : []);
}

export function reviewFindingsVetoClearance(review) {
  modelReviewHash(review);
  return review.findings.some(
    (finding) =>
      finding.resolved === false &&
      (finding.material === true ||
        ["HIGH", "CRITICAL"].includes(finding.severity)),
  );
}

export function computeClearanceRoot({
  packetRoot,
  orderedReviewHashes,
  diversityVector,
  deterministicEvidenceRoot,
  policyRoot,
}) {
  for (const [value, label] of [
    [packetRoot, "packetRoot"],
    [deterministicEvidenceRoot, "deterministicEvidenceRoot"],
    [policyRoot, "policyRoot"],
  ]) {
    assertNonEmptyString(value, label);
  }
  invariant(
    Array.isArray(orderedReviewHashes) &&
      orderedReviewHashes.every(
        (value) => typeof value === "string" && value.length > 0,
      ) &&
      Array.isArray(diversityVector),
    "ERR_SCHEMA",
    "clearance review hashes/vector must be arrays",
  );
  assertCanonicalValue(diversityVector);
  return hash("NEXUS_CLEARANCE_ROOT_V1", {
    packet_root: packetRoot,
    ordered_review_hashes: orderedReviewHashes,
    diversity_vector: diversityVector,
    deterministic_evidence_root: deterministicEvidenceRoot,
    policy_root: policyRoot,
  });
}

export function computeHoldRoot({
  jobId,
  contractRoot,
  attempt,
  artifactRoot,
  packetRoot,
  orderedReviewHashes,
  deterministicEvidenceRoot,
  orderedReasonCodes,
  policyRoot,
}) {
  assertSafeNonNegative(attempt, "attempt");
  invariant(
    Array.isArray(orderedReviewHashes) &&
      Array.isArray(orderedReasonCodes),
    "ERR_SCHEMA",
    "HOLD review hashes/reason codes must be arrays",
  );
  for (const [value, label] of [
    [jobId, "jobId"],
    [contractRoot, "contractRoot"],
    [policyRoot, "policyRoot"],
  ]) {
    assertNonEmptyString(value, label);
  }
  for (const [value, label] of [
    [artifactRoot, "artifactRoot"],
    [packetRoot, "packetRoot"],
    [deterministicEvidenceRoot, "deterministicEvidenceRoot"],
  ]) {
    invariant(
      value === null ||
        (typeof value === "string" && value.length > 0),
      "ERR_SCHEMA",
      `${label} must be null or a non-empty string`,
    );
  }
  const reasonCodes = orderedReasons(orderedReasonCodes);
  invariant(
    orderedReviewHashes.every(
      (value) => typeof value === "string" && value.length > 0,
    ) &&
      reasonCodes.length > 0,
    "ERR_SCHEMA",
    "HOLD arrays contain invalid values",
  );
  return rootId("HOLD", "NEXUS_HOLD_ROOT_V1", {
    job_id: jobId,
    contract_root: contractRoot,
    attempt,
    artifact_root: artifactRoot,
    packet_root: packetRoot,
    ordered_review_hashes: [...orderedReviewHashes],
    deterministic_evidence_root: deterministicEvidenceRoot,
    ordered_reason_codes: reasonCodes,
    policy_root: policyRoot,
  });
}

export function computeThreeReviewOutcome(input) {
  assertExactKeys(
    input,
    [
      "resolver",
      "jobRef",
      "packetRef",
      "reviewRefs",
      "deterministicChecks",
      "deterministicEvidenceRoot",
      "requiredCheckManifest",
    ],
    [],
    "review outcome input",
  );
  const {
    resolver,
    jobRef,
    packetRef,
    reviewRefs,
    deterministicChecks,
    deterministicEvidenceRoot,
    requiredCheckManifest,
  } = input;
  assertNonEmptyString(
    deterministicEvidenceRoot,
    "deterministicEvidenceRoot",
  );
  invariant(Array.isArray(reviewRefs), "ERR_SCHEMA", "reviewRefs must be an array");
  invariant(
    Array.isArray(deterministicChecks),
    "ERR_SCHEMA",
    "deterministicChecks must be an array",
  );
  const context = createAcceptedResolutionContext(resolver);
  const jobEnvelope = resolveAcceptedReference(
    context,
    jobRef,
    "JOB",
    { label: "jobRef" },
  );
  const packetEnvelope = resolveAcceptedReference(
    context,
    packetRef,
    "REVIEW_PACKET",
    { immutable: true, label: "packetRef" },
  );
  const packet = validateReviewPacketValue(packetEnvelope.record);
  const conflictEnvelope = resolveAcceptedReference(
    context,
    {
      record_type: "CONFLICT_POLICY",
      record_id: `CONFLICT-${packet.conflict_policy_root}`,
      record_root: packet.conflict_policy_root,
    },
    "CONFLICT_POLICY",
    { immutable: true, label: "reviewPacket.conflictPolicyRef" },
  );
  const job = jobEnvelope.record;
  const jobId = job.job_id;
  const contractRoot = job.accepted_contract_root;
  const attempt = job.attempt;
  const artifactRoot = job.final_artifact_root;
  const workerSeatId = job.accepted_worker_seat;
  const currentTick = context.accepted_logical_tick;
  const policyRoot = packet.policy_root;
  const requiredReviews = packet.required_review_count;
  const requiredDiversityDimensions =
    packet.required_diversity_dimensions;
  assertSafeNonNegative(attempt, "attempt");
  invariant(
    requiredDiversityDimensions.every((dimension) =>
      DIMENSION_NAMES.has(dimension),
    ),
    "ERR_REVIEW_POLICY_UNSUPPORTED",
    "review packet contains an unknown diversity dimension",
  );
  invariant(
    packetEnvelope.record_id === packetEnvelope.record_root &&
      reviewPacketRoot(packet) === packetEnvelope.record_id &&
      packet.job_id === jobId &&
      packet.contract_root === contractRoot &&
      packet.artifact_root === artifactRoot &&
      conflictEnvelope.record.job_id === jobId &&
      conflictEnvelope.record.source_policy_root === policyRoot,
    "ERR_REVIEW_PACKET_MISMATCH",
    "accepted review packet identity is invalid",
  );
  const packetRoot = packetEnvelope.record_id;
  const reasons = [];

  let boundDeterministicEvidenceRoot = null;
  try {
    const firstCheck = deterministicChecks[0];
    boundDeterministicEvidenceRoot =
      computeDeterministicEvidenceRoot({
        jobId,
        contractRoot,
        artifactRoot,
        manifestRoot: packet.manifest_root,
        verifierRoot: requiredCheckManifest.verifier_root,
        policyRoot,
        environmentRoot:
          requiredCheckManifest.environment_root,
        requiredCheckManifest,
        expectedRequiredCheckManifestRoot:
          packet.required_check_manifest_root,
        verifierAuthorityRoot:
          firstCheck?.verifier_authority_root,
        executionReceiptAnchorRoot:
          firstCheck?.execution_receipt_anchor_root,
        checks: deterministicChecks,
      });
    if (
      boundDeterministicEvidenceRoot !==
        deterministicEvidenceRoot ||
      packet.deterministic_evidence_root !==
        boundDeterministicEvidenceRoot
    ) {
      reasons.push("ERR_DETERMINISTIC_RED");
    }
  } catch {
    reasons.push("ERR_DETERMINISTIC_RED");
  }
  if (
    deterministicChecks.some(
      (check) =>
        check?.status !== "PASS" ||
        check?.exit_code !== 0 ||
        check?.reason_codes?.length !== 0,
    )
  ) {
    reasons.push("ERR_DETERMINISTIC_RED");
  }
  if (
    packet.job_id !== jobId ||
    packet.contract_root !== contractRoot ||
    packet.artifact_root !== artifactRoot ||
    packet.policy_root !== policyRoot ||
    packet.required_check_manifest_root !==
      requiredCheckManifestRoot(requiredCheckManifest)
  ) {
    reasons.push("ERR_REVIEW_PACKET_MISMATCH");
  }
  if (currentTick >= packet.expiry_tick) {
    reasons.push("ERR_REVIEW_PACKET_MISMATCH");
  }

  const assignmentSets = [0, 1, 2].map((assignmentSlot) =>
    resolveAcceptedAssignmentSet(
      context,
      { jobId, packetRoot, assignmentSlot },
      `reviewAssignmentSets[${assignmentSlot}]`,
    ),
  );
  const assignmentEnvelopes = assignmentSets
    .map((set) => set.records.at(-1))
    .filter((entry) => entry !== undefined);
  const reviewEnvelopes = reviewRefs.map((reference, index) =>
    resolveAcceptedReference(
      context,
      reference,
      "MODEL_REVIEW",
      { immutable: true, label: `reviewRefs[${index}]` },
    ),
  );
  const assignments = assignmentEnvelopes.map(
    (envelope) => envelope.record,
  );
  const reviews = reviewEnvelopes.map(
    (envelope) => envelope.record,
  );
  if (
    reviews.length !== requiredReviews ||
    assignments.length !== requiredReviews
  ) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }

  const assignmentById = new Map();
  const assignmentOfferById = new Map();
  const reviewerOffers = [];
  const slots = new Set();
  for (const [index, assignmentEnvelope] of
    assignmentEnvelopes.entries()) {
    const assignment = assignmentEnvelope.record;
    assertCanonicalValue(assignment);
    if (
      typeof assignment.review_assignment_id !== "string" ||
      assignmentById.has(assignment.review_assignment_id) ||
      slots.has(assignment.slot)
    ) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
      continue;
    }
    assignmentById.set(
      assignment.review_assignment_id,
      assignment,
    );
    slots.add(assignment.slot);
    let authorities = null;
    try {
      authorities = resolveAssignmentAuthorities(
        context,
        assignmentEnvelope,
      );
    } catch {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    }
    if (authorities) {
      const { facts, offer } = authorities;
      if (
        facts.job_id !== jobId ||
        facts.packet_root !== packetRoot ||
        facts.policy_root !== policyRoot ||
        facts.required_check_manifest_root !==
          packet.required_check_manifest_root ||
        facts.conflict_policy_root !== packet.conflict_policy_root ||
        facts.conflict_free !== true ||
        facts.offer_auth_valid !== true ||
        facts.controller_active !== true ||
        facts.probe_current !== true ||
        facts.unrevoked !== true ||
        facts.evaluated_tick !== currentTick ||
        facts.worker_class !== "REGISTERED" ||
        offer.worker_class !== "REGISTERED" ||
        offer.offer_id !== assignment.capability_offer_id ||
        authorities.offerEnvelope.record_root !==
          assignment.capability_offer_root ||
        facts.capability_offer_id !== assignment.capability_offer_id ||
        facts.capability_offer_root !==
          assignment.capability_offer_root ||
        offer.principal_id !== assignment.reviewer_principal_id ||
        offer.worker_seat_id !== assignment.reviewer_seat_id ||
        offer.model_id !== assignment.model_id ||
        offer.provider_family !== facts.provider_family ||
        offer.operator_id !== facts.operator_id ||
        offer.maximum_capability_root !==
          assignment.maximum_capability_root ||
        facts.maximum_capability_root !==
          assignment.maximum_capability_root ||
        assignment.eligibility_id !==
          authorities.eligibilityRecord.eligibility_id ||
        assignment.eligibility_root !==
          authorities.eligibilityRecord.eligibility_root
      ) {
        reasons.push("ERR_REVIEW_ASSIGNMENT");
      } else {
        assignmentOfferById.set(
          assignment.review_assignment_id,
          offer,
        );
        reviewerOffers.push(offer);
      }
    }
    if (
      assignment.job_id !== jobId ||
      assignment.packet_root !== packetRoot ||
      assignment.required_check_manifest_root !==
        packet.required_check_manifest_root ||
      !["RETURNED", "VALID"].includes(
        assignmentEnvelope.record_status,
      ) ||
      assignment.status !== assignmentEnvelope.record_status
    ) {
      reasons.push(
        assignment.packet_root !== packetRoot
          ? "ERR_REVIEW_PACKET_MISMATCH"
          : "ERR_REVIEW_ASSIGNMENT",
      );
    }
    if (
      !Number.isSafeInteger(assignment.not_before_tick) ||
      !Number.isSafeInteger(assignment.expiry_tick) ||
      assignment.not_before_tick < 0 ||
      assignment.not_before_tick >= assignment.expiry_tick ||
      assignment.expiry_tick > packet.expiry_tick ||
      currentTick < assignment.not_before_tick ||
      currentTick >= assignment.expiry_tick
    ) {
      reasons.push("ERR_REVIEW_ASSIGNMENT_EXPIRED");
    }
    if (
      !Number.isSafeInteger(assignment.slot) ||
      assignment.slot < 0 ||
      assignment.slot >= requiredReviews
    ) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    }
    if (assignmentEnvelope.record_id !== assignment.review_assignment_id) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    }
    void index;
  }
  if (slots.size !== requiredReviews) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }

  const seenAssignmentIds = new Set();
  const seenSeats = new Set();
  const seenModels = new Set();
  for (const [index, reviewEnvelope] of reviewEnvelopes.entries()) {
    const review = reviewEnvelope.record;
    assertCanonicalValue(review);
    const derivedReviewId = modelReviewId(review);
    if (
      review.review_id !== derivedReviewId ||
      reviewEnvelope.record_root !== modelReviewHash(review)
    ) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    }
    const assignment = assignmentById.get(
      review.review_assignment_id,
    );
    if (
      !assignment ||
      seenAssignmentIds.has(review.review_assignment_id)
    ) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    } else {
      seenAssignmentIds.add(review.review_assignment_id);
      const reviewerOffer = assignmentOfferById.get(
        review.review_assignment_id,
      );
      if (
        review.reviewer_seat_id !== assignment.reviewer_seat_id ||
        review.model_id !== assignment.model_id ||
        !reviewerOffer ||
        review.model_id !== reviewerOffer.model_id ||
        review.provider_family !== reviewerOffer.provider_family ||
        review.operator_id !== reviewerOffer.operator_id
      ) {
        reasons.push("ERR_REVIEW_ASSIGNMENT");
      }
    }
    if (
      review.packet_root !== packetRoot ||
      review.required_check_manifest_root !==
        packet.required_check_manifest_root ||
      (assignment &&
        review.packet_root !== assignment.packet_root)
    ) {
      reasons.push("ERR_REVIEW_PACKET_MISMATCH");
    }
    if (review.reviewer_seat_id === workerSeatId) {
      reasons.push("ERR_REVIEW_SELF");
    }
    if (seenSeats.has(review.reviewer_seat_id)) {
      reasons.push("ERR_REVIEW_ASSIGNMENT");
    }
    seenSeats.add(review.reviewer_seat_id);
    if (seenModels.has(review.model_id)) {
      reasons.push("ERR_REVIEW_DUPLICATE_MODEL");
    }
    seenModels.add(review.model_id);
    if (
      review.verdict !== "CLEAR" ||
      ["HIGH", "CRITICAL"].includes(review.severity) ||
      reviewFindingsVetoClearance(review)
    ) {
      reasons.push("ERR_REVIEW_DISSENT");
    }
    void index;
  }
  if (seenAssignmentIds.size !== assignmentById.size) {
    reasons.push("ERR_REVIEW_ASSIGNMENT");
  }

  const ordered = orderedReviews(reviews);
  const orderedReviewHashes = ordered.map(modelReviewHash);
  const diversityVector = buildDiversityVector({
    reviews: ordered,
    assignments,
    reviewerOffers,
  });
  reasons.push(
    ...requiredDiversityReasonCodes({
      diversityVector,
      requiredDimensions: requiredDiversityDimensions,
      requiredReviewCount: requiredReviews,
    }),
  );
  const publicLabels = diversityLabels(diversityVector);
  const reasonCodes = orderedReasons(reasons);

  if (reasonCodes.length === 0) {
    return Object.freeze({
      outcome: "CLEARANCE",
      clearance_root: computeClearanceRoot({
        packetRoot,
        orderedReviewHashes,
        diversityVector,
        deterministicEvidenceRoot:
          boundDeterministicEvidenceRoot,
        policyRoot,
      }),
      hold_root: null,
      reason_codes: Object.freeze([]),
      ordered_review_hashes: Object.freeze(orderedReviewHashes),
      diversity_vector: diversityVector,
      public_labels: publicLabels,
      deterministic_evidence_root:
        boundDeterministicEvidenceRoot,
      accepted_application_state_root:
        context.accepted_application_state_root,
      accepted_logical_tick: context.accepted_logical_tick,
    });
  }
  return Object.freeze({
    outcome: "HOLD",
    clearance_root: null,
    hold_root: computeHoldRoot({
      jobId,
      contractRoot,
      attempt,
      artifactRoot,
      packetRoot,
      orderedReviewHashes,
      deterministicEvidenceRoot:
        boundDeterministicEvidenceRoot,
      orderedReasonCodes: reasonCodes,
      policyRoot,
    }),
    reason_codes: Object.freeze(reasonCodes),
    ordered_review_hashes: Object.freeze(orderedReviewHashes),
    diversity_vector: diversityVector,
    public_labels: publicLabels,
    deterministic_evidence_root:
      boundDeterministicEvidenceRoot,
    accepted_application_state_root:
      context.accepted_application_state_root,
    accepted_logical_tick: context.accepted_logical_tick,
  });
}
