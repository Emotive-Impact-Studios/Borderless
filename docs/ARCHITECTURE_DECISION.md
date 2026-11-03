# The best long-term setup for Borderless

Proposal, 3 November 2026. Written for the user to decide. Nothing here changes the agreed plan until the user says so.

## The answer

Build Borderless as **native agents on each computer, one Rust engine and hub, a proven real-time media layer, and one shared front end for the Wall, Console and Portal.**

| Layer | What it does | Technology |
| --- | --- | --- |
| **Mac agent** | Capture windows, create the virtual display, detect the edge, show personal live windows | Swift (Apple's own APIs) |
| **Windows agent** | The same on Windows | Rust app, plus a small C++ virtual display driver |
| **Engine** | Geometry, edge handoff, input leases, room protocol, shared by both agents | Rust (already started) |
| **Live media** | Moves live video and audio between devices with low latency, to one viewer or thirty | LiveKit, self-hosted in the room (built on Google's WebRTC engine) |
| **Hub** | The single authority: rooms, people, permissions, files, audit; issues media permissions | Rust |
| **Wall, Console, Portal** | Everything people see: the big screen, the leader's controls, the phone | One TypeScript front end. Effects in WebGL/WebGPU, PDFs with pdf.js, hardware video decoding. The Wall runs full-screen in a small native shell (Tauri, written in Rust) |

In short: **native where the operating system demands it, Rust for the engine and hub, a proven media layer instead of building our own, and one codebase for every screen people look at.**

## What "best" has to mean here

1. **The moments feel physical.** A window crossing onto the Wall at 60 frames per second, under about 100 ms on a room network. Effects that look premium.
2. **Every device in the room.** Mac and Windows laptops, iPhones and Androids, TVs, projectors and multi-panel video walls.
3. **It scales.** One laptop to one Wall, and one teacher's screen to thirty phones, without redesigning.
4. **A small team (with AI builders) can keep it working for years.** Few languages, few custom-built hard parts, mainstream tools.
5. **No licence traps.** Everything permissive, nothing GPL in the product.

## Why each choice

**Native agents (Swift on Mac; Rust and C++ on Windows).** This part is not optional. Real window capture, virtual displays and edge handoff exist only in each operating system's own APIs. Swift is the shortest path to ScreenCaptureKit, the virtual display and native windows on Mac. On Windows, Rust has mature bindings to the capture and graphics APIs, and the virtual monitor has to be a C++ IddCx driver, because that is what Microsoft supports and signs.

**One Rust engine and hub.** Geometry, edge rules, input leases and the room protocol are written once and used by both agents (Swift calls Rust through generated bindings). Moving the hub from Go to Rust as well means the core logic, the server and the Windows app share one language, one set of types and one test suite. Rust is fast, memory-safe and well suited to long-running servers. The Go and C# code in the repository today is small, so very little is thrown away.

**LiveKit for live media, instead of building our own.** Live video is the heart of the product and the hardest thing to get right: hardware encoding, packet loss, reconnection, audio sync, one-to-many fan-out, bandwidth control. LiveKit is Apache-2.0, very widely used, and has maintained SDKs for every platform we need: Swift (including macOS screen share and iPhone screen share), Rust, JavaScript and Android. It runs on the room's own machine, so no cloud is needed. It also fixes a weakness of today's peer-to-peer design: the hub issues each viewer a media permission, and revoking it is enforced by the media server, not by the sharer's laptop. Private live windows, classrooms of thirty and recording all come from the same system. Hand-building WebRTC (Pion, str0m or libdatachannel) would cost months and give us less.

**One front end for the Wall, Console and Portal (TypeScript, WebGL/WebGPU), with the Wall in a native shell.** This is the one place where I recommend changing the plan.

- The Wall's job is to show real content beautifully: live video (several streams at once), PDFs, photos, documents, text, plus the effects. Browser engines are the best-tested software in the world at exactly this: hardware video decoding, pdf.js for PDFs, perfect text, WebGL and WebGPU for particles and liquid effects (as the prototype shows), and accessibility built in.
- Godot is excellent for games, but it cannot play live H.264 video or show PDFs without add-ons we would have to build, package and maintain. Its real advantages (GPU effects and fullscreen output) are matched by WebGL/WebGPU, and multi-panel walls are normally presented to software as one large display by the graphics card anyway.
- The Portal already has to be web, because phones join by scanning a QR code. Sharing one front end means the Wall, Console and Portal look and behave identically, and every visual improvement lands everywhere at once.
- The native shell (Tauri, Rust) makes the Wall a proper app: full-screen on the chosen display, starts with the computer, survives sleep, no browser chrome. It is far smaller than Electron and in our main language.

**What about all Rust, or all C++?** All Rust fights Apple's frameworks on Mac and cannot yet make a signed Windows display driver. All C++ works, but it is slower to build and easier to crash, and it gives no advantage over Rust here. Using the right tool at each edge, with Rust in the middle, beats both.

## How every feature gets done

| Feature (PRD) | Built by | How |
| --- | --- | --- |
| Window over the edge (C1, B25, B30) | Mac and Windows agents, engine | Virtual display created by the agent; the user drags a real window onto it; frames are captured and published to LiveKit; the Wall plays them at the seat position; the engine handles edge arming, calibration and safe return. |
| Phone flick (C2, B06-B07) | Portal, hub, Wall | Gesture in the Portal; file upload to the hub with hash and receipt; the Wall renders the real file with the arrival effect. |
| Live window on the Wall or a colleague's Mac (C3, B12, B29, B37) | Agents, LiveKit, hub | The agent publishes a screen track; the hub grants the room, or chosen people, permission to subscribe; personal windows are native windows on the receiving Mac. |
| Send back to a phone (B13, B34) | Hub, Console, Portal | Targeted delivery with hash check and versioned returns. |
| Pointers and drawing (B14-B15) | Portal, hub, Wall | Low-latency data messages (LiveKit data channels or the hub's socket); smooth ink rendered the same on every screen. |
| Room audio (B31) | LiveKit, Wall | Audio tracks with shared timing; the Wall plays them to the chosen output; echo control from the media layer. |
| Classroom: hand raise, quiz, voting (B16-B17, B38) | Hub, Portal, Console, Wall | Server-owned state and scoring; one class of thirty phones uses the same media fan-out as a meeting. |
| Five looks, effects (B19-B20, B39) | Front end | Theme tokens and WebGL/WebGPU effects, shared by Wall, Console and Portal. |
| Multihead and panoramic walls (B26, B35) | Wall shell | One window per display or one spanning window across a graphics card's combined display; frame lock comes from the graphics hardware, as it always must. |
| Installers and updates (B27) | Tauri, native packaging | Signed and notarised apps with Tauri's signed updater; separately signed Windows driver. |
| Phone apps (B28, WP19) | React Native app, LiveKit mobile SDKs | One iPhone and Android app for share sheets, phone screen sharing and notifications, using the same media and room protocol (see Phone apps below). |
| Audit, retention, identity, HA (B21-B23, B28) | Hub | Transactional SQLite to start; the hub can move to replicated storage later without changing clients. |

## Phone apps (iPhone and Android)

**Today:** there are no native phone apps. Phones use the web Portal: scan the QR code and you are in, with nothing to install. That already covers flicking files, pointing, drawing, quizzes and receiving files, and it stays forever as the zero-install way in (the conversation's promise, source 11645).

**What only native apps can add:**
- "Share to Borderless" from the Photos, Files or any app's share sheet.
- Sharing the phone's own screen live to the Wall (ReplayKit on iPhone, MediaProjection on Android).
- Stronger haptic feedback on the flick, a steadier gyro laser pointer, and finding rooms nearby on the local network.
- Notifications when someone sends you a file, and saving straight into Photos or Files.

**Recommendation:** one cross-platform app in **React Native (Expo)**, written in TypeScript so it shares the room protocol, gestures and visual design with the Wall, Console and Portal. Small native pieces where the OS requires them: an iOS share extension and ReplayKit broadcast extension, and Android's share target and MediaProjection. LiveKit has a React Native SDK with phone screen sharing. Flutter (named in the conversation, source 1447) also works and has a LiveKit SDK, but it would be a second UI language next to TypeScript.

**When:** after the three core moments (milestone 6 or 7 in the brief), because the web Portal already delivers the phone flick, which is the phone's core moment. Physical iPhone and Android testing of the web Portal happens in milestone 2.

## What changes from the current plan

- **Kept:** the product, the milestones and their order, native Swift on Mac, Rust at the core, native Windows integration, one authority, the web Portal.
- **Changed:** the Wall moves from Godot and C# to the shared TypeScript front end in a Tauri shell; the hub's target language becomes Rust instead of Go; live media uses LiveKit instead of a hand-built WebRTC stack.
- **Why this isn't the old drift:** the drift was building only web pages and skipping the native parts. Here the native agents and the window-over-the-edge moment are still the first priority, and the Wall is a native full-screen app. What changes is only which engine draws the Wall.
- **Cost:** the Godot note scene and the small Go and C# units are retired. The existing Node hub stays as the authority until the Rust hub replaces it after the core moments, exactly as the brief already says for Go.

## Risks, and how to prove them early

| Risk | First proof (milestone 1) |
| --- | --- |
| Live video latency on a room network | A real Mac window to the Wall through LiveKit: measure glass-to-glass; target under 100 ms at 1080p and 60 fps on wired and Wi-Fi. |
| Wall performance | Six live 1080p streams, plus effects, on a Mac mini and a mid-range Windows PC at 60 fps. |
| Mac virtual display | The undocumented Apple feature (decision A in the brief), proved on the current macOS and the next beta. |
| Windows driver signing | Start Microsoft's attestation signing account early; prove one signed driver on a clean PC. |

If the Wall cannot hold six streams at 60 fps in the web engine, the fallback is a native renderer (Godot with Rust, or Metal on Mac) behind the same front-end protocol, and nothing else changes.

## The decision

- **Option 1 (recommended):** this setup.
- **Option 2:** keep the conversation's stack exactly: Go hub, Rust core, C# and Godot Wall, with LiveKit added for media (strongly advised either way).
- **Option 3:** Option 2 with Rust replacing Go and C# (Godot scripted in Rust).

Whichever is chosen goes into CODEX_BRIEF.md and the PRD as the agreed stack, so the builder cannot drift from it.
