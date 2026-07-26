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

node scripts/test-router.mjs
node experiments/SBX-EXP-001-NEXUS-REASONING-MARKET/tools/verify-documentary.mjs

for skill in catch-chaos advise-operator run-public-experiment publish-fastfoodai request-lab-promotion; do
  test -f "assistant/skills/$skill/SKILL.md" || { echo "MISSING skill $skill"; exit 1; }
done

if grep -RInE 'gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  --exclude-dir=.git .; then
  echo "Potential secret pattern found"
  exit 1
fi

echo "experimental-sandbox: PASS"
