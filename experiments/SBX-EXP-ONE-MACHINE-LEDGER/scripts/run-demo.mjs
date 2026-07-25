#!/usr/bin/env node
/**
 * Deterministic demo: fixed mnemonic-free keys from seed strings via generateIdentity
 * are random — so demo records keys into the report for replay of THIS run only.
 * For hash-stable CI, use scripts/verify.mjs which re-runs tests + fixture chain.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { generateIdentity } from '../src/crypto.mjs';
import {
  applyBlock,
  buildBlock,
  buildGenesis,
  exportSnapshot,
  replay,
  signTx,
  txCore,
  snapshotCanonical,
} from '../src/ledger.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reports = join(root, 'reports');
mkdirSync(reports, { recursive: true });

const alice = generateIdentity();
const bob = generateIdentity();
const carol = generateIdentity();

let state = buildGenesis({
  allocations: [
    { amount: 100, owner_label: 'alice', public_key_spki_b64: alice.public_key_spki_b64 },
    { amount: 100, owner_label: 'bob', public_key_spki_b64: bob.public_key_spki_b64 },
    { amount: 50, owner_label: 'carol', public_key_spki_b64: carol.public_key_spki_b64 },
  ],
  note: 'oml-demo-genesis',
});

function ownedInputs(state, keyId) {
  return [...state.utxo.entries()]
    .filter(([, o]) => o.owner_key_id === keyId)
    .map(([key, o]) => {
      const i = key.lastIndexOf(':');
      return { txid: key.slice(0, i), index: Number(key.slice(i + 1)), amount: o.amount };
    });
}

// Block 1: alice pays bob 40, change 60 to alice
{
  const inputs = ownedInputs(state, alice.key_id);
  const total = inputs.reduce((s, x) => s + x.amount, 0);
  const core = txCore({
    inputs: inputs.map(({ txid, index }) => ({ txid, index })),
    outputs: [
      { amount: 40, public_key_spki_b64: bob.public_key_spki_b64 },
      { amount: total - 40, public_key_spki_b64: alice.public_key_spki_b64 },
    ],
    memo: 'alice-pays-bob-40',
  });
  const tx = signTx(core, alice.private_key_pkcs8_b64, alice.public_key_spki_b64);
  const block = buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] });
  state = applyBlock(state, block);
}

// Block 2: bob pays carol 25
{
  const inputs = ownedInputs(state, bob.key_id);
  const total = inputs.reduce((s, x) => s + x.amount, 0);
  const core = txCore({
    inputs: inputs.map(({ txid, index }) => ({ txid, index })),
    outputs: [
      { amount: 25, public_key_spki_b64: carol.public_key_spki_b64 },
      { amount: total - 25, public_key_spki_b64: bob.public_key_spki_b64 },
    ],
    memo: 'bob-pays-carol-25',
  });
  const tx = signTx(core, bob.private_key_pkcs8_b64, bob.public_key_spki_b64);
  const block = buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] });
  state = applyBlock(state, block);
}

const rebuilt = replay(
  {
    genesis: state.genesis,
    genesis_hash: state.genesis_hash,
    utxo: null,
    state_root: null,
  },
  state.blocks,
);

if (rebuilt.state_root !== state.state_root) {
  console.error('REPLAY MISMATCH');
  process.exit(1);
}

const snapshot = exportSnapshot(state);
// Strip private keys from report — only public material
const report = {
  experiment: 'SBX-EXP-ONE-MACHINE-LEDGER',
  protocol: snapshot.protocol,
  unit: snapshot.unit,
  height: snapshot.height,
  genesis_hash: snapshot.genesis_hash,
  tip_hash: snapshot.tip_hash,
  state_root: snapshot.state_root,
  supply: snapshot.utxo.reduce((s, u) => s + u.amount, 0),
  utxo_count: snapshot.utxo.length,
  blocks: snapshot.blocks.length,
  non_claims: [
    'OML_UNIT has no real-world value and is not redeemable.',
    'This is a single-machine deterministic experiment, not a network.',
    'Genesis is operator-declared, not mined.',
    'status_authority: NONE',
  ],
  public_keys: {
    alice: alice.public_key_spki_b64,
    bob: bob.public_key_spki_b64,
    carol: carol.public_key_spki_b64,
  },
};

const canon = snapshotCanonical(state);
const reportPath = join(reports, 'demo-run.json');
const chainPath = join(reports, 'demo-chain.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  chainPath,
  `${JSON.stringify(
    {
      genesis: snapshot.genesis,
      genesis_hash: snapshot.genesis_hash,
      blocks: snapshot.blocks,
      final_state_root: snapshot.state_root,
    },
    null,
    2,
  )}\n`,
);

const chainHash = createHash('sha256').update(canon).digest('hex');
console.log('OML demo OK');
console.log(`  height:      ${snapshot.height}`);
console.log(`  supply:      ${report.supply} ${snapshot.unit}`);
console.log(`  genesis:     ${snapshot.genesis_hash}`);
console.log(`  tip:         ${snapshot.tip_hash}`);
console.log(`  state_root:  ${snapshot.state_root}`);
console.log(`  snapshot_sha256: sha256:${chainHash}`);
console.log(`  wrote: ${reportPath}`);
console.log(`  wrote: ${chainPath}`);
