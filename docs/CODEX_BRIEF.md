# Codex build brief: Borderless

**This is the entry point for any builder.** Read it top to bottom before writing code. Also read [DECISIONS.md](DECISIONS.md) for what the user has decided, seen and is still deciding, and look at the concept images and prototype in `docs/design/`. Order of authority: [VISION.md](VISION.md) (what the app is), then this brief (how to build it, in what order), then [PRD.md](PRD.md) v3 (detailed requirements). If anything else in the repository disagrees, these three win. Do not change the product, the order or the stack without the user's written agreement.

## 1. The app

Drag a real window off the edge of your Mac or PC and it travels, with an effect, onto the room's big screen, live and usable. Flick a file up from your phone and it lands on the wall where you aimed. Send work back down to one person's phone. Everyone in the room does this at the same time, side by side, without anyone taking over the screen.

One product, three views: the **Wall** (big screen), the **Portal** (phone or laptop) and the **Console** (leader). The source is the original conversation, `docs/source/2026-11-03-original-conversation.md`. Read at least lines 115-175, 8559-8597, 11225-11281 and 13041-13069 before starting.

## 2. Where things stand (3 November 2026)

The user's verdict on the current build is that it "isn't even close to the app". That is accurate. What exists:

| Part | State | Use it? |
| --- | --- | --- |
| `server/` Node hub | Working room authority: sessions, roles, files, notes, ink, quiz, live-window grants, private audience, audit. 56 tests. | Yes, as the room authority until milestone 7. Do not add features to it beyond what the milestones below need. |
| `public/` web Portal and Console | Working spatial web UI, phone flick (emulated only), classroom tools. | Yes, the Portal ships. It is the phone experience for milestone 2. |
| `desktop/` Electron | Compatibility shell. | No new work. It will be retired once the native apps replace it. |
| `native/core` Rust | C ABI, display geometry, frame-health policy. Tested. | Yes. Grow it. |
| `native/macos` Swift | ScreenCaptureKit picker, capture service, diagnostics. **Real capture returns zero complete frames.** | Yes. Fix capture first (milestone 0). |
| `native/dotnet`, `native/wall` C#/Godot | Read-only room client; Godot Wall renders notes only. | No. Retired by the approved architecture; keep only as reference for snapshot validation rules. |
| `native/hub` Go | One validated command (move). Not a server. | No. Port its strict validation rules to the Rust hub. |
| `native/windows` | README only. | Milestone 4. |

The latest independent review is [CLAUDE_REVIEW_RESULTS.md](CLAUDE_REVIEW_RESULTS.md). Open research: [REUSE_RESEARCH.md](REUSE_RESEARCH.md) and PR #2's `docs/research/OPEN_SOURCE_CANDIDATES.md`.

## 3. Stack and module boundaries (approved 3 November 2026)

The user approved this stack on 3 November 2026 ("yes whatever just make sure it works as intended"), replacing the Go/C#/Godot plan. The reasoning is in [ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md). Native where the operating system demands it, Rust for the engine and hub, LiveKit for live media, one TypeScript front end for every screen people look at.

| Module | Language | Owns | Never |
| --- | --- | --- | --- |
| `native/core` | Rust | Display geometry and edge mapping; frame health; input leases; room protocol types. Used by the Windows agent and hub directly, and by Swift through generated bindings (UniFFI). | OS UI, room permissions, credentials. |
| `native/macos` | Swift | Mac agent: picker and ScreenCaptureKit capture, publishing screen tracks with the LiveKit Swift SDK (hardware encode), the virtual display via `CGVirtualDisplay` (decided), edge arming, personal receiver windows (AppKit). | Its own room model or permissions. |
| `native/windows` | Rust app, C++ IddCx driver | Windows agent: WGC capture, publishing with the LiveKit Rust SDK, edge arming, personal windows; separately signed IddCx virtual monitor driver. | Networking secrets inside the driver. |
| `hub/` (new) | Rust | **The single room authority**: identity, ownership, versions, grants, files, audit; issues per-person LiveKit access tokens and revokes them through the LiveKit server API. Replaces the Node hub after milestone 5. | Raw media. Two authorities at once. |
| LiveKit server | (Go, off the shelf, Apache-2.0) | Live video, audio and data between every device, from one-to-one to one-to-thirty; runs on the room's machine, no cloud. | Room permissions of its own; it only obeys hub-issued tokens. |
| `web/` (new, from `public/`) | TypeScript | One front end for the Wall, Console and Portal: content windows, live video (LiveKit JS), PDFs (pdf.js), images, notes, ink, pointers, WebGL/WebGPU effects (PixiJS or raw WebGL), themes. | Authority from local state. |
| `wall-shell/` (new) | Rust (Tauri) | Native full-screen Wall app: choose display, start with the computer, kiosk mode, survive sleep, one window per display or one spanning window, signed updates. | Its own UI beyond the shared front end. |
| `mobile/` (after the core moments) | TypeScript (React Native, Expo) | iPhone and Android app: share sheet, phone screen sharing (LiveKit React Native SDK with ReplayKit and MediaProjection), haptic flick, notifications. The web Portal remains the zero-install way in. | Anything the hub does not authorise. |

