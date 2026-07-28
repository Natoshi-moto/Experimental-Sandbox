#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { validatePullRequestClassification } from './verify-pr-classification.mjs'
import { HOLD_ID, STATUS_PATH, EMERGENCY_PATH, ORDER_PATH, HOLD_INDEX_PATH, ROUTER_PATH, EXPERIMENT_PATH, REQUIRED_STATUS_SURFACES, filesystemSnapshot, validateHoldTransition, validateStatusSurfaceAgreement, verifyCandidateRemainsActive } from './verify-hold-transition.mjs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reject = (fn, pattern) => { try { fn() } catch (error) { if (pattern.test(error.message)) return; throw error } throw new Error(`expected rejection: ${pattern}`) }
const clone = (snapshot) => ({ files: new Map(snapshot.files) })
const body = (classification = 'OUT_OF_SCOPE', reason = 'This changes only deterministic repository verification documentation.', evidence = 'path: scripts/verify.sh:20 explains the bounded verification anchor.') => `- Hold classification: \`${classification}\`\n- Exact hold reason: ${reason}\n- Hold evidence/diff anchors: ${evidence}`
function withState(snapshot, state, date = '2026-08-01') {
  const result = clone(snapshot)
  const status = JSON.parse(result.files.get(STATUS_PATH)); status.state = state; status.effective_date = date; result.files.set(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`)
  result.files.set(EMERGENCY_PATH, result.files.get(EMERGENCY_PATH).replace('**State:** `ACTIVE`', `**State:** \`${state}\``))
  result.files.set(ORDER_PATH, result.files.get(ORDER_PATH).replace('**State:** `ACTIVE`', `**State:** \`${state}\``))
  result.files.set(HOLD_INDEX_PATH, result.files.get(HOLD_INDEX_PATH).replace('| `SBX-SOH-001` | `ACTIVE`', `| \`SBX-SOH-001\` | \`${state}\``))
  const routes = JSON.parse(result.files.get(ROUTER_PATH)); routes.preflight.operator_hold_states[HOLD_ID] = state; routes.preflight.active_operator_holds = state === 'ACTIVE' ? [HOLD_ID] : []; result.files.set(ROUTER_PATH, `${JSON.stringify(routes, null, 2)}\n`)
  result.files.set(EXPERIMENT_PATH, result.files.get(EXPERIMENT_PATH).replace('**Operator hold state:** `ACTIVE`', `**Operator hold state:** \`${state}\``))
  return result
}
function legacySnapshot(snapshot) {
  const result = clone(snapshot)
  const routes = JSON.parse(result.files.get(ROUTER_PATH)); delete routes.preflight.operator_hold_states; result.files.set(ROUTER_PATH, `${JSON.stringify(routes, null, 2)}\n`)
  result.files.set(EXPERIMENT_PATH, result.files.get(EXPERIMENT_PATH).replace('**Operator hold state:** `ACTIVE`\n', ''))
  return result
}
const historicalPath = 'operations/operator-holds/transitions/SBX-SOH-001-2026-01-01.json'
const historical = '{"historical":"byte-stable evidence"}\n'
function validTransition(base, mutate = (record) => record) {
  const current = withState(base, 'LIFTED')
  const record = mutate({ schema: 'experimental-sandbox.operator-hold-transition/v1', hold_id: HOLD_ID, prior_state: 'ACTIVE', proposed_state: 'LIFTED', date: '2026-08-01', written_operator_instruction: 'Written Human Operator instruction reference for fixture only.', scope: 'The bounded hold transition fixture scope is explicit.', source_evidence: ['fixture: dated written instruction evidence reference'], status_surfaces: [...REQUIRED_STATUS_SURFACES], authority_note: 'HUMAN_OPERATOR_DATED_WRITTEN_INSTRUCTION_REQUIRED' })
  current.files.set('operations/operator-holds/transitions/SBX-SOH-001-2026-08-01.json', `${JSON.stringify(record)}\n`)
  return current
}
const base = await filesystemSnapshot(ROOT)
base.files.set(historicalPath, historical)
const legacyBase = legacySnapshot(base)

for (const bad of ['', body('SELECT_ONE_OF_OUT_OF_SCOPE_OR_ALLOWED_RESEARCH_ONLY'), body('OUT_OF_SCOPE | ALLOWED_RESEARCH_ONLY'), body('OUT_OF_SCOPE', ''), body('OUT_OF_SCOPE', undefined, ''), body('BLOCKED_BY_SBX-SOH-001'), body('OPERATOR_AUTHORIZED_HOLD_ACTIVATION')]) reject(() => validatePullRequestClassification(bad), /required|placeholder|multiple|permitted|reserved|meaningful/)
validatePullRequestClassification(body())
validatePullRequestClassification(body('ALLOWED_RESEARCH_ONLY'))

