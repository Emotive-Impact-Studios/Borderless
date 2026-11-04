import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  fixture,
  request,
  room,
  participant,
  wall,
  snapshot,
  command,
  upload,
  connect,
  event,
} from "./helpers.mjs";
import { esc } from "../public/js/ui.js";
import { createApp } from "../server/app.mjs";

test("the hub serves its real application, local assets, CSP and honest capabilities", async (t) => {
  const app = await fixture(t);
  const page = await request(app, "/");
  assert.equal(page.status, 200);
  assert.match(page.body.toString(), /js\/app.js/);
  assert.match(
    page.response.headers.get("content-security-policy"),
    /script-src 'self'/,
  );
  assert.equal((await request(app, "/js/app.js")).status, 200);
  const caps = await request(app, "/api/capabilities");
  assert.equal(caps.body.virtualDisplay, false);
  assert.equal(caps.body.databaseEncryption, false);
  const health = await request(app, "/api/health");
  assert.equal(health.body.status, "ok");
  assert.equal((await request(app, "/api/not-a-route")).status, 404);
  assert.equal(
    (
      await request(app, "/api/health", {
        headers: { Origin: "https://hostile.invalid" },
      })
    ).status,
    403,
  );
});

test("room creation validates credentials and participants cannot self-assign privileges", async (t) => {
  const app = await fixture(t);
  const bad = await request(app, "/api/rooms", {
    method: "POST",
    data: { name: "Room", adminName: "A", password: "short", mode: "studio" },
  });
  assert.equal(bad.status, 400);
  const { admin } = await room(app);
  const guest = await participant(app, admin, "Sam", {
    role: "admin",
    deviceId: admin.id,
  });
  const state = await snapshot(app, guest);
  assert.equal(state.me.role, "participant");
  assert.notEqual(state.me.id, admin.id);
  assert.ok(!("joinCode" in state));
  assert.equal(
    (await command(app, guest, "room.theme", { theme: "command" })).status,
    403,
  );
  assert.equal(
    (await request(app, `/api/rooms/${admin.roomId}/audit`, { actor: guest }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(app, `/api/rooms/${admin.roomId}/login`, {
        method: "POST",
        data: { password: "wrong" },
      })
    ).status,
    403,
  );
  const login = await request(app, `/api/rooms/${admin.roomId}/login`, {
    method: "POST",
    data: { name: "Returning leader", password: "a-good-test-password" },
  });
  assert.equal(login.status, 200);
  assert.match(
    login.response.headers.get("set-cookie"),
    /HttpOnly; SameSite=Strict/,
  );
});

test("room state and mutation require that room’s cookie and a fresh CSRF token", async (t) => {
  const app = await fixture(t);
  const a = await room(app),
    b = await room(app, { name: "Other room" });
  assert.equal(
    (await request(app, `/api/rooms/${a.roomId}/state`)).status,
    401,
  );
  assert.equal(
    (await request(app, `/api/rooms/${b.roomId}/state`, { actor: a.admin }))
      .status,
    401,
  );
  const noCSRF = await request(app, `/api/rooms/${a.roomId}/command`, {
    method: "POST",
    actor: { ...a.admin, csrf: "bad" },
    data: { commandId: "a", type: "room.lock", locked: true },
  });
  assert.equal(noCSRF.status, 403);
  assert.equal((await snapshot(app, a.admin)).locked, false);
  assert.equal(
    (await command(app, a.admin, "note.add", { text: "Hello from A" })).status,
    200,
  );
  assert.equal((await snapshot(app, b.admin)).items.length, 0);
});

test("invites rotate and display pairing is one-use and read-only", async (t) => {
  const app = await fixture(t);
  const { admin, state } = await room(app);
  assert.equal((await command(app, admin, "invite.rotate")).status, 200);
  const old = await request(app, `/api/rooms/${admin.roomId}/join`, {
    method: "POST",
    data: { name: "Old invite", code: state.joinCode },
  });
  assert.equal(old.status, 403);
  const { actor, token } = await wall(app, admin);
  assert.equal((await snapshot(app, actor)).me.role, "wall");
  assert.equal(
    (await command(app, actor, "note.add", { text: "Should not appear" }))
      .status,
    403,
  );
  assert.equal(
    (
      await command(app, actor, "stroke.add", {
        points: [
          [0, 0],
          [1, 1],
        ],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app, `/api/rooms/${admin.roomId}/wall-pair`, {
        method: "POST",
        data: { token },
      })
    ).status,
    403,
  );
  const invite = await request(app, `/api/rooms/${admin.roomId}/invite`, {
    actor,
  });
  assert.equal(invite.status, 200);
  assert.match(invite.body.qr, /^data:image\/png;base64,/);
});

test("a room command is idempotent and edits reject stale versions and invalid geometry", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  const data = {
    commandId: "one-logical-add",
    text: "A thought",
    title: "Hello",
  };
  assert.equal((await command(app, guest, "note.add", data)).status, 200);
  assert.equal((await command(app, guest, "note.add", data)).status, 200);
  let state = await snapshot(app, admin);
  assert.equal(state.items.length, 1);
  const item = state.items[0];
  assert.equal(
    (
      await command(app, guest, "item.move", {
        itemId: item.id,
        version: 1,
        x: 0.2,
        y: 0.2,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(app, guest, "item.move", {
        itemId: item.id,
        version: 1,
        x: 0.4,
        y: 0.4,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await command(app, guest, "item.move", {
        itemId: item.id,
        version: 2,
        x: 9,
        y: 0,
      })
    ).status,
    400,
  );
  const other = await participant(app, admin, "Other");
  assert.equal(
    (await command(app, other, "item.remove", { itemId: item.id, version: 2 }))
      .status,
    403,
  );
  assert.equal(
    (
      await command(app, admin, "item.edit", {
        itemId: item.id,
        version: 2,
        title: "Refined",
        text: "Updated",
      })
    ).status,
    200,
  );
  state = await snapshot(app, admin);
  assert.equal(state.items[0].version, 3);
  assert.equal(state.items[0].text, "Updated");
});

test("classroom hand raising, approval and revocation are enforced on the server", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app, { mode: "classroom" });
  const guest = await participant(app, admin);
  const stroke = {
    points: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
    width: 3,
  };
  assert.equal((await snapshot(app, guest)).me.canDraw, false);
  assert.equal((await command(app, guest, "stroke.add", stroke)).status, 403);
  await command(app, guest, "hand.raise");
  await command(app, guest, "hand.raise");
  assert.equal((await snapshot(app, admin)).requests.length, 1);
  assert.equal(
    (await command(app, guest, "hand.approve", { deviceId: guest.id })).status,
    403,
  );
  await command(app, admin, "hand.approve", { deviceId: guest.id });
  assert.equal((await snapshot(app, guest)).me.canDraw, true);
  assert.equal((await command(app, guest, "stroke.add", stroke)).status, 200);
  await command(app, admin, "hand.revoke", { deviceId: guest.id });
  assert.equal((await command(app, guest, "stroke.add", stroke)).status, 403);
  await command(app, admin, "ink.clear");
  assert.equal((await snapshot(app, admin)).strokes.length, 0);
});

test("pause blocks participant notes, files, streams and ink while the leader can continue", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  await command(app, admin, "room.lock", { locked: true });
  assert.equal(
    (await command(app, guest, "note.add", { text: "Blocked" })).status,
    403,
  );
  assert.equal((await command(app, guest, "stream.start")).status, 403);
  assert.equal(
    (
      await command(app, guest, "stroke.add", {
        points: [
          [0, 0],
          [1, 1],
        ],
      })
    ).status,
    403,
  );
  assert.equal(
    (await upload(app, guest, "hello.txt", Buffer.from("Hello"))).status,
    403,
  );
  assert.equal(
    (await command(app, admin, "note.add", { text: "Leader can continue" }))
      .status,
    200,
  );
  await command(app, admin, "room.lock", { locked: false });
  assert.equal(
    (await command(app, guest, "note.add", { text: "Now welcome" })).status,
    200,
  );
});

test("quizzes keep answers private, reject duplicates and reveal results only after closing", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app, { mode: "classroom" });
  const a = await participant(app, admin, "A"),
    b = await participant(app, admin, "B");
  assert.equal(
    (
      await command(app, admin, "quiz.start", {
        question: "Pick a colour",
        options: ["Green", "Blue"],
        correct: 0,
      })
    ).status,
    200,
  );
  let qa = (await snapshot(app, a)).quiz;
  assert.ok(!("correct" in qa));
  assert.ok(!("counts" in qa));
  assert.ok(!("answers" in qa));
  assert.equal(
    (
      await command(app, a, "quiz.answer", {
        quizId: qa.id,
        answer: 0,
        correct: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await command(app, a, "quiz.answer", { quizId: qa.id, answer: 1 })).status,
    409,
  );
  assert.equal(
    (await command(app, b, "quiz.answer", { quizId: "old-quiz", answer: 1 }))
      .status,
    409,
  );
  await command(app, b, "quiz.answer", { quizId: qa.id, answer: 1 });
  assert.deepEqual((await snapshot(app, admin)).quiz.counts, [1, 1]);
  await command(app, admin, "quiz.close");
  qa = (await snapshot(app, a)).quiz;
  assert.equal(qa.correct, 0);
  assert.deepEqual(qa.counts, [1, 1]);
  assert.equal(qa.myAnswer, 0);
  assert.equal(
    (await command(app, b, "quiz.answer", { quizId: qa.id, answer: 0 })).status,
    409,
  );
});

test("file transfers encrypt bytes at rest, verify hashes, support ranges and stay in their room", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  const b = await room(app, { name: "Another room" });
  const plain = Buffer.from("A real confidential document for the test room.");
  const result = await upload(app, guest, "hello.txt", plain);
  assert.equal(result.status, 201);
  const assetId = result.body.assetId;
  assert.equal(
    result.body.hash,
    createHash("sha256").update(plain).digest("hex"),
  );
  const disk = await readFile(join(app.dataDir, "assets", `${assetId}.blf`));
  assert.equal(disk.subarray(0, 4).toString(), "BLF1");
  assert.equal(disk.includes(plain), false);
  const file = await request(
    app,
    `/api/rooms/${admin.roomId}/assets/${assetId}`,
    { actor: admin },
  );
  assert.equal(file.status, 200);
  assert.deepEqual(file.body, plain);
  assert.match(file.response.headers.get("content-security-policy"), /sandbox/);
  const range = await request(
    app,
    `/api/rooms/${admin.roomId}/assets/${assetId}`,
    { actor: admin, headers: { Range: "bytes=2-7" } },
  );
  assert.equal(range.status, 206);
  assert.deepEqual(range.body, plain.subarray(2, 8));
  assert.equal(
    (
      await request(app, `/api/rooms/${admin.roomId}/assets/${assetId}`, {
        actor: admin,
        headers: { Range: "bytes=9999-" },
      })
    ).status,
    416,
  );
  assert.equal(
    (
      await request(app, `/api/rooms/${b.roomId}/assets/${assetId}`, {
        actor: b.admin,
      })
    ).status,
    404,
  );
});

test("corrupted ciphertext is never served as a successful file", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const result = await upload(
    app,
    admin,
    "content.txt",
    Buffer.from("Integrity matters."),
  );
  const filename = join(app.dataDir, "assets", `${result.body.assetId}.blf`);
  const bytes = await readFile(filename);
  bytes[18] ^= 0xff;
  await writeFile(filename, bytes);
  const read = await request(
    app,
    `/api/rooms/${admin.roomId}/assets/${result.body.assetId}`,
    { actor: admin },
  );
  assert.equal(read.status, 422);
});

