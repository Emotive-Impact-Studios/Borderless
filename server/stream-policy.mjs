// A room capture is shared with its leader/displays. A private capture is not:
// only the owner and invited people who accept may see or receive it (PRD B37).
// Other participant destinations always require the owner's offer and acceptance.
export const invitationLifetime = 10 * 60 * 1000;
export const audiences = ["room", "private"];
export function currentInvitation(invitation, at = Date.now()) {
  return invitation.status === "accepted" || invitation.expiresAt > at;
}
const isPrivate = stream => stream.audience === "private";
export function mayReceiveStream(stream, session) {
  const deviceId = session.device_id ?? session.id;
  return stream.ownerId === deviceId || (!isPrivate(stream) && ["admin", "wall"].includes(session.role)) ||
    (stream.invitations || []).some(invitation => invitation.deviceId === deviceId && invitation.status === "accepted");
}
// Private captures are invisible, not merely unplayable, to everyone except
// the owner and people the owner has invited.
export function mayKnowStream(stream, session) {
  const deviceId = session.device_id ?? session.id;
  return !isPrivate(stream) || stream.ownerId === deviceId ||
    (stream.invitations || []).some(invitation => invitation.deviceId === deviceId && currentInvitation(invitation));
}
export function removeStreamRecipient(state, deviceId) {
  for (const stream of state.streams)
    stream.invitations = (stream.invitations || []).filter(invitation => invitation.deviceId !== deviceId);
}
