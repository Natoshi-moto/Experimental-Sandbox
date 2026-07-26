import { assertCanonicalValue, canonicalize } from "../core/canonical.mjs";
import {
  disclosureCompilationAnchorV2Root,
  nonClaimsRoot,
  publicCapsuleRoot,
  publicSafeDisclosureManifestRoot,
} from "../core/carriers.mjs";
import { invariant } from "../core/errors.mjs";
import { resolveAcceptedCoreRecord } from "../privacy/authority.mjs";

export const CAPSULE_SOURCE_FIELDS = Object.freeze([
  "capsule_content_root",
]);

export const COMPILATION_ANCHOR_KEYS = Object.freeze([
  "anchor_id",
  "approval_receipt_id",
  "approval_receipt_root",
  "compilation_root",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "disclosure_policy_root",
  "disclosure_proof_context_root",
  "export_authority_id",
  "export_authority_root",
  "preparation_id",
  "preparation_record_root",
  "preparation_root",
  "scan_receipt_id",
  "scan_receipt_root",
  "schema",
]);

export const PUBLIC_CAPSULE_KEYS = Object.freeze([
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "capsule_content_root",
  "compilation_root",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "job_id",
  "public_capsule_id",
  "schema",
]);

const REFERENCE_KEYS = Object.freeze([
  "non_claims_id",
  "non_claims_root",
  "public_capsule_id",
  "public_capsule_root",
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

export function validateDiversityLabels(labels) {
  invariant(
    Array.isArray(labels) &&
      labels.every(
        (label, index) =>
          typeof label === "string" &&
          label.length > 0 &&
          (index === 0 || labels[index - 1] < label),
      ),
    "ERR_NON_CANONICAL",
    "diversity labels must be sorted unique strings",
  );
  return labels;
}

export function validateRepositoryWitness(witness) {
  invariant(
    witness !== null &&
      typeof witness === "object" &&
      witness.schema === "nexus-public-repository-witness-v1" &&
      typeof witness.repository === "string" &&
      /^[a-f0-9]{40}$/.test(witness.base_commit) &&
      /^[a-f0-9]{40}$/.test(witness.worker_head) &&
      Array.isArray(witness.paths),
    "ERR_SCHEMA",
    "invalid public repository witness",
  );
  return witness;
}

export function validatePublicCapsuleShape(capsule) {
  assertCanonicalValue(capsule);
  exactKeys(capsule, PUBLIC_CAPSULE_KEYS, "accepted public capsule");
  return publicCapsuleRoot(capsule);
}

export function resolveCompilationAnchor(
  resolver,
  anchorId,
  anchorRoot,
  expected = null,
) {
  const envelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_COMPILATION_ANCHOR",
    record_id: anchorId,
    record_root: anchorRoot,
  });
  exactKeys(
    envelope.record,
    COMPILATION_ANCHOR_KEYS,
    "accepted disclosure compilation anchor",
  );
  invariant(
    disclosureCompilationAnchorV2Root(envelope.record) === anchorRoot &&
      (expected === null ||
        canonicalize(envelope.record) === canonicalize(expected)),
    "ERR_VERIFIER_MUTATION",
    "accepted compilation anchor content mismatch",
  );
  return envelope;
}

export function createPublicCapsule(references, { resolver }) {
  assertCanonicalValue(references);
  exactKeys(references, REFERENCE_KEYS, "accepted public capsule references");
  const capsuleEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "PUBLIC_CAPSULE",
    record_id: references.public_capsule_id,
    record_root: references.public_capsule_root,
  });
  const capsule = capsuleEnvelope.record;
  invariant(
    validatePublicCapsuleShape(capsule) === references.public_capsule_root,
    "ERR_VERIFIER_MUTATION",
    "accepted public capsule root mismatch",
  );
  const anchorEnvelope = resolveCompilationAnchor(
    resolver,
    capsule.accepted_compilation_anchor_id,
    capsule.accepted_compilation_anchor_root,
  );
  const manifestEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "DISCLOSURE_MANIFEST",
    record_id: capsule.disclosure_manifest_id,
    record_root: capsule.disclosure_manifest_root,
  });
  const nonClaimsEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "NON_CLAIMS",
    record_id: references.non_claims_id,
    record_root: references.non_claims_root,
  });
  invariant(
    publicSafeDisclosureManifestRoot(manifestEnvelope.record) ===
        capsule.disclosure_manifest_root &&
      nonClaimsRoot(nonClaimsEnvelope.record) === references.non_claims_root &&
      anchorEnvelope.record.compilation_root === capsule.compilation_root &&
      anchorEnvelope.record.disclosure_manifest_id ===
        capsule.disclosure_manifest_id &&
      nonClaimsEnvelope.record.accepted_compilation_anchor_id ===
        capsule.accepted_compilation_anchor_id &&
      nonClaimsEnvelope.record.accepted_compilation_anchor_root ===
        capsule.accepted_compilation_anchor_root &&
      nonClaimsEnvelope.record.compilation_root === capsule.compilation_root,
    "ERR_VERIFIER_MUTATION",
    "capsule, compilation, manifest, and non-claims disagree",
  );
  return immutable({
    schema: "nexus-accepted-public-capsule-bundle-v1",
    accepted_application_state_root:
      capsuleEnvelope.accepted_application_state_root,
    public_capsule_id: references.public_capsule_id,
    public_capsule_root: references.public_capsule_root,
    capsule,
    accepted_compilation_anchor: anchorEnvelope.record,
    disclosure_manifest: manifestEnvelope.record,
    non_claims: nonClaimsEnvelope.record,
    non_claims_id: references.non_claims_id,
    non_claims_root: references.non_claims_root,
  });
}
