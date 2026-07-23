#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

required=(
  README.md
  CHARTER.md
  CONTRIBUTING.md
  SECURITY.md
  templates/EXPERIMENT.md
  templates/FORK_RESEARCH.md
  templates/PROMOTION.md
  templates/AI_REVIEW.md
  course/README.md
  mithub/README.md
)

for file in "${required[@]}"; do
  test -f "$file" || { echo "MISSING $file"; exit 1; }
done

if grep -RInE 'gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  --exclude-dir=.git .; then
  echo "Potential secret pattern found"
  exit 1
fi

echo "experimental-sandbox: PASS"
