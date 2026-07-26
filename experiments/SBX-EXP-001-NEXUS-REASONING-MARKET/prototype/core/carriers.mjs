import { invariant } from "./errors.mjs";
import { hash, rootId } from "./hash.mjs";
import {
  assertBoundedString,
  assertCanonicalToken,
  assertExactObjectKeys,
  assertHexRoot,
  assertSafeNonNegativeInteger,
} from "./schema.mjs";

const CARRIER_IDENTITIES = Object.freeze({
  CAPABILITY_OFFER: ["OFFER", "NEXUS_CAPABILITY_OFFER_ID_V1", "offer_id"],
  DONATED_CAPACITY_CONSENT: ["DONATIONCONSENT", "NEXUS_DONATED_CAPACITY_CONSENT_ID_V1", "consent_id"],
  DISCLOSURE_POLICY: ["DISCLOSUREPOLICY", "NEXUS_DISCLOSURE_POLICY_CARRIER_ID_V1", "disclosure_policy_id"],
  DISCLOSURE_PROOF_CONTEXT: ["DISCLOSUREPROOF", "NEXUS_DISCLOSURE_PROOF_CONTEXT_CARRIER_ID_V1", "disclosure_proof_context_id"],
  ENTROPY_ONE_USE_CONSUMPTION: ["ENTROPYUSE", "NEXUS_ENTROPY_ONE_USE_CONSUMPTION_ID_V1", "consumption_id"],
  DISCLOSURE_PREPARATION: ["PREPARATION", "NEXUS_ACCEPTED_DISCLOSURE_PREPARATION_ID_V1", "preparation_id"],
  DISCLOSURE_PREPARATION_EXECUTION_RECEIPT: ["PREPEXEC", "NEXUS_DISCLOSURE_PREPARATION_EXECUTION_RECEIPT_ID_V1", "preparation_execution_receipt_id"],
  DISCLOSURE_SCAN_RECEIPT: ["DISCLOSURESCAN", "NEXUS_DISCLOSURE_SCAN_RECEIPT_ID_V1", "scan_receipt_id"],
  DISCLOSURE_APPROVAL_RECEIPT: ["DISCLOSUREAPPROVAL", "NEXUS_DISCLOSURE_APPROVAL_RECEIPT_ID_V1", "approval_receipt_id"],
  DATA_ROUTE_AUTHORITY: ["DATAROUTE", "NEXUS_DATA_ROUTE_AUTHORITY_ID_V1", "route_authority_id"],
  TOOL_ROUTE_AUTHORITY: ["TOOLROUTE", "NEXUS_TOOL_ROUTE_AUTHORITY_ID_V1", "tool_route_authority_id"],
  REDACTION_MANIFEST: ["REDACTIONMANIFEST", "NEXUS_REDACTION_MANIFEST_ID_V1", "redaction_manifest_id"],
  REDACTION_APPROVAL: ["REDACTIONAPPROVAL", "NEXUS_REDACTION_APPROVAL_ID_V1", "redaction_approval_id"],
  DISCLOSURE_MANIFEST: ["DISCLOSUREMANIFEST", "NEXUS_DISCLOSURE_MANIFEST_ID_V1", "disclosure_manifest_id"],
  DISCLOSURE_COMPILATION_ANCHOR: ["DISCLOSURECOMP", "NEXUS_DISCLOSURE_COMPILATION_ANCHOR_ID_V1", "anchor_id"],
  PUBLIC_CAPSULE: ["PUBLICCAPSULE", "NEXUS_PUBLIC_CAPSULE_ID_V1", "public_capsule_id"],
  NON_CLAIMS: ["NONCLAIMS", "NEXUS_NON_CLAIMS_ID_V1", "non_claims_id"],
  PUBLICATION_ANCHOR: ["PUBLICATION", "NEXUS_PUBLICATION_ANCHOR_ID_V1", "publication_anchor_id"],
});

