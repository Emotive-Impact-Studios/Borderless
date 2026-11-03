import http from "node:http";
import https from "node:https";
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import QRCode from "qrcode";
import {
  openStore,
  hash,
  id,
  secret,
  now,
  passwordHash,
  passwordMatches,
} from "./store.mjs";
import { assetStorage, safeName, mimeFor } from "./assets.mjs";
import { minimumSurfaceSize, raiseSurface, focusSurface, arrangeScene } from "./spatial.mjs";
import { currentInvitation, invitationLifetime, mayReceiveStream, removeStreamRecipient } from "./stream-policy.mjs";
import {
  fail,
  text,
  number,
  choice,
  leader,
  requireLeader,
  requireContributor,
  canDraw,
  publicSession,
  publicState,
  themes,
  effects,
  seats,
  maxItems,
} from "./protocol.mjs";

const publicDir = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const roomPattern = /^\/api\/rooms\/([a-zA-Z0-9_-]{8,48})(?:\/(.*))?$/;
const cookieName = (roomId) => `borderless_${roomId}`;
function cookie(req, name) {
  return (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
const joinCode = () =>
  Array.from(
    { length: 6 },
    () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
  ).join("");
function hostAddresses() {
  let addresses = [];
  try {
    addresses = Object.values(networkInterfaces())
      .flat()
      .filter(Boolean)
      .map((x) => x.address);
  } catch {
    /* Some managed hosts do not expose network interfaces. Explicit public URLs still work. */
  }
  return ["localhost", "127.0.0.1", "[::1]", ...addresses];
}

export async function createApp(options = {}) {
  const dataDir = resolve(
    options.dataDir || process.env.BORDERLESS_DATA || ".borderless",
  );
  const host = options.host || process.env.BORDERLESS_HOST || "127.0.0.1";
  const port = options.port ?? Number(process.env.BORDERLESS_PORT || 8443);
  const cert = options.cert || process.env.BORDERLESS_TLS_CERT;
  const key = options.key || process.env.BORDERLESS_TLS_KEY;
  const tls = Boolean(cert && key);
  const publicURL = options.publicURL || process.env.BORDERLESS_PUBLIC_URL;
  if (Boolean(cert) !== Boolean(key))
    throw new Error(
      "Configure both BORDERLESS_TLS_CERT and BORDERLESS_TLS_KEY.",
    );
  if (!tls && !["localhost", "127.0.0.1", "::1"].includes(host))
    throw new Error(
      "LAN access requires TLS. Run npm run cert -- <LAN IP> and configure the certificate paths.",
    );
  if (publicURL && new URL(publicURL).protocol !== (tls ? "https:" : "http:"))
    throw new Error("The public URL must match the hub transport.");
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const lockPath = join(dataDir, "hub.lock");
  try {
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: now() }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "This data directory is already in use. Stop its hub first. After a crash, confirm no hub is running before removing hub.lock.",
      );
    throw error;
  }
  const unlock = () => {
    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
  let store;
  try {
    store = openStore(dataDir);
  } catch (error) {
    unlock();
    throw error;
  }
  const storage = assetStorage(dataDir, store.key, options.maxFileBytes);
  const live = new Map(),
    pointers = new Map(),
    rates = new Map();
  let uploading = 0,
    closing = false;
  let cleanupJob;
  function drainCleanup() {
    if (cleanupJob) return cleanupJob;
    cleanupJob = (async () => {
      for (const job of store.db
        .prepare("SELECT * FROM cleanup_queue ORDER BY rowid LIMIT 1000")
        .all()) {
        try {
          await storage.removeFile(job.filename);
          store.transaction(() => {
            store.db
              .prepare("DELETE FROM cleanup_queue WHERE filename=?")
              .run(job.filename);
            store.audit(job.room_id, "hub", "storage.cleanup.completed", {
              filename: job.filename,
              reason: job.reason,
            });
          });
        } catch (error) {
          store.db
            .prepare(
              "UPDATE cleanup_queue SET attempts=attempts+1,last_error=? WHERE filename=?",
            )
            .run(error.code || "UNLINK_FAILED", job.filename);
        }
      }
    })().finally(() => {
      cleanupJob = null;
    });
    return cleanupJob;
  }
  function snapshotFor(room, s, members) {
    const snapshot = publicState(room, s, members);
    if (leader(s))
      snapshot.cleanupPending = store.db
        .prepare("SELECT count(*) AS n FROM cleanup_queue WHERE room_id=?")
        .get(room.id).n;
    return snapshot;
  }
  const allowedHosts = new Set([
    ...hostAddresses(),
    ...(publicURL ? [new URL(publicURL).hostname] : []),
    host,
  ]);
  function limited(key, maximum = 180, window = 60000) {
    const at = Date.now();
    let entry = rates.get(key);
    if (!entry || at > entry.until) {
      entry = { count: 0, until: at + window };
      rates.set(key, entry);
    }
    entry.count += 1;
    if (rates.size > 10000)
      for (const [k, v] of rates) if (v.until < at) rates.delete(k);
    if (entry.count > maximum)
      fail(429, "Too many requests. Please try again shortly.");
  }
  function validOrigin(req) {
    const hostHeader = req.headers.host;
    if (!hostHeader || /[\s/@\\]/.test(hostHeader)) return false;
    try {
      const base = new URL(`${tls ? "https" : "http"}://${hostHeader}`);
      if (!allowedHosts.has(base.hostname)) return false;
      return !req.headers.origin || req.headers.origin === base.origin;
    } catch {
      return false;
    }
  }
  function authenticate(req, roomId) {
    const s = store.session(cookie(req, cookieName(roomId)), roomId);
    if (!s)
      fail(
        401,
        "Join the room to continue. Your previous session may have expired.",
      );
    return s;
  }
  function checkCSRF(req, s) {
    if (req.headers["x-borderless-csrf"] !== s.csrf)
      fail(
        403,
        "This action needs a current room session. Reload and try again.",
      );
  }
  function devices(roomId) {
    return store.db
      .prepare(
        "SELECT * FROM sessions WHERE room_id=? AND revoked=0 AND expires>? ORDER BY rowid",
      )
      .all(roomId, Date.now())
      .map((s) => ({
        ...publicSession(s),
        online: [...(live.get(roomId) || [])].some(
          (ws) => ws.session.device_id === s.device_id,
        ),
      }));
  }
  function send(ws, payload) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.session.expires <= Date.now()) {
      ws.close(4001, "Your session has ended.");
      return;
    }
    if (ws.bufferedAmount > 1024 * 1024) {
      ws.close(1013, "Connection is too slow. Reconnect for a fresh snapshot.");
      return;
    }
    ws.send(JSON.stringify(payload));
  }
  function broadcast(roomId) {
    const room = store.room(roomId);
    if (!room) return;
    const members = devices(roomId);
    for (const ws of live.get(roomId) || []) {
      const current = store.db
        .prepare("SELECT * FROM sessions WHERE token_hash=? AND revoked=0 AND expires>?")
        .get(ws.session.token_hash, Date.now());
      if (current) {
        ws.session = current;
        send(ws, { type: "state", state: snapshotFor(room, current, members) });
      } else ws.close(4001, "Your session has ended.");
    }
  }
  function ephemeral(roomId, event, except) {
    for (const ws of live.get(roomId) || []) if (ws !== except) send(ws, event);
  }
  function closeDevice(roomId, deviceId) {
    pointers.delete(`${roomId}:${deviceId}`);
    for (const ws of live.get(roomId) || [])
      if (ws.session.device_id === deviceId)
        ws.close(4001, "Access was revoked by the leader.");
  }
  function setCookie(res, roomId, token) {
    res.setHeader(
      "Set-Cookie",
      `${cookieName(roomId)}=${token}; Path=/api/rooms/${roomId}; HttpOnly; SameSite=Strict; Max-Age=43200${tls ? "; Secure" : ""}`,
    );
  }
  function json(res, status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(data));
  }
  async function body(req, limit = 128 * 1024) {
    if (!(req.headers["content-type"] || "").startsWith("application/json"))
      fail(415, "Send JSON for this action.");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) fail(413, "This request is too large.");
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString());
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error();
      return result;
    } catch {
      fail(400, "Invalid JSON request.");
    }
  }
  function owned(item, s) {
    if (!leader(s) && item.ownerId !== s.device_id)
      fail(403, "Only the owner or room leader can change this item.");
  }
  function handleCommand(room, s, input) {
    const state = room.state;
    const command = text(input.type, 50, "Command");
    const after = [];
    if (state.ended)
      fail(409, "This session has ended. Create a new room to continue.");
    switch (command) {
      case "note.add": {
        requireContributor(s, room);
        if (state.items.length >= maxItems)
          fail(409, "The wall is full. Remove an item before adding another.");
        const note = text(input.text, 4000, "Note");
        state.items.push({
          id: id(),
          kind: "note",
          text: note,
          title: text(input.title || "A thought for the room", 120, "Title"),
          x: number(input.x ?? 0.38, 0, 0.75),
          y: number(input.y ?? 0.3, 0, 0.72),
          w: 0.25,
          h: 0.28,
          ownerId: s.device_id,
          ownerName: s.name,
          colour: s.colour,
          createdAt: now(),
          version: 1,
        });
        raiseSurface(state, state.items.at(-1));
        break;
      }
      case "item.move":
      case "item.resize":
      case "item.remove":
      case "item.focus":
      case "item.raise":
      case "item.edit": {
        requireContributor(s, room);
        const item = state.items.find((i) => i.id === input.itemId);
        if (!item) fail(404, "That item is no longer on the wall.");
        owned(item, s);
        if (input.version !== item.version)
          fail(
            409,
            "This item changed on another device. Try again with the latest version.",
          );
        if (command === "item.remove")
          state.items = state.items.filter((i) => i.id !== item.id);
        if (item.restoreBounds && ["item.move", "item.resize"].includes(command))
          fail(409, "Restore the window before moving or resizing it.");
        if (command === "item.move") {
          item.x = number(input.x, 0, 1 - item.w);
          item.y = number(input.y, 0, 1 - item.h);
          item.version++;
          raiseSurface(state, item);
        }
        if (command === "item.resize") {
          item.w = number(input.w, minimumSurfaceSize, 1 - item.x);
          item.h = number(input.h, minimumSurfaceSize, 1 - item.y);
          item.version++;
          raiseSurface(state, item);
        }
        if (command === "item.focus") focusSurface(state, item);
        if (command === "item.raise") { raiseSurface(state, item); item.version++; }
        if (command === "item.edit") {
          if (item.kind !== "note") fail(400, "Only notes can be edited here.");
          item.text = text(input.text, 4000, "Note");
          item.title = text(input.title, 120, "Title");
          item.version++;
        }
        break;
      }
      case "room.layout": {
        requireLeader(s);
        choice(input.layout, ["grid", "focus", "free"], "Layout");
        state.layout = input.layout;
        const count = state.items.length + state.streams.length;
        if (input.layout === "grid" && count) arrangeScene(state);
        if (input.layout === "focus" && count) {
          const item =
            state.streams.find((i) => i.id === input.streamId) ||
            state.items.find((i) => i.id === input.itemId) || state.items.at(-1) || state.streams.at(-1);
          if (!item.restoreBounds) focusSurface(state, item);
          else raiseSurface(state, item);
        }
        break;
      }
      case "room.theme":
        requireLeader(s);
        state.theme = choice(input.theme, themes, "Theme");
        break;
      case "room.effect":
        requireLeader(s);
        state.effect = choice(input.effect, effects, "Effect");
        break;
      case "room.lock":
        requireLeader(s);
        if (typeof input.locked !== "boolean")
          fail(400, "Choose a lock state.");
        state.locked = input.locked;
        if (state.locked) {
          state.streams = [];
          after.push(() => ephemeral(room.id, { type: "streams.stopped" }));
        }
        break;
      case "room.clear":
      case "room.purge": {
        requireLeader(s);
        state.items = [];
        state.strokes = [];
        state.streams = [];
        state.deliveries = [];
        state.quiz = null;
        state.requests = [];
        state.permissions = [];
        after.push(() => ephemeral(room.id, { type: "canvas.cleared" }));
        if (command === "room.purge") {
          state.locked = true;
          const assets = store.db
            .prepare("SELECT id FROM assets WHERE room_id=?")
            .all(room.id);
          const queue = store.db.prepare(
            "INSERT OR IGNORE INTO cleanup_queue(filename,room_id,reason) VALUES(?,?,?)",
          );
          for (const asset of assets)
            queue.run(`${asset.id}.blf`, room.id, "room.purge");
          store.db.prepare("DELETE FROM assets WHERE room_id=?").run(room.id);
          after.push(drainCleanup);
        }
        break;
      }
      case "room.cleanup":
        requireLeader(s);
        after.push(drainCleanup);
        break;
      case "room.end":
        requireLeader(s);
        state.ended = true;
        state.locked = true;
        state.streams = [];
        state.permissions = [];
        store.db
          .prepare(
            "UPDATE sessions SET revoked=1 WHERE room_id=? AND role!='admin'",
          )
          .run(room.id);
        after.push(() => {
          for (const ws of live.get(room.id) || [])
            if (!leader(ws.session))
              ws.close(4001, "The room session has ended.");
        });
        break;
      case "invite.rotate":
        requireLeader(s);
        room.join_code = joinCode();
        break;
      case "hand.raise": {
        requireContributor(s, room);
        if (
          !state.requests.some((r) => r.deviceId === s.device_id) &&
          !state.permissions.includes(s.device_id)
        )
          state.requests.push({
            deviceId: s.device_id,
            name: s.name,
            at: now(),
          });
        break;
      }
      case "hand.approve":
      case "hand.deny":
      case "hand.revoke": {
        requireLeader(s);
        const target = devices(room.id).find(
          (d) => d.id === input.deviceId && d.role === "participant",
        );
        if (!target) fail(404, "That participant is no longer in this room.");
        state.requests = state.requests.filter((r) => r.deviceId !== target.id);
        state.permissions = state.permissions.filter((d) => d !== target.id);
        if (command === "hand.approve") state.permissions.push(target.id);
        break;
      }
      case "device.evict": {
        requireLeader(s);
        const target = devices(room.id).find(
          (d) => d.id === input.deviceId && d.role !== "admin",
        );
        if (!target) fail(404, "Choose a participant or display to remove.");
        store.db
          .prepare(
            "UPDATE sessions SET revoked=1 WHERE room_id=? AND device_id=?",
          )
          .run(room.id, target.id);
        state.requests = state.requests.filter((r) => r.deviceId !== target.id);
        state.permissions = state.permissions.filter((d) => d !== target.id);
        state.streams = state.streams.filter((x) => x.ownerId !== target.id);
        removeStreamRecipient(state, target.id);
        after.push(() => closeDevice(room.id, target.id));
        break;
      }
      case "seat.change":
        requireContributor(s, room);
        store.db
          .prepare("UPDATE sessions SET seat=? WHERE room_id=? AND device_id=?")
          .run(choice(input.seat, seats, "Seat"), room.id, s.device_id);
        break;
      case "stroke.add": {
        if (!canDraw(s, room))
          fail(403, "Ask the leader for drawing permission.");
        if (state.strokes.length >= 500)
          fail(
            409,
            "The whiteboard has reached its stroke limit. Ask the leader to clear it.",
          );
        if (
          !Array.isArray(input.points) ||
          input.points.length < 2 ||
          input.points.length > 256
        )
          fail(400, "A stroke needs 2 to 256 points.");
        if (
          state.strokes.reduce((n, s) => n + s.points.length, 0) +
            input.points.length >
          20000
        )
          fail(
            409,
            "The whiteboard is full. Export it, then clear the ink to continue.",
          );
        const points = input.points.map((p) => {
          if (!Array.isArray(p) || p.length !== 2)
            fail(400, "Invalid drawing point.");
          return [
            Number(number(p[0], 0, 1).toFixed(4)),
            Number(number(p[1], 0, 1).toFixed(4)),
          ];
        });
        state.strokes.push({
          id: id(),
          ownerId: s.device_id,
          colour: s.colour,
          width: number(input.width ?? 3, 1, 12),
          points,
        });
        break;
      }
      case "stroke.undo": {
        if (!canDraw(s, room))
          fail(403, "Ask the leader for drawing permission.");
        const index = state.strokes.findLastIndex(
          (x) => x.ownerId === s.device_id,
        );
        if (index >= 0) state.strokes.splice(index, 1);
        break;
      }
      case "ink.clear":
        requireLeader(s);
        state.strokes = [];
        break;
      case "delivery.send": {
        requireContributor(s, room);
        const asset = store.db
          .prepare("SELECT * FROM assets WHERE id=? AND room_id=?")
          .get(input.assetId, room.id);
        if (!asset) fail(404, "This file is no longer available.");
        if (!leader(s) && asset.owner_id !== s.device_id)
          fail(403, "Only the sender or leader can return this file.");
        const target = devices(room.id).find(
          (d) => d.id === input.deviceId && d.role !== "wall",
        );
        if (!target) fail(404, "That device is no longer in the room.");
        state.deliveries.push({
          id: id(),
          assetId: asset.id,
          name: asset.name,
          targetId: target.id,
          from: s.name,
          at: now(),
          accepted: false,
        });
        state.deliveries = state.deliveries.slice(-100);
        break;
      }
      case "delivery.accept": {
        const delivery = state.deliveries.find(
          (d) => d.id === input.deliveryId && d.targetId === s.device_id,
        );
        if (!delivery)
          fail(404, "This delivery does not belong to your device.");
        delivery.accepted = true;
        break;
      }
      case "quiz.start": {
        requireLeader(s);
        if (
          !Array.isArray(input.options) ||
          input.options.length < 2 ||
          input.options.length > 6
        )
          fail(400, "Add 2 to 6 answer options.");
        const options = input.options.map((v) => text(v, 200, "Answer"));
        state.quiz = {
          id: id(),
          question: text(input.question, 500, "Question"),
          options,
          correct: number(
            input.correct,
            0,
            options.length - 1,
            "Correct answer",
          ),
          answers: {},
          open: true,
          startedAt: now(),
        };
        if (!Number.isInteger(input.correct))
          fail(400, "Choose a valid correct answer.");
        break;
      }
      case "quiz.answer": {
        requireContributor(s, room);
        if (s.role !== "participant")
          fail(403, "Participant devices answer the quiz.");
        const quiz = state.quiz;
        if (!quiz || !quiz.open || quiz.id !== input.quizId)
          fail(409, "This quiz has closed or changed.");
        if (quiz.answers[s.device_id])
          fail(409, "Your answer has already been submitted.");
        const answer = number(
          input.answer,
          0,
          quiz.options.length - 1,
          "Answer",
        );
        if (!Number.isInteger(answer)) fail(400, "Choose an answer option.");
        quiz.answers[s.device_id] = { answer, at: now() };
        break;
      }
      case "quiz.close":
        requireLeader(s);
        if (!state.quiz) fail(409, "There is no quiz running.");
        state.quiz.open = false;
        break;
      case "quiz.dismiss":
        requireLeader(s);
        state.quiz = null;
        break;
      case "stream.start": {
        requireContributor(s, room);
        if (state.streams.some((x) => x.ownerId === s.device_id))
          fail(409, "Your screen is already on the wall.");
        if (state.streams.length >= 6)
          fail(
            409,
            "Six screens are already sharing. Stop one before adding another.",
          );
        if (
          input.connectionId &&
          ![...(live.get(room.id) || [])].some(
            (ws) =>
              ws.connectionId === input.connectionId &&
              ws.session.device_id === s.device_id,
          )
        )
          fail(409, "The capture connection is no longer active.");
        state.streams.push({
          id: id(),
          ownerId: s.device_id,
          connectionId: input.connectionId || null,
          ownerName: s.name,
          title: text(input.title || `${s.name}’s screen`, 120, "Title"),
          colour: s.colour,
          x: .14 + state.streams.length % 3 * .12,
          y: .16 + state.streams.length % 3 * .1,
          w: .5,
          h: .5,
          version: 1,
        });
        raiseSurface(state, state.streams.at(-1));
        break;
      }
      case "stream.move":
      case "stream.resize":
      case "stream.focus":
      case "stream.raise": {
        requireContributor(s, room);
        const stream = state.streams.find(value => value.id === input.streamId);
        if (!stream) fail(404, "This screen share has already stopped.");
        owned(stream, s);
        if (input.version !== stream.version) fail(409, "This screen window changed on another device. Try again with the latest version.");
        if (stream.restoreBounds && ["stream.move", "stream.resize"].includes(command))
          fail(409, "Restore the window before moving or resizing it.");
        if (command === "stream.focus") focusSurface(state, stream);
        else {
          if (command === "stream.move") {
            stream.x = number(input.x, 0, 1 - stream.w);
            stream.y = number(input.y, 0, 1 - stream.h);
          }
          if (command === "stream.resize") {
            stream.w = number(input.w, minimumSurfaceSize, 1 - stream.x);
            stream.h = number(input.h, minimumSurfaceSize, 1 - stream.y);
          }
          raiseSurface(state, stream);
          stream.version++;
        }
        break;
      }
      case "stream.invite": {
        requireContributor(s, room);
        const stream = state.streams.find(value => value.id === input.streamId);
        if (!stream) fail(404, "This screen share has already stopped.");
        if (stream.ownerId !== s.device_id) fail(403, "Only the person sharing this screen can invite another viewer.");
        const target = devices(room.id).find(device => device.id === input.deviceId && device.id !== s.device_id && device.role !== "wall");
        if (!target) fail(404, "Choose another person in this room.");
        stream.invitations ??= [];
        const existing = stream.invitations.find(invitation => invitation.deviceId === target.id);
        if (existing && currentInvitation(existing)) break;
        stream.invitations = stream.invitations.filter(invitation => invitation.deviceId !== target.id);
        stream.invitations.push({ id: id(), deviceId: target.id, status: "invited", offeredAt: now(), expiresAt: Date.now() + invitationLifetime });
        break;
      }
      case "stream.accept":
      case "stream.decline":
      case "stream.revoke": {
        if (s.role === "wall") fail(403, "The display is read-only.");
        const stream = state.streams.find(value => value.id === input.streamId);
        if (!stream) fail(404, "This screen share has already stopped.");
        const invitation = (stream.invitations || []).find(value => value.id === input.invitationId);
        if (!invitation) fail(409, "This invitation is no longer available. Ask the owner to send a new one.");
        if (command === "stream.revoke") {
          if (stream.ownerId !== s.device_id) fail(403, "Only the person sharing this screen can revoke its invitations.");
        } else if (invitation.deviceId !== s.device_id) fail(403, "This live window was invited to another person.");
        if (command === "stream.accept") {
          if (!currentInvitation(invitation)) fail(410, "This invitation expired. Ask the owner to send a new one.");
          invitation.status = "accepted";
          invitation.acceptedAt ??= now();
          delete invitation.expiresAt;
        } else stream.invitations = stream.invitations.filter(value => value !== invitation);
        break;
      }
      case "stream.stop": {
        const stream = state.streams.find((x) => x.id === input.streamId);
        if (!stream) fail(404, "This screen share has already stopped.");
        owned(stream, s);
        state.streams = state.streams.filter((x) => x.id !== stream.id);
        break;
      }
      default:
        fail(400, "Unknown command.");
    }
    // Metadata only: do not replicate note contents, drawing points or quiz answers into the audit log.
    store.audit(room.id, s.device_id, command, {
      itemId: input.itemId,
      streamId: input.streamId,
      invitationId: input.invitationId,
      deviceId: input.deviceId,
      revision: state.revision + 1,
    });
    store.saveRoom(room);
    return after;
  }

  async function handle(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), display-capture=(self), accelerometer=(self), gyroscope=(self)",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
    );
    if (tls) res.setHeader("Strict-Transport-Security", "max-age=86400");
    if (!validOrigin(req))
      fail(403, "This origin is not allowed to access the hub.");
    const url = new URL(
        req.url,
        `${tls ? "https" : "http"}://${req.headers.host}`,
      ),
      path = url.pathname;
    limited(`http:${req.socket.remoteAddress}`, 600);
    if (path === "/api/health" && req.method === "GET")
      return json(res, 200, { status: "ok", version: "0.1.0", tls });
    if (path === "/api/capabilities" && req.method === "GET")
      return json(res, 200, {
        platform: "browser",
        transport: tls ? "tls1.3" : "loopback-http",
        files: true,
        pointer: true,
        ink: true,
        quizzes: true,
        screenShare:
          "requires browser support, secure context and user consent",
        virtualDisplay: false,
        hardwareFrameLock: false,
        databaseEncryption: false,
        assetEncryption: "AES-256-GCM",
      });
    if (path === "/api/rooms" && req.method === "POST") {
      limited(`create:${req.socket.remoteAddress}`, 5, 300000);
      if (store.db.prepare("SELECT count(*) AS n FROM rooms").get().n >= 100)
        fail(
          409,
          "This hub has reached its room limit. Archive old data before creating more rooms.",
        );
      const input = await body(req);
      const name = text(input.name, 80, "Room name"),
        adminName = text(input.adminName, 40, "Your name");
      const password = text(input.password, 128, "Leader password");
      if (password.length < 10)
        fail(400, "Choose a leader password with at least 10 characters.");
      const mode = choice(
        input.mode || "studio",
        ["studio", "meeting", "classroom"],
        "Room type",
      );
      const roomId = secret().slice(0, 12);
      const state = {
        revision: 0,
        mode,
        theme:
          mode === "classroom"
            ? "classroom"
            : mode === "meeting"
              ? "executive"
              : "studio",
        effect: "ripple",
        layout: "free",
        locked: false,
        ended: false,
        items: [],
        strokes: [],
        requests: [],
        permissions: [],
        deliveries: [],
        quiz: null,
        streams: [],
        createdAt: now(),
      };
      const result = store.transaction(() => {
        store.db
          .prepare("INSERT INTO rooms VALUES(?,?,?,?,?,?,?)")
          .run(
            roomId,
            name,
            passwordHash(password),
            joinCode(),
            "",
            JSON.stringify(state),
            now(),
          );
        store.audit(roomId, "hub", "room.created", { name, mode });
        return store.createSession(roomId, adminName, "admin");
      });
      setCookie(res, roomId, result.token);
      return json(res, 201, { roomId });
    }
    const match = path.match(roomPattern);
    if (match) {
      const [, roomId, route = ""] = match;
      const room = store.room(roomId);
      if (!room)
        fail(404, "This room could not be found. Check the invitation link.");
      if (route === "info" && req.method === "GET")
        return json(res, 200, {
          id: room.id,
          name: room.name,
          mode: room.state.mode,
          ended: room.state.ended,
        });
      if (
        ["join", "login", "wall-pair"].includes(route) &&
        req.method === "POST"
      ) {
        limited(`auth:${roomId}:${req.socket.remoteAddress}`, 10, 60000);
        if (room.state.ended)
          fail(
            409,
            "This room has ended. Ask the leader for a new invitation.",
          );
        const input = await body(req);
        let role;
        const name = text(
          input.name ||
            (route === "wall-pair" ? "Room display" : "Room leader"),
          40,
          "Your name",
        );
        if (route === "login") {
          if (!passwordMatches(String(input.password || ""), room.password))
            fail(403, "The leader password is incorrect.");
          role = "admin";
        }
        if (route === "join") {
          if (
            String(input.code || "")
              .toUpperCase()
              .replace(/\s/g, "") !== room.join_code
          )
            fail(403, "The room code is incorrect.");
          role = "participant";
        }
        if (route === "wall-pair") {
          if (
            !room.wall_key ||
            hash(String(input.token || "")) !== room.wall_key
          )
            fail(403, "This display pairing link is no longer valid.");
          role = "wall";
        }
        if (devices(roomId).length >= 64)
          fail(409, "This room has reached its 64-device limit.");
        const result = store.transaction(() => {
          if (role === "wall") {
            room.wall_key = "";
            store.saveRoom(room);
          }
          return store.createSession(
            roomId,
            name,
            role,
            choice(input.seat || "centre", seats, "Seat"),
          );
        });
        setCookie(res, roomId, result.token);
        broadcast(roomId);
        return json(res, 200, { roomId, role });
      }
      const s = authenticate(req, roomId);
      if (req.method !== "GET") checkCSRF(req, s);
      if (route === "state" && req.method === "GET")
        return json(res, 200, snapshotFor(room, s, devices(roomId)));
      if (route === "logout" && req.method === "POST") {
        store.transaction(() => {
          store.db
            .prepare("UPDATE sessions SET revoked=1 WHERE token_hash=?")
            .run(s.token_hash);
          store.audit(roomId, s.device_id, "session.left");
          room.state.streams = room.state.streams.filter(
            (x) => x.ownerId !== s.device_id,
          );
          removeStreamRecipient(room.state, s.device_id);
          store.saveRoom(room);
        });
        closeDevice(roomId, s.device_id);
        broadcast(roomId);
        setCookie(res, roomId, "");
        return json(res, 200, { ok: true });
      }
      if (route === "pair" && req.method === "POST") {
        requireLeader(s);
        const token = secret();
        store.transaction(() => {
          room.wall_key = hash(token);
          store.saveRoom(room);
          store.audit(roomId, s.device_id, "display.pairing.created");
        });
        return json(res, 200, {
          url: `${baseURL(req)}/wall/${roomId}#pair=${token}`,
        });
      }
      if (route === "invite" && req.method === "GET") {
        if (!["admin", "wall"].includes(s.role))
          fail(403, "Only the leader or display can show invitations.");
        const invite = `${baseURL(req)}/join/${roomId}#code=${room.join_code}`;
        return json(res, 200, {
          code: room.join_code,
          url: invite,
          qr: await QRCode.toDataURL(invite, {
            width: 240,
            margin: 2,
            color: { dark: "#202924", light: "#ffffff" },
          }),
        });
      }
      if (route === "audit" && req.method === "GET") {
        requireLeader(s);
        const rows = store.db
          .prepare("SELECT * FROM audit WHERE room_id=? ORDER BY seq")
          .all(roomId);
        return json(res, 200, {
          roomId,
          exportedAt: now(),
          verification: store.verifyAudit(roomId),
          events: rows,
        });
      }
      if (route === "export" && req.method === "GET") {
        requireLeader(s);
        store.audit(roomId, s.device_id, "room.exported");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="borderless-${roomId}.json"`,
        );
        return json(res, 200, {
          format: "borderless-room-v1",
          exportedAt: now(),
          room: snapshotFor(room, s, devices(roomId)),
          assets: store.db
            .prepare(
              "SELECT id,name,mime,size,hash,created_at FROM assets WHERE room_id=?",
            )
            .all(roomId),
          audit: store.verifyAudit(roomId),
        });
      }
      if (route === "command" && req.method === "POST") {
        limited(`cmd:${s.device_id}`, 300);
        const input = await body(req);
        const commandId = text(input.commandId, 80, "Command ID");
        const existing = store.db
          .prepare(
            "SELECT response FROM commands WHERE room_id=? AND device_id=? AND command_id=?",
          )
          .get(roomId, s.device_id, commandId);
        if (existing) return json(res, 200, JSON.parse(existing.response));
        let after = [];
        const result = store.transaction(() => {
          after = handleCommand(room, s, input);
          const response = { ok: true, revision: room.state.revision };
          store.db
            .prepare("INSERT INTO commands VALUES(?,?,?,?)")
            .run(roomId, s.device_id, commandId, JSON.stringify(response));
          return response;
        });
        await Promise.all(after.map((fn) => fn()));
        if (["room.purge", "room.cleanup"].includes(input.type)) {
          result.cleanupPending = store.db
            .prepare("SELECT count(*) AS n FROM cleanup_queue WHERE room_id=?")
            .get(roomId).n;
          store.db
            .prepare(
              "UPDATE commands SET response=? WHERE room_id=? AND device_id=? AND command_id=?",
            )
            .run(JSON.stringify(result), roomId, s.device_id, commandId);
        }
        broadcast(roomId);
        return json(res, 200, result);
      }
      if (route === "upload" && req.method === "POST") {
        requireContributor(s, room);
        if (room.state.ended) fail(409, "The room has ended.");
        limited(`upload:${s.device_id}`, 20);
        if (uploading >= 4)
          fail(
            429,
            "The hub is receiving several files. Try again in a moment.",
          );
        const used = store.db
          .prepare(
            "SELECT coalesce(sum(size),0) AS n FROM assets WHERE room_id=?",
          )
          .get(roomId).n;
        if (used >= 512 * 1024 * 1024)
          fail(413, "This room has reached its 512 MB file limit.");
        if (room.state.items.length >= maxItems)
          fail(409, "The wall is full. Remove an item first.");
        let name;
        try {
          name = safeName(
            decodeURIComponent(String(req.headers["x-filename"] || "")),
          );
        } catch (error) {
          if (error.status) throw error;
          fail(400, "Invalid filename.");
        }
        const assetId = id();
        uploading++;
        try {
          const info = await storage.write(req, assetId, name);
          const current = store.room(roomId),
            currentSession = store.session(
              cookie(req, cookieName(roomId)),
              roomId,
            );
          if (!currentSession || current.state.ended)
            fail(403, "Your session ended during the transfer.");
          requireContributor(currentSession, current);
          if (current.state.items.length >= maxItems)
            fail(409, "The wall filled up during this transfer.");
          const latestUsed = store.db
            .prepare(
              "SELECT coalesce(sum(size),0) AS n FROM assets WHERE room_id=?",
            )
            .get(roomId).n;
          if (latestUsed + info.size > 512 * 1024 * 1024)
            fail(413, "This room has reached its file limit.");
          const position =
            s.seat === "left" ? 0.04 : s.seat === "right" ? 0.68 : 0.35;
          store.transaction(() => {
            const created = now();
            store.db
              .prepare("INSERT INTO assets VALUES(?,?,?,?,?,?,?,?)")
              .run(
                assetId,
                roomId,
                s.device_id,
                name,
                mimeFor(name),
                info.size,
                info.hash,
                created,
              );
            current.state.items.push({
              id: id(),
              kind: "file",
              assetId,
              title: name,
              mime: mimeFor(name),
              size: info.size,
              hash: info.hash,
              ownerId: s.device_id,
              ownerName: s.name,
              colour: s.colour,
              x: position,
              y: 0.1 + (current.state.items.length % 3) * 0.16,
              w: 0.28,
              h: 0.36,
              createdAt: created,
              version: 1,
            });
            raiseSurface(current.state, current.state.items.at(-1));
            store.audit(roomId, s.device_id, "asset.uploaded", {
              assetId,
              size: info.size,
              hash: info.hash,
            });
            store.saveRoom(current);
          });
          broadcast(roomId);
          return json(res, 201, { assetId, ...info });
        } catch (error) {
          try {
            await storage.remove(assetId);
          } catch {
            store.db
              .prepare(
                "INSERT OR IGNORE INTO cleanup_queue(filename,room_id,reason) VALUES(?,?,?)",
              )
              .run(`${assetId}.blf`, roomId, "upload.rejected");
          }
          throw error;
        } finally {
          uploading--;
        }
      }
      const assetMatch = route.match(/^assets\/([a-f0-9-]{36})$/);
      if (assetMatch && req.method === "GET") {
        limited(`download:${s.device_id}`, 120);
        const asset = store.db
          .prepare("SELECT * FROM assets WHERE id=? AND room_id=?")
          .get(assetMatch[1], roomId);
        if (!asset) fail(404, "This file is no longer available in this room.");
        let contents;
        try {
          contents = await storage.read(asset);
        } catch {
          fail(
            422,
            "This file failed its integrity check. Restore it from a verified backup.",
          );
        }
        res.setHeader("Content-Type", asset.mime);
        res.setHeader("X-Content-SHA256", asset.hash);
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        );
        const downloadable =
          url.searchParams.has("download") || /officedocument/.test(asset.mime);
        res.setHeader(
          "Content-Disposition",
          `${downloadable ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
        );
        res.setHeader("Accept-Ranges", "bytes");
        if (req.headers.range) {
          const range = req.headers.range.match(/^bytes=(\d+)-(\d*)$/);
          if (!range) {
            res.setHeader("Content-Range", `bytes */${contents.length}`);
            fail(416, "Unsupported byte range.");
          }
          const start = Number(range[1]),
            end = range[2]
              ? Math.min(Number(range[2]), contents.length - 1)
              : contents.length - 1;
          if (start > end || start >= contents.length) {
            res.setHeader("Content-Range", `bytes */${contents.length}`);
            fail(416, "Byte range is outside this file.");
          }
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${contents.length}`,
            "Content-Length": end - start + 1,
          });
          return res.end(contents.subarray(start, end + 1));
        }
        res.writeHead(200, { "Content-Length": contents.length });
        return res.end(contents);
      }
      fail(404, "This room action was not found.");
    }
    if (path.startsWith("/api/")) fail(404, "API route not found.");
    if (!["GET", "HEAD"].includes(req.method)) fail(405, "Method not allowed.");
    const requested =
      /^\/screen\/[a-zA-Z0-9_-]{8,48}\/[a-f0-9-]{36}$/.test(path) ? "screen.html" :
      ["/", "/index.html"].includes(path) ||
      /^\/(room|wall|join|portal|leader)\/[a-zA-Z0-9_-]{8,48}$/.test(path)
        ? "index.html"
        : decodeURIComponent(path).replace(/^\//, "");
    const file = resolve(publicDir, requested);
    if (!file.startsWith(`${publicDir}/`) || requested.startsWith("."))
      fail(404, "Page not found.");
    let contents;
    try {
      contents = await readFile(file);
    } catch {
      fail(404, "Page not found.");
    }
    const contentType =
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
      }[extname(file)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(req.method === "HEAD" ? undefined : contents);
  }
  function baseURL(req) {
    return publicURL || `${tls ? "https" : "http"}://${req.headers.host}`;
  }
  const server = tls
    ? https.createServer(
        {
          cert: readFileSync(cert),
          key: readFileSync(key),
          minVersion: "TLSv1.3",
        },
        request,
      )
    : http.createServer(request);
  function request(req, res) {
    handle(req, res).catch((error) => {
      if (res.headersSent || res.destroyed) {
        res.destroy();
        return;
      }
      if (!error.status && !closing)
        console.error("[Borderless] Request failed:", error.message);
      json(res, error.status || 500, {
        error: error.status
          ? error.message
          : "The hub could not complete this action. Please try again.",
      });
    });
  }
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    try {
      if (!validOrigin(req)) fail(403, "Invalid origin");
      const path = new URL(req.url, `http://${req.headers.host}`).pathname;
      const match = path.match(/^\/api\/rooms\/([a-zA-Z0-9_-]{8,48})\/live$/);
      if (!match) fail(404, "Not found");
      const s = authenticate(req, match[1]);
      limited(`ws:${s.device_id}`, 20);
      if (
        [...(live.get(s.room_id) || [])].filter(
          (ws) => ws.session.device_id === s.device_id,
        ).length >= 8
      )
        fail(429, "Too many open tabs");
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.session = s;
        ws.connectionId = id();
        wss.emit("connection", ws, req);
      });
    } catch (error) {
      socket.end(
        `HTTP/1.1 ${error.status || 400} Rejected\r\nConnection: close\r\n\r\n`,
      );
    }
  });
  wss.on("connection", (ws) => {
    const { room_id: roomId } = ws.session;
    if (!live.has(roomId)) live.set(roomId, new Set());
    live.get(roomId).add(ws);
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => {});
    send(ws, { type: "hello", connectionId: ws.connectionId });
    broadcast(roomId);
    ws.on("message", (raw) => {
      try {
        const fresh = store.db
          .prepare(
            "SELECT * FROM sessions WHERE token_hash=? AND revoked=0 AND expires>?",
          )
          .get(ws.session.token_hash, Date.now());
        if (!fresh) {
          ws.close(4001, "Your session has ended.");
          return;
        }
        ws.session = fresh;
        limited(`frames:${fresh.device_id}`, 180, 1000);
        const input = JSON.parse(raw.toString());
        if (!input || typeof input !== "object") fail(400, "Invalid event");
        const room = store.room(roomId);
        if (room.state.ended) fail(409, "The room has ended.");
        if (input.type === "ping")
          return send(ws, { type: "pong", at: input.at });
        if (input.type === "pointer") {
          requireContributor(fresh, room);
          const event = {
            type: "pointer",
            device: publicSession(fresh),
            x: number(input.x, 0, 1),
            y: number(input.y, 0, 1),
            active: Boolean(input.active),
          };
          pointers.set(`${roomId}:${fresh.device_id}`, {
            ...event,
            at: Date.now(),
          });
          ephemeral(roomId, event, ws);
          return;
        }
        if (input.type === "ink.preview") {
          if (!canDraw(fresh, room)) fail(403, "Drawing permission required");
          ephemeral(
            roomId,
            {
              type: "ink.preview",
              device: publicSession(fresh),
              x: number(input.x, 0, 1),
              y: number(input.y, 0, 1),
              active: Boolean(input.active),
            },
            ws,
          );
          return;
        }
        if (input.type === "rtc") {
          const stream = room.state.streams.find(
            (x) => x.id === input.streamId,
          );
          if (!stream) fail(404, "Screen share not found");
          const target = store.db
            .prepare(
              "SELECT * FROM sessions WHERE device_id=? AND room_id=? AND revoked=0 AND expires>?",
            )
            .get(input.targetId, roomId, Date.now());
          if (!target) fail(404, "Target device unavailable");
          const captureSide = fresh.device_id === stream.ownerId && (!stream.connectionId || ws.connectionId === stream.connectionId);
          if (captureSide) {
            if (!mayReceiveStream(stream, target)) fail(403, "This person has not accepted a live-window invitation.");
            if (!["offer", "candidate"].includes(input.kind)) fail(403, "The capture connection can offer its screen or send candidates.");
          } else {
            if (target.device_id !== stream.ownerId || (stream.connectionId && input.targetConnectionId !== stream.connectionId)) fail(403, "Send screen requests to the active capture connection.");
            if (!mayReceiveStream(stream, fresh)) fail(403, "Accept the owner's live-window invitation before receiving this screen.");
            if (!["ready", "answer", "candidate"].includes(input.kind)) fail(403, "Only the active capture connection can offer this screen.");
          }
          choice(
            input.kind,
            ["ready", "offer", "answer", "candidate"],
            "Signal",
          );
          const payload = JSON.stringify(input.payload ?? null);
          if (payload.length > 32000) fail(413, "Signal too large");
          if (
            input.targetConnectionId !== undefined &&
            !/^[a-f0-9-]{36}$/.test(input.targetConnectionId)
          )
            fail(400, "Invalid connection reference");
          for (const peer of live.get(roomId) || [])
            if (
              peer.session.device_id === target.device_id &&
              (!input.targetConnectionId ||
                peer.connectionId === input.targetConnectionId)
            )
              send(peer, {
                type: "rtc",
                streamId: stream.id,
                fromId: fresh.device_id,
                fromConnectionId: ws.connectionId,
                kind: input.kind,
                payload: input.payload,
              });
          return;
        }
        fail(400, "Unknown live event");
      } catch (error) {
        send(ws, {
          type: "error",
          error: error.status ? error.message : "Invalid live event.",
        });
      }
    });
    ws.on("close", () => {
      live.get(roomId)?.delete(ws);
      if (closing) return;
      const sameDevice = [...(live.get(roomId) || [])].some(
        (x) => x.session.device_id === ws.session.device_id,
      );
      if (!sameDevice) {
        pointers.delete(`${roomId}:${ws.session.device_id}`);
        ephemeral(roomId, {
          type: "pointer",
          device: publicSession(ws.session),
          active: false,
        });
      }
      const room = store.room(roomId);
      // A display may reconnect with the same cookie and a new socket identity.
      // Tell only the relevant capture owner to retire the departed media peer.
      for (const stream of room.state.streams)
        for (const owner of live.get(roomId) || [])
          if (
            owner.session.device_id === stream.ownerId &&
            (!stream.connectionId || owner.connectionId === stream.connectionId)
          )
            send(owner, {
              type: "rtc.peer.left",
              streamId: stream.id,
              connectionId: ws.connectionId,
            });
      const disconnected = (x) =>
        x.connectionId === ws.connectionId ||
        (!x.connectionId && !sameDevice && x.ownerId === ws.session.device_id);
      if (room.state.streams.some(disconnected))
        store.transaction(() => {
          room.state.streams = room.state.streams.filter(
            (x) => !disconnected(x),
          );
          store.saveRoom(room);
          store.audit(roomId, ws.session.device_id, "stream.disconnected");
        });
      if (!live.get(roomId)?.size) live.delete(roomId);
      broadcast(roomId);
    });
  });
  const heartbeat = setInterval(() => {
    for (const clients of live.values())
      for (const ws of clients) {
        if (!ws.alive || ws.session.expires < Date.now()) {
          ws.terminate();
          continue;
        }
        ws.alive = false;
        ws.ping();
      }
    for (const [key, pointer] of pointers)
      if (Date.now() - pointer.at > 2000) {
        pointers.delete(key);
        ephemeral(key.split(":")[0], {
          type: "pointer",
          device: pointer.device,
          active: false,
        });
      }
  }, 10000);
  heartbeat.unref();
  // Video streams are transient. A restarted hub never advertises a dead stream as live.
  store.retireInactiveSessions();
  for (const row of store.db.prepare("SELECT id FROM rooms").all()) {
    const room = store.room(row.id);
    if (room.state.streams.length) {
      room.state.streams = [];
      store.saveRoom(room);
      store.audit(room.id, "hub", "streams.reset.after.restart");
    }
  }
  const known = new Set(
    store.db
      .prepare("SELECT id FROM assets")
      .all()
      .map((a) => a.id),
  );
  for (const filename of await storage.orphans(known))
    store.db
      .prepare(
        "INSERT OR IGNORE INTO cleanup_queue(filename,room_id,reason) VALUES(?,?,?)",
      )
      .run(filename, "__hub__", "orphan.after.restart");
  await drainCleanup();
  const cleanupTimer = setInterval(() => {
    Promise.resolve()
      .then(() => store.retireInactiveSessions())
      .then(() => drainCleanup())
      .then(() => {
        if (!closing) for (const roomId of live.keys()) broadcast(roomId);
      })
      .catch((error) => console.warn("Hub maintenance delayed:", error.message));
  }, 30000);
  cleanupTimer.unref();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolve);
    });
  } catch (error) {
    clearInterval(heartbeat);
    clearInterval(cleanupTimer);
    wss.close();
    store.close();
    unlock();
    throw error;
  }
  const address = server.address();
  const localURL = `${tls ? "https" : "http"}://${host === "::1" ? "[::1]" : host === "0.0.0.0" ? "localhost" : host}:${address.port}`;
  let closePromise;
  return {
    server,
    store,
    storage,
    localURL,
    port: address.port,
    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = (async () => {
        clearInterval(heartbeat);
        clearInterval(cleanupTimer);
        for (const ws of wss.clients) ws.terminate();
        await new Promise((r) => wss.close(r));
        await new Promise((r) => server.close(r));
        await cleanupJob;
        store.close();
        unlock();
      })();
      return closePromise;
    },
  };
}
