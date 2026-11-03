import { esc, icon, bytes, toast } from "./ui.js";
import { LandingEffects } from "./effects.js";

export class Board {
  constructor(
    element,
    client,
    { display = false, onSelect = () => {}, onFile = () => {} } = {},
  ) {
    this.element = element;
    this.client = client;
    this.display = display;
    this.onSelect = onSelect;
    this.onFile = onFile;
    this.mode = "select";
    this.zoom = 1;
    this.nodes = new Map();
    this.pointers = new Map();
    element.innerHTML = `<p id="canvas-keyboard-help" class="sr-only">Press Enter or Space to open a contribution. Owners and room leaders can use arrow keys to move it, Alt and arrow keys to resize, and Shift for larger steps.</p><div class="canvas-world"><div class="items-layer"></div><svg class="ink-layer" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"></svg><div class="pointer-layer"></div><canvas class="effects-layer" aria-hidden="true"></canvas></div><div class="canvas-empty"></div><div class="stream-dock"></div><div class="board-drop-overlay">${icon("upload", 44)}<h2>Make the leap.</h2><p>Drop your files onto the shared canvas.</p></div><div class="sr-only board-announcement" role="status" aria-live="polite" aria-atomic="true"></div>`;
    this.world = element.querySelector(".canvas-world");
    this.items = element.querySelector(".items-layer");
    this.ink = element.querySelector(".ink-layer");
    this.pointerLayer = element.querySelector(".pointer-layer");
    this.effects = new LandingEffects(element.querySelector("canvas"));
    this.input = new AbortController();
    const signal = this.input.signal;
    element.addEventListener("pointerdown", this.down, { signal });
    element.addEventListener("pointermove", this.move, { signal });
    element.addEventListener("pointerup", this.up, { signal });
    element.addEventListener("pointercancel", this.cancel, { signal });
    element.addEventListener("keydown", this.keydown, { signal });
    element.addEventListener(
      "dblclick",
      (event) => {
        const item = event.target.closest("[data-item]");
        if (item) this.onSelect(item.dataset.item);
      },
      { signal },
    );
    element.addEventListener(
      "dragover",
      (event) => {
        if (this.display) return;
        event.preventDefault();
        element.classList.add("dragging-file");
      },
      { signal },
    );
    element.addEventListener(
      "dragleave",
      (event) => {
        if (!element.contains(event.relatedTarget))
          element.classList.remove("dragging-file");
      },
      { signal },
    );
    element.addEventListener(
      "drop",
      (event) => {
        if (this.display) return;
        event.preventDefault();
        element.classList.remove("dragging-file");
        this.onFile([...event.dataTransfer.files]);
      },
      { signal },
    );
    client.addEventListener("pointer", (event) => this.pointer(event.detail), {
      signal,
    });
    client.addEventListener(
      "canvas.cleared",
      () => {
        this.pointerLayer.innerHTML = "";
        this.pointers.clear();
      },
      { signal },
    );
    this.sweep = setInterval(() => {
      for (const [id, p] of this.pointers)
        if (Date.now() - p.at > 2500) {
          p.el.remove();
          this.pointers.delete(id);
        }
    }, 1000);
  }
  setMode(mode) {
    this.mode = mode;
    this.element.dataset.tool = mode;
  }
  keydown = async (event) => {
    const node = event.target.closest("[data-item]");
    if (!node || event.target !== node || !this.state || event.ctrlKey || event.metaKey) return;
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      this.onSelect(node.dataset.item);
      return;
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const item = this.state.items.find(item => item.id === node.dataset.item);
    const announce = message => { this.element.querySelector(".board-announcement").textContent = message; };
    if (!item) return;
    if (this.display || (item.ownerId !== this.state.me.id && this.state.me.role !== "admin")) {
      announce("Only the owner or room leader can arrange this contribution.");
      return;
    }
    if (this.keyPending) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    const [dx, dy] = direction.map(value => value * step);
    const resize = event.altKey;
    const geometry = resize ? {
      w: Math.max(.12, Math.min(1 - item.x, item.w + dx)),
      h: Math.max(.12, Math.min(1 - item.y, item.h + dy)),
    } : {
      x: Math.max(0, Math.min(1 - item.w, item.x + dx)),
      y: Math.max(0, Math.min(1 - item.h, item.y + dy)),
    };
    this.keyPending = true;
    try {
      await this.client.command(resize ? "item.resize" : "item.move", { itemId: item.id, version: item.version, ...geometry });
      announce(resize
        ? `${item.title} resized to ${Math.round(geometry.w * 100)} by ${Math.round(geometry.h * 100)} percent.`
        : `${item.title} moved to ${Math.round(geometry.x * 100)} percent across, ${Math.round(geometry.y * 100)} percent down.`);
    } catch (error) {
      announce(error.message);
      toast(error.message, true);
    } finally {
      this.keyPending = false;
    }
  };
  setZoom(value) {
    this.zoom = value;
    this.world.style.transform = `scale(${value})`;
  }
  point(event) {
    const r = this.world.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    ];
  }
  down = (event) => {
    if (
      this.display ||
      event.button !== 0 ||
      !this.state ||
      event.target.closest("button,a,video,audio,input,iframe")
    )
      return;
    const [x, y] = this.point(event);
    if (this.mode === "pen") {
      if (!this.state.me.canDraw) {
        toast("Ask the room leader for drawing permission.", true);
        return;
      }
      this.stroke = [[x, y]];
      this.element.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (this.mode === "pointer") {
      this.pointing = true;
      this.element.setPointerCapture(event.pointerId);
      this.client.send({ type: "pointer", x, y, active: true });
      return;
    }
    const target = event.target.closest("[data-item]");
    if (target) {
      const item = this.state.items.find((i) => i.id === target.dataset.item);
      if (item.ownerId !== this.state.me.id && this.state.me.role !== "admin") {
        this.onSelect(item.id);
        return;
      }
      this.drag = {
        item,
        el: target,
        x,
        y,
        originalX: item.x,
        originalY: item.y,
        resize: Boolean(event.target.closest(".resize-handle")),
      };
      target.classList.add("moving");
      this.element.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  };
  move = (event) => {
    const [x, y] = this.point(event);
    if (this.stroke) {
      const last = this.stroke.at(-1);
      if (Math.hypot(x - last[0], y - last[1]) > 0.0015) {
        this.stroke.push([x, y]);
        if (this.stroke.length >= 250)
          this.stroke = this.stroke.filter((_, i) => i % 2 === 0);
        this.paintInk();
      }
      return;
    }
    if (this.pointing) {
      const at = performance.now();
      if (!this.lastPointer || at - this.lastPointer > 20) {
        this.client.send({ type: "pointer", x, y, active: true });
        this.lastPointer = at;
      }
      return;
    }
    if (this.drag) {
      const d = this.drag;
      if (d.resize) {
        d.w = Math.max(0.12, Math.min(1 - d.item.x, d.item.w + x - d.x));
        d.h = Math.max(0.12, Math.min(1 - d.item.y, d.item.h + y - d.y));
        d.el.style.width = `${d.w * 100}%`;
        d.el.style.height = `${d.h * 100}%`;
      } else {
        d.targetX = Math.max(0, Math.min(1 - d.item.w, d.originalX + x - d.x));
        d.targetY = Math.max(0, Math.min(1 - d.item.h, d.originalY + y - d.y));
        d.el.style.left = `${d.targetX * 100}%`;
        d.el.style.top = `${d.targetY * 100}%`;
      }
    }
  };
  up = async (event) => {
    if (this.element.hasPointerCapture(event.pointerId))
      this.element.releasePointerCapture(event.pointerId);
    if (this.stroke) {
      const points = this.stroke;
      this.stroke = null;
      this.paintInk();
      if (points.length > 1)
        try {
          await this.client.command("stroke.add", { points, width: 3 });
        } catch (error) {
          toast(error.message, true);
        }
      return;
    }
    if (this.pointing) {
      this.pointing = false;
      const [x, y] = this.point(event);
      this.client.send({ type: "pointer", x, y, active: false });
      return;
    }
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      d.el.classList.remove("moving");
      try {
        if (d.resize && d.w)
          await this.client.command("item.resize", {
            itemId: d.item.id,
            version: d.item.version,
            w: d.w,
            h: d.h,
          });
        else if (d.targetX !== undefined)
          await this.client.command("item.move", {
            itemId: d.item.id,
            version: d.item.version,
            x: d.targetX,
            y: d.targetY,
          });
      } catch (error) {
        toast(error.message, true);
        this.update(this.client.state);
      }
    }
  };
  cancel = () => {
    if (this.pointing) this.client.send({ type: "pointer", x: .5, y: .5, active: false });
    this.drag?.el.classList.remove("moving");
    this.drag = null;
    this.stroke = null;
    this.pointing = false;
    this.paintInk();
    if (this.state) this.update(this.state);
  };
  pointer(event) {
    let entry = this.pointers.get(event.device.id);
    if (!event.active) {
      entry?.el.remove();
      this.pointers.delete(event.device.id);
      return;
    }
    if (!entry) {
      const el = document.createElement("div");
      el.className = "remote-pointer";
      el.style.setProperty("--pointer-colour", event.device.colour);
      el.innerHTML = `<i></i><span>${esc(event.device.name)}</span>`;
      this.pointerLayer.append(el);
      entry = { el };
      this.pointers.set(event.device.id, entry);
    }
    entry.el.style.left = `${event.x * 100}%`;
    entry.el.style.top = `${event.y * 100}%`;
    entry.at = Date.now();
  }
  update(state) {
    const first = !this.state;
    this.state = state;
    this.element.dataset.theme = state.theme;
    const ids = new Set(state.items.map((i) => i.id));
    for (const [itemId, node] of this.nodes)
      if (!ids.has(itemId)) {
        if (node.contains(document.activeElement)) this.element.focus({ preventScroll: true });
        node.remove();
        this.nodes.delete(itemId);
      }
    state.items.forEach((item, index) => {
      let node = this.nodes.get(item.id);
      const isNew = !node;
      if (!node) {
        node = document.createElement("article");
        node.className = `canvas-item ${item.kind === "note" ? "note-item" : "file-item"}`;
        node.dataset.item = item.id;
        node.tabIndex = 0;
        node.setAttribute("role", "group");
        node.setAttribute("aria-describedby", "canvas-keyboard-help");
        this.nodes.set(item.id, node);
        this.items.append(node);
      }
      node.style.zIndex = index + 1;
      node.setAttribute("aria-label", `${item.title}, by ${item.ownerName}`);
      node.style.setProperty("--owner-colour", item.colour);
      if (this.drag?.item.id !== item.id)
        Object.assign(node.style, {
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          width: `${item.w * 100}%`,
          height: `${item.h * 100}%`,
        });
      if (node.dataset.version !== String(item.version)) {
        const focusedAction = node.contains(document.activeElement) ? document.activeElement.dataset.action : null;
        const asset = this.client.assetURL(item.assetId);
        let preview = "";
        if (item.kind === "note")
          preview = `<div class="note-text">${esc(item.text)}</div>`;
        else if (item.mime.startsWith("image/"))
          preview = `<img src="${asset}" alt="${esc(item.title)}" draggable="false" loading="lazy">`;
        else if (item.mime.startsWith("video/"))
          preview = `<video src="${asset}" controls playsinline preload="metadata" aria-label="${esc(item.title)}"></video>`;
        else if (item.mime.startsWith("audio/"))
          preview = `<div class="audio-preview">${icon("play", 32)}<audio src="${asset}" controls preload="metadata" aria-label="${esc(item.title)}"></audio></div>`;
        else
          preview = `<div class="document-preview"><span>${esc(item.title.split(".").at(-1).toUpperCase())}</span><strong>${esc(item.title)}</strong><small>${bytes(item.size)} · Open to view</small></div>`;
        node.innerHTML = `<div class="item-bar"><span class="owner-dot"></span><span>${esc(item.ownerName)}</span><button class="item-open" data-action="item.open" data-id="${item.id}" aria-label="Open ${esc(item.title)}">${icon("expand", 14)}</button></div><div class="item-preview">${preview}</div><div class="item-caption">${esc(item.title)}</div><span class="resize-handle" aria-hidden="true"></span>`;
        node.dataset.version = item.version;
        if (focusedAction === "item.open") node.querySelector(".item-open").focus({ preventScroll: true });
      }
      if (isNew && !first)
        this.effects.play(
          item.x + item.w / 2,
          item.y + item.h / 2,
          item.colour,
          state.effect,
        );
    });
    const empty = this.element.querySelector(".canvas-empty");
    empty.hidden =
      state.items.length > 0 ||
      state.streams.length > 0 ||
      state.strokes.length > 0;
    empty.innerHTML = `<div class="canvas-empty-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span>${icon("spark", 30)}</span></div><div class="eyebrow">A little space. A lot of possibility.</div><h2>Every idea belongs here.</h2><p>${this.display ? "Join the room to send a file, share a screen or add your perspective." : "Drop a file, leave a thought, or bring your screen into the room."}</p>${!this.display ? '<button class="text-btn" data-action="note.add">Add the first thought ' + icon("arrow", 16) + "</button>" : ""}`;
    this.paintInk();
    const dock = this.element.querySelector(".stream-dock");
    const streamIds = new Set(state.streams.map((x) => x.id));
    for (const tile of dock.querySelectorAll("[data-stream]"))
      if (!streamIds.has(tile.dataset.stream)) tile.remove();
    for (const stream of state.streams) {
      if (dock.querySelector(`[data-stream="${stream.id}"]`)) continue;
      const tile = document.createElement("div");
      tile.className = "stream-tile";
      tile.dataset.stream = stream.id;
      tile.innerHTML = `<div class="stream-label"><span class="live-pulse"></span>${esc(stream.title)}</div><video autoplay playsinline muted aria-label="${esc(stream.title)}"></video><button class="stream-audio" data-action="stream.audio" data-id="${stream.id}">Enable audio</button>`;
      dock.append(tile);
    }
  }
  paintInk() {
    const path = (points) =>
      points
        .map(
          (p, i) =>
            `${i ? "L" : "M"}${(p[0] * 1920).toFixed(1)} ${(p[1] * 1080).toFixed(1)}`,
        )
        .join(" ");
    this.ink.innerHTML =
      (this.state?.strokes || [])
        .map(
          (s) =>
            `<path d="${path(s.points)}" stroke="${s.colour}" stroke-width="${s.width * 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join("") +
      (this.stroke
        ? `<path d="${path(this.stroke)}" stroke="${this.state.me.colour}" stroke-width="6" fill="none" stroke-linecap="round"/>`
        : "");
  }
  destroy() {
    this.input.abort();
    clearInterval(this.sweep);
    this.effects.destroy();
  }
}