function identityProjection(recordType, body) {
  const identity = CARRIER_IDENTITIES[recordType];
  invariant(identity, "ERR_SCHEMA", `unregistered carrier type ${recordType}`);
  const output = Object.create(null);
  for (const key of Object.keys(body).sort()) {
    if (key === identity[2] || key === "authentication") continue;
    if (
      recordType === "DISCLOSURE_PREPARATION" &&
      [
        "execution_receipt_id",
        "execution_receipt_root",
        "status",
      ].includes(key)
    ) {
      continue;
    }
    output[key] = body[key];
  }
  return output;
}

export function derivedCarrierId(recordType, body) {
  const [prefix, domain] = CARRIER_IDENTITIES[recordType] ?? [];
  invariant(prefix && domain, "ERR_SCHEMA", `unregistered carrier type ${recordType}`);
  return rootId(prefix, domain, identityProjection(recordType, body));
}

export function assertDerivedCarrierId(recordType, body) {
  const idField = CARRIER_IDENTITIES[recordType]?.[2];
  invariant(
    idField && body[idField] === derivedCarrierId(recordType, body),
    "ERR_ID_PREIMAGE",
    `${recordType} carrier ID is not its registered full-digest identity`,
  );
  return body[idField];
}

const CAPABILITY_OFFER_CONTENT_KEYS = Object.freeze([
  "schema", "principal_id", "worker_seat_id", "offer_mode", "worker_class",
  "owner_consent_id", "owner_consent_root", "project_allowlist", "job_allowlist",
  "model_id", "provider_family", "operator_id", "route", "data_classes", "tools",
  "runtimes", "egress_allowlist", "max_input_bytes", "max_output_bytes",
  "max_compute_units", "max_active_leases", "isolation_root",
  "trusted_worker_policy_root", "maximum_capability_root",
  "contribution_terms_allowlist", "attribution", "probe_root", "not_before_tick",
  "expiry_tick", "nonce",
]);

export function capabilityOfferProjection(record) {
  assertExactObjectKeys(
    record,
    CAPABILITY_OFFER_CONTENT_KEYS,
    ["authentication", "offer_id"],
    "capability offer",
  );
  invariant(
    record.schema === "nexus-capability-offer-v1",
    "ERR_SCHEMA",
    "unsupported capability offer",
  );
  const projection = Object.create(null);
  for (const key of CAPABILITY_OFFER_CONTENT_KEYS) projection[key] = record[key];
  return projection;
}

export function capabilityOfferRoot(record) {
  const projection = capabilityOfferProjection(record);
  invariant(
    derivedCarrierId("CAPABILITY_OFFER", projection) ===
      (record.offer_id ?? derivedCarrierId("CAPABILITY_OFFER", projection)),
    "ERR_ID_PREIMAGE",
    "capability offer ID preimage is invalid",
  );
  return hash("NEXUS_CAPABILITY_OFFER_V1", projection);
}

export function capabilityOfferTermsRoot(record) {
  const projection = capabilityOfferProjection(record);
  const {
    owner_consent_id: ignoredId,
    owner_consent_root: ignoredRoot,
    probe_root: ignoredProbeRoot,
    ...terms
  } = projection;
  return hash("NEXUS_CAPABILITY_OFFER_TERMS_V1", terms);
}

export function donatedCapacityConsentBodyRoot(body) {
  assertExactObjectKeys(
    body,
    [
      "consent_nonce",
      "controller_id",
      "expiry_tick",
      "not_before_tick",
      "offer_terms_root",
      "principal_id",
      "schema",
    ],
    [],
    "donated-capacity consent signed body",
  );
  invariant(
    body.schema === "nexus-donated-capacity-consent-body-v1",
    "ERR_SCHEMA",
    "unsupported donated-capacity consent body",
  );
  assertHexRoot(body.offer_terms_root, "donated-capacity offer terms root");
  assertSafeNonNegativeInteger(body.not_before_tick, "consent not-before tick");
  assertSafeNonNegativeInteger(body.expiry_tick, "consent expiry tick");
  invariant(body.not_before_tick < body.expiry_tick, "ERR_SCHEMA", "consent window is empty");
  return hash("NEXUS_DONATED_CAPACITY_CONSENT_BODY_V1", body);
}

