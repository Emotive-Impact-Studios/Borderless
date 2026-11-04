# Codex test checklist

Run this when the builder reports a milestone done. Record each result as **pass**, **fail** (with the output or a screenshot) or **not run** (with the reason) in `docs/BUILD_HANDOFF.md`. A passing automated suite never stands in for the device checks. Keep "compiles", "tests pass", "works on this Mac with real content" and "the user has seen it" separate (CODEX_BRIEF section 7, rule 6).

## 0. Setup

- Node 24 (`~/.volta/bin/node --version` reports 24.x). Google Chrome installed for the headless journeys.
- Never stop the user's review hub on 127.0.0.1:8444. Use a disposable hub on another port with its own data directory under `output/native/`:

```bash
BORDERLESS_DATA=$PWD/output/native/codex-check/data BORDERLESS_PORT=8455 node server/index.mjs
```

- The headless journeys import `playwright-core` from `output/native/m2/node_modules` (`npm ci` there first if missing). Run them from the repository root with `NODE_PATH=output/native/m2/node_modules`.

## 1. Automated gates

| # | Check | Command | Expected |
| --- | --- | --- | --- |
| A1 | Lint, build and integration tests | `npm run verify` | Exit 0, 80 or more tests, 0 failed |
| A2 | Native code | `DOTNET_ROOT=$HOME/.dotnet npm run native:verify` | "Native code checks passed" |
| A3 | Shared front end types | `cd web && npx tsc --noEmit` | No output, exit 0 |
| A4 | Source preserved | `shasum -a 256 -c docs/source/SHA256SUMS` from `docs/source/` | All OK |

## 2. Milestone 2: phone to Wall and back

### Headless journeys (hub on 8455)

| # | Script | Expected |
| --- | --- | --- |
| H1 | `node output/native/m2/arrival-journey.mjs` | Prints the spark label, a progress ring between 1 and 99, and "landed at". Screenshots `output/native/m2-arrival/1-incoming.png` (spark with ring at the aimed side), `2-vortex.png` (particles converging), `3-landed.png` (image window, owner name, no spark). |
| H2 | `node output/native/m2/link-journey.mjs` | `preview: "ready"` with the page title (needs internet). `link-wall.png` shows a readable card: site, title, address, owner. |
| H3 | `node output/native/m2/layout-journey.mjs` | Prints `"auto"`. `layout-auto-1..4.png` go one large, side by side, lead plus stack, two-by-two. `layout-stack.png` has one column per person. `layout-undo.png` matches `layout-auto-4.png`. No window overlaps another or leaves the screen. |
| H4 | `node output/native/m2/pdf-journey.mjs` (needs the 8444 review room file) | Short and sideways gestures send nothing; PDF pages 1 and 2 render; the chosen phone downloads identical bytes; the other phone has no invitation. |

### Behaviour to confirm by hand in a browser (Portal at 390 px with touch emulation, Wall at 1920×1080)

| # | Step | Expected |
| --- | --- | --- |
| M2-1 | Pick a photo, swipe up less than 55 px | Nothing sent, card springs back |
| M2-2 | Pick a photo, swipe mostly sideways | Nothing sent |
| M2-3 | Pick a photo, flick up on the left of the card | Spark appears on the left of the Wall with a filling ring, then a vortex in the sender's colour, then the image lands on the left |
| M2-4 | Rename a text file to `fake.png` and flick it | Wall spark reads "fake.png did not arrive"; nothing lands; phone shows the reason and can retry |
| M2-5 | Tap "Or send a link", enter `https://example.com`, flick | Card lands with "Example Domain" (online) or the host only (offline) |
| M2-6 | Send `javascript:alert(1)` or `http://user:pass@example.com` as a link | Refused with a plain message; nothing lands |
| M2-7 | Paste a link on the Portal outside a text field | Throw card shows the host and "Web link · Flick up or tap Send" |
| M2-8 | Console as leader: Auto, then add items from two phones | Wall rearranges on each arrival and windows glide |
| M2-9 | Under Auto, drag one window by hand, then add another item | The dragged window stays put; the rest lay out beside it |
| M2-10 | Stack by person, then Undo | One deck per person; Undo returns the previous arrangement |
| M2-11 | A participant (not leader) opens the Console | No layout control; `room.layout` returns 403 |
| M2-12 | Add a thought from a phone | It appears on the Wall as a flat card at readable size |
| M2-13 | Console: Send back on a file, choose one phone | Only that phone's inbox shows it; the download matches the original bytes |
| M2-14 | System setting Reduce Motion on | No vortex or gliding; items cross-fade in |

### Security checks

| # | Check | Expected |
| --- | --- | --- |
| S1 | `link.add` with a host that resolves to 127.0.0.1, 10.x, 192.168.x, 169.254.169.254, `::1` or `::ffff:127.0.0.1` | Card lands with preview `unavailable`; the hub makes no request to that address (watch with `lsof -i` or a listener on the port) |
| S2 | A public page that redirects to a private address | Preview `unavailable` |
| S3 | A page whose `<title>` contains HTML or script | Shown as plain text on the Wall, never executed |
| S4 | Transfer events on the room socket | Contain only id, file name, aim, owner id, owner name and colour; no file bytes or paths |

### Physical devices (needs the user)

| # | Step | Expected |
| --- | --- | --- |
| P1 | Real iPhone and Android phone join by QR over trusted HTTPS (`output/native/m2-phone/start.sh` after the review CA is trusted) | Portal opens without certificate warnings |
| P2 | Flick a photo and a PDF from each phone | Leaves the phone, lands on the Tauri Wall on monitor two where aimed, readable and movable |
| P3 | Flick a link copied from the phone's browser | Preview card on the Wall |
| P4 | Send one file back to one phone | Saved on that phone; the other phone has nothing |
| P5 | Short or sideways swipe on a real phone | Nothing sent |

The live, scrollable web page view for links (PRD B42) is not built; it waits for the Tauri shell evaluation. Mark it **not built**, not failed.

## 3. Milestones already accepted (regression only)

| # | Check | Expected |
| --- | --- | --- |
| R1 | `output/native/Borderless Native.app`: choose a changing window | Preview updates, frame count climbs, Stop clears it |
| R2 | Share that window to the Tauri Wall on monitor two | Live, keeps playing while moved or resized, disappears within a second of Stop |

## 4. Later milestones

Milestone 3 (private live window on a second Mac) and milestone 4 (window over the laptop edge) are not built yet. Their checks will be added here when they are.
