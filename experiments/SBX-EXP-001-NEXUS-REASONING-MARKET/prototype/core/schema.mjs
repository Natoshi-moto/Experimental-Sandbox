import { canonicalBytes, assertCanonicalValue } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

export const MAX_EVENT_PAYLOAD_BYTES = 262144;
export const MAX_EVENT_BYTES = 393216;
export const MAX_PROTOCOL_STRING_BYTES = 8192;
export const MAX_PROTOCOL_ARRAY_ITEMS = 128;

export function assertPlainObject(value, label = "value") {
  invariant(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
    "ERR_SCHEMA",
    `${label} must be a plain object`,
  );
  return value;
}

export function assertExactObjectKeys(
  value,
  required,
  optional = [],
  label = "value",
) {
  assertPlainObject(value, label);
  const allowed = new Set([...required, ...optional]);
  const observed = Object.keys(value);
  invariant(
    required.every((key) => Object.hasOwn(value, key)) &&
      observed.every((key) => allowed.has(key)),
    "ERR_SCHEMA",
    `${label} has missing or unknown fields`,
    {
      required: [...required].sort(),
      optional: [...optional].sort(),
      observed: observed.sort(),
    },
  );
  return value;
}

export function assertBoundedString(
  value,
  label,
  { minBytes = 1, maxBytes = MAX_PROTOCOL_STRING_BYTES, pattern = null } = {},
) {
  invariant(typeof value === "string", "ERR_SCHEMA", `${label} must be a string`);
  const bytes = Buffer.byteLength(value, "utf8");
  invariant(
    bytes >= minBytes && bytes <= maxBytes,
    "ERR_SIZE_LIMIT",
    `${label} is outside its byte limit`,
  );
  if (pattern !== null) {
    invariant(pattern.test(value), "ERR_SCHEMA", `${label} has invalid syntax`);
  }
  assertCanonicalValue(value);
  return value;
}

export function assertBoundedArray(
  value,
  label,
  { minItems = 0, maxItems = MAX_PROTOCOL_ARRAY_ITEMS } = {},
) {
  invariant(Array.isArray(value), "ERR_SCHEMA", `${label} must be an array`);
  invariant(
    value.length >= minItems && value.length <= maxItems,
    "ERR_SIZE_LIMIT",
    `${label} is outside its item limit`,
  );
  return value;
}

export function assertBoundedCanonical(
  value,
  label,
  maxBytes = MAX_EVENT_PAYLOAD_BYTES,
) {
  assertCanonicalValue(value);
  invariant(
    canonicalBytes(value).length <= maxBytes,
    "ERR_SIZE_LIMIT",
    `${label} exceeds ${maxBytes} canonical bytes`,
  );
  return value;
}

export function assertCanonicalToken(value, label, maxBytes = 128) {
  return assertBoundedString(value, label, {
    minBytes: 1,
    maxBytes,
    pattern: /^[\x21-\x7e]+$/,
  });
}

export function assertHexRoot(value, label) {
  return assertBoundedString(value, label, {
    minBytes: 64,
    maxBytes: 64,
    pattern: /^[0-9a-f]{64}$/,
  });
}

export function assertHexNonce128(value, label) {
  assertBoundedString(value, label, {
    minBytes: 32,
    maxBytes: 128,
    pattern: /^[0-9a-f]+$/,
  });
  invariant(
    value.length % 2 === 0,
    "ERR_SCHEMA",
    `${label} must contain complete bytes`,
  );
  return value;
}

export function assertHexNonce256(value, label) {
  return assertBoundedString(value, label, {
    minBytes: 64,
    maxBytes: 64,
    pattern: /^[0-9a-f]{64}$/,
  });
}

export function assertSafeNonNegativeInteger(
  value,
  label,
  { positive = false } = {},
) {
  invariant(
    Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
    "ERR_UNSAFE_INTEGER",
    `${label} must be a non-negative safe integer`,
  );
  if (positive) {
    invariant(value > 0, "ERR_UNSAFE_INTEGER", `${label} must be positive`);
  }
  return value;
}

export function assertSortedUniqueStrings(
  value,
  label,
  { minItems = 0, maxItems = MAX_PROTOCOL_ARRAY_ITEMS } = {},
) {
  assertBoundedArray(value, label, { minItems, maxItems });
  for (const [index, item] of value.entries()) {
    assertBoundedString(item, `${label}[${index}]`);
  }
  const sorted = [...value].sort();
  invariant(
    new Set(value).size === value.length &&
      value.every((item, index) => item === sorted[index]),
    "ERR_NON_CANONICAL",
    `${label} must be a canonical sorted set`,
  );
  return value;
}
