# Codex build brief: Borderless

**This is the entry point for any builder.** Read it top to bottom before writing code. Order of authority: [VISION.md](VISION.md) (what the app is), then this brief (how to build it, in what order), then [PRD.md](PRD.md) v3 (detailed requirements). If anything else in the repository disagrees, these three win. Do not change the product, the order or the stack without the user's written agreement.

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
| `native/dotnet`, `native/wall` C#/Godot | Read-only room client; Godot Wall renders notes only. | Yes. This becomes the Wall. |
| `native/hub` Go | One validated command (move). Not a server. | Yes, at milestone 7. |
| `native/windows` | README only. | Milestone 4. |

The latest independent review is [CLAUDE_REVIEW_RESULTS.md](CLAUDE_REVIEW_RESULTS.md). Open research: [REUSE_RESEARCH.md](REUSE_RESEARCH.md) and PR #2's `docs/research/OPEN_SOURCE_CANDIDATES.md`.

## 3. Stack and module boundaries

The stack is the one the conversation chose (source line 12959): **Go hub, Rust shared core, C#/.NET with Godot for the Wall**, plus thin native adapters (**Swift** on Mac, **C#/C++** on Windows). The web Portal stays.

| Module | Language | Owns | Never |
| --- | --- | --- | --- |
| `native/core` | Rust | Display geometry and edge mapping; frame health; **media session (WebRTC via `str0m`, proposed)**; input leases; bounded frame queues. One C ABI used by Swift and C#. | OS UI, room permissions, credentials. |
| `native/macos` | Swift | Picker and ScreenCaptureKit capture, VideoToolbox H.264 encode, Mac virtual display (milestone 4), edge arming, personal receiver windows (AppKit). | Its own room model or permissions. |
| `native/windows` | C# host, C++ bridge, IddCx driver | WGC capture, Media Foundation encode, IddCx virtual monitor. | Networking secrets inside the driver. |
| `native/dotnet` | C# | Typed room client shared by the Wall and Windows host. | TLS bypass; client-chosen roles. |
| `native/wall` | C#/Godot | The Wall: content windows, live video textures, PDF and image viewers, ink, pointers, effects, themes, per-display output. | Authority from local scene state. |
| `server/` now, `native/hub` later | Node, then Go | **The single room authority**: identity, ownership, versions, grants, files, audit, signalling relay. | Raw media through JSON. Two authorities at once. |
| `public/` | Web | Portal on phones and laptops; Console. | Anything the hub does not authorise. |

