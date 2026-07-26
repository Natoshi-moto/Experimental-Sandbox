import { canonicalize, assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import { hash } from "../core/hash.mjs";
import { resolveAcceptedRecord } from "../core/resolver.mjs";

const ROOT = /^[a-f0-9]{64}$/;
const ID = /^[A-Z][A-Z0-9_]*-[a-f0-9]{64}$/;
const AUTHORITY_KEYS = Object.freeze([
  "entropy_evidence_root",
  "freshness_evidence_root",
  "minimum_entropy_bits",
  "nonce_commitment",
  "one_use_commitment",
  "purpose",
  "schema",
  "scope_root",
]);
const CLAIM_KEYS = Object.freeze([
  "authority_id",
  "authority_root",
  "nonce_commitment",
  "purpose",
  "schema",
  "scope_root",
  "use_scope_root",
]);
const CONSUMPTION_KEYS = Object.freeze([
  "authority_id",
  "authority_root",
  "consuming_event_id",
  "consumption_id",
  "nonce_commitment",
  "previous_application_state_root",
  "purpose",
  "schema",
  "scope_root",
  "use_claim_root",
  "use_scope_root",
]);
const ENVELOPE_KEYS = Object.freeze([
  "accepted_application_state_root",
  "accepted_logical_tick",
  "record",
  "record_id",
  "record_revision",
  "record_root",
  "record_status",
  "record_type",
  "schema",
]);
const PURPOSES = Object.freeze([
  "DISCLOSURE_PREPARATION",
  "DISCLOSURE_SALT",
  "PUBLICATION_INTENT",
]);

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function immutable(value) {
  return deepFreeze(JSON.parse(canonicalize(value)));
}

function exactKeys(value, expected, label) {
  invariant(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "ERR_SCHEMA",
    `${label} must be an object`,
  );
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length &&
      actual.every((key, index) => key === wanted[index]),
    "ERR_SCHEMA",
    `${label} has unexpected or missing fields`,
  );
}

function assertDeepFrozen(value, label) {
  invariant(
    value === null ||
      typeof value !== "object" ||
      (Object.isFrozen(value) &&
        Object.values(value).every((child) => {
          assertDeepFrozen(child, label);
          return true;
        })),
    "ERR_CAPABILITY",
    `${label} must be deeply frozen by the canonical core runtime`,
  );
}

export function assertRoot(value, label) {
  invariant(
    typeof value === "string" && ROOT.test(value),
    "ERR_SCHEMA",
    `${label} must be a lowercase SHA-256 root`,
  );
}

export function assertRecordId(value, label) {
  invariant(
    typeof value === "string" && ID.test(value),
    "ERR_SCHEMA",
    `${label} must be a normalized canonical record ID`,
  );
}

export function nonceOneUseCommitment({
  purpose,
  scope_root: scopeRoot,
  nonce_commitment: nonceCommitment,
}) {
  invariant(PURPOSES.includes(purpose), "ERR_SCHEMA", "unsupported nonce purpose");
  assertRoot(scopeRoot, "nonce scope root");
  assertRoot(nonceCommitment, "nonce commitment");
  return hash("NEXUS_NONCE_ONE_USE_V1", {
    nonce_commitment: nonceCommitment,
    purpose,
    scope_root: scopeRoot,
  });
}

export function entropyFreshnessAuthorityRoot(authority) {
  assertCanonicalValue(authority);
  exactKeys(authority, AUTHORITY_KEYS, "entropy/freshness authority");
  invariant(
    authority.schema === "nexus-entropy-freshness-authority-v1",
    "ERR_SCHEMA",
    "unsupported entropy/freshness authority schema",
  );
  invariant(
    PURPOSES.includes(authority.purpose),
    "ERR_SCHEMA",
    "unsupported entropy/freshness purpose",
  );
  invariant(
    authority.minimum_entropy_bits === 256,
    "ERR_SCHEMA",
    "entropy authority must attest exactly 256 minimum entropy bits",
  );
  for (const field of [
    "scope_root",
    "nonce_commitment",
    "entropy_evidence_root",
    "freshness_evidence_root",
    "one_use_commitment",
  ]) {
    assertRoot(authority[field], `entropy/freshness ${field}`);
  }
  invariant(
    authority.one_use_commitment === nonceOneUseCommitment(authority),
    "ERR_VERIFIER_MUTATION",
    "nonce one-use commitment mismatch",
  );
  return hash("NEXUS_ENTROPY_FRESHNESS_AUTHORITY_V1", authority);
}

