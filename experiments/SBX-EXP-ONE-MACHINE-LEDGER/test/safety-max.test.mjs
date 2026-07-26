/**
 * SAFETY MAX corpus (E15+) — fail-closed hardening for pasted data:
 * numeric edges, smuggled fields on replay paths, crafted blocks, supply pin.
 * status_authority: NONE
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateIdentity, hashCanonical } from '../src/crypto.mjs';
import {
  LedgerError,
  applyBlock,
  buildBlock,
  buildGenesis,
  replay,
  signTx,
  txCore,
} from '../src/ledger.mjs';

function fresh(n = 2, amount = 100) {
  const ids = Array.from({ length: n }, () => generateIdentity());
  const state = buildGenesis({
    allocations: ids.map((id, i) => ({
      amount,
      owner_label: `o${i}`,
      public_key_spki_b64: id.public_key_spki_b64,
    })),
    note: 'safety-max',
  });
  return { ids, state };
}

function outpointParts(key) {
  const i = key.lastIndexOf(':');
  return { txid: key.slice(0, i), index: Number(key.slice(i + 1)) };
}

function firstSpend(ids, state, mutateOutputs) {
  const [key] = [...state.utxo.entries()].find(([, o]) => o.owner_key_id === ids[0].key_id);
  const { txid, index } = outpointParts(key);
  const outputs = mutateOutputs ?? [
    { amount: 100, public_key_spki_b64: ids[1].public_key_spki_b64 },
  ];
  return txCore({ inputs: [{ txid, index }], outputs });
}

test('E15 float amount rejected in genesis and tx outputs', () => {
  const id = generateIdentity();
  assert.throws(
    () =>
      buildGenesis({
        allocations: [
          { amount: 10.5, owner_label: 'a', public_key_spki_b64: id.public_key_spki_b64 },
        ],
      }),
    (e) => e instanceof LedgerError && e.code === 'GENESIS',
  );
  const { ids, state } = fresh(2, 100);
  assert.throws(
    () => firstSpend(ids, state, [{ amount: 50.5, public_key_spki_b64: ids[1].public_key_spki_b64 }]),
    (e) => e instanceof LedgerError && e.code === 'TX',
  );
});

test('E16 zero amount rejected in genesis and tx outputs', () => {
  const id = generateIdentity();
  assert.throws(
    () =>
      buildGenesis({
        allocations: [
          { amount: 0, owner_label: 'a', public_key_spki_b64: id.public_key_spki_b64 },
        ],
      }),
    (e) => e instanceof LedgerError && e.code === 'GENESIS',
  );
  const { ids, state } = fresh(2, 100);
  assert.throws(
    () => firstSpend(ids, state, [{ amount: 0, public_key_spki_b64: ids[1].public_key_spki_b64 }]),
    (e) => e instanceof LedgerError && e.code === 'TX',
  );
});

test('E17 unsafe integer amount rejected in genesis and tx outputs', () => {
  const id = generateIdentity();
  const unsafe = Number.MAX_SAFE_INTEGER + 2;
  assert.throws(
    () =>
      buildGenesis({
        allocations: [
          { amount: unsafe, owner_label: 'a', public_key_spki_b64: id.public_key_spki_b64 },
        ],
      }),
    (e) => e instanceof LedgerError && e.code === 'GENESIS',
  );
  const { ids, state } = fresh(2, 100);
  assert.throws(
    () =>
      firstSpend(ids, state, [
        { amount: unsafe, public_key_spki_b64: ids[1].public_key_spki_b64 },
      ]),
    (e) => e instanceof LedgerError && e.code === 'TX',
  );
});

test('E18 smuggled field on pasted genesis body rejected at replay', () => {
  const { state } = fresh(1, 100);
  const genesis = structuredClone(state.genesis);
  genesis.premine_bonus = 999999;
  assert.throws(
    () => replay({ genesis, genesis_hash: state.genesis_hash }, []),
    (e) => e instanceof LedgerError && e.code === 'BAD_FIELDS',
  );
});

test('E19 smuggled field on genesis allocation row rejected at replay', () => {
  const { state } = fresh(1, 100);
  const genesis = structuredClone(state.genesis);
  genesis.allocations[0].vip = true;
  assert.throws(
    () => replay({ genesis, genesis_hash: state.genesis_hash }, []),
    (e) => e instanceof LedgerError && e.code === 'BAD_FIELDS',
  );
});

test('E20 smuggled field on block rejected at applyBlock', () => {
  const { ids, state } = fresh(2, 100);
  const core = firstSpend(ids, state);
  const tx = signTx(core, ids[0].private_key_pkcs8_b64, ids[0].public_key_spki_b64);
  const block = buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] });
  block.miner_tip = 50;
  assert.throws(
    () => applyBlock(state, block),
    (e) => e instanceof LedgerError && e.code === 'BAD_FIELDS',
  );
});

test('E21 crafted empty block (bypassing buildBlock) rejected at applyBlock', () => {
  const { state } = fresh(1, 100);
  const body = {
    height: 1,
    prev_hash: state.tip_hash,
    protocol: 'oml/v0',
    transactions: [],
    unit: 'OML_UNIT',
  };
  const block = { ...body, block_hash: hashCanonical(body, 'OML-BLOCK-V0') };
  assert.throws(
    () => applyBlock(state, block),
    (e) => e instanceof LedgerError && e.code === 'BLOCK',
  );
});

test('E22 non-array blocks rejected at replay', () => {
  const { state } = fresh(1, 100);
  assert.throws(
    () => replay({ genesis: state.genesis, genesis_hash: state.genesis_hash }, { 0: {} }),
    (e) => e instanceof LedgerError && e.code === 'BAD_ARRAY',
  );
});

test('E23 genesis supply pin: replay supply equals allocation sum; key-id lie rejected', () => {
  const { ids, state: g } = fresh(3, 100);
  let state = g;
  for (let hop = 0; hop < 2; hop += 1) {
    const owned = [...state.utxo.entries()].filter(([, o]) => o.owner_key_id === ids[hop].key_id);
    const inputs = owned.map(([k]) => outpointParts(k));
    const total = owned.reduce((s, [, o]) => s + o.amount, 0);
    const core = txCore({
      inputs,
      outputs: [{ amount: total, public_key_spki_b64: ids[hop + 1].public_key_spki_b64 }],
      memo: `hop${hop + 1}`,
    });
    const tx = signTx(core, ids[hop].private_key_pkcs8_b64, ids[hop].public_key_spki_b64);
    state = applyBlock(
      state,
      buildBlock({ prev_hash: state.tip_hash, height: hop + 1, transactions: [tx] }),
    );
  }
  const replayed = replay({ genesis: g.genesis, genesis_hash: g.genesis_hash }, state.blocks);
  const supply = [...replayed.utxo.values()].reduce((s, o) => s + o.amount, 0);
  const genesisSupply = replayed.genesis.allocations.reduce((s, a) => s + a.amount, 0);
  assert.equal(supply, genesisSupply);
  assert.equal(supply, 300);

  // Pasted genesis lying about owner_key_id must fail closed.
  const lied = structuredClone(g.genesis);
  lied.allocations[0].owner_key_id = 'sha256:' + 'cd'.repeat(32);
  assert.throws(
    () => replay({ genesis: lied, genesis_hash: g.genesis_hash }, []),
    (e) => e instanceof LedgerError && e.code === 'GENESIS',
  );
});
