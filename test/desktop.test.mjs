import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { startHubProcess } from "../desktop/hub-process.mjs";

function child() {
  const process = new EventEmitter();
  process.kill = () => { process.killed = true; process.emit("exit", 1); return true; };
  process.postMessage = (data) => { process.sent = data; queueMicrotask(() => process.emit("exit", 0)); };
  return process;
}

test("desktop hub readiness, graceful shutdown and unexpected exits have separate lifetimes", async () => {
  const process = child();
  let failure;
  const starting = startHubProcess((path, args, options) => {
    assert.match(path, /server\/desktop-hub.mjs$/);
    assert.deepEqual(args, ["/private/test-hub"]);
    assert.equal(options.serviceName, "Borderless room hub");
    return process;
  }, "/private/test-hub", { onUnexpectedExit: (code) => { failure = code; } });
  process.emit("message", { type: "ready", localURL: "http://127.0.0.1:1234" });
  const hub = await starting;
  assert.equal(hub.localURL, "http://127.0.0.1:1234");
  await Promise.all([hub.close(), hub.close()]);
  assert.deepEqual(process.sent, { type: "shutdown" });
  assert.equal(process.killed, undefined);
  assert.equal(failure, undefined);

  const crashed = child();
  const other = startHubProcess(() => crashed, "/private/test-hub", { onUnexpectedExit: (code) => { failure = code; } });
  crashed.emit("message", { type: "ready", localURL: "http://127.0.0.1:1234" });
  const second = await other;
  crashed.emit("exit", 9);
  assert.equal(failure, 9);
  await second.close();
});

test("a desktop hub startup failure or timeout is reported without leaving a child running", async () => {
  const failed = child();
  const starting = startHubProcess(() => failed, "/private/test-hub");
  failed.emit("message", { type: "error", message: "Port is already in use." });
  await assert.rejects(starting, /Port is already in use/);
  assert.equal(failed.killed, true);
  const silent = child();
  await assert.rejects(startHubProcess(() => silent, "/private/test-hub", { startupTimeout: 10 }), /did not start in time/);
  assert.equal(silent.killed, true);
});

test("desktop quit has a bounded fallback when the hub cannot finish shutdown", async () => {
  const hung = child();
  hung.postMessage = () => {};
  const starting = startHubProcess(() => hung, "/private/test-hub", { shutdownTimeout: 10 });
  hung.emit("message", { type: "ready", localURL: "http://127.0.0.1:1234" });
  await (await starting).close();
  assert.equal(hung.killed, true);
});
