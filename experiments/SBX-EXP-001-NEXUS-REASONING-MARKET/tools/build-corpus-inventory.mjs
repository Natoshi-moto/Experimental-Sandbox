#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXPERIMENT_ROOT = path.resolve(HERE, "..");
const OUTPUT_DIRECTORY = path.join(EXPERIMENT_ROOT, "corpus");
const JSON_OUTPUT = path.join(OUTPUT_DIRECTORY, "RELATED_ARTIFACTS.json");
const MARKDOWN_OUTPUT = path.join(OUTPUT_DIRECTORY, "RELATED_ARTIFACTS.md");

const SOURCE_ROOTS = [
  {
    bucket: "organized-design",
    directory: "/home/anon/NEXUS_ORGANIZED/02_whitepapers_and_design",
  },
  {
    bucket: "consolidated-whitepapers",
    directory:
      "/home/anon/nexus_consolidated/04_whitepapers_and_design_docs",
  },
  {
    bucket: "consolidated-core",
    directory:
      "/home/anon/nexus_consolidated/01_core_engines/game_engine_and_OS",
  },
  {
    bucket: "consensus",
    directory: "/home/anon/Downloads/Consensus",
  },
  {
    bucket: "lab-proposals",
    directory: "/home/anon/Downloads/Lab/operations/proposals",
  },
  {
    bucket: "lab-experiments",
    directory: "/home/anon/Downloads/Lab/experiments",
  },
  {
    bucket: "canonical-kit",
    directory:
      "/home/anon/Downloads/NEXUS_NEX_CANONICAL_BUILD_KIT_v0.02",
  },
  {
    bucket: "consensus-foundry",
    directory: "/home/anon/consensus-foundry/docs",
  },
  {
    bucket: "nexus-sim",
    directory: "/home/anon/nexsim-local/original/nexus_r003",
  },
];

const ACCEPTED_EXTENSIONS = new Set([
  ".docx",
  ".html",
  ".json",
  ".md",
  ".pdf",
  ".txt",
]);

const TEXT_EXTENSIONS = new Set([".html", ".json", ".md", ".txt"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".mypy_cache",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "node_modules",
  "site-packages",
  "venv",
]);
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

const RELATED_PATTERN =
  /\b(agent|multi[-_ ]?model|kernel|router|routing|orchestrat|sentinel|security|capabilit|sandbox|qubes|iframe|compartment|ledger|econom|credit|token|wallet|custod|bid|contract|job|worker|work[-_ ]?exchange|p2p|peer[-_ ]to[-_ ]peer|provenance|receipt|replay|ring|foundry|cathedral|consensus|verifier|verification|recovery|attest|privacy|nexsim|nexus sim|noted)\b/i;

const TAG_RULES = [
  [
    "agent-orchestration",
    /\b(agent|multi[-_ ]?model|orchestrat|worker|role[-_ ]?card)\b/i,
  ],
  [
    "kernel-consensus",
    /\b(kernel|consensus|canonical state|state transition|dual[-_ ]?kernel)\b/i,
  ],
  [
    "router-connectivity",
    /\b(router|routing|nostr|relay|websocket|webrtc|postmessage|iframe)\b/i,
  ],
  [
    "security-isolation",
    /\b(security|sentinel|capabilit|sandbox|qubes|compartment|threat|attack)\b/i,
  ],
  [
    "ledger-economy",
    /\b(ledger|econom|credit|token|wallet|conservation|supply|settlement)\b/i,
  ],
  [
    "work-contracts",
    /\b(job|bid|contract|worker|work[-_ ]?exchange|allowance|escrow|pledge)\b/i,
  ],
  [
    "provenance-verification",
    /\b(provenance|receipt|replay|verif|evidence|hash|manifest|attest)\b/i,
  ],
  [
    "recovery-custody",
    /\b(recovery|custod|rotate|revok|guardian|signer|sanctuary)\b/i,
  ],
  [
    "noted-adversarial",
    /\b(noted|sovereignty[-_ ]?assault|card[-_ ]?\d+|stop[-_ ]?the[-_ ]?line)\b/i,
  ],
  [
    "governance-rings",
    /\b(ten[-_ ]?ring|ring[-_ ]?model|constitution|governance|guardaccept)\b/i,
  ],
];

