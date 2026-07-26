import { hash, rootId } from "./hash.mjs";
import { invariant } from "./errors.mjs";
import {
  assertBoundedString,
  assertCanonicalToken,
  assertExactObjectKeys,
  assertHexNonce256,
  assertHexRoot,
  assertSafeNonNegativeInteger,
} from "./schema.mjs";

export function exportNonceCommitment({ exportNonce, contractRoot, jobId }) {
  assertHexNonce256(exportNonce, "raw export nonce");
  assertHexRoot(contractRoot, "export nonce contract root");
  assertCanonicalToken(jobId, "export nonce job ID", 256);
  return hash("NEXUS_EXPORT_NONCE_COMMITMENT_V2", {
    contract_root: contractRoot,
    export_nonce: exportNonce,
    job_id: jobId,
  });
}

export function publicExportScopeRoot({
  jobId,
  contractRoot,
  terminalEventId,
  terminalReceiptId,
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
}) {
  assertBoundedString(jobId, "public export scope job ID");
  assertBoundedString(contractRoot, "public export scope contract root");
  assertBoundedString(terminalEventId, "public export scope terminal event ID");
  assertBoundedString(
    terminalReceiptId,
    "public export scope terminal receipt ID",
  );
  assertHexRoot(contentPublicValuesRoot, "content public-values root");
  assertHexRoot(contentProofDescriptorsRoot, "content proof-descriptors root");
  return hash("NEXUS_PUBLIC_EXPORT_SCOPE_V1", {
    schema: "nexus-public-export-scope-v1",
    job_id: jobId,
    contract_root: contractRoot,
    terminal_event_id: terminalEventId,
    terminal_receipt_id: terminalReceiptId,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
  });
}

export function nonceOneUseAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "schema",
      "purpose",
      "scope_root",
      "nonce_commitment",
      "minimum_entropy_bits",
    ],
    [],
    "nonce one-use authority",
  );
  invariant(
    authority.schema === "nexus-nonce-one-use-v1" &&
      authority.purpose === "PUBLIC_EXPORT",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported nonce one-use authority",
  );
  assertHexRoot(authority.scope_root, "nonce one-use scope root");
  assertHexRoot(authority.nonce_commitment, "nonce commitment");
  assertSafeNonNegativeInteger(
    authority.minimum_entropy_bits,
    "nonce minimum entropy bits",
  );
  invariant(
    authority.minimum_entropy_bits === 256,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "public export nonce authority requires exactly 256 entropy bits",
  );
  return hash("NEXUS_NONCE_ONE_USE_V1", authority);
}

export function entropyFreshnessAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "schema",
      "purpose",
      "scope_root",
      "nonce_commitment",
      "minimum_entropy_bits",
      "entropy_evidence_root",
      "freshness_evidence_root",
      "one_use_commitment",
    ],
    [],
    "entropy freshness authority",
  );
  invariant(
    authority.schema === "nexus-entropy-freshness-authority-v1" &&
      authority.purpose === "PUBLIC_EXPORT",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported entropy freshness authority",
  );
  assertSafeNonNegativeInteger(
    authority.minimum_entropy_bits,
    "entropy freshness minimum bits",
  );
  invariant(
    authority.minimum_entropy_bits === 256,
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "entropy freshness authority requires exactly 256 entropy bits",
  );
  for (const [label, root] of Object.entries({
    scope_root: authority.scope_root,
    nonce_commitment: authority.nonce_commitment,
    entropy_evidence_root: authority.entropy_evidence_root,
    freshness_evidence_root: authority.freshness_evidence_root,
    one_use_commitment: authority.one_use_commitment,
  })) {
    assertHexRoot(root, label);
  }
  return hash("NEXUS_ENTROPY_FRESHNESS_AUTHORITY_V1", authority);
}

export function entropyOneUseClaimRoot(claim) {
  assertExactObjectKeys(
    claim,
    [
      "schema",
      "authority_id",
      "authority_root",
      "purpose",
      "scope_root",
      "nonce_commitment",
      "use_scope_root",
    ],
    [],
    "entropy one-use claim",
  );
  invariant(
    claim.schema === "nexus-entropy-one-use-claim-v1" &&
      claim.purpose === "PUBLIC_EXPORT",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported entropy one-use claim",
  );
  assertBoundedString(claim.authority_id, "entropy authority ID");
  for (const [label, root] of Object.entries(claim)) {
    if (label.endsWith("_root") || label === "nonce_commitment") {
      assertHexRoot(root, label);
    }
  }
  return hash("NEXUS_ENTROPY_ONE_USE_CLAIM_V1", claim);
}