export function donatedCapacityConsentRecordRoot(record) {
  assertExactObjectKeys(
    record,
    [
      "authentication",
      "consent_id",
      "controller_id",
      "principal_id",
      "schema",
      "signed_body",
      "signed_body_root",
      "status",
    ],
    [],
    "accepted donated-capacity consent",
  );
  invariant(
    record.schema === "nexus-accepted-donated-capacity-consent-v1" &&
      record.status === "ACCEPTED" &&
      donatedCapacityConsentBodyRoot(record.signed_body) ===
        record.signed_body_root &&
      record.principal_id === record.signed_body.principal_id &&
      record.controller_id === record.signed_body.controller_id,
    "ERR_AUTHORITY",
    "donated-capacity consent content is invalid",
  );
  assertDerivedCarrierId("DONATED_CAPACITY_CONSENT", record);
  const { authentication: ignored, ...projection } = record;
  return hash("NEXUS_ACCEPTED_DONATED_CAPACITY_CONSENT_V1", projection);
}

function assertRoots(body, nullableRootFields = []) {
  const nullable = new Set(nullableRootFields);
  for (const [field, value] of Object.entries(body)) {
    if (!field.endsWith("_root")) continue;
    if (value === null && nullable.has(field)) continue;
    assertHexRoot(value, field);
  }
}

function assertId(body, field) {
  assertCanonicalToken(body[field], field, 256);
}

function exactCarrier(body, {
  schema,
  keys,
  idField,
  label,
  nullableRootFields = [],
}) {
  assertExactObjectKeys(body, keys, [], label);
  invariant(body.schema === schema, "ERR_SCHEMA", `unsupported ${label} schema`);
  assertId(body, idField);
  assertRoots(body, nullableRootFields);
  return body;
}

export function disclosurePreparationRoot({
  jobId,
  contractRoot,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
  disclosurePolicyRoot,
}) {
  return hash("NEXUS_DISCLOSURE_PREPARATION_V1", {
    schema: "nexus-disclosure-preparation-v1",
    job_id: jobId,
    contract_root: contractRoot,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    disclosure_policy_root: disclosurePolicyRoot,
  });
}

export function disclosureScannerAuthorityRoot({
  jobId,
  contractRoot,
  secretScanPolicyRoot,
  publicationPrincipalIds,
}) {
  return hash("NEXUS_DISCLOSURE_SCANNER_AUTHORITY_V1", {
    schema: "nexus-disclosure-scanner-authority-v1",
    job_id: jobId,
    contract_root: contractRoot,
    secret_scan_policy_root: secretScanPolicyRoot,
    publication_principal_ids: [...publicationPrincipalIds].sort(),
  });
}

export function redactionApprovalAuthorityRoot({
  jobId,
  contractRoot,
  publicationPrincipalIds,
}) {
  return hash("NEXUS_REDACTION_APPROVAL_AUTHORITY_V1", {
    schema: "nexus-redaction-approval-authority-v1",
    job_id: jobId,
    contract_root: contractRoot,
    publication_principal_ids: [...publicationPrincipalIds].sort(),
  });
}

export function contractRouteContextRoot(contract) {
  return hash("NEXUS_CONTRACT_ROUTE_CONTEXT_V2", {
    authority_ceiling: contract.authority_ceiling,
    contract_root: hash("NEXUS_CONTRACT_V1", contract),
    policy_root: contract.policy_root,
    privacy: contract.privacy,
  });
}

export function remoteRedactionPolicyRoot(contract) {
  return hash("NEXUS_REMOTE_REDACTION_POLICY_V1", {
    schema: "nexus-remote-redaction-policy-v1",
    contract_root: hash("NEXUS_CONTRACT_V1", contract),
    data_class: contract.privacy.data_class,
    remote_execution: contract.privacy.remote_execution,
  });
}

