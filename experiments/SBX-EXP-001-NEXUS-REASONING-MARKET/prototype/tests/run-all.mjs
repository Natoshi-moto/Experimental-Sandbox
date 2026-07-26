import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const programs = Object.freeze([
  resolve(testsDirectory, "core-economy.mjs"),
  resolve(testsDirectory, "work-review.mjs"),
  resolve(testsDirectory, "privacy-github.mjs"),
  resolve(testsDirectory, "..", "ui", "ui-self-test.mjs"),
]);

for (const program of programs) {
  const child = spawnSync(process.execPath, [program], {
    cwd: dirname(program),
    env: process.env,
    stdio: "inherit",
  });

  if (child.error) {
    console.error(`failed to start ${program}: ${child.error.message}`);
    process.exit(1);
  }

  if (child.status !== 0) {
    if (child.signal !== null) {
      console.error(`${program} terminated by signal ${child.signal}`);
    }
    process.exit(child.status ?? 1);
  }
}