test("active content and forged file types are refused without orphan files", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  assert.equal(
    (
      await upload(
        app,
        admin,
        "payload.html",
        Buffer.from("<script>bad()</script>"),
      )
    ).status,
    415,
  );
  assert.equal(
    (await upload(app, admin, "photo.png", Buffer.from("not a png"))).status,
    415,
  );
  assert.equal(
    (await upload(app, admin, "empty.txt", Buffer.alloc(0))).status,
    415,
  );
  assert.equal((await readdir(join(app.dataDir, "assets"))).length, 0);
  assert.equal((await snapshot(app, admin)).items.length, 0);
});

test("reverse delivery goes to a chosen device and only that device can accept it", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const a = await participant(app, admin, "Sender"),
    b = await participant(app, admin, "Receiver");
  const file = await upload(
    app,
    a,
    "hello.txt",
    Buffer.from("Hello from the room."),
  );
  assert.equal(
    (
      await command(app, b, "delivery.send", {
        assetId: file.body.assetId,
        deviceId: a.id,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await command(app, admin, "delivery.send", {
        assetId: file.body.assetId,
        deviceId: b.id,
      })
    ).status,
    200,
  );
  assert.equal((await snapshot(app, a)).deliveries.length, 0);
  const delivery = (await snapshot(app, b)).deliveries[0];
  assert.equal(
    (await command(app, a, "delivery.accept", { deliveryId: delivery.id }))
      .status,
    404,
  );
  assert.equal(
    (await command(app, b, "delivery.accept", { deliveryId: delivery.id }))
      .status,
    200,
  );
  assert.equal((await snapshot(app, b)).deliveries[0].accepted, true);
});

test("websocket snapshots and pointers preserve identities and reject forged coordinates", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  const a = await connect(app, admin),
    g = await connect(app, guest);
  t.after(() => {
    a.terminate();
    g.terminate();
  });
  await event(
    a,
    (e) =>
      e.type === "state" &&
      e.state.devices.some((d) => d.id === guest.id && d.online),
  );
  g.send(
    JSON.stringify({
      type: "pointer",
      deviceId: admin.id,
      device: { name: "FORGED" },
      x: 0.2,
      y: 0.7,
      active: true,
    }),
  );
  const pointer = await event(a, (e) => e.type === "pointer");
  assert.equal(pointer.device.id, guest.id);
  assert.equal(pointer.device.name, "Participant");
  g.send(JSON.stringify({ type: "pointer", x: 100, y: 0.2, active: true }));
  assert.match((await event(g, (e) => e.type === "error")).error, /range/);
  await command(app, guest, "note.add", { text: "Live to the wall" });
  const update = await event(
    a,
    (e) => e.type === "state" && e.state.items.length === 1,
  );
  assert.equal(update.state.items[0].text, "Live to the wall");
});

