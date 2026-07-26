import { assertCanonicalValue, canonicalize } from "../core/canonical.mjs";
import {
  acceptedDisclosurePreparationRoot,
  disclosureCompilationAnchorV2Root,
  disclosureCompilationV2Root,
  publicSafeDisclosureManifestRoot,
} from "../core/carriers.mjs";
import { invariant } from "../core/errors.mjs";
import { hash } from "../core/hash.mjs";
import {
  acceptedDisclosurePolicyCarrierRoot,
  acceptedDisclosureProofContextCarrierRoot,
  deriveDisclosurePreparationBindings,
  disclosurePolicyRoot,
  disclosurePreparationAuthorityRoot,
  disclosureProofContextRoot,
  publicExportAuthorityV3Root,
  verifyDisclosurePreparationBindings,
} from "../core/privacy-nexus.mjs";
import {
  assertRoot,
  resolveAcceptedCoreRecord,
} from "./authority.mjs";

export const DISCLOSURE_CLASSES = Object.freeze([
  "PUBLIC",
  "COMMITMENT_ONLY",
  "OMITTED",
  "LOW_ENTROPY_HASH_OMITTED",
]);

export const DISCLOSURE_PROOF_KINDS = Object.freeze([
  "PLAIN_PUBLIC",
  "PUBLIC_PREIMAGE",
  "SALTED_COMMITMENT",
  "OMISSION",
  "DERIVED_PUBLIC_JOB",
  "DERIVED_SECRET_SCAN",
  "DERIVED_PUBLICATION_APPROVAL",
]);

export const PUBLIC_PREIMAGE_PRODUCERS = Object.freeze({
  "nexus-canonical-public-object-v1": "NEXUS_CANONICAL_PUBLIC_OBJECT_V1",
});

