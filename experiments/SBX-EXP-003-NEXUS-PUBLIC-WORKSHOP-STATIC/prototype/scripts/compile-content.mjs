import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = join(projectRoot, "content");
const outputFile = join(
  projectRoot,
  ".generated",
  "content-catalogue.json",
);

const categories = [
  ["notes", "Field note"],
  ["positions", "Published position"],
  ["demonstrations", "Working demonstration"],
  ["evidence", "Evidence"],
  ["experiments", "Open experiment"],
];

const filenamePattern =
  /^(\d{4}-\d{2}-\d{2})--([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const maximumFileBytes = 128 * 1024;
const maximumTitleCharacters = 120;
const maximumSummaryCharacters = 280;

function fail(path, message) {
  const location = path ? `${relative(projectRoot, path)}: ` : "";
  throw new Error(`${location}${message}`);
}

function validateDate(path, date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    fail(path, `invalid publication date "${date}"`);
  }
}

function validateSourcePolicy(path, source) {
  if (source.includes("\0")) {
    fail(path, "NUL bytes are not permitted");
  }
  if (/^\s*(?:import|export)\s/m.test(source)) {
    fail(path, "MDX imports and exports are not permitted");
  }
  if (/<!--|<!doctype|<\/?[A-Za-z][^>]*>/i.test(source)) {
    fail(path, "raw HTML is not permitted");
  }
  if (/!\[[^\]]*]\([^)]*\)/.test(source)) {
    fail(path, "Markdown images are not permitted; use reviewed local media");
  }

  for (const match of source.matchAll(/(?<!!)\[[^\]]+]\(([^)\s]+)\)/g)) {
    const target = match[1];
    const allowed =
      target.startsWith("https://") ||
      (target.startsWith("/") && !target.startsWith("//")) ||
      target.startsWith("#");
    if (!allowed) {
      fail(
        path,
        `unsafe or unsupported link target "${target}"; use HTTPS, /path, or #anchor`,
      );
    }
  }
}

function isBlockStart(line) {
  return (
    /^#{2,3}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}

function parseBlocks(path, lines) {
  const blocks = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([a-z0-9-]*)\s*$/i);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        fail(path, "unclosed fenced code block");
      }
      blocks.push({
        type: "code",
        language: fence[1].toLowerCase(),
        text: code.join("\n"),
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const unordered = /^[-*]\s+/.test(line);
    const ordered = /^\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const items = [];
      const itemPattern = unordered ? /^[-*]\s+(.+)$/ : /^\d+\.\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length === 0) {
      fail(path, `unsupported Markdown near "${line.slice(0, 40)}"`);
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function parseDocument(path, source, category, label, date, slug) {
  validateSourcePolicy(path, source);
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const firstContentLine = lines.findIndex((line) => line.trim());
  if (firstContentLine < 0) fail(path, "file is empty");

  const titleMatch = lines[firstContentLine].match(/^#\s+(.+?)\s*$/);
  if (!titleMatch) {
    fail(path, "the first non-empty line must be one H1 title");
  }
  if (lines.filter((line) => /^#\s+/.test(line)).length !== 1) {
    fail(path, "exactly one H1 title is required");
  }

  const title = titleMatch[1];
  if (title.length > maximumTitleCharacters) {
    fail(path, `title exceeds ${maximumTitleCharacters} characters`);
  }

  const blocks = parseBlocks(path, lines.slice(firstContentLine + 1));
  const summaryIndex = blocks.findIndex((block) => block.type === "paragraph");
  if (summaryIndex < 0) {
    fail(path, "a prose summary paragraph is required after the title");
  }
  const summary = blocks[summaryIndex].text;
  if (summary.length > maximumSummaryCharacters) {
    fail(path, `summary exceeds ${maximumSummaryCharacters} characters`);
  }

  const body = blocks.filter((_, index) => index !== summaryIndex);
  if (body.length === 0) {
    fail(path, "at least one body block is required after the summary");
  }

  return {
    slug,
    route: `/work/${slug}`,
    category,
    label,
    publishedAt: date,
    title,
    summary,
    body,
    sourceHash: createHash("sha256").update(source).digest("hex"),
  };
}

async function compile() {
  const items = [];
  const seenSlugs = new Set();

  for (const [category, label] of categories) {
    const directory = join(contentRoot, category);
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink() || (await lstat(path)).isSymbolicLink()) {
        fail(path, "symbolic links are not permitted in published content");
      }
      if (!entry.isFile()) {
        fail(path, "published content directories may contain files only");
      }

      const match = entry.name.match(filenamePattern);
      if (!match) {
        fail(
          path,
          "filename must be YYYY-MM-DD--lowercase-hyphenated-slug.md",
        );
      }
      const [, date, slug] = match;
      validateDate(path, date);
      if (seenSlugs.has(slug)) {
        fail(path, `duplicate global slug "${slug}"`);
      }
      seenSlugs.add(slug);

      const source = await readFile(path, "utf8");
      if (Buffer.byteLength(source) > maximumFileBytes) {
        fail(path, `file exceeds ${maximumFileBytes} bytes`);
      }
      items.push(parseDocument(path, source, category, label, date, slug));
    }
  }

  items.sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.slug.localeCompare(right.slug),
  );

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(
    outputFile,
    `${JSON.stringify({ formatVersion: 1, items }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Compiled ${items.length} published workshop item(s).`);
}

await compile();
