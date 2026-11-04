import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fixture, room, participant, command, snapshot } from "./helpers.mjs";
import { cleanLink, previewLink, publicAddress, readMetadata } from "../server/link-preview.mjs";

test("only plain public web links are accepted or previewed", async () => {
  for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "ftp://example.com", "https://user:pw@example.com", "", "x".repeat(3000)])
    assert.throws(() => cleanLink(bad));
  assert.equal(cleanLink(" https://example.com/a?b=1#frag ").href, "https://example.com/a?b=1");
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.20", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1", "0.0.0.0"])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("93.184.216.34"), true);
  // A name that resolves to a private address is refused before any request.
  await assert.rejects(previewLink("http://intranet.example/", { resolve: async () => [{ address: "10.0.0.5" }] }), /Private/);
  await assert.rejects(previewLink("http://127.0.0.1:9/"), /Private/);
});

test("metadata is read as plain, bounded text", () => {
  const meta = readMetadata(`<html><head><title>Fallback</title><meta property="og:title" content="Q3 &amp; plan &lt;b&gt;">
    <meta name="description" content="A short summary"><meta property="og:site_name" content="Example"></head></html>`);
  assert.deepEqual(meta, { title: "Q3 & plan <b>", site: "Example", description: "A short summary" });
  assert.equal(readMetadata("<title>" + "a".repeat(500) + "</title>").title.length, 200);
});

test("a flicked link lands as an owned, movable card and gains its preview", async t => {
  const page = createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<title>Quarterly plan</title>"); });
  await new Promise(r => page.listen(0, "127.0.0.1", r));
  t.after(() => page.close());
  const port = page.address().port;
  // The hub's real fetcher refuses loopback, so the test injects one that reads the local page.
  const app = await fixture(t, { previewLink: async (url) => {
    assert.equal(url, "https://plan.example/q3");
    return readMetadata(await (await fetch(`http://127.0.0.1:${port}/`)).text());
  } });
  const { admin } = await room(app);
  const sender = await participant(app, admin, "Phone sender");
  assert.equal((await command(app, sender, "link.add", { url: "javascript:alert(1)" })).status, 400);
  assert.equal((await command(app, sender, "link.add", { url: "https://plan.example/q3", aim: 0.8 })).status, 200);
  let link = (await snapshot(app, admin)).items.find(i => i.kind === "link");
  assert.equal(link.url, "https://plan.example/q3");
  assert.equal(link.host, "plan.example");
  assert.equal(link.ownerName, "Phone sender");
  assert.ok(link.x + link.w / 2 > 0.5, "lands on the aimed side");
  for (let i = 0; i < 40 && link.preview === "pending"; i++) {
    await new Promise(r => setTimeout(r, 25));
    link = (await snapshot(app, admin)).items.find(i => i.kind === "link");
  }
  assert.equal(link.preview, "ready");
  assert.equal(link.title, "Quarterly plan");
  assert.equal((await command(app, sender, "item.move", { itemId: link.id, version: link.version, x: 0.1, y: 0.1 })).status, 200);
  assert.equal(app.store.verifyAudit().valid, true);
});

test("a link whose page cannot be previewed keeps its host card", async t => {
  const app = await fixture(t, { previewLink: async () => { throw new Error("offline"); } });
  const { admin } = await room(app);
  assert.equal((await command(app, admin, "link.add", { url: "https://offline.example/doc" })).status, 200);
  let link;
  for (let i = 0; i < 40; i++) {
    link = (await snapshot(app, admin)).items.find(i => i.kind === "link");
    if (link.preview !== "pending") break;
    await new Promise(r => setTimeout(r, 25));
  }
  assert.equal(link.preview, "unavailable");
  assert.equal(link.title, "offline.example");
});
