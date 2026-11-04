import { readFile, cp, mkdir, rm, lstat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { assetStorage } from "../server/assets.mjs";
import { verifyRows } from "./audit.mjs";

export async function restoreHub(backupDir, targetDir) {
  const source = resolve(backupDir),
    target = resolve(targetDir);
  if (source === target || target.startsWith(`${source}${sep}`))
    throw new Error("Restore to a new directory outside the backup.");
  const manifest = JSON.parse(
    await readFile(join(source, "BACKUP.json"), "utf8"),
  );
  if (
    manifest.format !== "borderless-backup-v1" ||
    !Array.isArray(manifest.files)
  )
    throw new Error("Unsupported backup format.");
  const paths = new Set(manifest.files.map((f) => f.path));
  if (
    paths.size !== manifest.files.length ||
    !paths.has("borderless.db") ||
    !paths.has("storage.key")
  )
    throw new Error("The backup manifest is incomplete.");
  for (const file of manifest.files) {
    if (
      !/^(borderless\.db|storage\.key|assets\/[a-f0-9-]{36}\.blf)$/.test(
        file.path,
      )
    )
      throw new Error("Invalid backup path.");
    if ((await lstat(join(source, file.path))).isSymbolicLink())
      throw new Error("Symbolic links are not accepted in backups.");
    const content = await readFile(join(source, file.path));
    if (
      content.length !== file.bytes ||
      createHash("sha256").update(content).digest("hex") !== file.sha256
    )
      throw new Error(`Backup file integrity failed: ${file.path}`);
  }
  const db = new DatabaseSync(join(source, "borderless.db"), {
    readOnly: true,
  });
  try {
    const verification = verifyRows(
      db.prepare("SELECT * FROM audit ORDER BY seq").iterate(),
    );
    if (!verification.valid)
      throw new Error("The backup audit chain is invalid.");
    const storage = assetStorage(
      source,
      await readFile(join(source, "storage.key")),
    );
    for (const asset of db.prepare("SELECT * FROM assets").all()) {
      if (!paths.has(`assets/${asset.id}.blf`))
        throw new Error("An asset is missing from the backup manifest.");
      await storage.read(asset);
    }
  } finally {
    db.close();
  }
  await mkdir(target, { mode: 0o700 });
  try {
    await mkdir(join(target, "assets"), { mode: 0o700 });
    for (const file of manifest.files)
      await cp(join(source, file.path), join(target, file.path), {
        force: false,
        errorOnExist: true,
      });
    return { path: target, verified: true };
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  if (!process.argv[2] || !process.argv[3])
    throw new Error(
      "Usage: npm run restore -- <backup directory> <new data directory>",
    );
  console.log(
    JSON.stringify(await restoreHub(process.argv[2], process.argv[3]), null, 2),
  );
}
