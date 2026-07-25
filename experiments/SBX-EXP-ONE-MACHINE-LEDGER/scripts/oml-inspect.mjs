#!/usr/bin/env node
/**
 * oml-inspect — read-only inspector for OML datasets.
 *
 * Accepts a file path (or "-" / no arg for stdin) containing JSON in one of:
 *   - fixture shape        { genesis, genesis_hash, blocks, expected_state_root, ... }
 *   - snapshot shape       { protocol, genesis, genesis_hash, blocks, state_root, ... }
 *   - packet envelope      { schema: "nexus.paste.oml/v0", kind, body: <fixture|snapshot> }
 *   - payload envelope     { payload: <fixture|snapshot> }   (decrypted Drop plaintext,
 *                            already opened by the operator — this tool never decrypts)
 *
 * Replays genesis + blocks through the kernel and prints one JSON receipt
 * (OML_VERIFY_RECEIPT) to stdout: status VALID or INVALID + error_code.
 *
 * Read-only. No writes, no network, no key material. status_authority: NONE.
 */
import { readFileSync } from 'node:fs';
import { replay } from '../src/ledger.mjs';

function receipt(fields) {
  return JSON.stringify(
    {
      schema: 'nexus.paste.oml/v0',
      kind: 'OML_VERIFY_RECEIPT',
      status_authority: 'NONE',
      ...fields,
    },
    null,
    2,
  );
}

function bail(source, shape, code, message) {
  console.log(receipt({ status: 'INVALID', source, shape, error_code: code, error: message }));
  process.exit(1);
}

// --- read input -------------------------------------------------------------
const arg = process.argv[2];
let source;
let text;
try {
  if (arg && arg !== '-') {
    source = arg;
    text = readFileSync(arg, 'utf8');
  } else {
    source = 'stdin';
    text = readFileSync(0, 'utf8');
  }
} catch (e) {
  console.error(`oml-inspect: cannot read input: ${e.message}`);
  process.exit(2);
}

let data;
try {
  data = JSON.parse(text);
} catch (e) {
  bail(source, 'unknown', 'BAD_JSON', e.message);
}

// --- unwrap at most one envelope layer --------------------------------------
let shape = 'raw';
if (data && typeof data === 'object' && !Array.isArray(data)) {
  if (typeof data.schema === 'string' && data.schema.startsWith('nexus.paste') && data.body) {
    data = data.body;
    shape = 'envelope(body)';
  } else if (data.payload && typeof data.payload === 'object' && !data.genesis) {
    data = data.payload;
    shape = 'envelope(payload)';
  }
}

if (!data || typeof data !== 'object' || Array.isArray(data) || !data.genesis || !data.genesis_hash) {
  bail(source, shape, 'UNRECOGNIZED_SHAPE', 'expected OML fixture or snapshot JSON');
}

const isFixture = typeof data.expected_state_root === 'string';
shape = shape === 'raw' ? (isFixture ? 'fixture' : 'snapshot') : `${shape}:${isFixture ? 'fixture' : 'snapshot'}`;
const declaredRoot = isFixture ? data.expected_state_root : data.state_root;
const declaredTip = isFixture ? data.expected_tip_hash : data.tip_hash;
const declaredHeight = isFixture ? data.expected_height : data.height;
const declaredSupply = isFixture ? data.expected_supply : undefined;

// --- replay through the kernel ----------------------------------------------
let state;
try {
  state = replay({ genesis: data.genesis, genesis_hash: data.genesis_hash }, data.blocks ?? []);
} catch (e) {
  bail(source, shape, e.code ?? 'REPLAY_ERROR', e.message);
}

const supply = [...state.utxo.values()].reduce((sum, out) => sum + out.amount, 0);

if (typeof declaredRoot === 'string' && state.state_root !== declaredRoot) {
  bail(source, shape, 'STATE_ROOT_MISMATCH', `computed ${state.state_root}, declared ${declaredRoot}`);
}
if (typeof declaredTip === 'string' && state.tip_hash !== declaredTip) {
  bail(source, shape, 'TIP_MISMATCH', `computed ${state.tip_hash}, declared ${declaredTip}`);
}
if (Number.isSafeInteger(declaredHeight) && state.height !== declaredHeight) {
  bail(source, shape, 'HEIGHT_MISMATCH', `computed ${state.height}, declared ${declaredHeight}`);
}
if (Number.isSafeInteger(declaredSupply) && supply !== declaredSupply) {
  bail(source, shape, 'SUPPLY_MISMATCH', `computed ${supply}, declared ${declaredSupply}`);
}

console.log(
  receipt({
    status: 'VALID',
    source,
    shape,
    height: state.height,
    tip_hash: state.tip_hash,
    state_root: state.state_root,
    supply,
    unit: 'OML_UNIT',
    utxo_count: state.utxo.size,
  }),
);
process.exit(0);
