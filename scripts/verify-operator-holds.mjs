#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function checkRelativeLinks(relativePath, source) {
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^(https?:|mailto:)/.test(target)) continue
    const resolved = path.resolve(ROOT, path.dirname(relativePath), target)
    invariant(resolved.startsWith(`${ROOT}${path.sep}`), `${relativePath} has an out-of-repository relative link: ${target}`)
    invariant(existsSync(resolved), `${relativePath} has a broken relative link: ${target}`)
  }
}

async function text(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8')
}

const statusPath = 'operations/operator-holds/SBX-SOH-001/STATUS.json'
const status = JSON.parse(await text(statusPath))

invariant(status.schema === 'experimental-sandbox.operator-hold/v1', 'unexpected operator-hold schema')
invariant(status.id === 'SBX-SOH-001', 'unexpected operator-hold id')
invariant(status.state === 'ACTIVE', 'SBX-SOH-001 must remain ACTIVE until a dated written operator change')
invariant(status.activated_by === 'HUMAN_OPERATOR_RING_0', 'unexpected hold activator')
invariant(status.process_authority === 'SANDBOX_OPERATOR_HOLD', 'missing Sandbox process authority')
invariant(status.status_authority === 'NONE', 'operator hold must not claim status authority')
invariant(status.lab_impact === 'NONE', 'operator hold must not claim Lab impact')
invariant(status.lift_authority === 'HUMAN_OPERATOR_RING_0_DATED_WRITTEN_ONLY', 'hold lift authority widened')
invariant(status.affected_experiments.includes('SBX-EXP-001'), 'affected experiment missing')
invariant(status.classification_template === 'operations/operator-holds/SBX-SOH-001/CHANGE_CLASSIFICATION.md', 'classification template pointer missing')
invariant(status.open_pr_policy === 'NO_MERGE_IF_IN_SCOPE_UNLESS_OPERATOR_AUTHORIZED_HOLD_ACTIVATION_OR_EXPLICIT_SBX_SOH_001_CLASSIFICATION', 'open PR policy weakened')

const requiredReferences = [
  'README.md',
  'CHARTER.md',
  'CONTRIBUTING.md',
  'HANDOFF_ANY_AI.md',
  'board/README.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/experiment.yml',
  'assistant/ROUTER_CONTRACT.md',
  'assistant/app/index.html',
  'assistant/skills/catch-chaos/SKILL.md',
  'assistant/skills/run-public-experiment/SKILL.md',
  'assistant/skills/publish-fastfoodai/SKILL.md',
  'assistant/skills/request-lab-promotion/SKILL.md',
  'templates/EXPERIMENT.md',
  'experiments/INDEX.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/README.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/EXPERIMENT.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/KNOWN_ISSUES.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/NON_CLAIMS.md'
]

for (const relativePath of requiredReferences) {
  const source = await text(relativePath)
  invariant(source.includes('SBX-SOH-001'), `${relativePath} does not reference active hold`)
}

const emergency = await text('EMERGENCY_CURRENT_STATUS.md')
invariant(emergency.includes('**State:** `ACTIVE`'), 'root emergency status is not active')
invariant(emergency.includes('Scientific/canonical status authority:** `NONE`'), 'root status authority boundary missing')
invariant(emergency.includes('Nexus Lab impact:** `NONE`'), 'root Lab boundary missing')
invariant((await text('README.md')).includes('[root emergency status](EMERGENCY_CURRENT_STATUS.md)'), 'README must link to root emergency status')
invariant(emergency.includes('](operations/operator-holds/SBX-SOH-001/ORDER.md)'), 'root emergency must link to canonical order')
invariant(emergency.includes('](operations/operator-holds/SBX-SOH-001/STATUS.json)'), 'root emergency must link to machine status')
checkRelativeLinks('EMERGENCY_CURRENT_STATUS.md', emergency)

const order = await text('operations/operator-holds/SBX-SOH-001/ORDER.md')
for (const requiredPhrase of [
  'A future service credit would have functional utility',
  'Private exchange cannot be eliminated by declaration',
  'Repository history is evidence, not adequate current disclosure',
  'Only the Human Operator may lift, narrow, or supersede this order',
  'OPERATOR_AUTHORIZED_HOLD_ACTIVATION'
]) {
  invariant(order.includes(requiredPhrase), `canonical order lost required boundary: ${requiredPhrase}`)
}

const authorization = await text('operations/operator-holds/SBX-SOH-001/RAW_OPERATOR_AUTHORIZATION.md')
invariant(authorization.includes('Voice-session publication:** `NOT_AUTHORIZED`'), 'voice-publication boundary missing')
invariant(authorization.includes('Merge it into sandbox'), 'written authorization missing')

const routes = JSON.parse(await text('assistant/router/routes.json'))
invariant(routes.preflight?.required_status_file === 'EMERGENCY_CURRENT_STATUS.md', 'router emergency preflight missing')
invariant(routes.preflight?.active_operator_holds?.includes('SBX-SOH-001'), 'router active hold missing')
invariant(routes.preflight?.operator_hold_states?.['SBX-SOH-001'] === 'ACTIVE', 'router hold-state surface missing or inconsistent')
for (const boundary of [
  'BYPASS_ACTIVE_OPERATOR_HOLD',
  'ACTIVATE_HELD_ECONOMY',
  'PUBLISH_HELD_DESIGN_AS_APPROVED',
  'PROMOTE_HELD_DIRECTION_TO_LAB'
]) {
  invariant(routes.forbidden.includes(boundary), `router boundary missing: ${boundary}`)
}

for (const relativePath of [
  'experiments/INDEX.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/README.md',
  'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/EXPERIMENT.md'
]) {
  const source = await text(relativePath)
  invariant(source.includes('OPERATOR_HOLD_RESEARCH_ONLY'), `${relativePath} does not expose research-only hold state`)
}
invariant((await text('experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/EXPERIMENT.md')).includes('**Operator hold state:** `ACTIVE`'), 'affected experiment hold state is inconsistent')

const knownIssues = await text('experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/KNOWN_ISSUES.md')
invariant(knownIssues.includes('specific to this frozen simulator'), 'current simulation is not distinguished from future service credit')
invariant(knownIssues.includes('functional utility'), 'future service-credit utility acknowledgement missing')

process.stdout.write(`operator-holds: PASS (${status.id} ${status.state}; ${requiredReferences.length} referenced surfaces)\n`)