test("WebRTC signalling is targeted and limited to a stream owner and authorised display", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const owner = await participant(app, admin, "Sharer"),
    outsider = await participant(app, admin, "Spectator");
  const { actor: display } = await wall(app, admin);
  await command(app, owner, "stream.start");
  const stream = (await snapshot(app, owner)).streams[0];
  const o = await connect(app, owner),
    d = await connect(app, display),
    x = await connect(app, outsider);
  t.after(() => {
    o.terminate();
    d.terminate();
    x.terminate();
  });
  d.send(
    JSON.stringify({
      type: "rtc",
      streamId: stream.id,
      targetId: owner.id,
      kind: "ready",
    }),
  );
  assert.equal((await event(o, (e) => e.type === "rtc")).fromId, display.id);
  o.send(
    JSON.stringify({
      type: "rtc",
      streamId: stream.id,
      targetId: display.id,
      kind: "offer",
      payload: { type: "offer", sdp: "test-sdp" },
    }),
  );
  assert.equal(
    (await event(d, (e) => e.type === "rtc")).payload.sdp,
    "test-sdp",
  );
  x.send(
    JSON.stringify({
      type: "rtc",
      streamId: stream.id,
      targetId: owner.id,
      kind: "ready",
    }),
  );
  assert.match(
    (await event(x, (e) => e.type === "error")).error,
    /Accept the owner's live-window invitation/,
  );
});

