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

// PRD B46 smart layout. The hub owns it, so every Wall, Console and Portal
// sees the same arrangement. Private live windows never take part. A surface
// moved by hand while Auto is on is pinned: automatic re-layout on arrival
// works around it, and the leader re-applying a mode releases every pin.
const GAP = .016;
const fits = (s, r) => Object.assign(s, { x: r.x, y: r.y, w: r.w, h: r.h, version: s.version + 1 });
export function smartLayout(state, mode, { arrival = false } = {}) {
  const all = surfaces(state).filter(s => s.audience !== "private");
  if (!arrival) for (const s of all) delete s.pinned;
  const pinned = all.filter(s => s.pinned), free = all.filter(s => !s.pinned);
  if (!free.length) return;
  // Leave the bottom edge for the Wall's floating tools and room card.
  let region = { x: .02, y: .04, w: .96, h: .86 };
  if (pinned.length) {
    const left = Math.min(...pinned.map(p => p.x)), right = Math.max(...pinned.map(p => p.x + p.w));
    const before = left - region.x - GAP, after = region.x + region.w - right - GAP;
    region = after >= before ? { ...region, x: right + GAP, w: after } : { ...region, w: before };
    if (region.w < .15) return;
  }
  const { x: X, y: Y, w: W, h: H } = region;
  const lead = free.find(s => state.streams.includes(s)) || free.find(s => s.id === state.lead) || free.at(-1);
  const rest = free.filter(s => s !== lead);
  const row = (list, top, height) => {
    const w = (W - GAP * (list.length - 1)) / list.length;
    list.forEach((s, i) => fits(s, { x: X + i * (w + GAP), y: top, w, h: height }));
  };
  const grid = (list, r) => {
    let cols = Math.max(1, Math.ceil(Math.sqrt(list.length * (r.w * 16) / (r.h * 9))));
    while (cols > 1 && (cols - 1) * Math.ceil(list.length / cols) >= list.length) cols--;
    const rows = Math.ceil(list.length / cols);
    const w = (r.w - GAP * (cols - 1)) / cols, h = (r.h - GAP * (rows - 1)) / rows;
    list.forEach((s, i) => fits(s, { x: r.x + (i % cols) * (w + GAP), y: r.y + Math.floor(i / cols) * (h + GAP), w, h }));
  };
  if (mode === "side") {
    const w = (W - GAP * (free.length - 1)) / free.length, h = Math.min(H, w * 16 / 9 * 1.1);
    row(free, Y + (H - h) / 2, h);
  } else if (mode === "stack") {
    const owners = [...new Set(free.map(s => s.ownerId))];
    const cw = (W - GAP * (owners.length - 1)) / owners.length;
    owners.forEach((owner, column) => {
      const deck = free.filter(s => s.ownerId === owner), dx = Math.min(.012, cw / 20), dy = .03;
      deck.forEach((s, k) => {
        fits(s, { x: X + column * (cw + GAP) + k * dx, y: Y + k * dy, w: cw - (deck.length - 1) * dx, h: H * .86 - (deck.length - 1) * dy });
        raiseSurface(state, s);
      });
    });
  } else if (free.length === 1) {
    fits(lead, { x: X + W * .06, y: Y + H * .03, w: W * .88, h: H * .94 });
  } else if (free.length === 2) {
    row([lead, ...rest], Y, H);
  } else if (free.length === 4 && !state.streams.some(s => free.includes(s))) {
    grid([lead, ...rest], region);
  } else if (rest.length <= 4) {
    const lw = (W - GAP) * .64;
    fits(lead, { x: X, y: Y, w: lw, h: H });
    const ch = (H - GAP * (rest.length - 1)) / rest.length;
    rest.forEach((s, i) => fits(s, { x: X + lw + GAP, y: Y + i * (ch + GAP), w: W - lw - GAP, h: ch }));
  } else {
    const lw = (W - GAP) * .5;
    fits(lead, { x: X, y: Y, w: lw, h: H });
    grid(rest, { x: X + lw + GAP, y: Y, w: W - lw - GAP, h: H });
  }
  for (const s of free) delete s.restoreBounds;
}