const APPLICABILITY = {
  "agent-orchestration":
    "Agent roles, scheduling, staggered work, compact packets, or review.",
  "kernel-consensus":
    "Deterministic authority, state transitions, ordering, or consensus limits.",
  "router-connectivity":
    "Typed routing, network/iframe seams, transport, or message boundaries.",
  "security-isolation":
    "Capability control, compartmentalization, adversarial testing, or threat limits.",
  "ledger-economy":
    "Credit conservation, settlement, wallet, or economic-boundary analysis.",
  "work-contracts":
    "Jobs, bids, locks, delegated work, acceptance, or contract lifecycle.",
  "provenance-verification":
    "Hashes, receipts, replay, evidence, manifests, or verifier design.",
  "recovery-custody":
    "Keys, custody, signer separation, controller lifecycle, or recovery.",
  "noted-adversarial":
    "Recent Noted attack evidence or controls reusable as regression vectors.",
  "governance-rings":
    "Constitutional layers, protocol governance, finality gates, or sanctuary.",
  "general-nexus":
    "Nexus context selected by the relevance scan; requires human classification.",
};

function normalizeName(value) {
  return value
    .normalize("NFKC")
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[email-redacted]",
    )
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function classifyArtifact(relativePath, extension) {
  const lower = relativePath.toLowerCase();
  if (
    extension === ".json" ||
    /(^|\/)(fixtures?|results?|receipts?|validation|vectors?)(\/|$)/.test(
      lower,
    ) ||
    /\b(fixture|result|receipt|vector|transcript|report\.json)\b/.test(lower)
  ) {
    return "evidence_or_fixture";
  }
  if (
    /\b(white[-_ ]?paper|tech(nical)?[-_ ]?spec|architecture|protocol|threat[-_ ]?model|manual|guide|design|doctrine)\b/.test(
      lower,
    )
  ) {
    return "design_document";
  }
  if ([".pdf", ".docx", ".md", ".txt", ".html"].includes(extension)) {
    return "supporting_document";
  }
  return "implementation_or_data";
}

function deriveTags(searchText, artifactClass) {
  const tags = TAG_RULES.filter(([, pattern]) => pattern.test(searchText)).map(
    ([tag]) => tag,
  );
  if (artifactClass === "evidence_or_fixture") {
    tags.push("generated-evidence");
  }
  if (tags.length === 0 || tags.every((tag) => tag === "generated-evidence")) {
    tags.push("general-nexus");
  }
  return [...new Set(tags)].sort();
}

async function collectFiles(directory, bucket, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EACCES") {
      return;
    }
    throw error;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
        await collectFiles(fullPath, bucket, output);
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (ACCEPTED_EXTENSIONS.has(extension)) {
      output.push({ bucket, fullPath, extension });
    }
  }
}

async function inspectFile(candidate, rootDirectory) {
  const fileStat = await stat(candidate.fullPath);
  if (fileStat.size > MAX_FILE_BYTES) {
    return {
      skipped: {
        bucket: candidate.bucket,
        name: normalizeName(path.basename(candidate.fullPath)),
        reason: "over-128-mib",
        bytes: fileStat.size,
      },
    };
  }

  const bytes = await readFile(candidate.fullPath);
  const relativePath = path.relative(rootDirectory, candidate.fullPath);
  const preview = TEXT_EXTENSIONS.has(candidate.extension)
    ? bytes.subarray(0, TEXT_PREVIEW_BYTES).toString("utf8")
    : "";
  const searchText = `${relativePath}\n${preview}`;

  if (!RELATED_PATTERN.test(searchText)) {
    return { ignored: true };
  }

  const artifactClass = classifyArtifact(relativePath, candidate.extension);
  const tags = deriveTags(searchText, artifactClass);
  return {
    artifact: {
      sha256: sha256(bytes),
      bytes: bytes.length,
      name: normalizeName(path.basename(candidate.fullPath)),
      bucket: candidate.bucket,
      extension: candidate.extension.slice(1),
      artifact_class: artifactClass,
      tags,
    },
  };
}

function mergeArtifacts(artifacts) {
  const groups = new Map();
  for (const artifact of artifacts) {
    let group = groups.get(artifact.sha256);
    if (!group) {
      group = {
        sha256: artifact.sha256,
        bytes: artifact.bytes,
        copies: 0,
        names: new Set(),
        source_buckets: new Set(),
        extensions: new Set(),
        artifact_classes: new Set(),
        tags: new Set(),
      };
      groups.set(artifact.sha256, group);
    }
    group.copies += 1;
    group.names.add(artifact.name);
    group.source_buckets.add(artifact.bucket);
    group.extensions.add(artifact.extension);
    group.artifact_classes.add(artifact.artifact_class);
    artifact.tags.forEach((tag) => group.tags.add(tag));
  }

  return [...groups.values()]
    .map((group) => {
      const tags = [...group.tags].sort();
      return {
        sha256: group.sha256,
        bytes: group.bytes,
        copies: group.copies,
        names: [...group.names].sort(),
        source_buckets: [...group.source_buckets].sort(),
        extensions: [...group.extensions].sort(),
        artifact_classes: [...group.artifact_classes].sort(),
        tags,
        applicability: tags
          .filter((tag) => APPLICABILITY[tag])
          .map((tag) => APPLICABILITY[tag]),
      };
    })
    .sort((left, right) => left.sha256.localeCompare(right.sha256));
}

