#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

required=(
  README.md
  CHARTER.md
  CONTRIBUTING.md
  SECURITY.md
  HANDOFF_ANY_AI.md
  EMERGENCY_CURRENT_STATUS.md
  operations/operator-holds/README.md
  operations/operator-holds/SBX-SOH-001/ORDER.md
  operations/operator-holds/SBX-SOH-001/STATUS.json
  operations/operator-holds/SBX-SOH-001/RAW_OPERATOR_AUTHORIZATION.md
  operations/operator-holds/SBX-SOH-001/REFERENCE_NOTICE.md
  operations/operator-holds/SBX-SOH-001/CHANGE_CLASSIFICATION.md
  operations/operator-holds/SBX-SOH-001/PUBLIC_HOLDING_STATEMENT.md
  scripts/verify-operator-holds.mjs
  templates/EXPERIMENT.md
  templates/FORK_RESEARCH.md
  templates/PROMOTION.md
  templates/AI_REVIEW.md
  course/README.md
  mithub/README.md
  assistant/app/index.html
  assistant/app/app.js
  assistant/router/routes.json
  assistant/ROUTER_CONTRACT.md
  reports/CHANNELS.json
)

for file in "${required[@]}"; do
  test -f "$file" || { echo "MISSING $file"; exit 1; }
done

node scripts/verify-operator-holds.mjs
node scripts/test-router.mjs
node experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/tools/verify-documentary.mjs
node experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/prototype/tests/run-all.mjs

for skill in catch-chaos advise-operator run-public-experiment publish-fastfoodai request-lab-promotion; do
  test -f "assistant/skills/$skill/SKILL.md" || { echo "MISSING skill $skill"; exit 1; }
done

if grep -RInE 'gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  --exclude-dir=.git .; then
  echo "Potential secret pattern found"
  exit 1
fi

echo "experimental-sandbox: PASS"