export function disclosureCompilationV2Root({
  preparationRoot,
  scanReceiptRoot,
  approvalReceiptRoot,
  manifestRoot,
  exportAuthorityRoot,
}) {
  return hash("NEXUS_DISCLOSURE_COMPILATION_V2", {
    schema: "nexus-disclosure-compilation-v2",
    preparation_root: preparationRoot,
    scan_receipt_root: scanReceiptRoot,
    approval_receipt_root: approvalReceiptRoot,
    manifest_root: manifestRoot,
    export_authority_root: exportAuthorityRoot,
  });
}

export function disclosureScanReceiptRoot(body) {
  exactCarrier(body, {
    schema: "nexus-disclosure-scan-receipt-v1",
    keys: [
      "schema",
      "scan_receipt_id",
      "job_id",
      "contract_root",
      "preparation_id",
      "preparation_record_root",
      "preparation_root",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "secret_scan_policy_root",
      "scanner_authority_root",
      "scanner_principal_id",
      "scanner_controller_id",
      "preparation_execution_receipt_id",
      "preparation_execution_receipt_root",
      "result",
    ],
    idField: "scan_receipt_id",
    label: "disclosure scan receipt",
  });
  invariant(body.result === "PASS", "ERR_DISCLOSURE_UNCLASSIFIED", "scan must pass");
  return hash("NEXUS_DISCLOSURE_SCAN_RECEIPT_V1", body);
}

export function disclosurePreparationExecutionReceiptRoot(body) {
  exactCarrier(body, {
    schema: "nexus-disclosure-preparation-execution-receipt-v1",
    keys: [
      "schema",
      "preparation_execution_receipt_id",
      "preparation_id",
      "preparation_root",
      "preparation_authority_id",
      "preparation_authority_root",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "verifier_authority_root",
      "verifier_principal_id",
      "verifier_controller_id",
      "execution_evidence_root",
      "result",
    ],
    idField: "preparation_execution_receipt_id",
    label: "disclosure preparation execution receipt",
  });
  invariant(body.result === "PASS", "ERR_DISCLOSURE_UNCLASSIFIED", "preparation execution must pass");
  assertDerivedCarrierId("DISCLOSURE_PREPARATION_EXECUTION_RECEIPT", body);
  return hash("NEXUS_DISCLOSURE_PREPARATION_EXECUTION_RECEIPT_V1", body);
}

export function acceptedDisclosurePreparationRoot(record) {
  assertExactObjectKeys(
    record,
    [
      "content_proof_descriptors_root",
      "content_public_values_root",
      "execution_receipt_id",
      "execution_receipt_root",
      "preparation_authority_id",
      "preparation_authority_root",
      "preparation_id",
      "preparation_root",
      "schema",
      "status",
      "verifier_authority_root",
    ],
    [],
    "accepted disclosure preparation",
  );
  invariant(
    record.schema === "nexus-accepted-disclosure-preparation-v1" &&
      record.status === "ACCEPTED",
    "ERR_SCHEMA",
    "unsupported accepted disclosure preparation",
  );
  assertDerivedCarrierId("DISCLOSURE_PREPARATION", record);
  return hash("NEXUS_ACCEPTED_DISCLOSURE_PREPARATION_V1", record);
}

export function disclosureApprovalReceiptRoot(body) {
  exactCarrier(body, {
    schema: "nexus-disclosure-approval-receipt-v1",
    keys: [
      "schema",
      "approval_receipt_id",
      "job_id",
      "contract_root",
      "preparation_root",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "scan_receipt_id",
      "scan_receipt_root",
      "approval_policy_root",
      "approval_authority_root",
      "approval_signature_root",
      "decision",
    ],
    idField: "approval_receipt_id",
    label: "disclosure approval receipt",
  });
  invariant(
    body.decision === "APPROVED",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "disclosure approval must be APPROVED",
  );
  return hash("NEXUS_DISCLOSURE_APPROVAL_RECEIPT_V1", body);
}