const PREPARATION_REFERENCE_KEYS = Object.freeze([
  "preparation_id",
  "preparation_record_root",
]);
const COMPILATION_REFERENCE_KEYS = Object.freeze([
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "preparation_id",
  "preparation_record_root",
]);
const COMPILATION_RECEIPT_KEYS = Object.freeze([
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "approval_receipt_id",
  "approval_receipt_root",
  "compilation_root",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "export_authority_id",
  "export_authority_root",
  "preparation_id",
  "preparation_record_root",
  "preparation_root",
  "scan_receipt_id",
  "scan_receipt_root",
  "schema",
]);
const COMPILATION_KEYS = Object.freeze([
  "accepted_compilation_anchor",
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "compilation_receipt",
  "compilation_receipt_root",
  "compilation_root",
  "disclosure_manifest",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "preparation_id",
  "preparation_record_root",
  "schema",
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

function canonicalEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function acceptedPreparationProjection(record) {
  const {
    preparation: ignoredPreparation,
    verifier_authority: ignoredVerifierAuthority,
    ...projection
  } = record;
  return projection;
}

function entropyAuthorityRecord(envelope, consumptionId, consumptionRoot) {
  exactKeys(
    envelope.record,
    [
      "authority",
      "authority_id",
      "authority_root",
      "binding",
      "consumption_id",
      "consumption_root",
      "status",
    ],
    "accepted entropy authority evidence",
  );
  invariant(
    envelope.record.authority_id === envelope.record_id &&
      envelope.record.authority_root === envelope.record_root &&
      envelope.record.status === envelope.record_status &&
      envelope.record.consumption_id === consumptionId &&
      envelope.record.consumption_root === consumptionRoot,
    "ERR_VERIFIER_MUTATION",
    "accepted entropy authority evidence differs from its envelope",
  );
  return envelope.record;
}

function entropyConsumptionRecord(envelope) {
  return {
    consumption_id: envelope.record_id,
    consumption_root: envelope.record_root,
    consumption: envelope.record,
    status: envelope.record_status,
  };
}

function resolvePreparationReferences(references, resolver) {
  assertCanonicalValue(references);
  exactKeys(
    references,
    PREPARATION_REFERENCE_KEYS,
    "accepted preparation reference",
  );
  const preparationEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_PREPARATION",
    record_id: references.preparation_id,
    record_root: references.preparation_record_root,
  });
  const accepted = preparationEnvelope.record;
  invariant(
    acceptedDisclosurePreparationRoot(
      acceptedPreparationProjection(accepted),
    ) === references.preparation_record_root,
    "ERR_VERIFIER_MUTATION",
    "accepted preparation projection root mismatch",
  );
  const preparation = accepted.preparation;
  const authorityEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_PREPARATION_AUTHORITY",
    record_id: accepted.preparation_authority_id,
    record_root: accepted.preparation_authority_root,
  });
  invariant(
    disclosurePreparationAuthorityRoot(authorityEnvelope.record) ===
      accepted.preparation_authority_root,
    "ERR_VERIFIER_MUTATION",
    "accepted preparation authority content mismatch",
  );
  const policyEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_POLICY",
    record_id: preparation.disclosure_policy_id,
    record_root: preparation.disclosure_policy_record_root,
  });
  const proofEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_PROOF_CONTEXT",
    record_id: preparation.disclosure_proof_context_id,
    record_root: preparation.disclosure_proof_context_record_root,
  });
  invariant(
    acceptedDisclosurePolicyCarrierRoot(policyEnvelope.record) ===
        preparation.disclosure_policy_record_root &&
      acceptedDisclosureProofContextCarrierRoot(proofEnvelope.record) ===
        preparation.disclosure_proof_context_record_root,
    "ERR_VERIFIER_MUTATION",
    "accepted disclosure policy/proof roots mismatch",
  );

  const receipt = preparation.preparation_receipt;
  const entropyAuthorityEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "ENTROPY_FRESHNESS_AUTHORITY",
    record_id: authorityEnvelope.record.entropy_freshness_authority_id,
    record_root: authorityEnvelope.record.entropy_freshness_authority_root,
    allowed_statuses: ["CONSUMED"],
  });
  const entropyConsumptionEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "ENTROPY_ONE_USE_CONSUMPTION",
    record_id: receipt.preparation_entropy_consumption_id,
    record_root: receipt.preparation_entropy_consumption_root,
    allowed_statuses: ["CONSUMED"],
  });
  const entropyAuthority = entropyAuthorityRecord(
    entropyAuthorityEnvelope,
    entropyConsumptionEnvelope.record_id,
    entropyConsumptionEnvelope.record_root,
  );
  const entropyConsumption = entropyConsumptionRecord(
    entropyConsumptionEnvelope,
  );
  const proofs = new Map(
    proofEnvelope.record.proof_context.proofs.map((proof) => [
      proof.path,
      proof,
    ]),
  );
  const saltEntropyUses = receipt.salt_entropy_consumptions.map((reference) => {
    const proof = proofs.get(reference.path);
    invariant(
      proof?.producer === "SALTED_COMMITMENT" &&
        proof.entropy_authority_id !== null &&
        proof.entropy_authority_root !== null,
      "ERR_DISCLOSURE_UNCLASSIFIED",
      `salt consumption ${reference.path} lacks its accepted proof`,
    );
    const saltAuthorityEnvelope = resolveAcceptedCoreRecord(resolver, {
      record_type: "ENTROPY_FRESHNESS_AUTHORITY",
      record_id: proof.entropy_authority_id,
      record_root: proof.entropy_authority_root,
      allowed_statuses: ["CONSUMED"],
    });
    const saltConsumptionEnvelope = resolveAcceptedCoreRecord(resolver, {
      record_type: "ENTROPY_ONE_USE_CONSUMPTION",
      record_id: reference.consumption_id,
      record_root: reference.consumption_root,
      allowed_statuses: ["CONSUMED"],
    });
    return {
      path: reference.path,
      authority: entropyAuthorityRecord(
        saltAuthorityEnvelope,
        saltConsumptionEnvelope.record_id,
        saltConsumptionEnvelope.record_root,
      ),
      consumption: entropyConsumptionRecord(saltConsumptionEnvelope),
    };
  });
  return {
    accepted,
    authority: authorityEnvelope.record,
    entropyAuthority,
    entropyConsumption,
    policyCarrier: policyEnvelope.record,
    preparation,
    preparationEnvelope,
    proofCarrier: proofEnvelope.record,
    saltEntropyUses,
  };
}

export function computeDisclosurePolicyRoot(policy) {
  return disclosurePolicyRoot(policy);
}

export function computeAcceptedDisclosurePolicyRoot(record) {
  return acceptedDisclosurePolicyCarrierRoot(record);
}

export function computeDisclosureProofContextRoot(proofContext) {
  return disclosureProofContextRoot(proofContext);
}