const banana = withState(base, 'BANANA'); reject(() => validateStatusSurfaceAgreement(banana), /unknown hold lifecycle state/)
const missing = clone(base); missing.files.delete(EMERGENCY_PATH); reject(() => validateStatusSurfaceAgreement(missing), /missing or relocated/)
const inconsistent = clone(base); inconsistent.files.set(EMERGENCY_PATH, inconsistent.files.get(EMERGENCY_PATH).replace('**State:** `ACTIVE`', '**State:** `LIFTED`')); reject(() => validateStatusSurfaceAgreement(inconsistent), /disagrees/)

validateHoldTransition(legacyBase, clone(base))
reject(() => validateHoldTransition(legacyBase, legacySnapshot(base)), /current snapshot must use strict/)
const partiallyMigratedBase = clone(legacyBase); { const routes = JSON.parse(partiallyMigratedBase.files.get(ROUTER_PATH)); routes.preflight.operator_hold_states = { [HOLD_ID]: 'ACTIVE' }; partiallyMigratedBase.files.set(ROUTER_PATH, `${JSON.stringify(routes, null, 2)}\n`) }; reject(() => validateHoldTransition(partiallyMigratedBase, clone(base)), /partially migrated/)
const contradictoryLegacyRouter = clone(legacyBase); { const routes = JSON.parse(contradictoryLegacyRouter.files.get(ROUTER_PATH)); routes.preflight.active_operator_holds = []; contradictoryLegacyRouter.files.set(ROUTER_PATH, `${JSON.stringify(routes, null, 2)}\n`) }; reject(() => validateHoldTransition(contradictoryLegacyRouter, clone(base)), /legacy router active-hold list/)
const contradictoryLegacyExperiment = clone(legacyBase); contradictoryLegacyExperiment.files.set(EXPERIMENT_PATH, contradictoryLegacyExperiment.files.get(EXPERIMENT_PATH).replace('— `ACTIVE`', '— `LIFTED`')); reject(() => validateHoldTransition(contradictoryLegacyExperiment, clone(base)), /legacy affected experiment/)
const contradictoryStrictBase = clone(base); { const routes = JSON.parse(contradictoryStrictBase.files.get(ROUTER_PATH)); routes.preflight.operator_hold_states[HOLD_ID] = 'LIFTED'; contradictoryStrictBase.files.set(ROUTER_PATH, `${JSON.stringify(routes, null, 2)}\n`) }; reject(() => validateHoldTransition(contradictoryStrictBase, clone(base)), /router preflight disagrees/)

const staleRouter = validTransition(base); staleRouter.files.set(ROUTER_PATH, base.files.get(ROUTER_PATH)); reject(() => validateHoldTransition(base, staleRouter), /router preflight disagrees/)
const deletedHistory = validTransition(base); deletedHistory.files.delete(historicalPath); reject(() => validateHoldTransition(base, deletedHistory), /historical transition record was deleted/)
const modifiedHistory = validTransition(base); modifiedHistory.files.set(historicalPath, '{"historical":"modified"}\n'); reject(() => validateHoldTransition(base, modifiedHistory), /historical transition record was modified/)
const addedWithoutChange = clone(base); addedWithoutChange.files.set('operations/operator-holds/transitions/SBX-SOH-001-2026-08-01.json', historical); reject(() => validateHoldTransition(base, addedWithoutChange), /state is unchanged/)
for (const mutator of [
  (record) => { record.status_surfaces = record.status_surfaces.slice(1); return record },
  (record) => { record.status_surfaces.push(REQUIRED_STATUS_SURFACES[0]); return record },
  (record) => { record.status_surfaces.push('unexpected/path.md'); return record },
  (record) => { record.hold_id = 'WRONG'; return record }
]) reject(() => validateHoldTransition(base, validTransition(base, mutator)), /missing or unexpected|duplicates|mismatch/)
const withoutRecord = withState(base, 'LIFTED'); reject(() => validateHoldTransition(base, withoutRecord), /exactly one new/)
validateHoldTransition(base, validTransition(base))
verifyCandidateRemainsActive(await filesystemSnapshot(ROOT))
process.stdout.write('hold-integrity hostile tests: PASS\n')
