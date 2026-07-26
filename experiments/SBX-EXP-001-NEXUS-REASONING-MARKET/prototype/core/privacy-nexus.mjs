import { invariant } from "./errors.mjs";
import { hash, rootId } from "./hash.mjs";
import { assertCanonicalValue, canonicalize } from "./canonical.mjs";
import { derivedCarrierId } from "./carriers.mjs";
import {
  assertCanonicalToken,
  assertExactObjectKeys,
  assertHexNonce256,
  assertHexRoot,
  assertSafeNonNegativeInteger,
} from "./schema.mjs";

const ENTROPY_PURPOSES = new Set([
  "DISCLOSURE_PREPARATION",
  "DISCLOSURE_SALT",
  "PUBLICATION_INTENT",
]);
const PROOF_PRODUCERS = new Set([
  "OMISSION",
  "PLAIN_PUBLIC",
  "PUBLIC_PREIMAGE",
  "SALTED_COMMITMENT",
]);
const ZERO_ROOT = /^0{64}$/;
const DERIVED_PATHS = Object.freeze({
  human_publication_approval_root: "DERIVED_PUBLICATION_APPROVAL",
  public_job_id: "DERIVED_PUBLIC_JOB",
  secret_scan_evidence_root: "DERIVED_SECRET_SCAN",
});
const CONTENT_EXCLUDED_PATHS = new Set([
  "human_publication_approval_root",
  "secret_scan_evidence_root",
]);
export const PUBLIC_PREIMAGE_PRODUCERS = Object.freeze({
  "nexus-canonical-public-object-v1": "NEXUS_CANONICAL_PUBLIC_OBJECT_V1",
});

function assertNonzeroRoot(value, label) {
  assertHexRoot(value, label);
  invariant(!ZERO_ROOT.test(value), "ERR_SCHEMA", `${label} must be nonzero`);
}

function assertSortedUnique(items, key, label) {
  const values = items.map((item) => item[key]);
  invariant(
    values.every((value, index) => index === 0 || values[index - 1] < value),
    "ERR_SCHEMA",
    `${label} must be strictly sorted and unique`,
  );
}

function assertNullableToken(value, label) {
  if (value !== null) assertCanonicalToken(value, label, 256);
}