**Until milestone 5**, the existing Node hub (`server/`) stays the room authority and gains only what milestones 1 to 4 need (LiveKit token issuing). The Rust hub replaces it in milestone 7 using the migration rules in CLAUDE_REVIEW_RESULTS.md M5 and M6.

**Media path:** agent captures the window (ScreenCaptureKit or WGC), LiveKit SDK hardware-encodes and publishes it, the LiveKit server forwards it to every viewer the hub has authorised, the Wall plays it with hardware decoding. Target: under 100 ms glass to glass at 1080p, 60 fps on a room network. Fallback if the Wall cannot hold six live 1080p streams at 60 fps: a native renderer behind the same front-end protocol.

**Reuse to start from:** LiveKit server and SDKs (Apache-2.0), `nonstrict-hq/ScreenCaptureKit-Recording-example` (MIT, capture reference), `mozilla/pdf.js` (Apache-2.0), `steveruizok/perfect-freehand` (MIT, ink), `tauri-apps/tauri` (Apache-2.0/MIT), `VirtualDrivers/Virtual-Display-Driver` (MIT) or the Microsoft IndirectDisplay sample (Windows virtual monitor), `Stengo/DeskPad` (MIT, reference for `CGVirtualDisplay`). Pin a release, keep licence notices, never copy GPL or AGPL code.

## 4. Look and feel

The user's instruction: it "needs to look better than this". The current web UI is a competent productivity canvas. The conversation asked for something with presence: work that looks like it physically travels through the air and lands (source 165, 761-767, 7641-7649), and looks that "look goooood" (10041). Treat visual quality as a requirement with its own acceptance, not decoration added at the end. What follows is a proposed direction; show it to the user early (milestone 1) and adjust before building it everywhere.

**Principles**

1. **The work is the hero.** Content windows are large, crisp and readable from the back of a room. Chrome is minimal and quiet. Nothing is tilted or decorative at the cost of legibility (the current ±1.5° note tilt goes).
2. **Motion tells the truth.** Every effect shows a real event: departure when bytes or frames start leaving, travel while in flight, landing only when the hub confirms receipt. Never animate success that has not happened.
3. **One physical language.** Windows have weight: they ease, settle and cast soft shadows. Effects are made of light and material, not stock "confetti".
4. **Calm by default, spectacular on arrival.** The resting Wall is serene. Energy is concentrated in the two-second moment when something crosses over.

**Wall canvas.** Full-bleed. Subtle dot grid (1 px dots, 32 px pitch at 1080p, about 6% contrast). Optional soft vignette. No permanent bars; room name, join code and QR live in one small card that fades to 40% opacity when the room is busy.

**Content windows.** Corner radius 14 px at 1080p (scale with resolution). One title bar 36 px high: owner colour dot, title, owner name, then controls that appear on hover or focus only. Two shadow layers (ambient 0 24px 48px at 12% plus contact 0 2px 6px at 8%). The focused window lifts (scale 1.02, deeper shadow, 180 ms). Live windows carry a small red "LIVE" pill and a 2 px owner-colour outline while frames are arriving; the outline dims and shows "Paused" when frames stall. Notes are flat cards, not tilted.

**Typography.** One family for the interface: Inter (variable, bundled locally, no web font CDN) or SF Pro on Apple platforms. Wall sizes for a 1080p, 3-metre viewing distance: window titles 22 px semibold, body text in notes 28 px regular, minimum 18 px for anything on the Wall. Portal: 17 px body, 28 px headings, 44 px minimum touch targets. Tabular numerals for counts and timers. Theme families may swap display faces (the conversation suggested Playfair Display for Executive, JetBrains Mono for Synthwave and IBM Plex Mono for Tactical; source 10605, 10619, 10633), never body text legibility.