export function entropyOneUseClaimRoot(claim) {
  assertCanonicalValue(claim);
  exactKeys(claim, CLAIM_KEYS, "entropy one-use claim");
  invariant(
    claim.schema === "nexus-entropy-one-use-claim-v1",
    "ERR_SCHEMA",
    "unsupported entropy one-use claim schema",
  );
  assertRecordId(claim.authority_id, "entropy authority ID");
  assertRoot(claim.authority_root, "entropy authority root");
  invariant(PURPOSES.includes(claim.purpose), "ERR_SCHEMA", "unsupported nonce purpose");
  for (const field of ["scope_root", "nonce_commitment", "use_scope_root"]) {
    assertRoot(claim[field], `entropy one-use claim ${field}`);
  }
  return hash("NEXUS_ENTROPY_ONE_USE_CLAIM_V1", claim);
}

export function entropyOneUseConsumptionRoot(consumption) {
  assertCanonicalValue(consumption);
  exactKeys(consumption, CONSUMPTION_KEYS, "entropy one-use consumption");
  invariant(
    consumption.schema === "nexus-entropy-one-use-consumption-v1",
    "ERR_SCHEMA",
    "unsupported entropy one-use consumption schema",
  );
  for (const field of ["authority_id", "consumption_id", "consuming_event_id"]) {
    assertRecordId(consumption[field], `entropy consumption ${field}`);
  }
  for (const field of [
    "authority_root",
    "scope_root",
    "nonce_commitment",
    "use_scope_root",
    "use_claim_root",
    "previous_application_state_root",
  ]) {
    assertRoot(consumption[field], `entropy consumption ${field}`);
  }
  invariant(
    PURPOSES.includes(consumption.purpose),
    "ERR_SCHEMA",
    "unsupported entropy consumption purpose",
  );
  const claim = {
    schema: "nexus-entropy-one-use-claim-v1",
    authority_id: consumption.authority_id,
    authority_root: consumption.authority_root,
    purpose: consumption.purpose,
    scope_root: consumption.scope_root,
    nonce_commitment: consumption.nonce_commitment,
    use_scope_root: consumption.use_scope_root,
  };
  invariant(
    entropyOneUseClaimRoot(claim) === consumption.use_claim_root,
    "ERR_VERIFIER_MUTATION",
    "entropy consumption does not bind its one-use claim",
  );
  return hash("NEXUS_ENTROPY_ONE_USE_CONSUMPTION_V1", consumption);
}

export function assertAcceptedCoreRecordEnvelope(
  envelope,
  {
    record_type: recordType,
    record_id: recordId,
    record_root: recordRoot,
    allowed_statuses: allowedStatuses = ["ACCEPTED"],
  },
) {
  assertRecordId(recordId, `${recordType} record ID`);
  assertRoot(recordRoot, `${recordType} record root`);
  invariant(
    Array.isArray(allowedStatuses) &&
      allowedStatuses.length > 0 &&
      allowedStatuses.every((status) => typeof status === "string"),
    "ERR_SCHEMA",
    "allowed resolver statuses must be a non-empty string array",
  );
  exactKeys(envelope, ENVELOPE_KEYS, "accepted record envelope");
  invariant(
    envelope.schema === "nexus-accepted-record-envelope-v2",
    "ERR_SCHEMA",
    "unsupported accepted record envelope schema",
  );
  invariant(
    envelope.record_type === recordType &&
      envelope.record_id === recordId &&
      envelope.record_root === recordRoot,
    "ERR_VERIFIER_MUTATION",
    "resolver returned a different accepted record",
  );
  assertRoot(
    envelope.accepted_application_state_root,
    "accepted application state root",
  );
  invariant(
    Number.isSafeInteger(envelope.accepted_logical_tick) &&
      envelope.accepted_logical_tick >= 0,
    "ERR_SCHEMA",
    "accepted logical tick must be a non-negative safe integer",
  );
  invariant(
    Number.isSafeInteger(envelope.record_revision) &&
      envelope.record_revision >= 0,
    "ERR_SCHEMA",
    "accepted record revision must be a non-negative safe integer",
  );
  invariant(
    allowedStatuses.includes(envelope.record_status),
    "ERR_REPLAY",
    `${recordType} has no accepted status for this operation`,
  );
  assertCanonicalValue(envelope.record);
  assertDeepFrozen(envelope, "accepted record envelope");
  return envelope;
}

