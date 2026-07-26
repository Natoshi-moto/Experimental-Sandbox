import { assertCanonicalValue, canonicalize } from "../core/canonical.mjs";
import { derivedCarrierId, nonClaimsRoot } from "../core/carriers.mjs";
import { invariant } from "../core/errors.mjs";

export const CANONICAL_NON_CLAIMS = Object.freeze([
  "No claim of exhaustive disclosure.",
]);

const INPUT_KEYS = Object.freeze([
  "accepted_compilation_anchor_id",
  "accepted_compilation_anchor_root",
  "compilation_root",
  "job_id",
  "statements",
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

export function createCanonicalNonClaims(input) {
  assertCanonicalValue(input);
  exactKeys(input, INPUT_KEYS, "canonical non-claims input");
  const base = {
    schema: "nexus-non-claims-v1",
    ...input,
  };
  const record = {
    ...base,
    non_claims_id: derivedCarrierId("NON_CLAIMS", base),
  };
  return immutable({
    non_claims_id: record.non_claims_id,
    non_claims_root: nonClaimsRoot(record),
    record,
  });
}

export function verifyCanonicalNonClaims(
  record,
  {
    expected_root: expectedRoot,
    accepted_compilation_anchor_id: anchorId,
    accepted_compilation_anchor_root: anchorRoot,
    compilation_root: compilationRoot,
  },
) {
  assertCanonicalValue(record);
  invariant(
    nonClaimsRoot(record) === expectedRoot &&
      record.accepted_compilation_anchor_id === anchorId &&
      record.accepted_compilation_anchor_root === anchorRoot &&
      record.compilation_root === compilationRoot,
    "ERR_VERIFIER_MUTATION",
    "non-claims differ from accepted compilation",
  );
  return expectedRoot;
}
