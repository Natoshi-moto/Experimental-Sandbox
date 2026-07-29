import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogueUrl = new URL(
  "../.generated/content-catalogue.json",
  import.meta.url,
);
const catalogue = JSON.parse(await readFile(catalogueUrl, "utf8"));

test("content catalogue is deterministic, unique, and safely routed", () => {
  assert.equal(catalogue.formatVersion, 1);
  assert.ok(catalogue.items.length > 0);

  const slugs = catalogue.items.map((item) => item.slug);
  assert.equal(new Set(slugs).size, slugs.length);

  for (const item of catalogue.items) {
    assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(item.route, `/work/${item.slug}`);
    assert.match(item.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(item.title.length > 0 && item.title.length <= 120);
    assert.ok(item.summary.length > 0 && item.summary.length <= 280);
    assert.match(item.sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(item.body.length > 0);
  }
});

test("compiled content contains no executable or raw-HTML token type", () => {
  const allowedTypes = new Set([
    "paragraph",
    "heading",
    "quote",
    "list",
    "code",
  ]);

  for (const item of catalogue.items) {
    for (const block of item.body) {
      assert.ok(allowedTypes.has(block.type));
      assert.notEqual(block.type, "html");
      assert.notEqual(block.type, "component");
    }
  }
});

test("draft and template sentinels never enter the compiled catalogue", () => {
  const serialized = JSON.stringify(catalogue);
  assert.doesNotMatch(serialized, /Replace this with the public title/i);
  assert.doesNotMatch(serialized, /_drafts/i);
  assert.doesNotMatch(serialized, /_template/i);
});
