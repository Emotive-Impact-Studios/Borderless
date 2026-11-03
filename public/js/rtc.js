// Local-network WebRTC. No third-party TURN or STUN traffic is configured.
export class ScreenSharing {
  constructor(client, getVideo, onError) {
    this.client = client;
    this.getVideo = getVideo;
    this.onError = onError;
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
    this.peers.clear();
    this.offered.clear();
    this.candidates.clear();
  }
  async start() {
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
      try {
        await this.client.command("stream.start", {
          title: `${this.client.state.me.name}’s screen`,
          connectionId: this.client.connectionId,
        });
      } catch (error) {
        this.stopLocal();
        throw error;
      }
      stream.getVideoTracks()[0].onended = () =>
        this.stop().catch((error) => this.onError(error.message));
      const state = await this.client.api("state");
      this.sync(state);
    } finally {
      this.starting = false;
      this.client.emit("sharing");
    }
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
    const active = new Set(state.streams.map((s) => s.id));
    for (const [key, peer] of this.peers)
      if (!active.has(key.split(":")[0])) {
        peer.close();
        this.peers.delete(key);
      }
    for (const key of this.offered)
      if (!active.has(key.split(":")[0])) this.offered.delete(key);
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
    if (!["admin", "wall"].includes(state.me.role)) return;
    for (const stream of state.streams)
      if (
        stream.connectionId
          ? stream.connectionId !== this.client.connectionId
          : stream.ownerId !== state.me.id
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
    this.peers.set(key, peer);
    peer.onicecandidate = (event) => {
      if (event.candidate)
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
      const video = this.getVideo(streamId);
      if (!video) return;
      const stream = event.streams[0] || new MediaStream([event.track]);
      video.srcObject = stream;
      video
        .play()
        .catch(() => this.onError("Tap the screen tile to start playback."));
    };
    peer.onconnectionstatechange = () => {
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
      if (stream.ownerId !== state.me.id || !this.local) return;
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