**Colour.** Each theme is a token set: background, surface, surface-raised, text, text-muted, accent, danger, plus eight owner colours tuned so every one passes 3:1 against the surface and is distinguishable for common colour-vision deficiencies. Default theme: the clean Apple-style Whiteboard the user asked for (source 11283-11297): background `#FAFAFA`, surfaces white, text `#1D1D1F`, accent `#0066CC`, dot grid `#E5E7EB`. The other four (Studio, Executive, Synthwave, Tactical) follow the palettes in source 10593-10633, rebalanced for contrast. Contrast: 4.5:1 for text, 3:1 for UI and owner colours.

**Spacing.** 8 px base unit; 16, 24, 32 and 48 px for most layout; 24 px minimum gap when the hub places new windows; never overlap existing work on placement.

**Signature motion: window over the edge (C1).**

| Phase | Laptop | Wall | Timing |
| --- | --- | --- | --- |
| Arm | Thin glow (4 px, owner colour, 60% opacity) breathes along the connected edge when a window is dragged within 48 px of it. | A matching soft glow appears at the seat's entry point. | 200 ms fade in |
| Cross | The part of the window past the edge stretches like taffy towards the edge (liquid pull, PRD B39) and dissolves into particles. | The same shape pours in from the entry point, particles converging and resolving into the live window. | 450-700 ms, tracks the drag |
| Land | Laptop edge glow fades. | Window settles with a slight overshoot (spring, about 6% overshoot, 300 ms) and a single soft ripple that visually nudges nearby windows without moving them. | 300 ms |
| Return | Reverse of cross. | Reverse of cross. | Same |

**Signature motion: phone flick (C2).** The selected card lifts under the finger with a shadow. On release with enough upward velocity, it flies off the top of the phone following the finger's direction, shrinking slightly. The Wall shows a faint "incoming" spark at the aimed point while uploading (with real progress), then the particle vortex in the sender's colour resolves into the real file window when the hub confirms. Failures make the card fall back onto the phone with an explanation. Total perceived time from release to landing should feel under one second on a good LAN.

**Effects engineering.** WebGL or WebGPU in the shared front end on the Wall and Portal. Frame-rate independent (driven by elapsed time), interruptible, bounded to the affected region, GPU cost measured on the target hardware. Reduced motion replaces travel with a quick cross-fade and keeps every state change visible. A "Quiet" room setting exists for formal meetings.

**Visual acceptance (every milestone that touches the UI)**

- Side-by-side screenshots of the Wall at 1080p and 4K, the Portal at 390 px, and the Console, in at least the Whiteboard and one dark theme, attached to BUILD_HANDOFF.md.
- A screen recording of each signature motion at real speed and in slow motion.
- Text on the Wall readable at 3 metres from a 55-inch 1080p screen (checked in person or by size calculation).
- No overlapping placements, no clipped titles, no controls left visible on the Wall at rest.
- The user looks at it and says it looks right. Until then it is not done.

## 5. Milestones

Build in this order. Each milestone is a vertical slice that ends with **the user watching it work on real devices**. Passing tests is necessary, not sufficient. Every milestone with visible UI must also meet the visual acceptance in section 4. Record a short screen recording or photos of each acceptance and add it to BUILD_HANDOFF.md.

### Milestone 0: real capture on the Mac

- **Build:** run `output/native/Borderless Native.app` (rebuild with `npm run native:mac:package`), select a window from another app that is changing (a video, or text being typed), and read the Diagnostics line. Work through the hypotheses in order: another app's window instead of our own; display awake (two physical displays were online at the last check); Screen Recording permission for the exact rebuilt app (ad-hoc signing changes identity); `queueDepth` 6 instead of 3; the unified log for ScreenCaptureKit and replayd. The Electron path also gets zero frames on this Mac, so look for a shared cause.
- **Done when:** the user sees their chosen window live in the diagnostic app's preview, the frame count climbing, and Stop clearing it. The cause is written in BUILD_HANDOFF.md.

### Milestone 1: a live Mac window on the Wall (core moment C3, first half)

