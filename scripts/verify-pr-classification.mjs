#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const ALLOWED_CLASSIFICATIONS = new Set(['OUT_OF_SCOPE', 'ALLOWED_RESEARCH_ONLY'])
const ALL_CLASSIFICATIONS = ['OPERATOR_AUTHORIZED_HOLD_ACTIVATION', 'OUT_OF_SCOPE', 'ALLOWED_RESEARCH_ONLY', 'BLOCKED_BY_SBX-SOH-001']
const invariant = (condition, message) => { if (!condition) throw new Error(message) }

function field(body, label) {
  const match = body.match(new RegExp(`^[ \\t]*-[ \\t]*${label}:[ \\t]*([^\\r\\n]*)[ \\t]*$`, 'mi'))
  return match?.[1].trim().replace(/^`|`$/g, '') ?? ''
}
function meaningful(value, label) {
  invariant(value.length >= 24, `${label} must be meaningful (at least 24 characters)`)
  invariant(!/^(replace|select|tbd|todo|n\/a|none|\.{3})\b/i.test(value), `${label} still contains a template placeholder`)
}
export function validatePullRequestClassification(body) {
  invariant(typeof body === 'string' && body.trim(), 'pull request body is required')
  invariant(!body.includes('OPERATOR_AUTHORIZED_HOLD_ACTIVATION'), 'OPERATOR_AUTHORIZED_HOLD_ACTIVATION is reserved for the historical hold activation and cannot be reused')
  const classification = field(body, 'Hold classification')
  invariant(classification, 'missing Hold classification')
  invariant(!/SELECT_ONE|\|/i.test(classification), 'Hold classification still contains the template placeholder or multiple selections')
  invariant(ALL_CLASSIFICATIONS.filter((item) => classification.includes(item)).length === 1, 'exactly one hold classification is required')
  invariant(ALLOWED_CLASSIFICATIONS.has(classification), `classification ${classification || 'UNKNOWN'} is not permitted for a mergeable PR`)
  const reason = field(body, 'Exact hold reason')
  const evidence = field(body, 'Hold evidence/diff anchors')
  meaningful(reason, 'Exact hold reason')
  meaningful(evidence, 'Hold evidence/diff anchors')
  invariant(/\bpath:\s*[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/i.test(evidence), 'Hold evidence/diff anchors must include a repository path: anchor')
  return { classification, reason, evidence }
}
export async function validatePullRequestEvent(eventPath) {
  invariant(eventPath, 'GITHUB_EVENT_PATH is required for pull-request classification enforcement')
  const event = JSON.parse(await readFile(eventPath, 'utf8'))
  invariant(event?.pull_request && typeof event.pull_request.body === 'string', 'event does not contain a pull_request body')
  return validatePullRequestClassification(event.pull_request.body)
}
async function main() {
  const index = process.argv.indexOf('--event')
  const result = await validatePullRequestEvent(index >= 0 ? process.argv[index + 1] : process.env.GITHUB_EVENT_PATH)
  process.stdout.write(`pr-classification: PASS (${result.classification}; structural record completeness only)\n`)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`pr-classification: FAIL ${error.message}\n`); process.exitCode = 1 })
