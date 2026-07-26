import { assertCanonicalValue, canonicalize } from "../core/canonical.mjs";
import {
  nonClaimsRoot,
  publicationAnchorV2Root,
  publicCapsuleRoot,
} from "../core/carriers.mjs";
import { invariant } from "../core/errors.mjs";
import {
  resolveAcceptedCoreRecord,
} from "../privacy/authority.mjs";
import {
  verifyDisclosureCompilation,
  verifyDisclosureManifest,
} from "../privacy/disclosure.mjs";
import { verifyCanonicalNonClaims } from "../privacy/nonclaims.mjs";
import { validatePublicCapsuleShape } from "./capsule.mjs";
import {
  publicationIntentRoot,
  verifyPublicationIntent,
} from "./intent.mjs";

const INPUT_KEYS = Object.freeze([
  "capsule",
  "disclosure",
  "non_claims",
  "publication_anchor_id",
  "publication_anchor_root",
  "publication_intent",
]);
const PUBLICATION_ANCHOR_KEYS = Object.freeze([
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "compilation_root",
  "disclosure_manifest_id",
  "disclosure_manifest_root",
  "export_authority_id",
  "export_authority_root",
  "idempotency_key",
  "logical_tick",
  "non_claims_id",
  "non_claims_root",
  "nonce_consumption_id",
  "nonce_consumption_root",
  "policy_root",
  "public_capsule_id",
  "public_capsule_root",
  "publication_anchor_id",
  "publication_intent_id",
  "publication_intent_root",
  "schema",
  "source_document_root",
  "terminal_receipt_id",
  "verifier_root",
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

function resolvePublicationAnchor(resolver, anchorId, anchorRoot) {
  const envelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "PUBLICATION_ANCHOR",
    record_id: anchorId,
    record_root: anchorRoot,
  });
  exactKeys(
    envelope.record,
    PUBLICATION_ANCHOR_KEYS,
    "accepted publication anchor",
  );
  invariant(
    publicationAnchorV2Root(envelope.record) === anchorRoot &&
      envelope.record.publication_anchor_id === anchorId,
    "ERR_VERIFIER_MUTATION",
    "accepted publication anchor content mismatch",
  );
  return envelope;
}

export function verifyPublicCapsule(input, { resolver }) {
  assertCanonicalValue(input);
  exactKeys(input, INPUT_KEYS, "public capsule verification input");
  const {
    capsule,
    disclosure,
    non_claims: nonClaims,
    publication_anchor_id: publicationAnchorId,
    publication_anchor_root: publicationAnchorRoot,
    publication_intent: publicationIntent,
  } = input;
  const publicationEnvelope = resolvePublicationAnchor(
    resolver,
    publicationAnchorId,
    publicationAnchorRoot,
  );
  const anchor = publicationEnvelope.record;
  verifyDisclosureCompilation(disclosure, {}, { resolver });
  const capsuleEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "PUBLIC_CAPSULE",
    record_id: anchor.public_capsule_id,
    record_root: anchor.public_capsule_root,
  });
  invariant(
    canonicalize(capsuleEnvelope.record) === canonicalize(capsule) &&
      validatePublicCapsuleShape(capsule) === anchor.public_capsule_root,
    "ERR_VERIFIER_MUTATION",
    "public capsule differs from accepted state",
  );
  verifyDisclosureManifest(disclosure.disclosure_manifest, {
    expected_root: anchor.disclosure_manifest_root,
    preparation_id: disclosure.preparation_id,
    preparation_record_root: disclosure.preparation_record_root,
  });
  const nonClaimsEnvelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "NON_CLAIMS",
    record_id: anchor.non_claims_id,
    record_root: anchor.non_claims_root,
  });
  invariant(
    canonicalize(nonClaimsEnvelope.record) === canonicalize(nonClaims) &&
      nonClaimsRoot(nonClaims) === anchor.non_claims_root,
    "ERR_VERIFIER_MUTATION",
    "non-claims differ from accepted state",
  );
  verifyCanonicalNonClaims(nonClaims, {
    expected_root: anchor.non_claims_root,
    accepted_compilation_anchor_id:
      anchor.accepted_compilation_anchor_id,
    accepted_compilation_anchor_root:
      anchor.accepted_compilation_anchor_root,
    compilation_root: anchor.compilation_root,
  });
  verifyPublicationIntent(publicationIntent, {
    accepted_intent_root: anchor.publication_intent_root,
    expected: {
      accepted_compilation_anchor_id:
        anchor.accepted_compilation_anchor_id,
      accepted_compilation_anchor_root:
        anchor.accepted_compilation_anchor_root,
      public_capsule_id: anchor.public_capsule_id,
      public_capsule_root: anchor.public_capsule_root,
      disclosure_manifest_id: anchor.disclosure_manifest_id,
      disclosure_manifest_root: anchor.disclosure_manifest_root,
      non_claims_id: anchor.non_claims_id,
      non_claims_root: anchor.non_claims_root,
      nonce_consumption_id: anchor.nonce_consumption_id,
      nonce_consumption_root: anchor.nonce_consumption_root,
      terminal_receipt_id: anchor.terminal_receipt_id,
    },
    resolver,
  });
  invariant(
    publicationIntent.intent_id === anchor.publication_intent_id &&
      publicationIntentRoot(publicationIntent) ===
        anchor.publication_intent_root &&
      capsule.accepted_compilation_anchor_id ===
        anchor.accepted_compilation_anchor_id &&
      capsule.accepted_compilation_anchor_root ===
        anchor.accepted_compilation_anchor_root &&
      capsule.compilation_root === anchor.compilation_root &&
      capsule.disclosure_manifest_id === anchor.disclosure_manifest_id &&
      capsule.disclosure_manifest_root === anchor.disclosure_manifest_root &&
      disclosure.accepted_compilation_anchor_id ===
        anchor.accepted_compilation_anchor_id &&
      disclosure.accepted_compilation_anchor_root ===
        anchor.accepted_compilation_anchor_root &&
      disclosure.compilation_root === anchor.compilation_root &&
      anchor.source_document_root ===
        anchor.accepted_compilation_anchor_root,
    "ERR_VERIFIER_MUTATION",
    "publication intent, capsule, compilation, and anchor disagree",
  );
  return immutable({
    schema: "nexus-public-capsule-verification-v3",
    accepted_application_state_root:
      publicationEnvelope.accepted_application_state_root,
    public_capsule_id: capsule.public_capsule_id,
    public_capsule_root: publicCapsuleRoot(capsule),
    compilation_root: disclosure.compilation_root,
    disclosure_manifest_id: disclosure.disclosure_manifest_id,
    disclosure_manifest_root: disclosure.disclosure_manifest_root,
    non_claims_id: nonClaims.non_claims_id,
    non_claims_root: anchor.non_claims_root,
    publication_anchor_id: publicationAnchorId,
    publication_anchor_root: publicationAnchorRoot,
    publication_intent_id: publicationIntent.intent_id,
    status_authority: "NONE",
    valid: true,
  });
}
