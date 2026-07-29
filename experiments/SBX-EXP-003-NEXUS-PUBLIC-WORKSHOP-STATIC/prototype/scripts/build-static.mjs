import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentSecurityPolicy,
  securityHeaders,
} from "../security/policy.mjs";
import {
  renderHome,
  renderNotFound,
  renderPublication,
} from "../site/templates.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");
const clientRoot = join(distRoot, "client");
const serverRoot = join(distRoot, "server");
const assetRoot = join(clientRoot, "assets");
const defaultSiteUrl =
  "https://nexus-public-workshop.everythingbitesized.chatgpt.site";

function resolveSiteConfiguration() {
  const url = new URL(process.env.SITE_URL || defaultSiteUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "SITE_URL must be an HTTPS origin with no credentials, path, query, or fragment",
    );
  }

  const basePath = process.env.SITE_BASE_PATH || "";
  if (
    basePath &&
    !/^\/[a-z0-9]+(?:[-._][a-z0-9]+)*(?:\/[a-z0-9]+(?:[-._][a-z0-9]+)*)*$/.test(
      basePath,
    )
  ) {
    throw new Error(
      "SITE_BASE_PATH must be empty or a lowercase absolute path without a trailing slash",
    );
  }

  return Object.freeze({ url: url.origin, basePath });
}

const site = resolveSiteConfiguration();

function publicPath(path) {
  return site.basePath ? `${site.basePath}${path}` : path;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureRegularFile(path) {
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${relative(projectRoot, path)} must be a regular file`);
  }
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

async function hashedAsset(sourcePath, label) {
  await ensureRegularFile(sourcePath);
  const bytes = await readFile(sourcePath);
  const extension = extname(sourcePath);
  const filename = `${label}-${sha256(bytes).slice(0, 16)}${extension}`;
  const outputPath = join(assetRoot, filename);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  return publicPath(`/assets/${filename}`);
}

async function walkFiles(root, cursor = root) {
  const files = [];
  for (const entry of await readdir(cursor, { withFileTypes: true })) {
    const path = join(cursor, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `symbolic links are forbidden in output: ${relative(root, path)}`,
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, path)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error(
        `unsupported output entry: ${relative(root, path)}`,
      );
    }
  }
  return files;
}

function renderHeadersFile() {
  const lines = ["/*"];
  for (const [name, value] of Object.entries(securityHeaders)) {
    lines.push(`  ${name}: ${value}`);
  }
  lines.push(
    "  Cache-Control: public, max-age=0, must-revalidate",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
  );
  return `${lines.join("\n")}\n`;
}

await import("./compile-content.mjs");

const cataloguePath = join(
  projectRoot,
  ".generated",
  "content-catalogue.json",
);
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
if (catalogue.formatVersion !== 1 || !Array.isArray(catalogue.items)) {
  throw new Error("unsupported generated content catalogue");
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(assetRoot, { recursive: true });
await mkdir(serverRoot, { recursive: true });

const fontSans = await hashedAsset(
  join(projectRoot, "public", "fonts", "geist-latin.woff2"),
  "geist",
);
const fontMono = await hashedAsset(
  join(projectRoot, "public", "fonts", "geist-mono-latin.woff2"),
  "geist-mono",
);
const hero = await hashedAsset(
  join(projectRoot, "public", "nexus-workshop-hero.webp"),
  "workshop",
);

let stylesheet = await readFile(
  join(projectRoot, "site", "styles.css"),
  "utf8",
);
stylesheet = stylesheet
  .replaceAll("/fonts/geist-latin.woff2", fontSans)
  .replaceAll("/fonts/geist-mono-latin.woff2", fontMono);
const stylesheetName = `site-${sha256(stylesheet).slice(0, 16)}.css`;
await writeText(join(assetRoot, stylesheetName), stylesheet);

const assets = Object.freeze({
  fontSans,
  fontMono,
  hero,
  stylesheet: publicPath(`/assets/${stylesheetName}`),
});

await writeText(
  join(clientRoot, "index.html"),
  renderHome({ catalogue, assets, site }),
);
await writeText(
  join(clientRoot, "404.html"),
  renderNotFound({ assets, site }),
);

for (const item of catalogue.items) {
  await writeText(
    join(clientRoot, "work", item.slug, "index.html"),
    renderPublication({ item, assets, site }),
  );
}

for (const publicPath of [
  "favicon.svg",
  "robots.txt",
  ".well-known/security.txt",
]) {
  const sourcePath = join(projectRoot, "public", publicPath);
  await ensureRegularFile(sourcePath);
  await mkdir(dirname(join(clientRoot, publicPath)), { recursive: true });
  await cp(sourcePath, join(clientRoot, publicPath));
}

await writeText(join(clientRoot, "_headers"), renderHeadersFile());
await writeFile(join(clientRoot, ".nojekyll"), "", "utf8");

const workerSource = await readFile(
  join(projectRoot, "worker", "index.js"),
  "utf8",
);
if (!workerSource.includes("../security/policy.mjs")) {
  throw new Error("worker security-policy import changed unexpectedly");
}
await writeText(
  join(serverRoot, "index.js"),
  workerSource.replace("../security/policy.mjs", "./policy.mjs"),
);
await cp(
  join(projectRoot, "security", "policy.mjs"),
  join(serverRoot, "policy.mjs"),
);
await mkdir(join(distRoot, ".openai"), { recursive: true });
await cp(
  join(projectRoot, ".openai", "hosting.json"),
  join(distRoot, ".openai", "hosting.json"),
);

const receiptFiles = [];
for (const path of (await walkFiles(clientRoot)).sort()) {
  if (path.endsWith("/.well-known/site-receipt.json")) continue;
  const bytes = await readFile(path);
  receiptFiles.push({
    path: `/${relative(clientRoot, path).replaceAll("\\", "/")}`,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}

const receipt = {
  formatVersion: 1,
  architecture: "static-html-css-zero-browser-javascript",
  publicOrigin: site.url,
  publicBasePath: site.basePath,
  content: catalogue.items.map((item) => ({
    route: item.route,
    sourceSha256: item.sourceHash,
  })),
  files: receiptFiles,
  policySha256: sha256(
    `${contentSecurityPolicy}\n${JSON.stringify(securityHeaders)}\n`,
  ),
};

await writeText(
  join(clientRoot, ".well-known", "site-receipt.json"),
  JSON.stringify(receipt, null, 2),
);

console.log(
  `Built ${catalogue.items.length + 2} static HTML page(s), ${receiptFiles.length} receipted file(s), and zero browser scripts.`,
);
