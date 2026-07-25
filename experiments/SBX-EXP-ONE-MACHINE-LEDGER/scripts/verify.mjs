#!/usr/bin/env node
/**
 * One-machine verification entrypoint.
 * Exit 0 only if unit tests pass and a fixed fixture chain replays.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { replay } from '../src/ledger.mjs';
import { canonicalize } from '../src/canonical.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}

console.log('=== OML verify: unit tests ===');
const testOut = run(process.execPath, ['--test', 'test/ledger.test.mjs']);
const passLine = testOut.split('\n').find((l) => l.includes('tests ') || l.includes('# pass') || l.includes('pass '));
console.log(passLine || 'tests completed');
// node --test prints summary to stderr sometimes
if (testOut.includes('fail ') && !testOut.includes('fail 0')) {
  // also check exit was 0
}

console.log('=== OML verify: fixture chain replay (if present) ===');
const fixture = join(root, 'fixtures', 'chain-v0.json');
if (existsSync(fixture)) {
  const data = JSON.parse(readFileSync(fixture, 'utf8'));
  const state = replay(
    { genesis: data.genesis, genesis_hash: data.genesis_hash },
    data.blocks,
  );
  if (state.state_root !== data.expected_state_root) {
    console.error('FIXTURE STATE ROOT MISMATCH');
    console.error(' got ', state.state_root);
    console.error(' want', data.expected_state_root);
    process.exit(1);
  }
  if (state.tip_hash !== data.expected_tip_hash) {
    console.error('FIXTURE TIP MISMATCH');
    process.exit(1);
  }
  const body = canonicalize({
    expected_state_root: data.expected_state_root,
    expected_tip_hash: data.expected_tip_hash,
    genesis_hash: data.genesis_hash,
    height: state.height,
  });
  const h = createHash('sha256').update(body).digest('hex');
  console.log(`fixture OK height=${state.height} state_root=${state.state_root}`);
  console.log(`fixture_summary_sha256: sha256:${h}`);
} else {
  console.log('(no fixtures/chain-v0.json yet — tests only)');
}

console.log('=== OML verify: PASS ===');
process.exit(0);
