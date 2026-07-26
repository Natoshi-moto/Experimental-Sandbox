/**
 * Paste-bus golden corpus: adversarial fixtures must yield INVALID;
 * Drop payload rider must yield VALID with pinned state_root.
 * status_authority: NONE
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inspect = join(root, 'scripts/oml-inspect.mjs');
const PINNED_ROOT =
  'sha256:e74fb138395a5b96fc83785b36c23cc5b79e88fdccb27fbed25e0d661b3f01b2';

function runInspect(relPath) {
  const r = spawnSync(process.execPath, [inspect, join(root, relPath)], {
    encoding: 'utf8',
  });
  const text = (r.stdout || '') + (r.stderr || '');
  let receipt;
  try {
    receipt = JSON.parse(r.stdout || '{}');
  } catch {
    receipt = { parse_error: true, raw: text };
  }
  return { code: r.status, receipt, text };
}

// Every known adversarial paste and the exact fail-closed code it must produce.
const EXPECTED_CODES = {
  'bad-sig.json': 'BAD_SIG',
  'blocks-not-array.json': 'BAD_ARRAY',
  'broken-parent.json': 'CHAIN',
  'empty-block-append.json': 'BLOCK',
  'float-amount.json': 'GENESIS',
  'height-lie.json': 'HEIGHT_MISMATCH',
  'inflated-supply.json': 'SUPPLY_MISMATCH',
  'poison-state-root.json': 'STATE_ROOT_MISMATCH',
  'smuggled-alloc-field.json': 'BAD_FIELDS',
  'smuggled-block-field.json': 'BAD_FIELDS',
  'smuggled-genesis-field.json': 'BAD_FIELDS',
  'tip-lie.json': 'TIP_MISMATCH',
  'unsafe-integer-amount.json': 'GENESIS',
  'wrong-protocol.json': 'GENESIS',
  'zero-amount.json': 'GENESIS',
};

test('adversarial paste corpus: every file is INVALID with its expected code', () => {
  const dir = join(root, 'fixtures/adversarial');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.length >= 15, `expected ≥15 adversarial fixtures, got ${files.length}`);
  for (const f of files) {
    const { code, receipt } = runInspect(`fixtures/adversarial/${f}`);
    assert.notEqual(code, 0, `${f} should exit non-zero`);
    assert.equal(receipt.kind, 'OML_VERIFY_RECEIPT', f);
    assert.equal(receipt.status, 'INVALID', f);
    assert.equal(receipt.status_authority, 'NONE', f);
    assert.ok(typeof receipt.error_code === 'string' && receipt.error_code.length > 0, f);
    if (EXPECTED_CODES[f]) {
      assert.equal(receipt.error_code, EXPECTED_CODES[f], `${f} error_code`);
    }
  }
});

test('Drop payload rider: VALID + pinned state_root', () => {
  const { code, receipt } = runInspect('fixtures/drop-payload-rider.json');
  assert.equal(code, 0);
  assert.equal(receipt.status, 'VALID');
  assert.equal(receipt.state_root, PINNED_ROOT);
  assert.equal(receipt.supply, 250);
  assert.equal(receipt.unit, 'OML_UNIT');
  assert.match(String(receipt.shape), /payload/);
});

test('good fixture still VALID', () => {
  const { code, receipt } = runInspect('fixtures/chain-v0.json');
  assert.equal(code, 0);
  assert.equal(receipt.status, 'VALID');
  assert.equal(receipt.state_root, PINNED_ROOT);
});
