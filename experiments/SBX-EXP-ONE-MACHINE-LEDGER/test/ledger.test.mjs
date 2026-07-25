import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalize, parseCanonical } from '../src/canonical.mjs';
import { generateIdentity, hashCanonical, signCanonical, verifyCanonical } from '../src/crypto.mjs';
import {
  LedgerError,
  applyBlock,
  applyTx,
  buildBlock,
  buildGenesis,
  exportSnapshot,
  replay,
  signTx,
  stateRoot,
  txCore,
  UNIT,
} from '../src/ledger.mjs';

function identities(n) {
  return Array.from({ length: n }, () => generateIdentity());
}

function freshGenesis(count = 3, amount = 100) {
  const ids = identities(count);
  const state = buildGenesis({
    allocations: ids.map((id, i) => ({
      amount,
      owner_label: `owner-${i}`,
      public_key_spki_b64: id.public_key_spki_b64,
    })),
    note: 'test-genesis',
  });
  return { ids, state };
}

function spendAll(state, id, toSpki, memo = 'pay') {
  const owned = [...state.utxo.entries()].filter(([, o]) => o.owner_key_id === id.key_id);
  assert.ok(owned.length >= 1, 'needs coins');
  const inputs = owned.map(([key]) => {
    const [txid, index] = key.split(':');
    // outpoint is sha256:hex:index — hash has a colon
    const lastColon = key.lastIndexOf(':');
    const txidFull = key.slice(0, lastColon);
    const idx = Number(key.slice(lastColon + 1));
    return { txid: txidFull, index: idx };
  });
  const amount = owned.reduce((s, [, o]) => s + o.amount, 0);
  const core = txCore({
    inputs,
    outputs: [{ amount, public_key_spki_b64: toSpki }],
    memo,
  });
  return signTx(core, id.private_key_pkcs8_b64, id.public_key_spki_b64);
}

test('canonical JSON is stable and rejects non-canonical', () => {
  const obj = { b: 2, a: 1 };
  const c = canonicalize(obj);
  assert.equal(c, '{"a":1,"b":2}');
  assert.deepEqual(parseCanonical(c), { a: 1, b: 2 });
  assert.throws(() => parseCanonical('{ "a": 1 }'), /canonical/);
  assert.throws(() => canonicalize({ x: 1.5 }), /safe integers/);
  assert.throws(() => canonicalize({ x: -0 }), /safe integers/);
});

test('genesis allocates conserved supply and deterministic hash', () => {
  const { ids, state } = freshGenesis(2, 50);
  assert.equal(state.height, 0);
  assert.equal(state.utxo.size, 2);
  let supply = 0;
  for (const out of state.utxo.values()) supply += out.amount;
  assert.equal(supply, 100);
  assert.equal(state.state_root, stateRoot(0, state.tip_hash, state.utxo));
  const again = buildGenesis({
    allocations: ids.map((id, i) => ({
      amount: 50,
      owner_label: `owner-${i}`,
      public_key_spki_b64: id.public_key_spki_b64,
    })),
    note: 'test-genesis',
  });
  assert.equal(again.genesis_hash, state.genesis_hash);
  assert.equal(again.state_root, state.state_root);
});

test('happy path: signed transfer, block, state root advances', () => {
  const { ids, state } = freshGenesis(2, 100);
  const [alice, bob] = ids;
  const tx = spendAll(state, alice, bob.public_key_spki_b64, 'alice-to-bob');
  const block = buildBlock({
    prev_hash: state.tip_hash,
    height: 1,
    transactions: [tx],
  });
  const next = applyBlock(state, block);
  assert.equal(next.height, 1);
  assert.equal(next.tip_hash, block.block_hash);
  assert.notEqual(next.state_root, state.state_root);
  let bobBal = 0;
  let aliceBal = 0;
  for (const out of next.utxo.values()) {
    if (out.owner_key_id === bob.key_id) bobBal += out.amount;
    if (out.owner_key_id === alice.key_id) aliceBal += out.amount;
  }
  assert.equal(aliceBal, 0);
  assert.equal(bobBal, 200);
});

test('E01 double-spend of same outpoint rejected', () => {
  const { ids, state } = freshGenesis(1, 100);
  const [alice] = ids;
  const other = generateIdentity();
  const tx1 = spendAll(state, alice, other.public_key_spki_b64, 'first');
  const utxoAfter = applyTx(state.utxo, tx1);
  assert.throws(() => applyTx(utxoAfter, tx1), (e) => e instanceof LedgerError && e.code === 'MISSING_UTXO');
});

test('E02 conservation violation rejected', () => {
  const { ids, state } = freshGenesis(1, 100);
  const [alice] = ids;
  const bob = generateIdentity();
  const [outpoint] = state.utxo.keys();
  const lastColon = outpoint.lastIndexOf(':');
  const core = txCore({
    inputs: [{ txid: outpoint.slice(0, lastColon), index: Number(outpoint.slice(lastColon + 1)) }],
    outputs: [
      { amount: 60, public_key_spki_b64: bob.public_key_spki_b64 },
      { amount: 50, public_key_spki_b64: alice.public_key_spki_b64 },
    ],
  });
  const tx = signTx(core, alice.private_key_pkcs8_b64, alice.public_key_spki_b64);
  assert.throws(() => applyTx(state.utxo, tx), (e) => e instanceof LedgerError && e.code === 'CONSERVATION');
});

