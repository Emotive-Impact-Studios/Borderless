// Explicit local SFU control-plane gate; not a frame-delivery or device test.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startMediaProcess } from "../server/media-process.mjs";
import { createApp } from "../server/app.mjs";
import { WebSocket } from "ws";
import { room, participant, wall, command, snapshot, request } from "../test/helpers.mjs";

const dataDir = await mkdtemp(join(tmpdir(), "borderless-livekit-real-"));
let media, app;
function signalStatus(grant) {
  return new Promise((resolveStatus, reject) => {
    const url = new URL("/rtc", grant.url);
    url.searchParams.set("access_token", grant.token);
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => { socket.terminate(); reject(new Error("Signal handshake timed out")); }, 5000);
    socket.on("open", () => { clearTimeout(timeout); socket.close(); resolveStatus(101); });
    socket.on("unexpected-response", (_request, response) => {
      clearTimeout(timeout); response.resume(); socket.terminate(); resolveStatus(response.statusCode);
    });
    socket.on("error", () => { clearTimeout(timeout); reject(new Error("Signal handshake failed")); });
  });
}
try {
  media = await startMediaProcess({ dataDir, port: 17880, tcpPort: 17881, udpPort: 17882 });
  app = await createApp({ dataDir, port: 0, media });
  app.base = app.localURL;
  const { admin } = await room(app);
  const owner = await participant(app, admin, "Native capture acceptance");
  const display = (await wall(app, admin)).actor;
  assert.equal((await command(app, owner, "stream.start", { title: "Control-plane acceptance" })).status, 200);
  const streamId = (await snapshot(app, owner)).streams[0].id;
  const access = actor => request(app, `/api/rooms/${actor.roomId}/streams/${streamId}/media`,
    { method: "POST", actor, data: {} });
  const publisher = await access(owner), viewer = await access(display);
  assert.equal(publisher.status, 200);
  assert.equal(viewer.status, 200);
  assert.equal(publisher.body.room, viewer.body.room);
  assert.ok((await media.service.listRooms()).some(r => r.name === publisher.body.room));
  assert.equal(await signalStatus(viewer.body), 101);
  assert.equal((await command(app, owner, "stream.stop", { streamId })).status, 200);
  assert.ok(!(await media.service.listRooms()).some(r => r.name === publisher.body.room));
  assert.equal((await access(display)).status, 403);
  assert.notEqual(await signalStatus(viewer.body), 101, "A still-valid old JWT must not recreate the removed media room");
  console.log("Real LiveKit: managed startup, authenticated hub grants, signalling join, Stop deletion and rejection of old-token room recreation passed. No video-frame delivery claimed.");
} finally {
  try { await app?.close(); }
  finally {
    await media?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}
