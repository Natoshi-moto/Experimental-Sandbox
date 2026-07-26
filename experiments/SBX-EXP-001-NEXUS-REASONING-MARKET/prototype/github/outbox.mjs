import { canonicalize, assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";

const INTENT_ID = /^PUBINTENT-[a-f0-9]{64}$/;
const STATUSES = Object.freeze([
  "PENDING",
  "PUBLISHED",
  "FAILED_RETRYABLE",
  "FAILED_TERMINAL",
]);
const STATUS_KEYS = Object.freeze([
  "attempt",
  "intent_id",
  "last_reason_code",
  "schema",
  "status",
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

export function assertOperationalOutboxStatus(status) {
  assertCanonicalValue(status);
  exactKeys(status, STATUS_KEYS, "operational outbox status");
  invariant(
    status.schema === "nexus-publication-outbox-v1",
    "ERR_SCHEMA",
    "unsupported operational outbox schema",
  );
  invariant(
    INTENT_ID.test(status.intent_id),
    "ERR_SCHEMA",
    "invalid outbox publication intent ID",
  );
  invariant(
    Number.isSafeInteger(status.attempt) && status.attempt >= 0,
    "ERR_SCHEMA",
    "outbox attempt must be a non-negative safe integer",
  );
  invariant(
    STATUSES.includes(status.status),
    "ERR_SCHEMA",
    "unsupported outbox status",
  );
  invariant(
    status.last_reason_code === null ||
      (typeof status.last_reason_code === "string" &&
        /^ERR_[A-Z0-9_]+$/.test(status.last_reason_code)),
    "ERR_SCHEMA",
    "invalid outbox reason code",
  );
  invariant(
    (status.status === "PENDING" || status.status === "PUBLISHED") ===
      (status.last_reason_code === null),
    "ERR_SCHEMA",
    "outbox reason code does not match status",
  );
  invariant(
    status.status !== "PENDING" || status.attempt === 0,
    "ERR_SCHEMA",
    "pending outbox status must be attempt zero",
  );
  return status;
}

export function createOperationalOutboxStatus(intentId) {
  invariant(
    typeof intentId === "string" && INTENT_ID.test(intentId),
    "ERR_SCHEMA",
    "invalid publication intent ID",
  );
  return immutable({
    schema: "nexus-publication-outbox-v1",
    intent_id: intentId,
    attempt: 0,
    status: "PENDING",
    last_reason_code: null,
  });
}

/**
 * Record a delivery outcome in the operational journal. This API receives no
 * canonical state or reducer capability and returns no canonical effects.
 */
export function recordOperationalAttempt(
  current,
  { status, reason_code: reasonCode },
) {
  assertOperationalOutboxStatus(current);
  invariant(
    current.status === "PENDING" || current.status === "FAILED_RETRYABLE",
    "ERR_GITHUB_RETRYABLE",
    "terminal outbox status cannot be retried",
  );
  invariant(
    ["PUBLISHED", "FAILED_RETRYABLE", "FAILED_TERMINAL"].includes(status),
    "ERR_SCHEMA",
    "invalid delivery outcome",
  );
  invariant(
    (status === "PUBLISHED" && reasonCode === null) ||
      (status !== "PUBLISHED" &&
        typeof reasonCode === "string" &&
        /^ERR_[A-Z0-9_]+$/.test(reasonCode)),
    "ERR_SCHEMA",
    "delivery reason code does not match outcome",
  );
  invariant(
    current.attempt < Number.MAX_SAFE_INTEGER,
    "ERR_UNSAFE_INTEGER",
    "outbox attempt overflow",
  );

  return immutable({
    schema: "nexus-publication-outbox-v1",
    intent_id: current.intent_id,
    attempt: current.attempt + 1,
    status,
    last_reason_code: reasonCode,
  });
}

