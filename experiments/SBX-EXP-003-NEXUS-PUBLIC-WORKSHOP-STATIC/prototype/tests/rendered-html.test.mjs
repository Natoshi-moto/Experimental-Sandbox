import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import test from "node:test";

const clientRoot = resolve(
  new URL("../dist/client/", import.meta.url).pathname,
);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const environment = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const candidate = resolve(clientRoot, `.${pathname}`);
      if (
        candidate !== clientRoot &&
        !candidate.startsWith(`${clientRoot}${sep}`)
      ) {
        return new Response("Not found", { status: 404 });
      }
      try {
        const bytes = await readFile(candidate);
        return new Response(request.method === "HEAD" ? null : bytes, {
          status: 200,
          headers: {
            "content-type":
              contentTypes[extname(candidate)] ??
              "application/octet-stream",
          },
        });
      } catch (error) {
        if (error.code === "ENOENT") {
          return new Response("Not found", { status: 404 });
        }
        throw error;
      }
    },
  },
};

function request(path = "/", init = {}) {
  return worker.fetch(
    new Request(new URL(path, "https://workshop.invalid"), init),
    environment,
    {},
  );
}

test("renders the all-dark workshop as inert static HTML", async () => {
  const response = await request("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /NEXUS\s*<span[^>]*>\/\/<\/span>\s*PUBLIC WORKSHOP/s);
  assert.match(html, /SBX-SOH-001/i);
  assert.match(html, /Public documentary prototype/i);
  assert.match(html, /ALLOWED_RESEARCH_ONLY/i);
  assert.match(html, /No NEX\s+issuance/i);
  assert.match(html, /Research-only exploration/i);
  assert.match(html, /no live\s+participants/i);
  assert.match(html, /Security posture/i);
  assert.match(html, /Static files only/i);
  assert.match(html, /zero browser JavaScript/i);
  assert.doesNotMatch(html, /<script\b|modulepreload|_rsc|vinext/i);
});

test("enforces the complete static response envelope", async () => {
  const response = await request("/");
  const csp = response.headers.get("content-security-policy") ?? "";

  for (const directive of [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'none'",
    "worker-src 'none'",
  ]) {
    assert.ok(csp.includes(directive), `missing CSP directive ${directive}`);
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
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
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=0, must-revalidate",
  );
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("x-powered-by"), false);

  const html = await response.text();
  const meta = html.match(
    /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/i,
  );
  assert.ok(meta, "early meta CSP missing");
  assert.match(meta[1], /script-src &#39;none&#39;/);
  assert.doesNotMatch(meta[1], /unsafe-inline|unsafe-eval/i);
});

test("publishes every generated record and fails unknown paths closed", async () => {
  for (const path of [
    "/work/why-this-exists",
    "/work/why-this-exists/",
  ]) {
    const published = await request(path);
    const html = await published.text();
    assert.equal(published.status, 200);
    assert.match(html, /SBX-SOH-001/i);
    assert.match(html, /ALLOWED_RESEARCH_ONLY/i);
    assert.match(html, /Why this workshop exists/i);
    assert.match(html, /Immutable source record/i);
    assert.match(html, /Source receipt [a-f0-9]{64}/i);
  }

  for (const path of [
    "/work/not-a-real-record",
    "/api",
    "/_next/image",
    "/_vinext/image",
    "/%2e%2e/package.json",
    "/assets/not-real.js",
  ]) {
    const missing = await request(path);
    assert.equal(missing.status, 404, path);
    const html = await missing.text();
    assert.match(html, /Nothing is published at this address/i);
    assert.doesNotMatch(html, /ENOENT|stack|node_modules/i);
  }
});

test("refuses mutation methods before static asset lookup", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await request("/", {
      method,
      body: method === "GET" || method === "HEAD" ? undefined : "mutation",
    });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.equal(await response.text(), "Method Not Allowed");
  }
});

test("supports bodyless HEAD and immutable fingerprinted assets", async () => {
  const head = await request("/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("x-content-type-options"), "nosniff");

  const receipt = JSON.parse(
    await readFile(
      new URL("../dist/client/.well-known/site-receipt.json", import.meta.url),
      "utf8",
    ),
  );
  const stylesheet = receipt.files.find((file) => file.path.endsWith(".css"));
  assert.ok(stylesheet);
  const asset = await request(stylesheet.path);
  assert.equal(asset.status, 200);
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.match(asset.headers.get("content-type") ?? "", /^text\/css\b/i);
});
