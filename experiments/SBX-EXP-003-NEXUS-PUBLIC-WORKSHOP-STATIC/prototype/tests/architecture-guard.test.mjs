import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  readFile,
  readdir,
} from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import {
  renderHome,
  renderNotFound,
  renderPublication,
} from "../site/templates.mjs";

const projectRoot = new URL("../", import.meta.url);
const clientRoot = new URL("../dist/client/", import.meta.url);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function walk(directoryUrl, rootUrl = directoryUrl) {
  const files = [];
  for (const entry of await readdir(directoryUrl, { withFileTypes: true })) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directoryUrl,
    );
    assert.equal(
      entry.isSymbolicLink(),
      false,
      `symbolic link emitted at ${entryUrl.pathname}`,
    );
    if (entry.isDirectory()) {
      files.push(...(await walk(entryUrl, rootUrl)));
    } else if (entry.isFile()) {
      files.push({
        url: entryUrl,
        path: `/${relative(rootUrl.pathname, entryUrl.pathname)}`,
      });
    }
  }
  return files;
}

test("runtime package and framework dependency surface is empty", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const packageLock = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(packageJson.dependencies, {});
  assert.deepEqual(packageJson.devDependencies, {});
  assert.equal(Object.keys(packageLock.packages).length, 1);
  assert.equal(await exists(new URL("../app/page.tsx", import.meta.url)), false);
  assert.equal(await exists(new URL("../app/layout.tsx", import.meta.url)), false);
  assert.equal(
    await exists(
      new URL("../app/work/[slug]/page.tsx", import.meta.url),
    ),
    false,
  );
  assert.equal(
    await exists(
      new URL("../components/hold-notice.tsx", import.meta.url),
    ),
    false,
  );
  assert.equal(await exists(new URL("../next.config.ts", import.meta.url)), false);
  assert.equal(await exists(new URL("../vite.config.ts", import.meta.url)), false);
});

test("browser artifact is static, allowlisted, and contains zero executable code", async () => {
  const files = await walk(clientRoot);
  const forbiddenExtensions = new Set([
    ".js",
    ".mjs",
    ".cjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".wasm",
    ".map",
  ]);
  assert.deepEqual(
    files
      .filter((file) => forbiddenExtensions.has(extname(file.path)))
      .map((file) => file.path),
    [],
  );

  const allowed = [
    /^\/index\.html$/,
    /^\/404\.html$/,
    /^\/favicon\.svg$/,
    /^\/robots\.txt$/,
    /^\/_headers$/,
    /^\/\.nojekyll$/,
    /^\/\.well-known\/security\.txt$/,
    /^\/\.well-known\/site-receipt\.json$/,
    /^\/work\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html$/,
    /^\/assets\/[a-z0-9-]+\.(?:css|woff2|webp)$/,
  ];
  for (const file of files) {
    assert.ok(
      allowed.some((pattern) => pattern.test(file.path)),
      `unexpected public artifact ${file.path}`,
    );
  }
});

