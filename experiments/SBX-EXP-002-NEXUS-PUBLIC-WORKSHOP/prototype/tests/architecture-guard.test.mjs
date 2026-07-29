import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function sourceFiles(directoryUrl) {
  const files = [];
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(entryUrl)));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(entryUrl);
    }
  }
  return files;
}

test("persistence and public mutation surfaces stay absent", async () => {
  const hosting = JSON.parse(
    await readFile(new URL(".openai/hosting.json", projectRoot), "utf8"),
  );
  assert.equal(hosting.d1, null);
  assert.equal(hosting.r2, null);
  assert.equal(await exists(new URL("app/api/", projectRoot)), false);
  assert.equal(await exists(new URL("db/", projectRoot)), false);
  assert.equal(await exists(new URL("drizzle/", projectRoot)), false);
});

test("application source contains no client write or raw-HTML escape hatch", async () => {
  const sourceRoots = ["app/", "lib/", "components/", "worker/"];
  const files = (
    await Promise.all(
      sourceRoots.map(async (root) => {
        const rootUrl = new URL(root, projectRoot);
        return (await exists(rootUrl)) ? sourceFiles(rootUrl) : [];
      }),
    )
  ).flat();
  assert.equal(
    files.some((file) => /\/route\.(?:ts|tsx|js|jsx)$/.test(file.pathname)),
    false,
    "route handler introduced",
  );
  const forbidden = [
    [/["']use client["']/, "client component"],
    [/["']use server["']/, "server action"],
    [/\bdangerouslySetInnerHTML\b/, "raw HTML"],
    [/<form\b/i, "form"],
    [/\buseActionState\b|\buseFormState\b/, "server action state"],
    [/\bfetch\s*\(\s*["']https?:\/\//, "runtime remote fetch"],
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(
        source,
        pattern,
        `${label} introduced in ${file.pathname}`,
      );
    }
  }
});

test("unused image processing and database packages stay removed", async () => {
  const worker = await readFile(new URL("worker/index.ts", projectRoot), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", projectRoot), "utf8"),
  );

  assert.doesNotMatch(worker, /handleImageOptimization|transformImage/);
  assert.equal(packageJson.dependencies?.["drizzle-orm"], undefined);
  assert.equal(packageJson.devDependencies?.["drizzle-kit"], undefined);
});

test("stylesheets cannot introduce remote browser assets", async () => {
  const stylesheet = await readFile(
    new URL("app/globals.css", projectRoot),
    "utf8",
  );

  assert.doesNotMatch(stylesheet, /@import\s+(?:url\()?["']?https?:\/\//i);
  assert.doesNotMatch(stylesheet, /url\(\s*["']?https?:\/\//i);
  assert.match(stylesheet, /url\(["']?\/fonts\/geist-latin\.woff2["']?\)/);
  assert.match(stylesheet, /url\(["']?\/fonts\/geist-mono-latin\.woff2["']?\)/);
});
