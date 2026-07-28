#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const HOLD_ID = 'SBX-SOH-001'
export const STATUS_PATH = `operations/operator-holds/${HOLD_ID}/STATUS.json`
export const EMERGENCY_PATH = 'EMERGENCY_CURRENT_STATUS.md'
export const ORDER_PATH = `operations/operator-holds/${HOLD_ID}/ORDER.md`
export const HOLD_INDEX_PATH = 'operations/operator-holds/README.md'
export const ROUTER_PATH = 'assistant/router/routes.json'
export const EXPERIMENT_PATH = 'experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/EXPERIMENT.md'
export const REQUIRED_STATUS_SURFACES = [STATUS_PATH, EMERGENCY_PATH, ORDER_PATH, HOLD_INDEX_PATH, ROUTER_PATH, EXPERIMENT_PATH]
export const LIFECYCLE_STATES = new Set(['ACTIVE', 'LIFTED', 'NARROWED', 'SUPERSEDED'])
const TRANSITIONS_PATH = 'operations/operator-holds/transitions'
const invariant = (condition, message) => { if (!condition) throw new Error(message) }
const nonEmpty = (value, label) => invariant(typeof value === 'string' && value.trim().length >= 12, `${label} is required and must be meaningful`)
const stateLine = (source, label) => source.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*` + '`([A-Z_]+)`'))?.[1]
function transitionRecords(snapshot) { return new Map([...snapshot.files.entries()].filter(([name]) => name.startsWith(`${TRANSITIONS_PATH}/`) && name.endsWith('.json'))) }
function exactSet(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array`)
  invariant(new Set(values).size === values.length, `${label} contains duplicates`)
  invariant(values.length === expected.length && values.every((value) => expected.includes(value)), `${label} has missing or unexpected entries`)
}
export function validateStatusSurfaceAgreement(snapshot) {
  for (const required of REQUIRED_STATUS_SURFACES) invariant(snapshot.files.has(required), `required status surface missing or relocated: ${required}`)
  const status = JSON.parse(snapshot.files.get(STATUS_PATH))
  const routes = JSON.parse(snapshot.files.get(ROUTER_PATH))
  const state = status.state
  invariant(status.id === HOLD_ID, 'hold ID mismatch in STATUS.json')
  invariant(LIFECYCLE_STATES.has(state), `unknown hold lifecycle state: ${state}`)
  invariant(status.status_authority === 'NONE', 'status_authority must remain NONE')
  invariant(status.lab_impact === 'NONE', 'Lab-impact boundary must remain NONE')
  invariant(stateLine(snapshot.files.get(EMERGENCY_PATH), 'State') === state, 'root emergency surface disagrees with STATUS.json state')
  invariant(stateLine(snapshot.files.get(ORDER_PATH), 'State') === state, 'canonical order disagrees with STATUS.json state')
  invariant(snapshot.files.get(HOLD_INDEX_PATH).includes(`| \`${HOLD_ID}\` | \`${state}\``), 'hold index disagrees with STATUS.json state')
  invariant(routes.preflight?.operator_hold_states?.[HOLD_ID] === state, 'router preflight disagrees with STATUS.json state')
  invariant(routes.preflight?.active_operator_holds?.includes(HOLD_ID) === (state === 'ACTIVE'), 'router active-hold list disagrees with STATUS.json state')
  invariant(stateLine(snapshot.files.get(EXPERIMENT_PATH), 'Operator hold state') === state, 'affected experiment disagrees with STATUS.json state')
  return status
}
export function verifyCandidateRemainsActive(snapshot) {
  const status = validateStatusSurfaceAgreement(snapshot)
  invariant(status.state === 'ACTIVE', 'SBX-HOLD-INTEGRITY-001 must leave SBX-SOH-001 ACTIVE')
}
export function validateHoldTransition(base, current) {
  const baseStatus = validateStatusSurfaceAgreement(base)
  const currentStatus = validateStatusSurfaceAgreement(current)
  const baseRecords = transitionRecords(base)
  const currentRecords = transitionRecords(current)
  for (const [name, source] of baseRecords) {
    invariant(currentRecords.has(name), `historical transition record was deleted: ${name}`)
    invariant(currentRecords.get(name) === source, `historical transition record was modified: ${name}`)
  }
  const newPaths = [...currentRecords.keys()].filter((name) => !baseRecords.has(name))
  if (baseStatus.state === currentStatus.state) { invariant(newPaths.length === 0, 'a transition record cannot be added when the hold state is unchanged'); return }
  invariant(newPaths.length === 1, 'a hold-state change requires exactly one new transition record')
  const record = JSON.parse(currentRecords.get(newPaths[0]))
  invariant(record.schema === 'experimental-sandbox.operator-hold-transition/v1', 'transition record schema mismatch')
  invariant(record.hold_id === HOLD_ID, 'transition record hold ID mismatch')
  invariant(record.prior_state === baseStatus.state, 'transition record prior state mismatch')
  invariant(record.proposed_state === currentStatus.state, 'transition record proposed state mismatch')
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(record.date), 'transition record date must be YYYY-MM-DD')
  invariant(record.date === currentStatus.effective_date, 'transition record date must match STATUS.json effective_date')
  nonEmpty(record.written_operator_instruction, 'written_operator_instruction')
  nonEmpty(record.scope, 'scope')
  invariant(Array.isArray(record.source_evidence) && record.source_evidence.length > 0, 'source_evidence is required')
  record.source_evidence.forEach((item) => nonEmpty(item, 'source_evidence item'))
  exactSet(record.status_surfaces, REQUIRED_STATUS_SURFACES, 'status_surfaces')
  invariant(record.authority_note === 'HUMAN_OPERATOR_DATED_WRITTEN_INSTRUCTION_REQUIRED', 'transition record may not claim model, PR, test, or classification authority')
}
export async function filesystemSnapshot(root) {
  const files = new Map()
  for (const relative of REQUIRED_STATUS_SURFACES) files.set(relative, await readFile(path.join(root, relative), 'utf8'))
  const transitions = path.join(root, TRANSITIONS_PATH)
  if (existsSync(transitions)) for (const entry of await readdir(transitions)) files.set(`${TRANSITIONS_PATH}/${entry}`, await readFile(path.join(transitions, entry), 'utf8'))
  return { files }
}
function gitSnapshot(root, ref) {
  const names = new Set(execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', ref], { encoding: 'utf8' }).trim().split('\n').filter(Boolean))
  const files = new Map()
  for (const relative of [...REQUIRED_STATUS_SURFACES, ...names]) {
    if (!REQUIRED_STATUS_SURFACES.includes(relative) && !(relative.startsWith(`${TRANSITIONS_PATH}/`) && relative.endsWith('.json'))) continue
    invariant(names.has(relative), `required status surface missing or relocated at ${ref}: ${relative}`)
    files.set(relative, execFileSync('git', ['-C', root, 'show', `${ref}:${relative}`], { encoding: 'utf8' }))
  }
  return { files }
}
async function main() {
  const base = process.argv.indexOf('--base-ref'), head = process.argv.indexOf('--head-ref')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  if (base >= 0 || head >= 0) { invariant(base >= 0 && head >= 0, '--base-ref and --head-ref must be supplied together'); validateHoldTransition(gitSnapshot(root, process.argv[base + 1]), gitSnapshot(root, process.argv[head + 1])) }
  else verifyCandidateRemainsActive(await filesystemSnapshot(root))
  process.stdout.write('hold-transition: PASS (structure enforced; CI cannot cryptographically prove Human Operator authorship)\n')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`hold-transition: FAIL ${error.message}\n`); process.exitCode = 1 })
