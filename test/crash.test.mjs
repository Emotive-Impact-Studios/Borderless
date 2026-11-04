import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, rm, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";
import { room, upload, request, command, snapshot } from "./helpers.mjs";

function message(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error(`Timed out waiting for crash checkpoint ${type}.`)), 5000);
    const onMessage = data => { if (data.type === type) done(null, data); };
    const onExit = () => done(new Error(`Hub exited before crash checkpoint ${type}.`));
    function done(error, data) {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
      if (error) reject(error); else resolve(data);
    }
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}
async function crash(child) {
  const exited = new Promise(resolve => child.once("exit", resolve));
  child.kill("SIGKILL");
  await exited;
}
async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), "borderless-crash-"));
  const child = fork(new URL("./fixtures/crash-hub.mjs", import.meta.url), [dataDir], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) await crash(child);
    await rm(dataDir, { recursive: true, force: true });
  });
  const ready = await message(child, "ready");
  return { child, dataDir, base: ready.localURL };
}
async function arm(child, stage) {
  const armed = message(child, "armed");
  child.send({ stage });
  await armed;
}

test("SIGKILL after encrypted write but before SQL commit recovers without publishing an incomplete card", { timeout: 15000 }, async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const valid = await upload(app, admin, "valid.txt", Buffer.from("Keep this committed file."));
  await arm(app.child, "upload");
  const fault = message(app.child, "fault");
  const pending = upload(app, admin, "incomplete.txt", Buffer.from("Never committed.")).then(() => false, () => true);
  const { assetId } = await fault;
  assert.ok((await readFile(join(app.dataDir, "assets", `${assetId}.blf`))).length > 32);
  await crash(app.child);
  assert.equal(await pending, true);
  await assert.rejects(createApp({ dataDir: app.dataDir, port: 0 }), /already in use/);
  // The operator's documented stale-lock step, after this test has reaped its PID.
  await unlink(join(app.dataDir, "hub.lock"));
  const recovered = await createApp({ dataDir: app.dataDir, port: 0 });
  try {
    const mirror = { ...recovered, base: recovered.localURL };
    assert.equal((await snapshot(mirror, admin)).items.length, 1);
    await assert.rejects(readFile(join(app.dataDir, "assets", `${assetId}.blf`)), { code: "ENOENT" });
    assert.equal((await request(mirror, `/api/rooms/${admin.roomId}/assets/${valid.body.assetId}`, { actor: admin })).body.toString(), "Keep this committed file.");
    assert.equal(recovered.store.verifyAudit().valid, true);
  } finally {
    await recovered.close();
  }
});

test("SIGKILL after purge commits but before unlink leaves no accessible bytes and retries deletion on restart", { timeout: 15000 }, async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const file = await upload(app, admin, "purge.txt", Buffer.from("Purge these bytes."));
  await arm(app.child, "purge");
  const fault = message(app.child, "fault");
  const pending = command(app, admin, "room.purge").then(() => false, () => true);
  const { filename } = await fault;
  assert.equal((await request(app, `/api/rooms/${admin.roomId}/assets/${file.body.assetId}`, { actor: admin })).status, 404);
  await crash(app.child);
  assert.equal(await pending, true);
  await unlink(join(app.dataDir, "hub.lock"));
  const recovered = await createApp({ dataDir: app.dataDir, port: 0 });
  try {
    const state = await snapshot({ ...recovered, base: recovered.localURL }, admin);
    assert.equal(state.locked, true);
    assert.deepEqual(state.items, []);
    assert.equal(state.cleanupPending, 0);
    await assert.rejects(readFile(join(app.dataDir, "assets", filename)), { code: "ENOENT" });
    assert.equal(recovered.store.verifyAudit().valid, true);
  } finally {
    await recovered.close();
  }
});
