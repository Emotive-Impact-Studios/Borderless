import test from "node:test";
import assert from "node:assert/strict";
import { fixture, room, participant, command, snapshot, upload } from "./helpers.mjs";
import { smartLayout } from "../server/spatial.mjs";

const overlap = (a, b) => a.x < b.x + b.w - 1e-9 && a.x + a.w > b.x + 1e-9 && a.y < b.y + b.h - 1e-9 && a.y + a.h > b.y + 1e-9;
const inside = s => s.x >= 0 && s.y >= 0 && s.x + s.w <= 1 + 1e-9 && s.y + s.h <= 1 + 1e-9;
const surface = (id, extra = {}) => ({ id, ownerId: extra.ownerId ?? "a", x: .1, y: .1, w: .2, h: .2, version: 1, ...extra });

test("auto layout: one large, two side by side, a live lead with the rest stacked, never overlapping", () => {
  const one = { items: [surface("n1")], streams: [] };
  smartLayout(one, "auto");
  assert.ok(one.items[0].w > .8 && one.items[0].h > .7);
  const two = { items: [surface("n1"), surface("n2")], streams: [] };
  smartLayout(two, "auto");
  assert.ok(Math.abs(two.items[0].w - two.items[1].w) < 1e-9 && !overlap(two.items[0], two.items[1]));
  const live = surface("live"), many = { items: [surface("f1"), surface("f2"), surface("f3")], streams: [live] };
  smartLayout(many, "auto");
  const all = [...many.items, live];
  assert.ok(all.every(s => s === live || live.w > s.w), "the live window leads");
  for (const a of all) { assert.ok(inside(a)); for (const b of all) if (a !== b) assert.ok(!overlap(a, b)); }
  assert.ok(all.every(s => s.version === 2), "every moved surface is versioned");
});

test("side by side and stack-by-person modes keep every window readable and inside the Wall", () => {
  const scene = () => ({ items: [surface("a1", { ownerId: "ama" }), surface("a2", { ownerId: "ama" }), surface("k1", { ownerId: "kofi" })], streams: [] });
  const side = scene();
  smartLayout(side, "side");
  assert.ok(side.items.every(inside));
  assert.ok(new Set(side.items.map(s => s.y)).size === 1, "one row");
  const stack = scene();
  smartLayout(stack, "stack");
  const [a1, a2, k1] = stack.items;
  assert.ok(stack.items.every(inside));
  assert.ok(Math.abs(a1.x - a2.x) < .05 && Math.abs(k1.x - a1.x) > .3, "each person gets a column; their windows form a deck");
});

test("windows moved by hand stay pinned through automatic layout until the leader re-applies Auto", () => {
  const pinned = surface("p", { x: .02, y: .1, w: .3, h: .4, pinned: true });
  const state = { items: [pinned, surface("f1"), surface("f2")], streams: [] };
  smartLayout(state, "auto", { arrival: true });
  assert.deepEqual([pinned.x, pinned.y, pinned.w], [.02, .1, .3]);
  for (const s of state.items) if (s !== pinned) assert.ok(!overlap(s, pinned) && inside(s));
  smartLayout(state, "auto");
  assert.equal(pinned.pinned, undefined);
});

test("the leader switches the Wall to Auto, arrivals rearrange it, hand moves pin and Undo restores", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const phone = await participant(app, admin, "Ama");
  assert.equal((await command(app, phone, "room.layout", { layout: "auto" })).status, 403);
  await command(app, phone, "note.add", { title: "First", text: "One." });
  const before = (await snapshot(app, admin)).items[0];
  assert.equal((await command(app, admin, "room.layout", { layout: "auto" })).status, 200);
  let state = await snapshot(app, admin);
  assert.equal(state.layout, "auto");
  assert.ok(state.items[0].w > .8);
  await upload(app, phone, "second.txt", Buffer.from("Arrives and is laid out."));
  state = await snapshot(app, admin);
  const [first, second] = state.items;
  assert.ok(!overlap(first, second) && Math.abs(first.w - second.w) < 1e-9, "the arrival re-laid the Wall out");
  assert.equal((await command(app, phone, "item.move", { itemId: second.id, version: second.version, x: .5, y: .05 })).status, 200);
  state = await snapshot(app, admin);
  assert.equal(state.items.find(i => i.id === second.id).pinned, true);
  assert.equal((await command(app, admin, "room.layout", { layout: "undo" })).status, 200);
  state = await snapshot(app, admin);
  assert.equal(state.items.find(i => i.id === first.id).w, before.w, "undo restores the arrangement before Auto was last applied");
  assert.equal(app.store.verifyAudit().valid, true);
});

test("four windows without a live one form a full two by two grid", () => {
  const state = { items: ["a", "b", "c", "d"].map(id => surface(id)), streams: [] };
  smartLayout(state, "auto");
  assert.equal(new Set(state.items.map(s => s.x.toFixed(3))).size, 2);
  assert.equal(new Set(state.items.map(s => s.y.toFixed(3))).size, 2);
});
