import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { securityHeaders } from "../security/policy.mjs";

const requestedUrl = process.argv[2] || process.env.LIVE_SITE_URL;
if (!requestedUrl) {
  throw new Error(
    "usage: npm run verify:live -- https://HOST",
  );
}

const origin = new URL(requestedUrl);
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  !["", "/"].includes(origin.pathname)
) {
  throw new Error(
    "live verification target must be an HTTPS origin without credentials, path, query, or fragment",
  );
}

const failures = [];
const requestHeaders = {
  accept: "text/html",
  "cache-control": "no-cache",
  "user-agent": "NEXUS-live-boundary-verifier/1.0",
};

function verifySecurityHeaders(response, label) {
  for (const [name, expected] of Object.entries(securityHeaders)) {
    const actual = response.headers.get(name) || "";
    if (actual !== expected) {
      failures.push(
        `${label} ${name.toLowerCase()} was ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
      );
    }
  }
  if (response.headers.has("set-cookie")) {
    failures.push(`${label} set a cookie`);
  }
  if (response.headers.has("x-powered-by")) {
    failures.push(`${label} exposed x-powered-by`);
  }
}

const localReceiptBytes = await readFile(
  new URL("../dist/client/.well-known/site-receipt.json", import.meta.url),
);
const expectedReceipt = JSON.parse(localReceiptBytes.toString("utf8"));
if (expectedReceipt.publicOrigin !== origin.origin) {
  throw new Error(
    `local receipt targets ${expectedReceipt.publicOrigin}; rebuild with SITE_URL=${origin.origin} before live verification`,
  );
}
if (expectedReceipt.publicBasePath !== "") {
  throw new Error(
    "live verification currently requires an origin-root build with an empty SITE_BASE_PATH",
  );
}

const response = await fetch(origin, {
  headers: requestHeaders,
  redirect: "error",
});
const body = Buffer.from(await response.arrayBuffer());
const html = body.toString("utf8");

if (!response.ok) {
  failures.push(`home response status was ${response.status}`);
}
if (!/^text\/html\b/i.test(response.headers.get("content-type") || "")) {
  failures.push("home response was not HTML");
}
verifySecurityHeaders(response, "home response");
if (
  response.headers.get("cache-control") !==
  "public, max-age=0, must-revalidate"
) {
  failures.push("home response cache-control did not match the HTML policy");
}
if (/<script\b/i.test(html)) {
  failures.push("home response contained a script element");
}
if (/__CF\$cv|\/cdn-cgi\/challenge-platform|__cf_bm/i.test(html)) {
  failures.push("home response contained a provider browser challenge");
}

const remoteSubresources = [
  ...html.matchAll(
    /<(?:script|img|link|iframe|audio|video|source)\b[^>]*(?:src|href)=["'](https?:\/\/[^"']+)["']/gi,
  ),
]
  .map((match) => match[1])
  .filter((resource) => new URL(resource).origin !== origin.origin);
if (remoteSubresources.length) {
  failures.push(
    `home response loaded remote subresources: ${remoteSubresources.join(", ")}`,
  );
}

const receiptUrl = new URL("/.well-known/site-receipt.json", origin);
const receiptResponse = await fetch(receiptUrl, {
  headers: {
    accept: "application/json",
    "cache-control": "no-cache",
    "user-agent": requestHeaders["user-agent"],
  },
  redirect: "error",
});
if (!receiptResponse.ok) {
  failures.push(`receipt response status was ${receiptResponse.status}`);
} else {
  verifySecurityHeaders(receiptResponse, "receipt response");
  const liveReceiptBytes = Buffer.from(await receiptResponse.arrayBuffer());
  if (!liveReceiptBytes.equals(localReceiptBytes)) {
    failures.push("live receipt bytes did not match the local reviewed build");
  }
  const indexRecord = expectedReceipt.files?.find(
    (file) => file.path === "/index.html",
  );
  if (!indexRecord) {
    failures.push("receipt omitted /index.html");
  } else {
    const actualHash = createHash("sha256").update(body).digest("hex");
    if (indexRecord.bytes !== body.byteLength) {
      failures.push(
        `live home length ${body.byteLength} did not match receipt ${indexRecord.bytes}`,
      );
    }
    if (indexRecord.sha256 !== actualHash) {
      failures.push(
        `live home SHA-256 ${actualHash} did not match receipt ${indexRecord.sha256}`,
      );
    }
  }
}

if (failures.length) {
  console.error("LIVE BOUNDARY: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("LIVE BOUNDARY: PASS");
  console.log(`Verified ${origin.origin} against headers, bytes, scripts, cookies, and receipt.`);
}
