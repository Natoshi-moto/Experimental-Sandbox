#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking static build sources..."
node --check "${project_root}/scripts/compile-content.mjs"
node --check "${project_root}/scripts/build-static.mjs"
node --check "${project_root}/scripts/verify-live.mjs"
node --check "${project_root}/site/templates.mjs"
node --check "${project_root}/security/policy.mjs"
node --check "${project_root}/worker/index.js"

echo "Compiling restricted content into static files..."
node "${project_root}/scripts/build-static.mjs"

bash "${project_root}/scripts/validate-artifact.sh"

echo "Running architecture, content, route, header, and receipt tests..."
node --test "${project_root}"/tests/*.test.mjs

echo "Verified: scriptless static output with no runtime package dependencies."
