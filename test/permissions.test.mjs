import test from "node:test";
import assert from "node:assert/strict";
import { roomPermissionHandler } from "../desktop/permissions.mjs";

const origin = "http://127.0.0.1:8443";
const contents = () => ({ getURL: () => `${origin}/room/lab`, isDestroyed: () => false });
const request = (handler, permission, page = contents(), details) => new Promise(resolve => handler(page, permission, resolve, details));

test("network permission requires a trusted main frame and explicit local consent", async () => {
  let prompts = 0;
  const handler = roomPermissionHandler(origin, async (_contents, options) => {
    prompts++;
    assert.equal(options.defaultId, 0);
    assert.match(options.detail, /127\.0\.0\.1:8443/);
    return { response: 1 };
  });
  assert.equal(await request(handler, "local-network", { ...contents(), getURL: () => "https://hostile.invalid/" }), false);
  assert.equal(await request(handler, "local-network", contents(), { isMainFrame: false }), false);
  assert.equal(await request(handler, "local-network", contents(), { requestingUrl: "https://hostile.invalid/" }), false);
  assert.equal(await request(handler, "media"), false);
  assert.equal(prompts, 0);
  assert.equal(await request(handler, "local-network"), true);
  assert.equal(await request(handler, "local-network"), true);
  assert.equal(prompts, 1);
  assert.equal(await request(handler, "loopback-network"), true);
  assert.equal(prompts, 2);
});

test("network refusal and prompt failures deny access without enabling unrelated capabilities", async () => {
  const refused = roomPermissionHandler(origin, async () => ({ response: 0 }));
  assert.equal(await request(refused, "local-network-access"), false);
  const failed = roomPermissionHandler(origin, async () => { throw new Error("Window closed"); });
  assert.equal(await request(failed, "local-network"), false);
  assert.equal(await request(refused, "display-capture"), true);
  assert.equal(await request(refused, "fullscreen"), true);
  assert.equal(await request(refused, "camera"), false);
});

test("concurrent room network requests share one prompt and navigation cancels its grant", async () => {
  let finish, prompts = 0;
  const handler = roomPermissionHandler(origin, () => {
    prompts++;
    return new Promise(resolve => { finish = resolve; });
  });
  const page = contents();
  const first = request(handler, "local-network", page);
  const second = request(handler, "local-network", page);
  await Promise.resolve();
  assert.equal(prompts, 1);
  page.getURL = () => "https://hostile.invalid/";
  finish({ response: 1 });
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  const third = request(handler, "local-network");
  await Promise.resolve();
  assert.equal(prompts, 2);
  finish({ response: 0 });
  assert.equal(await third, false);
});
