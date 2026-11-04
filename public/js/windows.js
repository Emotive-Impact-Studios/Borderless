import { icon } from "./ui.js";

// Per-browser utility geometry. These controls never shrink the shared canvas
// and never write window preferences into another participant's room state.
export class UtilityWindows {
  constructor(element, key, onChange = () => {}) {
    this.element = element;
    this.key = `borderless:windows:${key}`;
    this.onChange = onChange;
    this.windows = new Map();
    this.input = new AbortController();
    try {
      const value = JSON.parse(sessionStorage.getItem(this.key));
      this.saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    catch { this.saved = {}; }
    this.observer = new ResizeObserver(() => {
      for (const entry of this.windows.values()) this.fit(entry);
    });
    this.observer.observe(element);
  }
  isOpen(id) { return Boolean(this.windows.get(id) && !this.windows.get(id).root.hidden); }
  open(id, title, render, opener) {
    let entry = this.windows.get(id);
    if (!entry) {
      const root = document.createElement("section");
      root.className = "utility-window";
      root.dataset.window = id;
      root.setAttribute("role", "region");
      root.setAttribute("aria-label", `${title} window`);
      root.innerHTML = `<header class="utility-titlebar"><button type="button" class="utility-drag" aria-describedby="utility-keyboard-help"></button><button type="button" class="icon-btn utility-close">${icon("close", 17)}</button></header><div class="utility-content"></div><button type="button" class="utility-resize">${icon("expand", 13)}</button>`;
      const handle = root.querySelector(".utility-drag");
      handle.textContent = title;
      handle.setAttribute("aria-label", `Move ${title} window`);
      root.querySelector(".utility-close").setAttribute("aria-label", `Close ${title} window`);
      root.querySelector(".utility-resize").setAttribute("aria-label", `Resize ${title} window`);
      const offset = this.windows.size * 24;
      const saved = this.saved[id];
      const size = this.size();
      const bounds = saved && ["x", "y", "w", "h"].every(key => Number.isFinite(saved[key]))
        ? { x: saved.x * size.w, y: saved.y * size.h, w: saved.w * size.w, h: saved.h * size.h }
        : { x: size.w - 372 - offset, y: 80 + offset, w: 348, h: Math.min(540, size.h - 112) };
      entry = { root, body: root.querySelector(".utility-content"), bounds, id, title, render, opener };
      this.windows.set(id, entry);
      this.element.append(root);
      const options = { signal: this.input.signal };
      root.addEventListener("focusin", () => this.raise(entry), options);
      root.addEventListener("pointerdown", () => this.raise(entry), options);
      root.querySelector(".utility-close").addEventListener("click", () => this.close(id), options);
      this.bind(entry, handle, false);
      this.bind(entry, root.querySelector(".utility-resize"), true);
    }
    entry.opener = opener || entry.opener;
    entry.root.hidden = false;
    this.fit(entry);
    this.raise(entry);
    render(entry.body, id);
    entry.root.querySelector(".utility-drag").focus({ preventScroll: true });
    this.persist(entry);
    this.onChange();
    return entry;
  }
  close(id, { restoreFocus = true } = {}) {
    const entry = this.windows.get(id);
    if (!entry || entry.root.hidden) return;
    const hadFocus = entry.root.contains(document.activeElement);
    entry.root.hidden = true;
    this.persist(entry);
    if (hadFocus && restoreFocus)
      (entry.opener?.isConnected ? entry.opener : document.querySelector("#canvas-stage"))?.focus({ preventScroll: true });
    this.onChange();
  }
  toggle(id, title, render, opener) {
    if (this.isOpen(id)) this.close(id);
    else this.open(id, title, render, opener);
  }
  size() { return { w: this.element.clientWidth, h: this.element.clientHeight }; }
  fit(entry) {
    const { w, h } = this.size(), gap = 12, bounds = entry.bounds;
    const cap = (value, min, max) => Math.max(min, Math.min(max, value));
    bounds.w = cap(bounds.w, Math.min(300, w - gap * 2), w - gap * 2);
    bounds.h = cap(bounds.h, Math.min(220, h - gap * 2), h - gap * 2);
    bounds.x = cap(bounds.x, gap, w - bounds.w - gap);
    bounds.y = cap(bounds.y, gap, h - bounds.h - gap);
    Object.assign(entry.root.style, { left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.w}px`, height: `${bounds.h}px` });
  }
  raise(entry) {
    // Only a handful of utility windows exist; keep their CSS order bounded.
    const ordered = [...this.windows.values()].filter(value => value !== entry)
      .sort((a, b) => Number(a.root.style.zIndex) - Number(b.root.style.zIndex));
    [...ordered, entry].forEach((value, index) => { value.root.style.zIndex = index + 40; });
  }
  persist(entry) {
    const { w, h } = this.size();
    this.saved[entry.id] = { x: entry.bounds.x / w, y: entry.bounds.y / h, w: entry.bounds.w / w, h: entry.bounds.h / h };
    try { sessionStorage.setItem(this.key, JSON.stringify(this.saved)); } catch { /* Preferences must not block collaboration. */ }
  }
  bind(entry, handle, resize) {
    const options = { signal: this.input.signal };
    let start;
    const change = (dx, dy, from) => {
      entry.bounds = resize ? { ...from, w: from.w + dx, h: from.h + dy } : { ...from, x: from.x + dx, y: from.y + dy };
      this.fit(entry);
    };
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      start = { pointer: event.pointerId, x: event.clientX, y: event.clientY, bounds: { ...entry.bounds } };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      event.preventDefault();
    }, options);
    handle.addEventListener("pointermove", event => {
      if (start) change(event.clientX - start.x, event.clientY - start.y, start.bounds);
    }, options);
    handle.addEventListener("pointerup", event => {
      if (!start) return;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      start = null;
      this.persist(entry);
    }, options);
    handle.addEventListener("pointercancel", () => {
      if (start) { entry.bounds = start.bounds; this.fit(entry); start = null; }
    }, options);
    handle.addEventListener("keydown", event => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      const step = event.shiftKey ? 40 : 10;
      change(direction[0] * step, direction[1] * step, entry.bounds);
      this.persist(entry);
    }, options);
  }
  destroy() {
    this.input.abort();
    this.observer.disconnect();
    for (const entry of this.windows.values()) entry.root.remove();
    this.windows.clear();
  }
}