test("eviction revokes both HTTP and websocket access immediately", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  const socket = await connect(app, guest);
  const closed = new Promise((resolve) =>
    socket.once("close", (code) => resolve(code)),
  );
  await command(app, admin, "device.evict", { deviceId: guest.id });
  assert.equal(await closed, 4001);
  assert.equal(
    (await request(app, `/api/rooms/${admin.roomId}/state`, { actor: guest }))
      .status,
    401,
  );
  assert.equal(
    (await command(app, guest, "note.add", { text: "No longer welcome" }))
      .status,
    401,
  );
});

test("media signals target one tab and closing the capture tab stops its stream despite another tab sharing its cookie", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const { actor: display } = await wall(app, admin);
  const capture = await connect(app, admin),
    leaderTab = await connect(app, admin),
    displayA = await connect(app, display),
    displayB = await connect(app, display);
  t.after(() => {
    capture.terminate();
    leaderTab.terminate();
    displayA.terminate();
    displayB.terminate();
  });
  const captureId = (await event(capture, (e) => e.type === "hello"))
    .connectionId;
  const receiverId = (await event(displayA, (e) => e.type === "hello"))
    .connectionId;
  await command(app, admin, "stream.start", { connectionId: captureId });
  const started = await snapshot(app, admin),
    stream = started.streams[0];
  capture.send(
    JSON.stringify({
      type: "rtc",
      streamId: stream.id,
      targetId: display.id,
      targetConnectionId: receiverId,
      kind: "offer",
      payload: { sdp: "only-one-tab" },
    }),
  );
  assert.equal(
    (await event(displayA, (e) => e.type === "rtc")).payload.sdp,
    "only-one-tab",
  );
  displayB.send(JSON.stringify({ type: "ping", at: 12345 }));
  await event(displayB, (e) => e.type === "pong" && e.at === 12345);
  assert.equal(
    displayB.messages.some((e) => e.type === "rtc"),
    false,
  );
  capture.close();
  await event(
    leaderTab,
    (e) =>
      e.type === "state" &&
      e.state.revision > started.revision &&
      e.state.streams.length === 0,
  );
  assert.equal((await snapshot(app, admin)).streams.length, 0);
  assert.equal(leaderTab.readyState, 1);
});