function renderMarkdown(inventory) {
  const lines = [
    "# Related local artifacts — privacy-reduced hash inventory",
    "",
    "**status_authority:** `NONE`",
    "",
    "This machine-generated table contains one row per unique byte sequence.",
    "Names and categories are discovery hints, not claims of correctness or",
    "independent authorship. Absolute paths and source content are omitted.",
    "",
    "## Counts",
    "",
    `- scanned candidate files: ${inventory.counts.scanned_candidates}`,
    `- mechanically related files: ${inventory.counts.related_files}`,
    `- unique related hashes: ${inventory.counts.unique_hashes}`,
    `- duplicate copies beyond first: ${inventory.counts.duplicate_copies}`,
    `- oversized files skipped: ${inventory.counts.oversized_skipped}`,
    "",
    "## Inventory",
    "",
    "| SHA-256 | Class | Tags | Bytes | Copies | Safe basename(s) | Source bucket(s) |",
    "|---|---|---|---:|---:|---|---|",
  ];

  for (const artifact of inventory.artifacts) {
    const names = artifact.names
      .map((name) => name.replaceAll("|", "\\|"))
      .join("<br>");
    lines.push(
      `| \`${artifact.sha256}\` | ${artifact.artifact_classes.join(
        ", ",
      )} | ${artifact.tags.join(", ")} | ${artifact.bytes} | ${
        artifact.copies
      } | ${names} | ${artifact.source_buckets.join(", ")} |`,
    );
  }

  if (inventory.skipped.length > 0) {
    lines.push(
      "",
      "## Oversized files not hashed",
      "",
      "| Safe basename | Bytes | Source bucket | Reason |",
      "|---|---:|---|---|",
    );
    for (const skipped of inventory.skipped) {
      lines.push(
        `| ${skipped.name.replaceAll("|", "\\|")} | ${skipped.bytes} | ${
          skipped.bucket
        } | ${skipped.reason} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function buildInventory() {
  const candidates = [];
  const rootsByBucket = new Map();
  for (const source of SOURCE_ROOTS) {
    rootsByBucket.set(source.bucket, source.directory);
    await collectFiles(source.directory, source.bucket, candidates);
  }

  const artifacts = [];
  const skipped = [];
  for (const candidate of candidates) {
    const inspected = await inspectFile(
      candidate,
      rootsByBucket.get(candidate.bucket),
    );
    if (inspected.artifact) {
      artifacts.push(inspected.artifact);
    }
    if (inspected.skipped) {
      skipped.push(inspected.skipped);
    }
  }

  skipped.sort(
    (left, right) =>
      left.bucket.localeCompare(right.bucket) ||
      left.name.localeCompare(right.name),
  );
  const merged = mergeArtifacts(artifacts);
  return {
    inventory_schema: "nexus-related-artifacts-v1",
    status_authority: "NONE",
    scan_scope: SOURCE_ROOTS.map(({ bucket }) => bucket),
    privacy_reduction: {
      absolute_paths: "omitted",
      source_content: "omitted",
      filenames: "basename-only-with-email-redaction",
    },
    selection:
      "accepted extension plus agent/kernel/router/security/work/economy relevance pattern",
    limits: {
      max_file_bytes: MAX_FILE_BYTES,
      text_preview_bytes: TEXT_PREVIEW_BYTES,
    },
    counts: {
      scanned_candidates: candidates.length,
      related_files: artifacts.length,
      unique_hashes: merged.length,
      duplicate_copies: artifacts.length - merged.length,
      oversized_skipped: skipped.length,
    },
    skipped,
    artifacts: merged,
  };
}

const inventory = await buildInventory();
const json = `${JSON.stringify(inventory, null, 2)}\n`;
const markdown = renderMarkdown(inventory);

if (process.argv.includes("--write")) {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(JSON_OUTPUT, json, "utf8");
  await writeFile(MARKDOWN_OUTPUT, markdown, "utf8");
}

process.stdout.write(
  `${JSON.stringify({
    ...inventory.counts,
    wrote: process.argv.includes("--write"),
  })}\n`,
);
