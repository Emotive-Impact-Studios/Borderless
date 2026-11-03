import assert from "node:assert/strict";
import { listPackage } from "@electron/asar";
const path = process.argv[2];
if (!path) throw new Error("Pass the packaged app.asar path.");
const entries = listPackage(path);
for (const required of ["/desktop/main.mjs", "/desktop/hub-process.mjs", "/desktop/preload.cjs", "/server/desktop-hub.mjs", "/server/app.mjs", "/public/index.html"])
  assert.ok(entries.includes(required), `Missing runtime module: ${required}`);
for (const entry of entries)
  assert.ok(!/(^|\/)(\.borderless|hub\.lock|storage\.key|borderless\.db(?:-shm|-wal)?|certs|playwright|electron-builder)(\/|$)/.test(entry), `Private data or build tooling in package: ${entry}`);
console.log(`Verified ${entries.length} ASAR entries: runtime present; storage credentials and desktop test/build tools excluded.`);