export function disclosureCompilationAnchorV2Root(body) {
  exactCarrier(body, {
    schema: "nexus-accepted-disclosure-compilation-anchor-v2",
    keys: [
      "schema",
      "anchor_id",
      "preparation_id",
      "preparation_record_root",
      "preparation_root",
      "scan_receipt_id",
      "scan_receipt_root",
      "approval_receipt_id",
      "approval_receipt_root",
      "disclosure_manifest_id",
      "disclosure_manifest_root",
      "compilation_root",
      "export_authority_id",
      "export_authority_root",
      "disclosure_policy_root",
      "disclosure_proof_context_root",
    ],
    idField: "anchor_id",
    label: "accepted disclosure compilation anchor v2",
  });
  return hash("NEXUS_ACCEPTED_DISCLOSURE_COMPILATION_ANCHOR_V2", body);
}

export function publicSafeDisclosureManifestRoot(body) {
  exactCarrier(body, {
    schema: "nexus-public-safe-disclosure-manifest-v1",
    keys: [
      "schema",
      "disclosure_manifest_id",
      "job_id",
      "preparation_id",
      "preparation_record_root",
      "preparation_root",
      "disclosure_policy_root",
      "disclosure_proof_context_root",
      "content_public_values",
      "content_public_values_root",
      "content_proof_descriptors",
      "content_proof_descriptors_root",
      "scan_receipt_id",
      "scan_receipt_root",
      "approval_receipt_id",
      "approval_receipt_root",
    ],
    idField: "disclosure_manifest_id",
    label: "public-safe disclosure manifest",
  });
  invariant(
    Object.keys(body.content_public_values).length > 0 &&
      Array.isArray(body.content_proof_descriptors) &&
      body.content_proof_descriptors.length > 0,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "public-safe manifest content must be nonempty",
  );
  assertDerivedCarrierId("DISCLOSURE_MANIFEST", body);
  return hash("NEXUS_PUBLIC_SAFE_DISCLOSURE_MANIFEST_V1", body);
}

export function publicCapsuleRoot(body) {
  exactCarrier(body, {
    schema: "nexus-public-capsule-v1",
    keys: [
      "schema",
      "public_capsule_id",
      "job_id",
      "accepted_compilation_anchor_id",
      "accepted_compilation_anchor_root",
      "compilation_root",
      "disclosure_manifest_id",
      "disclosure_manifest_root",
      "capsule_content_root",
    ],
    idField: "public_capsule_id",
    label: "public capsule",
  });
  assertDerivedCarrierId("PUBLIC_CAPSULE", body);
  return hash("NEXUS_PUBLIC_CAPSULE_V1", body);
}

export function nonClaimsRoot(body) {
  exactCarrier(body, {
    schema: "nexus-non-claims-v1",
    keys: [
      "schema",
      "non_claims_id",
      "job_id",
      "accepted_compilation_anchor_id",
      "accepted_compilation_anchor_root",
      "compilation_root",
      "statements",
    ],
    idField: "non_claims_id",
    label: "non-claims",
  });
  invariant(
    Array.isArray(body.statements) &&
      body.statements.length > 0 &&
      body.statements.every((item) => typeof item === "string" && item.length > 0) &&
      body.statements.every((item, index) => index === 0 || body.statements[index - 1] < item),
    "ERR_NON_CANONICAL",
    "non-claims statements must be nonempty, sorted, and unique",
  );
  assertDerivedCarrierId("NON_CLAIMS", body);
  return hash("NEXUS_NON_CLAIMS_V1", body);
}

