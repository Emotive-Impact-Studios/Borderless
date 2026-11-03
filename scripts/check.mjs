import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));
let count = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      ["node_modules", ".git", ".borderless", "dist", "release"].includes(
        entry.name,
      )
    )
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (/\.(mjs|cjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ["--check", path], {
        encoding: "utf8",
      });
      if (result.status !== 0)
        throw new Error(`${relative(root, path)}\n${result.stderr}`);
      count++;
    }
    if (path.endsWith(".json") || path.endsWith(".webmanifest"))
      JSON.parse(await readFile(path, "utf8"));
  }
}
await walk(root);
const source = await readFile(
  join(root, "docs/source/2026-11-03-original-conversation.md"),
);
const expected = (await readFile(join(root, "docs/source/SHA256SUMS"), "utf8"))
  .trim()
  .split(/\s+/)[0];
if (createHash("sha256").update(source).digest("hex") !== expected)
  throw new Error("The preserved source conversation has changed.");
const html = await readFile(join(root, "public/index.html"), "utf8");
if (/<script[^>]*>\s*[^<\s]/i.test(html))
  throw new Error("Keep application JavaScript external for the CSP.");
console.log(
  `Checked ${count} JavaScript modules, JSON manifests and the original conversation checksum.`,
);
