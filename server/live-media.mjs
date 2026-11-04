import { randomUUID } from "node:crypto";
import { AccessToken, TrackSource, TwirpError } from "livekit-server-sdk";
import { mayReceiveStream } from "./stream-policy.mjs";

// Media rooms are per stream, not per Borderless room. Otherwise a valid
// Wall subscriber could subscribe to a private stream in the same SFU room.
// The hub supplies fresh authoritative snapshots; this adapter owns no roles.
export class LiveMedia {
  #entries = new Map();
  #tail = Promise.resolve();
  constructor({ apiKey, apiSecret, url, service, readRoom }) {
    if (!apiKey || !apiSecret || !service || !readRoom) throw new Error("Incomplete media configuration");
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.url = url;
    this.service = service;
    this.readRoom = readRoom;
  }

  #serial(action) {
    const result = this.#tail.then(action);
    this.#tail = result.catch(() => {});
    return result;
  }

  async #refresh(roomId) {
    const { room, sessions } = this.readRoom(roomId);
    const active = sessions.filter(s => s.room_id === roomId && !s.revoked && s.expires > Date.now());
    const desired = new Map();
    if (room && !room.state.ended) for (const stream of room.state.streams) {
      if (!active.some(s => s.device_id === stream.ownerId)) continue;
      const members = active.filter(s => mayReceiveStream(stream, s));
      // Session identity matters: a new login must not inherit an old token.
      const signature = JSON.stringify(members.map(s => [s.token_hash, s.device_id, s.role]).sort());
      desired.set(stream.id, { stream, members, signature });
    }
    const entries = this.#entries.get(roomId) ?? new Map();
    this.#entries.set(roomId, entries);
    for (const [id, entry] of entries) {
      if (desired.get(id)?.signature === entry.signature) continue;
      // Revoke the complete media generation before issuing replacement tokens.
      // A removed viewer's old JWT can never subscribe to the replacement room.
      // Failed deletion leaves this entry pending and issuance fails closed.
      try { await this.service.deleteRoom(entry.mediaRoom); }
      catch (error) {
        if (!(error instanceof TwirpError && error.code === "not_found")) throw error;
      }
      entries.delete(id);
    }
    for (const [id, value] of desired) {
      if (!entries.has(id)) {
        const mediaRoom = `bl-${randomUUID()}`;
        await this.service.createRoom({ name: mediaRoom, emptyTimeout: 60, maxParticipants: 64 });
        entries.set(id, { ...value, mediaRoom });
      }
      else Object.assign(entries.get(id), value);
    }
    return entries;
  }

  // Call after every relevant room/session change and on the hub's expiry tick.
  // Command acknowledgement must await this, not merely fire and forget it.
  synchronise(roomId) {
    return this.#serial(async () => { await this.#refresh(roomId); });
  }

  close() {
    return this.#serial(async () => {
      for (const entries of this.#entries.values()) for (const entry of entries.values()) {
        try { await this.service.deleteRoom(entry.mediaRoom); }
        catch (error) {
          if (!(error instanceof TwirpError && error.code === "not_found")) throw error;
        }
      }
      this.#entries.clear();
    });
  }

  // tokenHash comes from the authenticated server session, never a JSON field.
  access(roomId, streamId, tokenHash) {
    return this.#serial(async () => {
      const entries = await this.#refresh(roomId);
      const entry = entries.get(streamId);
      const session = entry?.members.find(s => s.token_hash === tokenHash);
      if (!session) throw Object.assign(new Error("This screen is not available to your session."), { status: 403 });
      // An unused room may have reached its empty timeout. Only the hub may
      // recreate it, after checking current access; auto-create is disabled.
      await this.service.createRoom({ name: entry.mediaRoom, emptyTimeout: 60, maxParticipants: 64 });
      const publisher = session.device_id === entry.stream.ownerId;
      const ttl = Math.min(30, Math.floor((session.expires - Date.now()) / 1000));
      if (ttl < 1) throw Object.assign(new Error("Your session has expired."), { status: 401 });
      const token = new AccessToken(this.apiKey, this.apiSecret, {
        identity: session.token_hash, name: session.name, ttl,
      });
      token.addGrant({
        room: entry.mediaRoom, roomJoin: true,
        roomCreate: false, roomAdmin: false, roomList: false, roomRecord: false,
        canPublish: publisher, canPublishSources: publisher ? [TrackSource.SCREEN_SHARE] : [],
        canSubscribe: !publisher, canPublishData: false, canUpdateOwnMetadata: false,
      });
      const jwt = await token.toJwt();
      // Control API calls and signing yield. Re-read the authority before
      // returning a grant in case access changed while those calls ran.
      const fresh = this.readRoom(roomId);
      const currentStream = fresh.room?.state.streams.find(s => s.id === streamId);
      const currentSession = fresh.sessions.find(s => s.token_hash === tokenHash &&
        s.room_id === roomId && !s.revoked && s.expires > Date.now());
      if (fresh.room?.state.ended || !currentStream || !currentSession ||
          !mayReceiveStream(currentStream, currentSession) ||
          (currentSession.device_id === currentStream.ownerId) !== publisher)
        throw Object.assign(new Error("Screen access changed. Request a new grant."), { status: 403 });
      return { url: this.url, room: entry.mediaRoom, token: jwt, publisher };
    });
  }
}
