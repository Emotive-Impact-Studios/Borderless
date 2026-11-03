import test from "node:test";
import assert from "node:assert/strict";
import { TokenVerifier } from "livekit-server-sdk";
import { fixture, room, participant, wall, command, snapshot, request } from "./helpers.mjs";

function configuration() {
  const deleted = [];
  const media = {
    apiKey: "api-test-key", apiSecret: "api-test-secret-not-a-production-credential",
    url: "ws://127.0.0.1:7880",
    service: { async deleteRoom(name) { deleted.push(name); } },
  };
  return { media, deleted, verifier: new TokenVerifier(media.apiKey, media.apiSecret) };
}
const access = (app, actor, id, data = {}) => request(app,
  `/api/rooms/${actor.roomId}/streams/${id}/media`, { method: "POST", actor, data });

test("media HTTP endpoint authenticates room cookies and CSRF and ignores forged role/identity", async t => {
  const config = configuration();
  const app = await fixture(t, { media: config.media });
  const { admin } = await room(app);
  const owner = await participant(app, admin, "Source");
  const guest = await participant(app, admin, "Other participant");
  const display = (await wall(app, admin)).actor;
  assert.equal((await command(app, owner, "stream.start", { title: "Real source" })).status, 200);
  const id = (await snapshot(app, owner)).streams[0].id;
  assert.equal((await access(app, { ...owner, cookie: "" }, id)).status, 401);
  assert.equal((await access(app, { ...owner, csrf: "wrong" }, id)).status, 403);
  assert.equal((await access(app, guest, id, { role: "admin", deviceId: owner.id })).status, 403);
  const other = await room(app);
  assert.equal((await access(app, other.admin, id)).status, 403);
  const source = await access(app, owner, id, { role: "wall", deviceId: display.id });
  assert.equal(source.status, 200);
  assert.equal((await config.verifier.verify(source.body.token)).video.canPublish, true);
  const receiver = await access(app, display, id, { role: "admin", deviceId: owner.id });
  assert.equal(receiver.status, 200);
  assert.equal((await config.verifier.verify(receiver.body.token)).video.canPublish, false);
  assert.equal(receiver.body.room, source.body.room);
  assert.equal((await command(app, owner, "stream.stop", { streamId: id })).status, 200);
  assert.ok(config.deleted.includes(source.body.room));
  assert.equal((await access(app, display, id)).status, 403);
});

test("private streams cannot issue media tokens to the Wall or leader and logout retires media", async t => {
  const config = configuration();
  const app = await fixture(t, { media: config.media });
  const { admin } = await room(app);
  const owner = await participant(app, admin);
  const display = (await wall(app, admin)).actor;
  await command(app, owner, "stream.start", { audience: "private" });
  const id = (await snapshot(app, owner)).streams[0].id;
  assert.equal((await access(app, admin, id)).status, 403);
  assert.equal((await access(app, display, id)).status, 403);
  const source = await access(app, owner, id);
  assert.equal(source.status, 200);
  const result = await request(app, `/api/rooms/${owner.roomId}/logout`, { method: "POST", actor: owner, data: {} });
  assert.equal(result.status, 200);
  assert.ok(config.deleted.includes(source.body.room));
});

test("retried Stop does not acknowledge an unfinished SFU revocation", async t => {
  const config = configuration();
  const app = await fixture(t, { media: config.media });
  const { admin } = await room(app);
  await command(app, admin, "stream.start");
  const id = (await snapshot(app, admin)).streams[0].id;
  await access(app, admin, id);
  const remove = config.media.service.deleteRoom;
  config.media.service.deleteRoom = async () => { throw new Error("SFU offline"); };
  const data = { commandId: "same-stop-retry", type: "stream.stop", streamId: id };
  const stop = () => request(app, `/api/rooms/${admin.roomId}/command`, { method: "POST", actor: admin, data });
  try {
    assert.equal((await stop()).status, 500);
    assert.equal((await stop()).status, 500);
  } finally { config.media.service.deleteRoom = remove; }
  assert.equal((await stop()).status, 200);
  assert.equal((await access(app, admin, id)).status, 403);
});
