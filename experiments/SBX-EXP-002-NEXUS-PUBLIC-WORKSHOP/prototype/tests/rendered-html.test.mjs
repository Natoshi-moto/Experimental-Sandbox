import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

function request(path = "/", init = {}) {
  return worker.fetch(
    new Request(new URL(path, "https://workshop.invalid"), init),
    environment,
    context,
  );
}

test("renders the workshop with no remote browser subresources", async () => {
  const response = await request("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /NEXUS\s*(?:<!--.*?-->|\s)*\/\//s);
  assert.match(html, /SBX-SOH-001/i);
  assert.match(html, /Public documentary prototype/i);
  assert.match(html, /ALLOWED_RESEARCH_ONLY/i);
  assert.match(html, /No NEX issuance/i);
  assert.match(html, /Research-only exploration/i);
  assert.match(html, /no live participants/i);
  assert.match(html, /Security posture/i);
  assert.match(html, /Why this workshop exists/i);
  const browserSubresources = [
    ...html.matchAll(
      /<(?:script|img|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi,
    ),
  ].map((match) => match[1]);
  for (const resource of browserSubresources) {
    if (!resource.startsWith("https://")) continue;
    assert.match(
      resource,
      /^https:\/\/nexus-public-workshop\.everythingbitesized\.chatgpt\.site\//,
      `unexpected third-party browser resource: ${resource}`,
    );
  }
  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /development/i);
  assert.doesNotMatch(html, /economic launch is active/i);
});

test("enforces the response security envelope", async () => {
  const response = await request("/");
  const csp = response.headers.get("content-security-policy") ?? "";

  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    response.headers.get("cross-origin-opener-policy"),
    "same-origin",
  );
  assert.equal(
    response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
  assert.equal(response.headers.get("origin-agent-cluster"), "?1");
  assert.equal(
    response.headers.get("strict-transport-security"),
    "max-age=31536000",
  );
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.has("x-powered-by"), false);
});

test("publishes generated records and returns a plain 404 for unknown slugs", async () => {
  const published = await request("/work/why-this-exists");
  const html = await published.text();
  assert.equal(published.status, 200);
  assert.match(html, /SBX-SOH-001/i);
  assert.match(html, /ALLOWED_RESEARCH_ONLY/i);
  assert.match(html, /Why this workshop exists/i);
  assert.match(html, /Immutable source record/i);
  assert.match(html, /Source receipt/i);

  const missing = await request("/work/not-a-real-record");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /ENOENT|stack|node_modules/i);
});

test("refuses mutation methods and framework-only request surfaces", async () => {
  const post = await request("/", { method: "POST", body: "mutation" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  assert.equal(await post.text(), "Method Not Allowed");

  const optimizer = await request("/_vinext/image?url=%2Ffavicon.svg&w=640");
  assert.equal(optimizer.status, 404);

  const nextOptimizer = await request("/_next/image?url=%2Ffavicon.svg&w=640");
  assert.equal(nextOptimizer.status, 404);

  const rsc = await request("/?_rsc=probe");
  assert.equal(rsc.status, 404);

  const action = await request("/", {
    headers: { "next-action": "probe" },
  });
  assert.equal(action.status, 404);

  const alternateAction = await request("/", {
    headers: { "x-rsc-action": "probe" },
  });
  assert.equal(alternateAction.status, 404);
});

test("supports bodyless HEAD requests", async () => {
  const response = await request("/", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