**Media path (proposal, decide in milestone 1's spike):** Swift capture, then VideoToolbox H.264, then the `str0m` WebRTC session in the Rust core (sans-IO, so Swift and C# drive it), with signalling relayed by the hub, then decode on the Wall and upload as a Godot texture. Alternatives to compare in the spike: Pion (Go sidecar) and libdatachannel (MPL-2.0). For decode on the Wall: VideoToolbox (Mac) or Media Foundation (Windows) through a small Godot extension; FFmpeg's libavcodec (LGPL build, dynamically linked) as the cross-platform fallback. Browsers on the Portal keep using built-in WebRTC.

**Reuse to start from:** `nonstrict-hq/ScreenCaptureKit-Recording-example` (MIT, SCStream to VideoToolbox), `bblanchon/pdfium-binaries` and `sungaila/PDFtoImage` (PDF pages to textures), `EIRTeam/EIRTeam.FFmpeg` (video files in Godot, LGPL FFmpeg only), `steveruizok/perfect-freehand` (ink), `VirtualDrivers/Virtual-Display-Driver` or the Microsoft IndirectDisplay sample (Windows virtual monitor), `Stengo/DeskPad` (reference for the Mac virtual display, private API). Pin a release, keep licence notices, never copy GPL or AGPL code.

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

**Effects engineering.** Godot shaders on the Wall; WebGL or CSS on the Portal. Frame-rate independent (driven by elapsed time), interruptible, bounded to the affected region, GPU cost measured on the target hardware. Reduced motion replaces travel with a quick cross-fade and keeps every state change visible. A "Quiet" room setting exists for formal meetings.

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

### Milestone 1: a live Mac window on the native Wall (core moment C3, first half)

- **Build:** VideoToolbox H.264 encode in `native/macos`; the media spike (section 3), pick one stack and record why; hub signalling and grants for native peers; a live video surface in `native/wall` that keeps playing while it is moved and resized; Stop, revoke and reconnect; room and private audiences as the hub already enforces.
- **Done when:** on the same LAN, the user shares a window from one Mac, it appears live on the Godot Wall on another screen or machine, keeps updating while they work in it, moves and resizes on the Wall without stopping, and disappears everywhere within a second when they press Stop. Glass-to-glass latency is measured and recorded.

### Milestone 2: phone flick onto the native Wall, and send-back (core moment C2)

- **Build:** native Wall viewers: images, multipage PDF (PDFium), video files with sound through the room output (EIRTeam.FFmpeg or platform decoder), text and notes. Arrival effects per PRD B39: particle vortex for phone throws, in the sender's colour, landing where the phone aimed. Free-space placement so new work never covers existing work. Portal flick on real phones with explicit Send as an alternative. Send-back from the Wall or Console to one chosen phone.
- **Done when:** on a real iPhone and a real Android phone, the user picks a photo and a PDF, flicks them up, sees them leave the phone and land on the Wall as real, readable, movable windows with their colour; then sends one back and finds it saved on the phone. A short or sideways swipe sends nothing.

### Milestone 3: someone's live window beside your own work (core moment C3, second half)

- **Build:** native personal receiver window on a second Mac (AppKit, local placement, muted by default); invite, accept, Close, Stop receiving, Revoke and Stop sharing as distinct actions; private shares never reach the Wall or leader.
- **Done when:** the user shares a window privately to a colleague's Mac; it appears there in its own movable window beside the colleague's apps, keeps updating, and ends when either side stops it. The leader's Console and the Wall never show it.

### Milestone 4: drag a window over the edge (core moment C1)

- **Needs a user decision first** (section 6, decision A).
- **Build:** a real extended display per platform (Windows: IddCx driver from the chosen base, signed; Mac: the route the user chooses); seat and edge calibration using the Rust geometry; edge glow when armed; the liquid-pull crossing effect on both the laptop and the Wall (PRD B39); frames from the virtual display through the milestone 1 media path; safe return on Escape, network loss or Stop, so no window is ever stranded off-screen.
- **Done when:** the user drags an ordinary application window off their laptop edge, sees the edge glow and the window dissolve on the laptop as it arrives live on the Wall at their seat's side, keeps using the app, and drags it back. Unplugging the network returns the window to the laptop.

### Milestone 5: the user's review

Show milestones 1 to 4 together in a real room session: one Wall, two laptops, two phones. Fix what the user asks for until they say "this is the app". Nothing in milestones 6 and 7 starts before this.

### Milestone 6: the rest of the room experience on the native Wall

Phone laser pointers (gyro and touch), drawing from seats (perfect-freehand on Portal and Wall), classroom hand raise, quiz, pointer voting and drag-to-column (PRD B16-B17, B38), room audio without echo (B31), the five themes including the clean Apple-style Whiteboard (B19), Console arrange and governance, optional Console mini-map (B41).

### Milestone 7: platform completion

Go hub replaces the Node hub (offline import with IDs, receipts, pending purges and audit preserved; old hub fenced; single cutover; see CLAUDE_REVIEW_RESULTS.md M5 and M6). Multihead and panoramic Walls with per-head output and measured frame lock. Signed and notarised installers, signed staged updates. Retire Electron. Then managed operations: retention, identity, signed contributions (B40), HA.

## 6. Decisions only the user can make

Ask once, recommend an option, and keep working on everything that does not depend on the answer.

- **A. Mac extended display (blocks milestone 4 on Mac).** Option 1: private `CGVirtualDisplay`, as DeskPad does. Works today and gives the true "drag over the edge" feel, but it is undocumented, can break in any macOS update and rules out the Mac App Store; direct distribution with notarisation is likely still possible. Option 2: a physical HDMI or USB display adapter, which is supported but needs hardware in the room. Option 3: no extended display on Mac; share windows only (milestone 1), which is not the edge moment. Recommendation: option 1 for the product, with option 2 documented for locked-down installations.
- **B. Video file playback licensing (milestone 2).** H.264 decoding through FFmpeg carries patent questions for commercial distribution. Platform decoders (VideoToolbox, Media Foundation) avoid most of this. Recommendation: platform decoders first, LGPL FFmpeg only as a fallback.
- **C. When to retire Electron.** Recommendation: after milestone 5.

## 7. Do not drift

These rules exist because the build drifted twice (see PRD.md, "Drift record").

1. **The milestone order is fixed.** Do not start a later milestone, polish administration, or widen tests or packaging while an earlier milestone's user acceptance has not happened.
2. **No substitute experiences.** A screen-share tile is not the window-over-the-edge moment. An upload is not a flick. A simulation, animation or generated test video is not real capture. Say plainly when something is not built.
3. **No stack changes.** Go, Rust, C#/Godot, Swift and C#/C++ adapters, plus the web Portal. Propose any change in writing, with costs, and wait for the user.
4. **One room authority.** Native clients use the same hub, grants and IDs as the web clients. Never two writers.
5. **No dashboards.** Work fills the screen; tools float and dismiss (PRODUCT.md, DESIGN.md).
6. **Report honestly.** Separate "compiles", "tests pass", "works on this Mac with real content" and "the user has seen it". Never claim capture, displays, devices or signing from tests.
7. **Ask the user only for real blockers** (section 6, physical tests, permissions). Keep working on everything else.

## 8. Working rules

- Branch `feat/borderless-platform`, PR #1. Small commits with clear messages. Do not merge or publish releases.
- Before each commit: `npm run verify` (Node 24) and `npm run native:verify` (set `BORDERLESS_GODOT` and `DOTNET_ROOT`; see native/README.md).
- Keep CAPABILITIES.md, BUILD_HANDOFF.md and DELIVERY.md accurate at every milestone.
- Preserve `docs/source/` byte for byte. Never commit runtime data, credentials, certificates, personal uploads or build outputs.
- Use British English in user-facing text.
