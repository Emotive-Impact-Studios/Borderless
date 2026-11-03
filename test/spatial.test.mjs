import test from "node:test";
import assert from "node:assert/strict";
import { fixture, room, participant, wall, command, snapshot, upload } from "./helpers.mjs";
import { createApp } from "../server/app.mjs";

const bounds = value => Object.fromEntries(["x", "y", "w", "h"].map(key => [key, value[key]]));

test("live window geometry is shared, versioned and restricted to its owner or leader", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const owner = await participant(app, admin, "Screen owner");
  const stranger = await participant(app, admin, "Another participant");
  const { actor: display } = await wall(app, admin);
  await command(app, owner, "stream.start", { title: "A real stream advertisement" });
  let stream = (await snapshot(app, admin)).streams[0];
  assert.deepEqual(bounds(stream), { x: .14, y: .16, w: .5, h: .5 });
  assert.equal(stream.version, 1);
  const reference = { streamId: stream.id, version: stream.version, x: .2, y: .3 };
  assert.equal((await command(app, stranger, "stream.move", reference)).status, 403);
  assert.equal((await command(app, display, "stream.move", reference)).status, 403);
  assert.equal((await command(app, owner, "stream.move", { ...reference, x: 9 })).status, 400);
  assert.equal((await command(app, owner, "stream.move", reference)).status, 200);
  assert.equal((await command(app, owner, "stream.move", reference)).status, 409);
  stream = (await snapshot(app, display)).streams[0];
  assert.equal(stream.x, .2);
  assert.equal(stream.y, .3);
  assert.equal(stream.version, 2);
  assert.equal((await command(app, admin, "stream.resize", { streamId: stream.id, version: 2, w: .4, h: .38 })).status, 200);
  stream = (await snapshot(app, owner)).streams[0];
  const normal = bounds(stream);
  const focus = { streamId: stream.id, version: stream.version, commandId: "focus-once" };
  assert.equal((await command(app, owner, "stream.focus", focus)).status, 200);
  assert.equal((await command(app, owner, "stream.focus", focus)).status, 200);
  stream = (await snapshot(app, display)).streams[0];
  assert.deepEqual(stream.restoreBounds, normal);
  assert.equal(stream.version, 4);
  assert.equal(stream.w, .92);
  assert.equal((await command(app, owner, "stream.resize", { streamId: stream.id, version: 4, w: .2, h: .2 })).status, 409);
  assert.equal((await command(app, admin, "stream.focus", { streamId: stream.id, version: 4 })).status, 200);
  stream = (await snapshot(app, display)).streams[0];
  assert.deepEqual(bounds(stream), normal);
  assert.equal(stream.restoreBounds, undefined);
  await command(app, admin, "room.lock", { locked: true });
  assert.equal((await snapshot(app, owner)).streams.length, 0);
  assert.equal((await command(app, owner, "stream.start")).status, 403);
  assert.equal(app.store.verifyAudit().valid, true);
});

test("file/note stacking and focus restore persist without losing original bounds", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const owner = await participant(app, admin);
  await command(app, owner, "note.add", { title: "Keep my geometry", text: "A persistent thought." });
  await upload(app, owner, "alongside.txt", Buffer.from("The file stays beside the note."));
  let state = await snapshot(app, owner);
  const note = state.items.find(item => item.kind === "note"), file = state.items.find(item => item.kind === "file");
  assert.ok(file.z > note.z);
  const reference = { itemId: note.id, version: note.version };
  assert.equal((await command(app, owner, "item.focus", reference)).status, 200);
  state = await snapshot(app, owner);
  const focused = state.items.find(item => item.id === note.id);
  assert.deepEqual(focused.restoreBounds, bounds(note));
  assert.ok(focused.z > state.items.find(item => item.id === file.id).z);
  await app.close();
  const restarted = await createApp({ dataDir: app.dataDir, port: 0 });
  t.after(() => restarted.close());
  const current = { ...restarted, base: restarted.localURL };
  const restored = (await snapshot(current, owner)).items.find(item => item.id === note.id);
  assert.deepEqual(restored.restoreBounds, bounds(note));
  assert.equal((await command(current, owner, "item.focus", { itemId: note.id, version: restored.version })).status, 200);
  assert.deepEqual(bounds((await snapshot(current, owner)).items.find(item => item.id === note.id)), bounds(note));
  assert.equal(restarted.store.verifyAudit().valid, true);
});

test("arranging the full scene includes all sixty contributions and six live windows within valid bounds", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  for (let index = 0; index < 60; index++)
    assert.equal((await command(app, admin, "note.add", { title: `Thought ${index}`, text: "One owned contribution." })).status, 200);
  for (let index = 0; index < 6; index++) {
    const actor = await participant(app, admin, `Capture ${index}`);
    assert.equal((await command(app, actor, "stream.start")).status, 200);
  }
  assert.equal((await command(app, admin, "room.layout", { layout: "grid" })).status, 200);
  const state = await snapshot(app, admin), all = [...state.items, ...state.streams];
  assert.equal(all.length, 66);
  assert.equal(new Set(all.map(value => value.z)).size, 66);
  for (const value of all) {
    assert.ok(value.x >= 0 && value.y >= 0);
    assert.ok(value.w >= .08 && value.h >= .08);
    assert.ok(value.x + value.w <= 1 && value.y + value.h <= 1);
    assert.equal(value.version, 2);
  }
  const stream = state.streams[0];
  assert.equal((await command(app, admin, "room.layout", { layout: "focus", streamId: stream.id })).status, 200);
  assert.equal((await snapshot(app, admin)).streams[0].w, .92);
  await command(app, admin, "room.layout", { layout: "grid" });
  assert.equal((await snapshot(app, admin)).streams.some(value => value.restoreBounds), false);
  assert.equal(app.store.verifyAudit().valid, true);
});
