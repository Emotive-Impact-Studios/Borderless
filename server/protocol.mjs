import { currentInvitation, mayKnowStream, mayReceiveStream } from "./stream-policy.mjs";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export function text(value, max, label = "Text") {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(400, `${label} must contain 1 to ${max} characters.`);
  return value.trim();
}
export function number(value, min, max, label = "Coordinate") {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(400, `${label} is outside its allowed range.`);
  return value;
}
export function choice(value, values, label = "Option") {
  if (!values.includes(value)) fail(400, `${label} is not supported.`);
  return value;
}
export const leader = (s) => s.role === "admin";
export function requireLeader(s) {
  if (!leader(s)) fail(403, "Only the room leader can do that.");
}
export function requireContributor(s, room) {
  if (s.role === "wall") fail(403, "The display is read-only.");
  if (room.state.locked && !leader(s))
    fail(403, "The leader has paused contributions.");
}
export function canDraw(s, room) {
  if (room.state.ended) return false;
  return (
    leader(s) ||
    (s.role === "participant" &&
      !room.state.locked &&
      (room.state.mode !== "classroom" ||
        room.state.permissions.includes(s.device_id)))
  );
}
export function publicSession(s) {
  return {
    id: s.device_id,
    name: s.name,
    role: s.role,
    colour: s.colour,
    seat: s.seat,
  };
}
export function publicState(room, s, devices) {
  const state = structuredClone(room.state);
  state.streams = state.streams.filter(stream => mayKnowStream(stream, s));
  for (const stream of state.streams) {
    stream.canReceive = mayReceiveStream(stream, s);
    const owner = stream.ownerId === s.device_id;
    if (owner) stream.receivers = devices.filter(device => mayReceiveStream(stream, device)).map(device => device.id);
    stream.invitations = (stream.invitations || []).filter(invitation =>
      currentInvitation(invitation) && devices.some(device => device.id === invitation.deviceId) &&
      (owner || invitation.deviceId === s.device_id));
  }
  const quiz = state.quiz;
  if (quiz) {
    const answers = Object.values(quiz.answers);
    quiz.counts = quiz.options.map(
      (_, index) => answers.filter((a) => a.answer === index).length,
    );
    quiz.total = answers.length;
    quiz.myAnswer = quiz.answers[s.device_id]?.answer ?? null;
    if (!leader(s)) {
      delete quiz.answers;
      if (quiz.open) {
        delete quiz.correct;
        delete quiz.counts;
      }
    }
  }
  if (!leader(s)) {
    delete state.requests;
    delete state.permissions;
    state.deliveries = state.deliveries.filter(
      (d) => d.targetId === s.device_id,
    );
  }
  return {
    ...state,
    id: room.id,
    name: room.name,
    devices,
    me: {
      ...publicSession(s),
      csrf: s.csrf,
      canDraw: canDraw(s, room),
      expires: s.expires,
    },
    ...(leader(s) ? { joinCode: room.join_code } : {}),
  };
}
export const themes = ["studio", "classroom", "executive", "synth", "command"];
export const effects = ["ripple", "liquid", "particles", "none"];
export const seats = ["left", "centre", "right"];
export const maxItems = 60;
