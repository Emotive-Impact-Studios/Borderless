import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createApp } from "../server/app.mjs";

export async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "borderless-test-"));
  const app = await createApp({ dataDir, port: 0, ...options });
  t.after(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { ...app, dataDir, base: app.localURL };
}
export async function request(
  app,
  route,
  { method = "GET", data, actor, headers = {}, raw } = {},
) {
  const response = await fetch(`${app.base}${route}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(actor
        ? {
            Cookie: actor.cookie,
            ...(method !== "GET" ? { "X-Borderless-CSRF": actor.csrf } : {}),
          }
        : {}),
      ...headers,
    },
    ...(raw ? { body: raw } : data ? { body: JSON.stringify(data) } : {}),
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, status: response.status, body };
}
export async function room(
  app,
  { mode = "studio", name = "The test room" } = {},
) {
  const result = await request(app, "/api/rooms", {
    method: "POST",
    data: { name, adminName: "Leader", password: "a-good-test-password", mode },
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.body));
  const actor = {
    roomId: result.body.roomId,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
  const state = await snapshot(app, actor);
  actor.csrf = state.me.csrf;
  actor.id = state.me.id;
  return { admin: actor, roomId: actor.roomId, state };
}
export async function participant(
  app,
  admin,
  name = "Participant",
  extra = {},
) {
  const state = await snapshot(app, admin);
  const result = await request(app, `/api/rooms/${admin.roomId}/join`, {
    method: "POST",
    data: { name, code: state.joinCode, ...extra },
  });
  if (result.status !== 200) throw new Error(JSON.stringify(result.body));
  const actor = {
    roomId: admin.roomId,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
  const own = await snapshot(app, actor);
  actor.csrf = own.me.csrf;
  actor.id = own.me.id;
  return actor;
}
export async function wall(app, admin) {
  const pair = await request(app, `/api/rooms/${admin.roomId}/pair`, {
    method: "POST",
    data: {},
    actor: admin,
  });
  const token = new URL(pair.body.url).hash.slice(6);
  const result = await request(app, `/api/rooms/${admin.roomId}/wall-pair`, {
    method: "POST",
    data: { token, name: "Display" },
  });
  const actor = {
    roomId: admin.roomId,
    cookie: result.response.headers.get("set-cookie").split(";")[0],
  };
  const own = await snapshot(app, actor);
  actor.csrf = own.me.csrf;
  actor.id = own.me.id;
  return { actor, token };
}
export async function snapshot(app, actor) {
  const result = await request(app, `/api/rooms/${actor.roomId}/state`, {
    actor,
  });
  if (result.status !== 200) throw new Error(JSON.stringify(result.body));
  return result.body;
}
export const command = (app, actor, type, data = {}) =>
  request(app, `/api/rooms/${actor.roomId}/command`, {
    method: "POST",
    actor,
    data: { commandId: randomUUID(), type, ...data },
  });
export const upload = (app, actor, name, data) =>
  request(app, `/api/rooms/${actor.roomId}/upload`, {
    method: "POST",
    actor,
    raw: data,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Filename": encodeURIComponent(name),
    },
  });
export function connect(app, actor) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${app.base.replace(/^http/, "ws")}/api/rooms/${actor.roomId}/live`,
      { headers: { Cookie: actor.cookie }, origin: app.base },
    );
    socket.messages = [];
    socket.on("message", (raw) => {
      const event = JSON.parse(raw);
      socket.messages.push(event);
      socket.emit("event", event);
    });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}
export function event(socket, predicate, timeout = 2500) {
  const found = socket.messages.find(predicate);
  if (found) return Promise.resolve(found);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("event", handle);
      reject(new Error("Expected live event did not arrive."));
    }, timeout);
    function handle(data) {
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off("event", handle);
        resolve(data);
      }
    }
    socket.on("event", handle);
  });
}
