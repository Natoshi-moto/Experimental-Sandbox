import { readFile } from "node:fs/promises";
import {
  LocalStatePolicyError,
  STATE_FILE_LIMITS,
  localStateRows,
  parseLocalStateText,
} from "./state-file-policy.mjs";

const here = new URL("./", import.meta.url);
const [fixtureSource, html, css, app, policy] = await Promise.all([
  readFile(new URL("demo-state.json", here), "utf8"),
  readFile(new URL("index.html", here), "utf8"),
  readFile(new URL("styles.css", here), "utf8"),
  readFile(new URL("app.js", here), "utf8"),
  readFile(new URL("state-file-policy.mjs", here), "utf8"),
]);
const hostileNames = [
  "html.json",
  "script.json",
  "event-handler.json",
  "url.json",
  "prototype-pollution.json",
  "deep.json",
  "oversize.case.json",
];
const hostileSources = Object.fromEntries(
  await Promise.all(
    hostileNames.map(async (name) => [
      name,
      await readFile(new URL(`hostile-fixtures/${name}`, here), "utf8"),
    ]),
  ),
);

const fixture = JSON.parse(fixtureSource);
let assertions = 0;

const assert = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(`SELF_TEST_FAILED: ${message}`);
};

const requiredLabels = [
  "SANDBOX",
  "SIM_CREDIT_ONLY",
  "SIMULATED_MAINTAINER_BINDING",
];

assert(fixture.schema === "nexus-matrix-demo-v1", "fixture schema");
assert(fixture.status_authority === "NONE", "status authority");
assert(fixture.economic_class === "SIM_CREDIT_ONLY", "economic class");
assert(fixture.interface.mode === "READ_ONLY_WALKTHROUGH", "read-only mode");
assert(
  fixture.interface.canonical_state_mutation === false,
  "canonical mutation disabled",
);
assert(fixture.interface.external_network === false, "external network disabled");
assert(fixture.interface.external_assets === false, "external assets disabled");

for (const label of requiredLabels) {
  assert(fixture.environment_labels.includes(label), `fixture label ${label}`);
  assert(html.includes(label), `visible HTML label ${label}`);
}

const sponsorTotal = fixture.funding.sponsors.reduce(
  (sum, sponsor) => sum + sponsor.amount,
  0,
);
assert(sponsorTotal === fixture.funding.funded, "sponsor accounting");
assert(fixture.funding.funded === fixture.funding.budget, "exact funding");
assert(fixture.capacity_seat.mode === "DONATED_CAPACITY", "donated seat mode");
assert(fixture.capacity_seat.price === 0, "donated seat price");
assert(fixture.capacity_seat.egress_allowlist.length === 0, "no seat egress");
assert(
  fixture.capacity_seat.authority.redelegation === "DENIED",
  "no re-delegation",
);

assert(fixture.evidence.checks.length === 6, "six deterministic checks");
assert(
  fixture.evidence.checks.every((check) => check.status === "PASS"),
  "all deterministic checks pass",
);
assert(fixture.review_gate.required_reviews === 3, "three required reviews");
assert(fixture.review_gate.received_reviews === 3, "three received reviews");
assert(fixture.review_gate.reviewers.length === 3, "exactly three review records");
assert(
  fixture.review_gate.reviewers.every(
    (review) =>
      review.verdict === "CLEAR" &&
      review.packet_root === fixture.review_gate.packet_root,
  ),
  "three CLEAR reviews share exact packet",
);
assert(
  fixture.review_gate.summary_label === "CORRELATED_REVIEW",
  "correlation label",
);
assert(
  fixture.review_gate.composite_independence_label === "FORBIDDEN",
  "composite independence forbidden",
);
assert(fixture.review_gate.outcome === "HOLD", "review outcome HOLD");
assert(fixture.hold.paths.length === 3, "three explicit HOLD paths");
assert(Boolean(fixture.hold.appeal), "appeal contract");
assert(fixture.non_claims.claims_not_made.length > 0, "non-claims present");

const settlementTotal = fixture.settlement_preview.summary.reduce(
  (sum, item) => sum + item.amount,
  0,
);
assert(
  settlementTotal === fixture.settlement_preview.total,
  "settlement consumes total exactly once",
);
assert(
  fixture.settlement_preview.status === "PREVIEW_LOCKED_BY_HOLD",
  "settlement remains a HOLD-locked preview",
);

assert(fixture.receipts.length === fixture.snapshot.journal_sequence, "journal size");
fixture.receipts.forEach((receipt, index) => {
  assert(receipt.sequence === index + 1, `receipt sequence ${index + 1}`);
  if (index > 0) {
    assert(
      receipt.previous_receipt_root === fixture.receipts[index - 1].receipt_id,
      `receipt predecessor ${index + 1}`,
    );
  }
});
assert(
  fixture.snapshot.journal_head ===
    fixture.receipts.at(-1).receipt_id.replace(/^RCPT-/, ""),
  "journal head matches latest receipt digest",
);

const regionIds = [
  "funding-content",
  "capacity-content",
  "work-content",
  "evidence-content",
  "review-content",
  "hold-content",
  "privacy-content",
  "settlement-content",
  "receipts-content",
  "nonclaims-content",
];
for (const id of regionIds) {
  assert(html.includes(`id="${id}"`), `HTML region ${id}`);
  assert(app.includes(`"${id}"`), `renderer targets ${id}`);
}