test("purge removes file bytes, clears content and stops shares but keeps the audit verifiable", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  const file = await upload(
    app,
    guest,
    "example.txt",
    Buffer.from("Disposable test data."),
  );
  await command(app, guest, "stream.start");
  await command(app, guest, "stroke.add", {
    points: [
      [0, 0],
      [1, 1],
    ],
  });
  assert.equal((await command(app, admin, "room.purge")).status, 200);
  const state = await snapshot(app, admin);
  assert.equal(state.locked, true);
  assert.equal(state.items.length, 0);
  assert.equal(state.strokes.length, 0);
  assert.equal(state.streams.length, 0);
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
  // Unlink is intentionally after the committed state change. Wait for the filesystem task itself.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await readdir(join(app.dataDir, "assets"))).length, 0);
  const audit = (
    await request(app, `/api/rooms/${admin.roomId}/audit`, { actor: admin })
  ).body;
  assert.equal(audit.verification.valid, true);
  assert.ok(audit.events.some((e) => e.action === "room.purge"));
});

test("a completed session cannot be rejoined and existing participant credentials stop working", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin),
    before = await snapshot(app, admin);
  await command(app, admin, "room.end");
  assert.equal((await snapshot(app, admin)).ended, true);
  assert.equal(
    (await request(app, `/api/rooms/${admin.roomId}/state`, { actor: guest }))
      .status,
    401,
  );
  assert.equal(
    (
      await request(app, `/api/rooms/${admin.roomId}/join`, {
        method: "POST",
        data: { name: "Late", code: before.joinCode },
      })
    ).status,
    409,
  );
});

