/**
 * CF-CJSON-0 style canonical JSON (subset).
 * Safe integers only, sorted object keys, dense arrays, no cycles.
 */

const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 32,
  maxNodes: 50_000,
  maxCollectionLength: 4096,
  maxStringCodeUnits: 100_000,
});

function hasUnpairedSurrogate(value) {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = value.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) return true;
      i += 1;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function encode(value, path, depth, state, limits) {
  state.nodes += 1;
  if (state.nodes > limits.maxNodes) throw new TypeError('$: node limit exceeded');
  if (depth > limits.maxDepth) throw new TypeError(`${path}: depth exceeded`);

  if (value === null || typeof value === 'boolean') return JSON.stringify(value);

  if (typeof value === 'string') {
    if (value.length > limits.maxStringCodeUnits) throw new TypeError(`${path}: string too long`);
    if (hasUnpairedSurrogate(value)) throw new TypeError(`${path}: unpaired surrogate`);
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(`${path}: only safe integers (not -0)`);
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    if (state.seen.has(value)) throw new TypeError(`${path}: cycle`);
    state.seen.add(value);
    if (value.length > limits.maxCollectionLength) throw new TypeError(`${path}: array too long`);
    const own = Reflect.ownKeys(value);
    const expected = new Set(['length', ...Array.from({ length: value.length }, (_, i) => String(i))]);
    if (own.length !== expected.size || own.some((k) => typeof k !== 'string' || !expected.has(k))) {
      throw new TypeError(`${path}: sparse/custom array forbidden`);
    }
    const parts = [];
    for (let i = 0; i < value.length; i += 1) {
      if (!Object.hasOwn(value, i)) throw new TypeError(`${path}: sparse array`);
      parts.push(encode(value[i], `${path}[${i}]`, depth + 1, state, limits));
    }
    return `[${parts.join(',')}]`;
  }

  if (typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError(`${path}: only plain objects`);
    }
    if (state.seen.has(value)) throw new TypeError(`${path}: cycle`);
    state.seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (keys.some((k) => typeof k !== 'string')) throw new TypeError(`${path}: symbol keys forbidden`);
    if (keys.length > limits.maxCollectionLength) throw new TypeError(`${path}: too many keys`);
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) {
        throw new TypeError(`${path}.${key}: accessor/hidden forbidden`);
      }
    }
    const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts = sorted.map(
      (key) => `${JSON.stringify(key)}:${encode(value[key], `${path}.${key}`, depth + 1, state, limits)}`,
    );
    return `{${parts.join(',')}}`;
  }

  throw new TypeError(`${path}: unsupported type`);
}

export function canonicalize(value, limits = DEFAULT_LIMITS) {
  return encode(value, '$', 0, { nodes: 0, seen: new WeakSet() }, { ...DEFAULT_LIMITS, ...limits });
}

export function parseCanonical(text) {
  if (typeof text !== 'string') throw new TypeError('canonical text must be string');
  if (text.length === 0) throw new TypeError('empty');
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new TypeError(`JSON parse failed: ${e.message}`);
  }
  const again = canonicalize(value);
  if (again !== text) throw new TypeError('input is not canonical JSON');
  return value;
}
