import { invariant, fail } from "./errors.mjs";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const MIN_SAFE = Number.MIN_SAFE_INTEGER;
const PROTOCOL_KEY = /^[\x20-\x7e]+$/;

function assertUnicode(value, label) {
  invariant(
    value.normalize("NFC") === value,
    "ERR_NON_CANONICAL",
    `${label} is not Unicode NFC`,
  );
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      invariant(
        next >= 0xdc00 && next <= 0xdfff,
        "ERR_INVALID_UNICODE",
        `${label} contains a lone high surrogate`,
      );
      index += 1;
    } else {
      invariant(
        code < 0xdc00 || code > 0xdfff,
        "ERR_INVALID_UNICODE",
        `${label} contains a lone low surrogate`,
      );
    }
  }
}

function encode(value, seen, path) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    assertUnicode(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    invariant(
      Number.isSafeInteger(value),
      "ERR_UNSAFE_INTEGER",
      `${path} must be a safe integer`,
    );
    invariant(
      !Object.is(value, -0),
      "ERR_NON_CANONICAL",
      `${path} cannot be negative zero`,
    );
    invariant(
      value >= MIN_SAFE && value <= MAX_SAFE,
      "ERR_UNSAFE_INTEGER",
      `${path} is outside the safe integer range`,
    );
    return String(value);
  }
  invariant(
    typeof value !== "undefined",
    "ERR_NON_CANONICAL",
    `${path} cannot be undefined`,
  );
  invariant(
    typeof value !== "bigint" &&
      typeof value !== "function" &&
      typeof value !== "symbol",
    "ERR_NON_CANONICAL",
    `${path} has an unsupported value type`,
  );
  invariant(
    typeof value === "object",
    "ERR_NON_CANONICAL",
    `${path} has an unsupported primitive`,
  );
  invariant(!seen.has(value), "ERR_NON_CANONICAL", `${path} contains a cycle`);
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      invariant(
        Object.hasOwn(value, index),
        "ERR_NON_CANONICAL",
        `${path} contains an array hole`,
      );
    }
    const encoded = value.map((item, index) =>
      encode(item, seen, `${path}[${index}]`),
    );
    seen.delete(value);
    return `[${encoded.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  invariant(
    prototype === Object.prototype || prototype === null,
    "ERR_NON_CANONICAL",
    `${path} must be a plain object`,
  );

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  for (const key of keys) {
    const descriptor = descriptors[key];
    invariant(
      descriptor.enumerable &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.get === undefined &&
        descriptor.set === undefined,
      "ERR_NON_CANONICAL",
      `${path}.${key} must be an enumerable data property`,
    );
    assertUnicode(key, `${path} key`);
    invariant(
      PROTOCOL_KEY.test(key),
      "ERR_NON_CANONICAL",
      `${path} key is outside printable ASCII`,
    );
  }

  keys.sort();
  const encoded = keys.map(
    (key) =>
      `${JSON.stringify(key)}:${encode(
        descriptors[key].value,
        seen,
        `${path}.${key}`,
      )}`,
  );
  seen.delete(value);
  return `{${encoded.join(",")}}`;
}

export function canonicalize(value) {
  return encode(value, new Set(), "$");
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalize(value), "utf8");
}

export function assertCanonicalValue(value) {
  canonicalize(value);
  return value;
}

class StrictParser {
  constructor(source) {
    invariant(
      typeof source === "string",
      "ERR_SCHEMA",
      "JSON ingress must be a string",
    );
    invariant(
      !source.startsWith("\ufeff"),
      "ERR_NON_CANONICAL",
      "JSON ingress cannot contain a BOM",
    );
    this.source = source;
    this.index = 0;
  }

  parse() {
    this.space();
    const value = this.value();
    this.space();
    invariant(
      this.index === this.source.length,
      "ERR_SCHEMA",
      `unexpected JSON suffix at byte ${this.index}`,
    );
    return value;
  }

  space() {
    while (/[\t\n\r ]/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
  }

  value() {
    const token = this.source[this.index];
    if (token === "{") return this.object();
    if (token === "[") return this.array();
    if (token === '"') return this.string();
    if (token === "t") return this.keyword("true", true);
    if (token === "f") return this.keyword("false", false);
    if (token === "n") return this.keyword("null", null);
    if (token === "-" || /[0-9]/.test(token ?? "")) return this.number();
    fail("ERR_SCHEMA", `unexpected JSON token at byte ${this.index}`);
  }

  keyword(word, value) {
    invariant(
      this.source.slice(this.index, this.index + word.length) === word,
      "ERR_SCHEMA",
      `invalid token at byte ${this.index}`,
    );
    this.index += word.length;
    return value;
  }

  string() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (!escaped && code === 0x22) {
        this.index += 1;
        const raw = this.source.slice(start, this.index);
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          fail("ERR_INVALID_UNICODE", `invalid JSON string at byte ${start}`);
        }
        assertUnicode(value, `JSON string at byte ${start}`);
        return value;
      }
      invariant(
        escaped || code >= 0x20,
        "ERR_SCHEMA",
        `unescaped control character at byte ${this.index}`,
      );
      if (!escaped && code === 0x5c) {
        escaped = true;
      } else {
        escaped = false;
      }
      this.index += 1;
    }
    fail("ERR_SCHEMA", `unterminated JSON string at byte ${start}`);
  }

  number() {
    const start = this.index;
    if (this.source[this.index] === "-") this.index += 1;
    invariant(
      /[0-9]/.test(this.source[this.index] ?? ""),
      "ERR_SCHEMA",
      `invalid number at byte ${start}`,
    );
    if (this.source[this.index] === "0") {
      this.index += 1;
      invariant(
        !/[0-9]/.test(this.source[this.index] ?? ""),
        "ERR_NON_CANONICAL",
        `leading zero at byte ${start}`,
      );
    } else {
      while (/[0-9]/.test(this.source[this.index] ?? "")) this.index += 1;
    }
    invariant(
      !/[.eE]/.test(this.source[this.index] ?? ""),
      "ERR_UNSAFE_INTEGER",
      `non-integer JSON number at byte ${start}`,
    );
    const raw = this.source.slice(start, this.index);
    invariant(raw !== "-0", "ERR_NON_CANONICAL", "negative zero is forbidden");
    const value = Number(raw);
    invariant(
      Number.isSafeInteger(value),
      "ERR_UNSAFE_INTEGER",
      `unsafe integer at byte ${start}`,
    );
    return value;
  }

  array() {
    this.index += 1;
    this.space();
    const values = [];
    if (this.source[this.index] === "]") {
      this.index += 1;
      return values;
    }
    while (true) {
      values.push(this.value());
      this.space();
      if (this.source[this.index] === "]") {
        this.index += 1;
        return values;
      }
      invariant(
        this.source[this.index] === ",",
        "ERR_SCHEMA",
        `expected comma at byte ${this.index}`,
      );
      this.index += 1;
      this.space();
    }
  }

  object() {
    this.index += 1;
    this.space();
    const value = Object.create(null);
    const keys = new Set();
    if (this.source[this.index] === "}") {
      this.index += 1;
      return value;
    }
    while (true) {
      invariant(
        this.source[this.index] === '"',
        "ERR_SCHEMA",
        `expected object key at byte ${this.index}`,
      );
      const key = this.string();
      invariant(
        !keys.has(key),
        "ERR_DUPLICATE_KEY",
        `duplicate object key ${key}`,
      );
      keys.add(key);
      this.space();
      invariant(
        this.source[this.index] === ":",
        "ERR_SCHEMA",
        `expected colon at byte ${this.index}`,
      );
      this.index += 1;
      this.space();
      value[key] = this.value();
      this.space();
      if (this.source[this.index] === "}") {
        this.index += 1;
        return value;
      }
      invariant(
        this.source[this.index] === ",",
        "ERR_SCHEMA",
        `expected comma at byte ${this.index}`,
      );
      this.index += 1;
      this.space();
    }
  }
}

export function parseStrictJson(source, options = {}) {
  const value = new StrictParser(source).parse();
  const canonical = canonicalize(value);
  if (options.requireCanonical === true) {
    invariant(
      source === canonical,
      "ERR_NON_CANONICAL",
      "ingress bytes are not NEXUS-CJ-1 canonical",
    );
  }
  return value;
}
