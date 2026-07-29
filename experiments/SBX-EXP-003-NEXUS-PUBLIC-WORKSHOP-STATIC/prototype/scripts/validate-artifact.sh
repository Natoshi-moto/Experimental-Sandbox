#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
worker="${project_root}/dist/server/index.js"
policy="${project_root}/dist/server/policy.mjs"
hosting="${project_root}/dist/.openai/hosting.json"
client="${project_root}/dist/client"

for required in \
  "${worker}" \
  "${policy}" \
  "${hosting}" \
  "${client}/index.html" \
  "${client}/404.html" \
  "${client}/.well-known/security.txt" \
  "${client}/.well-known/site-receipt.json"; do
  [[ -f "${required}" ]] || {
    echo "Missing required artifact: ${required#${project_root}/}" >&2
    exit 66
  }
done

node --input-type=module - "${worker}" "${hosting}" "${client}" <<'NODE'
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath, clientRoot] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("artifact-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error(
    "dist/server/index.js must export a default object with fetch(request, env)",
  );
}

async function walk(cursor = clientRoot) {
  const files = [];
  for (const entry of await readdir(cursor, { withFileTypes: true })) {
    const path = join(cursor, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symlink in static output: ${path}`);
    }
    if (entry.isDirectory()) files.push(...(await walk(path)));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

const files = await walk();
const browserCode = files.filter((path) =>
  [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".wasm", ".map"].includes(
    extname(path).toLowerCase(),
  ),
);
if (browserCode.length > 0) {
  throw new Error(`executable browser artifacts found: ${browserCode.join(", ")}`);
}

for (const path of files.filter((entry) => entry.endsWith(".html"))) {
  const html = await readFile(path, "utf8");
  const forbidden = [
    [/<script\b/i, "script element"],
    [/<form\b/i, "form element"],
    [/\son[a-z]+\s*=/i, "inline event handler"],
    [/\sstyle\s*=/i, "inline style"],
    [/<(?:img|source|audio|video|iframe)\b[^>]*\bsrc=["']https?:\/\//i, "remote browser subresource"],
    [/<link\b[^>]*\brel=["'](?:stylesheet|preload|icon|manifest)["'][^>]*\bhref=["']https?:\/\//i, "remote linked browser subresource"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(html)) {
      throw new Error(`${label} found in ${path}`);
    }
  }
}

const receiptPath = join(clientRoot, ".well-known", "site-receipt.json");
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipt.architecture !== "static-html-css-zero-browser-javascript") {
  throw new Error("unexpected architecture receipt");
}
for (const file of receipt.files) {
  const bytes = await readFile(join(clientRoot, file.path.slice(1)));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== file.sha256 || bytes.byteLength !== file.bytes) {
    throw new Error(`receipt mismatch for ${file.path}`);
  }
}
NODE

echo "Validated static artifact, browser-code absence, and SHA-256 receipt."
