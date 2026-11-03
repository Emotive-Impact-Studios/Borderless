// A second native participant receives the source in a separate OS window.
// Generated pixels and candidate fixtures retain their parent smoke limits.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron } from "playwright";
import electron from "electron";

export async function liveWindowAcceptance({ root, executable, origin, invite, roomId, leader, wall, output, labArguments, loopbackLab, installSocketDiagnostics, installPeerDiagnostics, watch, check, contrast, faulting }) {
  const profile = await mkdtemp(join(tmpdir(), "borderless-viewer-qa-"));
  let application, receiver;
  try {
    application = await _electron.launch({ executablePath: executable || electron,
      args: [...(executable ? [] : [root]), `--user-data-dir=${profile}`, `--hub=${origin}`, ...labArguments],
      env: { ...process.env, BORDERLESS_PORT: "0", BORDERLESS_HOST: "127.0.0.1", BORDERLESS_PUBLIC_URL: "", BORDERLESS_TLS_CERT: "", BORDERLESS_TLS_KEY: "" } });
    await application.context().addInitScript(installSocketDiagnostics);
    await application.context().addInitScript(installPeerDiagnostics, loopbackLab);
    await application.evaluate(({ dialog }) => {
      const original = dialog.showMessageBox;
      dialog.showMessageBox = (...args) => args.at(-1).title === "Connect to your room?" ? Promise.resolve({ response: 1 }) : original(...args);
    });
    const portal = await application.firstWindow(); watch(portal);
    await portal.goto(invite);
    await portal.getByRole("textbox", { name: "Your name", exact: true }).fill("Desktop recipient");
    await portal.getByRole("button", { name: "Join the room", exact: true }).click();
    await portal.getByText("Live", { exact: true }).waitFor();
    assert.equal(new URL(portal.url()).pathname, `/room/${roomId}`);
    await portal.getByRole("button", { name: "People", exact: true }).click();
    const recipientId = await portal.evaluate(async roomId => (await (await fetch(`/api/rooms/${roomId}/state`)).json()).me.id, roomId);
    const shareState = () => leader.evaluate(async roomId => (await (await fetch(`/api/rooms/${roomId}/state`)).json()).streams[0], roomId);
    let capturedInvitation = false;
    const sendInvitation = async () => {
      await leader.getByRole("button", { name: /^Invite a viewer to / }).click();
      await leader.getByLabel("Invite to", { exact: true }).selectOption({ label: "Desktop recipient" });
      if (!capturedInvitation) await leader.screenshot({ path: join(output, "personal-window-invite.png") });
      await leader.getByRole("button", { name: "Send live-window invitation", exact: true }).click();
      await portal.getByRole("link", { name: "Open live window from Lab leader", exact: true }).waitFor();
      if (!capturedInvitation) {
        const notice = portal.locator(".toast").last();
        if (await notice.count()) await notice.waitFor({ state: "detached", timeout: 7000 });
        await portal.screenshot({ path: join(output, "personal-window-inbox.png") });
        capturedInvitation = true;
      }
    };
    const openReceiver = async () => {
      const opened = application.waitForEvent("window");
      await portal.getByRole("link", { name: "Open live window from Lab leader", exact: true }).click();
      receiver = await opened; watch(receiver);
      await receiver.locator("#screen-title").waitFor();
      return receiver;
    };
    const live = () => receiver.waitForFunction(() => {
      const video = document.querySelector("#screen-video");
      return video?.videoWidth === 640 && video.readyState >= 2 && document.querySelector("#screen-status").textContent === "Live";
    });
    const closeReceiver = async (button = "Close live window") => {
      const closing = receiver;
      // The click intentionally destroys its own page. Electron may report the
      // destruction before Playwright receives the click acknowledgement.
      await Promise.all([
        closing.waitForEvent("close"),
        closing.getByRole("button", { name: button, exact: true }).click().catch(error => {
          if (!closing.isClosed() || !error.message.includes("Target page, context or browser has been closed")) throw error;
        }),
      ]);
      // A crashed renderer or application is not a successful window close.
      assert.equal(portal.isClosed(), false);
      assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
      await portal.getByText("Live", { exact: true }).waitFor();
    };
    await sendInvitation();
    const before = await shareState();
    const stateRoute = `**/api/rooms/${roomId}/state`;
    let interruptInitialRead = true;
    await application.context().route(stateRoute, async route => {
      const frame = route.request().frame();
      if (interruptInitialRead && new URL(frame.url()).pathname.startsWith("/screen/")) {
        interruptInitialRead = false; faulting.add(frame.page()); await route.abort("failed");
      } else await route.continue();
    });
    await openReceiver();
    await receiver.getByRole("button", { name: "Reconnect now", exact: true }).waitFor();
    await contrast(receiver, "initial-offline", ["#screen-title", "#screen-owner", "#screen-status", "#screen-message", "#screen-description", "#screen-retry", "#screen-error"]);
    await receiver.screenshot({ path: join(output, "personal-window-initial-offline.png") });
    await receiver.getByRole("button", { name: "Reconnect now", exact: true }).click();
    await receiver.getByRole("button", { name: "Accept live window", exact: true }).waitFor();
    faulting.delete(receiver);
    await application.context().unroute(stateRoute);
    check("an interrupted initial receiver snapshot offers explicit reconnect and retains the pending invitation");
    assert.equal(await receiver.evaluate(() => qaPeers.length === 0 && !document.querySelector("video").srcObject), true);
    const native = await application.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows(), received = windows.find(window => new URL(window.webContents.getURL()).pathname.startsWith("/screen/"));
      return { count: windows.length, minimum: received.getMinimumSize(), resizable: received.isResizable(), sandbox: received.webContents.getLastWebPreferences().sandbox };
    });
    assert.equal(native.count, 2); assert.equal(native.minimum[1], 280); assert.equal(native.resizable, true); assert.equal(native.sandbox, true);
    await leader.getByRole("button", { name: "Room settings", exact: true }).click();
    for (const theme of ["studio", "executive", "synth", "command", "classroom"]) {
      await leader.locator(`[data-action="theme"][data-theme="${theme}"]`).click();
      await receiver.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      await contrast(receiver, theme, ["#screen-title", "#screen-owner", "#screen-status", "#screen-message", "#screen-description", "#screen-accept", "#screen-decline"]);
    }
    await leader.getByRole("button", { name: "Close Room settings window", exact: true }).click();
    assert.equal(await receiver.evaluate(() => qaPeers.length === 0 && !document.querySelector("video").srcObject), true);
    await receiver.screenshot({ path: join(output, "personal-window-consent.png") });
    await receiver.getByRole("button", { name: "Accept live window", exact: true }).click();
    await live();
    await contrast(receiver, "classroom-live", ["#screen-title", "#screen-owner", "#screen-status", "#screen-stop", "#screen-room"]);
    await receiver.evaluate(() => { window.qaReceivedVideo = document.querySelector("video"); window.qaReceivedMedia = qaReceivedVideo.srcObject; });
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(window => new URL(window.webContents.getURL()).pathname.startsWith("/screen/"));
      window.setPosition(40, 70); window.setContentSize(800, 500);
    });
    await receiver.waitForFunction(() => innerWidth === 800 && innerHeight === 500);
    assert.equal(await receiver.evaluate(() => qaReceivedVideo === document.querySelector("video") && qaReceivedMedia === qaReceivedVideo.srcObject), true);
    const after = await shareState();
    for (const key of ["x", "y", "w", "h", "version"]) assert.equal(after[key], before[key]);
    await receiver.screenshot({ path: join(output, "personal-window-live.png") });
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => new URL(window.webContents.getURL()).pathname.startsWith("/screen/")).setContentSize(390, 560));
    await receiver.waitForFunction(() => innerWidth === 390);
    assert.equal(await receiver.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await receiver.screenshot({ path: join(output, "personal-window-390.png") });
    check("owner invitation and recipient acceptance deliver real video in an independent resizable native window; no media before consent");

    const connection = await receiver.evaluate(() => qaSockets.at(-1).qaConnectionId);
    const peerCount = await receiver.evaluate(() => qaPeers.length);
    await receiver.evaluate(() => qaPeers.filter(peer => peer.connectionState === "connected").forEach(peer => peer.close()));
    await receiver.getByRole("button", { name: "Retry video", exact: true }).click();
    await live();
    assert.equal(await receiver.evaluate(previous => qaPeers.length > previous, peerCount), true);
    assert.equal(await receiver.evaluate(() => qaSockets.at(-1).qaConnectionId), connection);
    assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
    check("explicit receiver retry replaces a closed media peer without reconnecting the room or restarting capture");

    const previousSocket = await receiver.evaluate(() => qaSockets.at(-1).qaConnectionId);
    await receiver.evaluate(() => qaSockets.at(-1).close());
    await receiver.getByRole("button", { name: "Reconnect now", exact: true }).click();
    await receiver.waitForFunction(previous => qaSockets.at(-1).qaConnectionId && qaSockets.at(-1).qaConnectionId !== previous, previousSocket);
    await live();
    assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
    check("personal receiver socket reconnect refreshes access and restores the active share under its accepted invitation");

    await leader.getByRole("button", { name: /^Invite a viewer to / }).click();
    await leader.getByRole("button", { name: "Revoke live window from Desktop recipient", exact: true }).click();
    await receiver.getByRole("heading", { name: "Access to this live window is unavailable.", exact: true }).waitFor();
    assert.equal(await receiver.evaluate(() => !document.querySelector("video").srcObject && qaPeers.every(peer => peer.connectionState === "closed")), true);
    await receiver.screenshot({ path: join(output, "personal-window-revoked.png") });
    assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
    await wall.waitForFunction(() => document.querySelector(".stream-item video")?.videoWidth === 640);
    await closeReceiver();
    check("source revocation clears recipient video and peers while the room display and capture stay live");

    await sendInvitation(); await openReceiver();
    await receiver.getByRole("button", { name: "Accept live window", exact: true }).click(); await live();
    await closeReceiver();
    assert.equal((await shareState()).id, before.id);
    assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
    await leader.waitForFunction(id => qaPeers.filter(peer => peer.remoteDeviceId === id).every(peer => peer.connectionState === "closed"), recipientId);
    await openReceiver(); await live();
    await closeReceiver("Stop receiving");
    await portal.getByRole("link", { name: "Open live window from Lab leader", exact: true }).waitFor({ state: "detached" });
    assert.equal(await leader.evaluate(() => qaCapture.getVideoTracks()[0].readyState), "live");
    check("closing a receiver preserves capture and accepted access; Stop receiving removes that recipient's grant");

    await sendInvitation(); await openReceiver();
    await receiver.getByRole("button", { name: "Accept live window", exact: true }).click(); await live();
    await leader.getByRole("button", { name: "Stop sharing your screen", exact: true }).click();
    await receiver.getByRole("heading", { name: "This live window has closed.", exact: true }).waitFor();
    assert.equal(await receiver.evaluate(() => !document.querySelector("video").srcObject), true);
    await leader.getByRole("button", { name: "Share your screen", exact: true }).click();
    await wall.waitForFunction(() => document.querySelector(".stream-item video")?.videoWidth === 640);
    assert.notEqual((await shareState()).id, before.id);
    assert.equal(await receiver.evaluate(() => !document.querySelector("video").srcObject), true);
    await closeReceiver();
    check("ending capture removes personal media; a new share cannot reuse the old invitation");
    const quit = application.waitForEvent("close");
    await application.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); }); await quit; application = null;
  } catch (error) {
    if (receiver && !receiver.isClosed()) {
      await receiver.screenshot({ path: join(output, "personal-window-failure.png") }).catch(() => {});
      const diagnostics = await receiver.evaluate(() => ({ text: document.body.innerText, signals: window.qaSignals,
        peers: window.qaPeers?.map(peer => ({ connection: peer.connectionState, ice: peer.iceConnectionState, candidates: peer.qaCandidateInputs })) })).catch(() => ({}));
      await writeFile(join(output, "personal-window-failure.json"), JSON.stringify(diagnostics, null, 2));
    }
    throw error;
  } finally {
    await application?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