test('E03 not-owner spend rejected', () => {
  const { ids, state } = freshGenesis(2, 100);
  const [, bob] = ids;
  const thief = generateIdentity();
  const [outpoint, coin] = [...state.utxo.entries()].find(([, o]) => o.owner_key_id !== bob.key_id);
  const lastColon = outpoint.lastIndexOf(':');
  const core = txCore({
    inputs: [{ txid: outpoint.slice(0, lastColon), index: Number(outpoint.slice(lastColon + 1)) }],
    outputs: [{ amount: coin.amount, public_key_spki_b64: thief.public_key_spki_b64 }],
  });
  const tx = signTx(core, bob.private_key_pkcs8_b64, bob.public_key_spki_b64);
  assert.throws(() => applyTx(state.utxo, tx), (e) => e instanceof LedgerError && e.code === 'NOT_OWNER');
});

test('E04 bad signature rejected', () => {
  const { ids, state } = freshGenesis(1, 100);
  const [alice] = ids;
  const bob = generateIdentity();
  const tx = spendAll(state, alice, bob.public_key_spki_b64);
  tx.signature_b64 = Buffer.alloc(64).toString('base64');
  assert.throws(() => applyTx(state.utxo, tx), (e) => e instanceof LedgerError && e.code === 'BAD_SIG');
});

test('E05 wrong chain linkage rejected', () => {
  const { ids, state } = freshGenesis(2, 50);
  const tx = spendAll(state, ids[0], ids[1].public_key_spki_b64);
  const block = buildBlock({
    prev_hash: hashCanonical({ fake: 1 }),
    height: 1,
    transactions: [tx],
  });
  assert.throws(() => applyBlock(state, block), (e) => e instanceof LedgerError && e.code === 'CHAIN');
});

test('E06 unknown field / non-canonical object style fails exact keys', () => {
  const { ids, state } = freshGenesis(1, 10);
  const bob = generateIdentity();
  const tx = spendAll(state, ids[0], bob.public_key_spki_b64);
  const poisoned = { ...tx, evil: true };
  assert.throws(() => applyTx(state.utxo, poisoned), (e) => e instanceof LedgerError && e.code === 'BAD_FIELDS');
});

test('E07 duplicate inputs in one tx rejected', () => {
  const { ids, state } = freshGenesis(1, 100);
  const [alice] = ids;
  const bob = generateIdentity();
  const [outpoint] = state.utxo.keys();
  const lastColon = outpoint.lastIndexOf(':');
  const inp = { txid: outpoint.slice(0, lastColon), index: Number(outpoint.slice(lastColon + 1)) };
  assert.throws(
    () =>
      txCore({
        inputs: [inp, { ...inp }],
        outputs: [{ amount: 100, public_key_spki_b64: bob.public_key_spki_b64 }],
      }),
    (e) => e instanceof LedgerError && e.code === 'DUP_INPUT',
  );
});

test('replay matches live state root (one-machine proof)', () => {
  const { ids, state: g } = freshGenesis(3, 40);
  let state = g;
  const blocks = [];
  // height 1: id0 -> id1
  {
    const tx = spendAll(state, ids[0], ids[1].public_key_spki_b64, 'h1');
    const block = buildBlock({ prev_hash: state.tip_hash, height: 1, transactions: [tx] });
    state = applyBlock(state, block);
    blocks.push(block);
  }
  // height 2: id1 sends some to id2 (split)
  {
    const owned = [...state.utxo.entries()].filter(([, o]) => o.owner_key_id === ids[1].key_id);
    const inputs = owned.map(([key]) => {
      const lastColon = key.lastIndexOf(':');
      return { txid: key.slice(0, lastColon), index: Number(key.slice(lastColon + 1)) };
    });
    const total = owned.reduce((s, [, o]) => s + o.amount, 0);
    const core = txCore({
      inputs,
      outputs: [
        { amount: 25, public_key_spki_b64: ids[2].public_key_spki_b64 },
        { amount: total - 25, public_key_spki_b64: ids[1].public_key_spki_b64 },
      ],
      memo: 'split',
    });
    const tx = signTx(core, ids[1].private_key_pkcs8_b64, ids[1].public_key_spki_b64);
    const block = buildBlock({ prev_hash: state.tip_hash, height: 2, transactions: [tx] });
    state = applyBlock(state, block);
    blocks.push(block);
  }
  const rebuilt = replay(
    {
      genesis: g.genesis,
      genesis_hash: g.genesis_hash,
      utxo: g.utxo,
      state_root: g.state_root,
    },
    blocks,
  );
  assert.equal(rebuilt.state_root, state.state_root);
  assert.equal(rebuilt.tip_hash, state.tip_hash);
  assert.equal(rebuilt.height, 2);
  const snap = exportSnapshot(state);
  assert.equal(snap.unit, UNIT);
  assert.equal(snap.utxo.length, state.utxo.size);
});

test('signature binds domain-separated payload', () => {
  const id = generateIdentity();
  const core = { hello: 1, protocol: 'oml/v0' };
  const sig = signCanonical(core, id.private_key_pkcs8_b64);
  assert.equal(verifyCanonical(core, sig, id.public_key_spki_b64), true);
  assert.equal(verifyCanonical({ hello: 2, protocol: 'oml/v0' }, sig, id.public_key_spki_b64), false);
});
