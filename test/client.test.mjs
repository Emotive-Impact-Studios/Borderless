import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { RoomClient } from "../public/js/client.js";
import { fixture, room, participant, wall, command, snapshot, connect, event } from "./helpers.mjs";

// Adapt browser cookie/relative-URL behaviour, keeping actual HTTP, WebSocket,
// persistence and authority. Faults are injected only at the transport boundary.
function browser(t, app, actor) {
  const originals = Object.fromEntries(["fetch", "WebSocket", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const nativeFetch = globalThis.fetch;
  const env = { actor, clients: [], intercept: null, requests: [] };
  globalThis.location = new URL(app.base);
  globalThis.fetch = (input, options = {}) => {
    if (typeof input !== "string" || !input.startsWith("/")) return nativeFetch(input, options);
    const headers = new Headers(options.headers);
    headers.set("Cookie", env.actor.cookie);
    headers.set("Origin", app.base);
    const run = () => nativeFetch(new URL(input, app.base), { ...options, headers });
    env.requests.push({ path: input, body: options.body ? JSON.parse(options.body) : null });
    return env.intercept ? env.intercept(input, options, run) : run();
  };
  globalThis.WebSocket = class extends WebSocket {
    constructor(url) { super(url, { headers: { Cookie: env.actor.cookie }, origin: app.base }); }
  };
  env.client = options => {
    const client = new RoomClient(actor.roomId, { requestTimeout: 2000, reconnectTimeout: 2000, ...options });
    env.clients.push(client);
    return client;
  };
  t.after(() => {
    for (const client of env.clients) client.close();
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return env;
}
function until(target, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { target.removeEventListener(name, changed); reject(new Error(`Missing ${name} event.`)); }, 3000);
    function changed(event) {
      if (!predicate(event.detail)) return;
      clearTimeout(timer);
      target.removeEventListener(name, changed);
      resolve(event.detail);
    }
    target.addEventListener(name, changed);
  });
}
async function online(client) {
  const ready = until(client, "connection", value => value === "online");
  await client.connect();
  await ready;
}

test("client becomes live only after its socket snapshot and rejects offline changes", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const env = browser(t, app, admin), client = env.client();
  const ready = until(client, "connection", value => value === "online");
  await client.connect();
  assert.equal(client.ready, false);
  assert.equal(client.send({ type: "ping" }), false);
  await assert.rejects(client.command("note.add", { text: "Too early." }), /offline/);
  await ready;
  assert.equal(client.ready, true);
  assert.match(client.connectionId, /^[a-f0-9-]{36}$/);
  assert.equal(client.state.me.id, admin.id);
  const offline = until(client, "connection", value => value === "offline");
  client.socket.close();
  await offline;
  await assert.rejects(client.command("note.add", { text: "Disconnected." }), /offline/);
  await assert.rejects(client.upload({ name: "offline.txt" }), /offline/);
  assert.equal((await snapshot(app, admin)).items.length, 0);
});

test("a lost acknowledgement retries one committed command with the same receipt ID", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const env = browser(t, app, admin), client = env.client();
  await online(client);
  let lost = false;
  env.intercept = async (path, options, run) => {
    const response = await run();
    if (path.endsWith("/command") && !lost) {
      lost = true;
      await response.arrayBuffer();
      throw new TypeError("Acknowledgement lost after commit.");
    }
    return response;
  };
  assert.equal((await client.command("note.add", { text: "Exactly once." })).ok, true);
  const commands = env.requests.filter(request => request.path.endsWith("/command"));
  assert.equal(commands.length, 2);
  assert.equal(commands[0].body.commandId, commands[1].body.commandId);
  assert.equal((await snapshot(app, admin)).items.length, 1);
  assert.equal(app.store.db.prepare("SELECT count(*) n FROM commands").get().n, 1);
  assert.equal(app.store.verifyAudit().valid, true);
  assert.equal(client.pending, 0);
});

test("two lost acknowledgements stop retrying and ask the user to check the single committed contribution", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const env = browser(t, app, admin), client = env.client();
  await online(client);
  env.intercept = async (path, options, run) => {
    const response = await run();
    if (path.endsWith("/command")) {
      await response.arrayBuffer();
      throw new TypeError("Both acknowledgements were lost.");
    }
    return response;
  };
  await assert.rejects(client.command("note.add", { text: "Saved, with no acknowledgement." }), /check the canvas before trying again/);
  assert.equal(env.requests.filter(request => request.path.endsWith("/command")).length, 2);
  assert.equal((await snapshot(app, admin)).items.length, 1);
  assert.equal(client.pending, 0);
});

