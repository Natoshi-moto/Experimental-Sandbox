import { assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import { hash } from "../core/hash.mjs";
import {
  assertVerifiedHybridAuthenticationReference,
} from "../core/identity.mjs";
import {
  capabilityOfferRoot as coreCapabilityOfferRoot,
  capabilityOfferContentRoot as coreCapabilityOfferContentRoot,
  capabilityOfferTermsRoot,
  derivedCarrierId,
  donatedCapacityConsentBodyRoot,
  donatedCapacityConsentRecordRoot,
} from "../core/reducer.mjs";
import { resolveAcceptedRecord } from "../core/resolver.mjs";
import { draftContractRoot } from "../economy/bids.mjs";

const DATA_CLASS_RANK = Object.freeze({
  PUBLIC: 0,
  REDACTED: 1,
  PROPRIETARY: 2,
  SECRET: 3,
});

const REASON_ORDER = Object.freeze([
  "ERR_AUTHORITY",
  "ERR_TICK",
  "ERR_POLICY_ROOT",
  "ERR_CAPABILITY",
  "ERR_CONTRACT_AUTHORITY_CEILING",
  "ERR_REMOTE_EXECUTION_FORBIDDEN",
  "ERR_SECRET_REMOTE",
  "ERR_PROPRIETARY_LOCAL_ONLY",
  "ERR_BID_CONTRACT_BINDING",
  "ERR_BID_INELIGIBLE",
]);

const REASON_RANK = new Map(
  REASON_ORDER.map((reason, index) => [reason, index]),
);

const AUTH_FIELDS = Object.freeze([
  "controller_id",
  "key_id",
  "scheme",
  "schema",
  "signed_domain",
  "signed_payload_root",
]);

const OFFER_BODY_FIELDS = Object.freeze([
  "schema",
  "principal_id",
  "worker_seat_id",
  "offer_mode",
  "worker_class",
  "owner_consent_id",
  "owner_consent_root",
  "project_allowlist",
  "job_allowlist",
  "model_id",
  "provider_family",
  "operator_id",
  "route",
  "data_classes",
  "tools",
  "runtimes",
  "egress_allowlist",
  "max_input_bytes",
  "max_output_bytes",
  "max_compute_units",
  "max_active_leases",
  "isolation_root",
  "trusted_worker_policy_root",
  "maximum_capability_root",
  "contribution_terms_allowlist",
  "attribution",
  "probe_root",
  "not_before_tick",
  "expiry_tick",
  "nonce",
]);

const OFFER_BINDING_FIELDS = Object.freeze(
  OFFER_BODY_FIELDS.filter((field) => field !== "probe_root"),
);

const DONATION_CONSENT_BODY_FIELDS = Object.freeze([
  "schema",
  "principal_id",
  "controller_id",
  "offer_terms_root",
  "not_before_tick",
  "expiry_tick",
  "consent_nonce",
]);

const DONATION_CONSENT_RECORD_FIELDS = Object.freeze([
  "schema",
  "consent_id",
  "principal_id",
  "controller_id",
  "signed_body",
  "signed_body_root",
  "status",
  "authentication",
]);

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

const PROBE_BODY_FIELDS = Object.freeze([
  "schema",
  "offer_binding_root",
  "worker_seat_id",
  "capability_root",
  "capabilities",
  "status",
  "observed_tick",
  "expiry_tick",
  "policy_root",
  "nonce",
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSafeNonNegative(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    "ERR_UNSAFE_INTEGER",
    `${label} must be a non-negative safe integer`,
  );
}

function sortedUniqueStrings(values, label) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  const strings = values.map((value, index) => {
    invariant(
      typeof value === "string" && value.length > 0,
      "ERR_SCHEMA",
      `${label}[${index}] must be a non-empty string`,
    );
    return value;
  });
  return [...new Set(strings)].sort();
}

function pick(object, fields, label) {
  invariant(object && typeof object === "object", "ERR_SCHEMA", `${label} required`);
  const result = {};
  for (const field of fields) {
    invariant(
      Object.hasOwn(object, field),
      "ERR_SCHEMA",
      `${label}.${field} is required`,
    );
    result[field] = object[field];
  }
  assertCanonicalValue(result);
  return result;
}

function assertExactKeys(
  object,
  requiredFields,
  optionalFields,
  label,
) {
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

function assertStringArray(values, label, allowedValues = null) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  for (let index = 0; index < values.length; index += 1) {
    assertNonEmptyString(values[index], `${label}[${index}]`);
    invariant(
      allowedValues === null || allowedValues.has(values[index]),
      "ERR_SCHEMA",
      `${label}[${index}] is not registered`,
    );
  }
  invariant(
    new Set(values).size === values.length,
    "ERR_SCHEMA",
    `${label} must not contain duplicates`,
  );
}

function validateAuth(
  auth,
  label,
  expectedSignedDomain = "NEXUS_EVENT_AUTH_V2",
) {
  assertVerifiedHybridAuthenticationReference(auth);
  invariant(
    auth.signed_domain === expectedSignedDomain,
    "ERR_SCHEMA",
    `${label} uses an unregistered authentication value`,
  );
  assertCanonicalValue(auth);
}

function validateOfferSchema(
  offer,
  { binding = false, requireAuthentication = false } = {},
) {
  const required = binding ? OFFER_BINDING_FIELDS : OFFER_BODY_FIELDS;
  const optional = binding
    ? [
        "probe_root",
        "offer_content_root",
        "offer_id",
        "authentication",
      ]
    : ["offer_content_root", "offer_id", "authentication"];
  assertExactKeys(offer, required, optional, "offer");
  invariant(
    offer.schema === "nexus-capability-offer-v1",
    "ERR_SCHEMA",
    "unsupported capability offer schema",
  );
  for (const field of [
    "principal_id",
    "worker_seat_id",
    "worker_class",
    "model_id",
    "provider_family",
    "operator_id",
    "maximum_capability_root",
    "nonce",
  ]) {
    assertNonEmptyString(offer[field], `offer.${field}`);
  }
  invariant(
    ["PAID", "DONATED_CAPACITY"].includes(offer.offer_mode),
    "ERR_SCHEMA",
    "unsupported offer mode",
  );
  for (const field of ["owner_consent_id", "owner_consent_root"]) {
    invariant(
      offer[field] === null ||
        (typeof offer[field] === "string" && offer[field].length > 0),
      "ERR_SCHEMA",
      `offer.${field} must be null or a non-empty string`,
    );
  }
  invariant(
    (offer.owner_consent_id === null) ===
      (offer.owner_consent_root === null),
    "ERR_SCHEMA",
    "offer consent ID/root must both be null or both be present",
  );
  invariant(
    ["LOCAL", "REMOTE"].includes(offer.route),
    "ERR_SCHEMA",
    "unsupported offer route",
  );
  invariant(
    [
      "PUBLIC_ALIAS",
      "HIDDEN_FROM_PUBLIC_DISPLAY",
      "NONE",
    ].includes(offer.attribution),
    "ERR_SCHEMA",
    "unsupported offer attribution",
  );
  for (const field of [
    "project_allowlist",
    "job_allowlist",
    "tools",
    "runtimes",
    "egress_allowlist",
    "contribution_terms_allowlist",
  ]) {
    assertStringArray(offer[field], `offer.${field}`);
  }
  assertStringArray(
    offer.data_classes,
    "offer.data_classes",
    new Set(Object.keys(DATA_CLASS_RANK)),
  );
  for (const field of [
    "max_input_bytes",
    "max_output_bytes",
    "max_compute_units",
    "max_active_leases",
    "not_before_tick",
    "expiry_tick",
  ]) {
    assertSafeNonNegative(offer[field], `offer.${field}`);
  }
  invariant(
    offer.not_before_tick < offer.expiry_tick,
    "ERR_TICK",
    "offer tick window must be non-empty",
  );
  if (Object.hasOwn(offer, "probe_root")) {
    assertNonEmptyString(offer.probe_root, "offer.probe_root");
  }
  if (Object.hasOwn(offer, "offer_content_root")) {
    invariant(
      /^[0-9a-f]{64}$/.test(offer.offer_content_root),
      "ERR_SCHEMA",
      "offer.offer_content_root must be a lowercase SHA-256 root",
    );
  }
  for (const field of [
    "isolation_root",
    "trusted_worker_policy_root",
  ]) {
    invariant(
      offer[field] === null ||
        (typeof offer[field] === "string" &&
          offer[field].length > 0),
      "ERR_SCHEMA",
      `offer.${field} must be null or a non-empty string`,
    );
  }
  if (Object.hasOwn(offer, "authentication")) {
    validateAuth(offer.authentication, "offer.authentication");
  }
  invariant(
    !requireAuthentication ||
      (Object.hasOwn(offer, "authentication") &&
        Object.hasOwn(offer, "offer_content_root")),
    "ERR_AUTHORITY",
    "offer authentication and content root are required",
  );
}

function validateProbeSchema(probe) {
  assertExactKeys(probe, PROBE_BODY_FIELDS, [], "probe");
  invariant(
    probe.schema === "nexus-capability-probe-v1",
    "ERR_SCHEMA",
    "unsupported capability probe schema",
  );
  for (const field of [
    "offer_binding_root",
    "worker_seat_id",
    "capability_root",
    "policy_root",
    "nonce",
  ]) {
    assertNonEmptyString(probe[field], `probe.${field}`);
  }
  assertStringArray(probe.capabilities, "probe.capabilities");
  invariant(
    ["PASS", "FAIL", "ERROR", "TIMEOUT"].includes(probe.status),
    "ERR_SCHEMA",
    "unsupported capability probe status",
  );
  for (const field of ["observed_tick", "expiry_tick"]) {
    assertSafeNonNegative(probe[field], `probe.${field}`);
  }
  invariant(
    probe.observed_tick < probe.expiry_tick,
    "ERR_TICK",
    "probe tick window must be non-empty",
  );
  assertCanonicalValue(probe);
}

function validateConsentBodySchema(body) {
  assertExactKeys(
    body,
    DONATION_CONSENT_BODY_FIELDS,
    [],
    "donatedCapacityConsent.signed_body",
  );
  invariant(
    body.schema === "nexus-donated-capacity-consent-body-v1",
    "ERR_SCHEMA",
    "unsupported donated-capacity consent body schema",
  );
  for (const field of ["principal_id", "controller_id", "offer_terms_root", "consent_nonce"]) {
    assertNonEmptyString(
      body[field],
      `donatedCapacityConsent.signed_body.${field}`,
    );
  }
  assertSafeNonNegative(
    body.not_before_tick,
    "donatedCapacityConsent.signed_body.not_before_tick",
  );
  assertSafeNonNegative(
    body.expiry_tick,
    "donatedCapacityConsent.signed_body.expiry_tick",
  );
  invariant(
    body.not_before_tick < body.expiry_tick,
    "ERR_SCHEMA",
    "donated-capacity consent window must be non-empty",
  );
  assertCanonicalValue(body);
}

function validateConsentRecordSchema(consent) {
  assertExactKeys(
    consent,
    DONATION_CONSENT_RECORD_FIELDS,
    [],
    "donatedCapacityConsent",
  );
  invariant(
    consent.schema ===
      "nexus-accepted-donated-capacity-consent-v1" &&
      consent.status === "ACCEPTED",
    "ERR_SCHEMA",
    "unsupported accepted donated-capacity consent",
  );
  for (const field of [
    "consent_id",
    "principal_id",
    "controller_id",
    "signed_body_root",
  ]) {
    assertNonEmptyString(consent[field], `donatedCapacityConsent.${field}`);
  }
  validateConsentBodySchema(consent.signed_body);
  validateAuth(
    consent.authentication,
    "donatedCapacityConsent.authentication",
    "NEXUS_DONATED_CAPACITY_CONSENT_AUTH_V2",
  );
  assertCanonicalValue(consent);
}

function isSubset(candidate, ceiling, candidateLabel, ceilingLabel) {
  const actual = sortedUniqueStrings(candidate, candidateLabel);
  const allowed = new Set(sortedUniqueStrings(ceiling, ceilingLabel));
  return actual.every((value) => allowed.has(value));
}

function orderedReasons(reasons) {
  return [...new Set(reasons)].sort((left, right) => {
    const leftRank = REASON_RANK.get(left) ?? REASON_ORDER.length;
    const rightRank = REASON_RANK.get(right) ?? REASON_ORDER.length;
    return leftRank - rightRank || compareStrings(left, right);
  });
}

function allowedScalar(value, values, label) {
  const allowed = sortedUniqueStrings(values, label);
  return allowed.includes(value);
}

export function capabilityOfferRoot(offer) {
  validateOfferSchema(offer, { requireAuthentication: true });
  return coreCapabilityOfferRoot(offer);
}

export function capabilityOfferContentRoot(offer) {
  validateOfferSchema(offer);
  return coreCapabilityOfferContentRoot(offer);
}

export function capabilityOfferBindingRoot(offer) {
  validateOfferSchema(offer, { binding: true });
  const body = pick(offer, OFFER_BINDING_FIELDS, "offer");
  return hash("NEXUS_CAPABILITY_V1", {
    schema: "nexus-capability-offer-binding-v1",
    offer: body,
  });
}

export function capabilityProbeRoot(probe) {
  validateProbeSchema(probe);
  const body = pick(probe, PROBE_BODY_FIELDS, "probe");
  return hash("NEXUS_CAPABILITY_V1", {
    schema: "nexus-capability-probe-root-v1",
    probe: body,
  });
}

export function donatedCapacityConsentRoot(consent) {
  validateConsentRecordSchema(consent);
  return donatedCapacityConsentRecordRoot(consent);
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

function resolveAcceptedEnvelope(
  context,
  reference,
  expectedType,
  label,
  { immutable = true } = {},
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
  const envelope = resolveAcceptedRecord(context.resolver, reference);
  assertExactKeys(
    envelope,
    ACCEPTED_ENVELOPE_FIELDS,
    [],
    `${label}Envelope`,
  );
  invariant(
    Object.isFrozen(envelope) &&
      envelope.schema === "nexus-accepted-record-envelope-v2" &&
      envelope.record_type === expectedType &&
      envelope.record_id === reference.record_id &&
      envelope.record_root === reference.record_root &&
      Number.isSafeInteger(envelope.record_revision) &&
      envelope.record_revision >= 0 &&
      (!immutable ||
        (envelope.record_revision === 0 &&
          envelope.record_status === "ACCEPTED")),
    "ERR_PREDECESSOR",
    `${label} did not resolve to its exact accepted record`,
  );
  if (!immutable) {
    invariant(
      envelope.record?.record_revision === envelope.record_revision &&
        envelope.record?.record_root === envelope.record_root,
      "ERR_PREDECESSOR",
      `${label} did not resolve to its current revision`,
    );
  }
  bindAcceptedApplicationState(
    context,
    envelope.accepted_application_state_root,
    envelope.accepted_logical_tick,
  );
  return envelope;
}

function donationConsentMatches(offer, consentEnvelope) {
  if (!consentEnvelope) return false;
  const consent = consentEnvelope.record;
  try {
    validateConsentRecordSchema(consent);
  } catch {
    return false;
  }
  const body = consent.signed_body;
  if (
    offer.owner_consent_id !== consentEnvelope.record_id ||
    offer.owner_consent_root !== consentEnvelope.record_root ||
    consent.consent_id !== consentEnvelope.record_id ||
    donatedCapacityConsentRecordRoot(consent) !==
      consentEnvelope.record_root ||
    consent.signed_body_root !== donatedCapacityConsentBodyRoot(body) ||
    consent.principal_id !== offer.principal_id ||
    body.principal_id !== offer.principal_id ||
    consent.controller_id !== offer.authentication.controller_id ||
    body.controller_id !== offer.authentication.controller_id ||
    body.offer_terms_root !== capabilityOfferTermsRoot(offer) ||
    body.not_before_tick !== offer.not_before_tick ||
    body.expiry_tick !== offer.expiry_tick
  ) {
    return false;
  }
  return true;
}

export function evaluateOfferEligibility(input) {
  assertExactKeys(
    input,
    [
      "resolver",
      "evaluationKind",
      "capabilityOfferRef",
      "donatedCapacityConsentRef",
      "jobRef",
      "jobContractRef",
      "conflictPolicyRef",
      "taskRef",
      "bidRef",
      "probe",
    ],
    [],
    "offer eligibility input",
  );
  const {
    resolver,
    evaluationKind,
    capabilityOfferRef,
    donatedCapacityConsentRef,
    jobRef,
    jobContractRef,
    conflictPolicyRef,
    taskRef,
    bidRef,
    probe,
  } = input;
  invariant(
    evaluationKind === "BID" || evaluationKind === "TASK",
    "ERR_SCHEMA",
    "evaluationKind must be BID or TASK",
  );
  invariant(
    (evaluationKind === "BID" && bidRef !== null && taskRef === null) ||
      (evaluationKind === "TASK" && taskRef !== null && bidRef === null),
    "ERR_SCHEMA",
    "BID and TASK eligibility references are mutually exclusive",
  );
  const acceptedContext = {
    resolver,
    accepted_application_state_root: null,
    accepted_logical_tick: null,
  };
  const offerEnvelope = resolveAcceptedEnvelope(
    acceptedContext,
    capabilityOfferRef,
    "CAPABILITY_OFFER",
    "capabilityOfferRef",
  );
  const offer = offerEnvelope.record;
  const consentEnvelope =
    donatedCapacityConsentRef === null
      ? null
      : resolveAcceptedEnvelope(
          acceptedContext,
          donatedCapacityConsentRef,
          "DONATED_CAPACITY_CONSENT",
          "donatedCapacityConsentRef",
        );
  const jobEnvelope = resolveAcceptedEnvelope(
    acceptedContext,
    jobRef,
    "JOB",
    "jobRef",
    { immutable: false },
  );
  const contractEnvelope = resolveAcceptedEnvelope(
    acceptedContext,
    jobContractRef,
    "JOB_CONTRACT",
    "jobContractRef",
  );
  const conflictEnvelope = resolveAcceptedEnvelope(
    acceptedContext,
    conflictPolicyRef,
    "CONFLICT_POLICY",
    "conflictPolicyRef",
  );
  const taskEnvelope =
    evaluationKind === "TASK"
      ? resolveAcceptedEnvelope(
          acceptedContext,
          taskRef,
          "TASK",
          "taskRef",
          { immutable: false },
        )
      : null;
  const bidEnvelope =
    evaluationKind === "BID"
      ? resolveAcceptedEnvelope(
          acceptedContext,
          bidRef,
          "BID",
          "bidRef",
          { immutable: false },
        )
      : null;
  validateOfferSchema(offer, { requireAuthentication: true });
  validateProbeSchema(probe);
  assertCanonicalValue(offer);
  assertCanonicalValue(probe);
  const job = jobEnvelope.record;
  const contract = contractEnvelope.record;
  const conflictPolicy = conflictEnvelope.record;
  const task = taskEnvelope?.record ?? null;
  const bidRecord = bidEnvelope?.record ?? null;
  const bid = bidRecord?.reveal ?? null;
  const tick = acceptedContext.accepted_logical_tick;

  const reasons = [];
  const offerId = derivedCarrierId("CAPABILITY_OFFER", offer);
  const offerRoot = capabilityOfferRoot(offer);
  const offerBindingRoot = capabilityOfferBindingRoot(offer);
  const computedDraftContractRoot = draftContractRoot({
    ...contract,
    award: null,
  });
  const conflicts = new Set(
    sortedUniqueStrings(
      conflictPolicy.principal_ids,
      "conflictPolicy.principal_ids",
    ),
  );

  if (
    offer.offer_id !== offerId ||
    offerEnvelope.record_id !== offerId ||
    offerEnvelope.record_root !== offerRoot
  ) {
    reasons.push("ERR_AUTHORITY");
  }

  for (const field of [
    "not_before_tick",
    "expiry_tick",
    "max_input_bytes",
    "max_output_bytes",
    "max_compute_units",
    "max_active_leases",
  ]) {
    assertSafeNonNegative(offer[field], `offer.${field}`);
  }
  if (
    offer.not_before_tick >= offer.expiry_tick ||
    tick < offer.not_before_tick ||
    tick >= offer.expiry_tick
  ) {
    reasons.push("ERR_TICK");
  }

  let computedProbeRoot = null;
  try {
    computedProbeRoot = capabilityProbeRoot(probe);
  } catch {
    reasons.push("ERR_CAPABILITY");
  }
  if (
    computedProbeRoot === null ||
    offer.probe_root !== computedProbeRoot ||
    probe.status !== "PASS" ||
    probe.offer_binding_root !== offerBindingRoot ||
    probe.worker_seat_id !== offer.worker_seat_id ||
    !Number.isSafeInteger(probe.observed_tick) ||
    !Number.isSafeInteger(probe.expiry_tick) ||
    probe.observed_tick > tick ||
    tick >= probe.expiry_tick
  ) {
    reasons.push("ERR_CAPABILITY");
  }
  if (probe.policy_root !== contract.policy_root) {
    reasons.push("ERR_POLICY_ROOT");
  }

  const ceiling = contract.authority_ceiling;
  invariant(
    ceiling && typeof ceiling === "object",
    "ERR_SCHEMA",
    "contract.authority_ceiling is required",
  );
  const work = contract.work;
  invariant(
    work && typeof work === "object",
    "ERR_SCHEMA",
    "contract.work is required",
  );
  const contractBindingValid =
    contract.job_id === job.job_id &&
    job.accepted_contract_root === contractEnvelope.record_root &&
    jobContractRef.record_id === `CONTRACT-${job.accepted_contract_root}` &&
    contract.conflict_policy_root === conflictEnvelope.record_root &&
    conflictPolicy.job_id === job.job_id &&
    conflictPolicy.source_policy_root === contract.policy_root &&
    conflictPolicyRef.record_id ===
      `CONFLICT-${contract.conflict_policy_root}` &&
    (task === null || task.job_id === job.job_id) &&
    (bid === null || bid.job_id === job.job_id) &&
    Number.isSafeInteger(contract.job_version) &&
    contract.job_version >= 0;
  if (!contractBindingValid) {
    reasons.push(
      evaluationKind === "TASK"
        ? "ERR_CONTRACT_AUTHORITY_CEILING"
        : "ERR_BID_CONTRACT_BINDING",
    );
  }

  const workerClass = offer.worker_class;
  const principalAllowlist = sortedUniqueStrings(
    ceiling.allowed_worker_principal_ids,
    "authority_ceiling.allowed_worker_principal_ids",
  );
  const principalAllowed =
    principalAllowlist.length === 0 ||
    principalAllowlist.includes(offer.principal_id);

  const subsetChecks = [
    principalAllowed,
    allowedScalar(
      workerClass,
      ceiling.allowed_worker_classes,
      "authority_ceiling.allowed_worker_classes",
    ),
    allowedScalar(
      offer.model_id,
      ceiling.allowed_model_ids,
      "authority_ceiling.allowed_model_ids",
    ),
    allowedScalar(
      offer.provider_family,
      ceiling.allowed_provider_families,
      "authority_ceiling.allowed_provider_families",
    ),
    allowedScalar(
      offer.operator_id,
      ceiling.allowed_operator_ids,
      "authority_ceiling.allowed_operator_ids",
    ),
    allowedScalar(
      offer.route,
      ceiling.allowed_routes,
      "authority_ceiling.allowed_routes",
    ),
    isSubset(
      offer.tools,
      ceiling.allowed_tools,
      "offer.tools",
      "authority_ceiling.allowed_tools",
    ),
    isSubset(
      offer.runtimes,
      ceiling.allowed_runtimes,
      "offer.runtimes",
      "authority_ceiling.allowed_runtimes",
    ),
    isSubset(
      offer.egress_allowlist,
      ceiling.egress_allowlist,
      "offer.egress_allowlist",
      "authority_ceiling.egress_allowlist",
    ),
  ];

  const maximumDataRank = DATA_CLASS_RANK[ceiling.maximum_data_class];
  const evaluatedDataClass =
    task?.data_class ?? contract.privacy.data_class;
  const taskDataRank = DATA_CLASS_RANK[evaluatedDataClass];
  invariant(
    maximumDataRank !== undefined && taskDataRank !== undefined,
    "ERR_SCHEMA",
    "unknown data class",
  );
  subsetChecks.push(
    taskDataRank <= maximumDataRank,
    sortedUniqueStrings(offer.data_classes, "offer.data_classes").includes(
      evaluatedDataClass,
    ),
    offer.project_allowlist.length === 0 ||
      sortedUniqueStrings(
        offer.project_allowlist,
        "offer.project_allowlist",
      ).includes(job.project_id),
    offer.job_allowlist.length === 0 ||
      sortedUniqueStrings(offer.job_allowlist, "offer.job_allowlist").includes(
        job.job_id,
      ),
    offer.max_compute_units <= work.max_compute_units,
    task === null || task.max_compute_units <= offer.max_compute_units,
    task === null || task.max_input_bytes <= offer.max_input_bytes,
    task === null || task.max_output_bytes <= offer.max_output_bytes,
    offer.max_active_leases > 0,
    ceiling.required_isolation_root === null ||
      offer.isolation_root === ceiling.required_isolation_root,
    ceiling.trusted_worker_policy_root === null ||
      offer.trusted_worker_policy_root ===
        ceiling.trusted_worker_policy_root,
  );

  const requiredCapabilities = sortedUniqueStrings(
    task?.required_capabilities ?? [],
    "task.required_capabilities",
  );
  const offeredCapabilities = new Set(
    sortedUniqueStrings(probe.capabilities, "probe.capabilities"),
  );
  subsetChecks.push(
    requiredCapabilities.every((capability) =>
      offeredCapabilities.has(capability),
    ),
  );

  if (
    ceiling.maximum_capability_root !== null &&
    probe.capability_root !== ceiling.maximum_capability_root
  ) {
    subsetChecks.push(false);
  }
  if (subsetChecks.some((passed) => !passed)) {
    reasons.push("ERR_CONTRACT_AUTHORITY_CEILING");
  }

  const allowedRoutes = sortedUniqueStrings(
    ceiling.allowed_routes,
    "authority_ceiling.allowed_routes",
  );
  if (
    contract.privacy.remote_execution === false &&
    offer.route !== "LOCAL"
  ) {
    reasons.push("ERR_REMOTE_EXECUTION_FORBIDDEN");
  }
  if (evaluatedDataClass === "SECRET" && offer.route !== "LOCAL") {
    reasons.push("ERR_SECRET_REMOTE");
  }
  if (evaluatedDataClass === "PROPRIETARY" && offer.route !== "LOCAL") {
    reasons.push("ERR_PROPRIETARY_LOCAL_ONLY");
  }

  if (conflicts.has(offer.principal_id)) {
    reasons.push("ERR_BID_INELIGIBLE");
  }

  if (bid !== null) {
    invariant(
      bidRecord.status === "ACCEPTED" &&
        bidRecord.bid_id === bidEnvelope.record_id,
      "ERR_PREDECESSOR",
      "bid must be the current accepted bid record",
    );
    for (const field of ["price", "completion_ticks"]) {
      assertSafeNonNegative(bid[field], `bid.${field}`);
    }
    if (
      bid.worker_seat_id !== offer.worker_seat_id ||
      bid.bidder_principal_id !== offer.principal_id ||
      bid.capability_offer_root !== offerRoot ||
      bid.model_id !== offer.model_id ||
      bid.provider_family !== offer.provider_family ||
      bid.operator_id !== offer.operator_id ||
      bid.probe_root !== offer.probe_root ||
      bid.job_id !== job.job_id ||
      bid.job_version !== contract.job_version ||
      bid.draft_contract_root !== computedDraftContractRoot
    ) {
      reasons.push("ERR_BID_CONTRACT_BINDING");
    }
    const completionTick = tick + bid.completion_ticks;
    if (
      !Number.isSafeInteger(completionTick) ||
      bid.price > work.budget ||
      bid.price > contract.settlement.lead_worker_amount_ceiling ||
      completionTick > work.deadline_tick
    ) {
      reasons.push("ERR_BID_INELIGIBLE");
    }
  }

  if (offer.offer_mode === "DONATED_CAPACITY") {
    if (
      (bid !== null && bid.price !== 0) ||
      !donationConsentMatches(offer, consentEnvelope) ||
      !sortedUniqueStrings(
        offer.contribution_terms_allowlist,
        "offer.contribution_terms_allowlist",
      ).includes(contract.rights.contribution_terms_root)
    ) {
      reasons.push("ERR_BID_INELIGIBLE");
    }
  } else if (
    offer.offer_mode === "PAID" &&
    (offer.owner_consent_id !== null ||
      offer.owner_consent_root !== null ||
      consentEnvelope !== null)
  ) {
    reasons.push("ERR_BID_INELIGIBLE");
  } else if (offer.offer_mode !== "PAID") {
    reasons.push("ERR_CAPABILITY");
  }

  const reasonCodes = orderedReasons(reasons);
  return Object.freeze({
    eligible: reasonCodes.length === 0,
    reason_codes: Object.freeze(reasonCodes),
    capability_offer_id: offerId,
    capability_offer_root: offerRoot,
    worker_seat_id: offer.worker_seat_id,
    principal_id: offer.principal_id,
    worker_class: offer.worker_class,
    model_id: offer.model_id,
    provider_family: offer.provider_family,
    operator_id: offer.operator_id,
    route: offer.route,
    offer_mode: offer.offer_mode,
    probe_root: computedProbeRoot,
    offer_binding_root: offerBindingRoot,
    not_before_tick: offer.not_before_tick,
    expiry_tick: offer.expiry_tick,
    accepted_application_state_root:
      acceptedContext.accepted_application_state_root,
    accepted_logical_tick: acceptedContext.accepted_logical_tick,
  });
}