test("every HTML page is inert and every browser subresource is local", async () => {
  const files = await walk(clientRoot);
  for (const file of files.filter((entry) => entry.path.endsWith(".html"))) {
    const html = await readFile(file.url, "utf8");
    const forbidden = [
      [/<script\b/i, "script element"],
      [/<form\b/i, "form element"],
      [/<(?:iframe|object|embed|base)\b/i, "embedded active content"],
      [/<meta\b[^>]*http-equiv=["']?refresh/i, "meta refresh"],
      [/\son[a-z]+\s*=/i, "inline event handler"],
      [/\sstyle\s*=/i, "inline style"],
      [/\b(?:javascript|data):/i, "active URL scheme"],
      [/modulepreload|__next|_rsc|vinext/i, "framework marker"],
    ];
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(html, pattern, `${label} in ${file.path}`);
    }

    const subresources = [
      ...html.matchAll(
        /<(?:img|source|audio|video|iframe)\b[^>]*\bsrc=["']([^"']+)["']/gi,
      ),
      ...html.matchAll(
        /<link\b[^>]*\brel=["'](?:stylesheet|preload|icon|manifest)["'][^>]*\bhref=["']([^"']+)["']/gi,
      ),
    ].map((match) => match[1]);
    for (const resource of subresources) {
      assert.match(resource, /^\//, `non-local subresource ${resource}`);
      assert.doesNotMatch(resource, /^\/\//, `protocol-relative resource ${resource}`);
    }
  }
});

test("receipt covers every public artifact except itself and verifies exactly", async () => {
  const receiptUrl = new URL(
    "../dist/client/.well-known/site-receipt.json",
    import.meta.url,
  );
  const receipt = JSON.parse(await readFile(receiptUrl, "utf8"));
  const files = await walk(clientRoot);
  const expected = files
    .filter((file) => file.path !== "/.well-known/site-receipt.json")
    .map((file) => file.path)
    .sort();
  const receipted = receipt.files.map((file) => file.path).sort();

  assert.equal(
    receipt.architecture,
    "static-html-css-zero-browser-javascript",
  );
  assert.deepEqual(receipted, expected);

  for (const file of receipt.files) {
    const bytes = await readFile(new URL(`.${file.path}`, clientRoot));
    assert.equal(bytes.byteLength, file.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
    );
  }
});

test("static source cannot load remote assets", async () => {
  const stylesheet = await readFile(
    new URL("../site/styles.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(stylesheet, /@import\s+(?:url\()?["']?https?:\/\//i);
  assert.doesNotMatch(stylesheet, /url\(\s*["']?https?:\/\//i);
  assert.doesNotMatch(stylesheet, /@import\s+["']?tailwindcss/i);
});

test("independent Cloudflare configuration is assets-only and disables public side URLs", async () => {
  const config = JSON.parse(
    await readFile(
      new URL("../wrangler.assets-only.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(config.main, undefined);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.assets.directory, "./dist/client");
  assert.equal(config.assets.not_found_handling, "404-page");
});

test("every internal page, fragment, and emitted asset reference resolves", async () => {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../.generated/content-catalogue.json", import.meta.url),
      "utf8",
    ),
  );
  const files = await walk(clientRoot);
  const publicPaths = new Set(files.map((file) => file.path));
  const articlePages = files
    .map((file) => file.path)
    .filter((path) => /^\/work\/[^/]+\/index\.html$/.test(path))
    .sort();
  assert.deepEqual(
    articlePages,
    catalogue.items
      .map((item) => `${item.route}/index.html`)
      .sort(),
  );

  function routeFile(pathname) {
    if (pathname === "/") return "/index.html";
    if (/^\/work\/[^/]+\/?$/.test(pathname)) {
      return `${pathname.replace(/\/$/, "")}/index.html`;
    }
    return pathname;
  }

  const htmlCache = new Map();
  async function targetHtml(path) {
    if (!htmlCache.has(path)) {
      htmlCache.set(
        path,
        await readFile(new URL(`.${path}`, clientRoot), "utf8"),
      );
    }
    return htmlCache.get(path);
  }

  for (const file of files.filter((entry) => entry.path.endsWith(".html"))) {
    const html = await targetHtml(file.path);
    const pagePath =
      file.path === "/index.html"
        ? "/"
        : file.path.replace(/index\.html$/, "");
    const pageUrl = new URL(pagePath, "https://workshop.invalid");
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const reference = match[1].replaceAll("&amp;", "&");
      const target = new URL(reference, pageUrl);
      if (target.origin !== pageUrl.origin) continue;
      const emittedPath = routeFile(target.pathname);
      assert.ok(
        publicPaths.has(emittedPath),
        `${file.path} references missing ${emittedPath}`,
      );
      if (target.hash && emittedPath.endsWith(".html")) {
        const id = decodeURIComponent(target.hash.slice(1));
        const targetSource = await targetHtml(emittedPath);
        assert.ok(
          targetSource.includes(`id="${id}"`),
          `${file.path} references missing fragment ${target.hash} in ${emittedPath}`,
        );
      }
    }
  }

  for (const file of files.filter((entry) => entry.path.endsWith(".css"))) {
    const css = await readFile(file.url, "utf8");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const target = new URL(match[1], "https://workshop.invalid");
      assert.equal(
        target.origin,
        "https://workshop.invalid",
        `remote CSS asset ${match[1]}`,
      );
      assert.ok(
        publicPaths.has(target.pathname),
        `${file.path} references missing ${target.pathname}`,
      );
    }
  }
});

test("ordinary GitHub project Pages output prefixes every local browser reference", async () => {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../.generated/content-catalogue.json", import.meta.url),
      "utf8",
    ),
  );
  const site = {
    url: "https://natoshi-moto.github.io",
    basePath: "/nexus-public-workshop",
  };
  const assets = {
    fontSans: "/nexus-public-workshop/assets/geist.woff2",
    fontMono: "/nexus-public-workshop/assets/geist-mono.woff2",
    hero: "/nexus-public-workshop/assets/workshop.webp",
    stylesheet: "/nexus-public-workshop/assets/site.css",
  };
  const pages = [
    renderHome({ catalogue, assets, site }),
    renderPublication({ item: catalogue.items[0], assets, site }),
    renderNotFound({ assets, site }),
  ];

  for (const html of pages) {
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/natoshi-moto\.github\.io\/nexus-public-workshop\//,
    );
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const reference = match[1];
      if (
        reference.startsWith("https://") ||
        reference.startsWith("#")
      ) {
        continue;
      }
      assert.match(
        reference,
        /^\/nexus-public-workshop(?:\/|$)/,
        `unprefixed project Pages reference ${reference}`,
      );
    }
  }
});