export function computeAcceptedDisclosureProofContextRoot(record) {
  return acceptedDisclosureProofContextCarrierRoot(record);
}

export function computeDisclosurePreparationAuthorityRoot(authority) {
  return disclosurePreparationAuthorityRoot(authority);
}

export function computePublicExportAuthorityRoot(authority) {
  return publicExportAuthorityV3Root(authority);
}

export function computePublicJobSummaryRoot({
  preparation_root: preparationRoot,
  content_public_values_root: contentPublicValuesRoot,
  content_proof_descriptors_root: contentProofDescriptorsRoot,
}) {
  return hash("NEXUS_PUBLIC_JOB_SUMMARY_V3", {
    schema: "nexus-public-job-summary-v3",
    preparation_root: preparationRoot,
    content_public_values_root: contentPublicValuesRoot,
    content_proof_descriptors_root: contentProofDescriptorsRoot,
  });
}

export function prepareDisclosureContent(references, { resolver }) {
  const resolved = resolvePreparationReferences(references, resolver);
  const preparation = verifyDisclosurePreparationBindings({
    preparation: resolved.preparation,
    policy_carrier: resolved.policyCarrier,
    proof_context_carrier: resolved.proofCarrier,
    preparation_authority: resolved.authority,
    entropy_authority: resolved.entropyAuthority,
    entropy_consumption: resolved.entropyConsumption,
    salt_entropy_uses: resolved.saltEntropyUses,
  });
  const derived = deriveDisclosurePreparationBindings({
    policy_carrier: resolved.policyCarrier,
    proof_context_carrier: resolved.proofCarrier,
    preparation_authority: resolved.authority,
    entropy_authority: resolved.entropyAuthority,
    entropy_consumption: resolved.entropyConsumption,
    salt_entropy_uses: resolved.saltEntropyUses,
  });
  invariant(
    canonicalEqual(preparation, derived),
    "ERR_VERIFIER_MUTATION",
    "shared preparation derivation and verification disagree",
  );
  return immutable({
    schema: "nexus-accepted-disclosure-preparation-verification-v1",
    accepted_application_state_root:
      resolved.preparationEnvelope.accepted_application_state_root,
    preparation_id: references.preparation_id,
    preparation_record_root: references.preparation_record_root,
    execution_receipt_id: resolved.accepted.execution_receipt_id,
    execution_receipt_root: resolved.accepted.execution_receipt_root,
    verifier_authority_root: resolved.accepted.verifier_authority_root,
    preparation,
  });
}

export function verifyDisclosurePreparation(
  preparation,
  references,
  { resolver },
) {
  assertCanonicalValue(preparation);
  const verified = prepareDisclosureContent(references, { resolver });
  invariant(
    canonicalEqual(preparation, verified.preparation),
    "ERR_VERIFIER_MUTATION",
    "preparation differs from the accepted shared-verifier result",
  );
  return verified.preparation.preparation_root;
}

export function verifyDisclosureManifest(
  manifest,
  {
    expected_root: expectedRoot,
    preparation_id: preparationId,
    preparation_record_root: preparationRecordRoot,
  },
) {
  assertCanonicalValue(manifest);
  assertRoot(expectedRoot, "accepted disclosure manifest root");
  invariant(
    publicSafeDisclosureManifestRoot(manifest) === expectedRoot &&
      manifest.preparation_id === preparationId &&
      manifest.preparation_record_root === preparationRecordRoot,
    "ERR_VERIFIER_MUTATION",
    "public-safe disclosure manifest differs from accepted preparation",
  );
  return expectedRoot;
}

