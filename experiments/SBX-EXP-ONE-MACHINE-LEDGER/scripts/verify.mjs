#!/usr/bin/env node
/**
 * One-machine MAX verification entrypoint.
 *
 * Exit 0 only if:
 *   1) Node unit tests (core + adversarial-max + paste-corpus)
 *   2) Fixture chain replay (Node)
 *   3) Python dual-implementation agrees on state_root
 *   4) Multi-process file-bus toy net agrees + rejects poison
 *
 * status_authority: NONE
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { replay } from '../src/ledger.mjs';
import { canonicalize } from '../src/canonical.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  OML MAX VERIFY — one machine, zero real value   ║');
console.log('║  status_authority: NONE                          ║');
console.log('╚══════════════════════════════════════════════════╝');

// 1) Unit tests
console.log('\n=== [1/4] Node unit tests ===');
const testOut = run(process.execPath, [
  '--test',
  'test/ledger.test.mjs',
  'test/adversarial-max.test.mjs',
  'test/safety-max.test.mjs',
  'test/paste-corpus.test.mjs',
]);
const passMatch = testOut.match(/# pass\s+(\d+)/) || testOut.match(/ℹ pass (\d+)/);
const testsMatch = testOut.match(/# tests\s+(\d+)/) || testOut.match(/ℹ tests (\d+)/);
console.log(testsMatch ? `tests ${testsMatch[1]}` : 'tests completed');
console.log(passMatch ? `pass ${passMatch[1]}` : '');
if (testOut.includes('# fail') && !testOut.includes('# fail 0') && !testOut.includes('fail 0')) {
  // node --test uses "ℹ fail 0"
}
if (/\bfail [1-9]/.test(testOut) || /# fail\s+[1-9]/.test(testOut)) {
  console.error('unit tests reported failures');
  process.exit(1);
}

// 2) Fixture replay
console.log('\n=== [2/4] Node fixture replay ===');
const fixture = join(root, 'fixtures', 'chain-v0.json');
if (!existsSync(fixture)) {
  console.error('missing fixtures/chain-v0.json');
  process.exit(1);
}
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
if (state.height !== data.expected_height) {
  console.error('FIXTURE HEIGHT MISMATCH');
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

// 3) Python dual
console.log('\n=== [3/4] Python dual-implementation ===');
const dualOut = run('python3', ['dual/python/verify_fixture.py']);
process.stdout.write(dualOut);

// 4) Multi-process toy net
console.log('\n=== [4/4] Multi-process file-bus toy net ===');
const toyOut = run(process.execPath, ['scripts/toynet-bus.mjs']);
// keep output shorter
for (const line of toyOut.split('\n')) {
  if (
    line.startsWith('===') ||
    line.startsWith('[') ||
    line.startsWith('bus_dir') ||
    line.startsWith('model:') ||
    line.includes('TOYNET') ||
    line.includes('agreement')
  ) {
    console.log(line);
  }
}
if (!toyOut.includes('TOYNET PASS')) {
  console.error('toynet did not report PASS');
  process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  OML MAX VERIFY: PASS                            ║');
console.log('║  Node + Python cross-impl + multi-process agree  ║');
console.log('║  Poison claims rejected. Lab untouched.          ║');
console.log('╚══════════════════════════════════════════════════╝');
process.exit(0);