export function resolveAcceptedCoreRecord(
  resolver,
  request,
) {
  const envelope = resolveAcceptedRecord(resolver, {
    record_type: request.record_type,
    record_id: request.record_id,
    record_root: request.record_root,
  });
  return assertAcceptedCoreRecordEnvelope(envelope, request);
}

export function verifyAcceptedEntropyUse(
  {
    authority_id: authorityId,
    authority_root: authorityRoot,
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
    nonce_commitment: nonceCommitment,
    purpose,
    scope_root: scopeRoot,
    use_scope_root: useScopeRoot,
  },
  { resolver },
) {
  assertCanonicalValue({
    authority_id: authorityId,
    authority_root: authorityRoot,
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
    nonce_commitment: nonceCommitment,
    purpose,
    scope_root: scopeRoot,
    use_scope_root: useScopeRoot,
  });
  const authorityEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "ENTROPY_FRESHNESS_AUTHORITY",
    record_id: authorityId,
    record_root: authorityRoot,
    allowed_statuses: ["CONSUMED"],
  });
  invariant(
    entropyFreshnessAuthorityRoot(authorityEnvelope.record) === authorityRoot,
    "ERR_VERIFIER_MUTATION",
    "resolved entropy authority content root mismatch",
  );
  invariant(
    authorityEnvelope.record.purpose === purpose &&
      authorityEnvelope.record.scope_root === scopeRoot &&
      authorityEnvelope.record.nonce_commitment === nonceCommitment,
    "ERR_VERIFIER_MUTATION",
    "resolved entropy authority is bound to another nonce scope",
  );

  const consumptionEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "ENTROPY_ONE_USE_CONSUMPTION",
    record_id: consumptionId,
    record_root: consumptionRoot,
    allowed_statuses: ["CONSUMED"],
  });
  invariant(
    entropyOneUseConsumptionRoot(consumptionEnvelope.record) === consumptionRoot,
    "ERR_VERIFIER_MUTATION",
    "resolved entropy consumption content root mismatch",
  );
  invariant(
    authorityEnvelope.accepted_application_state_root ===
      consumptionEnvelope.accepted_application_state_root &&
      authorityEnvelope.accepted_logical_tick ===
        consumptionEnvelope.accepted_logical_tick,
    "ERR_VERIFIER_MUTATION",
    "resolved entropy authority records do not share one accepted state and tick",
  );
  const consumption = consumptionEnvelope.record;
  invariant(
    consumption.consumption_id === consumptionId &&
      consumption.authority_id === authorityId &&
      consumption.authority_root === authorityRoot &&
      consumption.purpose === purpose &&
      consumption.scope_root === scopeRoot &&
      consumption.nonce_commitment === nonceCommitment &&
      consumption.use_scope_root === useScopeRoot,
    "ERR_REPLAY",
    "entropy authority consumption belongs to another use",
  );
  return immutable({
    authority_id: authorityId,
    authority_root: authorityRoot,
    authority_state_root: authorityEnvelope.accepted_application_state_root,
    consumption_id: consumptionId,
    consumption_root: consumptionRoot,
    consumption_state_root:
      consumptionEnvelope.accepted_application_state_root,
    use_claim_root: consumption.use_claim_root,
  });
}
