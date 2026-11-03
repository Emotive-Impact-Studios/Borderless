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
const profile = await mkdtemp(join(tmpdir(), "borderless-desktop-qa-"));
const output = join(root, packagedExecutable ? "output/playwright-packaged" : "output/playwright");
await mkdir(output, { recursive: true });
const checks = [], errors = [], pages = [];
let application, browser;
const watch = (page) => {
  pages.push(page);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
};
function installPeerDiagnostics() {
  const NativePeer = window.RTCPeerConnection;
  window.qaPeers = [];
  window.RTCPeerConnection = class extends NativePeer {
    constructor(...args) { super(...args); window.qaPeers.push(this); }
  };
}
const check = (name) => { checks.push(name); console.log(`✓ ${name}`); };
const closeDialog = (page) => page.getByRole("button", { name: "Close dialog", exact: true }).click();
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
    args: [...(packagedExecutable ? [] : [root]), `--user-data-dir=${profile}`],
    env: { ...process.env, BORDERLESS_PORT: "0", BORDERLESS_HOST: "127.0.0.1", BORDERLESS_PUBLIC_URL: "", BORDERLESS_TLS_CERT: "", BORDERLESS_TLS_KEY: "" },
  });
  const leader = await application.firstWindow();
  watch(leader);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
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
  await leader.evaluate(installPeerDiagnostics);

  // Reproduce a modal blocking Electron's main loop without depending on TCC or
  // capturing the operator's desktop. The hub must answer before main unblocks.
  await application.evaluate(() => { setTimeout(() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000), 20); });
  await delay(100);
  const started = Date.now();
  const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) });
  assert.equal(health.status, 200);
  assert.ok(Date.now() - started < 500);
  check("hub remains responsive while native main thread is blocked");

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const portalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
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
  await wallContext.addInitScript(installPeerDiagnostics);
  const wall = await wallContext.newPage();
  watch(wall);
  await wall.goto(pairing);
  await wall.locator("#wall-invite img").waitFor();
  assert.equal(await wall.getByRole("button", { name: "Invite people", exact: true }).count(), 0);
  check("390px Portal joins by invitation and 4K read-only Wall pairs separately");

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
  const waitVersion = async (version) => leader.waitForFunction(({ itemId, version }) => {
    const item = document.querySelector(`[data-item="${itemId}"]`);
    return Boolean(item) && item.dataset.version !== version;
  }, { itemId, version });
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
  const secondWall = await wallContext.newPage();
  watch(secondWall);
  await secondWall.goto(`${origin}/wall/${roomId}`);
  await secondWall.waitForFunction(() => { const v = document.querySelector(".stream-tile video"); return v?.videoWidth === 640 && v.readyState >= 2; });
  await leader.getByRole("button", { name: "Stop sharing your screen", exact: true }).click();
  await wall.locator(".stream-tile").waitFor({ state: "detached" });
  await secondWall.locator(".stream-tile").waitFor({ state: "detached" });
  assert.equal(await leader.evaluate(() => globalThis.qaCapture.getVideoTracks()[0].readyState), "ended");
  check("generated video reaches two Wall tabs sharing one cookie; explicit stop ends tracks");

  await leader.getByRole("button", { name: "Room settings", exact: true }).click();
  for (const theme of ["studio", "executive", "synth", "command", "classroom"]) {
    await leader.locator(`[data-action="theme"][data-theme="${theme}"]`).click();
    await wall.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    await portal.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
  }
  await leader.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.equal(await leader.locator("#zoom-value").textContent(), "110%");
  await leader.getByRole("button", { name: "Fit canvas", exact: true }).click();
  assert.equal(await leader.locator("#zoom-value").textContent(), "100%");
  await leader.getByRole("button", { name: "Pause contributions", exact: true }).click();
  await portal.getByText("The leader has paused contributions", { exact: true }).waitFor();
  await leader.getByRole("button", { name: "Resume contributions", exact: true }).click();
  await portal.getByText("Connected to the canvas", { exact: true }).waitFor();
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
  assert.deepEqual(errors, []);
  check("screenshots, phone width without overflow and no renderer console errors");
  await browser.close(); browser = null;
  await application.close(); application = null;
  await assert.rejects(readFile(join(profile, "hub/hub.lock")), { code: "ENOENT" });
  check("native graceful quit releases the hub process and storage lock");
  await writeFile(join(output, "desktop-smoke.json"), JSON.stringify({ at: new Date().toISOString(), platform: process.platform, arch: process.arch, build: packagedExecutable ? "packaged" : "source", checks, errors, limits: ["Generated video is not OS capture consent evidence.", "Phone viewport is Chromium emulation, not a physical phone.", "Native file confirmation is stubbed for cancellation.", "Room-network consent is approved for this disposable native/browser lab; OS Local Network permission is separate."] }, null, 2));
} catch (error) {
  const diagnostics = [];
  for (const [index, page] of pages.entries()) {
    if (page.isClosed()) continue;
    await page.screenshot({ path: join(output, `failure-${index}.png`), timeout: 3000 }).catch(() => {});
    diagnostics.push(await page.evaluate(async () => ({
      path: location.pathname,
      text: document.body.innerText,
      video: [...document.querySelectorAll("video")].map(v => ({ width: v.videoWidth, height: v.videoHeight, readyState: v.readyState })),
      peers: await Promise.all((window.qaPeers || []).map(async p => ({
        connection: p.connectionState, ice: p.iceConnectionState, gathering: p.iceGatheringState, signalling: p.signalingState,
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
