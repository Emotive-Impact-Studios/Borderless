import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const files = (await readdir(new URL("../test/", import.meta.url)))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => `test/${name}`);
if (!files.length) throw new Error("No integration tests found.");
const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
