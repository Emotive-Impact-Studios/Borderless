export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  up: "M12 19V5m-6 6 6-6 6 6",
  wall: "M3 4h18v13H3zM8 21h8m-4-4v4",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h6",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m9 0V3m-5 5 5-5 5 5",
  note: "M4 4h16v12l-5 5H4zm11 17v-5h5M8 9h8m-8 4h5",
  pen: "m16 3 5 5-13 13H3v-5zM14 5l5 5",
  pointer: "m3 3 7 18 3-8 8-3z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  link: "m10 13 4-4m-5 8-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  expand: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  lock: "M5 11h14v10H5zm3 0V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5zm3 0V7a4 4 0 0 1 7-2",
  download: "M21 15v4H3v-4m9-12v12m-5-5 5 5 5-5",
  return: "M9 10 4 5l5-4M4 5h10a6 6 0 0 1 0 12h-3",
  hand: "M8 13V5a2 2 0 0 1 4 0v7m0-6a2 2 0 0 1 4 0v6m0-4a2 2 0 0 1 4 0v8a6 6 0 0 1-6 6h-2c-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l3 3",
  quiz: "M9 3h6v3H9zm-3 2H4v17h16V5h-2M8 11h8m-8 5h5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  play: "m8 4 12 8-12 8z",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  back: "m15 18-6-6 6-6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 7v6m0-9h.01",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  wifi: "M2 8a17 17 0 0 1 20 0M5 12a12 12 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01",
  undo: "M9 4 4 9l5 5M4 9h9a6 6 0 0 1 0 12",
  screen: "M3 4h18v13H3zM7 21h10m-5-4v4M9 10l3-3 3 3m-3-3v7",
  circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  chevron: "m9 5 7 7-7 7",
  moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10",
};
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.circle}"/></svg>`;
export const button = (action, label, symbol, classes = "", extra = "") =>
  `<button class="btn ${classes}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ""}<span>${label}</span></button>`;
export const bytes = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;
export function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  document.querySelector("#toasts").append(item);
  setTimeout(() => item.remove(), 5000);
}
let lastFocus;
function focusReference(element) {
  const keys = ["action", "id", "tab", "theme", "effect", "tool", "answer"];
  return { element, identity: keys.filter(key => element?.dataset?.[key] !== undefined).map(key => [key, element.dataset[key]]) };
}
function restoreFocus(reference, scope = document) {
  if (!reference) return;
  if (reference.element?.isConnected && !reference.element.disabled && reference.element.getClientRects().length) {
    reference.element.focus({ preventScroll: true });
    return;
  }
  const replacement = [...scope.querySelectorAll("[data-action]")].find(element =>
    reference.identity.length && reference.identity.every(([key, value]) => element.dataset[key] === value) &&
    !element.disabled && element.getClientRects().length);
  (replacement || document.querySelector('#canvas-stage, [role="tab"][aria-selected="true"]'))?.focus({ preventScroll: true });
}
export function preserveFocus(container, render) {
  const reference = container.contains(document.activeElement) ? focusReference(document.activeElement) : null;
  try { return render(); }
  finally { if (reference && !reference.element.isConnected) restoreFocus(reference, container); }
}
function restoreDialogFocus() {
  const dialog = document.querySelector("#modal");
  if (dialog.open || !lastFocus) return;
  const reference = lastFocus;
  lastFocus = null;
  const active = document.activeElement;
  // The native close event is queued. Do not take focus away from a control the
  // user has already chosen after closing this dialog.
  if (!active || active === document.body || active === reference.element || dialog.contains(active))
    restoreFocus(reference);
}
globalThis.document?.querySelector("#modal")?.addEventListener("close", restoreDialogFocus);
export function modal(title, content, wide = false) {
  const el = document.querySelector("#modal");
  if (!el.open) lastFocus = focusReference(document.activeElement);
  el.className = wide ? "wide" : "";
  el.innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-action="modal.close" aria-label="Close dialog">${icon("close")}</button></div>${content}`;
  if (!el.open) el.showModal();
  el.querySelector(
    'input,textarea,select,button:not([data-action="modal.close"])',
  )?.focus();
}
export function closeModal() {
  document.querySelector("#modal").close();
  restoreDialogFocus();
}
export const empty = (symbol, title, description) =>
  `<div class="empty"><div class="empty-icon">${icon(symbol, 26)}</div><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`;
export function downloadBlob(content, name, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function timeLabel(at) {
  return new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
