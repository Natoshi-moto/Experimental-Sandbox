import { assertCanonicalValue, canonicalize } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import {
  publicationIntentNonceScopeRoot as coreNonceScopeRoot,
  publicationIntentV3Id,
} from "../core/privacy-nexus.mjs";
import {
  assertRoot,
  resolveAcceptedCoreRecord,
} from "../privacy/authority.mjs";

const BODY_KEYS = Object.freeze([
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

function validateIntent(intent) {
  assertCanonicalValue(intent);
  exactKeys(intent, ["intent_id", ...BODY_KEYS], "publication intent v3");
  const { intent_id: intentId, ...body } = intent;
  invariant(
    body.schema === "nexus-publication-intent-v3" &&
      body.destination_policy === "GITHUB_SANITIZED_WITNESS" &&
      publicationIntentV3Id(body) === intentId,
    "ERR_VERIFIER_MUTATION",
    "publication intent is not the canonical fixed-destination V3 record",
  );
  return body;
}

export function publicationIntentNonceScopeRoot(intent) {
  const body = validateIntent(intent);
  return coreNonceScopeRoot({
    schema: "nexus-publication-intent-nonce-scope-v3",
    accepted_compilation_anchor_root:
      body.accepted_compilation_anchor_root,
    capsule_root: body.public_capsule_root,
    destination_policy: body.destination_policy,
    disclosure_manifest_root: body.disclosure_manifest_root,
    job_id: body.job_id,
    non_claims_root: body.non_claims_root,
    publication_principal_id: body.publication_principal_id,
    terminal_event_id: body.terminal_event_id,
    terminal_receipt_id: body.terminal_receipt_id,
  });
}

export function publicationIntentRoot(intent) {
  validateIntent(intent);
  return intent.intent_id.slice("PUBINTENT-".length);
}

export function createPublicationIntent(
  references,
  { resolver },
) {
  assertCanonicalValue(references);
  exactKeys(
    references,
    ["publication_intent_id", "publication_intent_root"],
    "accepted publication intent references",
  );
  const {
    publication_intent_id: intentId,
    publication_intent_root: intentRoot,
  } = references;
  const envelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "PUBLICATION_INTENT",
    record_id: intentId,
    record_root: intentRoot,
  });
  invariant(
    publicationIntentRoot(envelope.record) === intentRoot,
    "ERR_VERIFIER_MUTATION",
    "accepted publication intent root mismatch",
  );
  return immutable(envelope.record);
}

export function verifyPublicationIntent(
  intent,
  {
    accepted_intent_root: acceptedIntentRoot,
    expected = {},
    resolver,
  },
) {
  const body = validateIntent(intent);
  assertRoot(acceptedIntentRoot, "accepted publication intent root");
  const envelope = resolveAcceptedCoreRecord(resolver, {
    record_type: "PUBLICATION_INTENT",
    record_id: intent.intent_id,
    record_root: acceptedIntentRoot,
  });
  invariant(
    canonicalize(envelope.record) === canonicalize(intent) &&
      publicationIntentRoot(intent) === acceptedIntentRoot,
    "ERR_VERIFIER_MUTATION",
    "publication intent differs from canonical accepted state",
  );
  for (const [field, value] of Object.entries(expected)) {
    invariant(
      BODY_KEYS.includes(field) && body[field] === value,
      "ERR_VERIFIER_MUTATION",
      `publication intent ${field} mismatch`,
    );
  }
  const consumption = resolveAcceptedCoreRecord(resolver, {
    record_type: "ENTROPY_ONE_USE_CONSUMPTION",
    record_id: body.nonce_consumption_id,
    record_root: body.nonce_consumption_root,
    allowed_statuses: ["CONSUMED"],
  }).record;
  invariant(
    consumption.authority_id === body.nonce_authority_id &&
      consumption.authority_root === body.nonce_authority_root &&
      consumption.purpose === "PUBLICATION_INTENT",
    "ERR_REPLAY",
    "publication intent nonce consumption belongs to another authority",
  );
  publicationIntentNonceScopeRoot(intent);
  return intent.intent_id;
}
