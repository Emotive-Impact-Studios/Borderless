import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdir,
  cp,
  readdir,
  readFile,
  writeFile,
  rename,
  rm,
  chmod,
} from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { assetStorage } from "../server/assets.mjs";
import { verifyRows } from "./audit.mjs";

export async function backupHub(sourceDir, targetDir) {
  const source = resolve(sourceDir),
    target = resolve(targetDir),
    temporary = `${target}.partial-${randomUUID()}`;
  if (target === source || target.startsWith(`${source}/`))
    throw new Error("Backups must be outside the live data directory.");
  const sourceDB = new DatabaseSync(join(source, "borderless.db"), {
    readOnly: true,
  });
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  try {
    await backup(sourceDB, join(temporary, "borderless.db"));
    await cp(join(source, "storage.key"), join(temporary, "storage.key"), {
      errorOnExist: true,
      force: false,
    });
    const db = new DatabaseSync(join(temporary, "borderless.db"));
    let audit, assets;
    try {
      db.exec("PRAGMA journal_mode=DELETE");
      assets = db.prepare("SELECT * FROM assets").all();
      audit = verifyRows(
        db.prepare("SELECT * FROM audit ORDER BY seq").iterate(),
      );
    } finally {
      db.close();
    }
    await chmod(join(temporary, "borderless.db"), 0o600);
    if (!audit.valid)
      throw new Error(
        "Audit verification failed. The backup was not committed.",
      );
    await mkdir(join(temporary, "assets"), { mode: 0o700 });
    for (const asset of assets)
      await cp(
        join(source, "assets", `${asset.id}.blf`),
        join(temporary, "assets", `${asset.id}.blf`),
      );
    const storage = assetStorage(
      temporary,
      await readFile(join(temporary, "storage.key")),
    );
    for (const asset of assets) await storage.read(asset);
    const files = [];
    async function walk(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else {
          const bytes = await readFile(path);
          files.push({
            path: relative(temporary, path).replaceAll("\\", "/"),
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
        }
      }
    }
    await walk(temporary);
    await writeFile(
      join(temporary, "BACKUP.json"),
      JSON.stringify(
        {
          format: "borderless-backup-v1",
          createdAt: new Date().toISOString(),
          audit,
          assets: assets.length,
          files,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    // Reserve a new destination without overwriting any existing backup. BACKUP.json is the completion marker.
    await mkdir(target, { mode: 0o700 });
    try {
      for (const name of ["borderless.db", "storage.key", "assets"])
        await rename(join(temporary, name), join(target, name));
      await rename(join(temporary, "BACKUP.json"), join(target, "BACKUP.json"));
      await rm(temporary, { recursive: true });
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    }
    return { path: target, assets: assets.length, audit };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  } finally {
    sourceDB.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  const source = resolve(process.env.BORDERLESS_DATA || ".borderless");
  const target =
    process.argv[2] ||
    resolve(
      "backups",
      `borderless-${new Date().toISOString().replaceAll(":", "-")}`,
    );
  console.log(JSON.stringify(await backupHub(source, target), null, 2));
}