export function dataRouteAuthorityRoot(body) {
  exactCarrier(body, {
    schema: "nexus-data-route-authority-v2",
    keys: [
      "schema",
      "route_authority_id",
      "contract_root",
      "contract_route_context_root",
      "redaction_approval_authority_root",
      "redaction_policy_root",
      "remote_redaction_policy_root",
      "route_policy_root",
    ],
    idField: "route_authority_id",
    label: "data route authority",
    nullableRootFields: ["remote_redaction_policy_root"],
  });
  return hash("NEXUS_DATA_ROUTE_AUTHORITY_V2", body);
}

export function toolRouteAuthorityRoot(body) {
  exactCarrier(body, {
    schema: "nexus-tool-route-authority-v1",
    keys: [
      "schema",
      "tool_route_authority_id",
      "job_id",
      "task_id",
      "tool_name",
      "selected_route",
      "authorized_route",
      "data_class",
      "contract_root",
      "route_policy_root",
    ],
    idField: "tool_route_authority_id",
    label: "tool route authority",
  });
  for (const field of [
    "job_id",
    "task_id",
    "tool_name",
    "selected_route",
    "authorized_route",
    "data_class",
  ]) {
    assertBoundedString(body[field], field);
  }
  return hash("NEXUS_TOOL_ROUTE_AUTHORITY_V1", body);
}

export function redactionManifestV2Root(body) {
  exactCarrier(body, {
    schema: "nexus-redaction-manifest-v2",
    keys: [
      "schema",
      "redaction_manifest_id",
      "job_id",
      "task_id",
      "source_root",
      "reduced_root",
      "context_root",
      "transformation_root",
      "redaction_policy_root",
      "remote_policy_root",
      "route_policy_root",
    ],
    idField: "redaction_manifest_id",
    label: "redaction manifest",
    nullableRootFields: ["remote_policy_root"],
  });
  assertBoundedString(body.job_id, "redaction manifest job ID");
  assertBoundedString(body.task_id, "redaction manifest task ID");
  return hash("NEXUS_REDACTION_MANIFEST_V2", body);
}

export function redactionApprovalV2Root(body) {
  exactCarrier(body, {
    schema: "nexus-redaction-approval-v2",
    keys: [
      "schema",
      "redaction_approval_id",
      "job_id",
      "task_id",
      "redaction_manifest_id",
      "redaction_manifest_root",
      "approved_reduced_root",
      "redaction_policy_root",
      "remote_policy_root",
      "route_policy_root",
      "approval_authority_root",
      "approval_signature_root",
      "decision",
    ],
    idField: "redaction_approval_id",
    label: "redaction approval",
    nullableRootFields: ["remote_policy_root"],
  });
  invariant(
    body.decision === "APPROVED",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "redaction approval must be APPROVED",
  );
  return hash("NEXUS_REDACTION_APPROVAL_V2", body);
}

export function publicationAnchorV2Root(body) {
  exactCarrier(body, {
    schema: "nexus-accepted-publication-anchor-v2",
    keys: [
      "schema",
      "publication_anchor_id",
      "publication_intent_id",
      "publication_intent_root",
      "public_capsule_id",
      "public_capsule_root",
      "non_claims_id",
      "disclosure_manifest_root",
      "non_claims_root",
      "disclosure_manifest_id",
      "accepted_compilation_anchor_id",
      "accepted_compilation_anchor_root",
      "compilation_root",
      "export_authority_id",
      "export_authority_root",
      "nonce_consumption_id",
      "nonce_consumption_root",
      "policy_root",
      "verifier_root",
      "source_document_root",
      "terminal_receipt_id",
      "logical_tick",
      "idempotency_key",
    ],
    idField: "publication_anchor_id",
    label: "accepted publication anchor v2",
  });
  assertBoundedString(body.publication_intent_id, "publication intent ID");
  assertBoundedString(body.terminal_receipt_id, "terminal receipt ID");
  assertCanonicalToken(body.idempotency_key, "publication idempotency key");
  assertSafeNonNegativeInteger(body.logical_tick, "publication logical tick");
  return hash("NEXUS_ACCEPTED_PUBLICATION_ANCHOR_V2", body);
}
