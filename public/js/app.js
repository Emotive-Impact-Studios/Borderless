import {
  esc,
  icon,
  button,
  toast,
  modal,
  closeModal,
  empty,
  bytes,
  downloadBlob,
  timeLabel,
  preserveFocus,
} from "./ui.js";
import { RoomClient, createRoom } from "./client.js";
import { Board } from "./board.js";
import { ScreenSharing } from "./rtc.js";
import { UtilityWindows } from "./windows.js";
import { liveWindowsHTML, liveWindowAction, updateLiveWindowNotifications } from "./live-windows.js";

const app = document.querySelector("#app"),
  dialog = document.querySelector("#modal"),
  fileInput = document.querySelector("#file-input");
let client,
  board,
  sharing,
  utilityWindows,
  state,
  view = "room",
  tool = "select",
  status = "connecting",
  transferBusy = false,
  selectedFile = null,
  pointerActive = false,
  lastPointerAt = 0;
let inviteData,
  inviteRevision = "",
  activity = [],
  activeItem,
  zoom = 1;
const route = location.pathname.split("/").filter(Boolean);
const roomId = route[1];
const themeNames = {
  studio: "Studio",
  classroom: "Whiteboard",
  executive: "Executive",
  synth: "After hours",
  command: "Command",
};
const displayName = (mode) =>
  ({
    studio: "Creative studio",
    meeting: "Meeting room",
    classroom: "Classroom",
  })[mode] || "Shared room";
const brand = `<a class="brand" href="/" aria-label="Borderless home"><span class="brand-mark">b.</span><span>borderless<span class="brand-period">®</span></span></a>`;
const arrows = () => `<span class="micro-arrow">${icon("arrow", 16)}</span>`;

function recentRooms() {
  try {
    return JSON.parse(localStorage.getItem("borderless.recent") || "[]").slice(
      0,
      4,
    );
  } catch {
    return [];
  }
}
function rememberRoom(s) {
  try {
    localStorage.setItem(
      "borderless.recent",
      JSON.stringify(
        [
          { id: s.id, name: s.name, mode: s.mode },
          ...recentRooms().filter((r) => r.id !== s.id),
        ].slice(0, 4),
      ),
    );
  } catch {
    /* Private browsing can disable storage. */
  }
}
function home() {
  const recent = recentRooms();
  app.innerHTML = `<div class="lobby"><header class="lobby-header">${brand}<span class="header-note">A little closer, by design.</span><span class="local-badge">${icon("wifi", 15)} Made for the same room</span></header>
    <main class="lobby-main"><section class="lobby-story"><div class="eyebrow"><span class="small-line"></span>Every screen. One shared space.</div><h1>Good ideas<br>have <em>no borders.</em></h1><p class="lobby-intro">Bring your files, your screen and your perspective.<br>A canvas for everyone in the room.</p>
      <div class="lobby-illustration" aria-hidden="true"><div class="illustration-grid"></div><div class="illustration-wall"><span class="tiny-label">THE SHARED CANVAS</span><div class="illus-note"><span>What if we…</span><i></i><i></i></div><div class="illus-image"><div class="illus-sun"></div><div class="illus-hill"></div></div><div class="illus-cursor">${icon("pointer", 18)}<span>Everyone belongs.</span></div></div><div class="illustration-phone">${icon("up", 22)}<div></div></div><div class="illustration-laptop"><div>${icon("file", 24)}</div></div><span class="illustration-trail"></span><div class="floating-label">Make the leap. ${icon("spark", 16)}</div></div>
      <div class="lobby-points"><span>${icon("check", 16)} iPhone, Android, Mac & PC</span><span>${icon("check", 16)} Your data stays on your hub</span><span>${icon("check", 16)} No participant accounts</span></div>
    </section><section class="room-create"><div class="eyebrow">Start something together</div><h2>Make room.</h2><p>Open a canvas. Invite your people. See what happens.</p>
      <form id="create-form"><label>Give your room a name<input name="name" maxlength="80" placeholder="The idea room" required autocomplete="off"></label><fieldset class="room-types"><legend>What’s the occasion?</legend>
      <label><input type="radio" name="mode" value="studio" checked><span>${icon("spark")}<strong>Studio</strong><small>Create & collaborate</small></span></label><label><input type="radio" name="mode" value="meeting"><span>${icon("people")}<strong>Meeting</strong><small>Bring ideas together</small></span></label><label><input type="radio" name="mode" value="classroom"><span>${icon("pen")}<strong>Classroom</strong><small>Teach & participate</small></span></label></fieldset>
      <div class="form-two"><label>Your name<input name="adminName" maxlength="40" autocomplete="given-name" placeholder="Room leader" required></label><label>Leader password<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" placeholder="10+ characters" required></label></div>
      <button type="submit" class="btn primary full">Create your room ${icon("arrow", 18)}</button><p class="form-hint">You’ll control the canvas and who can contribute. Keep your leader password to return later.</p></form>
      <div class="join-existing"><span>Already have an invitation?</span><p>Open the room’s link or scan its QR code on the display.</p></div></section></main>
    ${recent.length ? `<section class="recent"><div class="eyebrow">Pick up where you left off</div><div class="recent-grid">${recent.map((r) => `<a href="/room/${esc(r.id)}"><span class="recent-icon">${icon("wall")}</span><div><strong>${esc(r.name)}</strong><small>${esc(displayName(r.mode))}</small></div>${arrows()}</a>`).join("")}</div></section>` : ""}
    <footer class="lobby-footer"><span>Less passing cables. More passing ideas.</span><span>Borderless · 0.1.0</span></footer></div>`;
}

async function joinPage({ login = false, expired = false } = {}) {
  let info;
  try {
    info = await new RoomClient(roomId).api("info");
  } catch (error) {
    errorPage(error.message);
    return;
  }
  if (info.ended) {
    errorPage(
      "This session has ended. Ask the leader for a new room invitation.",
    );
    return;
  }
  const code = new URLSearchParams(location.hash.slice(1)).get("code") || "";
  app.innerHTML = `<div class="join-page"><header>${brand}</header><main class="join-card"><div class="join-symbol">${icon(login ? "lock" : "spark", 32)}</div><div class="eyebrow">${esc(displayName(info.mode))}</div><h1>${login ? "Welcome back." : "You’re in good company."}</h1><p>${login ? "Enter your leader password to manage" : "You’re joining"} <strong>${esc(info.name)}</strong>.</p>${expired ? '<div class="inline-notice">Your previous session has expired. Join again to continue.</div>' : ""}<form id="${login ? "login-form" : "join-form"}"><label>Your name<input name="name" maxlength="40" autocomplete="given-name" placeholder="What should we call you?" required></label>${login ? '<label>Leader password<input type="password" name="password" autocomplete="current-password" required></label>' : `<label>Room code<input name="code" class="room-code-input" value="${esc(code)}" placeholder="ABC234" minlength="6" maxlength="12" autocomplete="off" required></label><label>Where are you in the room?<select name="seat"><option value="centre">In the middle</option><option value="left">To the left</option><option value="right">To the right</option></select></label>`}<button class="btn primary full" type="submit">${login ? "Open the console" : "Join the room"} ${icon("arrow", 18)}</button></form><button class="text-btn join-switch" data-action="${login ? "join.participant" : "join.leader"}">${login ? "Joining as a participant?" : "Are you the room leader?"}</button><p class="join-privacy">${icon("lock", 13)} A private connection to this room’s hub.</p></main><footer>One room. Every perspective.</footer></div>`;
}
function errorPage(message) {
  app.innerHTML = `<div class="join-page"><header>${brand}</header><main class="join-card">${empty("info", "Let’s reconnect.", message)}<a class="btn primary full" href="/">Back to Borderless ${icon("arrow", 18)}</a></main></div>`;
}

