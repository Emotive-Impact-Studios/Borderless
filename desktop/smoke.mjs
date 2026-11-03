// Real Electron/Chromium acceptance. OS consent and physical-device QA are separate.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { _electron, chromium } from "playwright";
import electron from "electron";

const root = fileURLToPath(new URL("..", import.meta.url));
const packagedExecutable = process.argv[2];
// The hosted Mac has no interactive Local Network/mDNS commissioning. Keep its
// same-machine transport check unicast; production and default local QA retain
// Chromium's normal candidate privacy and discovery behaviour.
const loopbackLab = process.env.BORDERLESS_QA_ICE_MODE === "loopback";
const unicastLab = loopbackLab || process.env.BORDERLESS_QA_ICE_MODE === "unicast";
const labArguments = unicastLab ? ["--disable-features=WebRtcHideLocalIpsWithMdns"] : [];
const profile = await mkdtemp(join(tmpdir(), "borderless-desktop-qa-"));
const output = join(root, packagedExecutable ? "output/playwright-packaged" : "output/playwright");
await mkdir(output, { recursive: true });
const checks = [], errors = [], pages = [];
const faulting = new Set(), expectedNetworkErrors = [], contrastChecks = [];
let application, browser;
const watch = (page) => {
  pages.push(page);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (faulting.has(page) && /net::ERR_(INTERNET_DISCONNECTED|FAILED)|WebSocket connection to .+failed/.test(text))
      expectedNetworkErrors.push(text.replace(/https?:\/\/[^\s']+/g, "[disposable hub]"));
    else errors.push(text);
  });
};
function installSocketDiagnostics() {
  const NativeSocket = window.WebSocket;
  window.qaSockets = [];
  window.qaSignals = [];
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      window.qaSockets.push(this);
      this.addEventListener("message", event => {
        const data = JSON.parse(event.data);
        if (data.type === "hello") this.qaConnectionId = data.connectionId;
        if (data.type === "rtc" || data.type === "error") window.qaSignals.push({ direction: "received", kind: data.kind, error: data.error, hasCandidate: Boolean(data.payload?.candidate) });
      });
    }
    send(value) {
      const data = JSON.parse(value);
      if (data.type === "rtc") window.qaSignals.push({ direction: "sent", kind: data.kind, hasCandidate: Boolean(data.payload?.candidate) });
      super.send(value);
    }
  };
}
function installPeerDiagnostics(loopback = false) {
  const NativePeer = window.RTCPeerConnection;
  window.qaPeers = [];
  window.RTCPeerConnection = class extends NativePeer {
    constructor(...args) { super(...args); window.qaPeers.push(this); this.qaCandidateInputs = []; }
    async addIceCandidate(candidate) {
      const entry = { hasCandidate: Boolean(candidate?.candidate) };
      this.qaCandidateInputs.push(entry);
      // Explicit same-machine fixture for hosts whose local-network policy
      // blocks interface-address traffic. Ports and real media stay intact.
      // Never installed in the product or used as LAN/discovery evidence.
      if (loopback && candidate?.candidate) {
        const fields = candidate.candidate.split(" ");
        if (fields[7] === "host") {
          fields[4] = "127.0.0.1";
          candidate = { ...candidate, candidate: fields.join(" ") };
        }
      }
      try { await super.addIceCandidate(candidate); entry.accepted = true; }
      catch (error) { entry.error = error.message; throw error; }
    }
  };
}
const check = (name) => { checks.push(name); console.log(`✓ ${name}`); };
const closeDialog = (page) => page.getByRole("button", { name: "Close dialog", exact: true }).click();
async function contrast(page, theme, selectors) {
  const samples = await page.evaluate(async selectors => {
    // Theme backgrounds interpolate. Sample their settled colours, alongside
    // the separate reduced-motion transition check, rather than a mid-fade.
    await Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {})));
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgba = colour => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
    };
    const over = (top, below) => top.slice(0, 3).map((value, index) => value * top[3] + below[index] * (1 - top[3]));
    const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    return selectors.map(selector => {
      const element = [...document.querySelectorAll(selector)].find(element => element.getClientRects().length && !element.disabled);
      if (!element) throw new Error(`No visible contrast sample for ${selector}`);
      const ancestors = [];
      for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      const background = ancestors.reduce((colour, node) => over(rgba(getComputedStyle(node).backgroundColor), colour), [255, 255, 255]);
      const text = over(rgba(getComputedStyle(element).color), background);
      const a = luminance(text), b = luminance(background);
      return { selector, ratio: Number(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(3)) };
    });
  }, selectors);
  for (const sample of samples) assert.ok(sample.ratio >= 4.5, `${theme}: ${sample.selector} contrast ${sample.ratio}:1`);
  contrastChecks.push({ view: new URL(page.url()).pathname.split("/")[1], theme, samples });
}
async function stroke(page) {
  const box = await page.locator("#drawing-pad").boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 12 });
  await page.mouse.up();
}
try {
  application = await _electron.launch({
    executablePath: packagedExecutable || electron,
    args: [...(packagedExecutable ? [] : [root]), `--user-data-dir=${profile}`, ...labArguments],
    env: { ...process.env, BORDERLESS_PORT: "0", BORDERLESS_HOST: "127.0.0.1", BORDERLESS_PUBLIC_URL: "", BORDERLESS_TLS_CERT: "", BORDERLESS_TLS_KEY: "" },
  });
  const leader = await application.firstWindow();
  watch(leader);
  await leader.addInitScript(installSocketDiagnostics);
  // Keep local acceptance constrained too: hosted Mac displays can clamp a
  // requested 1000px height to roughly 640px of app content.
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 640));
  await leader.getByRole("button", { name: "Create your room" }).waitFor();
  const native = await application.evaluate(({ app, BrowserWindow }) => ({
    profile: app.getPath("userData"),
    preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }));
  assert.equal(native.profile, profile);
  assert.equal(native.preferences.sandbox, true);
  assert.equal(native.preferences.contextIsolation, true);
  assert.equal(native.preferences.nodeIntegration, false);
  check("native launch with isolated profile and sandboxed renderer");

  await leader.getByRole("textbox", { name: "Give your room a name" }).fill("Borderless acceptance lab");
  await leader.getByRole("radio", { name: "Studio Create & collaborate" }).focus();
  await leader.keyboard.press("ArrowRight");
  await leader.keyboard.press("ArrowRight");
  assert.equal(await leader.getByRole("radio", { name: "Classroom Teach & participate" }).isChecked(), true);
  await leader.getByRole("textbox", { name: "Your name", exact: true }).fill("Lab leader");
  await leader.getByRole("textbox", { name: "Leader password" }).fill("disposable-acceptance-password");
  await leader.getByRole("button", { name: "Create your room" }).click();
  await leader.getByText("Live", { exact: true }).waitFor();
  const origin = new URL(leader.url()).origin;
  const roomId = new URL(leader.url()).pathname.split("/")[2];
  await leader.evaluate(installPeerDiagnostics, loopbackLab);

  const canvasBounds = () => leader.locator("#canvas-stage").boundingBox();
  const fullCanvas = await canvasBounds();
  const viewport = await leader.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(fullCanvas.width >= viewport.width * .99 && fullCanvas.height >= viewport.height * .99);
  assert.equal(await leader.locator(".utility-window:visible").count(), 0);
  await leader.getByRole("button", { name: "People", exact: true }).click();
  const peopleWindow = leader.getByRole("region", { name: "People window", exact: true });
  const originalUtility = await peopleWindow.boundingBox();
  const utilityTitle = await leader.getByRole("button", { name: "Move People window", exact: true }).boundingBox();
  await leader.mouse.move(utilityTitle.x + 80, utilityTitle.y + 15);
  await leader.mouse.down();
  await leader.mouse.move(utilityTitle.x - 40, utilityTitle.y - 25, { steps: 8 });
  await leader.mouse.up();
  const utilityHandle = await leader.getByRole("button", { name: "Resize People window", exact: true }).boundingBox();
  await leader.mouse.move(utilityHandle.x + 8, utilityHandle.y + 8);
  await leader.mouse.down();
  await leader.mouse.move(utilityHandle.x + 38, utilityHandle.y - 32, { steps: 8 });
  await leader.mouse.up();
  const movedUtility = await peopleWindow.boundingBox();
  assert.ok(movedUtility.x < originalUtility.x - 100 && movedUtility.y < originalUtility.y - 30);
  assert.ok(movedUtility.width > originalUtility.width + 20 && movedUtility.height < originalUtility.height - 30);
  await leader.getByRole("button", { name: "Room settings", exact: true }).click();
  assert.equal(await leader.locator(".utility-window:visible").count(), 2);
  assert.deepEqual(await canvasBounds(), fullCanvas);
  await leader.getByRole("button", { name: "Close Room settings window", exact: true }).click();
  await leader.getByRole("button", { name: "Close People window", exact: true }).click();
  await leader.getByRole("button", { name: "People", exact: true }).click();
  assert.deepEqual(await peopleWindow.boundingBox(), movedUtility);
  await leader.getByRole("button", { name: "Move People window", exact: true }).focus();
  await leader.keyboard.press("ArrowLeft");
  assert.ok((await peopleWindow.boundingBox()).x < movedUtility.x);
  await leader.keyboard.press("Escape");
  assert.equal(await peopleWindow.isVisible(), false);
  const savedUtility = { ...movedUtility, x: movedUtility.x - 10 };
  await leader.reload();
  await leader.getByText("Live", { exact: true }).waitFor();
  await leader.evaluate(installPeerDiagnostics, loopbackLab);
  assert.equal(await leader.locator(".utility-window:visible").count(), 0);
  await leader.getByRole("button", { name: "People", exact: true }).click();
  const reopenedUtility = await peopleWindow.boundingBox();
  for (const dimension of ["x", "y", "width", "height"])
    assert.ok(Math.abs(reopenedUtility[dimension] - savedUtility[dimension]) < 1);
  await leader.getByRole("button", { name: "Close People window", exact: true }).click();
  await leader.getByRole("button", { name: "Hide controls", exact: true }).click();
  assert.deepEqual(await canvasBounds(), fullCanvas);
  await leader.getByRole("button", { name: "Show controls", exact: true }).click();
  check("full-size workspace; independent movable/resizable utilities retain geometry and dismiss by keyboard");

  // Reproduce a modal blocking Electron's main loop without depending on TCC or
  // capturing the operator's desktop. The hub must answer before main unblocks.
  await application.evaluate(() => { setTimeout(() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000), 20); });
  await delay(100);
  const started = Date.now();
  const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) });
  assert.equal(health.status, 200);
  assert.ok(Date.now() - started < 500);
  check("hub remains responsive while native main thread is blocked");

  browser = await chromium.launch({ channel: "chrome", headless: true, args: labArguments });
  const portalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await portalContext.addInitScript(installSocketDiagnostics);
  const portal = await portalContext.newPage();
  watch(portal);
  await leader.getByRole("button", { name: "Invite people", exact: true }).click();
  const invite = await leader.locator("#invite-url").inputValue();
  await portal.goto(invite);
  await portal.getByRole("textbox", { name: "Your name", exact: true }).fill("Lab learner");
  await portal.getByRole("button", { name: "Join the room", exact: true }).click();
  await portal.getByText("Connected to the canvas", { exact: true }).waitFor();
  await leader.getByRole("button", { name: "Pair a separate display" }).click();
  const pairing = await leader.locator("#modal textarea").inputValue();
  await closeDialog(leader);
  const wallContext = await browser.newContext({ viewport: { width: 3840, height: 2160 } });
  // Model the display operator accepting this room's browser network permission.
  // This is scoped to the disposable hub origin; OS permissions remain unchanged.
  await wallContext.grantPermissions(["local-network-access"], { origin });
  await wallContext.addInitScript(installPeerDiagnostics, loopbackLab);
  await wallContext.addInitScript(installSocketDiagnostics);
  const wall = await wallContext.newPage();
  watch(wall);
  await wall.goto(pairing);
  await wall.locator("#wall-invite img").waitFor();
  assert.equal(await wall.getByRole("button", { name: "Invite people", exact: true }).count(), 0);
  assert.equal(await wall.getByRole("toolbar", { name: "Canvas tools", exact: true }).isVisible(), false);
  check("390px Portal joins by invitation and 4K read-only Wall pairs separately");

  await portal.getByRole("tab", { name: "Send", exact: true }).focus();
  await portal.keyboard.press("ArrowRight");
  assert.equal(await portal.getByRole("tab", { name: "Point", exact: true }).evaluate(tab => document.activeElement === tab && tab.tabIndex === 0 && tab.getAttribute("aria-selected") === "true"), true);
  assert.equal(await portal.locator("#portal-point").getAttribute("aria-labelledby"), "portal-tab-point");
  await portal.keyboard.press("End");
  assert.equal(await portal.locator("#portal-draw").isVisible(), true);
  await portal.keyboard.press("Home");
  assert.equal(await portal.locator('[role="tab"][tabindex="0"]').count(), 1);
  assert.equal(await portal.locator("#portal-send").isVisible(), true);
  check("Portal tabs support arrow/Home/End keys, roving focus and labelled panels");

  await portal.getByRole("button", { name: "Or send a thought" }).click();
  await portal.getByRole("textbox", { name: "A little title" }).fill("A classroom idea");
  await portal.getByRole("textbox", { name: "Your thought" }).fill("A note shared from the participant Portal.");
  await portal.getByRole("button", { name: "Add to the canvas", exact: true }).click();
  await wall.getByText("A classroom idea", { exact: true }).waitFor();
  const bytes = Buffer.from("Disposable Borderless acceptance file.\n");
  const fileChooser = portal.waitForEvent("filechooser");
  await portal.getByRole("button", { name: "Choose a file" }).click();
  await (await fileChooser).setFiles({ name: "lab.txt", mimeType: "text/plain", buffer: bytes });
  await portal.getByRole("button", { name: "Send to the canvas" }).click();
  await leader.getByRole("button", { name: "Open lab.txt", exact: true }).waitFor();
  check("Portal note and confirmed file upload reach both native Console and Wall");

  // Exercise the browser drop pipeline with an inert, generated 1×1 PNG.
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUn8AAAAASUVORK5CYII=";
  await leader.locator("#canvas-stage").evaluate((element, encoded) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], "drop.png", { type: "image/png" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, png);
  await wall.getByRole("img", { name: "drop.png", exact: true }).waitFor();
  assert.equal(await wall.getByRole("img", { name: "drop.png", exact: true }).evaluate(async image => { await image.decode(); return image.naturalWidth === 1; }), true);
  const card = leader.locator(".canvas-item").filter({ has: leader.getByRole("button", { name: "Open lab.txt", exact: true }) });
  const itemId = await card.getAttribute("data-item");
  await leader.waitForFunction(() => document.querySelector('.text-preview')?.textContent.includes("Borderless"));
  assert.equal(await card.locator(".text-preview").textContent(), bytes.toString());
  const waitVersion = async (version) => {
    await leader.waitForFunction(({ itemId, version }) => {
      const item = document.querySelector(`[data-item="${itemId}"]`);
      return Boolean(item) && item.dataset.version !== version;
    }, { itemId, version });
    await card.evaluate(element => Promise.all(element.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {}))));
  };
  const beforeLayout = await card.getAttribute("data-version");
  await leader.getByRole("button", { name: "Tidy up", exact: true }).click();
  await waitVersion(beforeLayout);
  const version = await card.getAttribute("data-version");
  await card.locator(".item-bar").waitFor({ state: "visible" });
  const header = await card.locator(".item-bar").boundingBox();
  await leader.mouse.move(header.x + 30, header.y + 8);
  await leader.mouse.down();
  await leader.mouse.move(header.x + 55, header.y + 35, { steps: 12 });
  await leader.mouse.up();
  await waitVersion(version);
  const moved = await card.getAttribute("data-version");
  const handle = await card.locator(".resize-handle").boundingBox();
  await leader.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await leader.mouse.down();
  await leader.mouse.move(handle.x - 15, handle.y - 18, { steps: 12 });
  await leader.mouse.up();
  await waitVersion(moved);
  check("PNG drop/preview, grid arrangement, native mouse movement and resizing");

  const keyMove = await card.getAttribute("data-version");
  const oldPosition = await card.evaluate(element => parseFloat(element.style.left));
  await card.focus();
  const moveReply = leader.waitForResponse(response => response.url().endsWith("/command") && response.request().postDataJSON()?.type === "item.move");
  await leader.keyboard.press("ArrowRight");
  assert.equal((await moveReply).status(), 200);
  await waitVersion(keyMove);
  assert.ok(await card.evaluate((element, old) => parseFloat(element.style.left) > old, oldPosition));
  const keyResize = await card.getAttribute("data-version");
  const oldWidth = await card.evaluate(element => parseFloat(element.style.width));
  const resizeReply = leader.waitForResponse(response => response.url().endsWith("/command") && response.request().postDataJSON()?.type === "item.resize");
  await leader.keyboard.press("Alt+ArrowLeft");
  assert.equal((await resizeReply).status(), 200);
  await waitVersion(keyResize);
  assert.ok(await card.evaluate((element, old) => parseFloat(element.style.width) < old, oldWidth));
  assert.equal(await card.evaluate(element => document.activeElement === element), true);
  await leader.keyboard.press("Enter");
  await leader.getByRole("button", { name: "Send to a device", exact: true }).click();
  await leader.keyboard.press("Escape");
  await leader.waitForFunction(itemId => document.activeElement?.dataset.item === itemId, itemId);
  check("canvas keyboard move/resize persists; nested dialog Escape restores its original card");

  // Drop one HTTP acknowledgement only after the hub commits the command.
  const noteRoute = `**/api/rooms/${roomId}/command`;
  let dropped = false;
  const receiptIds = [];
  const interruptAck = async route => {
    const input = route.request().postDataJSON();
    if (input.type !== "note.add" || input.title !== "Recovered acknowledgement") return route.continue();
    receiptIds.push(input.commandId);
    if (!dropped) {
      dropped = true;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await response.dispose();
      await route.abort("failed");
    } else await route.continue();
  };
  await portal.route(noteRoute, interruptAck);
  faulting.add(portal);
  await portal.getByRole("button", { name: "Or send a thought" }).click();
  await portal.getByRole("textbox", { name: "A little title" }).fill("Recovered acknowledgement");
  await portal.getByRole("textbox", { name: "Your thought" }).fill("This command must create exactly one note.");
  await portal.getByRole("button", { name: "Add to the canvas", exact: true }).click();
  await wall.getByText("Recovered acknowledgement", { exact: true }).waitFor();
  await portal.locator("#modal").waitFor({ state: "hidden" });
  await portal.unroute(noteRoute, interruptAck);
  faulting.delete(portal);
  assert.equal(receiptIds.length, 2);
  assert.equal(receiptIds[0], receiptIds[1]);
  assert.equal(await wall.getByText("Recovered acknowledgement", { exact: true }).count(), 1);
  check("lost HTTP acknowledgement recovers in the rendered Portal without duplicating its note");

  const flickChooser = portal.waitForEvent("filechooser");
  await portal.getByRole("button", { name: "Choose a file" }).click();
  await (await flickChooser).setFiles({ name: "flick.txt", mimeType: "text/plain", buffer: Buffer.from("Sent with an emulated touch flick.") });
  await portal.locator("#throw-card").scrollIntoViewIfNeeded();
  const throwBox = await portal.locator("#throw-card").boundingBox();
  const touch = await portalContext.newCDPSession(portal);
  const touchX = throwBox.x + throwBox.width * .1, touchY = throwBox.y + throwBox.height * .7;
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: touchY }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchX, y: touchY - 100 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await leader.getByRole("button", { name: "Open flick.txt", exact: true }).waitFor();
  await touch.detach();
  check("emulated touch flick commits a selected file through the Portal");

  await portal.getByRole("tab", { name: "Point", exact: true }).click();
  const pointer = await portal.locator("#pointer-pad").boundingBox();
  await portal.mouse.move(pointer.x + pointer.width / 2, pointer.y + pointer.height / 2);
  await portal.mouse.down();
  await wall.locator(".remote-pointer").waitFor();
  await portal.mouse.up();
  await wall.locator(".remote-pointer").waitFor({ state: "detached" });
  await portal.getByRole("tab", { name: "Draw", exact: true }).click();
  assert.equal(await portal.locator("#drawing-pad.draw-disabled").count(), 1);
  await portal.getByRole("button", { name: "Raise your hand", exact: true }).click();
  await leader.getByRole("button", { name: "People", exact: true }).click();
  await leader.getByRole("button", { name: "Approve Lab learner", exact: true }).click();
  await portal.getByText("You have the floor. Make it yours.", { exact: true }).waitFor();
  await stroke(portal);
  await wall.locator(".ink-layer path").waitFor();
  await portal.getByRole("button", { name: "Undo", exact: true }).click();
  await wall.locator(".ink-layer path").waitFor({ state: "detached" });
  await stroke(portal);
  await wall.locator(".ink-layer path").waitFor();
  const svgDownload = portal.waitForEvent("download");
  await portal.getByRole("button", { name: "Save whiteboard" }).click();
  const svg = await readFile(await (await svgDownload).path(), "utf8");
  assert.match(svg, /<polyline/);
  check("pointer lifecycle, classroom approval, drawn ink, undo and SVG export");

  await leader.getByRole("button", { name: "Ask the room A quick question. Every voice." }).click();
  await leader.getByRole("textbox", { name: "Your question" }).fill("Which direction should we explore?");
  await leader.locator('[name="option0"]').fill("Prototype together");
  await leader.locator('[name="option1"]').fill("Discuss first");
  await leader.getByRole("button", { name: "Ask everyone", exact: true }).click();
  await portal.getByRole("button", { name: "A Prototype together", exact: true }).click();
  await portal.getByText("Your answer is in. The results appear when the leader closes the question.", { exact: true }).waitFor();
  assert.equal(await portal.locator(".quiz-option.correct").count(), 0);
  await leader.getByRole("button", { name: "See results", exact: true }).click();
  await leader.getByRole("button", { name: "Close & reveal answers", exact: true }).click();
  await portal.locator(".quiz-option.correct").waitFor();
  await wall.locator(".wall-quiz-options .correct").waitFor();
  check("quiz submission stays private until the leader reveals shared results");

  await leader.getByRole("button", { name: "Manage Lab learner", exact: true }).click();
  await leader.getByRole("button", { name: "Revoke drawing", exact: true }).click();
  await closeDialog(leader);
  await portal.getByText("Ask the leader for a turn at the board.", { exact: true }).waitFor();
  assert.equal(await portal.locator("#drawing-pad.draw-disabled").count(), 1);
  check("leader revocation immediately relocks the participant drawing pad");

  await portal.getByRole("button", { name: "Raise your hand", exact: true }).click();
  const approve = leader.getByRole("button", { name: "Approve Lab learner", exact: true });
  await approve.focus();
  // A remote update rebuilds the People panel. Focus must follow the same action.
  await portal.getByRole("tab", { name: "Send", exact: true }).click();
  await portal.getByRole("button", { name: "Or send a thought" }).click();
  await portal.getByRole("textbox", { name: "A little title" }).fill("Draft survives reconnect");
  await portal.getByRole("textbox", { name: "Your thought" }).fill("An unsent thought stays in its open dialog.");
  const participantId = await portal.evaluate(async roomId => (await (await fetch(`/api/rooms/${roomId}/state`)).json()).me.id, roomId);
  await leader.evaluate(async roomId => {
    const state = await (await fetch(`/api/rooms/${roomId}/state`)).json();
    const response = await fetch(`/api/rooms/${roomId}/command`, { method: "POST", headers: { "Content-Type": "application/json", "X-Borderless-CSRF": state.me.csrf }, body: JSON.stringify({ type: "note.add", commandId: crypto.randomUUID(), title: "Focus survives updates", text: "A contribution while the approval button has focus." }) });
    if (!response.ok) throw new Error("The remote focus-test contribution failed.");
  }, roomId);
  await leader.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Approve Lab learner");
  await approve.click();
  const portalConnection = await portal.evaluate(() => qaSockets.at(-1).qaConnectionId);
  faulting.add(portal);
  await portal.evaluate(() => qaSockets.at(-1).close());
  await portal.getByRole("button", { name: "Reconnect now", exact: true }).waitFor({ state: "attached" });
  await portalContext.setOffline(true);
  await leader.getByRole("button", { name: "Manage Lab learner", exact: true }).click();
  await leader.getByRole("button", { name: "Revoke drawing", exact: true }).click();
  await closeDialog(leader);
  await portalContext.setOffline(false);
  await portal.waitForFunction(previous => qaSockets.at(-1).qaConnectionId && qaSockets.at(-1).qaConnectionId !== previous && document.querySelector("#connection-banner").hidden, portalConnection);
  faulting.delete(portal);
  assert.equal(await portal.getByRole("textbox", { name: "Your thought" }).inputValue(), "An unsent thought stays in its open dialog.");
  assert.equal(await portal.evaluate(async roomId => (await (await fetch(`/api/rooms/${roomId}/state`)).json()).me.id, roomId), participantId);
  await portal.keyboard.press("Escape");
  await portal.getByRole("tab", { name: "Draw", exact: true }).click();
  await portal.getByText("Ask the leader for a turn at the board.", { exact: true }).waitFor();
  assert.equal(await portal.locator("#drawing-pad.draw-disabled").count(), 1);
  check("remote updates preserve approval focus; reconnect keeps identity/draft and refreshes drawing revocation");

  await leader.getByRole("button", { name: "Open lab.txt", exact: true }).click();
  await leader.getByRole("button", { name: "Send to a device", exact: true }).click();
  await leader.getByRole("combobox", { name: "Send to" }).selectOption({ label: "Lab learner" });
  await leader.getByRole("button", { name: "Send to device", exact: true }).click();
  await portal.getByRole("button", { name: "lab.txt From Lab leader", exact: true }).click();
  const returned = portal.waitForEvent("download");
  await portal.getByRole("link", { name: "Download file", exact: true }).click();
  const received = await readFile(await (await returned).path());
  assert.equal(createHash("sha256").update(received).digest("hex"), createHash("sha256").update(bytes).digest("hex"));
  check("targeted return download matches the original SHA-256");
  await portal.locator("#modal").waitFor({ state: "hidden" });

  assert.equal(await portal.evaluate(async () => {
    const { modal, closeModal } = await import("/js/ui.js");
    const dialog = document.querySelector("#modal");
    const closed = new Promise(resolve => dialog.addEventListener("close", () => queueMicrotask(resolve), { once: true }));
    document.querySelector('[role="tab"][aria-selected="true"]').focus();
    modal("Focus recovery check", '<button type="button">Continue</button>');
    closeModal();
    const target = document.querySelector('#portal-files [data-action="item.open"]');
    const id = target.dataset.id;
    target.focus();
    await closed;
    return document.activeElement?.dataset.id === id;
  }), true);
  check("a delayed native dialog-close event preserves the user's newly chosen focus");

  const contribution = portal.locator('#portal-files [data-action="item.open"]').first();
  await contribution.focus();
  const focusedContribution = await contribution.getAttribute("data-id");
  const guestCanvas = await portalContext.newPage();
  watch(guestCanvas);
  await guestCanvas.goto(`${origin}/room/${roomId}`);
  await guestCanvas.getByText("Live", { exact: true }).waitFor();
  await guestCanvas.getByRole("button", { name: "People", exact: true }).click();
  await guestCanvas.getByRole("button", { name: "Resize People window", exact: true }).focus();
  for (let step = 0; step < 5; step++) {
    await guestCanvas.keyboard.press("Shift+ArrowRight");
    await guestCanvas.keyboard.press("Shift+ArrowDown");
  }
  const mobileUtility = await guestCanvas.getByRole("region", { name: "People window", exact: true }).boundingBox();
  assert.ok(mobileUtility.x >= 0 && mobileUtility.y >= 0 && mobileUtility.x + mobileUtility.width <= 390 && mobileUtility.y + mobileUtility.height <= 844);
  assert.equal(await guestCanvas.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await guestCanvas.screenshot({ path: join(output, "canvas-390.png") });
  await guestCanvas.keyboard.press("Escape");
  await portal.waitForFunction(id => document.activeElement?.dataset.id === id, focusedContribution);
  const foreignCard = guestCanvas.locator(".canvas-item").filter({ has: guestCanvas.getByRole("img", { name: "drop.png", exact: true }) });
  const foreignVersion = await foreignCard.getAttribute("data-version");
  await foreignCard.focus();
  await guestCanvas.keyboard.press("ArrowRight");
  await guestCanvas.getByRole("status").filter({ hasText: "Only the owner or room leader" }).waitFor({ state: "attached" });
  assert.equal(await foreignCard.getAttribute("data-version"), foreignVersion);
  await leader.evaluate(async roomId => {
    const state = await (await fetch(`/api/rooms/${roomId}/state`)).json();
    const item = state.items.find(item => item.title === "drop.png");
    const response = await fetch(`/api/rooms/${roomId}/command`, { method: "POST", headers: { "Content-Type": "application/json", "X-Borderless-CSRF": state.me.csrf }, body: JSON.stringify({ type: "item.remove", commandId: crypto.randomUUID(), itemId: item.id, version: item.version }) });
    if (!response.ok) throw new Error("The remote removal failed.");
  }, roomId);
  await foreignCard.waitFor({ state: "detached" });
  assert.equal(await guestCanvas.locator("#canvas-stage").evaluate(element => document.activeElement === element), true);
  await guestCanvas.close();
  check("keyboard ownership remains enforced and removal returns focus to the canvas");

  await application.evaluate(({ dialog, shell }) => {
    globalThis.qaOriginalDialog = dialog.showMessageBox;
    globalThis.qaOpenCalls = 0;
    globalThis.qaConfirmCalls = 0;
    dialog.showMessageBox = async () => { globalThis.qaConfirmCalls++; return { response: 0 }; };
    shell.openPath = async () => { globalThis.qaOpenCalls++; return ""; };
  });
  const cancelled = await leader.evaluate(async ({ roomId }) => {
    const state = await (await fetch(`/api/rooms/${roomId}/state`)).json();
    return window.borderless.openAsset({ roomId, assetId: state.items.find(i => i.title === "lab.txt").assetId });
  }, { roomId });
  assert.deepEqual(cancelled, { opened: false });
  assert.deepEqual(await application.evaluate(() => [globalThis.qaConfirmCalls, globalThis.qaOpenCalls]), [1, 0]);
  check("native file-open cancellation does not launch an application (dialog stub)");
  await application.evaluate(({ dialog }) => {
    globalThis.qaNetworkPrompts = 0;
    // Approve only the native app's room-network consent in this disposable lab.
    // OS privacy settings and certificate validation are unchanged.
    dialog.showMessageBox = (...args) => {
      if (args.at(-1).title === "Connect to your room?") {
        globalThis.qaNetworkPrompts++;
        return Promise.resolve({ response: 1 });
      }
      return globalThis.qaOriginalDialog(...args);
    };
  });

  // Generated canvas frames test actual local WebRTC transport, not OS capture.
  await leader.getByRole("button", { name: "Close People window", exact: true }).click();
  await leader.evaluate(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext("2d");
      let frame = 0;
      const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? "#327c76" : "#c76a39"; context.fillRect(0, 0, 640, 360); }, 60);
      const stream = canvas.captureStream(15);
      globalThis.qaCapture = stream;
      stream.getVideoTracks()[0].addEventListener("ended", () => clearInterval(timer));
      return stream;
    };
  });
  await leader.getByRole("button", { name: "Share your screen", exact: true }).click();
  await leader.getByRole("button", { name: "Stop sharing your screen", exact: true }).waitFor();
  await wall.waitForFunction(() => { const v = document.querySelector(".stream-tile video"); return v?.videoWidth === 640 && v.readyState >= 2; });
  const liveWindow = leader.locator(".stream-item");
  const liveTitle = await liveWindow.locator(".item-bar").boundingBox();
  const liveVersion = await liveWindow.getAttribute("data-version");
  await wall.evaluate(() => {
    window.qaLiveVideo = document.querySelector(".stream-item video");
    window.qaLiveMedia = qaLiveVideo.srcObject;
    window.qaLiveFrames = qaLiveVideo.getVideoPlaybackQuality().totalVideoFrames;
  });
  await leader.mouse.move(liveTitle.x + 70, liveTitle.y + 15);
  await leader.mouse.down();
  await leader.mouse.move(liveTitle.x + 120, liveTitle.y + 55, { steps: 10 });
  await leader.mouse.up();
  await leader.waitForFunction(previous => document.querySelector(".stream-item").dataset.version !== previous, liveVersion);
  const resizeVersion = await liveWindow.getAttribute("data-version");
  const liveHandle = await liveWindow.locator(".resize-handle").boundingBox();
  await leader.mouse.move(liveHandle.x + 8, liveHandle.y + 8);
  await leader.mouse.down();
  await leader.mouse.move(liveHandle.x - 30, liveHandle.y - 25, { steps: 10 });
  await leader.mouse.up();
  await leader.waitForFunction(previous => document.querySelector(".stream-item").dataset.version !== previous, resizeVersion);
  const liveBounds = await liveWindow.evaluate(element => [element.style.left, element.style.top, element.style.width, element.style.height]);
  await liveWindow.getByRole("button", { name: /^Focus / }).click();
  await wall.waitForFunction(() => document.querySelector(".stream-item").style.width === "92%");
  await liveWindow.getByRole("button", { name: /^Restore / }).click();
  await wall.waitForFunction(bounds => {
    const element = document.querySelector(".stream-item");
    return JSON.stringify([element.style.left, element.style.top, element.style.width, element.style.height]) === JSON.stringify(bounds);
  }, liveBounds);
  await wall.waitForFunction(() => qaLiveVideo.getVideoPlaybackQuality().totalVideoFrames > qaLiveFrames);
  assert.equal(await wall.evaluate(() => qaLiveVideo === document.querySelector(".stream-item video") && qaLiveVideo.srcObject === qaLiveMedia), true);
  assert.equal(await wall.locator(".stream-item .item-focus, .stream-item .stream-stop").count(), 0);
  check("shared live windows move/resize/focus/restore without replacing media or interrupting decoded frames");
  const secondWall = await wallContext.newPage();
  watch(secondWall);
  await secondWall.goto(`${origin}/wall/${roomId}`);
  await secondWall.waitForFunction(() => { const v = document.querySelector(".stream-tile video"); return v?.videoWidth === 640 && v.readyState >= 2; });
  const wallConnection = await wall.evaluate(() => qaSockets.at(-1).qaConnectionId);
  faulting.add(wall); faulting.add(secondWall);
  // Finish the real close handshake before blocking reconnect HTTP. Offline
  // emulation can otherwise drop the close acknowledgement on background tabs.
  await Promise.all([wall, secondWall].map(page => page.evaluate(() => qaSockets.at(-1).close())));
  await wall.getByRole("button", { name: "Reconnect now", exact: true }).waitFor();
  await secondWall.getByRole("button", { name: "Reconnect now", exact: true }).waitFor();
  await wallContext.setOffline(true);
  await leader.waitForFunction(() => qaPeers.length >= 2 && qaPeers.every(peer => peer.connectionState === "closed"));
  await wallContext.setOffline(false);
  await Promise.all([wall, secondWall].map(page => page.getByRole("button", { name: "Reconnect now", exact: true }).click()));
  await wall.waitForFunction(previous => qaSockets.at(-1).qaConnectionId !== previous && document.querySelector("#connection-banner").hidden && document.querySelector(".stream-tile video")?.videoWidth === 640, wallConnection);
  await secondWall.waitForFunction(() => document.querySelector("#connection-banner").hidden && document.querySelector(".stream-tile video")?.videoWidth === 640);
  faulting.delete(wall); faulting.delete(secondWall);
  assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
  check("manual Wall reconnect restores media to both tabs and closes departed owner peers");
  await leader.getByRole("button", { name: "Stop sharing your screen", exact: true }).click();
  await wall.locator(".stream-tile").waitFor({ state: "detached" });
  await secondWall.locator(".stream-tile").waitFor({ state: "detached" });
  assert.equal(await leader.evaluate(() => globalThis.qaCapture.getVideoTracks()[0].readyState), "ended");
  check("generated video reaches two Wall tabs sharing one cookie; explicit stop ends tracks");

  await leader.getByRole("button", { name: "Share your screen", exact: true }).click();
  await wall.waitForFunction(() => document.querySelector(".stream-tile video")?.videoWidth === 640);
  const ownerConnection = await leader.evaluate(() => qaSockets.at(-1).qaConnectionId);
  faulting.add(leader);
  await leader.evaluate(() => qaSockets.at(-1).close());
  await leader.getByRole("button", { name: "Reconnect now", exact: true }).waitFor();
  await leader.context().setOffline(true);
  await wall.locator(".stream-tile").waitFor({ state: "detached" });
  assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "ended");
  await leader.context().setOffline(false);
  await leader.getByRole("button", { name: "Reconnect now", exact: true }).click();
  await leader.waitForFunction(previous => qaSockets.at(-1).qaConnectionId && qaSockets.at(-1).qaConnectionId !== previous && document.querySelector("#connection-banner").hidden, ownerConnection);
  faulting.delete(leader);
  assert.equal(await leader.getByRole("button", { name: "Share your screen", exact: true }).count(), 1);
  assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "ended");
  assert.equal(await wall.locator(".stream-tile").count(), 0);
  check("owner disconnection ends capture and reconnect requires an explicit new share");

  // Exercise the production effect module with live browser preference changes.
  await wall.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(await wall.evaluate(async () => {
    const { LandingEffects } = await import("/js/effects.js");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;width:100px;height:100px;pointer-events:none";
    document.body.append(canvas);
    window.qaMotionCanvas = canvas;
    window.qaMotion = new LandingEffects(canvas);
    qaMotion.play(.5, .5, "#294636", "ripple");
    return Boolean(qaMotion.gl && qaMotion.frame);
  }), true);
  await wall.emulateMedia({ reducedMotion: "reduce" });
  await wall.waitForFunction(() => qaMotion.reduced && qaMotion.frame === null && qaMotion.event === null);
  assert.equal(await wall.evaluate(() => { qaMotion.play(.5, .5, "#294636", "liquid"); return !qaMotion.frame && !qaMotion.event; }), true);
  assert.ok(await wall.locator(".canvas-item").first().evaluate(element => parseFloat(getComputedStyle(element).transitionDuration) < .01));
  await wall.emulateMedia({ reducedMotion: "no-preference" });
  await wall.waitForFunction(() => !qaMotion.reduced);
  assert.equal(await wall.evaluate(() => { qaMotion.play(.5, .5, "#294636", "particles"); return Boolean(qaMotion.frame); }), true);
  await wall.evaluate(() => { qaMotion.destroy(); qaMotionCanvas.remove(); delete window.qaMotion; delete window.qaMotionCanvas; });
  check("live reduced-motion changes cancel/prevent arrival effects and suppress CSS transitions");

  await leader.getByRole("button", { name: "Room settings", exact: true }).click();
  await portal.getByRole("tab", { name: "Send", exact: true }).click();
  for (const theme of ["studio", "executive", "synth", "command", "classroom"]) {
    await leader.locator(`[data-action="theme"][data-theme="${theme}"]`).click();
    await wall.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    await portal.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    await leader.waitForFunction(theme => document.activeElement?.dataset.theme === theme, theme);
    await contrast(leader, theme, [".panel-intro", ".theme-option.selected span", ".effects-options .selected", ".room-status", ".floating-toolbar button.active", ".note-text", ".item-window-title"]);
    await contrast(portal, theme, [".portal-room > p", ".portal-tabs button:not(.selected)", ".throw-card h2", ".throw-card p", ".throw-card .btn.primary", ".throw-cue", ".avatar"]);
    await contrast(wall, theme, ["#wall-invite small", ".note-text", ".item-window-title"]);
  }
  check("representative text/control contrast meets 4.5:1 across all five themes; settings focus survives refresh");
  await leader.getByRole("button", { name: "Close Room settings window", exact: true }).click();
  await leader.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.equal(await leader.locator("#zoom-value").textContent(), "110%");
  await leader.getByRole("button", { name: "Fit canvas", exact: true }).click();
  assert.equal(await leader.locator("#zoom-value").textContent(), "100%");
  await leader.getByRole("button", { name: "Room settings", exact: true }).click();
  await leader.getByRole("button", { name: "Pause contributions", exact: true }).click();
  await portal.getByText("The leader has paused contributions", { exact: true }).waitFor();
  await leader.getByRole("button", { name: "Resume contributions", exact: true }).click();
  await portal.getByText("Connected to the canvas", { exact: true }).waitFor();
  await leader.getByRole("button", { name: "Close Room settings window", exact: true }).click();
  await leader.getByRole("button", { name: "People", exact: true }).click();
  check("five themes propagate to every interface; zoom/fit and pause/resume stay connected");

  await Promise.all([leader, portal].map(async page => {
    const last = page.locator(".toast").last();
    if (await last.count()) await last.waitFor({ state: "detached", timeout: 7000 });
  }));

  await leader.screenshot({ path: join(output, "console-1440.png") });
  await portal.screenshot({ path: join(output, "portal-390.png"), fullPage: true });
  await wall.screenshot({ path: join(output, "wall-4k.png") });
  assert.equal(await portal.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await leader.getByRole("button", { name: "Manage Lab learner", exact: true }).click();
  await leader.getByRole("button", { name: "Remove from room", exact: true }).click();
  await portal.getByRole("link", { name: "Join again", exact: true }).waitFor();
  await portal.getByText("Your access has ended", { exact: true }).waitFor();
  assert.equal(await portal.getByRole("button", { name: "Reconnect now", exact: true }).count(), 0);
  assert.equal(await portal.getByRole("link", { name: "Join again", exact: true }).getAttribute("href"), `/join/${roomId}`);
  await contrast(portal, "revoked", ["#connection-banner > span", "#connection-banner .btn"]);
  await portal.screenshot({ path: join(output, "portal-revoked.png"), fullPage: true });
  check("eviction replaces retry with an explicit Join again recovery path");
  assert.deepEqual(errors, []);
  check("screenshots, phone width without overflow and no renderer console errors");
  await browser.close(); browser = null;
  const nativeQuit = application.waitForEvent("close");
  await application.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); });
  await nativeQuit;
  application = null;
  await assert.rejects(readFile(join(profile, "hub/hub.lock")), { code: "ENOENT" });
  check("native graceful quit releases the hub process and storage lock");
  await writeFile(join(output, "desktop-smoke.json"), JSON.stringify({ at: new Date().toISOString(), platform: process.platform, arch: process.arch, build: packagedExecutable ? "packaged" : "source", ice: loopbackLab ? "explicit loopback host-candidate fixture; real same-machine media only" : unicastLab ? "unobfuscated host candidates in disposable same-machine lab" : "Chromium default", checks, contrastChecks, expectedNetworkErrors, errors, limits: ["Generated video is not OS capture consent evidence.", "Phone viewport is Chromium emulation, not a physical phone.", "Representative computed-colour samples and keyboard checks are not a full WCAG or assistive-technology audit.", "Native file confirmation is stubbed for cancellation.", "Room-network consent is approved for this disposable native/browser lab; OS Local Network permission is separate.", ...(unicastLab ? ["Controlled candidate fixtures do not qualify mDNS, OS Local Network consent or physical LAN connectivity."] : [])] }, null, 2));
} catch (error) {
  const diagnostics = [];
  for (const [index, page] of pages.entries()) {
    if (page.isClosed()) continue;
    await page.screenshot({ path: join(output, `failure-${index}.png`), timeout: 3000 }).catch(() => {});
    diagnostics.push(await page.evaluate(async () => ({
      path: location.pathname,
      text: document.body.innerText,
      focus: { tag: document.activeElement?.tagName, action: document.activeElement?.dataset.action, id: document.activeElement?.dataset.id, theme: document.activeElement?.dataset.theme },
      sockets: (window.qaSockets || []).map(socket => ({ state: socket.readyState, connectionId: socket.qaConnectionId })),
      signals: window.qaSignals,
      viewport: { width: innerWidth, height: innerHeight },
      utilityBounds: [...document.querySelectorAll(".utility-window")].map(element => ({ id: element.dataset.window, bounds: element.getBoundingClientRect().toJSON() })),
      video: [...document.querySelectorAll("video")].map(v => ({ width: v.videoWidth, height: v.videoHeight, readyState: v.readyState })),
      peers: await Promise.all((window.qaPeers || []).map(async p => ({
        connection: p.connectionState, ice: p.iceConnectionState, gathering: p.iceGatheringState, signalling: p.signalingState,
        candidates: p.qaCandidateInputs,
        stats: [...(await p.getStats()).values()].filter(s => ["candidate-pair", "inbound-rtp", "outbound-rtp", "local-candidate", "remote-candidate"].includes(s.type)).map(s => ({
          type: s.type, state: s.state, candidateType: s.candidateType, protocol: s.protocol, nominated: s.nominated,
          mdnsAddress: s.address?.endsWith(".local"),
          bytesReceived: s.bytesReceived, bytesSent: s.bytesSent, framesEncoded: s.framesEncoded, framesDecoded: s.framesDecoded,
        })),
      }))),
    })).catch(() => ({ unavailable: true })));
  }
  const networkPrompts = await application?.evaluate(() => globalThis.qaNetworkPrompts || 0).catch(() => null);
  await writeFile(join(output, "failure.json"), JSON.stringify({ checks, errors, failure: error.message, networkPrompts, diagnostics }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await application?.close();
  await rm(profile, { recursive: true, force: true });
}