function assertNullableRoot(value, label) {
  if (value !== null) assertNonzeroRoot(value, label);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

export function disclosurePolicyRoot(policy) {
  assertExactObjectKeys(
    policy,
    ["fields", "schema"],
    [],
    "disclosure policy",
  );
  invariant(
    policy.schema === "nexus-disclosure-policy-v1" &&
      Array.isArray(policy.fields) &&
      policy.fields.length >= 4 &&
      policy.fields.length <= 256,
    "ERR_SCHEMA",
    "unsupported or empty disclosure policy",
  );
  const allowedClassifications = new Set([
    "COMMITMENT_ONLY",
    "OMITTED",
    "PUBLIC",
  ]);
  const allowedProofKinds = new Set([
    "DERIVED_PUBLICATION_APPROVAL",
    "DERIVED_PUBLIC_JOB",
    "DERIVED_SECRET_SCAN",
    "OMISSION",
    "PLAIN_PUBLIC",
    "PUBLIC_PREIMAGE",
    "SALTED_COMMITMENT",
  ]);
  const allowedValueKinds = new Set(["PLAIN", "ROOT"]);
  for (const field of policy.fields) {
    assertExactObjectKeys(
      field,
      ["classification", "path", "proof_kind", "value_kind"],
      [],
      "disclosure policy field",
    );
    assertCanonicalToken(field.path, "disclosure policy path", 256);
    invariant(
      /^[a-z][a-z0-9_.-]*$/.test(field.path) &&
        allowedClassifications.has(field.classification) &&
        allowedProofKinds.has(field.proof_kind) &&
        allowedValueKinds.has(field.value_kind),
      "ERR_SCHEMA",
      `invalid disclosure policy field ${field.path}`,
    );
  }
  assertSortedUnique(policy.fields, "path", "disclosure policy fields");
  const required = new Map([
    [
      "human_publication_approval_root",
      ["COMMITMENT_ONLY", "DERIVED_PUBLICATION_APPROVAL", "ROOT"],
    ],
    ["internal_job_id", ["OMITTED", "OMISSION", "PLAIN"]],
    ["public_job_id", ["PUBLIC", "DERIVED_PUBLIC_JOB", "PLAIN"]],
    [
      "secret_scan_evidence_root",
      ["COMMITMENT_ONLY", "DERIVED_SECRET_SCAN", "ROOT"],
    ],
  ]);
  for (const [path, expected] of required) {
    const field = policy.fields.find((item) => item.path === path);
    invariant(
      field &&
        field.classification === expected[0] &&
        field.proof_kind === expected[1] &&
        field.value_kind === expected[2],
      "ERR_SCHEMA",
      `mandatory disclosure policy field ${path} is missing or changed`,
    );
  }
  return hash("NEXUS_DISCLOSURE_POLICY_V1", policy);
}

export function disclosureProofContextRoot(proofContext) {
  assertExactObjectKeys(
    proofContext,
    ["proofs", "schema"],
    [],
    "disclosure proof context",
  );
  invariant(
    proofContext.schema === "nexus-disclosure-proof-context-v2" &&
      Array.isArray(proofContext.proofs) &&
      proofContext.proofs.length > 0 &&
      proofContext.proofs.length <= 256,
    "ERR_SCHEMA",
    "unsupported or empty disclosure proof context",
  );
  for (const proof of proofContext.proofs) {
    assertExactObjectKeys(
      proof,
      [
        "entropy_authority_id",
        "entropy_authority_root",
        "path",
        "preimage",
        "producer",
        "salt",
        "schema",
        "value",
      ],
      [],
      "disclosure proof",
    );
    invariant(
      proof.schema === "nexus-disclosure-proof-v2" &&
        PROOF_PRODUCERS.has(proof.producer),
      "ERR_SCHEMA",
      "unsupported disclosure proof",
    );
    assertCanonicalToken(proof.path, "disclosure proof path", 256);
    assertNullableToken(
      proof.entropy_authority_id,
      "disclosure proof entropy authority ID",
    );
    assertNullableRoot(
      proof.entropy_authority_root,
      "disclosure proof entropy authority root",
    );
    if (proof.producer === "OMISSION") {
      invariant(
        proof.entropy_authority_id === null &&
          proof.entropy_authority_root === null &&
          proof.preimage === null &&
          proof.salt === null &&
          proof.value === null,
        "ERR_SCHEMA",
        "omission proof must not carry hidden values or entropy",
      );
    } else if (proof.producer === "SALTED_COMMITMENT") {
      assertCanonicalToken(
        proof.entropy_authority_id,
        "salt entropy authority ID",
        256,
      );
      assertNonzeroRoot(
        proof.entropy_authority_root,
        "salt entropy authority root",
      );
      assertHexNonce256(proof.salt, "disclosure salt");
      invariant(!ZERO_ROOT.test(proof.salt), "ERR_SCHEMA", "salt is zero");
      assertExactObjectKeys(
        proof.preimage,
        [
          "membership_oracle_policy_root",
          "path",
          "schema",
          "source_root",
        ],
        [],
        "salted disclosure preimage",
      );
      invariant(
        proof.preimage.schema === "nexus-salted-disclosure-preimage-v1" &&
          proof.preimage.path === proof.path &&
          proof.value === null,
        "ERR_SCHEMA",
        "salted disclosure preimage is not path-bound",
      );
      assertNonzeroRoot(
        proof.preimage.membership_oracle_policy_root,
        "membership oracle policy root",
      );
      assertNonzeroRoot(proof.preimage.source_root, "salted source root");
    } else {
      invariant(
        proof.entropy_authority_id === null &&
          proof.entropy_authority_root === null &&
          proof.salt === null,
        "ERR_SCHEMA",
        "non-salted proof cannot carry entropy or salt",
      );
    }
  }
  assertSortedUnique(
    proofContext.proofs,
    "path",
    "disclosure proof context paths",
  );
  return hash("NEXUS_DISCLOSURE_PROOF_CONTEXT_V2", proofContext);
}

export function assertProofContextMatchesPolicy(proofContext, policy) {
  disclosureProofContextRoot(proofContext);
  disclosurePolicyRoot(policy);
  const fields = new Map(policy.fields.map((field) => [field.path, field]));
  const requiredPaths = policy.fields
    .filter((field) => !field.proof_kind.startsWith("DERIVED_"))
    .map((field) => field.path);
  invariant(
    proofContext.proofs.length === requiredPaths.length &&
      proofContext.proofs.every((proof, index) => {
        const field = fields.get(proof.path);
        return (
          proof.path === requiredPaths[index] &&
          field &&
          ((field.proof_kind === "OMISSION" &&
            proof.producer === "OMISSION") ||
            field.proof_kind === proof.producer)
        );
      }),
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "proof context does not exactly cover non-derived policy fields",
  );
}

export function acceptedDisclosurePolicyCarrierRoot(carrier) {
  assertExactObjectKeys(
    carrier,
    [
      "contract_root",
      "disclosure_policy_id",
      "job_id",
      "policy",
      "policy_root",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "accepted disclosure policy carrier",
  );
  invariant(
    carrier.schema === "nexus-accepted-disclosure-policy-v1",
    "ERR_SCHEMA",
    "unsupported accepted disclosure policy carrier",
  );
  const policyRoot = disclosurePolicyRoot(carrier.policy);
  invariant(
    carrier.policy_root === policyRoot &&
      carrier.disclosure_policy_id ===
        derivedCarrierId("DISCLOSURE_POLICY", carrier),
    "ERR_ID_PREIMAGE",
    "accepted disclosure policy ID/root is invalid",
  );
  for (const field of [
    "disclosure_policy_id",
    "job_id",
    "terminal_event_id",
    "terminal_receipt_id",
  ]) {
    assertCanonicalToken(carrier[field], field, 256);
  }
  assertNonzeroRoot(carrier.contract_root, "policy contract root");
  return hash("NEXUS_ACCEPTED_DISCLOSURE_POLICY_V1", carrier);
}

export function acceptedDisclosureProofContextCarrierRoot(carrier) {
  assertExactObjectKeys(
    carrier,
    [
      "contract_root",
      "disclosure_proof_context_id",
      "job_id",
      "proof_context",
      "proof_context_root",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "accepted disclosure proof-context carrier",
  );
  invariant(
    carrier.schema === "nexus-accepted-disclosure-proof-context-v1",
    "ERR_SCHEMA",
    "unsupported accepted disclosure proof-context carrier",
  );
  const proofRoot = disclosureProofContextRoot(carrier.proof_context);
  invariant(
    carrier.proof_context_root === proofRoot &&
      carrier.disclosure_proof_context_id ===
        derivedCarrierId("DISCLOSURE_PROOF_CONTEXT", carrier),
    "ERR_ID_PREIMAGE",
    "accepted disclosure proof-context ID/root is invalid",
  );
  for (const field of [
    "disclosure_proof_context_id",
    "job_id",
    "terminal_event_id",
    "terminal_receipt_id",
  ]) {
    assertCanonicalToken(carrier[field], field, 256);
  }
  assertNonzeroRoot(carrier.contract_root, "proof-context contract root");
  return hash("NEXUS_ACCEPTED_DISCLOSURE_PROOF_CONTEXT_V1", carrier);
}

function eventContextProjection(event, jobId, purpose) {
  assertCanonicalToken(event.event_type, "context event type", 128);
  assertCanonicalToken(event.actor_id, "context actor ID", 256);
  assertHexRoot(event.expected_predecessor_root, "context predecessor root");
  assertSafeNonNegativeInteger(event.tick, "context tick");
  assertCanonicalToken(event.nonce, "context nonce", 256);
  assertCanonicalToken(event.idempotency_key, "context idempotency key", 256);
  assertCanonicalToken(jobId, "context job ID", 256);
  assertCanonicalToken(purpose, "context purpose", 128);
  return {
    event_type: event.event_type,
    actor_id: event.actor_id,
    expected_predecessor_root: event.expected_predecessor_root,
    tick: event.tick,
    nonce: event.nonce,
    idempotency_key: event.idempotency_key,
    job_id: jobId,
    purpose,
  };
}

export function entropyAuthorityContextId(event, jobId, purpose) {
  return rootId(
    "ENTROPYAUTH",
    "NEXUS_ENTROPY_AUTHORITY_ID_V1",
    eventContextProjection(event, jobId, purpose),
  );
}

export function disclosurePreparationAuthorityContextId(event, jobId) {
  return rootId(
    "PREPAUTH",
    "NEXUS_DISCLOSURE_PREPARATION_AUTHORITY_ID_V1",
    eventContextProjection(event, jobId, "DISCLOSURE_PREPARATION"),
  );
}

export function publicExportAuthorityContextId(event, jobId) {
  return rootId(
    "EXPORTAUTH",
    "NEXUS_PUBLIC_EXPORT_AUTHORITY_ID_V1",
    eventContextProjection(event, jobId, "PUBLIC_EXPORT"),
  );
}

export function entropyOneUseCommitmentRoot({
  nonceCommitment,
  purpose,
  scopeRoot,
}) {
  assertNonzeroRoot(nonceCommitment, "nonce commitment");
  assertCanonicalToken(purpose, "entropy purpose", 128);
  assertNonzeroRoot(scopeRoot, "entropy scope root");
  return hash("NEXUS_NONCE_ONE_USE_V1", {
    nonce_commitment: nonceCommitment,
    purpose,
    scope_root: scopeRoot,
  });
}

export function entropyFreshnessAuthorityV1Root(authority) {
  assertExactObjectKeys(
    authority,
    [
      "entropy_evidence_root",
      "freshness_evidence_root",
      "minimum_entropy_bits",
      "nonce_commitment",
      "one_use_commitment",
      "purpose",
      "schema",
      "scope_root",
    ],
    [],
    "entropy freshness authority",
  );
  invariant(
    authority.schema === "nexus-entropy-freshness-authority-v1" &&
      authority.minimum_entropy_bits === 256 &&
      ENTROPY_PURPOSES.has(authority.purpose),
    "ERR_SCHEMA",
    "unsupported entropy freshness authority",
  );
  for (const field of [
    "entropy_evidence_root",
    "freshness_evidence_root",
    "nonce_commitment",
    "one_use_commitment",
    "scope_root",
  ]) {
    assertNonzeroRoot(authority[field], field);
  }
  invariant(
    authority.one_use_commitment ===
      entropyOneUseCommitmentRoot({
        nonceCommitment: authority.nonce_commitment,
        purpose: authority.purpose,
        scopeRoot: authority.scope_root,
      }),
    "ERR_NONCE_REPLAY",
    "entropy one-use commitment is invalid",
  );
  return hash("NEXUS_ENTROPY_FRESHNESS_AUTHORITY_V1", authority);
}

export function disclosurePreparationNonceScopeRoot(binding) {
  assertExactObjectKeys(
    binding,
    [
      "approval_authority_root",
      "approval_policy_root",
      "contract_root",
      "disclosure_policy_id",
      "disclosure_policy_record_root",
      "disclosure_proof_context_id",
      "disclosure_proof_context_record_root",
      "job_id",
      "scanner_authority_root",
      "schema",
      "secret_scan_policy_root",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "disclosure preparation nonce binding",
  );
  invariant(
    binding.schema === "nexus-disclosure-preparation-nonce-scope-v1",
    "ERR_SCHEMA",
    "unsupported disclosure preparation nonce scope",
  );
  for (const [key, value] of Object.entries(binding)) {
    if (key.endsWith("_root")) assertNonzeroRoot(value, key);
    else if (key !== "schema") assertCanonicalToken(value, key, 256);
  }
  return hash("NEXUS_DISCLOSURE_PREPARATION_NONCE_SCOPE_V1", binding);
}

export function disclosureSaltScopeRoot(binding) {
  assertExactObjectKeys(
    binding,
    ["disclosure_policy_root", "path", "schema"],
    [],
    "disclosure salt scope binding",
  );
  invariant(
    binding.schema === "nexus-disclosure-salt-scope-v2",
    "ERR_SCHEMA",
    "unsupported disclosure salt scope",
  );
  assertNonzeroRoot(
    binding.disclosure_policy_root,
    "salt disclosure policy root",
  );
  assertCanonicalToken(binding.path, "salt path", 256);
  return hash("NEXUS_DISCLOSURE_SALT_SCOPE_V2", {
    disclosure_policy_root: binding.disclosure_policy_root,
    path: binding.path,
  });
}

export function disclosureSaltCommitmentRoot({ path, salt }) {
  assertCanonicalToken(path, "salt path", 256);
  assertHexNonce256(salt, "disclosure salt");
  invariant(!ZERO_ROOT.test(salt), "ERR_SCHEMA", "salt is zero");
  return hash("NEXUS_DISCLOSURE_SALT_COMMITMENT_V2", { path, salt });
}

export function publicationIntentNonceScopeRoot(binding) {
  assertExactObjectKeys(
    binding,
    [
      "accepted_compilation_anchor_root",
      "capsule_root",
      "destination_policy",
      "disclosure_manifest_root",
      "job_id",
      "non_claims_root",
      "publication_principal_id",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "publication intent nonce binding",
  );
  invariant(
    binding.schema === "nexus-publication-intent-nonce-scope-v3" &&
      binding.destination_policy === "GITHUB_SANITIZED_WITNESS",
    "ERR_SCHEMA",
    "unsupported publication intent nonce scope",
  );
  for (const field of [
    "accepted_compilation_anchor_root",
    "capsule_root",
    "disclosure_manifest_root",
    "non_claims_root",
  ]) {
    assertNonzeroRoot(binding[field], field);
  }
  for (const field of [
    "destination_policy",
    "job_id",
    "publication_principal_id",
    "terminal_event_id",
    "terminal_receipt_id",
  ]) {
    assertCanonicalToken(binding[field], field, 256);
  }
  return hash("NEXUS_PUBLICATION_INTENT_NONCE_SCOPE_V3", {
    accepted_compilation_anchor_root:
      binding.accepted_compilation_anchor_root,
    capsule_root: binding.capsule_root,
    destination_policy: binding.destination_policy,
    disclosure_manifest_root: binding.disclosure_manifest_root,
    job_id: binding.job_id,
    non_claims_root: binding.non_claims_root,
    publication_principal_id: binding.publication_principal_id,
    terminal_event_id: binding.terminal_event_id,
    terminal_receipt_id: binding.terminal_receipt_id,
  });
}

export function entropyBindingScopeRoot(purpose, binding) {
  if (purpose === "DISCLOSURE_PREPARATION") {
    return disclosurePreparationNonceScopeRoot(binding);
  }
  if (purpose === "DISCLOSURE_SALT") return disclosureSaltScopeRoot(binding);
  if (purpose === "PUBLICATION_INTENT") {
    return publicationIntentNonceScopeRoot(binding);
  }
  invariant(false, "ERR_SCHEMA", `unsupported entropy purpose ${purpose}`);
}

export function disclosurePreparationUseScopeRoot({
  preparationAuthorityId,
  preparationAuthorityRoot,
  exportNonceCommitment,
}) {
  assertCanonicalToken(
    preparationAuthorityId,
    "preparation authority ID",
    256,
  );
  assertNonzeroRoot(
    preparationAuthorityRoot,
    "preparation authority root",
  );
  assertNonzeroRoot(exportNonceCommitment, "export nonce commitment");
  return hash("NEXUS_DISCLOSURE_PREPARATION_USE_SCOPE_V1", {
    preparation_authority_id: preparationAuthorityId,
    preparation_authority_root: preparationAuthorityRoot,
    export_nonce_commitment: exportNonceCommitment,
  });
}

export function disclosureSaltUseScopeRoot({
  disclosureProofContextRecordRoot,
  disclosureProofContextRoot,
  nonceCommitment,
  path,
  preparationAuthorityId,
  preparationAuthorityRoot,
}) {
  return hash("NEXUS_DISCLOSURE_SALT_USE_SCOPE_V2", {
    disclosure_proof_context_record_root:
      disclosureProofContextRecordRoot,
    disclosure_proof_context_root: disclosureProofContextRoot,
    nonce_commitment: nonceCommitment,
    path,
    preparation_authority_id: preparationAuthorityId,
    preparation_authority_root: preparationAuthorityRoot,
  });
}

export function publicationIntentNonceCommitmentRoot({ nonce, scopeRoot }) {
  assertHexNonce256(nonce, "publication intent nonce");
  invariant(!ZERO_ROOT.test(nonce), "ERR_SCHEMA", "publication nonce is zero");
  assertNonzeroRoot(scopeRoot, "publication intent scope root");
  return hash("NEXUS_PUBLICATION_INTENT_NONCE_COMMITMENT_V2", {
    nonce,
    scope_root: scopeRoot,
  });
}

export function publicationIntentUseScopeRoot({
  binding,
  nonceAuthorityId,
  nonceAuthorityRoot,
  nonceCommitment,
  scopeRoot,
}) {
  publicationIntentNonceScopeRoot(binding);
  assertCanonicalToken(nonceAuthorityId, "nonce authority ID", 256);
  assertNonzeroRoot(nonceAuthorityRoot, "nonce authority root");
  assertNonzeroRoot(nonceCommitment, "nonce commitment");
  assertNonzeroRoot(scopeRoot, "nonce scope root");
  return hash("NEXUS_PUBLICATION_INTENT_USE_SCOPE_V2", {
    accepted_compilation_anchor_root:
      binding.accepted_compilation_anchor_root,
    capsule_root: binding.capsule_root,
    disclosure_manifest_root: binding.disclosure_manifest_root,
    non_claims_root: binding.non_claims_root,
    nonce_authority_id: nonceAuthorityId,
    nonce_authority_root: nonceAuthorityRoot,
    nonce_commitment: nonceCommitment,
    scope_root: scopeRoot,
    terminal_receipt_id: binding.terminal_receipt_id,
  });
}

export function entropyOneUseClaimV1Root(claim) {
  assertExactObjectKeys(
    claim,
    [
      "authority_id",
      "authority_root",
      "nonce_commitment",
      "purpose",
      "schema",
      "scope_root",
      "use_scope_root",
    ],
    [],
    "entropy one-use claim",
  );
  invariant(
    claim.schema === "nexus-entropy-one-use-claim-v1" &&
      ENTROPY_PURPOSES.has(claim.purpose),
    "ERR_SCHEMA",
    "unsupported entropy one-use claim",
  );
  assertCanonicalToken(claim.authority_id, "entropy authority ID", 256);
  for (const field of [
    "authority_root",
    "nonce_commitment",
    "scope_root",
    "use_scope_root",
  ]) {
    assertNonzeroRoot(claim[field], field);
  }
  return hash("NEXUS_ENTROPY_ONE_USE_CLAIM_V1", claim);
}

export function entropyOneUseConsumptionV1Root(consumption) {
  assertExactObjectKeys(
    consumption,
    [
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
    ],
    [],
    "entropy one-use consumption",
  );
  invariant(
    consumption.schema === "nexus-entropy-one-use-consumption-v1" &&
      ENTROPY_PURPOSES.has(consumption.purpose),
    "ERR_SCHEMA",
    "unsupported entropy one-use consumption",
  );
  for (const field of [
    "authority_id",
    "consuming_event_id",
    "consumption_id",
  ]) {
    assertCanonicalToken(consumption[field], field, 256);
  }
  for (const field of [
    "authority_root",
    "nonce_commitment",
    "previous_application_state_root",
    "scope_root",
    "use_claim_root",
    "use_scope_root",
  ]) {
    assertNonzeroRoot(consumption[field], field);
  }
  return hash("NEXUS_ENTROPY_ONE_USE_CONSUMPTION_V1", consumption);
}

export function publicationApprovalAuthorityV3Root({
  jobId,
  contractRoot,
  terminalReceiptId,
  approvalPolicyRoot,
  publicationPrincipalIds,
}) {
  invariant(
    Array.isArray(publicationPrincipalIds) &&
      publicationPrincipalIds.length > 0,
    "ERR_SCHEMA",
    "publication principals are required",
  );
  const principals = [...publicationPrincipalIds].sort();
  invariant(
    new Set(principals).size === principals.length,
    "ERR_SCHEMA",
    "publication principals must be unique",
  );
  return hash("NEXUS_PUBLICATION_APPROVAL_AUTHORITY_V3", {
    schema: "nexus-publication-approval-authority-v3",
    job_id: jobId,
    contract_root: contractRoot,
    terminal_receipt_id: terminalReceiptId,
    approval_policy_root: approvalPolicyRoot,
    publication_principal_ids: principals,
  });
}

export function disclosurePreparationAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "approval_authority_root",
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
      "export_nonce_commitment",
      "job_id",
      "preparation_authority_id",
      "preparation_verifier_authority_root",
      "preparation_verifier_controller_id",
      "preparation_verifier_principal_id",
      "scanner_authority_root",
      "schema",
      "secret_scan_policy_root",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "disclosure preparation authority",
  );
  invariant(
    authority.schema === "nexus-disclosure-preparation-authority-v1",
    "ERR_SCHEMA",
    "unsupported disclosure preparation authority",
  );
  for (const [key, value] of Object.entries(authority)) {
    if (key.endsWith("_root")) assertNonzeroRoot(value, key);
    else if (key !== "schema") assertCanonicalToken(value, key, 256);
  }
  return hash("NEXUS_DISCLOSURE_PREPARATION_AUTHORITY_V1", authority);
}

export function disclosureSaltEntropyConsumptionsRoot(consumptions) {
  invariant(
    Array.isArray(consumptions) && consumptions.length <= 256,
    "ERR_SCHEMA",
    "invalid disclosure salt consumption list",
  );
  for (const reference of consumptions) {
    assertExactObjectKeys(
      reference,
      ["consumption_id", "consumption_root", "path"],
      [],
      "disclosure salt consumption reference",
    );
    assertCanonicalToken(reference.path, "salt consumption path", 256);
    assertCanonicalToken(
      reference.consumption_id,
      "salt consumption ID",
      256,
    );
    assertNonzeroRoot(
      reference.consumption_root,
      "salt consumption root",
    );
  }
  assertSortedUnique(consumptions, "path", "salt consumption references");
  return hash("NEXUS_DISCLOSURE_SALT_ENTROPY_CONSUMPTIONS_V1", {
    schema: "nexus-disclosure-salt-entropy-consumptions-v1",
    consumptions,
  });
}

export function disclosurePreparationRoot({
  preparationAuthorityId,
  preparationAuthorityRoot,
  jobId,
  contractRoot,
  disclosurePolicyRoot,
  disclosureProofContextRoot,
  preparationEntropyConsumptionId,
  preparationEntropyConsumptionRoot,
  exportNonceCommitment,
  saltEntropyConsumptionsRoot,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
}) {
  assertNonzeroRoot(
    saltEntropyConsumptionsRoot,
    "salt entropy consumptions root",
  );
  return hash("NEXUS_DISCLOSURE_PREPARATION_V2", {
    schema: "nexus-disclosure-preparation-v2",
    preparation_authority_id: preparationAuthorityId,
    preparation_authority_root: preparationAuthorityRoot,
    job_id: jobId,
    contract_root: contractRoot,
    disclosure_policy_root: disclosurePolicyRoot,
    disclosure_proof_context_root: disclosureProofContextRoot,
    preparation_entropy_consumption_id:
      preparationEntropyConsumptionId,
    preparation_entropy_consumption_root:
      preparationEntropyConsumptionRoot,
    export_nonce_commitment: exportNonceCommitment,
    salt_entropy_consumptions_root: saltEntropyConsumptionsRoot,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
  });
}

export function publicJobSummaryV3Root({
  preparationRoot,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
}) {
  for (const root of [
    preparationRoot,
    contentPublicValuesRoot,
    contentProofDescriptorsRoot,
  ]) {
    assertNonzeroRoot(root, "public job summary input root");
  }
  return hash("NEXUS_PUBLIC_JOB_SUMMARY_V3", {
    schema: "nexus-public-job-summary-v3",
    preparation_root: preparationRoot,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
  });
}

export function publicJobIdV3({
  preparationAuthorityId,
  preparationAuthorityRoot,
  exportNonceCommitment,
}) {
  return rootId("PUBLIC-JOB", "NEXUS_PUBLIC_JOB_ID_V3", {
    preparation_authority_id: preparationAuthorityId,
    preparation_authority_root: preparationAuthorityRoot,
    export_nonce_commitment: exportNonceCommitment,
  });
}

export function publicExportAuthorityV3Root(authority) {
  assertExactObjectKeys(
    authority,
    [
      "approval_receipt_id",
      "approval_receipt_root",
      "content_proof_descriptors_root",
      "content_public_values_root",
      "contract_root",
      "disclosure_policy_id",
      "disclosure_policy_record_root",
      "disclosure_policy_root",
      "disclosure_proof_context_id",
      "disclosure_proof_context_record_root",
      "disclosure_proof_context_root",
      "export_authority_id",
      "export_nonce_commitment",
      "job_id",
      "preparation_authority_id",
      "preparation_authority_root",
      "preparation_entropy_consumption_id",
      "preparation_entropy_consumption_root",
      "preparation_root",
      "public_job_summary_root",
      "scan_receipt_id",
      "scan_receipt_root",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "public export authority v3",
  );
  invariant(
    authority.schema === "nexus-public-export-authority-v3",
    "ERR_SCHEMA",
    "unsupported public export authority",
  );
  for (const [key, value] of Object.entries(authority)) {
    if (key.endsWith("_root")) assertNonzeroRoot(value, key);
    else if (key !== "schema") assertCanonicalToken(value, key, 256);
  }
  return hash("NEXUS_PUBLIC_EXPORT_AUTHORITY_V3", authority);
}

export function publicationIntentV2Id(body) {
  assertExactObjectKeys(
    body,
    [
      "capsule_root",
      "destination_policy",
      "disclosure_manifest_root",
      "idempotency_key",
      "job_id",
      "logical_tick",
      "nonce",
      "nonce_authority_id",
      "nonce_authority_root",
      "nonce_consumption_id",
      "nonce_consumption_root",
      "non_claims_root",
      "predecessor_root",
      "publication_principal_id",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "publication intent v2",
  );
  invariant(
    body.schema === "nexus-publication-intent-v2",
    "ERR_SCHEMA",
    "unsupported publication intent",
  );
  for (const field of [
    "capsule_root",
    "disclosure_manifest_root",
    "nonce_authority_root",
    "nonce_consumption_root",
    "non_claims_root",
    "predecessor_root",
  ]) {
    assertNonzeroRoot(body[field], field);
  }
  for (const field of [
    "destination_policy",
    "idempotency_key",
    "job_id",
    "nonce_authority_id",
    "nonce_consumption_id",
    "publication_principal_id",
    "terminal_event_id",
    "terminal_receipt_id",
  ]) {
    assertCanonicalToken(body[field], field, 256);
  }
  assertSafeNonNegativeInteger(body.logical_tick, "publication logical tick");
  assertHexNonce256(body.nonce, "publication intent nonce");
  invariant(!ZERO_ROOT.test(body.nonce), "ERR_SCHEMA", "publication nonce is zero");
  return rootId("PUBINTENT", "NEXUS_PUBLICATION_INTENT_V2", body);
}

export function disclosurePreparationVerifierAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "contract_root",
      "job_id",
      "preparation_authority_id",
      "schema",
      "verifier_controller_id",
      "verifier_policy_root",
      "verifier_principal_id",
    ],
    [],
    "disclosure preparation verifier authority",
  );
  invariant(
    authority.schema ===
      "nexus-disclosure-preparation-verifier-authority-v1",
    "ERR_SCHEMA",
    "unsupported disclosure preparation verifier authority",
  );
  for (const field of [
    "job_id",
    "preparation_authority_id",
    "verifier_controller_id",
    "verifier_principal_id",
  ]) {
    assertCanonicalToken(authority[field], field, 256);
  }
  assertNonzeroRoot(authority.contract_root, "verifier contract root");
  assertNonzeroRoot(
    authority.verifier_policy_root,
    "preparation verifier policy root",
  );
  return hash(
    "NEXUS_DISCLOSURE_PREPARATION_VERIFIER_AUTHORITY_V1",
    authority,
  );
}

function assertEntropyUseRecord(
  authorityRecord,
  consumptionRecord,
  {
    authorityId,
    authorityRoot,
    nonceCommitment,
    purpose,
    scopeRoot,
    useScopeRoot,
  },
) {
  invariant(
    authorityRecord?.authority_id === authorityId &&
      authorityRecord.authority_root === authorityRoot &&
      entropyFreshnessAuthorityV1Root(authorityRecord.authority) ===
        authorityRoot &&
      authorityRecord.status === "CONSUMED" &&
      authorityRecord.authority.purpose === purpose &&
      authorityRecord.authority.scope_root === scopeRoot &&
      authorityRecord.authority.nonce_commitment === nonceCommitment &&
      consumptionRecord?.consumption_id ===
        authorityRecord.consumption_id &&
      consumptionRecord.consumption_root ===
        authorityRecord.consumption_root &&
      entropyOneUseConsumptionV1Root(consumptionRecord.consumption) ===
        consumptionRecord.consumption_root &&
      consumptionRecord.consumption.authority_id === authorityId &&
      consumptionRecord.consumption.authority_root === authorityRoot &&
      consumptionRecord.consumption.purpose === purpose &&
      consumptionRecord.consumption.scope_root === scopeRoot &&
      consumptionRecord.consumption.nonce_commitment === nonceCommitment &&
      consumptionRecord.consumption.use_scope_root === useScopeRoot &&
      consumptionRecord.status === "CONSUMED",
    "ERR_NONCE_REPLAY",
    `${purpose} entropy use is missing, altered, or reusable`,
  );
}

function disclosureProofResult(
  proof,
  rule,
  {
    policyRoot,
    proofRecordRoot,
    proofContextRoot,
    preparationAuthorityId,
    preparationAuthorityRoot,
    saltUse,
  },
) {
  invariant(
    proof.producer === rule.proof_kind,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    `proof producer differs from policy for ${proof.path}`,
  );
  if (proof.producer === "OMISSION") {
    invariant(
      proof.value === null &&
        proof.preimage === null &&
        proof.salt === null &&
        proof.entropy_authority_id === null &&
        proof.entropy_authority_root === null,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `omission proof ${proof.path} contains publishable material`,
    );
    return { children: new Map(), value: null };
  }
  if (proof.producer === "PLAIN_PUBLIC") {
    invariant(
      proof.preimage === null &&
        proof.salt === null &&
        proof.entropy_authority_id === null &&
        proof.entropy_authority_root === null &&
        proof.value !== null,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `plain proof ${proof.path} is empty or carries hidden material`,
    );
    assertCanonicalValue(proof.value);
    return { children: new Map(), value: proof.value };
  }
  if (proof.producer === "PUBLIC_PREIMAGE") {
    invariant(
      proof.value === null &&
        proof.salt === null &&
        proof.entropy_authority_id === null &&
        proof.entropy_authority_root === null,
      "ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE",
      `public preimage ${proof.path} carries unexpected material`,
    );
    assertExactObjectKeys(
      proof.preimage,
      ["producer_domain", "source"],
      [],
      `${proof.path} public preimage`,
    );
    assertExactObjectKeys(
      proof.preimage.source,
      ["children", "path", "schema", "value"],
      [],
      `${proof.path} public preimage source`,
    );
    const source = proof.preimage.source;
    const producerDomain = PUBLIC_PREIMAGE_PRODUCERS[source.schema];
    invariant(
      producerDomain &&
        proof.preimage.producer_domain === producerDomain &&
        source.path === proof.path &&
        Array.isArray(source.children) &&
        (source.value !== null || source.children.length > 0),
      "ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE",
      `public preimage ${proof.path} is not from an allowlisted producer`,
    );
    assertCanonicalValue(source.value);
    const children = new Map();
    let previous = null;
    for (const child of source.children) {
      assertExactObjectKeys(
        child,
        ["path", "root"],
        [],
        `${proof.path} public child`,
      );
      assertCanonicalToken(child.path, "public child path", 256);
      assertNonzeroRoot(child.root, "public child root");
      invariant(
        previous === null || previous < child.path,
        "ERR_NON_CANONICAL",
        `public children for ${proof.path} are not sorted and unique`,
      );
      previous = child.path;
      children.set(child.path, child.root);
    }
    return { children, value: hash(producerDomain, source) };
  }
  invariant(
    proof.producer === "SALTED_COMMITMENT" && saltUse,
    "ERR_NONCE_REPLAY",
    `salted proof ${proof.path} lacks one accepted entropy use`,
  );
  const nonceCommitment = disclosureSaltCommitmentRoot({
    path: proof.path,
    salt: proof.salt,
  });
  const scopeRoot = disclosureSaltScopeRoot({
    schema: "nexus-disclosure-salt-scope-v2",
    disclosure_policy_root: policyRoot,
    path: proof.path,
  });
  const useScopeRoot = disclosureSaltUseScopeRoot({
    disclosureProofContextRecordRoot: proofRecordRoot,
    disclosureProofContextRoot: proofContextRoot,
    nonceCommitment,
    path: proof.path,
    preparationAuthorityId,
    preparationAuthorityRoot,
  });
  assertEntropyUseRecord(saltUse.authority, saltUse.consumption, {
    authorityId: proof.entropy_authority_id,
    authorityRoot: proof.entropy_authority_root,
    nonceCommitment,
    purpose: "DISCLOSURE_SALT",
    scopeRoot,
    useScopeRoot,
  });
  return {
    children: new Map(),
    value: hash("NEXUS_SALTED_PUBLIC_COMMITMENT_V2", {
      nonce: proof.salt,
      preimage: proof.preimage,
    }),
  };
}

function disclosureDescriptor(rule, value, proofRoot) {
  const publishes =
    rule.classification === "PUBLIC" ||
    rule.classification === "COMMITMENT_ONLY";
  return {
    classification: rule.classification,
    path: rule.path,
    proof_kind: rule.proof_kind,
    proof_root: proofRoot,
    value_kind: rule.value_kind,
    value_root: publishes
      ? hash("NEXUS_DISCLOSURE_VALUE_V3", {
          path: rule.path,
          value,
        })
      : null,
  };
}

export function deriveDisclosurePreparationBindings({
  policy_carrier: policyCarrier,
  proof_context_carrier: proofCarrier,
  preparation_authority: preparationAuthority,
  entropy_authority: entropyAuthority,
  entropy_consumption: entropyConsumption,
  salt_entropy_uses: saltEntropyUses,
}) {
  const policyRecordRoot = acceptedDisclosurePolicyCarrierRoot(policyCarrier);
  const proofRecordRoot =
    acceptedDisclosureProofContextCarrierRoot(proofCarrier);
  const preparationAuthorityRoot =
    disclosurePreparationAuthorityRoot(preparationAuthority);
  assertProofContextMatchesPolicy(
    proofCarrier.proof_context,
    policyCarrier.policy,
  );
  invariant(
    preparationAuthority.disclosure_policy_id ===
        policyCarrier.disclosure_policy_id &&
      preparationAuthority.disclosure_policy_record_root ===
        policyRecordRoot &&
      preparationAuthority.disclosure_policy_root ===
        policyCarrier.policy_root &&
      preparationAuthority.disclosure_proof_context_id ===
        proofCarrier.disclosure_proof_context_id &&
      preparationAuthority.disclosure_proof_context_record_root ===
        proofRecordRoot &&
      preparationAuthority.disclosure_proof_context_root ===
        proofCarrier.proof_context_root &&
      preparationAuthority.job_id === policyCarrier.job_id &&
      preparationAuthority.job_id === proofCarrier.job_id &&
      preparationAuthority.contract_root === policyCarrier.contract_root &&
      preparationAuthority.contract_root === proofCarrier.contract_root,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "preparation authority differs from accepted policy/proof carriers",
  );
  const preparationUseScope = disclosurePreparationUseScopeRoot({
    preparationAuthorityId:
      preparationAuthority.preparation_authority_id,
    preparationAuthorityRoot,
    exportNonceCommitment:
      preparationAuthority.export_nonce_commitment,
  });
  assertEntropyUseRecord(entropyAuthority, entropyConsumption, {
    authorityId:
      preparationAuthority.entropy_freshness_authority_id,
    authorityRoot:
      preparationAuthority.entropy_freshness_authority_root,
    nonceCommitment:
      preparationAuthority.export_nonce_commitment,
    purpose: "DISCLOSURE_PREPARATION",
    scopeRoot: disclosurePreparationNonceScopeRoot(
      entropyAuthority.binding,
    ),
    useScopeRoot: preparationUseScope,
  });
  invariant(
    Array.isArray(saltEntropyUses),
    "ERR_SCHEMA",
    "salt entropy uses must be an array",
  );
  const saltUses = new Map();
  const consumedIds = new Set([entropyConsumption.consumption_id]);
  for (const use of saltEntropyUses) {
    assertExactObjectKeys(
      use,
      ["authority", "consumption", "path"],
      [],
      "salt entropy use",
    );
    assertCanonicalToken(use.path, "salt entropy path", 256);
    invariant(
      !saltUses.has(use.path) &&
        !consumedIds.has(use.consumption.consumption_id),
      "ERR_NONCE_REPLAY",
      "salt entropy use is duplicated or reused",
    );
    consumedIds.add(use.consumption.consumption_id);
    saltUses.set(use.path, use);
  }
  const rules = new Map(
    policyCarrier.policy.fields.map((field) => [field.path, field]),
  );
  const proofs = new Map(
    proofCarrier.proof_context.proofs.map((proof) => [proof.path, proof]),
  );
  const saltedPaths = proofCarrier.proof_context.proofs
    .filter((proof) => proof.producer === "SALTED_COMMITMENT")
    .map((proof) => proof.path);
  invariant(
    canonicalEqual([...saltUses.keys()].sort(), saltedPaths),
    "ERR_NONCE_REPLAY",
    "salt entropy uses do not exactly cover salted proofs",
  );
  const values = new Map();
  const results = new Map();
  const proofRoots = new Map();
  for (const [path, rule] of rules) {
    if (Object.hasOwn(DERIVED_PATHS, path)) continue;
    const proof = proofs.get(path);
    invariant(
      proof,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `accepted policy path ${path} lacks a proof`,
    );
    const result = disclosureProofResult(proof, rule, {
      policyRoot: policyCarrier.policy_root,
      proofRecordRoot,
      proofContextRoot: proofCarrier.proof_context_root,
      preparationAuthorityId:
        preparationAuthority.preparation_authority_id,
      preparationAuthorityRoot,
      saltUse: saltUses.get(path),
    });
    values.set(path, result.value);
    results.set(path, result);
    proofRoots.set(
      path,
      hash("NEXUS_DISCLOSURE_LOCAL_PROOF_V2", proof),
    );
  }
  const safe = new Set();
  const visit = (path, visiting = new Set()) => {
    if (safe.has(path)) return;
    invariant(
      !visiting.has(path),
      "ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE",
      `public proof cycle at ${path}`,
    );
    const rule = rules.get(path);
    const result = results.get(path);
    invariant(
      rule &&
        result &&
        rule.value_kind === "ROOT" &&
        ["PUBLIC", "COMMITMENT_ONLY"].includes(rule.classification),
      "ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE",
      `public root reaches private or unclassified ${path}`,
    );
    visiting.add(path);
    for (const [childPath, childRoot] of result.children) {
      visit(childPath, visiting);
      invariant(
        values.get(childPath) === childRoot,
        "ERR_PUBLIC_ROOT_TRANSITIVE_PRIVATE",
        `public child root mismatch for ${childPath}`,
      );
    }
    visiting.delete(path);
    safe.add(path);
  };
  for (const [path, rule] of rules) {
    if (
      !Object.hasOwn(DERIVED_PATHS, path) &&
      rule.value_kind === "ROOT" &&
      ["PUBLIC", "COMMITMENT_ONLY"].includes(rule.classification)
    ) {
      visit(path);
    }
  }
  const publicJobId = publicJobIdV3({
    preparationAuthorityId:
      preparationAuthority.preparation_authority_id,
    preparationAuthorityRoot,
    exportNonceCommitment:
      preparationAuthority.export_nonce_commitment,
  });
  values.set("public_job_id", publicJobId);
  const publicJobProofRoot = hash(
    "NEXUS_DISCLOSURE_DERIVED_JOB_PROOF_V3",
    {
      preparation_authority_id:
        preparationAuthority.preparation_authority_id,
      preparation_authority_root: preparationAuthorityRoot,
      preparation_entropy_consumption_root:
        entropyConsumption.consumption_root,
      export_nonce_commitment:
        preparationAuthority.export_nonce_commitment,
      public_job_id: publicJobId,
    },
  );
  proofRoots.set("public_job_id", publicJobProofRoot);
  const descriptors = [...rules.values()]
    .filter((rule) => !CONTENT_EXCLUDED_PATHS.has(rule.path))
    .map((rule) =>
      disclosureDescriptor(
        rule,
        values.get(rule.path),
        proofRoots.get(rule.path),
      ),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  const publicValues = Object.create(null);
  for (const descriptor of descriptors) {
    if (
      descriptor.classification === "PUBLIC" ||
      descriptor.classification === "COMMITMENT_ONLY"
    ) {
      invariant(
        values.has(descriptor.path),
        "ERR_DISCLOSURE_UNCLASSIFIED",
        `prepared public value ${descriptor.path} is missing`,
      );
      publicValues[descriptor.path] = values.get(descriptor.path);
    }
  }
  invariant(
    descriptors.length > 0 && Object.keys(publicValues).length > 0,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "prepared public values and descriptors must be nonempty",
  );
  const contentPublicValuesRoot = hash(
    "NEXUS_DISCLOSURE_PUBLIC_VALUES_V3",
    publicValues,
  );
  const contentProofDescriptorsRoot = hash(
    "NEXUS_DISCLOSURE_PROOF_DESCRIPTORS_V3",
    descriptors,
  );
  const saltReferences = [...saltUses.entries()]
    .map(([path, use]) => ({
      path,
      consumption_id: use.consumption.consumption_id,
      consumption_root: use.consumption.consumption_root,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const saltRoot =
    disclosureSaltEntropyConsumptionsRoot(saltReferences);
  const receipt = {
    schema: "nexus-disclosure-content-preparation-receipt-v2",
    preparation_authority_id:
      preparationAuthority.preparation_authority_id,
    preparation_authority_root: preparationAuthorityRoot,
    disclosure_policy_id: policyCarrier.disclosure_policy_id,
    disclosure_policy_record_root: policyRecordRoot,
    disclosure_policy_root: policyCarrier.policy_root,
    disclosure_proof_context_id:
      proofCarrier.disclosure_proof_context_id,
    disclosure_proof_context_record_root: proofRecordRoot,
    disclosure_proof_context_root:
      proofCarrier.proof_context_root,
    preparation_entropy_consumption_id:
      entropyConsumption.consumption_id,
    preparation_entropy_consumption_root:
      entropyConsumption.consumption_root,
    export_nonce_commitment:
      preparationAuthority.export_nonce_commitment,
    salt_entropy_consumptions: saltReferences,
    salt_entropy_consumptions_root: saltRoot,
    public_job_proof_root: publicJobProofRoot,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
  };
  const body = {
    schema: "nexus-disclosure-content-preparation-v2",
    preparation_authority_id:
      preparationAuthority.preparation_authority_id,
    preparation_authority_root: preparationAuthorityRoot,
    disclosure_policy_id: policyCarrier.disclosure_policy_id,
    disclosure_policy_record_root: policyRecordRoot,
    disclosure_policy_root: policyCarrier.policy_root,
    disclosure_proof_context_id:
      proofCarrier.disclosure_proof_context_id,
    disclosure_proof_context_record_root: proofRecordRoot,
    disclosure_proof_context_root:
      proofCarrier.proof_context_root,
    policy_fields: policyCarrier.policy.fields,
    content_public_values: publicValues,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors: descriptors,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    preparation_receipt: receipt,
  };
  const preparationRootValue = disclosurePreparationRoot({
    preparationAuthorityId:
      preparationAuthority.preparation_authority_id,
    preparationAuthorityRoot,
    jobId: preparationAuthority.job_id,
    contractRoot: preparationAuthority.contract_root,
    disclosurePolicyRoot: policyCarrier.policy_root,
    disclosureProofContextRoot:
      proofCarrier.proof_context_root,
    preparationEntropyConsumptionId:
      entropyConsumption.consumption_id,
    preparationEntropyConsumptionRoot:
      entropyConsumption.consumption_root,
    exportNonceCommitment:
      preparationAuthority.export_nonce_commitment,
    saltEntropyConsumptionsRoot: saltRoot,
    contentPublicValuesRoot,
    contentProofDescriptorsRoot,
  });
  return deepFreeze({
    ...body,
    preparation_root: preparationRootValue,
  });
}

export function verifyDisclosurePreparationBindings({
  preparation,
  policy_carrier: policyCarrier,
  proof_context_carrier: proofCarrier,
  preparation_authority: preparationAuthority,
  entropy_authority: entropyAuthority,
  entropy_consumption: entropyConsumption,
  salt_entropy_uses: saltEntropyUses,
}) {
  assertCanonicalValue(preparation);
  const computed = deriveDisclosurePreparationBindings({
    policy_carrier: policyCarrier,
    proof_context_carrier: proofCarrier,
    preparation_authority: preparationAuthority,
    entropy_authority: entropyAuthority,
    entropy_consumption: entropyConsumption,
    salt_entropy_uses: saltEntropyUses,
  });
  invariant(
    canonicalEqual(preparation, computed),
    "ERR_VERIFIER_MUTATION",
    "disclosure preparation differs from recomputed accepted bindings",
  );
  return computed;
}

export function publicationIntentV3Id(body) {
  assertExactObjectKeys(
    body,
    [
      "accepted_compilation_anchor_id",
      "accepted_compilation_anchor_root",
      "destination_policy",
      "disclosure_manifest_id",
      "disclosure_manifest_root",
      "idempotency_key",
      "job_id",
      "logical_tick",
      "nonce",
      "nonce_authority_id",
      "nonce_authority_root",
      "nonce_consumption_id",
      "nonce_consumption_root",
      "non_claims_id",
      "non_claims_root",
      "predecessor_root",
      "public_capsule_id",
      "public_capsule_root",
      "publication_principal_id",
      "schema",
      "terminal_event_id",
      "terminal_receipt_id",
    ],
    [],
    "publication intent v3",
  );
  invariant(
    body.schema === "nexus-publication-intent-v3" &&
      body.destination_policy === "GITHUB_SANITIZED_WITNESS",
    "ERR_SCHEMA",
    "unsupported publication intent destination/schema",
  );
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith("_root")) assertNonzeroRoot(value, key);
  }
  assertSafeNonNegativeInteger(body.logical_tick, "publication logical tick");
  assertHexNonce256(body.nonce, "publication intent nonce");
  invariant(!ZERO_ROOT.test(body.nonce), "ERR_SCHEMA", "publication nonce is zero");
  return rootId("PUBINTENT", "NEXUS_PUBLICATION_INTENT_V3", body);
}