function roomShell() {
  const admin = state.me.role === "admin",
    display = view === "wall";
  app.innerHTML = `<div class="workspace spatial-workspace ${display ? "display-mode" : ""}">
    <main class="room-surface"><div class="canvas-stage" id="canvas-stage" aria-label="Shared room canvas" tabindex="0"></div></main>
    <header class="room-hud" ${display ? "hidden" : ""}>
      <div class="room-identity"><a href="/" class="room-home" aria-label="Borderless home">b.</a><button class="room-menu-button" data-action="panel.room" aria-label="Room menu" aria-expanded="false"><h1>${esc(state.name)}</h1>${icon("chevron", 14)}</button><span class="room-status" id="room-status">Connecting</span></div>
      <nav class="room-actions" aria-label="Room controls">${button("panel.people", "People", "people", "small", 'aria-expanded="false"')}${admin ? button("invite.open", "Invite people", "plus", "small") + button("panel.settings", "Room settings", "settings", "icon-only small", 'aria-label="Room settings" aria-expanded="false"') : ""}${button("ui.toggle", "Hide controls", "eye", "icon-only small", 'aria-label="Hide controls"')}</nav>
    </header>
    <div class="utility-layer" ${display ? "hidden" : ""}></div><p id="utility-keyboard-help" class="sr-only">Use arrow keys on a window title to move it. Use arrow keys on its resize button to change its size. Hold Shift for larger steps.</p>
    <div class="scene-status" ${display ? "hidden" : ""}><span id="canvas-item-count">0 contributions</span><span id="theme-label">Studio</span><span id="local-status">Stored on this hub</span></div>
    <div class="scene-view" ${display ? "hidden" : ""}><span class="zoom-controls"><button data-action="zoom.out" aria-label="Zoom out">${icon("minus", 15)}</button><span id="zoom-value">100%</span><button data-action="zoom.in" aria-label="Zoom in">${icon("plus", 15)}</button><button data-action="zoom.fit" aria-label="Fit canvas">${icon("expand", 15)}</button></span><button class="icon-btn" data-action="fullscreen" aria-label="Full screen">${icon("expand", 18)}</button></div>
    <span id="room-type" hidden>${esc(displayName(state.mode))}</span><span id="room-footer-title" hidden></span><div id="avatar-stack" hidden></div>
    <div class="floating-toolbar" role="toolbar" aria-label="Canvas tools"><button data-action="tool.select" class="active" title="Select & move" aria-label="Select & move">${icon("pointer", 20)}</button><button data-action="tool.pen" title="Draw on the canvas" aria-label="Draw on the canvas">${icon("pen", 20)}</button><button data-action="tool.pointer" title="Laser pointer" aria-label="Laser pointer">${icon("circle", 20)}</button><button data-action="ink.undo" title="Undo your last stroke" aria-label="Undo your last stroke">${icon("undo", 20)}</button><span class="tool-divider"></span><button data-action="note.add" title="Add a thought" aria-label="Add a thought">${icon("note", 20)}</button><button data-action="upload" title="Send a file" aria-label="Send a file">${icon("upload", 20)}</button><button data-action="screen.toggle" title="Share your screen" aria-label="Share your screen">${icon("screen", 20)}</button>${admin ? `<button data-action="layout.grid" title="Arrange windows" aria-label="Tidy up">${icon("grid", 20)}</button>` : ""}</div>
    <button class="show-controls icon-btn" data-action="ui.toggle" aria-label="Show controls" hidden>${icon("eye", 20)}</button>
    <div class="connection-banner" id="connection-banner" hidden role="alert"></div>
    ${display ? `<div class="wall-invite" id="wall-invite"></div><button class="wall-fullscreen icon-btn" data-action="fullscreen" aria-label="Full screen">${icon("expand", 24)}</button>` : ""}</div>`;
  board = new Board(document.querySelector("#canvas-stage"), client, {
    display,
    onSelect: openItem,
    onFile: sendFiles,
  });
  sharing = new ScreenSharing(
    client,
    (streamId) => document.querySelector(`[data-stream="${streamId}"] video`),
    (message) => toast(message, true),
  );
  if (!display) utilityWindows = new UtilityWindows(document.querySelector(".utility-layer"), state.id, updateWindowControls);
  updateRoom();
  if (display) loadInvite();
}

