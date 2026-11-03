// Room-owned geometry. Local utility windows never enter this shared model.
export const minimumSurfaceSize = 0.08;
export const surfaces = (state) => [...state.items, ...state.streams];

export function raiseSurface(state, surface) {
  const ordered = surfaces(state).map((value, index) => ({ value, order: value.z ?? index + 1 }))
    .sort((a, b) => a.order - b.order).map(entry => entry.value);
  [...ordered.filter(value => value !== surface), surface].forEach((value, index) => { value.z = index + 1; });
}

export function focusSurface(state, surface) {
  if (surface.restoreBounds) {
    Object.assign(surface, surface.restoreBounds);
    delete surface.restoreBounds;
  } else {
    surface.restoreBounds = Object.fromEntries(["x", "y", "w", "h"].map(key => [key, surface[key]]));
    Object.assign(surface, { x: .04, y: .08, w: .92, h: .84 });
  }
  surface.version++;
  raiseSurface(state, surface);
}

export function arrangeScene(state) {
  const all = surfaces(state);
  if (!all.length) return;
  const cols = Math.min(8, Math.ceil(Math.sqrt(all.length * 16 / 9)));
  const rows = Math.ceil(all.length / cols);
  const w = Math.min(.46, 1 / cols - .024), h = Math.min(.56, 1 / rows - .024);
  all.forEach((surface, index) => {
    const column = index % cols, row = Math.floor(index / cols);
    Object.assign(surface, { x: column / cols + (1 / cols - w) / 2, y: row / rows + (1 / rows - h) / 2, w, h, version: surface.version + 1 });
    delete surface.restoreBounds;
  });
}
