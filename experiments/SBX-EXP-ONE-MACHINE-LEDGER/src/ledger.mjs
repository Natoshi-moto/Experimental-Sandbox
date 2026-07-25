/**
 * One-Machine Ledger (OML) v0
 *
 * Minimal UTXO chain: genesis allocation → signed spends → hash-linked blocks.
 * Zero-value research unit OML_UNIT. Deterministic. Fail-closed.
 */

import { canonicalize } from './canonical.mjs';
import {
  PROTOCOL,
  hashCanonical,
  publicKeyId,
  signCanonical,
  verifyCanonical,
} from './crypto.mjs';

export const UNIT = 'OML_UNIT';
export const GENESIS_PREV = `sha256:${'0'.repeat(64)}`;
export const MAX_TX_PER_BLOCK = 64;
export const MAX_OUTPUTS_PER_TX = 16;
export const MAX_INPUTS_PER_TX = 16;
export const MAX_HEIGHT = 10_000;

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export class LedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new LedgerError(code, message);
}

function require(cond, code, message) {
  if (!cond) fail(code, message);
}

function requireHash(v, label) {
  require(typeof v === 'string' && HASH_RE.test(v), 'BAD_HASH', `${label}: invalid hash`);
}

function requireId(v, label) {
  require(typeof v === 'string' && ID_RE.test(v), 'BAD_ID', `${label}: invalid id`);
}

function requireExactKeys(obj, keys, label) {
  require(obj && typeof obj === 'object' && !Array.isArray(obj), 'BAD_OBJECT', `${label}: object`);
  require(Object.getPrototypeOf(obj) === Object.prototype, 'BAD_OBJECT', `${label}: plain object`);
  const actual = Reflect.ownKeys(obj);
  require(
    actual.length === keys.length && actual.every((k) => typeof k === 'string' && keys.includes(k)),
    'BAD_FIELDS',
    `${label}: exact fields required`,
  );
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(obj, k);
    require(d && d.enumerable && Object.hasOwn(d, 'value'), 'BAD_FIELDS', `${label}.${k}`);
  }
}

function requireDenseArray(arr, label, max) {
  require(Array.isArray(arr), 'BAD_ARRAY', `${label}: array`);
  require(arr.length <= max, 'BAD_ARRAY', `${label}: too long`);
  const expected = new Set(['length', ...Array.from({ length: arr.length }, (_, i) => String(i))]);
  const own = Reflect.ownKeys(arr);
  require(
    own.length === expected.size && own.every((k) => typeof k === 'string' && expected.has(k)),
    'BAD_ARRAY',
    `${label}: sparse/custom`,
  );
}

function outpointKey(txid, index) {
  return `${txid}:${index}`;
}

