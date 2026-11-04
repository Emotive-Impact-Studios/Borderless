// Local-network WebRTC. No third-party TURN or STUN traffic is configured.
export class ScreenSharing {
  constructor(client, getVideo, onError, { onStatus = () => {} } = {}) {
    this.client = client;
    this.getVideo = getVideo;
    this.onError = onError;
    this.onStatus = onStatus;
    this.peers = new Map();
    this.candidates = new Map();
    this.offered = new Set();
    client.addEventListener("rtc", (event) =>
      this.signal(event.detail).catch((error) => onError(error.message)),
    );
    client.addEventListener("state", (event) => this.sync(event.detail));
    client.addEventListener("rtc.peer.left", (event) => {
      const key = `${event.detail.streamId}:${event.detail.connectionId}`;
      this.peers.get(key)?.close();
      this.peers.delete(key);
      this.candidates.delete(key);
    });
    client.addEventListener("connection", (event) => {
      if (event.detail !== "online") this.disconnect();
    });
    client.addEventListener("closed", () => this.disconnect());
  }
  disconnect() {
    this.stopLocal();
    for (const peer of this.peers.values()) peer.close();
    for (const stream of this.client.state?.streams || []) this.clearVideo(stream.id);
    this.peers.clear();
    this.offered.clear();
    this.candidates.clear();
  }
  clearVideo(streamId) {
    const video = this.getVideo(streamId);
    if (video) video.srcObject = null;
  }
  captures(stream, state = this.client.state) {
    return Boolean(this.local && stream.ownerId === state.me.id && (!stream.connectionId || stream.connectionId === this.client.connectionId));
  }
  receives(stream) { return Boolean(stream.canReceive && this.getVideo(stream.id)); }
  async start({ audience = "room" } = {}) {
    if (this.starting) throw new Error("A screen selection is already open.");
    if (!navigator.mediaDevices?.getDisplayMedia)
      throw new Error(
        "Screen sharing needs a supported desktop browser and HTTPS or localhost. Use your phone to send files, draw and point.",
      );
    if (this.local) throw new Error("Your screen is already sharing.");
    this.starting = true;
    this.client.emit("sharing");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });
      this.local = stream;
      this.client.emit("sharing");
      const track = stream.getVideoTracks()[0];
      // Attach before any await: the browser's own Stop control can end the
      // track while the room is still registering it.
      track.onended = () => {
        if (this.local === stream) this.stop().catch((error) => this.onError(error.message));
      };
      try {
        await this.client.command("stream.start", {
          title: `${this.client.state.me.name}’s screen`,
          connectionId: this.client.connectionId,
          audience,
        });
      } catch (error) {
        this.stopLocal();
        throw error;
      }
      if (track.readyState === "ended" || this.local !== stream) {
        // Stopped during registration: remove the room record we just created.
        if (this.local === stream) this.stopLocal();
        await this.stopRegistered();
        return;
      }
      this.watchFirstFrame(stream, track);
      const state = await this.client.api("state");
      this.sync(state);
    } finally {
      this.starting = false;
      this.client.emit("sharing");
    }
  }
  // A live track is not a live share. Wait for a real captured frame, and treat
  // none within the deadline as a capture failure (PRD B12, F03).
  watchFirstFrame(stream, track, timeout = 10_000) {
    const viaVideo = () => {
      const probe = document.createElement("video");
      probe.muted = true;
      probe.srcObject = stream;
      return new Promise((resolve) => {
        if (probe.requestVideoFrameCallback) probe.requestVideoFrameCallback(() => resolve());
        else probe.addEventListener("loadeddata", () => resolve(), { once: true });
        probe.play().catch(() => {});
      }).finally(() => { probe.srcObject = null; });
    };
    // grabFrame resolves only once a real frame exists; fall back where it is unsupported.
    const frame = globalThis.ImageCapture
      ? new ImageCapture(track).grabFrame().then((bitmap) => bitmap.close?.(), viaVideo)
      : viaVideo();
    const deadline = new Promise((resolve) => setTimeout(() => resolve("timeout"), timeout));
    Promise.race([frame.then(() => "frame"), deadline]).then((result) => {
      if (this.local !== stream) return;
      this.firstFrame = result === "frame";
      this.client.emit("sharing");
      if (result !== "frame") {
        this.stop().catch(() => {});
        this.onError("Your screen share stopped because no picture arrived from the selected window within 10 seconds. Choose the window again.");
      }
    });
  }
  async stopRegistered() {
    const state = await this.client.api("state").catch(() => this.client.state);
    const stream = state?.streams.find(
      (s) => s.ownerId === this.client.state.me.id &&
        (!s.connectionId || s.connectionId === this.client.connectionId),
    );
    if (stream) await this.client.command("stream.stop", { streamId: stream.id }).catch(() => {});
  }
  sync(state) {
    if (
      !state ||
      this.client.socket?.readyState !== 1 ||
      !this.client.connectionId
    )
      return;
    const mine = state.streams.find(
      (s) =>
        s.ownerId === state.me.id &&
        (!s.connectionId || s.connectionId === this.client.connectionId),
    );
    if (!mine && this.local) {
      this.stopLocal();
    }
    const active = new Map(state.streams.map(stream => [stream.id, stream]));
    for (const [key, peer] of this.peers) {
      const stream = active.get(key.split(":")[0]);
      const allowed = stream && (this.captures(stream, state)
        ? stream.receivers?.includes(peer.remoteDeviceId)
        : this.receives(stream));
      if (!allowed) {
        peer.close();
        this.peers.delete(key);
        this.candidates.delete(key);
        if (!stream || !this.captures(stream, state)) this.clearVideo(key.split(":")[0]);
      }
    }
    for (const key of this.offered)
      if (!active.has(key.split(":")[0]) || !this.receives(active.get(key.split(":")[0]))) this.offered.delete(key);
    for (const key of this.candidates.keys())
      if (!active.has(key.split(":")[0])) this.candidates.delete(key);
    if (mine && this.local) {
      const video = this.getVideo(mine.id);
      if (video && video.srcObject !== this.local) {
        video.srcObject = this.local;
        video.muted = true;
        video.play().catch(() => {});
      }
    }
    for (const stream of state.streams)
      if (
        this.receives(stream) && (stream.connectionId
          ? stream.connectionId !== this.client.connectionId
          : stream.ownerId !== state.me.id)
      ) {
        const key = `${stream.id}:${stream.ownerId}`;
        if (
          !this.offered.has(key) &&
          this.client.send({
            type: "rtc",
            streamId: stream.id,
            targetId: stream.ownerId,
            ...(stream.connectionId
              ? { targetConnectionId: stream.connectionId }
              : {}),
            kind: "ready",
          })
        )
          this.offered.add(key);
      }
  }
  peer(streamId, targetId, targetConnectionId) {
    const key = `${streamId}:${targetConnectionId}`;
    let peer = this.peers.get(key);
    if (peer) return peer;
    peer = new RTCPeerConnection({ iceServers: [] });
    peer.remoteDeviceId = targetId;
    this.peers.set(key, peer);
    peer.onicecandidate = (event) => {
      if (event.candidate && this.peers.get(key) === peer)
        this.client.send({
          type: "rtc",
          streamId,
          targetId,
          targetConnectionId,
          kind: "candidate",
          payload: event.candidate.toJSON(),
        });
    };
    peer.ontrack = (event) => {
      const current = this.client.state?.streams.find(stream => stream.id === streamId);
      if (this.peers.get(key) !== peer || !current || !this.receives(current) || this.captures(current)) return;
      const video = this.getVideo(streamId);
      if (!video) return;
      const stream = event.streams[0] || new MediaStream([event.track]);
      video.srcObject = stream;
      video
        .play()
        .catch(() => this.onError("Tap the screen tile to start playback."));
    };
    peer.onconnectionstatechange = () => {
      if (this.peers.get(key) !== peer) return;
      this.onStatus(streamId, peer.connectionState);
      if (peer.connectionState === "failed") {
        this.onError(
          "A screen could not connect. Check that devices share the same network and client isolation is disabled.",
        );
      }
    };
    return peer;
  }
  async signal(event) {
    const { streamId, fromId, fromConnectionId, kind, payload } = event;
    const state = this.client.state;
    const stream = state.streams.find((s) => s.id === streamId);
    if (!stream) return;
    if (kind === "ready") {
      if (!this.captures(stream, state)) return;
      const key = `${streamId}:${fromConnectionId}`;
      const previous = this.peers.get(key);
      if (previous && (payload?.restart || ["closed", "failed", "disconnected"].includes(previous.connectionState))) {
        previous.close(); this.peers.delete(key); this.candidates.delete(key);
      }
      const peer = this.peer(streamId, fromId, fromConnectionId);
      if (peer.signalingState !== "stable" || peer.makingOffer) return;
      peer.makingOffer = true;
      if (!peer.getSenders().some((s) => s.track))
        this.local
          .getTracks()
          .forEach((track) => peer.addTrack(track, this.local));
      try {
        await peer.setLocalDescription(await peer.createOffer());
        this.client.send({
          type: "rtc",
          streamId,
          targetId: fromId,
          targetConnectionId: fromConnectionId,
          kind: "offer",
          payload: peer.localDescription,
        });
      } finally {
        peer.makingOffer = false;
      }
      return;
    }
    if (!this.captures(stream, state) && !this.receives(stream)) return;
    const key = `${streamId}:${fromConnectionId}`;
    if (kind === "candidate") {
      const peer = this.peers.get(key);
      if (!peer?.remoteDescription) {
        if (!this.candidates.has(key)) this.candidates.set(key, []);
        const queue = this.candidates.get(key);
        if (queue.length < 100) queue.push(payload);
        return;
      }
      await peer.addIceCandidate(payload);
      return;
    }
    const peer = this.peer(streamId, fromId, fromConnectionId);
    if (kind === "offer") {
      await peer.setRemoteDescription(payload);
      await this.drain(key, peer);
      await peer.setLocalDescription(await peer.createAnswer());
      this.client.send({
        type: "rtc",
        streamId,
        targetId: fromId,
        targetConnectionId: fromConnectionId,
        kind: "answer",
        payload: peer.localDescription,
      });
    }
    if (kind === "answer") {
      await peer.setRemoteDescription(payload);
      await this.drain(key, peer);
    }
  }
  async drain(key, peer) {
    for (const candidate of this.candidates.get(key) || [])
      await peer.addIceCandidate(candidate);
    this.candidates.delete(key);
  }
  retry(streamId) {
    const stream = this.client.state?.streams.find(value => value.id === streamId);
    if (!stream || !this.receives(stream) || this.captures(stream) || !this.client.ready) return false;
    for (const [key, peer] of this.peers)
      if (key.startsWith(`${streamId}:`)) { peer.close(); this.peers.delete(key); this.candidates.delete(key); }
    this.clearVideo(streamId);
    const sent = this.client.send({ type: "rtc", kind: "ready", streamId, targetId: stream.ownerId,
      ...(stream.connectionId ? { targetConnectionId: stream.connectionId } : {}), payload: { restart: true } });
    if (sent) { this.offered.add(`${streamId}:${stream.ownerId}`); this.onStatus(streamId, "connecting"); }
    return sent;
  }
  stopLocal() {
    if (this.local) {
      this.local.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      this.local = null;
      this.client.emit("sharing");
    }
  }
  async stop() {
    const stream = this.client.state?.streams.find(
      (s) =>
        s.ownerId === this.client.state.me.id &&
        (!s.connectionId || s.connectionId === this.client.connectionId),
    );
    this.stopLocal();
    if (stream)
      await this.client.command("stream.stop", { streamId: stream.id });
  }
}
