import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, writeFile, rm } from "node:fs/promises";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import {
  fixture,
  room,
  command,
  upload,
  snapshot,
  request,
} from "./helpers.mjs";
import { backupHub } from "../scripts/backup.mjs";
import { restoreHub } from "../scripts/restore.mjs";
import { releasePayload, verifyRelease } from "../scripts/verify-release.mjs";
import { createApp } from "../server/app.mjs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

test("a backup verifies the ledger and file bytes, then restores to a separate working hub", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  await command(app, admin, "note.add", { text: "Keep this idea" });
  const file = await upload(
    app,
    admin,
    "keep.txt",
    Buffer.from("Keep these bytes."),
  );
  const target = `${app.dataDir}-backup`,
    restored = `${app.dataDir}-restored`;
  t.after(async () => {
    await rm(target, { recursive: true, force: true });
    await rm(restored, { recursive: true, force: true });
  });
  const backup = await backupHub(app.dataDir, target);
  assert.equal(backup.assets, 1);
  assert.equal(backup.audit.valid, true);
  assert.equal((await restoreHub(target, restored)).verified, true);
  const second = await createApp({ dataDir: restored, port: 0 });
  try {
    const mirror = { ...second, base: second.localURL };
    assert.equal((await snapshot(mirror, admin)).items.length, 2);
    const read = await request(
      mirror,
      `/api/rooms/${admin.roomId}/assets/${file.body.assetId}`,
      { actor: admin },
    );
    assert.equal(read.body.toString(), "Keep these bytes.");
  } finally {
    await second.close();
  }
  await assert.rejects(
    () => backupHub(app.dataDir, target),
    (error) => error.code === "EEXIST",
  );
  await assert.rejects(
    () => restoreHub(target, restored),
    (error) => error.code === "EEXIST",
  );
});

test("a damaged backup is refused before creating the restore directory", async (t) => {
  const app = await fixture(t);
  await room(app);
  const target = `${app.dataDir}-backup`,
    restored = `${app.dataDir}-restored`;
  t.after(async () => {
    await rm(target, { recursive: true, force: true });
    await rm(restored, { recursive: true, force: true });
  });
  await backupHub(app.dataDir, target);
  await writeFile(join(target, "storage.key"), Buffer.alloc(32, 1));
  await assert.rejects(() => restoreHub(target, restored), /integrity/);
  await assert.rejects(
    () => readFile(join(restored, "borderless.db")),
    (error) => error.code === "ENOENT",
  );
});

test("release verification enforces trusted signatures, version, platform, expiry and payload hash", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key = publicKey.export({ format: "pem", type: "spki" });
  const bytes = Buffer.from("an example release package");
  const manifest = {
    version: "0.2.0",
    platform: process.platform,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    expires: "2099-01-01T00:00:00.000Z",
  };
  const signed = (m) => ({
    ...m,
    signature: sign(null, releasePayload(m), privateKey).toString("base64"),
  });
  assert.equal(verifyRelease(signed(manifest), bytes, key).verified, true);
  assert.throws(
    () => verifyRelease({ ...signed(manifest), version: "9.0.0" }, bytes, key),
    /signature/,
  );
  assert.throws(
    () => verifyRelease(signed(manifest), Buffer.from("tampered"), key),
    /integrity/,
  );
  assert.throws(
    () => verifyRelease(signed({ ...manifest, version: "0.0.1" }), bytes, key),
    /not newer/,
  );
  assert.throws(
    () =>
      verifyRelease(
        signed({ ...manifest, platform: "unsupported" }),
        bytes,
        key,
      ),
    /platform/,
  );
  assert.throws(
    () =>
      verifyRelease(signed({ ...manifest, expires: "2000-01-01" }), bytes, key),
    /expired/,
  );
  const other = generateKeyPairSync("ed25519").publicKey.export({
    format: "pem",
    type: "spki",
  });
  assert.throws(
    () => verifyRelease(signed(manifest), bytes, other),
    /signature/,
  );
});

test("a second hub cannot open an active hub’s data directory", async (t) => {
  const app = await fixture(t);
  await assert.rejects(
    () => createApp({ dataDir: app.dataDir, port: 0 }),
    /already in use/,
  );
});

test("failed purge deletion is durable, visible to the leader and retryable", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const file = await upload(
    app,
    admin,
    "remove.txt",
    Buffer.from("Disposable purge test."),
  );
  const remove = app.storage.removeFile;
  app.storage.removeFile = async () => {
    throw Object.assign(new Error("Injected filesystem refusal"), {
      code: "EACCES",
    });
  };
  const result = await command(app, admin, "room.purge");
  assert.equal(result.status, 200);
  assert.equal(result.body.cleanupPending, 1);
  assert.equal((await snapshot(app, admin)).cleanupPending, 1);
  assert.equal(
    (
      await request(
        app,
        `/api/rooms/${admin.roomId}/assets/${file.body.assetId}`,
        { actor: admin },
      )
    ).status,
    404,
  );
  assert.ok(
    (await readFile(join(app.dataDir, "assets", `${file.body.assetId}.blf`)))
      .length > 0,
  );
  app.storage.removeFile = remove;
  const retry = await command(app, admin, "room.cleanup");
  assert.equal(retry.body.cleanupPending, 0);
  await assert.rejects(
    () => readFile(join(app.dataDir, "assets", `${file.body.assetId}.blf`)),
    (error) => error.code === "ENOENT",
  );
  assert.equal(app.store.verifyAudit().valid, true);
});

test("restart reconciles abandoned uploads without deleting live encrypted assets", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const file = await upload(
    app,
    admin,
    "live.txt",
    Buffer.from("Keep this asset."),
  );
  const orphan = randomUUID(),
    partial = randomUUID();
  await app.storage.write(
    Readable.from(Buffer.from("Abandoned before SQL commit.")),
    orphan,
    "orphan.txt",
  );
  await writeFile(
    join(app.dataDir, "assets", `${partial}.part`),
    "partial upload",
  );
  await app.close();
  const second = await createApp({ dataDir: app.dataDir, port: 0 });
  try {
    await assert.rejects(
      () => readFile(join(app.dataDir, "assets", `${orphan}.blf`)),
      (error) => error.code === "ENOENT",
    );
    await assert.rejects(
      () => readFile(join(app.dataDir, "assets", `${partial}.part`)),
      (error) => error.code === "ENOENT",
    );
    const read = await request(
      { ...second, base: second.localURL },
      `/api/rooms/${admin.roomId}/assets/${file.body.assetId}`,
      { actor: admin },
    );
    assert.equal(read.body.toString(), "Keep this asset.");
  } finally {
    await second.close();
  }
});
