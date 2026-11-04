import test from "node:test";
import assert from "node:assert/strict";
import { fixture, room, participant, wall, connect, event, request } from "./helpers.mjs";

// A phone flick shows an "incoming" spark on the Wall while bytes really
// arrive, then resolves only when the hub has stored the file (CODEX_BRIEF 4).
test("the Wall sees a flicked file's real transfer from start to confirmed landing", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const sender = await participant(app, admin, "Phone sender");
  const { actor: display } = await wall(app, admin);
  const socket = await connect(app, display);
  t.after(() => socket.close());
  const bytes = Buffer.alloc(512 * 1024, 0x41);
  const result = await request(app, `/api/rooms/${admin.roomId}/upload`, {
    method: "POST", actor: sender, raw: bytes,
    headers: { "Content-Type": "application/octet-stream", "X-Filename": "flick.txt", "X-Wall-Aim": "0.3" },
  });
  assert.equal(result.status, 201);
  const start = await event(socket, e => e.type === "transfer.start");
  assert.match(start.id, /^[a-f0-9-]{36}$/);
  assert.equal(start.aim, 0.3);
  assert.equal(start.ownerName, "Phone sender");
  assert.equal(start.ownerId, sender.id);
  assert.equal(typeof start.colour, "string");
  assert.equal(start.name, "flick.txt");
  const end = await event(socket, e => e.type === "transfer.end" && e.id === start.id);
  assert.equal(end.ok, true);
  assert.equal(end.assetId, result.body.assetId);
  const progress = socket.messages.filter(e => e.type === "transfer.progress" && e.id === start.id);
  for (const step of progress) assert.ok(step.progress >= 0 && step.progress <= 1);
  // The landing state must already contain the file when the end event arrives.
  const order = socket.messages.findIndex(e => e === end);
  const landed = socket.messages.slice(0, order).some(e => e.type === "state" && e.state.items.some(i => i.assetId === result.body.assetId));
  assert.ok(landed, "state with the stored file precedes transfer.end");
});

test("a rejected flick ends its spark without landing anything", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const sender = await participant(app, admin, "Phone sender");
  const { actor: display } = await wall(app, admin);
  const socket = await connect(app, display);
  t.after(() => socket.close());
  const result = await request(app, `/api/rooms/${admin.roomId}/upload`, {
    method: "POST", actor: sender, raw: Buffer.from("not really a png"),
    headers: { "Content-Type": "application/octet-stream", "X-Filename": "fake.png" },
  });
  assert.equal(result.status, 415);
  const start = await event(socket, e => e.type === "transfer.start");
  const end = await event(socket, e => e.type === "transfer.end" && e.id === start.id);
  assert.equal(end.ok, false);
  assert.equal(end.assetId, undefined);
});
