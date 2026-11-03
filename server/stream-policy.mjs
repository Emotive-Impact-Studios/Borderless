// A room capture is already shared with its leader/displays. Additional
// participant destinations require the source owner's offer and acceptance.
export const invitationLifetime = 10 * 60 * 1000;
export function currentInvitation(invitation, at = Date.now()) {
  return invitation.status === "accepted" || invitation.expiresAt > at;
}
export function mayReceiveStream(stream, session) {
  const deviceId = session.device_id ?? session.id;
  return stream.ownerId === deviceId || ["admin", "wall"].includes(session.role) ||
    (stream.invitations || []).some(invitation => invitation.deviceId === deviceId && invitation.status === "accepted");
}
export function removeStreamRecipient(state, deviceId) {
  for (const stream of state.streams)
    stream.invitations = (stream.invitations || []).filter(invitation => invitation.deviceId !== deviceId);
}