const windowTitles = { people: "People", settings: "Room settings", activity: "Activity", room: "Room" };
function updateWindowControls() {
  for (const button of document.querySelectorAll('[data-action^="panel."]')) {
    const open = utilityWindows?.isOpen(button.dataset.action.slice(6));
    button.setAttribute("aria-expanded", String(Boolean(open)));
    button.classList.toggle("selected", Boolean(open));
  }
}
function updateRoom() {
  if (!state) return;
  updateSharingControls();
  updateLiveWindowNotifications(state, view);
  document.documentElement.dataset.theme = state.theme;
  board?.update(state);
  if (view === "portal") {
    updatePortal();
    sharing?.sync(state);
    return;
  }
  const count = state.items.length + state.streams.length;
  document.querySelector("#canvas-item-count").textContent =
    `${count} contribution${count === 1 ? "" : "s"}`;
  document.querySelector("#theme-label").textContent = themeNames[state.theme];
  document.querySelector("#avatar-stack").innerHTML = state.devices
    .filter((d) => d.online && d.role !== "wall")
    .slice(0, 4)
    .map(
      (d) =>
        `<span class="avatar" title="${esc(d.name)}" style="--avatar:${d.colour}">${esc(d.name[0].toUpperCase())}</span>`,
    )
    .join("");
  document.querySelector("#room-footer-title").textContent = state.ended
    ? "This session has ended."
    : state.locked
      ? "A moment to focus."
      : count
        ? `${count} ${count === 1 ? "idea" : "ideas"}. One shared space.`
        : "Your room is taking shape.";
  const root = document.querySelector(".workspace");
  root.classList.toggle("room-locked", state.locked);
  const roomStatus = document.querySelector("#room-status");
  roomStatus.textContent = state.ended
    ? "Ended"
    : status === "revoked"
      ? "Access ended"
      : state.locked
        ? "Paused"
        : status === "online"
          ? "Live"
          : "Connecting";
  roomStatus.classList.toggle("paused", state.locked || status !== "online");
  renderPanel();
  if (view === "wall") {
    if (inviteRevision !== state.revision) {
      inviteRevision = state.revision;
      loadInvite();
    }
    renderWallQuiz();
  }
  sharing?.sync(state);
}
function updateSharingControls() {
  const active = Boolean(sharing?.local);
  for (const button of document.querySelectorAll('[data-action="screen.toggle"]')) {
    const label = active ? "Stop sharing your screen" : view === "portal" ? "Share your live screen" : "Share your screen";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.setAttribute("aria-pressed", String(active));
    button.disabled = Boolean(sharing?.starting);
    button.classList.toggle("is-sharing", active);
    if (button.closest(".floating-toolbar"))
      button.innerHTML = active ? `${icon("close", 18)}<span>Stop sharing</span>` : icon("screen", 21);
    else {
      const text = button.querySelector("span");
      if (text) text.textContent = label;
    }
  }
}
function renderPanel() {
  for (const entry of utilityWindows?.windows.values() || [])
    if (!entry.root.hidden) preserveFocus(entry.body, () => renderPanelContents(entry.body, entry.id));
}
function renderPanelContents(el, kind) {
  const admin = state.me.role === "admin";
  if (kind === "room") {
    el.innerHTML = `<p class="panel-intro">${esc(state.name)} · ${esc(displayName(state.mode))}</p><div class="room-window-actions"><a class="btn outline full" href="/wall/${state.id}" target="_blank" rel="noopener">${icon("wall")}Open wall</a><a class="btn outline full" href="/portal/${state.id}">${icon("pointer")}Open mobile portal</a>${button("my.device", "Your device", "people", "full subtle")}${admin ? button("panel.activity", "Activity", "clock", "full subtle") : ""}${button("ink.export", "Save whiteboard", "download", "full subtle")}</div><p class="form-hint">Move the windows by their title bars. Room tools open over the canvas and can be closed.</p>`;
    return;
  }
  if (kind === "settings" && admin) {
    el.innerHTML = `<p class="panel-intro">Changes apply to everyone in this room.</p><div class="setting-section"><h3>Theme</h3><div class="theme-grid">${Object.entries(
      themeNames,
    )
      .map(
        ([key, label]) =>
          `<button class="theme-option theme-${key} ${key === state.theme ? "selected" : ""}" data-action="theme" data-theme="${key}"><i></i><span>${label}</span>${key === state.theme ? icon("check", 13) : ""}</button>`,
      )
      .join(
        "",
      )}</div></div><div class="setting-section"><h3>Make an entrance</h3><div class="segmented effects-options">${["ripple", "liquid", "particles", "none"].map((effect) => `<button data-action="effect" data-effect="${effect}" class="${state.effect === effect ? "selected" : ""}">${effect[0].toUpperCase() + effect.slice(1)}</button>`).join("")}</div></div><div class="setting-section"><h3>Take it with you</h3>${button("room.export", "Export session", "download", "full outline")}${button("ink.export", "Save whiteboard as SVG", "pen", "full subtle")}${button("audit.export", "Export verified audit", "clock", "full subtle")}</div><div class="setting-section danger-zone"><h3>Room controls</h3>${button("room.lock", state.locked ? "Resume contributions" : "Pause contributions", state.locked ? "unlock" : "lock", "full outline")}${button("room.clear", "Clear the canvas", "trash", "full subtle")}${state.cleanupPending ? button("room.cleanup", `Retry ${state.cleanupPending} pending file deletions`, "return", "full outline") : ""}${button("room.purge", "Purge files & pause room", "lock", "full danger")}${button("room.end", "End this session", "close", "full danger")}</div>`;
    return;
  }
  if (kind === "activity" && admin) {
    el.innerHTML = `<div class="panel-heading"><h2>The room’s story.</h2><span>AUDIT TRAIL</span></div><p class="panel-intro">Verified events, kept on this hub.</p><div class="activity-list">${
      activity.length
        ? activity
            .slice(-25)
            .reverse()
            .map(
              (row) =>
                `<div class="activity-row"><span class="activity-dot"></span><div><strong>${esc(row.action.replaceAll(".", " "))}</strong><small>${timeLabel(row.at)}</small></div></div>`,
            )
            .join("")
        : empty(
            "clock",
            "A fresh start.",
            "Actions will appear here as the room gets going.",
          )
    }</div>${button("activity.refresh", "Refresh activity", "return", "full outline")}${button("audit.export", "Export audit", "download", "full subtle")}`;
    return;
  }
  const people = state.devices.filter((d) => d.role !== "wall"),
    online = people.filter((d) => d.online).length;
  el.innerHTML = `<div class="panel-heading"><h2>Better, together.</h2><span>${online} IN THE ROOM</span></div><p class="panel-intro">Different screens. Shared possibilities.</p><div class="people-list">${people.map((d) => `<div class="person"><span class="avatar" style="--avatar:${d.colour}">${esc(d.name[0].toUpperCase())}<i class="presence ${d.online ? "online" : ""}"></i></span><div><strong>${esc(d.name)}${d.id === state.me.id ? ' <span class="you">(you)</span>' : ""}</strong><small>${d.role === "admin" ? "Room leader" : d.online ? "Ready to contribute" : "Away from the room"}${state.permissions?.includes(d.id) ? " · Can draw" : ""}</small></div>${admin && d.id !== state.me.id ? `<button class="icon-btn person-menu" data-action="device.manage" data-id="${d.id}" title="Manage ${esc(d.name)}" aria-label="Manage ${esc(d.name)}">${icon("settings", 15)}</button>` : ""}</div>`).join("")}</div>
    ${admin ? button("invite.open", "A little more company?", "plus", "invite-quiet full") : ""}
    ${admin && state.requests?.length ? `<div class="setting-section"><div class="eyebrow">Hands up · ${state.requests.length}</div>${state.requests.map((r) => `<div class="hand-request"><span>${icon("hand", 17)} ${esc(r.name)}</span><div><button class="icon-btn" data-action="hand.approve" data-id="${r.deviceId}" aria-label="Approve ${esc(r.name)}">${icon("check", 17)}</button><button class="icon-btn" data-action="hand.deny" data-id="${r.deviceId}" aria-label="Decline ${esc(r.name)}">${icon("close", 17)}</button></div></div>`).join("")}</div>` : ""}
    <div class="panel-separator"></div><div class="eyebrow">Room tools</div><div class="tool-cards">${admin ? `<button data-action="quiz.open">${icon("quiz", 21)}<div><strong>Ask the room</strong><small>A quick question. Every voice.</small></div>${arrows()}</button>` : ""}<button data-action="pointer.open">${icon("pointer", 21)}<div><strong>Point something out</strong><small>Your phone, a little more useful.</small></div>${arrows()}</button><button data-action="ink.mode">${icon("pen", 21)}<div><strong>${state.me.canDraw ? "Think out loud. In ink." : "Raise your hand"}</strong><small>${state.me.canDraw ? "Sketch, circle and connect." : "Ask for a turn at the board."}</small></div>${arrows()}</button></div>
    ${state.quiz ? quizSummary() : ""}${inboxHTML()}${liveWindowsHTML(state)}
    <div class="panel-footnote">${icon("lock", 14)}<span>Your files stay here.<br>Shared in the room, stored on this hub.</span></div>`;
  const liveWindows = el.querySelector(".live-window-inbox");
  if (liveWindows) el.prepend(liveWindows);
}
function quizSummary() {
  const q = state.quiz;
  return `<div class="setting-section"><div class="eyebrow">${q.open ? "Live question" : "Question closed"}</div><h3>${esc(q.question)}</h3><p class="muted">${q.total} answer${q.total === 1 ? "" : "s"} received</p>${state.me.role === "admin" ? button("quiz.results", "See results", "quiz", "full outline") : button("quiz.answer.open", "View question", "quiz", "full outline")}</div>`;
}
function inboxHTML() {
  const inbox = state.deliveries.filter(
    (d) => d.targetId === state.me.id && !d.accepted,
  );
  return inbox.length
    ? `<div class="setting-section"><div class="eyebrow">Sent to you · ${inbox.length}</div>${inbox.map((d) => `<button class="inbox-item" data-action="delivery.open" data-id="${d.id}">${icon("download", 18)}<span><strong>${esc(d.name)}</strong><small>From ${esc(d.from)}</small></span>${arrows()}</button>`).join("")}</div>`
    : "";
}

