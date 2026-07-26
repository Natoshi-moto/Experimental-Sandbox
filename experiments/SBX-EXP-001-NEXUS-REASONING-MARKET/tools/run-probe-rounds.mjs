import {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = new URL("./", import.meta.url);
const SEED = "nexus-review-probes-v1/2026-07-26";
const MAX_ARTIFACT_BYTES = 64 * 1024;

function parseArgs(args) {
  const options = { output: null, summary: null };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--output", "--summary"].includes(flag) || index + 1 >= args.length) {
      throw new Error(`Unsupported or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = args[index + 1];
    index += 1;
  }
  return options;
}

function deltaFor(expected, observed) {
  if (expected === observed) return `UNCHANGED_${observed}`;
  if (expected === "PASS" && observed !== "PASS") return "REGRESSION";
  if (expected !== "PASS" && observed === "PASS") return "IMPROVEMENT";
  return "CHANGED";
}

function runHybridCryptoProbe() {
  const evidence = {
    node_version: process.version,
    openssl_version: process.versions.openssl,
    message_seed_sha256: createHash("sha256").update(SEED).digest("hex"),
    ed25519_verified: false,
    ml_dsa_65_first_verified: false,
    ml_dsa_65_second_verified: false,
    ml_dsa_65_repeated_signatures_differ: false,
  };

  try {
    const message = createHash("sha256")
      .update(`${SEED}/hybrid-crypto-capability`)
      .digest();

    {
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      const signature = sign(null, message, privateKey);
      evidence.ed25519_verified = verify(null, message, publicKey, signature);
    }

    {
      const { privateKey, publicKey } = generateKeyPairSync("ml-dsa-65");
      const first = sign(null, message, privateKey);
      const second = sign(null, message, privateKey);
      evidence.ml_dsa_65_first_verified = verify(
        null,
        message,
        publicKey,
        first,
      );
      evidence.ml_dsa_65_second_verified = verify(
        null,
        message,
        publicKey,
        second,
      );
      evidence.ml_dsa_65_repeated_signatures_differ = !first.equals(second);
    }

    const passed =
      evidence.ed25519_verified &&
      evidence.ml_dsa_65_first_verified &&
      evidence.ml_dsa_65_second_verified &&
      evidence.ml_dsa_65_repeated_signatures_differ;

    return {
      id: "hybrid-crypto-capability",
      status: passed ? "PASS" : "FAIL",
      detail:
        "Ephemeral Ed25519 and ML-DSA-65 keys; both ML-DSA signatures verify and differ.",
      evidence,
    };
  } catch (error) {
    return {
      id: "hybrid-crypto-capability",
      status: "FAIL",
      detail: "Required hybrid-crypto capability was unavailable.",
      evidence: {
        ...evidence,
        error_class:
          error instanceof Error ? error.constructor.name : "UnknownError",
      },
    };
  }
}

function runUiPolicyProbe() {
  const testPath = fileURLToPath(
    new URL("../prototype/ui/ui-self-test.mjs", here),
  );
  const result = spawnSync(process.execPath, [testPath], {
    cwd: fileURLToPath(new URL("../", here)),
    encoding: "utf8",
    timeout: 60_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      TZ: "UTC",
    },
  });
  const marker = "PASS ui-self-test:";
  const passed =
    result.status === 0 &&
    result.signal === null;

  return {
    id: "hostile-state-ui-policy",
    status: passed ? "PASS" : "FAIL",
    detail:
      "Bounded local-state policy and hostile HTML/script/event/URL fixtures.",
    evidence: {
      exit_code: result.status,
      signal: result.signal,
      pass_marker_seen: result.stdout.includes(marker),
      stdout_bytes: Buffer.byteLength(result.stdout),
      stderr_bytes: Buffer.byteLength(result.stderr),
      timed_out: result.error?.code === "ETIMEDOUT",
    },
  };
}

function markdownFor(report) {
  const rows = report.probes
    .map(
      (probe) =>
        `| \`${probe.id}\` | **${probe.status}** | \`${probe.delta}\` | ${probe.detail} |`,
    )
    .join("\n");
  const crypto = report.probes.find(
    (probe) => probe.id === "hybrid-crypto-capability",
  );

  return [
    "## Nexus review probes",
    "",
    "> Non-gating evidence only. A probe PASS cannot make the gating verification green.",
    "",
    `- Seed: \`${report.seed}\``,
    `- Node: \`${report.runtime.node}\``,
    `- OpenSSL: \`${report.runtime.openssl}\``,
    `- Network: \`${report.network}\``,
    `- Result: **${report.summary.pass}/${report.summary.total} PASS**`,
    "",
    "| Probe | Status | Baseline delta | Scope |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    "### Hybrid-crypto capability",
    "",
    `- Ed25519 verification: **${crypto.evidence.ed25519_verified ? "PASS" : "FAIL"}**`,
    `- ML-DSA-65 verification #1: **${crypto.evidence.ml_dsa_65_first_verified ? "PASS" : "FAIL"}**`,
    `- ML-DSA-65 verification #2: **${crypto.evidence.ml_dsa_65_second_verified ? "PASS" : "FAIL"}**`,
    `- Repeated ML-DSA signatures differ: **${crypto.evidence.ml_dsa_65_repeated_signatures_differ ? "YES" : "NO"}**`,
    "",
    "Private keys and signature bytes are ephemeral and are never serialized.",
    "",
    "### Delta semantics",
    "",
    "- `UNCHANGED_PASS`: observed PASS and baseline PASS.",
    "- `REGRESSION`: baseline PASS but the current probe did not pass.",
    "- `IMPROVEMENT`: current PASS where the baseline did not pass.",
    "- `CHANGED`: any other status transition.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseline = JSON.parse(
    await readFile(new URL("probe-baseline.json", here), "utf8"),
  );
  if (
    baseline.schema !== "nexus-review-probe-baseline-v1" ||
    baseline.seed !== SEED
  ) {
    throw new Error("Probe baseline schema or seed mismatch.");
  }

  const probes = [runHybridCryptoProbe(), runUiPolicyProbe()].map((probe) => {
    const expected = baseline.expected[probe.id] ?? "UNTRACKED";
    return {
      ...probe,
      expected_status: expected,
      delta: deltaFor(expected, probe.status),
    };
  });
  const passed = probes.filter((probe) => probe.status === "PASS").length;
  const report = {
    schema: "nexus-review-probe-report-v1",
    seed: SEED,
    semantics: {
      deterministic_inputs:
        "Fixed seed, fixed probe order, normalized booleans, no timestamps.",
      crypto_entropy:
        "Keys use runtime entropy; no key bytes or signatures enter the report.",
      delta_basis:
        "Status-only comparison against probe-baseline.json by stable probe ID.",
    },
    runtime: {
      node: process.version,
      openssl: process.versions.openssl,
    },
    network: "DISABLED_BY_DESIGN",
    probes,
    summary: {
      pass: passed,
      fail: probes.length - passed,
      total: probes.length,
    },
  };
  const artifact = `${JSON.stringify(report, null, 2)}\n`;
  if (Buffer.byteLength(artifact) > MAX_ARTIFACT_BYTES) {
    throw new Error("Probe artifact exceeded its 64 KiB bound.");
  }
  const markdown = markdownFor(report);

  if (options.output) await writeFile(options.output, artifact, "utf8");
  if (options.summary) await writeFile(options.summary, markdown, "utf8");
  process.stdout.write(markdown);
  process.exitCode = passed === probes.length ? 0 : 1;
}

await main();
