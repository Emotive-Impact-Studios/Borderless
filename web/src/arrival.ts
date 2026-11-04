// Phone throw arrival (CODEX_BRIEF section 4, PRD B39). Every visible stage
// follows a real hub event: the spark appears when bytes start arriving, its
// ring follows real progress, and the vortex plays only when the stored file
// is already in the room state. Time-driven, interruptible and bounded to the
// path between the spark and the landing window.

export type TransferStart = { id: string; name: string; aim: number | null; ownerId: string; ownerName: string; colour: string };
type Pending = TransferStart & { spark: HTMLElement; ring: SVGCircleElement; label: HTMLElement; x: number; y: number; landed: boolean };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const legacy: Record<string, string> = { '#c76a39': 'orange', '#327c76': 'teal', '#7570b3': 'purple', '#c14b74': 'pink', '#397cba': 'blue', '#ae8428': 'gold' };
const colours = ['blue', 'orange', 'green', 'pink', 'purple', 'teal', 'gold', 'indigo'];

/** The same owner always gets the same design-system colour token. */
export function ownerColour(ownerId: string, colour?: string) {
  const index = Array.from(ownerId).reduce((sum, c) => sum + c.charCodeAt(0), 0) % colours.length;
  return `var(--bl-owner-${legacy[colour?.toLowerCase() ?? ''] ?? colours[index]})`;
}

export class Arrivals {
  private readonly pending = new Map<string, Pending>();
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d')!;
  private bursts: { started: number; from: { x: number; y: number }; to: DOMRect; colour: string; seeds: Float32Array }[] = [];
  private frame = 0;
  constructor(private readonly wall: HTMLElement) {
    this.canvas.className = 'bl-arrival-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    wall.append(this.canvas);
  }

  start(event: TransferStart) {
    if (this.pending.has(event.id)) return;
    const aim = typeof event.aim === 'number' && Number.isFinite(event.aim) ? Math.min(.94, Math.max(.06, event.aim)) : .5;
    const spark = document.createElement('div');
    spark.className = 'bl-incoming';
    spark.style.setProperty('--o', ownerColour(event.ownerId, event.colour));
    spark.style.left = `${aim * 100}%`; spark.style.top = '42%';
    const dot = document.createElement('i'); dot.className = 'bl-spark';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48'); svg.classList.add('bl-incoming__ring');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', '24'); ring.setAttribute('cy', '24'); ring.setAttribute('r', '21'); ring.setAttribute('pathLength', '100');
    ring.style.strokeDasharray = '0 100';
    svg.append(ring);
    const label = document.createElement('span'); label.className = 'bl-incoming__label bl-glass';
    label.textContent = `${event.ownerName} · ${event.name}`;
    spark.setAttribute('role', 'status');
    spark.append(svg, dot, label);
    this.wall.append(spark);
    const box = this.wall.getBoundingClientRect();
    this.pending.set(event.id, { ...event, spark, ring, label, x: aim * box.width, y: .42 * box.height, landed: false });
  }

  progress(id: string, value: number) {
    const item = this.pending.get(id);
    if (item && Number.isFinite(value)) item.ring.style.strokeDasharray = `${Math.round(Math.min(1, Math.max(0, value)) * 100)} 100`;
  }

  /** A new file window appeared in the authoritative state. Returns true if a vortex will reveal it. */
  land(ownerId: string, title: string, target: HTMLElement) {
    const item = [...this.pending.values()].find(p => !p.landed && p.ownerId === ownerId && p.name === title);
    target.style.setProperty('--o', target.style.getPropertyValue('--o') || ownerColour(ownerId));
    if (!item) { target.classList.add('bl-arrive'); return false; }
    item.landed = true;
    item.ring.style.strokeDasharray = '100 100';
    const colour = getComputedStyle(item.spark).getPropertyValue('--o').trim() || '#0A6FE0';
    item.spark.classList.add('bl-incoming--leaving');
    setTimeout(() => item.spark.remove(), 400);
    this.pending.delete(item.id);
    if (reduced()) { target.classList.add('bl-arrive'); return true; }
    target.classList.add('bl-arrival-hidden');
    const wallBox = this.wall.getBoundingClientRect(), box = target.getBoundingClientRect();
    const to = new DOMRect(box.x - wallBox.x, box.y - wallBox.y, box.width, box.height);
    const seeds = new Float32Array(160 * 4).map(() => Math.random());
    this.bursts.push({ started: performance.now(), from: { x: item.x, y: item.y }, to, colour, seeds });
    // The window resolves from the converging particles part way through.
    setTimeout(() => {
      target.classList.remove('bl-arrival-hidden'); target.classList.add('bl-arrive');
      const ripple = document.createElement('div'); ripple.className = 'bl-ripple';
      ripple.style.setProperty('--o', colour);
      ripple.style.left = `${to.x + to.width / 2}px`; ripple.style.top = `${to.y + to.height / 2}px`;
      this.wall.append(ripple); setTimeout(() => ripple.remove(), 1200);
    }, 520);
    if (!this.frame) this.frame = requestAnimationFrame(t => this.draw(t));
    return true;
  }

  end(id: string, ok: boolean) {
    const item = this.pending.get(id);
    if (!item) return;
    this.pending.delete(id);
    if (ok) { item.spark.classList.add('bl-incoming--leaving'); setTimeout(() => item.spark.remove(), 400); return; }
    item.label.textContent = `${item.name} did not arrive`;
    item.spark.classList.add('bl-incoming--failed');
    setTimeout(() => item.spark.remove(), 2600);
  }

  clear() {
    for (const item of this.pending.values()) item.spark.remove();
    this.pending.clear(); this.bursts = [];
  }

  private draw(now: number) {
    const ratio = devicePixelRatio || 1, box = this.wall.getBoundingClientRect();
    if (this.canvas.width !== Math.round(box.width * ratio) || this.canvas.height !== Math.round(box.height * ratio)) {
      this.canvas.width = Math.round(box.width * ratio); this.canvas.height = Math.round(box.height * ratio);
    }
    const c = this.context;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, box.width, box.height);
    const duration = 900;
    this.bursts = this.bursts.filter(b => now - b.started < duration);
    for (const burst of this.bursts) {
      const t = Math.min(1, (now - burst.started) / duration);
      c.fillStyle = burst.colour;
      for (let i = 0; i < burst.seeds.length; i += 4) {
        const [a, b, d, e] = [burst.seeds[i], burst.seeds[i + 1], burst.seeds[i + 2], burst.seeds[i + 3]];
        // Each particle starts at its own moment, swirls round the spark, then
        // spirals into its own point inside the landing window.
        const local = Math.min(1, Math.max(0, (t - a * .25) / .75));
        const k = local < .5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
        const tx = burst.to.x + burst.to.width * (.1 + .8 * b), ty = burst.to.y + burst.to.height * (.1 + .8 * d);
        const swirl = (1 - k) * (24 + 56 * e), angle = a * Math.PI * 2 + k * Math.PI * 3;
        const x = burst.from.x + (tx - burst.from.x) * k + Math.cos(angle) * swirl;
        const y = burst.from.y + (ty - burst.from.y) * k + Math.sin(angle) * swirl;
        c.globalAlpha = Math.min(1, local * 4) * (1 - Math.max(0, (local - .8) / .2));
        c.beginPath(); c.arc(x, y, 1.2 + 2.4 * e * (1 - k * .6), 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    this.frame = this.bursts.length ? requestAnimationFrame(t => this.draw(t)) : 0;
    if (!this.frame) c.clearRect(0, 0, box.width, box.height);
  }
}
