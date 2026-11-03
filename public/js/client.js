export class RoomClient extends EventTarget {
  constructor(roomId, { requestTimeout = 10000, reconnectTimeout = 15000 } = {}) {
    super();
    this.roomId = roomId;
    this.state = null;
    this.socket = null;
    this.retry = 0;
    this.closed = false;
    this.latency = null;
    this.pending = 0;
    this.ready = false;
    this.connecting = false;
    this.generation = 0;
    this.connectionState = "connecting";
    this.requestTimeout = requestTimeout;
    this.reconnectTimeout = reconnectTimeout;
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
  async api(route, { method = "GET", body, headers = {}, ...rest } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);
    try {
      const response = await fetch(`/api/rooms/${this.roomId}/${route}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(method !== "GET" && this.state
            ? { "X-Borderless-CSRF": this.state.me.csrf }
            : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        ...rest,
      });
      if (!response.ok) {
        let data;
        try {
          data = await response.json();
        } catch {
          data = { error: "The hub could not receive this request." };
        }
        const error = new Error(data.error || "The request failed.");
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async connect() {
    await this.openSocket({ initial: true });
    return this.state;
  }
  connection(next) {
    if (this.connectionState === next) return;
    this.connectionState = next;
    this.emit("connection", next);
  }
  async openSocket({ initial = false } = {}) {
    if (this.closed || this.connecting || this.socket) return;
    const generation = ++this.generation;
    this.connecting = true;
    try {
      const snapshot = await this.api("state");
      if (this.closed || generation !== this.generation) return;
      this.state = snapshot;
      this.emit("state", snapshot);
    } catch (error) {
      if (generation !== this.generation || this.closed) return;
      this.connecting = false;
      if (initial) throw error;
      if (error.status === 401) this.revoke();
      else this.scheduleReconnect();
      return;
    }
    this.connecting = false;
    if (this.closed || generation !== this.generation) return;
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${this.roomId}/live`,
    );
    this.socket = ws;
    ws.onopen = () => {
      if (this.socket !== ws || this.closed) return;
      this.heartbeat = setInterval(
        () => this.send({ type: "ping", at: Date.now() }),
        15000,
      );
    };
    ws.onmessage = (event) => {
      if (this.socket !== ws || this.closed) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "hello") {
          this.connectionId = data.connectionId;
        } else if (data.type === "state") {
          this.state = data.state;
          this.ready = Boolean(this.connectionId);
          this.retry = 0;
          this.emit("state", data.state);
          if (this.ready) this.connection("online");
        } else if (data.type === "pong") {
          this.latency = Date.now() - data.at;
          this.emit("latency", this.latency);
        } else this.emit(data.type, data);
      } catch {
        this.emit("error", { error: "An invalid live update was ignored." });
      }
    };
    ws.onerror = () => {};
    ws.onclose = (event) => {
      if (this.socket !== ws) return;
      clearInterval(this.heartbeat);
      this.socket = null;
      this.ready = false;
      this.connectionId = null;
      if (this.closed) return;
      if (event.code === 4001) this.revoke();
      else this.scheduleReconnect();
    };
  }
  scheduleReconnect() {
    if (this.closed) return;
    this.connection("offline");
    clearTimeout(this.retryTimer);
    const delay = Math.min(15000, 1000 * 2 ** this.retry++) + Math.random() * 500;
    this.retryTimer = setTimeout(() => this.openSocket(), delay);
  }
  reconnectNow() {
    if (this.closed || this.ready) return;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.generation++;
    this.connecting = false;
    const previous = this.socket;
    this.socket = null;
    this.connectionId = null;
    previous?.close();
    return this.openSocket();
  }
  revoke() {
    this.close();
    this.connection("revoked");
  }
  whenReady() {
    if (this.closed) return Promise.reject(new Error("Your access has ended. Join again to continue."));
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        this.removeEventListener("connection", changed);
        this.removeEventListener("closed", ended);
        if (error) reject(error); else resolve();
      };
      const changed = (event) => {
        if (event.detail === "online") finish();
        if (event.detail === "revoked") ended();
      };
      const ended = () => finish(new Error("Your access has ended. Join again to continue."));
      const timer = setTimeout(() => finish(new Error("The hub has not reconnected. Check the canvas before trying again.")), this.reconnectTimeout);
      this.addEventListener("connection", changed);
      this.addEventListener("closed", ended);
    });
  }
  send(data) {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
  async command(type, data = {}) {
    if (!this.ready || this.closed || this.socket?.readyState !== WebSocket.OPEN)
      throw new Error("You are offline. Reconnect before changing the wall.");
    const commandId = crypto.randomUUID();
    const actorId = this.state.me.id;
    this.pending++;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) {
          await this.whenReady();
          if (this.state.me.id !== actorId)
            throw new Error("Your room identity changed. Check the canvas before trying again.");
        }
        try {
          return await this.api("command", {
            method: "POST",
            body: { type, ...data, commandId },
          });
        } catch (error) {
          if (error.status === 401) this.revoke();
          // A committed action may have lost its HTTP acknowledgement. One retry
          // reuses its receipt ID, and can never cross a session identity change.
          if (attempt || this.closed || (error.status && error.status < 500)) {
            if (!error.status && !this.closed)
              throw new Error("The hub could not confirm this change. Reconnect and check the canvas before trying again.", { cause: error });
            throw error;
          }
        }
      }
    } finally {
      this.pending--;
    }
  }
  upload(file, onProgress) {
    if (!this.ready || this.closed || this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error("You are offline. Reconnect before sending a file."));
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/rooms/${this.roomId}/upload`);
      request.setRequestHeader("X-Borderless-CSRF", this.state.me.csrf);
      request.setRequestHeader("X-Filename", encodeURIComponent(file.name));
      request.setRequestHeader("Content-Type", "application/octet-stream");
      request.timeout = 120000;
      request.upload.onprogress = (event) =>
        onProgress?.(event.lengthComputable ? event.loaded / event.total : 0);
      request.onload = () => {
        let data;
        try {
          data = JSON.parse(request.responseText);
        } catch {
          data = { error: "The transfer did not finish." };
        }
        if (request.status >= 200 && request.status < 300) resolve(data);
        else reject(new Error(data.error));
      };
      request.onerror = () =>
        reject(
          new Error(
            "The file receipt could not be confirmed. Reconnect and check the canvas before sending it again.",
          ),
        );
      request.ontimeout = () =>
        reject(
          new Error(
            "The transfer timed out. Check the canvas before sending the file again.",
          ),
        );
      request.send(file);
    });
  }
  assetURL(assetId, download = false) {
    return `/api/rooms/${this.roomId}/assets/${assetId}${download ? "?download=1" : ""}`;
  }
  close() {
    this.closed = true;
    this.ready = false;
    this.generation++;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.emit("closed");
  }
}
export async function createRoom(input) {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
