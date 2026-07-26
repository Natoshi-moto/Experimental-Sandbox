export const STATE_FILE_LIMITS = Object.freeze({
  maxBytes: 512 * 1024,
  maxDepth: 18,
  maxNodes: 10_000,
  maxArrayItems: 512,
  maxObjectKeys: 256,
  maxKeyCharacters: 256,
  maxStringCharacters: 16_384,
  maxFileNameCharacters: 128,
  maxRenderedRows: 2_000,
});

const ALLOWED_MIME_TYPES = new Set(["", "application/json"]);
const ALLOWED_SCHEMAS = new Set([
  "nexus-matrix-demo-v1",
  "nexus-ui-local-state-v1",
]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class LocalStatePolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LocalStatePolicyError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new LocalStatePolicyError(code, message);
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    reject("SCHEMA_SHAPE", `${label} has unsupported fields.`);
  }
}

export function assertLocalFileMetadata({
  name,
  type = "",
  declaredBytes,
}) {
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > STATE_FILE_LIMITS.maxFileNameCharacters ||
    !name.toLowerCase().endsWith(".json")
  ) {
    reject("FILE_NAME", "Choose one bounded .json file.");
  }
  if (!ALLOWED_MIME_TYPES.has(type)) {
    reject("MIME_TYPE", "The selected file is not JSON.");
  }
  if (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes <= 0 ||
    declaredBytes > STATE_FILE_LIMITS.maxBytes
  ) {
    reject(
      "BYTE_LIMIT",
      `Local state must be 1-${STATE_FILE_LIMITS.maxBytes} bytes.`,
    );
  }
}

function validateGraph(root) {
  let nodes = 0;
  const stack = [{ value: root, depth: 0 }];

  while (stack.length > 0) {
    const { value, depth } = stack.pop();
    nodes += 1;
    if (nodes > STATE_FILE_LIMITS.maxNodes) {
      reject("NODE_LIMIT", "Local state contains too many values.");
    }
    if (depth > STATE_FILE_LIMITS.maxDepth) {
      reject("DEPTH_LIMIT", "Local state is nested too deeply.");
    }
    if (value === null || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        reject("NUMBER_VALUE", "Local state contains a non-finite number.");
      }
      continue;
    }
    if (typeof value === "string") {
      if (value.length > STATE_FILE_LIMITS.maxStringCharacters) {
        reject("STRING_LIMIT", "A local-state string is too long.");
      }
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > STATE_FILE_LIMITS.maxArrayItems) {
        reject("ARRAY_LIMIT", "A local-state array is too large.");
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: depth + 1 });
      }
      continue;
    }
    if (
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      reject("VALUE_TYPE", "Local state contains an unsupported value.");
    }
    const entries = Object.entries(value);
    if (entries.length > STATE_FILE_LIMITS.maxObjectKeys) {
      reject("OBJECT_LIMIT", "A local-state object has too many fields.");
    }
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, child] = entries[index];
      if (
        FORBIDDEN_KEYS.has(key) ||
        key.length === 0 ||
        key.length > STATE_FILE_LIMITS.maxKeyCharacters
      ) {
        reject("FORBIDDEN_KEY", "Local state contains a forbidden field name.");
      }
      stack.push({ value: child, depth: depth + 1 });
    }
  }
}

function freezeGraph(root) {
  const stack = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
      continue;
    }
    for (const child of Object.values(value)) stack.push(child);
    Object.freeze(value);
  }
  return root;
}

export function parseLocalStateText(
  source,
  { name, type = "", declaredBytes } = {},
) {
  if (typeof source !== "string") {
    reject("SOURCE_TYPE", "Local state must decode as text.");
  }
  assertLocalFileMetadata({ name, type, declaredBytes });
  const actualBytes = new TextEncoder().encode(source).byteLength;
  if (
    actualBytes !== declaredBytes ||
    actualBytes > STATE_FILE_LIMITS.maxBytes
  ) {
    reject("BYTE_LIMIT", "Decoded local-state bytes do not match the file.");
  }

  let data;
  try {
    data = JSON.parse(source, (key, value) => {
      if (FORBIDDEN_KEYS.has(key)) {
        reject("FORBIDDEN_KEY", "Local state contains a forbidden field name.");
      }
      return value;
    });
  } catch (error) {
    if (error instanceof LocalStatePolicyError) throw error;
    reject("MALFORMED_JSON", "Local state is not valid JSON.");
  }

  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !ALLOWED_SCHEMAS.has(data.schema)
  ) {
    reject("SCHEMA", "Local state uses an unsupported schema.");
  }
  if (data.schema === "nexus-ui-local-state-v1") {
    exactKeys(data, ["schema", "label", "state"], "Local-state envelope");
    if (
      typeof data.label !== "string" ||
      data.label.length === 0 ||
      data.state === null ||
      typeof data.state !== "object"
    ) {
      reject("SCHEMA_SHAPE", "Local-state envelope fields are invalid.");
    }
  }

  validateGraph(data);
  return freezeGraph(data);
}

function rowValue(value) {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return String(value);
}

export function localStateRows(data) {
  const rows = [];
  const stack = [{ path: "$", value: data }];

  while (
    stack.length > 0 &&
    rows.length < STATE_FILE_LIMITS.maxRenderedRows
  ) {
    const { path, value } = stack.pop();
    if (Array.isArray(value)) {
      rows.push({ path, type: "array", value: `${value.length} items` });
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ path: `${path}[${index}]`, value: value[index] });
      }
    } else if (value !== null && typeof value === "object") {
      const entries = Object.entries(value);
      rows.push({ path, type: "object", value: `${entries.length} fields` });
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, child] = entries[index];
        stack.push({
          path: `${path}[${JSON.stringify(key)}]`,
          value: child,
        });
      }
    } else {
      rows.push({ path, type: value === null ? "null" : typeof value, value: rowValue(value) });
    }
  }

  if (stack.length > 0) {
    rows.push({
      path: "$",
      type: "truncated",
      value: `Display stopped at ${STATE_FILE_LIMITS.maxRenderedRows} rows.`,
    });
  }
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}