function portalShell() {
  app.innerHTML = `<div class="portal"><header class="portal-header">${brand}<button class="avatar my-avatar" data-action="my.device" style="--avatar:${state.me.colour}" aria-label="Your device">${esc(state.me.name[0].toUpperCase())}</button></header><main><div class="portal-room"><div class="eyebrow">You’re part of the room</div><h1>${esc(state.name)}</h1><p><span class="live-pulse"></span><span id="portal-connection">Connecting to the canvas</span></p></div><div id="portal-quiz"></div><div class="portal-tabs" role="tablist" aria-label="Contribution tools"><button class="selected" data-action="portal.tab" data-tab="send" role="tab" aria-selected="true">${icon("upload", 17)} Send</button><button data-action="portal.tab" data-tab="point" role="tab" aria-selected="false">${icon("pointer", 17)} Point</button><button data-action="portal.tab" data-tab="draw" role="tab" aria-selected="false">${icon("pen", 17)} Draw</button></div>
    <section id="portal-send" class="portal-tab"><div class="throw-card" id="throw-card"><div class="throw-spark">${icon("up", 32)}</div><h2 id="throw-title">Something worth sharing?</h2><p id="throw-description">Pick a file, then flick it up to the room.</p><button class="btn primary" data-action="portal.pick">${icon("plus", 18)} Choose a file</button><div class="throw-cue">SWIPE UP TO SEND ${icon("up", 13)}</div></div>${button("note.add", "Or send a thought", "note", "full outline")}${button("screen.toggle", "Share your live screen", "screen", "full subtle")}<p class="form-hint">Files up to 25 MB · Images, PDFs, text, Office, audio & video<br>Screen sharing requires a supported desktop browser.</p></section>
    <section id="portal-point" class="portal-tab" hidden><h2>A little direction.</h2><p>Touch and move across the pad. Your pointer appears in the same place on the wall.</p><div class="touch-pad" id="pointer-pad"><div>${icon("pointer", 36)}<span>Touch to point</span></div></div>${button("gyro.enable", "Try motion pointer", "spark", "full outline")}<p class="form-hint" id="gyro-status">Motion control uses relative tilt. Touch control always works.</p></section>
    <section id="portal-draw" class="portal-tab" hidden><div class="portal-draw-heading"><div><h2>Leave your mark.</h2><p id="draw-permission">Checking drawing permission…</p></div>${button("ink.undo", "Undo", "undo", "small")}</div><div class="touch-pad drawing-pad" id="drawing-pad"><svg viewBox="0 0 1000 562.5" preserveAspectRatio="none"></svg><div class="draw-pad-hint">Draw here. See it there.</div></div><div id="raise-hand-action"></div>${button("ink.export", "Save whiteboard", "download", "full subtle")}</section>
    <div id="portal-inbox"></div><div class="portal-contributions"><div class="eyebrow">Your contributions</div><div id="portal-files"></div></div></main><footer>${icon("lock", 13)} In this room. On this hub.<a href="/room/${state.id}">Open canvas ${icon("arrow", 14)}</a></footer><div class="connection-banner" id="connection-banner" hidden role="alert"></div></div>`;
  const liveInbox = document.createElement("div");
  liveInbox.id = "portal-live-windows";
  document.querySelector("#portal-quiz").before(liveInbox);
  sharing = new ScreenSharing(
    client,
    () => null,
    (message) => toast(message, true),
  );
  activatePortalTab("send");
  bindPortalGestures();
  updatePortal();
}
function activatePortalTab(name, focus = false) {
  const tabs = [...document.querySelectorAll('[data-action="portal.tab"]')];
  if (!tabs.some(tab => tab.dataset.tab === name)) return;
  if (name !== "point" && pointerActive) {
    pointerActive = false;
    client.send({ type: "pointer", x: .5, y: .5, active: false });
    document.querySelector("#pointer-pad")?.classList.remove("pressed");
  }
  for (const tab of tabs) {
    const selected = tab.dataset.tab === name;
    tab.id = `portal-tab-${tab.dataset.tab}`;
    tab.setAttribute("aria-controls", `portal-${tab.dataset.tab}`);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle("selected", selected);
    const panel = document.querySelector(`#portal-${tab.dataset.tab}`);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.hidden = !selected;
    if (selected && focus) tab.focus();
  }
}
function updatePortal() {
  const portal = document.querySelector(".portal");
  if (portal) preserveFocus(portal, updatePortalContents);
}
function updatePortalContents() {
  document.querySelector("#portal-connection").textContent = state.ended
    ? "This session has ended"
    : status === "revoked"
      ? "Your access has ended"
      : state.locked
        ? "The leader has paused contributions"
        : status === "online"
          ? "Connected to the canvas"
          : "Reconnecting…";
  document.querySelector("#draw-permission").textContent = state.me.canDraw
    ? "You have the floor. Make it yours."
    : "Ask the leader for a turn at the board.";
  document.querySelector("#raise-hand-action").innerHTML = state.me.canDraw
    ? ""
    : button("hand.raise", "Raise your hand", "hand", "full primary");
  document.querySelector("#portal-inbox").innerHTML = inboxHTML();
  document.querySelector("#portal-live-windows").innerHTML = liveWindowsHTML(state);
  const own = state.items.filter((i) => i.ownerId === state.me.id);
  document.querySelector("#portal-files").innerHTML = own.length
    ? own
        .slice()
        .reverse()
        .map(
          (item) =>
            `<button class="portal-file" data-action="item.open" data-id="${item.id}">${icon(item.kind === "note" ? "note" : "file", 20)}<span><strong>${esc(item.title)}</strong><small>${item.kind === "note" ? "Thought on the canvas" : `${bytes(item.size)} · On the canvas`}</small></span>${arrows()}</button>`,
        )
        .join("")
    : empty(
        "spark",
        "Your next idea goes here.",
        "Files and thoughts you share will appear on the canvas.",
      );
  const quizEl = document.querySelector("#portal-quiz");
  if (state.quiz && state.me.role === "participant")
    quizEl.innerHTML = quizContent(state.quiz, true);
  else quizEl.innerHTML = "";
  const svg = document.querySelector("#drawing-pad svg");
  svg.innerHTML = state.strokes
    .map(
      (s) =>
        `<polyline points="${s.points.map((p) => `${p[0] * 1000},${p[1] * 562.5}`).join(" ")}" fill="none" stroke="${s.colour}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  document
    .querySelector("#drawing-pad")
    .classList.toggle("draw-disabled", !state.me.canDraw);
}
function bindPortalGestures() {
  let start;
  const card = document.querySelector("#throw-card");
  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button") || !selectedFile) return;
    if (start || !event.isPrimary) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId, at: performance.now() };
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener("pointermove", (event) => {
    if (start)
      card.style.transform = `translateY(${Math.min(0, event.clientY - start.y) * 0.35}px)`;
  });
  card.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.id) return;
    const sideways = Math.abs(event.clientX - start.x);
    const distance = start.y - event.clientY,
      velocity = distance / (performance.now() - start.at);
    start = null;
    card.style.transform = "";
    if (distance > 55 && distance > sideways && velocity > 0.25) {
      const bounds = card.getBoundingClientRect();
      sendSelectedFile(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)));
    }
  });
  card.addEventListener("pointercancel", () => {
    start = null;
    card.style.transform = "";
  });
  const pointer = document.querySelector("#pointer-pad");
  const coordinates = (el, event) => {
    const r = el.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    ];
  };
  const sendPointer = (event, active) => {
    const [x, y] = coordinates(pointer, event);
    client.send({ type: "pointer", x, y, active });
  };
  pointer.addEventListener("pointerdown", (event) => {
    pointerActive = true;
    pointer.setPointerCapture(event.pointerId);
    pointer.classList.add("pressed");
    sendPointer(event, true);
  });
  pointer.addEventListener("pointermove", (event) => {
    if (pointerActive && performance.now() - lastPointerAt > 25) {
      sendPointer(event, true);
      lastPointerAt = performance.now();
    }
  });
  for (const name of ["pointerup", "pointercancel"])
    pointer.addEventListener(name, (event) => {
      pointerActive = false;
      pointer.classList.remove("pressed");
      sendPointer(event, false);
    });
  const pad = document.querySelector("#drawing-pad");
  let points;
  pad.addEventListener("pointerdown", (event) => {
    if (!state.me.canDraw) return;
    points = [coordinates(pad, event)];
    pad.setPointerCapture(event.pointerId);
    pad.classList.add("pressed");
  });
  pad.addEventListener("pointermove", (event) => {
    if (!points) return;
    const point = coordinates(pad, event);
    if (
      Math.hypot(point[0] - points.at(-1)[0], point[1] - points.at(-1)[1]) <
      0.002
    )
      return;
    points.push(point);
    if (points.length > 250) points = points.filter((_, i) => i % 2 === 0);
    let preview = pad.querySelector(".local-stroke");
    if (!preview) {
      preview = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      preview.classList.add("local-stroke");
      preview.setAttribute("fill", "none");
      preview.setAttribute("stroke", state.me.colour);
      preview.setAttribute("stroke-width", "3");
      pad.querySelector("svg").append(preview);
    }
    preview.setAttribute(
      "points",
      points.map((p) => `${p[0] * 1000},${p[1] * 562.5}`).join(" "),
    );
  });
  pad.addEventListener("pointerup", async () => {
    if (!points) return;
    const complete = points;
    points = null;
    pad.classList.remove("pressed");
    pad.querySelector(".local-stroke")?.remove();
    if (complete.length > 1)
      await run("stroke.add", { points: complete, width: 3 });
  });
  pad.addEventListener("pointercancel", () => {
    points = null;
    pad.classList.remove("pressed");
    pad.querySelector(".local-stroke")?.remove();
  });
}
function quizContent(q, compact = false) {
  const answered = q.myAnswer !== null && q.myAnswer !== undefined;
  return `<div class="quiz-card ${compact ? "compact" : ""}"><div class="eyebrow">${q.open ? "A question for the room" : "The room has spoken"}</div><h2>${esc(q.question)}</h2><div class="quiz-options">${q.options.map((option, index) => `<button data-action="quiz.answer" data-answer="${index}" class="quiz-option ${q.myAnswer === index ? "chosen" : ""} ${!q.open && q.correct === index ? "correct" : ""}" ${!q.open || answered || state.me.role !== "participant" ? "disabled" : ""}><span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${esc(option)}</span>${!q.open ? `<strong>${q.counts?.[index] || 0}</strong>` : ""}${q.myAnswer === index ? icon("check", 17) : ""}</button>`).join("")}</div><p class="form-hint">${q.open ? (answered ? "Your answer is in. The results appear when the leader closes the question." : "Choose one answer. You can submit once.") : `${q.total} answer${q.total === 1 ? "" : "s"} · Correct answer: ${String.fromCharCode(65 + q.correct)}`}</p></div>`;
}
function renderWallQuiz() {
  let el = document.querySelector(".wall-quiz");
  if (!state.quiz) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.className = "wall-quiz";
    document.querySelector(".workspace").append(el);
  }
  const q = state.quiz;
  el.innerHTML = `<div class="eyebrow">${q.open ? "A question for everyone" : "The room has spoken"}</div><h2>${esc(q.question)}</h2><div class="wall-quiz-options">${q.options.map((option, i) => `<div class="${!q.open && q.correct === i ? "correct" : ""}"><span>${String.fromCharCode(65 + i)}</span><strong>${esc(option)}</strong>${!q.open ? `<b>${q.counts[i]}</b>` : ""}</div>`).join("")}</div><p>${q.total} answer${q.total === 1 ? "" : "s"} received${q.open ? " · Answer on your device" : ""}</p>`;
}

async function loadInvite() {
  if (!["admin", "wall"].includes(state?.me.role)) return;
  try {
    inviteData = await client.api("invite");
    const el = document.querySelector("#wall-invite");
    if (el)
      el.innerHTML = `<img src="${inviteData.qr}" alt="Scan to join this room"><div><span>Join the room</span><strong>${inviteData.code}</strong><small>Scan. Share. Belong.</small></div>`;
  } catch (error) {
    toast(error.message, true);
  }
}
async function inviteModal() {
  await loadInvite();
  if (!inviteData) return;
  modal(
    "Good company is one scan away.",
    `<p class="modal-intro">Open Borderless on the same network, then share this invitation with the room.</p><div class="invite-card"><img src="${inviteData.qr}" alt="Room invitation QR code"><div><div class="eyebrow">Room code</div><strong class="invitation-code">${inviteData.code}</strong><p>${esc(state.name)}</p></div></div><label>Invitation link<div class="copy-field"><input id="invite-url" value="${esc(inviteData.url)}" readonly><button class="btn primary" data-action="invite.copy">Copy</button></div></label><div class="inline-notice">Phones need to reach this hub over your local network. Use the host’s LAN address with a trusted HTTPS certificate. A localhost link works only on this computer.</div><div class="modal-actions">${button("invite.rotate", "New room code", "return", "subtle")}${button("display.pair", "Pair a separate display", "wall", "outline")}</div>`,
  );
}
function openItem(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  activeItem = item;
  const own = item.ownerId === state.me.id || state.me.role === "admin";
  let content = "";
  if (item.kind === "note")
    content = `<div class="note-detail">${esc(item.text)}</div>`;
  else if (item.mime.startsWith("image/"))
    content = `<img class="file-detail-image" src="${client.assetURL(item.assetId)}" alt="${esc(item.title)}">`;
  else if (item.mime === "application/pdf")
    content = `<iframe class="file-detail-frame" src="${client.assetURL(item.assetId)}" title="${esc(item.title)}" sandbox="allow-same-origin"></iframe><p class="form-hint">If this browser cannot display the PDF, use Download.</p>`;
  else if (item.mime === "text/plain")
    content =
      '<pre class="file-detail-text" id="text-preview">Loading preview…</pre>';
  else if (item.mime.startsWith("video/"))
    content = `<video class="file-detail-media" src="${client.assetURL(item.assetId)}" controls playsinline></video>`;
  else if (item.mime.startsWith("audio/"))
    content = `<audio class="file-detail-media" src="${client.assetURL(item.assetId)}" controls></audio>`;
  else
    content = empty(
      "file",
      "Ready for a closer look.",
      "Download this document to open it in its own application. Office documents are not converted or executed on the hub.",
    );
  modal(
    item.title,
    `${content}<div class="file-meta"><span><i class="owner-dot" style="background:${item.colour}"></i> ${esc(item.ownerName)}</span>${item.kind === "file" ? `<span>${bytes(item.size)} · SHA-256 verified</span>` : ""}</div><div class="modal-actions wrap">${item.kind === "file" ? `<a class="btn primary" href="${client.assetURL(item.assetId, true)}" download>${icon("download", 18)}Download</a>${own ? button("delivery.compose", "Send to a device", "return", "outline") : ""}${window.borderless && own ? button("native.open", "Open on this computer", "file", "outline") : ""}` : own ? button("note.edit", "Edit thought", "pen", "outline") : ""}${own ? button("item.remove", "Remove from canvas", "trash", "danger") : ""}</div>`,
    true,
  );
  if (item.mime === "text/plain")
    fetch(client.assetURL(item.assetId))
      .then((r) => {
        if (!r.ok) throw new Error("Could not load the file.");
        return r.text();
      })
      .then((t) => {
        const el = document.querySelector("#text-preview");
        if (el)
          el.textContent =
            t.slice(0, 100000) +
            (t.length > 100000
              ? "\n\n[Preview limited to 100,000 characters]"
              : "");
      })
      .catch((error) => toast(error.message, true));
}
function noteModal(edit = false) {
  const item = edit ? activeItem : null;
  modal(
    edit ? "A thought, refined." : "Put a thought into the room.",
    `<form id="${edit ? "note-edit-form" : "note-form"}"><label>A little title<input name="title" maxlength="120" value="${esc(item?.title || "")}" placeholder="What if we…" required></label><label>Your thought<textarea name="text" rows="6" maxlength="4000" placeholder="The start of something good." required>${esc(item?.text || "")}</textarea></label><button class="btn primary full" type="submit">${edit ? "Save changes" : "Add to the canvas"} ${icon("arrow", 17)}</button></form>`,
  );
}
function quizModal() {
  modal(
    "Ask the room.",
    `<p class="modal-intro">One question. A chance for everyone to take part. Results are revealed when you close the question.</p><form id="quiz-form"><label>Your question<textarea name="question" rows="2" maxlength="500" placeholder="What do you think?" required></textarea></label><div class="quiz-composer">${["A", "B", "C", "D"].map((letter, i) => `<label><span class="option-letter">${letter}</span><input name="option${i}" maxlength="200" placeholder="Option ${letter}${i > 1 ? " (optional)" : ""}" ${i < 2 ? "required" : ""}><input type="radio" name="correct" value="${i}" ${i === 0 ? "checked" : ""} aria-label="${letter} is the correct answer"></label>`).join("")}</div><p class="form-hint">Select the circle beside the correct answer. Only you can see it until the question closes.</p><button type="submit" class="btn primary full">Ask everyone ${icon("arrow", 18)}</button></form>`,
  );
}
function quizResults() {
  const q = state.quiz;
  if (!q) return;
  modal(
    q.open ? "The room is thinking." : "Every answer counts.",
    `<h3>${esc(q.question)}</h3><div class="result-bars">${q.options.map((option, i) => `<div><div><span>${esc(option)}</span><strong>${q.counts?.[i] || 0}</strong></div><div class="result-track"><i style="width:${q.total ? ((q.counts?.[i] || 0) / q.total) * 100 : 0}%"></i></div></div>`).join("")}</div><p class="form-hint">${q.total} answers · Correct answer: ${String.fromCharCode(65 + q.correct)}</p><div class="modal-actions">${q.open ? button("quiz.close", "Close & reveal answers", "check", "primary") : button("quiz.dismiss", "Dismiss question", "close", "outline")}</div>`,
  );
}
async function sendFiles(files, aim) {
  if (!files.length) return;
  if (transferBusy) {
    toast("Let this transfer finish before starting another.");
    return;
  }
  if (state.locked && state.me.role !== "admin") {
    toast("The leader has paused contributions.", true);
    return;
  }
  if (files.length > 10) {
    toast("Send up to 10 files at a time.", true);
    return;
  }
  transferBusy = true;
  let completed = false;
  try {
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024)
        throw new Error(`${file.name} is larger than the 25 MB limit.`);
      const label =
        document.querySelector("#throw-description") ||
        document.querySelector("#local-status");
      if (label) label.textContent = `Sending ${file.name}…`;
      await client.upload(file, (progress) => {
        if (label)
          label.textContent = `Sending ${file.name} · ${Math.round(progress * 100)}%`;
      }, aim);
      toast(`${file.name} is on the canvas.`);
    }
    completed = true;
  } catch (error) {
    toast(error.message, true);
  } finally {
    transferBusy = false;
    if (completed || !selectedFile) {
      selectedFile = null;
      fileInput.value = "";
      resetThrowCard();
    } else {
      const description = document.querySelector("#throw-description");
      if (description) description.textContent = "Ready to try again.";
    }
    const el = document.querySelector("#local-status");
    if (el) el.textContent = "Stored on this hub";
  }
}
function resetThrowCard() {
  const title = document.querySelector("#throw-title"),
    description = document.querySelector("#throw-description");
  if (title) title.textContent = "Something worth sharing?";
  if (description)
    description.textContent = "Pick a file, then flick it up to the room.";
  const send = document.querySelector('[data-action="portal.send"]');
  send?.remove();
}
async function sendSelectedFile(aim) {
  if (selectedFile) await sendFiles([selectedFile], aim);
}
async function run(type, data = {}) {
  try {
    return await client.command(type, data);
  } catch (error) {
    toast(error.message, true);
    return false;
  }
}
function confirmAction(title, description, action, label = "Continue") {
  modal(
    title,
    `<p class="modal-intro">${esc(description)}</p><div class="modal-actions">${button("modal.close", "Cancel", null, "outline")}${button(action, label, null, "danger primary")}</div>`,
  );
}
async function exportWhiteboard() {
  const paths = state.strokes
    .map(
      (s) =>
        `<polyline points="${s.points.map((p) => `${p[0] * 1920},${p[1] * 1080}`).join(" ")}" stroke="${s.colour}" stroke-width="${s.width * 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  downloadBlob(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="white"/>${paths}</svg>`,
    `borderless-${state.id}-whiteboard.svg`,
    "image/svg+xml",
  );
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "modal.close") {
    closeModal();
    return;
  }
  if (action === "join.leader") {
    await joinPage({ login: true });
    return;
  }
  if (action === "join.participant") {
    await joinPage();
    return;
  }
  if (!state) return;
  try {
    if (action.startsWith("panel.")) {
      const kind = action.split(".")[1];
      if (!utilityWindows || !windowTitles[kind]) return;
      if (["settings", "activity"].includes(kind) && state.me.role !== "admin") return;
      if (kind === "activity" && !utilityWindows.isOpen(kind)) {
        activity = (await client.api("audit")).events;
      }
      utilityWindows.open(kind, windowTitles[kind], renderPanelContents, target);
      return;
    }
    if (action === "ui.toggle") {
      const root = document.querySelector(".spatial-workspace");
      const hidden = root.classList.toggle("controls-hidden");
      document.querySelector(".show-controls").hidden = !hidden;
      document.querySelector(hidden ? "#canvas-stage" : '[data-action="ui.toggle"]')?.focus({ preventScroll: true });
      return;
    }
    if (action === "invite.open") return await inviteModal();
    if (action === "invite.copy") {
      try {
        await navigator.clipboard.writeText(inviteData.url);
        toast("Invitation copied.");
      } catch {
        document.querySelector("#invite-url")?.select();
        toast("Select and copy the invitation link.");
      }
      return;
    }
    if (action === "invite.rotate") {
      await client.command("invite.rotate");
      await inviteModal();
      return;
    }
    if (action === "display.pair") {
      const result = await client.api("pair", { method: "POST", body: {} });
      modal(
        "Give the room a bigger view.",
        `<p class="modal-intro">Open this one-use link on the display’s browser. It grants display access without giving away leader controls.</p><label>Display pairing link<textarea rows="3" readonly>${esc(result.url)}</textarea></label><p class="form-hint">The link works once. Creating another pairing link replaces this one.</p>`,
      );
      return;
    }
    if (action === "fullscreen") {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      return;
    }
    if (action === "upload") {
      fileInput.dataset.intent = "send";
      fileInput.click();
      return;
    }
    if (action === "portal.pick") {
      fileInput.dataset.intent = "pick";
      fileInput.multiple = false;
      fileInput.click();
      return;
    }
    if (action === "portal.send") return await sendSelectedFile();
    if (action === "note.add") {
      noteModal();
      return;
    }
    if (action === "note.edit") {
      noteModal(true);
      return;
    }
    if (action === "item.open") {
      openItem(target.dataset.id);
      return;
    }
    if (action === "item.remove") {
      await client.command("item.remove", {
        itemId: activeItem.id,
        version: activeItem.version,
      });
      closeModal();
      return;
    }
    if (action === "layout.grid") {
      await client.command("room.layout", { layout: "grid" });
      toast("A little room for everything.");
      return;
    }
    if (action.startsWith("tool.")) {
      const next = action.split(".")[1];
      if (next === "pen" && !state.me.canDraw) {
        await client.command("hand.raise");
        toast("Hand raised. The leader will let you know.");
        return;
      }
      tool = next;
      board?.setMode(tool);
      document
        .querySelectorAll(".floating-toolbar button")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.action === action),
        );
      return;
    }
    if (action === "ink.mode") {
      if (!state.me.canDraw) {
        await client.command("hand.raise");
        toast("Your hand is up.");
      } else if (view === "portal") {
        document.querySelector('[data-tab="draw"]').click();
      } else document.querySelector('[data-action="tool.pen"]').click();
      return;
    }
    if (action === "ink.undo") return await client.command("stroke.undo");
    if (action === "ink.export") return await exportWhiteboard();
    if (action === "theme")
      return await client.command("room.theme", {
        theme: target.dataset.theme,
      });
    if (action === "effect")
      return await client.command("room.effect", {
        effect: target.dataset.effect,
      });
    if (action === "room.lock")
      return await client.command("room.lock", { locked: !state.locked });
    if (["room.clear", "room.purge", "room.end"].includes(action)) {
      const details =
        action === "room.clear"
          ? [
              "A fresh canvas?",
              "This removes contributions, ink, live screens and the active quiz from the wall. Files remain on the hub until you purge them.",
              "Clear canvas",
            ]
          : action === "room.purge"
            ? [
                "Clear it completely?",
                "This deletes this room’s uploaded files, clears the canvas and pauses contributions. Its metadata audit remains. You cannot undo this.",
                "Purge room",
              ]
            : [
                "Call it a session?",
                "This disconnects participants and displays, stops live screens and disables joining. Export your session first if you need a copy.",
                "End session",
              ];
      confirmAction(details[0], details[1], `${action}.confirmed`, details[2]);
      return;
    }
    if (action.endsWith(".confirmed")) {
      const result = await client.command(action.replace(".confirmed", ""));
      closeModal();
      if (result.cleanupPending)
        toast(
          `${result.cleanupPending} file deletions are pending. Retry cleanup in room settings.`,
          true,
        );
      return;
    }
    if (action === "room.cleanup") {
      const result = await client.command("room.cleanup");
      toast(
        result.cleanupPending
          ? `${result.cleanupPending} file deletions are still pending.`
          : "File cleanup complete.",
        Boolean(result.cleanupPending),
      );
      return;
    }
    if (action === "room.export") {
      const data = await client.api("export");
      downloadBlob(
        JSON.stringify(data, null, 2),
        `borderless-${state.id}.json`,
      );
      toast(
        "Session exported. Uploaded file bytes are separate from this snapshot.",
      );
      return;
    }
    if (action === "audit.export") {
      const data = await client.api("audit");
      downloadBlob(
        JSON.stringify(data, null, 2),
        `borderless-${state.id}-audit.json`,
      );
      toast(
        data.verification.valid
          ? "Audit chain verified and exported."
          : "Audit verification failed.",
        !data.verification.valid,
      );
      return;
    }
    if (action === "activity.refresh") {
      activity = (await client.api("audit")).events;
      renderPanel();
      return;
    }
    if (action === "hand.raise") {
      await client.command("hand.raise");
      toast("Your hand is up.");
      return;
    }
    if (["hand.approve", "hand.deny", "hand.revoke"].includes(action))
      return await client.command(action, { deviceId: target.dataset.id });
    if (action === "device.manage") {
      const person = state.devices.find((d) => d.id === target.dataset.id);
      if (!person) return;
      modal(
        `Make room for ${person.name}.`,
        `<p class="modal-intro">Drawing approval is checked by the hub on every stroke. Removing a device immediately revokes its session.</p><div class="modal-actions wrap">${button("hand.approve", "Allow drawing", "pen", "primary", `data-id="${person.id}"`)}${button("hand.revoke", "Revoke drawing", "lock", "outline", `data-id="${person.id}"`)}${button("device.evict", "Remove from room", "close", "danger", `data-id="${person.id}"`)}</div>`,
      );
      return;
    }
    if (action === "device.evict") {
      await client.command("device.evict", { deviceId: target.dataset.id });
      closeModal();
      return;
    }
    if (action === "quiz.open") {
      quizModal();
      return;
    }
    if (action === "quiz.results") {
      quizResults();
      return;
    }
    if (action === "quiz.answer.open") {
      modal("A question for the room.", quizContent(state.quiz));
      return;
    }
    if (action === "quiz.answer") {
      await client.command("quiz.answer", {
        quizId: state.quiz.id,
        answer: Number(target.dataset.answer),
      });
      if (dialog.open) closeModal();
      toast("Your answer is in.");
      return;
    }
    if (action === "quiz.close") {
      await client.command("quiz.close");
      closeModal();
      toast("The results are on the wall.");
      return;
    }
    if (action === "quiz.dismiss") {
      await client.command("quiz.dismiss");
      closeModal();
      return;
    }
    if (action === "delivery.compose") {
      const people = state.devices.filter((d) => d.role !== "wall");
      modal(
        "A little something, sent back.",
        `<p class="modal-intro">Send ${esc(activeItem.title)} to a device. They’ll see an invitation to download it.</p><form id="delivery-form"><label>Send to<select name="deviceId">${people.map((d) => `<option value="${d.id}">${esc(d.name)}${d.online ? "" : " (away)"}</option>`).join("")}</select></label><button class="btn primary full" type="submit">Send to device ${icon("return", 18)}</button></form>`,
      );
      return;
    }
    if (action === "delivery.open") {
      const d = state.deliveries.find((d) => d.id === target.dataset.id);
      if (!d) return;
      modal(
        "This one’s for you.",
        `<p class="modal-intro">${esc(d.from)} sent you <strong>${esc(d.name)}</strong>.</p><a class="btn primary full" data-action="delivery.accept" data-id="${d.id}" href="${client.assetURL(d.assetId, true)}" download>${icon("download", 18)} Download file</a>`,
      );
      return;
    }
    if (action === "delivery.accept") {
      await client.command("delivery.accept", {
        deliveryId: target.dataset.id,
      });
      closeModal();
      return;
    }
    if (action === "screen.toggle") {
      if (sharing.local) await sharing.stop();
      else await sharing.start();
      return;
    }
    if (action === "screen.private") {
      await sharing.start({ audience: "private" });
      if (sharing.local) toast("Shared privately. Choose Invite a viewer to decide who can see it.");
      return;
    }
    if (["screen.invite", "screen.invite.send", "screen.revoke", "screen.decline"].includes(action)) {
      await liveWindowAction(action, target, client, state);
      return;
    }
    if (action === "surface.focus") {
      const element = target.closest("[data-item],[data-stream]");
      if (element) await board.focus(element);
      return;
    }
    if (action === "stream.stop") {
      await client.command("stream.stop", { streamId: target.dataset.id });
      return;
    }
    if (action === "stream.audio") {
      const video = document.querySelector(
        `[data-stream="${target.dataset.id}"] video`,
      );
      video.muted = !video.muted;
      await video.play();
      target.textContent = video.muted ? "Enable audio" : "Mute audio";
      return;
    }
    if (action === "pointer.open") {
      modal(
        "A pointer in your pocket.",
        `<p class="modal-intro">Open your participant portal on a phone and choose Point. Touch control works without motion permissions.</p><a class="btn primary full" href="/portal/${state.id}">${icon("pointer", 18)}Open this device’s portal</a>`,
      );
      return;
    }
    if (action === "portal.tab") {
      activatePortalTab(target.dataset.tab);
      return;
    }
    if (action === "gyro.enable") {
      await enableGyro();
      return;
    }
    if (action.startsWith("zoom.")) {
      zoom =
        action === "zoom.fit"
          ? 1
          : Math.max(
              0.5,
              Math.min(1.5, zoom + (action === "zoom.in" ? 0.1 : -0.1)),
            );
      board.setZoom(zoom);
      document.querySelector("#zoom-value").textContent =
        `${Math.round(zoom * 100)}%`;
      return;
    }
    if (action === "my.device") {
      modal(
        "Your place in the room.",
        `<div class="device-profile"><span class="avatar large" style="--avatar:${state.me.colour}">${esc(state.me.name[0])}</span><h3>${esc(state.me.name)}</h3><p>${esc(state.me.role === "admin" ? "Room leader" : state.me.role === "wall" ? "Room display" : "Participant")}</p></div><form id="seat-form"><label>Your position<select name="seat">${["left", "centre", "right"].map((seat) => `<option value="${seat}" ${state.me.seat === seat ? "selected" : ""}>${seat[0].toUpperCase() + seat.slice(1)}</option>`).join("")}</select></label><button class="btn outline full" type="submit">Update position</button></form>${button("session.leave", "Leave this device’s session", "close", "full subtle")}`,
      );
      return;
    }
    if (action === "session.leave") {
      await client.api("logout", { method: "POST", body: {} });
      client.close();
      location.href = "/";
      return;
    }
    if (action === "native.open") {
      await window.borderless.openAsset({
        roomId: state.id,
        assetId: activeItem.assetId,
        name: activeItem.title,
      });
      return;
    }
  } catch (error) {
    toast(error.message, true);
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (form.id === "create-form") {
      const data = await createRoom(input);
      location.href = `/room/${data.roomId}`;
    }
    if (form.id === "join-form" || form.id === "login-form") {
      const route = form.id === "join-form" ? "join" : "login";
      const c = new RoomClient(roomId);
      await c.api(route, { method: "POST", body: input });
      location.replace(`/${route === "join" && !window.borderless ? "portal" : "room"}/${roomId}`);
    }
    if (form.id === "note-form") {
      await client.command("note.add", input);
      closeModal();
    }
    if (form.id === "note-edit-form") {
      await client.command("item.edit", {
        ...input,
        itemId: activeItem.id,
        version: activeItem.version,
      });
      closeModal();
    }
    if (form.id === "quiz-form") {
      const options = [
        input.option0,
        input.option1,
        input.option2,
        input.option3,
      ].map((v) => v.trim());
      const correct = Number(input.correct);
      if (!options[correct])
        throw new Error("The correct answer needs some text.");
      const remapped = options.slice(0, correct).filter(Boolean).length;
      await client.command("quiz.start", {
        question: input.question,
        options: options.filter(Boolean),
        correct: remapped,
      });
      closeModal();
      toast("Your question is live.");
    }
    if (form.id === "delivery-form") {
      await client.command("delivery.send", {
        assetId: activeItem.assetId,
        deviceId: input.deviceId,
      });
      closeModal();
      toast("A download invitation is waiting on their device.");
    }
    if (form.id === "seat-form") {
      await client.command("seat.change", input);
      closeModal();
      toast("Your position has been updated.");
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
});
fileInput.addEventListener("change", () => {
  const files = [...fileInput.files];
  if (!files.length) return;
  if (fileInput.dataset.intent === "pick" && view === "portal") {
    selectedFile = files[0];
    document.querySelector("#throw-title").textContent = selectedFile.name;
    document.querySelector("#throw-description").textContent =
      `${bytes(selectedFile.size)} · Flick up or tap Send`;
    document.querySelector('[data-action="portal.send"]')?.remove();
    document
      .querySelector("#throw-card")
      .insertAdjacentHTML(
        "beforeend",
        button("portal.send", "Send to the canvas", "up", "primary full"),
      );
    return;
  }
  sendFiles(files);
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  const tab = event.target.closest('[data-action="portal.tab"]');
  if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const names = ["send", "point", "draw"], index = names.indexOf(tab.dataset.tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    activatePortalTab(names[next], true);
  }
  if (event.key === "Escape") {
    if (!dialog.open) {
      const utility = event.target.closest("[data-window]");
      if (utility) utilityWindows?.close(utility.dataset.window);
      const root = document.querySelector(".controls-hidden");
      if (root) { root.classList.remove("controls-hidden"); root.querySelector(".show-controls").hidden = true; }
    }
    if (pointerActive) client?.send({ type: "pointer", x: .5, y: .5, active: false });
    pointerActive = false;
    document.querySelector("#pointer-pad")?.classList.remove("pressed");
    board?.cancel();
  }
  if (
    event.key === "n" &&
    view === "room" &&
    !dialog.open &&
    event.target.closest("#canvas-stage") &&
    !event.target.closest("input,textarea,select")
  )
    noteModal();
});
let gyroEnabled = false,
  gyroOrigin;