function sortUtxoEntries(utxoMap) {
  return [...utxoMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** @returns {Map<string, {amount:number, owner_key_id:string, public_key_spki_b64:string}>} */
export function emptyUtxo() {
  return new Map();
}

export function stateRoot(height, tipHash, utxo) {
  const utxo_list = sortUtxoEntries(utxo).map(([key, out]) => ({
    amount: out.amount,
    outpoint: key,
    owner_key_id: out.owner_key_id,
    public_key_spki_b64: out.public_key_spki_b64,
  }));
  return hashCanonical({
    height,
    protocol: PROTOCOL,
    tip_hash: tipHash,
    unit: UNIT,
    utxo: utxo_list,
  });
}

/**
 * Genesis: allocate fixed outputs to named identities. No signatures required
 * (operator-declared initial allocation for a local experiment).
 */
export function buildGenesis({ allocations, note = 'oml-genesis' }) {
  requireDenseArray(allocations, 'allocations', 64);
  require(allocations.length >= 1, 'GENESIS', 'need at least one allocation');
  const body = {
    allocations: allocations.map((a, i) => {
      requireExactKeys(a, ['amount', 'owner_label', 'public_key_spki_b64'], `allocations[${i}]`);
      require(Number.isSafeInteger(a.amount) && a.amount > 0, 'GENESIS', 'amount must be positive safe int');
      requireId(a.owner_label, 'owner_label');
      const keyId = publicKeyId(a.public_key_spki_b64);
      return {
        amount: a.amount,
        owner_key_id: keyId,
        owner_label: a.owner_label,
        public_key_spki_b64: a.public_key_spki_b64,
      };
    }),
    note,
    protocol: PROTOCOL,
    unit: UNIT,
  };
  // Sort allocations by owner_key_id for determinism of genesis hash
  body.allocations = [...body.allocations].sort((a, b) =>
    a.owner_key_id < b.owner_key_id ? -1 : a.owner_key_id > b.owner_key_id ? 1 : 0,
  );
  const genesis_hash = hashCanonical(body, 'OML-GENESIS-V0');
  const utxo = emptyUtxo();
  body.allocations.forEach((a, index) => {
    utxo.set(outpointKey(genesis_hash, index), {
      amount: a.amount,
      owner_key_id: a.owner_key_id,
      public_key_spki_b64: a.public_key_spki_b64,
    });
  });
  const height = 0;
  const tip = genesis_hash;
  return {
    genesis: body,
    genesis_hash,
    height,
    tip_hash: tip,
    utxo,
    state_root: stateRoot(height, tip, utxo),
    blocks: [],
  };
}

/**
 * Unsigned tx core (what is signed).
 * inputs: [{txid, index}]
 * outputs: [{amount, public_key_spki_b64}]
 */
export function txCore({ inputs, outputs, memo = '' }) {
  requireDenseArray(inputs, 'inputs', MAX_INPUTS_PER_TX);
  requireDenseArray(outputs, 'outputs', MAX_OUTPUTS_PER_TX);
  require(inputs.length >= 1, 'TX', 'need inputs');
  require(outputs.length >= 1, 'TX', 'need outputs');
  require(typeof memo === 'string' && memo.length <= 256, 'TX', 'memo');
  const core = {
    inputs: inputs.map((inp, i) => {
      requireExactKeys(inp, ['index', 'txid'], `inputs[${i}]`);
      requireHash(inp.txid, 'txid');
      require(Number.isSafeInteger(inp.index) && inp.index >= 0, 'TX', 'index');
      return { index: inp.index, txid: inp.txid };
    }),
    memo,
    outputs: outputs.map((out, i) => {
      requireExactKeys(out, ['amount', 'public_key_spki_b64'], `outputs[${i}]`);
      require(Number.isSafeInteger(out.amount) && out.amount > 0, 'TX', 'output amount');
      const kid = publicKeyId(out.public_key_spki_b64);
      return {
        amount: out.amount,
        owner_key_id: kid,
        public_key_spki_b64: out.public_key_spki_b64,
      };
    }),
    protocol: PROTOCOL,
    unit: UNIT,
  };
  // Deterministic input order for signing: sort by outpoint key
  core.inputs = [...core.inputs].sort((a, b) => {
    const ka = outpointKey(a.txid, a.index);
    const kb = outpointKey(b.txid, b.index);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  // Detect duplicate inputs in core
  const seen = new Set();
  for (const inp of core.inputs) {
    const k = outpointKey(inp.txid, inp.index);
    require(!seen.has(k), 'DUP_INPUT', `duplicate input ${k}`);
    seen.add(k);
  }
  core.txid_preimage = hashCanonical(core, 'OML-TX-CORE-V0');
  return core;
}

export function signTx(core, privateKeyPkcs8B64, publicKeySpkiB64) {
  const keyId = publicKeyId(publicKeySpkiB64);
  const signature = signCanonical(core, privateKeyPkcs8B64);
  return {
    core,
    public_key_spki_b64: publicKeySpkiB64,
    signature_b64: signature,
    signer_key_id: keyId,
    txid: hashCanonical(
      {
        core_hash: core.txid_preimage,
        public_key_spki_b64: publicKeySpkiB64,
        signature_b64: signature,
      },
      'OML-TX-V0',
    ),
  };
}

/**
 * Apply a signed transaction to UTXO. Mutates a copy.
 * Requires all inputs owned by the same signer (v0 simplicity).
 */
export function applyTx(utxo, signedTx) {
  requireExactKeys(
    signedTx,
    ['core', 'public_key_spki_b64', 'signature_b64', 'signer_key_id', 'txid'],
    'tx',
  );
  const { core } = signedTx;
  requireExactKeys(core, ['inputs', 'memo', 'outputs', 'protocol', 'txid_preimage', 'unit'], 'core');
  require(core.protocol === PROTOCOL, 'TX', 'protocol');
  require(core.unit === UNIT, 'TX', 'unit');
  require(core.txid_preimage === hashCanonical({
    inputs: core.inputs,
    memo: core.memo,
    outputs: core.outputs,
    protocol: core.protocol,
    unit: core.unit,
  }, 'OML-TX-CORE-V0'), 'TX', 'core hash mismatch');

  require(
    verifyCanonical(core, signedTx.signature_b64, signedTx.public_key_spki_b64),
    'BAD_SIG',
    'signature verification failed',
  );
  require(
    signedTx.signer_key_id === publicKeyId(signedTx.public_key_spki_b64),
    'TX',
    'signer key id mismatch',
  );
  require(
    signedTx.txid === hashCanonical(
      {
        core_hash: core.txid_preimage,
        public_key_spki_b64: signedTx.public_key_spki_b64,
        signature_b64: signedTx.signature_b64,
      },
      'OML-TX-V0',
    ),
    'TX',
    'txid mismatch',
  );

  const next = new Map(utxo);
  let inputSum = 0;
  for (const inp of core.inputs) {
    const k = outpointKey(inp.txid, inp.index);
    const coin = next.get(k);
    require(coin, 'MISSING_UTXO', `missing ${k}`);
    require(coin.owner_key_id === signedTx.signer_key_id, 'NOT_OWNER', `not owner of ${k}`);
    inputSum += coin.amount;
    next.delete(k);
  }

  let outputSum = 0;
  core.outputs.forEach((out, index) => {
    outputSum += out.amount;
    const k = outpointKey(signedTx.txid, index);
    require(!next.has(k), 'UTXO_COLLISION', k);
    next.set(k, {
      amount: out.amount,
      owner_key_id: out.owner_key_id,
      public_key_spki_b64: out.public_key_spki_b64,
    });
  });

  require(inputSum === outputSum, 'CONSERVATION', `in ${inputSum} != out ${outputSum}`);
  require(inputSum > 0, 'TX', 'zero value');

  return next;
}

export function buildBlock({ prev_hash, height, transactions }) {
  requireHash(prev_hash, 'prev_hash');
  require(Number.isSafeInteger(height) && height >= 1 && height <= MAX_HEIGHT, 'BLOCK', 'height');
  requireDenseArray(transactions, 'transactions', MAX_TX_PER_BLOCK);
  require(transactions.length >= 1, 'BLOCK', 'empty block');
  const body = {
    height,
    prev_hash,
    protocol: PROTOCOL,
    transactions: transactions.map((tx) => ({
      core: tx.core,
      public_key_spki_b64: tx.public_key_spki_b64,
      signature_b64: tx.signature_b64,
      signer_key_id: tx.signer_key_id,
      txid: tx.txid,
    })),
    unit: UNIT,
  };
  const block_hash = hashCanonical(body, 'OML-BLOCK-V0');
  return { ...body, block_hash };
}

/**
 * Apply block to chain state. Returns new state (does not mutate).
 */
export function applyBlock(state, block) {
  require(state && typeof state === 'object', 'STATE', 'state');
  require(block.prev_hash === state.tip_hash, 'CHAIN', 'prev_hash mismatch');
  require(block.height === state.height + 1, 'CHAIN', 'height mismatch');
  require(block.protocol === PROTOCOL, 'BLOCK', 'protocol');
  require(block.unit === UNIT, 'BLOCK', 'unit');
  require(
    block.block_hash === hashCanonical(
      {
        height: block.height,
        prev_hash: block.prev_hash,
        protocol: block.protocol,
        transactions: block.transactions,
        unit: block.unit,
      },
      'OML-BLOCK-V0',
    ),
    'BLOCK',
    'block hash mismatch',
  );

  let utxo = new Map(state.utxo);
  const seenTx = new Set();
  for (const tx of block.transactions) {
    require(!seenTx.has(tx.txid), 'DUP_TX', tx.txid);
    seenTx.add(tx.txid);
    utxo = applyTx(utxo, tx);
  }

  return {
    genesis: state.genesis,
    genesis_hash: state.genesis_hash,
    height: block.height,
    tip_hash: block.block_hash,
    utxo,
    state_root: stateRoot(block.height, block.block_hash, utxo),
    blocks: [...state.blocks, block],
  };
}

/** Full replay from genesis + blocks → state; throws on any fault. */
export function replay(genesisResult, blocks) {
  let state = {
    genesis: genesisResult.genesis,
    genesis_hash: genesisResult.genesis_hash,
    height: 0,
    tip_hash: genesisResult.genesis_hash,
    utxo: new Map(genesisResult.utxo),
    state_root: genesisResult.state_root,
    blocks: [],
  };
  // Rebuild utxo from genesis alone for purity
  const rebuilt = buildGenesis({
    allocations: genesisResult.genesis.allocations.map((a) => ({
      amount: a.amount,
      owner_label: a.owner_label,
      public_key_spki_b64: a.public_key_spki_b64,
    })),
    note: genesisResult.genesis.note,
  });
  require(rebuilt.genesis_hash === genesisResult.genesis_hash, 'GENESIS', 'genesis replay mismatch');
  state = {
    genesis: rebuilt.genesis,
    genesis_hash: rebuilt.genesis_hash,
    height: 0,
    tip_hash: rebuilt.genesis_hash,
    utxo: rebuilt.utxo,
    state_root: rebuilt.state_root,
    blocks: [],
  };
  for (const block of blocks) {
    state = applyBlock(state, block);
  }
  return state;
}

export function exportSnapshot(state) {
  const utxo_list = sortUtxoEntries(state.utxo).map(([key, out]) => ({
    amount: out.amount,
    outpoint: key,
    owner_key_id: out.owner_key_id,
    public_key_spki_b64: out.public_key_spki_b64,
  }));
  return {
    blocks: state.blocks,
    genesis: state.genesis,
    genesis_hash: state.genesis_hash,
    height: state.height,
    protocol: PROTOCOL,
    state_root: state.state_root,
    tip_hash: state.tip_hash,
    unit: UNIT,
    utxo: utxo_list,
  };
}

export function snapshotCanonical(state) {
  return canonicalize(exportSnapshot(state));
}

export { canonicalize };