assert(html.includes('src="./app.js" type="module"'), "local module app script");
assert(html.includes('href="./styles.css"'), "local stylesheet");
assert(app.includes('const FIXTURE_URL = "./demo-state.json"'), "only local fixture URL");
assert(!/https?:\/\//.test(html + css + app + policy), "no external URL");
assert(!/\b(?:WebSocket|EventSource|XMLHttpRequest)\b/.test(app), "no network adapter");
assert(
  !/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(app + policy),
  "no durable storage",
);
assert(
  !/\b(?:POST|PUT|PATCH|DELETE)\b/.test(app),
  "no canonical mutation method",
);
assert(css.includes("@media (max-width: 520px)"), "small-screen layout");
assert(css.includes("@media (prefers-reduced-motion: reduce)"), "reduced motion");
assert(html.includes('role="dialog"'), "receipt dialog semantics");
assert(html.includes('aria-live="polite"'), "live walkthrough status");
assert(html.includes('id="local-state-file"'), "local state file input");
assert(html.includes('id="reset-local-state"'), "local state reset");
assert(html.includes("UNTRUSTED / LOCAL"), "visible untrusted local status");
assert(html.includes("frame-ancestors is ignored in meta CSP"), "framing deployment note");
assert(html.includes("worker-src 'none'"), "CSP blocks workers");
assert(html.includes("form-action 'none'"), "CSP blocks forms");
assert(
  (app.match(/\bfetch\s*\(/g) ?? []).length === 1 &&
    app.includes("fetch(FIXTURE_URL"),
  "only bundled same-origin fixture is fetched",
);

const localRendererStart = app.indexOf("const renderUntrustedLocalState");
const localRendererEnd = app.indexOf(
  "const setupLocalStateLoader",
  localRendererStart,
);
const localRenderer = app.slice(localRendererStart, localRendererEnd);
assert(localRendererStart >= 0 && localRendererEnd > localRendererStart, "local renderer found");
assert(localRenderer.includes("document.createElement"), "local renderer uses DOM creation");
assert(localRenderer.includes(".textContent"), "local renderer uses textContent");
assert(localRenderer.includes(".replaceChildren"), "local renderer replaces DOM children");
assert(
  !/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(localRenderer),
  "local renderer has no HTML parsing sink",
);
assert(
  !/\b(?:href|src|window\.open|location)\b/.test(localRenderer),
  "local renderer cannot create navigation",
);

const byteLength = (source) => new TextEncoder().encode(source).byteLength;
const parseHostile = (name) =>
  parseLocalStateText(hostileSources[name], {
    name,
    type: "application/json",
    declaredBytes: byteLength(hostileSources[name]),
  });
const rejectedAs = (name, code) => {
  let observed = null;
  try {
    parseHostile(name);
  } catch (error) {
    observed = error;
  }
  assert(observed instanceof LocalStatePolicyError, `${name} fails closed`);
  assert(observed?.code === code, `${name} rejection code ${code}`);
};

const literalCases = [
  ["html.json", "<img src=x onerror=globalThis.__nexus_pwned=true>"],
  [
    "script.json",
    "</script><script>globalThis.__nexus_pwned=true</script>",
  ],
  [
    "event-handler.json",
    "\" autofocus onfocus=\"globalThis.__nexus_pwned=true",
  ],
  ["url.json", "javascript:globalThis.__nexus_pwned=true"],
];
for (const [name, expectedLiteral] of literalCases) {
  const parsed = parseHostile(name);
  const rows = localStateRows(parsed.state);
  assert(Object.isFrozen(parsed), `${name} root frozen`);
  assert(
    rows.some((row) => row.value === expectedLiteral),
    `${name} hostile bytes remain literal text`,
  );
}

rejectedAs("prototype-pollution.json", "FORBIDDEN_KEY");
rejectedAs("deep.json", "DEPTH_LIMIT");
assert(!Object.hasOwn(Object.prototype, "polluted"), "Object prototype remains clean");

const oversizeCase = JSON.parse(hostileSources["oversize.case.json"]);
assert(
  oversizeCase.requested_bytes === STATE_FILE_LIMITS.maxBytes + 1,
  "oversize fixture tracks policy boundary",
);
const oversizeSource = JSON.stringify({
  schema: "nexus-ui-local-state-v1",
  label: "oversize",
  state: { payload: oversizeCase.repeat.repeat(STATE_FILE_LIMITS.maxBytes) },
});
let oversizeError = null;
try {
  parseLocalStateText(oversizeSource, {
    name: "oversize.json",
    type: "application/json",
    declaredBytes: byteLength(oversizeSource),
  });
} catch (error) {
  oversizeError = error;
}
assert(oversizeError instanceof LocalStatePolicyError, "oversize fails closed");
assert(oversizeError?.code === "BYTE_LIMIT", "oversize rejection code");
assert(
  app.includes("No upload, navigation, storage, or canonical mutation"),
  "local quarantine boundary is visible",
);

console.log(
  `PASS ui-self-test: ${assertions} assertions; ` +
    `${fixture.receipts.length} linked receipts; ` +
    `${fixture.review_gate.reviewers.length} exact reviews; ` +
    `${settlementTotal}/${fixture.settlement_preview.total} settlement units routed.`,
);
