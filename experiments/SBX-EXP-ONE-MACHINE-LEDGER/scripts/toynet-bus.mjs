#!/usr/bin/env node
/**
 * Multi-process OML toy net over a shared directory (file bus).
 *
 * Two local "nodes" exchange OML_CHAIN_PACKET files. The operator/bus does
 * not decide validity — each node runs the same kernel replay.
 *
 * Usage:
 *   node scripts/toynet-bus.mjs                 # full demo in ./run/toynet-<ts>
 *   node scripts/toynet-bus.mjs --dir <path>    # use existing bus dir
 *
 * status_authority: NONE — not money, not multi-party consensus, not Lab.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { identityFromLabel } from '../src/crypto.mjs';
import {
  applyBlock,
  buildBlock,
  buildGenesis,
  exportSnapshot,
  signTx,
  txCore,
} from '../src/ledger.mjs';
import { replay } from '../src/ledger.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function ownedInputs(st, keyId) {
  return [...st.utxo.entries()]
    .filter(([, o]) => o.owner_key_id === keyId)
    .map(([key, o]) => {
      const i = key.lastIndexOf(':');
      return { txid: key.slice(0, i), index: Number(key.slice(i + 1)), amount: o.amount };
    });
}

function writePacket(dir, name, kind, status, body) {
  const packet = {
    schema: 'nexus.paste.oml/v0',
    kind,
    status,
    status_authority: 'NONE',
    body,
  };
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`);
  return path;
}

function nodeValidateFixture(fixturePath, label) {
  // Child process isolation: each "node" is a separate Node process running inspect
  const r = spawnSync(process.execPath, [join(root, 'scripts/oml-inspect.mjs'), fixturePath], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(`[${label}] INVALID`, r.stdout || r.stderr);
    process.exit(1);
  }
  const receipt = JSON.parse(r.stdout);
  if (receipt.status !== 'VALID') {
    console.error(`[${label}] expected VALID`, receipt);
    process.exit(1);
  }
  console.log(`[${label}] VALID height=${receipt.height} state_root=${receipt.state_root}`);
  return receipt;
}

function buildChain() {
  const alice = identityFromLabel('alice');
  const bob = identityFromLabel('bob');
  const carol = identityFromLabel('carol');
  let state = buildGenesis({
    allocations: [
      { amount: 100, owner_label: 'alice', public_key_spki_b64: alice.public_key_spki_b64 },
      { amount: 100, owner_label: 'bob', public_key_spki_b64: bob.public_key_spki_b64 },
      { amount: 50, owner_label: 'carol', public_key_spki_b64: carol.public_key_spki_b64 },
    ],
    note: 'oml-toynet-genesis-v0',
  });

  {
    const inputs = ownedInputs(state, alice.key_id);
    const total = inputs.reduce((s, x) => s + x.amount, 0);
    const core = txCore({
      inputs: inputs.map(({ txid, index }) => ({ txid, index })),
      outputs: [
        { amount: 40, public_key_spki_b64: bob.public_key_spki_b64 },
        { amount: total - 40, public_key_spki_b64: alice.public_key_spki_b64 },
      ],
      memo: 'toynet-alice-bob-40',
    });
    const tx = signTx(core, alice.private_key_pkcs8_b64, alice.public_key_spki_b64);
    state = applyBlock(state, buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] }));
  }

  {
    const inputs = ownedInputs(state, bob.key_id);
    const total = inputs.reduce((s, x) => s + x.amount, 0);
    const core = txCore({
      inputs: inputs.map(({ txid, index }) => ({ txid, index })),
      outputs: [
        { amount: 25, public_key_spki_b64: carol.public_key_spki_b64 },
        { amount: total - 25, public_key_spki_b64: bob.public_key_spki_b64 },
      ],
      memo: 'toynet-bob-carol-25',
    });
    const tx = signTx(core, bob.private_key_pkcs8_b64, bob.public_key_spki_b64);
    state = applyBlock(state, buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] }));
  }

  return {
    schema: 'oml/fixture-chain/v0',
    genesis: state.genesis,
    genesis_hash: state.genesis_hash,
    blocks: state.blocks,
    expected_height: state.height,
    expected_tip_hash: state.tip_hash,
    expected_state_root: state.state_root,
    expected_supply: 250,
    note: 'toynet multi-process file bus demo — OML_UNIT only',
  };
}

// --- main -------------------------------------------------------------------
const args = process.argv.slice(2);
let busDir;
const dirIdx = args.indexOf('--dir');
if (dirIdx >= 0) {
  busDir = args[dirIdx + 1];
  mkdirSync(busDir, { recursive: true });
} else {
  busDir = join(root, 'run', `toynet-${Date.now()}`);
  mkdirSync(busDir, { recursive: true });
}

console.log('=== OML multi-process toy net (file bus) ===');
console.log('bus_dir=', busDir);
console.log('model: seats exchange packets; kernel decides; no global consensus claimed');

const chain = buildChain();
const chainPath = join(busDir, 'chain-packet.json');
writePacket(busDir, '01-nodeA-claims-chain.json', 'OML_CHAIN_PACKET', 'CLAIMED', chain);
writeFileSync(chainPath, `${JSON.stringify(chain, null, 2)}\n`);

// Node A validates (producer)
const receiptA = nodeValidateFixture(chainPath, 'nodeA');
writePacket(busDir, '02-nodeA-verify-receipt.json', 'OML_VERIFY_RECEIPT', receiptA.status, {
  ...receiptA,
  body_note: 'receipt fields also at envelope top-level for inspect compatibility',
});
// Store inspect-native receipt for the bus
writeFileSync(
  join(busDir, '02-nodeA-receipt-raw.json'),
  `${JSON.stringify(receiptA, null, 2)}\n`,
);

// Node B: independent process validates the same bytes
const receiptB = nodeValidateFixture(chainPath, 'nodeB');
writeFileSync(
  join(busDir, '03-nodeB-receipt-raw.json'),
  `${JSON.stringify(receiptB, null, 2)}\n`,
);

if (receiptA.state_root !== receiptB.state_root) {
  console.error('TOYNET FAIL: node disagreement on state_root');
  process.exit(1);
}

// Poison packet: double-spend attempt body (tamper tip)
const poisoned = structuredClone(chain);
poisoned.expected_state_root = `sha256:${'f'.repeat(64)}`;
const poisonPath = join(busDir, '04-poison-claim.json');
writeFileSync(poisonPath, `${JSON.stringify(poisoned, null, 2)}\n`);
const poisonR = spawnSync(process.execPath, [join(root, 'scripts/oml-inspect.mjs'), poisonPath], {
  encoding: 'utf8',
});
const poisonReceipt = JSON.parse(poisonR.stdout);
if (poisonReceipt.status !== 'INVALID' || poisonReceipt.error_code !== 'STATE_ROOT_MISMATCH') {
  console.error('TOYNET FAIL: poison should be INVALID STATE_ROOT_MISMATCH', poisonReceipt);
  process.exit(1);
}
console.log(`[adversary] poison CLAIMED → INVALID (${poisonReceipt.error_code}) as required`);
writeFileSync(
  join(busDir, '05-poison-receipt.json'),
  `${JSON.stringify(poisonReceipt, null, 2)}\n`,
);

// In-process third check: direct replay
const direct = replay(
  { genesis: chain.genesis, genesis_hash: chain.genesis_hash },
  chain.blocks,
);
if (direct.state_root !== chain.expected_state_root) {
  console.error('TOYNET FAIL: in-process replay mismatch');
  process.exit(1);
}

const summary = {
  schema: 'nexus.paste.oml/v0',
  kind: 'OML_TOYNET_SUMMARY',
  status: 'VALID',
  status_authority: 'NONE',
  bus_dir: busDir,
  nodeA_state_root: receiptA.state_root,
  nodeB_state_root: receiptB.state_root,
  agreement: true,
  poison_rejected: true,
  height: receiptA.height,
  supply: 250,
  unit: 'OML_UNIT',
  nonclaim: 'Not multi-party BFT. Not money. Same kernel, independent processes, shared files.',
};
writeFileSync(join(busDir, '99-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log('=== TOYNET PASS ===');
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
