import { RoomClient } from "./client.js";
import { ScreenSharing } from "./rtc.js";
import { icon } from "./ui.js";

const [, , roomId, streamId] = location.pathname.split("/");
const node = id => document.getElementById(`screen-${id}`);
const video = node("video"), client = new RoomClient(roomId);
let state, connection = "connecting", media = "new", hasFrame = false, lastFrame = 0, busy = false, seen = false, stopped = false;
const sharing = new ScreenSharing(client, id => {
  const stream = client.state?.streams.find(value => value.id === id);
  const pending = stream?.invitations?.some(value => value.deviceId === client.state.me.id && value.status === "invited");
  return id === streamId && !pending && !stopped ? video : null;
}, message => showError(message), {
  onStatus(id, status) {
    if (id !== streamId) return;
    media = status;
    if (["failed", "disconnected", "closed", "connecting"].includes(status)) hasFrame = false;
    render();
  },
});
node("close").innerHTML = icon("close", 18);
node("room").href = `/room/${roomId}`;
node("join").href = `/join/${roomId}`;

function showError(message) {
  node("error").textContent = message;
  node("error").hidden = !message;
}
function current() { return state?.streams.find(stream => stream.id === streamId); }
function invitation() { return current()?.invitations?.find(value => value.deviceId === state.me.id); }
function render() {
  const stream = current(), invite = invitation(), online = connection === "online";
  const pending = invite?.status === "invited", allowed = Boolean(stream?.canReceive && !pending && !stopped);
  if (stream) seen = true;
  if (state) document.documentElement.dataset.theme = state.theme;
  node("title").textContent = stream?.title || "Live window";
  document.title = `${stream?.title || "Live window"} · Borderless`;
  node("owner").textContent = stream ? `View only · ${stream.ownerName} · ${state.name}` : state?.name || "Connecting to the room…";
  const live = online && allowed && hasFrame && !["failed", "disconnected", "closed"].includes(media);
  node("status").textContent = live ? "Live" : !online ? connection === "revoked" ? "Access ended" : connection === "offline" ? "Disconnected" : "Connecting" : !stream ? "Closed" : !allowed ? pending ? "Invitation" : "Access removed" : "Connecting video";
  node("status").dataset.live = String(live);
  // Let an accepted video present its first frame underneath the opaque state
  // message; a display:none video can defer compositor frame callbacks.
  video.hidden = !online || !allowed;
  node("state").hidden = live;
  node("accept").hidden = !online || !pending || allowed;
  node("decline").hidden = !online || !pending || allowed;
  node("stop").hidden = !online || invite?.status !== "accepted";
  node("join").hidden = connection !== "revoked";
  node("audio").hidden = !live || !video.srcObject?.getAudioTracks().length;
  node("retry").hidden = stopped || connection === "revoked" || (online ? !allowed || live : connection !== "offline");
  node("retry").textContent = online ? "Retry video" : "Reconnect now";
  for (const id of ["accept", "decline", "stop"]) node(id).disabled = busy;
  let title = "Connecting to the room…", description = "Your live window will appear here.";
  if (connection === "revoked") {
    title = "Your room access has ended."; description = "Join the room again and ask the screen owner for a new invitation.";
  } else if (stopped) {
    title = "Viewing stopped."; description = "The owner's room share stays running. You can close this window.";
  } else if (connection === "offline" || (state && !online)) {
    title = "Connection to the room was interrupted."; description = "Reconnect to refresh your access and receive the live window again.";
  } else if (online && !stream) {
    title = seen ? "This live window has closed." : "This live window is unavailable.";
    description = "Ask the person sharing to start a screen and send you a new invitation.";
  } else if (online && !allowed) {
    title = pending ? `${stream.ownerName} invited you to a live window.` : "Access to this live window is unavailable.";
    description = pending ? "Accept to see their live screen beside your own work. This is view only; the owner keeps control and can stop sharing." : "Ask the screen owner to send you a new invitation. The room's other contributions remain available.";
  } else if (online && ["failed", "disconnected"].includes(media)) {
    title = "The live video connection was interrupted."; description = "Check that both devices can reach each other, then retry video. The owner's capture stays running.";
  } else if (online) {
    title = "Waiting for live video…"; description = "The owner is sharing. If video does not arrive, check your room network and retry.";
  }
  node("message").textContent = title;
  node("description").textContent = description;
}
async function respond(type) {
  const invite = invitation();
  if (!invite || busy) return;
  busy = true; showError(""); render();
  try {
    await client.command(type, { streamId, invitationId: invite.id });
    if (type === "stream.decline") { stopped = true; client.close(); window.close(); }
  }
  catch (error) {
    if ([409, 410].includes(error.status)) {
      const fresh = await client.api("state").catch(() => null);
      if (fresh && fresh.me.id === client.state?.me.id && fresh.revision >= client.state.revision) {
        client.state = fresh;
        client.emit("state", fresh);
      }
    }
    showError(error.message);
  }
  finally { busy = false; render(); }
}
node("accept").addEventListener("click", () => respond("stream.accept"));
node("decline").addEventListener("click", () => respond("stream.decline"));
node("stop").addEventListener("click", () => respond("stream.decline"));
node("close").addEventListener("click", () => window.close());
node("retry").addEventListener("click", async () => {
  showError(""); hasFrame = false;
  if (connection !== "online") await client.reconnectNow();
  else if (!sharing.retry(streamId)) showError("The window is no longer available. Ask its owner for a new invitation.");
  render();
});
node("audio").addEventListener("click", async () => {
  video.muted = !video.muted;
  node("audio").setAttribute("aria-pressed", String(!video.muted));
  node("audio").textContent = video.muted ? "Enable audio" : "Mute audio";
  try { await video.play(); } catch { showError("Audio could not start. Try enabling it again."); }
});
video.addEventListener("emptied", () => { hasFrame = false; render(); });
let frame;
function receiveFrame() {
  const first = !hasFrame;
  hasFrame = true; lastFrame = performance.now();
  if (first) render();
  frame = video.requestVideoFrameCallback(receiveFrame);
}
if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(receiveFrame);
else video.addEventListener("playing", () => { hasFrame = true; lastFrame = performance.now(); render(); });
const monitor = setInterval(() => {
  if (hasFrame && performance.now() - lastFrame > 5000 && video.requestVideoFrameCallback) { hasFrame = false; render(); }
}, 1000);
client.addEventListener("state", event => { state = event.detail; render(); });
client.addEventListener("connection", event => { connection = event.detail; if (connection !== "online") hasFrame = false; render(); });
client.addEventListener("error", event => showError(event.detail.error));
window.addEventListener("beforeunload", () => {
  clearInterval(monitor);
  if (frame) video.cancelVideoFrameCallback(frame);
  client.close();
});
client.connect().catch(error => {
  connection = error.status === 401 ? "revoked" : "offline";
  render(); showError(error.status === 401 ? "Join this room before opening an invited live window." : error.status ? error.message : "The room could not be reached. Reconnect to try again.");
});
