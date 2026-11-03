import { esc, icon, modal, closeModal, toast } from "./ui.js";

export const liveWindowURL = (roomId, streamId) => `/screen/${roomId}/${streamId}`;
const received = (stream, state) => stream.invitations?.find(invitation => invitation.deviceId === state.me.id);
const shownInvitations = new Set();

export function liveWindowsHTML(state) {
  const streams = state.streams.filter(stream => stream.ownerId === state.me.id || received(stream, state));
  if (!streams.length) return "";
  return `<section class="live-window-inbox" aria-label="Live windows"><h3>Live windows</h3>${streams.map(stream => {
    const own = stream.ownerId === state.me.id, invitation = received(stream, state);
    const description = own ? "Your screen is sharing with the room." : invitation.status === "invited" ? `${stream.ownerName} invited you. Open to accept.` : `Shared by ${stream.ownerName} · View only`;
    return `<div class="live-window-row"><div><strong>${esc(stream.title)}</strong><p>${esc(description)}</p></div><div class="live-window-actions"><a class="btn small outline" href="${liveWindowURL(state.id, stream.id)}" target="_blank" rel="noopener" aria-label="${esc(own ? "Open your live window" : `Open live window from ${stream.ownerName}`)}">${icon("screen", 16)}${own ? "Open preview" : "Open live window"}</a>${own ? `<button class="btn small subtle" data-action="screen.invite" data-id="${stream.id}">Invite a viewer</button>` : `<button class="btn small subtle" data-action="screen.decline" data-id="${stream.id}" data-invitation="${invitation.id}">${invitation.status === "invited" ? "Decline" : "Stop receiving"}</button>`}</div></div>`;
  }).join("")}</section>`;
}

export function updateLiveWindowNotifications(state, view) {
  const pending = state.streams.flatMap(stream => (stream.invitations || []).filter(invitation =>
    invitation.deviceId === state.me.id && invitation.status === "invited").map(invitation => ({ ...invitation, owner: stream.ownerName })));
  const people = document.querySelector('[data-action="panel.people"]');
  if (people) {
    people.setAttribute("aria-label", "People");
    people.setAttribute("aria-description", pending.length ? `${pending.length} live-window invitation${pending.length === 1 ? "" : "s"}` : "People in this room");
    let count = people.querySelector(".live-invite-count");
    if (pending.length && !count) { count = document.createElement("span"); count.className = "live-invite-count"; count.setAttribute("aria-hidden", "true"); people.append(count); }
    if (count) { count.hidden = !pending.length; count.textContent = pending.length; }
  }
  if (view === "wall") return;
  for (const invitation of pending) if (!shownInvitations.has(invitation.id)) {
    shownInvitations.add(invitation.id);
    toast(`${invitation.owner} invited you to a live window. ${view === "portal" ? "Open the invitation above your tools." : "Open People to view it."}`);
  }
}

export function inviteLiveWindow(state, streamId) {
  const stream = state.streams.find(value => value.id === streamId);
  if (!stream || stream.ownerId !== state.me.id) throw new Error("Choose a screen you are sharing.");
  const invitations = stream.invitations || [];
  const people = state.devices.filter(device => device.online && device.id !== state.me.id && device.role !== "wall" && !invitations.some(invitation => invitation.deviceId === device.id));
  const recipients = invitations.map(invitation => {
    const name = state.devices.find(device => device.id === invitation.deviceId)?.name || "Room member";
    return `<div class="live-recipient"><span><strong>${esc(name)}</strong><small>${invitation.status === "accepted" ? "Accepted" : "Invited"}</small></span><button class="btn small subtle" data-action="screen.revoke" data-id="${streamId}" data-invitation="${invitation.id}" aria-label="Revoke live window from ${esc(name)}">Revoke</button></div>`;
  }).join("");
  modal("Invite a live-window viewer", `<p>Invite someone to open <strong>${esc(stream.title)}</strong> beside their own work. They choose whether to accept.</p><p class="live-window-context">The room display and leaders can already view this share. You keep the capture stop control.</p>${people.length ? `<div class="live-recipient-label"><label for="live-recipient">Invite to</label><select id="live-recipient">${people.map(device => `<option value="${device.id}">${esc(device.name)}</option>`).join("")}</select></div><button class="btn primary full" data-action="screen.invite.send" data-id="${streamId}">Send live-window invitation</button>` : '<p class="live-window-context">No other available people are online. Ask them to join this room first.</p>'}${recipients ? `<div class="live-recipient-list"><h3>Personal viewers</h3>${recipients}</div>` : ""}`);
}

export async function liveWindowAction(action, target, client, state) {
  if (action === "screen.invite") return inviteLiveWindow(await client.api("state"), target.dataset.id);
  target.disabled = true;
  try {
    if (action === "screen.invite.send") {
      const select = document.querySelector("#live-recipient");
      if (!select?.value) throw new Error("Choose a person in this room.");
      await client.command("stream.invite", { streamId: target.dataset.id, deviceId: select.value });
      closeModal(); toast("Live-window invitation sent. They can choose to accept it.");
    } else {
      await client.command(action === "screen.revoke" ? "stream.revoke" : "stream.decline", { streamId: target.dataset.id, invitationId: target.dataset.invitation });
      if (action === "screen.revoke") closeModal();
      toast(action === "screen.revoke" ? "Personal viewer access removed." : "Live-window invitation removed.");
    }
  } finally { if (target.isConnected) target.disabled = false; }
}
