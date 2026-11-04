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

// Find the closest free rectangle to the intended centre. A separating edge
// of an existing surface or the Wall bounds defines each candidate position.
export function filePlacement(state, centre, fallbackY) {
  const occupied = surfaces(state).filter(s => s.audience !== 'private');
  for (const scale of [1, .8, .6, .4]) {
    const w = .28 * scale, h = .36 * scale;
    const clamp = (n, max) => Math.max(0, Math.min(max, n));
    const x = clamp(centre - w / 2, 1 - w), y = clamp(fallbackY, 1 - h);
    const xs = new Set([x, 0, 1-w]), ys = new Set([y, 0, 1-h]);
    for (const s of occupied) {
      xs.add(clamp(s.x+s.w+.016, 1-w)); xs.add(clamp(s.x-w-.016, 1-w));
      ys.add(clamp(s.y+s.h+.024, 1-h)); ys.add(clamp(s.y-h-.024, 1-h));
    }
    let best, distance = Infinity;
    for (const left of xs) for (const top of ys) {
      const d = (left-x)**2 + (top-y)**2;
      if (d >= distance || occupied.some(s => left < s.x+s.w && left+w > s.x && top < s.y+s.h && top+h > s.y)) continue;
      best = {x:left,y:top,w,h}; distance = d;
    }
    if (best) return best;
  }
  return null;
}