export function entropyOneUseConsumptionRoot(consumption) {
  assertExactObjectKeys(
    consumption,
    [
      "schema",
      "consumption_id",
      "authority_id",
      "authority_root",
      "purpose",
      "scope_root",
      "nonce_commitment",
      "use_scope_root",
      "use_claim_root",
      "consuming_event_id",
      "previous_application_state_root",
    ],
    [],
    "entropy one-use consumption",
  );
  invariant(
    consumption.schema === "nexus-entropy-one-use-consumption-v1" &&
      consumption.purpose === "PUBLIC_EXPORT",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported entropy one-use consumption",
  );
  for (const field of [
    "consumption_id",
    "authority_id",
    "consuming_event_id",
  ]) {
    assertBoundedString(consumption[field], field);
  }
  for (const [label, root] of Object.entries(consumption)) {
    if (
      label.endsWith("_root") ||
      label === "nonce_commitment" ||
      label === "previous_application_state_root"
    ) {
      assertHexRoot(root, label);
    }
  }
  return hash("NEXUS_ENTROPY_ONE_USE_CONSUMPTION_V1", consumption);
}

export function publicationApprovalContextRoot(context) {
  assertExactObjectKeys(
    context,
    [
      "schema",
      "job_id",
      "contract_root",
      "terminal_receipt_id",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "disclosure_policy_root",
      "secret_scan_policy_root",
      "secret_scan_receipt_root",
      "secret_scan_result",
      "approval_policy_root",
      "approval_authority_root",
      "human_approval_receipt_root",
      "human_approval_decision",
    ],
    [],
    "publication approval context",
  );
  invariant(
    context.schema === "nexus-publication-approval-context-v1",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported publication approval context",
  );
  assertBoundedString(
    context.terminal_receipt_id,
    "publication approval terminal receipt ID",
  );
  invariant(
    context.secret_scan_result === "PASS",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "publication approval context requires a passing secret scan",
  );
  invariant(
    context.human_approval_decision === "APPROVED",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "publication approval context requires explicit human approval",
  );
  for (const [label, root] of Object.entries(context)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return hash("NEXUS_PUBLICATION_APPROVAL_CONTEXT_V1", context);
}

export function publicExportAuthorityRoot(authority) {
  assertExactObjectKeys(
    authority,
    [
      "schema",
      "job_id",
      "contract_root",
      "terminal_receipt_id",
      "disclosure_policy_root",
      "public_job_summary_root",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "export_nonce_commitment",
      "entropy_freshness_authority_root",
      "secret_scan_policy_root",
      "publication_approval_context_root",
      "disclosure_proof_context_root",
    ],
    [],
    "public export authority",
  );
  invariant(
    authority.schema === "nexus-public-export-authority-v1",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported public export authority schema",
  );
  for (const [label, root] of Object.entries({
    disclosure_policy_root: authority.disclosure_policy_root,
    public_job_summary_root: authority.public_job_summary_root,
    content_public_values_root: authority.content_public_values_root,
    content_proof_descriptors_root:
      authority.content_proof_descriptors_root,
    export_nonce_commitment: authority.export_nonce_commitment,
    entropy_freshness_authority_root:
      authority.entropy_freshness_authority_root,
    secret_scan_policy_root: authority.secret_scan_policy_root,
    publication_approval_context_root:
      authority.publication_approval_context_root,
    disclosure_proof_context_root: authority.disclosure_proof_context_root,
  })) {
    assertHexRoot(root, label);
  }
  return hash("NEXUS_PUBLIC_EXPORT_AUTHORITY_V1", authority);
}

export function publicExportStageRoots({
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
  approvalContext,
  publicExportAuthorityRoot: authorityRoot,
}) {
  assertHexRoot(contentPublicValuesRoot, "content public-values root");
  assertHexRoot(
    contentProofDescriptorsRoot,
    "content proof-descriptors root",
  );
  assertHexRoot(authorityRoot, "public export authority root");
  const approvalContextRoot = publicationApprovalContextRoot(approvalContext);
  const scanRoot = hash("NEXUS_PUBLIC_EXPORT_SCAN_V1", {
    schema: "nexus-public-export-scan-v1",
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    disclosure_policy_root: approvalContext.disclosure_policy_root,
    secret_scan_policy_root: approvalContext.secret_scan_policy_root,
    secret_scan_receipt_root: approvalContext.secret_scan_receipt_root,
    secret_scan_result: approvalContext.secret_scan_result,
    public_export_authority_root: authorityRoot,
  });
  const approvalRoot = hash("NEXUS_PUBLIC_EXPORT_APPROVAL_V1", {
    schema: "nexus-public-export-approval-v1",
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_root: scanRoot,
    approval_context_root: approvalContextRoot,
    approval_policy_root: approvalContext.approval_policy_root,
    approval_authority_root: approvalContext.approval_authority_root,
    human_approval_receipt_root:
      approvalContext.human_approval_receipt_root,
    human_approval_decision: approvalContext.human_approval_decision,
    public_export_authority_root: authorityRoot,
  });
  const finalPrivacyManifestRoot = hash("NEXUS_DISCLOSURE_MANIFEST_V2", {
    schema: "nexus-final-privacy-manifest-v2",
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_root: scanRoot,
    approval_root: approvalRoot,
    disclosure_policy_root: approvalContext.disclosure_policy_root,
    public_export_authority_root: authorityRoot,
  });
  return { scanRoot, approvalRoot, finalPrivacyManifestRoot };
}

export function disclosureCompilationRoot({
  contentPublicValuesRoot,
  contentProofDescriptorsRoot,
  scanRoot,
  approvalRoot,
  manifestRoot,
}) {
  for (const [label, root] of Object.entries({
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_root: scanRoot,
    approval_root: approvalRoot,
    manifest_root: manifestRoot,
  })) {
    assertHexRoot(root, label);
  }
  return hash("NEXUS_DISCLOSURE_COMPILATION_V1", {
    schema: "nexus-disclosure-compilation-v1",
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
    scan_root: scanRoot,
    approval_root: approvalRoot,
    manifest_root: manifestRoot,
  });
}

export function acceptedDisclosureCompilationAnchorRoot(anchor) {
  assertExactObjectKeys(
    anchor,
    [
      "schema",
      "compilation_root",
      "export_authority_root",
      "manifest_root",
      "publication_approval_context_root",
      "disclosure_proof_context_root",
    ],
    [],
    "accepted disclosure compilation anchor",
  );
  invariant(
    anchor.schema === "nexus-accepted-disclosure-compilation-anchor-v1",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported accepted disclosure compilation anchor",
  );
  for (const [label, root] of Object.entries(anchor)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return hash(
    "NEXUS_ACCEPTED_DISCLOSURE_COMPILATION_ANCHOR_V1",
    anchor,
  );
}

export function publicationIntentId(identity) {
  assertExactObjectKeys(
    identity,
    [
      "schema",
      "job_id",
      "terminal_event_id",
      "terminal_receipt_id",
      "capsule_root",
      "disclosure_manifest_root",
      "content_public_values_root",
      "content_proof_descriptors_root",
      "scan_root",
      "approval_root",
      "export_authority_root",
      "nonce_authority_root",
      "accepted_compilation_anchor_root",
      "compilation_root",
      "non_claims_root",
      "source_document_root",
      "destination_policy",
      "nonce",
    ],
    [],
    "publication intent identity",
  );
  invariant(
    identity.schema === "nexus-publication-intent-v2",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported publication intent identity",
  );
  for (const [label, root] of Object.entries(identity)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return rootId("PUBINTENT", "NEXUS_PUBLICATION_INTENT_V2", identity);
}

export function acceptedPublicationAnchorRoot(anchor) {
  assertExactObjectKeys(
    anchor,
    [
      "schema",
      "publication_intent_id",
      "capsule_root",
      "disclosure_manifest_root",
      "non_claims_root",
      "accepted_compilation_anchor_root",
      "compilation_root",
      "export_authority_root",
      "policy_root",
      "verifier_root",
      "source_document_root",
    ],
    [],
    "accepted publication anchor",
  );
  invariant(
    anchor.schema === "nexus-accepted-publication-anchor-v1",
    "ERR_DISCLOSURE_UNCLASSIFIED",
    "unsupported accepted publication anchor",
  );
  assertBoundedString(
    anchor.publication_intent_id,
    "accepted publication intent ID",
  );
  for (const [label, root] of Object.entries(anchor)) {
    if (label.endsWith("_root")) assertHexRoot(root, label);
  }
  return hash("NEXUS_ACCEPTED_PUBLICATION_ANCHOR_V1", anchor);
}

export function publicationUseScopeRoot(publicationAnchor) {
  const publicationAnchorRoot =
    acceptedPublicationAnchorRoot(publicationAnchor);
  return hash("NEXUS_PUBLICATION_USE_SCOPE_V1", {
    schema: "nexus-publication-use-scope-v1",
    accepted_publication_anchor_root: publicationAnchorRoot,
  });
}