test("manual reconnect refreshes authority and preserves the participant's existing identity", async t => {
  const app = await fixture(t);
  const { admin } = await room(app, { mode: "classroom" });
  const guest = await participant(app, admin);
  const env = browser(t, app, guest), client = env.client();
  await online(client);
  const connectionId = client.connectionId;
  const offline = until(client, "connection", value => value === "offline");
  client.socket.close();
  await offline;
  await command(app, admin, "note.add", { text: "Contributed while away." });
  await command(app, guest, "hand.raise");
  await command(app, admin, "hand.approve", { deviceId: guest.id });
  assert.equal(client.state.me.canDraw, false);
  const ready = until(client, "connection", value => value === "online");
  await client.reconnectNow();
  await ready;
  assert.equal(client.state.me.id, guest.id);
  assert.notEqual(client.connectionId, connectionId);
  assert.equal(client.state.items[0].text, "Contributed while away.");
  assert.equal(client.state.me.canDraw, true);
  assert.equal(env.requests.filter(request => request.path.endsWith("/state")).length, 2);
});

test("an interrupted command never retries under a different rejoined identity", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const first = await participant(app, admin, "First identity");
  const second = await participant(app, admin, "Rejoined identity");
  const env = browser(t, app, first), client = env.client();
  await online(client);
  let changed = false;
  env.intercept = async (path, options, run) => {
    const response = await run();
    if (path.endsWith("/command") && !changed) {
      changed = true;
      await response.arrayBuffer();
      const offline = until(client, "connection", value => value === "offline");
      client.socket.close();
      await offline;
      env.actor = second;
      setImmediate(() => client.reconnectNow());
      throw new TypeError("Response interrupted while identity changed.");
    }
    return response;
  };
  await assert.rejects(client.command("note.add", { text: "Keep original ownership." }), /identity changed/);
  assert.equal(client.state.me.id, second.id);
  const state = await snapshot(app, admin);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].ownerId, first.id);
  assert.equal(env.requests.filter(request => request.path.endsWith("/command")).length, 1);
  assert.equal(client.pending, 0);
});

test("expired credentials stop reconnecting and an authority rejection is not retried", async t => {
  const app = await fixture(t);
  const { admin } = await room(app, { mode: "classroom" });
  const guest = await participant(app, admin);
  const env = browser(t, app, guest), client = env.client();
  await online(client);
  await assert.rejects(client.command("room.lock", { locked: true }), { status: 403 });
  assert.equal(env.requests.filter(request => request.path.endsWith("/command")).length, 1);
  const offline = until(client, "connection", value => value === "offline");
  client.socket.close();
  await offline;
  app.store.db.prepare("UPDATE sessions SET expires=0 WHERE device_id=?").run(guest.id);
  const revoked = until(client, "connection", value => value === "revoked");
  await client.reconnectNow();
  await revoked;
  assert.equal(client.closed, true);
  assert.equal(client.ready, false);
  await assert.rejects(client.whenReady(), /access has ended/);
  assert.equal((await snapshot(app, admin)).locked, false);
});

test("departing display sockets retire media peers only at the owning capture connection", async t => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const { actor } = await wall(app, admin);
  const owner = await connect(app, admin), otherTab = await connect(app, admin), display = await connect(app, actor);
  t.after(() => { owner.terminate(); otherTab.terminate(); display.terminate(); });
  const ownerHello = await event(owner, data => data.type === "hello");
  const displayHello = await event(display, data => data.type === "hello");
  await command(app, admin, "stream.start", { title: "Peer cleanup", connectionId: ownerHello.connectionId });
  const state = await snapshot(app, admin);
  const streamId = state.streams[0].id;
  await event(otherTab, data => data.type === "state" && data.state.streams.some(stream => stream.id === streamId));
  otherTab.messages.length = 0;
  display.close();
  const retired = await event(owner, data => data.type === "rtc.peer.left");
  assert.equal(retired.streamId, streamId);
  assert.equal(retired.connectionId, displayHello.connectionId);
  // The close notification precedes the shared snapshot on each ordered socket.
  await event(otherTab, data => data.type === "state" && !data.state.devices.find(device => device.id === actor.id)?.online);
  assert.equal(otherTab.messages.some(data => data.type === "rtc.peer.left"), false);
  assert.equal((await snapshot(app, admin)).streams.length, 1);
});