- **Build:** a local LiveKit server started with the hub; the hub issues LiveKit tokens per person matching its room and private audiences, and revokes them; the Mac agent publishes the captured window with the LiveKit Swift SDK; the new `web/` front end and the Tauri `wall-shell/` show it as a live window that keeps playing while moved and resized, in look A; Stop, revoke and reconnect.
- **Done when:** on the same LAN, the user shares a window from one Mac, it appears live on the Wall on another screen or machine, keeps updating while they work in it, moves and resizes on the Wall without stopping, and disappears everywhere within a second when they press Stop. Glass-to-glass latency is measured and recorded.

### Milestone 2: phone flick onto the Wall, and send-back (core moment C2)

- **Build:** Wall viewers in the shared front end: images, multipage PDF (pdf.js), video files with sound through the room output (hardware decoding in the Wall's browser engine), text and notes. Arrival effects per PRD B39: particle vortex for phone throws, in the sender's colour, landing where the phone aimed. Free-space placement so new work never covers existing work, then **smart layout (PRD B46)**: Auto, Side by side, Stack by person and Focus modes that rearrange the Wall readably as content arrives (see scene 12 in `docs/design/prototype.html`). Portal flick on real phones with explicit Send as an alternative. Send-back from the Wall or Console to one chosen phone. **Send-to links (PRD B44):** each Wall and panel has its own link and QR code that drops content straight onto it. **Links (PRD B42):** paste or share a link into the Portal and flick it; the Wall opens it as a live, scrollable web window in a sandboxed web view opened by the Tauri shell (no shared logins or cookies, no downloads or pop-ups), with a preview card first and as the fallback.
- **Done when:** on a real iPhone and a real Android phone, the user picks a photo and a PDF, flicks them up, sees them leave the phone and land on the Wall as real, readable, movable windows with their colour; does the same with a link copied from the phone's browser and sees the actual web page on the Wall; then sends one back and finds it saved on the phone. A short or sideways swipe sends nothing.

### Milestone 3: someone's live window beside your own work (core moment C3, second half)

- **Build:** native personal receiver window on a second Mac (AppKit, local placement, muted by default); invite, accept, Close, Stop receiving, Revoke and Stop sharing as distinct actions; private shares never reach the Wall or leader.
- **Done when:** the user shares a window privately to a colleague's Mac; it appears there in its own movable window beside the colleague's apps, keeps updating, and ends when either side stops it. The leader's Console and the Wall never show it.

### Milestone 4: drag a window over the edge (core moment C1)

- **Mac route decided:** `CGVirtualDisplay` (section 6).
- **Build:** a real extended display per platform (Windows: IddCx driver from the chosen base, signed; Mac: `CGVirtualDisplay` behind one Swift interface); seat and edge calibration using the Rust geometry; edge glow when armed; the liquid-pull crossing effect on both the laptop and the Wall (PRD B39); frames from the virtual display through the milestone 1 media path; safe return on Escape, network loss or Stop, so no window is ever stranded off-screen.
- **Done when:** the user drags an ordinary application window off their laptop edge, sees the edge glow and the window dissolve on the laptop as it arrives live on the Wall at their seat's side, keeps using the app, and drags it back. Unplugging the network returns the window to the laptop.

### Milestone 5: the user's review

Show milestones 1 to 4 together in a real room session: one Wall, two laptops, two phones. Fix what the user asks for until they say "this is the app". Nothing in milestones 6 and 7 starts before this.

### Milestone 6: the rest of the room experience

Phone laser pointers (gyro and touch), drawing from seats (perfect-freehand on Portal and Wall), **the full whiteboard (PRD B45)**: endless board, sticky notes, pens, shapes, arrows, text, frames and live windows on the board, named cursors, lock and clear, export (see scene 11 in `docs/design/prototype.html`); built in-house, no tldraw, classroom hand raise, quiz, pointer voting and drag-to-column (PRD B16-B17, B38), room audio without echo (B31), the five themes including the clean Apple-style Whiteboard (B19), Console arrange and governance, optional Console mini-map (B41). The React Native phone app: "Share to Borderless" from any app's share sheet, including links from Safari and Chrome, with the flick card shown inside the share sheet; phone screen sharing; haptic flick; notifications. On laptops, a link dragged from the browser to the connected edge goes to the Wall the same way.

### Milestone 6b: mission control room

The conversation began with mission control rooms: NASA's front board, military and intelligence operations centres, "common operational picture" walls (source 29-113, 769-777, 6219-8007). This is a full use of Borderless, not an afterthought.

- **Build:** a panoramic Wall across several panels driven by one or more graphics cards (one window per display or one spanning window, bezel compensation, rotation, mixed resolution); measured hardware frame lock where the installation has it (NVIDIA Mosaic and Quadro Sync class hardware); the Tactical look tuned for long shifts (dark, low glare, amber or cyan, monospace data); a leader Console on a tablet with a live mini-map of the whole wall, arrange, evict and emergency clear; **source patching (PRD B43)**: a live gallery of every screen and camera that has opted in, cut onto any panel or the whole wall with one tap, swap and replace live, saved layout presets, all audited (see scene 10 in `docs/design/prototype.html`); **watch links (PRD B44)**: view-only, expiring, revocable links to the whole wall, one panel or one source, with an in-room "being watched" indicator; live feeds and data windows that stay up for hours with automatic reconnection; a searchable, exportable audit log of who put what on the wall and when; an offline, no-internet mode with no cloud dependencies; hot-spare failover of the hub; optional hardware-key or biometric sign-off for contributions (PRD B40); a documented hardware-matrix (KVM over IP) option for rooms that forbid wireless.
- **Done when:** on a real multi-panel wall (at least three displays), the user runs a session where several people put live screens and documents up at once, the leader patches sources onto panels and rearranges and clears them from a tablet, the wall runs for hours without drift, tearing between panels is measured and reported, the hub is killed and the spare takes over without losing content, and the audit shows every action.

### Milestone 7: platform completion

The Rust hub replaces the Node hub (offline import with IDs, receipts, pending purges and audit preserved; old hub fenced; single cutover; see CLAUDE_REVIEW_RESULTS.md M5 and M6). Multihead and panoramic Walls with per-head output and measured frame lock. Signed and notarised installers, signed staged updates. Retire Electron. Then managed operations: retention, identity, signed contributions (B40), HA.

## 6. Decisions

Decided by the user on 3 November 2026 (accepting all recommendations):

- **Look:** A, the clean Whiteboard, is the default. B Studio and C Executive are switchable room looks. See `docs/design/` and section 4.
- **Architecture:** the Rust-centred stack in section 3 (ARCHITECTURE_DECISION.md option 1).
- **Phone apps:** React Native (Expo), after the core moments; the web Portal stays.
- **Mac window over the edge:** `CGVirtualDisplay`, as DeskPad does. It is undocumented and can break with macOS updates, so: isolate it behind one Swift interface, test every macOS beta, ship outside the Mac App Store with Developer ID and notarisation, and document a physical display adapter as the fallback for locked-down rooms.

Still to ask the user when the milestone arrives (recommend, keep working meanwhile):

- **Video file licensing (milestone 2).** Use platform decoders (the Wall's browser engine does this) and avoid shipping FFmpeg. Raise only if a format needs it.
- **When to retire Electron.** Recommendation: after milestone 5.

## 7. Do not drift

These rules exist because the build drifted twice (see PRD.md, "Drift record").

1. **The milestone order is fixed.** Do not start a later milestone, polish administration, or widen tests or packaging while an earlier milestone's user acceptance has not happened.
2. **No substitute experiences.** A screen-share tile is not the window-over-the-edge moment. An upload is not a flick. A simulation, animation or generated test video is not real capture. Say plainly when something is not built.
3. **No stack changes.** The approved stack in section 3: Swift and Rust agents, C++ only for the Windows driver, Rust engine and hub, LiveKit, one TypeScript front end, Tauri Wall shell, React Native phone app later. Propose any change in writing, with costs, and wait for the user.
4. **One room authority.** Native clients use the same hub, grants and IDs as the web clients. Never two writers.
5. **No dashboards.** Work fills the screen; tools float and dismiss (PRODUCT.md, DESIGN.md).
6. **Report honestly.** Separate "compiles", "tests pass", "works on this Mac with real content" and "the user has seen it". Never claim capture, displays, devices or signing from tests.
7. **Ask the user only for real blockers** (section 6, physical tests, permissions). Keep working on everything else.

## 8. Working rules

- Branch `feat/borderless-platform`, PR #1. Small commits with clear messages. Do not merge or publish releases.
- Before each commit: `npm run verify` (Node 24) and `npm run native:verify` (see native/README.md), plus the checks for each new module as it is added.
- Keep CAPABILITIES.md, BUILD_HANDOFF.md and DELIVERY.md accurate at every milestone.
- Preserve `docs/source/` byte for byte. Never commit runtime data, credentials, certificates, personal uploads or build outputs.
- Use British English in user-facing text.
