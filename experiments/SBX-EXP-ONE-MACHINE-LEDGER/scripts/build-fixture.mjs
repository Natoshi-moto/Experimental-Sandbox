#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityFromLabel } from '../src/crypto.mjs';
import {
  applyBlock,
  buildBlock,
  buildGenesis,
  signTx,
  txCore,
} from '../src/ledger.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const alice = identityFromLabel('alice');
const bob = identityFromLabel('bob');
const carol = identityFromLabel('carol');

let state = buildGenesis({
  allocations: [
    { amount: 100, owner_label: 'alice', public_key_spki_b64: alice.public_key_spki_b64 },
    { amount: 100, owner_label: 'bob', public_key_spki_b64: bob.public_key_spki_b64 },
    { amount: 50, owner_label: 'carol', public_key_spki_b64: carol.public_key_spki_b64 },
  ],
  note: 'oml-fixture-genesis-v0',
});

function ownedInputs(st, keyId) {
  return [...st.utxo.entries()]
    .filter(([, o]) => o.owner_key_id === keyId)
    .map(([key, o]) => {
      const i = key.lastIndexOf(':');
      return { txid: key.slice(0, i), index: Number(key.slice(i + 1)), amount: o.amount };
    });
}

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
  state = applyBlock(
    state,
    buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] }),
  );
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
    memo: 'bob-pays-carol-25',
  });
  const tx = signTx(core, bob.private_key_pkcs8_b64, bob.public_key_spki_b64);
  state = applyBlock(
    state,
    buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] }),
  );
}

const fixture = {
  schema: 'oml/fixture-chain/v0',
  genesis: state.genesis,
  genesis_hash: state.genesis_hash,
  blocks: state.blocks,
  expected_height: state.height,
  expected_tip_hash: state.tip_hash,
  expected_state_root: state.state_root,
  expected_supply: 250,
  note: 'Deterministic fixture. Private seeds = SHA-256(OML-SEED-V0||label). Not secret material of value.',
};

mkdirSync(join(root, 'fixtures'), { recursive: true });
const path = join(root, 'fixtures', 'chain-v0.json');
writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
console.log('wrote', path);
console.log('genesis_hash', fixture.genesis_hash);
console.log('state_root  ', fixture.expected_state_root);
console.log('tip_hash    ', fixture.expected_tip_hash);