export function finalizeDisclosure(references, { resolver }) {
  assertCanonicalValue(references);
  exactKeys(
    references,
    COMPILATION_REFERENCE_KEYS,
    "accepted disclosure compilation references",
  );
  const preparation = prepareDisclosureContent(
    {
      preparation_id: references.preparation_id,
      preparation_record_root: references.preparation_record_root,
    },
    { resolver },
  );
  const manifestEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_MANIFEST",
    record_id: references.disclosure_manifest_id,
    record_root: references.disclosure_manifest_root,
  });
  verifyDisclosureManifest(manifestEnvelope.record, {
    expected_root: references.disclosure_manifest_root,
    preparation_id: references.preparation_id,
    preparation_record_root: references.preparation_record_root,
  });
  const anchorEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_COMPILATION_ANCHOR",
    record_id: references.accepted_compilation_anchor_id,
    record_root: references.accepted_compilation_anchor_root,
  });
  const anchor = anchorEnvelope.record;
  invariant(
    disclosureCompilationAnchorV2Root(anchor) ===
        references.accepted_compilation_anchor_root &&
      anchor.preparation_id === references.preparation_id &&
      anchor.preparation_record_root === references.preparation_record_root &&
      anchor.disclosure_manifest_id === references.disclosure_manifest_id &&
      anchor.disclosure_manifest_root === references.disclosure_manifest_root,
    "ERR_VERIFIER_MUTATION",
    "accepted compilation anchor differs from accepted preparation/manifest",
  );
  const compilationRoot = disclosureCompilationV2Root({
    preparationRoot: anchor.preparation_root,
    scanReceiptRoot: anchor.scan_receipt_root,
    approvalReceiptRoot: anchor.approval_receipt_root,
    manifestRoot: anchor.disclosure_manifest_root,
    exportAuthorityRoot: anchor.export_authority_root,
  });
  invariant(
    anchor.compilation_root === compilationRoot,
    "ERR_VERIFIER_MUTATION",
    "accepted compilation root is not its full provenance digest",
  );
  const compilationReceipt = {
    schema: "nexus-disclosure-compilation-receipt-v4",
    preparation_id: anchor.preparation_id,
    preparation_record_root: anchor.preparation_record_root,
    preparation_root: anchor.preparation_root,
    disclosure_manifest_id: anchor.disclosure_manifest_id,
    disclosure_manifest_root: anchor.disclosure_manifest_root,
    scan_receipt_id: anchor.scan_receipt_id,
    scan_receipt_root: anchor.scan_receipt_root,
    approval_receipt_id: anchor.approval_receipt_id,
    approval_receipt_root: anchor.approval_receipt_root,
    export_authority_id: anchor.export_authority_id,
    export_authority_root: anchor.export_authority_root,
    accepted_compilation_anchor_id: anchor.anchor_id,
    accepted_compilation_anchor_root: anchorEnvelope.record_root,
    compilation_root: compilationRoot,
  };
  exactKeys(
    compilationReceipt,
    COMPILATION_RECEIPT_KEYS,
    "disclosure compilation receipt",
  );
  return immutable({
    schema: "nexus-disclosure-compilation-verification-v4",
    preparation_id: references.preparation_id,
    preparation_record_root: references.preparation_record_root,
    disclosure_manifest_id: references.disclosure_manifest_id,
    disclosure_manifest_root: references.disclosure_manifest_root,
    accepted_compilation_anchor_id:
      references.accepted_compilation_anchor_id,
    accepted_compilation_anchor_root:
      references.accepted_compilation_anchor_root,
    compilation_root: compilationRoot,
    compilation_receipt: compilationReceipt,
    compilation_receipt_root: hash(
      "NEXUS_DISCLOSURE_COMPILATION_RECEIPT_V4",
      compilationReceipt,
    ),
    disclosure_manifest: manifestEnvelope.record,
    accepted_compilation_anchor: anchor,
  });
}

export function verifyDisclosureCompilation(
  compilation,
  _context,
  { resolver },
) {
  assertCanonicalValue(compilation);
  exactKeys(
    compilation,
    COMPILATION_KEYS,
    "disclosure compilation verification",
  );
  invariant(
    compilation.schema ===
      "nexus-disclosure-compilation-verification-v4",
    "ERR_SCHEMA",
    "unsupported disclosure compilation verification schema",
  );
  const expected = finalizeDisclosure(
    {
      preparation_id: compilation.preparation_id,
      preparation_record_root: compilation.preparation_record_root,
      disclosure_manifest_id: compilation.disclosure_manifest_id,
      disclosure_manifest_root: compilation.disclosure_manifest_root,
      accepted_compilation_anchor_id:
        compilation.accepted_compilation_anchor_id,
      accepted_compilation_anchor_root:
        compilation.accepted_compilation_anchor_root,
    },
    { resolver },
  );
  invariant(
    canonicalEqual(compilation, expected),
    "ERR_VERIFIER_MUTATION",
    "disclosure compilation differs from canonical accepted records",
  );
  return compilation.compilation_root;
}
