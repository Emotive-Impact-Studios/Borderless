// Fails the build if any theme breaks the contrast rules in docs/PRINCIPLES.md:
// text 4.5:1, muted text 4.5:1 on surface, owner colours and accent 3:1 on surface and wall.
import { themes, owners } from '../tokens/source.mjs';

const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let failures = 0;
const check = (theme, what, fg, bg, min) => {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(10)} ${what.padEnd(26)} ${r.toFixed(2)} (min ${min})`);
};
for (const [name, t] of Object.entries(themes)) {
  const c = t.color;
  for (const bg of ['surface', 'wall']) {
    check(name, `ink on ${bg}`, c.ink, c[bg], 4.5);
    check(name, `inkMuted on ${bg}`, c.inkMuted, c[bg], 4.5);
    check(name, `accent on ${bg}`, c.accent, c[bg], 3);
    check(name, `live on ${bg}`, c.live, c[bg], 3);
    for (const [o, v] of Object.entries(owners[t.mode])) check(name, `owner ${o} on ${bg}`, v, c[bg], 3);
  }
  check(name, 'accentInk on accent', c.accentInk, c.accent, 4.5);
}
console.log(failures ? `\n${failures} contrast failures` : '\nAll contrast checks pass');
process.exit(failures ? 1 : 0);
