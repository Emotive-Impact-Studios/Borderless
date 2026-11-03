import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtemp, readdir, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startMediaProcess } from "../server/media-process.mjs";

test("managed media authenticates readiness, protects configuration and removes it on stop", async t => {
  const dataDir = await mkdtemp(join(tmpdir(), "borderless-media-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const media = await startMediaProcess({
    executable: process.execPath,
    args: [fileURLToPath(new URL("./fixtures/media-process.mjs", import.meta.url))],
    dataDir, port, tcpPort: 17881, udpPort: 17882,
  });
  t.after(() => media.close());
  const [directory] = await readdir(join(dataDir, "media"));
  const path = join(dataDir, "media", directory, "livekit.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(config.room.auto_create, false);
  assert.deepEqual(config.bind_addresses, ["127.0.0.1"]);
  assert.equal(Object.values(config.keys)[0], media.apiSecret);
  assert.ok(media.apiSecret.length >= 64);
  assert.deepEqual(await media.service.listRooms(), []);
  await media.close();
  assert.equal(media.ended, true);
  assert.deepEqual(await readdir(join(dataDir, "media")), []);
  await media.close();
});

test("missing executable fails startup and removes its credential file", async t => {
  const dataDir = await mkdtemp(join(tmpdir(), "borderless-media-missing-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  await assert.rejects(startMediaProcess({ executable: join(dataDir, "missing"), dataDir }), /not installed/);
  assert.deepEqual(await readdir(join(dataDir, "media")), []);
});
