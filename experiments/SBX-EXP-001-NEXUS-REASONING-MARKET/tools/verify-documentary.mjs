#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXPERIMENT_ROOT = path.resolve(HERE, "..");
const REPOSITORY_ROOT = path.resolve(EXPERIMENT_ROOT, "..", "..");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function walk(directory, output = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(target, output);
    } else if (entry.isFile()) {
      output.push(target);
    }
  }
  return output;
}

async function targetExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function localLinkTargets(markdown) {
  const targets = [];
  const pattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    if (
      target.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)
    ) {
      continue;
    }
    target = target.split("#", 1)[0];
    if (target.length > 0) {
      targets.push(decodeURIComponent(target));
    }
  }
  return targets;
}

const files = await walk(EXPERIMENT_ROOT);
const markdownFiles = files.filter((file) => file.endsWith(".md"));

for (const markdownFile of markdownFiles) {
  const source = await readFile(markdownFile, "utf8");
  invariant(
    source.includes("status_authority:** `NONE`"),
    `${path.relative(REPOSITORY_ROOT, markdownFile)} lacks status_authority NONE`,
  );
  for (const target of localLinkTargets(source)) {
    const resolved = path.resolve(path.dirname(markdownFile), target);
    invariant(
      resolved.startsWith(REPOSITORY_ROOT),
      `${path.relative(REPOSITORY_ROOT, markdownFile)} links outside repository`,
    );
    invariant(
      await targetExists(resolved),
      `${path.relative(REPOSITORY_ROOT, markdownFile)} has missing link ${target}`,
    );
  }
}

const experimentRecord = await readFile(
  path.join(EXPERIMENT_ROOT, "EXPERIMENT.md"),
  "utf8",
);
for (const requiredHeading of [
  "## Raw origin",
  "## Claim",
  "## Falsifier",
  "## Smallest test",
  "## Method and environment",
  "## Results",
  "## Limitations and non-claims",
  "## Evidence",
  "## Lesson",
]) {
  invariant(
    experimentRecord.includes(requiredHeading),
    `EXPERIMENT.md missing ${requiredHeading}`,
  );
}

const inventoryPath = path.join(
  EXPERIMENT_ROOT,
  "corpus",
  "RELATED_ARTIFACTS.json",
);
const inventorySource = await readFile(inventoryPath, "utf8");
const inventory = JSON.parse(inventorySource);
invariant(
  inventory.status_authority === "NONE",
  "corpus inventory must have status_authority NONE",
);
invariant(
  !inventorySource.includes("/home/anon"),
  "corpus inventory leaks an absolute local path",
);
invariant(
  !inventory.scan_scope.includes("sensitive-safety-research"),
  "sensitive-safety source must not appear in public inventory",
);
invariant(
  inventory.artifacts.length === inventory.counts.unique_hashes,
  "corpus unique count mismatch",
);

const hashes = new Set();
let observedCopies = 0;
for (const artifact of inventory.artifacts) {
  invariant(
    /^[0-9a-f]{64}$/.test(artifact.sha256),
    `invalid corpus digest ${artifact.sha256}`,
  );
  invariant(!hashes.has(artifact.sha256), `duplicate digest row ${artifact.sha256}`);
  hashes.add(artifact.sha256);
  invariant(
    Number.isSafeInteger(artifact.bytes) && artifact.bytes >= 0,
    `invalid byte count for ${artifact.sha256}`,
  );
  invariant(
    Number.isSafeInteger(artifact.copies) && artifact.copies >= 1,
    `invalid copy count for ${artifact.sha256}`,
  );
  observedCopies += artifact.copies;
}
invariant(
  observedCopies === inventory.counts.related_files,
  "corpus related-file count mismatch",
);
invariant(
  observedCopies - hashes.size === inventory.counts.duplicate_copies,
  "corpus duplicate-copy count mismatch",
);

const sourceRegister = await readFile(
  path.join(EXPERIMENT_ROOT, "reports", "CORE_SOURCE_REGISTER_v0.1.md"),
  "utf8",
);
const registeredHashes = sourceRegister.match(/`[0-9a-f]{64}`/g) ?? [];
invariant(
  registeredHashes.length === 25,
  `expected 25 full core-source hashes, found ${registeredHashes.length}`,
);

const index = await readFile(
  path.join(REPOSITORY_ROOT, "experiments", "INDEX.md"),
  "utf8",
);
invariant(index.includes("SBX-EXP-001"), "experiment missing from index");

process.stdout.write(
  `experiment-001-documentary: PASS (${markdownFiles.length} markdown files, ${hashes.size} unique corpus hashes)\n`,
);