test("audit chains are scoped by room, append-only and detect content tampering", async (t) => {
  const app = await fixture(t);
  const a = await room(app),
    b = await room(app, { name: "Second room" });
  await command(app, a.admin, "note.add", { text: "Private room A note" });
  await command(app, b.admin, "note.add", { text: "Private room B note" });
  assert.equal(app.store.verifyAudit().valid, true);
  const audit = (
    await request(app, `/api/rooms/${a.roomId}/audit`, { actor: a.admin })
  ).body;
  assert.ok(audit.events.every((e) => e.room_id === a.roomId));
  assert.ok(!JSON.stringify(audit).includes("Private room A note"));
  assert.throws(
    () =>
      app.store.db
        .prepare("UPDATE audit SET details=? WHERE room_id=?")
        .run("changed", a.roomId),
    /append-only/,
  );
  app.store.db.exec("DROP TRIGGER audit_no_update");
  app.store.db
    .prepare(
      "UPDATE audit SET details=? WHERE seq=(SELECT min(seq) FROM audit)",
    )
    .run("{}");
  assert.equal(app.store.verifyAudit().valid, false);
});

test("persisted sessions, notes, ink and encrypted files survive restart; live streams do not", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  await command(app, admin, "note.add", { text: "Persist me" });
  await command(app, admin, "stream.start");
  await command(app, admin, "stroke.add", {
    points: [
      [0.1, 0.2],
      [0.2, 0.3],
    ],
  });
  const file = await upload(
    app,
    admin,
    "durable.txt",
    Buffer.from("Durable bytes"),
  );
  await app.close();
  const second = await createApp({ dataDir: app.dataDir, port: 0 });
  t.after(() => second.close());
  const restarted = { ...second, base: second.localURL };
  const state = await snapshot(restarted, admin);
  assert.equal(state.items.length, 2);
  assert.equal(state.strokes.length, 1);
  assert.equal(state.streams.length, 0);
  assert.equal(
    (
      await request(
        restarted,
        `/api/rooms/${admin.roomId}/assets/${file.body.assetId}`,
        { actor: admin },
      )
    ).body.toString(),
    "Durable bytes",
  );
  assert.equal(second.store.verifyAudit().valid, true);
});

test("unsupported events and malformed commands fail without changing room state", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const before = await snapshot(app, admin);
  assert.equal((await command(app, admin, "not-a-command")).status, 400);
  assert.equal(
    (
      await command(app, admin, "stroke.add", {
        points: [
          [0, 0],
          [null, 1],
        ],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(app, admin, "quiz.start", {
        question: "Bad index",
        options: ["A", "B"],
        correct: 0.5,
      })
    ).status,
    400,
  );
  assert.equal((await snapshot(app, admin)).revision, before.revision);
});

test("expired sessions are refused, and text rendering escapes executable markup", async (t) => {
  const app = await fixture(t);
  const { admin } = await room(app);
  const guest = await participant(app, admin);
  app.store.db
    .prepare("UPDATE sessions SET expires=0 WHERE device_id=?")
    .run(guest.id);
  assert.equal(
    (await request(app, `/api/rooms/${admin.roomId}/state`, { actor: guest }))
      .status,
    401,
  );
  assert.equal(
    esc('<img src=x onerror="bad()">'),
    "&lt;img src=x onerror=&quot;bad()&quot;&gt;",
  );
  assert.equal(esc("A&B's"), "A&amp;B&#39;s");
});

test("unsafe LAN HTTP binding is refused before the server opens a port", async () => {
  await assert.rejects(
    () => createApp({ host: "0.0.0.0", port: 0 }),
    /LAN access requires TLS/,
  );
});
