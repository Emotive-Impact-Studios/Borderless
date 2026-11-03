import { cp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url)),
  target = join(root, "dist");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const path of [
  "public",
  "server",
  "scripts",
  "docs",
  "desktop",
  "test",
  "deploy",
  "native",
  ".github",
  "package.json",
  "package-lock.json",
  "README.md",
  "AGENTS.md",
  "PRODUCT.md",
  "DESIGN.md",
  ".env.example",
]) {
  await cp(join(root, path), join(target, path), {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).some(part =>
      ["node_modules", "target", ".build", ".godot", "bin", "obj"].includes(part)),
  });
}
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
await writeFile(
  join(target, "BUILD.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      node: process.versions.node,
      builtAt: new Date().toISOString(),
      type: "source-distribution",
      instructions:
        "npm ci --omit=dev, then npm start. Desktop installers are a separate platform build.",
    },
    null,
    2,
  ),
);
console.log(
  "Built dist/ as a portable source distribution. Native installers require the separate desktop packaging job.",
);