async function enableGyro() {
  if (gyroEnabled) {
    gyroEnabled = false;
    document.querySelector("#gyro-status").textContent =
      "Motion pointer off. Touch control is ready.";
    return;
  }
  if (!window.isSecureContext)
    throw new Error("Motion input requires a trusted HTTPS connection.");
  if (!("DeviceOrientationEvent" in window))
    throw new Error(
      "This device does not expose motion input. Use the touch pad instead.",
    );
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    if ((await DeviceOrientationEvent.requestPermission()) !== "granted")
      throw new Error(
        "Motion permission was declined. Touch control is still available.",
      );
  }
  gyroEnabled = true;
  gyroOrigin = null;
  document.querySelector("#gyro-status").textContent =
    "Hold the touch pad to point with motion. Release to stop. Tap the button again to turn it off.";
}
window.addEventListener("deviceorientation", (event) => {
  if (
    !gyroEnabled ||
    !pointerActive ||
    event.gamma === null ||
    event.beta === null
  )
    return;
  if (!gyroOrigin) gyroOrigin = { gamma: event.gamma, beta: event.beta };
  if (performance.now() - lastPointerAt < 25) return;
  lastPointerAt = performance.now();
  const x = Math.max(
      0,
      Math.min(1, 0.5 + (event.gamma - gyroOrigin.gamma) / 70),
    ),
    y = Math.max(0, Math.min(1, 0.5 + (event.beta - gyroOrigin.beta) / 70));
  client?.send({ type: "pointer", x, y, active: true });
});
function connection(next) {
  status = next;
  const banner = document.querySelector("#connection-banner");
  if (banner) {
    const hadFocus = banner.contains(document.activeElement);
    banner.hidden = next === "online";
    banner.replaceChildren();
    const message = document.createElement("span");
    message.textContent = next === "revoked"
      ? "Your access has ended. Ask the leader for a fresh invitation."
      : "Connection lost. Reconnecting to the room… Changes are paused until you are back.";
    banner.append(message);
    if (next === "offline") {
      const retry = document.createElement("button");
      retry.className = "btn outline small";
      retry.textContent = "Reconnect now";
      retry.addEventListener("click", () => client.reconnectNow());
      banner.append(retry);
    } else if (next === "revoked" && state?.me.role !== "wall") {
      const join = document.createElement("a");
      join.className = "btn outline small";
      join.textContent = state.me.role === "admin" ? "Leader login" : "Join again";
      join.href = `/${state.me.role === "admin" ? "leader" : "join"}/${roomId}`;
      banner.append(join);
    }
    if (hadFocus) (banner.querySelector("button,a") || document.querySelector('#canvas-stage, [role="tab"][aria-selected="true"]'))?.focus({ preventScroll: true });
  }
  if (state) updateRoom();
}
async function boot() {
  if (!roomId) {
    home();
    return;
  }
  if (!["room", "wall", "portal", "join", "leader"].includes(route[0])) {
    errorPage("This page could not be found.");
    return;
  }
  if (route[0] === "join" || route[0] === "leader") {
    await joinPage({ login: route[0] === "leader" });
    return;
  }
  client = new RoomClient(roomId);
  const pair = new URLSearchParams(location.hash.slice(1)).get("pair");
  try {
    if (pair) {
      await client.api("wall-pair", {
        method: "POST",
        body: { token: pair, name: "Room display" },
      });
      history.replaceState(null, "", location.pathname);
    }
    state = await client.api("state");
    view = route[0];
    rememberRoom(state);
    if (view === "wall" && !["admin", "wall"].includes(state.me.role)) {
      errorPage(
        "This link needs a paired display or leader session. Ask the leader to pair this screen.",
      );
      return;
    }
    if (state.me.role === "wall" && view !== "wall") {
      location.replace(`/wall/${state.id}`);
      return;
    }
    if (view === "portal") portalShell();
    else roomShell();
    client.addEventListener("state", (event) => {
      state = event.detail;
      updateRoom();
    });
    client.addEventListener("connection", (event) => connection(event.detail));
    client.addEventListener("sharing", updateSharingControls);
    client.addEventListener("error", (event) =>
      toast(event.detail.error, true),
    );
    client.addEventListener("latency", (event) => {
      const el = document.querySelector("#local-status");
      if (el && !transferBusy)
        el.textContent = `Stored on this hub · ${event.detail} ms round trip`;
    });
    await client.connect();
    if (window.borderless) {
      window.borderless.onEdge((event) => {
        if (status !== "online") return;
        client.send({
          type: "pointer",
          x: event.edge === "right" ? 0 : 1,
          y: event.y,
          active: true,
        });
        board?.effects.play(
          event.edge === "right" ? 0 : 1,
          event.y,
          state.me.colour,
          state.effect,
        );
      });
    }
  } catch (error) {
    client.close();
    board?.destroy();
    utilityWindows?.destroy();
    if (error.status === 401) await joinPage({ expired: true });
    else errorPage(error.message);
  }
}
boot();
