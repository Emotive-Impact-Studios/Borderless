export class RoomClient extends EventTarget {
  constructor(roomId) {
    super();
    this.roomId = roomId;
    this.state = null;
    this.socket = null;
    this.retry = 0;
    this.closed = false;
    this.latency = null;
    this.pending = 0;
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
  async api(route, { method = "GET", body, headers = {}, ...rest } = {}) {
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
    return response.json();
  }
  async connect() {
    this.state = await this.api("state");
    this.emit("state", this.state);
    this.openSocket();
    return this.state;
  }
  openSocket() {
    if (this.closed) return;
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${this.roomId}/live`,
    );
    this.socket = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.emit("connection", "online");
      this.heartbeat = setInterval(
        () => this.send({ type: "ping", at: Date.now() }),
        15000,
      );
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "hello") {
          this.connectionId = data.connectionId;
        } else if (data.type === "state") {
          this.state = data.state;
          this.emit("state", data.state);
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
      clearInterval(this.heartbeat);
      this.connectionId = null;
      this.emit("connection", event.code === 4001 ? "revoked" : "offline");
      if (this.closed || event.code === 4001) return;
      const delay =
        Math.min(15000, 1000 * 2 ** this.retry++) + Math.random() * 500;
      this.retryTimer = setTimeout(() => this.openSocket(), delay);
    };
  }
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
  async command(type, data = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN)
      throw new Error("You are offline. Reconnect before changing the wall.");
    const commandId = crypto.randomUUID();
    this.pending++;
    try {
      return await this.api("command", {
        method: "POST",
        body: { type, ...data, commandId },
      });
    } finally {
      this.pending--;
    }
  }
  upload(file, onProgress) {
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
            "Connection lost during the transfer. Reconnect and send the file again.",
          ),
        );
      request.ontimeout = () =>
        reject(
          new Error(
            "The transfer timed out. Try a smaller file or a faster connection.",
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
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
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
