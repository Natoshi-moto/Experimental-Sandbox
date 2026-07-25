/**
 * Extended adversarial corpus (E08+) — push the kernel harder.
 * status_authority: NONE
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateIdentity, hashCanonical } from '../src/crypto.mjs';
import {
  LedgerError,
  applyBlock,
  applyTx,
  buildBlock,
  buildGenesis,
  signTx,
  txCore,
  MAX_HEIGHT,
} from '../src/ledger.mjs';

function fresh(n = 2, amount = 100) {
  const ids = Array.from({ length: n }, () => generateIdentity());
  const state = buildGenesis({
    allocations: ids.map((id, i) => ({
      amount,
      owner_label: `o${i}`,
      public_key_spki_b64: id.public_key_spki_b64,
    })),
    note: 'adv-max',
  });
  return { ids, state };
}

function outpointParts(key) {
  const i = key.lastIndexOf(':');
  return { txid: key.slice(0, i), index: Number(key.slice(i + 1)) };
}

test('E08 duplicate txid in same block rejected', () => {
  const { ids, state } = fresh(1, 100);
  const bob = generateIdentity();
  const [key] = state.utxo.keys();
  const { txid, index } = outpointParts(key);
  const core = txCore({
    inputs: [{ txid, index }],
    outputs: [{ amount: 100, public_key_spki_b64: bob.public_key_spki_b64 }],
    memo: 'once',
  });
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  const block = buildBlock({
    prev_hash: state.tip_hash,
    height: 1,
    transactions: [tx, structuredClone(tx)],
  });
  assert.throws(() => applyBlock(state, block), (e) => e instanceof LedgerError && e.code === 'DUP_TX');
});

test('E09 height jump rejected', () => {
  const { ids, state } = fresh(2, 50);
  const [key] = [...state.utxo.entries()].find(([, o]) => o.owner_key_id === ids[0].key_id);
  const { txid, index } = outpointParts(key);
  const core = txCore({
    inputs: [{ txid, index }],
    outputs: [{ amount: 50, public_key_spki_b64: ids[1].public_key_spki_b64 }],
  });
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  const block = buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] });
  assert.throws(() => applyBlock(state, block), (e) => e instanceof LedgerError && e.code === 'CHAIN');
});

test('E10 block hash tamper rejected', () => {
  const { ids, state } = fresh(2, 50);
  const [key] = [...state.utxo.entries()].find(([, o]) => o.owner_key_id === ids[0].key_id);
  const { txid, index } = outpointParts(key);
  const core = txCore({
    inputs: [{ txid, index }],
    outputs: [{ amount: 50, public_key_spki_b64: ids[1].public_key_spki_b64 }],
  });
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  const block = buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] });
  block.block_hash = hashCanonical({ evil: 1 }, 'OML-BLOCK-V0');
  assert.throws(() => applyBlock(state, block), (e) => e instanceof LedgerError && e.code === 'BLOCK');
});

test('E11 wrong protocol id rejected', () => {
  const { ids, state } = fresh(1, 10);
  const bob = generateIdentity();
  const [key] = state.utxo.keys();
  const { txid, index } = outpointParts(key);
  const core = txCore({
    inputs: [{ txid, index }],
    outputs: [{ amount: 10, public_key_spki_b64: bob.public_key_spki_b64 }],
  });
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  tx.core.protocol = 'btc/cosplay';
  // core hash will mismatch first
  assert.throws(() => applyTx(state.utxo, tx), (e) => e instanceof LedgerError && (e.code === 'TX' || e.code === 'BAD_SIG'));
});

test('E12 empty block rejected', () => {
  const { state } = fresh(1, 1);
  assert.throws(
    () => buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [] }),
    (e) => e instanceof LedgerError && e.code === 'BLOCK',
  );
});

test('E13 max height boundary enforced', () => {
  const { ids, state } = fresh(1, 1);
  const bob = generateIdentity();
  const [key] = state.utxo.keys();
  const { txid, index } = outpointParts(key);
  const core = txCore({
    inputs: [{ txid, index }],
    outputs: [{ amount: 1, public_key_spki_b64: bob.public_key_spki_b64 }],
  });
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  assert.throws(
    () => buildBlock({ prev_hash: state.tip_hash, height: MAX_HEIGHT + 1, transactions: [tx] }),
    (e) => e instanceof LedgerError && e.code === 'BLOCK',
  );
});

test('E14 conservation of supply across multi-hop path', () => {
  const { ids, state: g } = fresh(3, 100);
  let state = g;
  // 0 -> 1
  {
    const owned = [...state.utxo.entries()].filter(([, o]) => o.owner_key_id === ids[0].key_id);
    const inputs = owned.map(([k]) => outpointParts(k));
    const total = owned.reduce((s, [, o]) => s + o.amount, 0);
    const core = txCore({
      inputs,
      outputs: [{ amount: total, public_key_spki_b64: ids[1].public_key_spki_b64 }],
      memo: 'hop1',
    });
    const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
    state = applyBlock(state, buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] }));
  }
  // 1 -> 2
  {
    const owned = [...state.utxo.entries()].filter(([, o]) => o.owner_key_id === ids[1].key_id);
    const inputs = owned.map(([k]) => outpointParts(k));
    const total = owned.reduce((s, [, o]) => s + o.amount, 0);
    const core = txCore({
      inputs,
      outputs: [{ amount: total, public_key_spki_b64: ids[2].public_key_spki_b64 }],
      memo: 'hop2',
    });
    const tx = signTx(core, ids[1].private_key_pkcs8_b64, ids[1].public_key_spki_b64);
    state = applyBlock(state, buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] }));
  }
  let supply = 0;
  for (const o of state.utxo.values()) supply += o.amount;
  assert.equal(supply, 300);
});
