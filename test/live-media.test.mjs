import test from "node:test";
import assert from "node:assert/strict";
import { TokenVerifier, TwirpError } from "livekit-server-sdk";
import { LiveMedia } from "../server/live-media.mjs";

function setup() {
  const expires = Date.now() + 60_000;
  const sessions = ["owner", "wall", "leader", "guest"].map((device_id, i) => ({
    device_id, token_hash: `session-${device_id}`, room_id: "room-a", expires,
    role: ["participant", "wall", "admin", "participant"][i], name: device_id,
  }));
  const stream = { id: "stream-a", ownerId: "owner", audience: "room", invitations: [] };
  const room = { id: "room-a", state: { streams: [stream] } };
  const deleted = [];
  const service = { async createRoom() {}, async deleteRoom(name) { deleted.push(name); } };
  const apiKey = "test-only-key", apiSecret = "test-only-secret-that-is-not-a-production-credential";
  const media = new LiveMedia({ apiKey, apiSecret, url: "ws://127.0.0.1:7880", service,
    readRoom: id => id === room.id ? { room, sessions } : { room: null, sessions: [] },
  });
  const verifier = new TokenVerifier(apiKey, apiSecret);
  return { media, room, stream, sessions, deleted, service, verifier };
}

test("signed media grants restrict publisher sources and exclude other participants and rooms", async () => {
  const { media, verifier } = setup();
  const owner = await media.access("room-a", "stream-a", "session-owner");
  const claims = await verifier.verify(owner.token);
  assert.equal(claims.video.canPublish, true);
  assert.deepEqual(claims.video.canPublishSources, ["screen_share"]);
  assert.equal(claims.video.canSubscribe, false);
  assert.equal(claims.video.canPublishData, false);
  assert.equal(claims.video.roomAdmin, false);
  const wall = await media.access("room-a", "stream-a", "session-wall");
  const wallClaims = await verifier.verify(wall.token);
  assert.equal(wall.room, owner.room);
  assert.equal(wallClaims.video.canPublish, false);
  assert.equal(wallClaims.video.canSubscribe, true);
  await assert.rejects(media.access("room-a", "stream-a", "session-guest"), { status: 403 });
  await assert.rejects(media.access("room-b", "stream-a", "session-owner"), { status: 403 });
});

test("private media excludes Wall and leader; accepted recipient revocation replaces the entire media room", async () => {
  const { media, stream, deleted } = setup();
  stream.audience = "private";
  stream.invitations = [{ deviceId: "guest", status: "invited", expiresAt: Date.now() + 60_000 }];
  for (const actor of ["wall", "leader", "guest"])
    await assert.rejects(media.access("room-a", "stream-a", `session-${actor}`), { status: 403 });
  stream.invitations[0].status = "accepted";
  const first = await media.access("room-a", "stream-a", "session-guest");
  stream.invitations = [];
  await media.synchronise("room-a");
  assert.ok(deleted.includes(first.room));
  const next = await media.access("room-a", "stream-a", "session-owner");
  assert.notEqual(next.room, first.room);
  await assert.rejects(media.access("room-a", "stream-a", "session-guest"), { status: 403 });
});

test("revocation failure blocks issuance until deletion succeeds; stopped streams cannot get fresh grants", async () => {
  const { media, room, sessions, service } = setup();
  const first = await media.access("room-a", "stream-a", "session-owner");
  sessions[1].revoked = true;
  service.deleteRoom = async () => { throw new Error("media unavailable"); };
  await assert.rejects(media.synchronise("room-a"), /media unavailable/);
  await assert.rejects(media.access("room-a", "stream-a", "session-owner"), /media unavailable/);
  service.deleteRoom = async () => { throw new TwirpError("not_found", "Room has gone", 404, "not_found"); };
  const recovered = await media.access("room-a", "stream-a", "session-owner");
  assert.notEqual(recovered.room, first.room);
  room.state.streams = [];
  await media.synchronise("room-a");
  await assert.rejects(media.access("room-a", "stream-a", "session-owner"), { status: 403 });
});

test("expired owner sessions retire their stream and reject all viewers", async () => {
  const { media, sessions, deleted } = setup();
  const first = await media.access("room-a", "stream-a", "session-wall");
  sessions[0].expires = Date.now() - 1;
  await media.synchronise("room-a");
  assert.deepEqual(deleted, [first.room]);
  await assert.rejects(media.access("room-a", "stream-a", "session-wall"), { status: 403 });
});

test("access revoked during a control API await cannot escape in a signed token", async () => {
  const { media, sessions, service } = setup();
  service.createRoom = async () => { sessions[1].revoked = true; };
  await assert.rejects(media.access("room-a", "stream-a", "session-wall"), { status: 403 });
});
