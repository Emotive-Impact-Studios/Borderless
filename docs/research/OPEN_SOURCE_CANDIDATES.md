# Open-source repositories to learn from or build on

Reviewed 3 November 2026. This extends [REUSE_RESEARCH.md](../REUSE_RESEARCH.md) and does not repeat its ten projects (Windows IndirectDisplay sample, Win32CaptureSample, Pion, Godot, LocalSend, libdatachannel, UniFFI, Sunshine, RustDesk, Deskflow). Exact reviewed commits, commit dates and licence files are in [repositories-extended.json](repositories-extended.json).

Method: each repository was fetched at the commit listed, its licence file read at that commit (and the crate or package licence field where a repository holds several), and the named source paths confirmed to exist. A reviewed HEAD is research provenance. Before importing anything, pin a tagged release instead and repeat the acquisition steps in [RESEARCH.md](../RESEARCH.md#acquisition-policy).

Nothing has been vendored and no submodules were added. None of these projects needs to live inside our tree to be useful: the permissive libraries arrive through their own package managers (Cargo, Go modules, NuGet, Godot addons) once a work package needs them, and everything else is reading material. That keeps licence boundaries clean while Borderless is `UNLICENSED`.

Verdicts used below:

- **Candidate dependency**: permissive licence, fits the agreed Go/Rust/C#/Godot/Swift stack, worth a spike when its work package starts.
- **Adapt with notice**: small enough that copying or porting specific files is reasonable, keeping the upstream copyright and licence text beside them.
- **Reference only**: read for design, behaviour and pitfalls. No code copied, either because of licence, private API use or poor fit.

## 1. Virtual displays (the "drag over the laptop edge" moment)

This is the hardest capability in the product and the one with least public API support, so these repositories matter most.

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [Stengo/DeskPad](https://github.com/Stengo/DeskPad) | MIT | Reference only (private API) | A working Mac app that creates a real extra display macOS arranges like a monitor, then shows it in a window. See `DeskPad/CGVirtualDisplayPrivate.h` and the `ScreenConfiguration` side effects. This is the most direct proof that a "Wall is just another display to the Mac" approach can work. It relies on the undocumented `CGVirtualDisplay` class, which can change in any macOS release and needs a decision about notarisation and App Store risk before Borderless depends on it. |
| [KhaosT/CGVirtualDisplay](https://github.com/KhaosT/CGVirtualDisplay) | Apache-2.0 | Reference only (private API) | The original minimal sample of the same private class (`VirtualDisplayExp/ViewController.swift`). Untouched since 2021, so useful for understanding the descriptor and mode fields, not as current code. |
| [VirtualDrivers/Virtual-Display-Driver](https://github.com/VirtualDrivers/Virtual-Display-Driver) | MIT | Adapt with notice | A maintained IddCx driver derived from the Microsoft sample, with HDR, custom modes and management scripts (`Virtual Display Driver (HDR)/MttVDD/Driver.cpp`). Compare it with the Microsoft sample already listed before choosing a starting point for `native/windows/driver/`. Driver signing, our frame handoff and HLK testing remain our work whichever base is chosen. Submodule `ThirdParty/Windows-Driver-Frameworks` carries its own licence. |
| [nomi-san/parsec-vdd](https://github.com/nomi-san/parsec-vdd) | MIT (wrapper only) | Reference only | Shows how an app drives a virtual display driver from C# (`app/Device.cs`, `app/Display.cs`): add, remove and keep alive. The driver it controls is Parsec's proprietary signed binary, which we cannot redistribute. Read it for the control pattern only. |

Note: the earlier open-source BetterDummy project now points only at the closed-source BetterDisplay app, so it is no longer a usable source.

## 2. Screen and window capture

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [nonstrict-hq/ScreenCaptureKit-Recording-example](https://github.com/nonstrict-hq/ScreenCaptureKit-Recording-example) | MIT | Adapt with notice | One short file (`Sources/sckrecording/main.swift`) going from `SCStream` to a VideoToolbox H.264 or HEVC encode with correct pixel scale, colour space and retiming of idle frames. A direct pattern for the encoder stage after `FrameMailbox`. See also section 8 on the zero-frame blocker. |
| [svtlabs/screencapturekit-rs](https://github.com/svtlabs/screencapturekit-rs) | MIT OR Apache-2.0 | Reference only for now | Safe Rust bindings to ScreenCaptureKit, including the content sharing picker (`src/content_sharing_picker.rs`) and IOSurface access (`src/cm/iosurface.rs`). Our Mac capture is Swift by design, so this is not a dependency. It is useful for checking how sample buffer attachments and frame status are read. |
| [CapSoftware/scap](https://github.com/CapSoftware/scap) | MIT | Reference only | Small cross-platform Rust capture crate (`src/capturer/engine/mac`, `src/capturer/engine/win`). Shows one frame type across macOS and Windows. Last commit August 2025, so prefer the maintained `scap-*` crates inside Cap if this approach is ever chosen. |
| [CapSoftware/Cap](https://github.com/CapSoftware/Cap) | AGPL-3.0, except `scap-*` and `cap-camera*` crates which are MIT | Reference only (AGPL core); MIT crates are candidate dependencies | A production Rust screen recorder. The MIT crates `crates/scap-screencapturekit`, `crates/scap-direct3d` and `crates/scap-targets` are the part we could legally use. Do not read the AGPL crates (`recording`, `editor`, `rendering`) with a view to copying; treat them as product reference only. |
| [NiiightmareXD/windows-capture](https://github.com/NiiightmareXD/windows-capture) | MIT | Candidate dependency | Rust Windows Graphics Capture and DXGI duplication with a built-in Media Foundation encoder (`src/graphics_capture_api.rs`, `src/encoder.rs`, `src/graphics_capture_picker.rs`). Fits if Windows capture sits in the Rust core; otherwise the C++ Win32CaptureSample remains the reference for a C#/C++ adapter. Decide once, at the start of the Windows capture work. |

## 3. Low-latency media transport (Go and Rust)

Pion and libdatachannel are already listed. These fill the gaps around them.

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [algesten/str0m](https://github.com/algesten/str0m) | MIT OR Apache-2.0 | Candidate dependency | Sans-IO WebRTC in Rust: no internal threads or async runtime, so it fits a Rust core that must also be driven from Swift and C#. Compare with Pion on one real capture-to-Wall path; whichever wins becomes the single media stack. |
| [webrtc-rs/webrtc](https://github.com/webrtc-rs/webrtc) | MIT OR Apache-2.0 | Reference only | Rust port of Pion's design. Useful to read alongside Pion, but str0m is the better fit for an embeddable core. |
| [livekit/livekit](https://github.com/livekit/livekit) | Apache-2.0 | Candidate dependency (later) | Go SFU built on Pion. Peer-to-peer is right for one laptop sending to one Wall, but a classroom where 30 phones watch the teacher's screen needs a forwarding unit. LiveKit is in our authority language and could be embedded or run alongside the Go hub. Evaluate only when classroom fan-out is scheduled. |
| [pion/mediadevices](https://github.com/pion/mediadevices) | MIT | Reference only | Go capture and codec plumbing into Pion tracks. Capture stays native in Swift/C#, but its encoder interfaces show how to hand encoded frames to Pion. |
| [kixelated/moq](https://github.com/kixelated/moq) | MIT OR Apache-2.0 | Reference only | Media over QUIC, an emerging alternative to WebRTC for low-latency fan-out. Worth watching; too young to bet the product on. |
| [quinn-rs/quinn](https://github.com/quinn-rs/quinn) | MIT OR Apache-2.0 | Reference only | Mature Rust QUIC. Only relevant if a QUIC transport is ever chosen over WebRTC for the LAN path. |

## 4. Room discovery on the LAN

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [hashicorp/mdns](https://github.com/hashicorp/mdns) | MIT | Candidate dependency | Small, maintained Go mDNS server and client for the hub to advertise rooms. |
| [keepsimple1/mdns-sd](https://github.com/keepsimple1/mdns-sd) | MIT OR Apache-2.0 | Candidate dependency | Pure Rust mDNS service discovery for native clients and the Wall. Pair with Apple's local network privacy rules already recorded in RESEARCH.md. |

## 5. Language bridges between the shared Rust core and each client

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [Cysharp/csbindgen](https://github.com/Cysharp/csbindgen) | MIT | Candidate dependency (build-time) | Generates C# `DllImport` declarations from Rust `extern "C"` functions. `native/dotnet` currently writes P/Invoke by hand; as the C ABI grows this removes a class of signature mismatch bugs. It runs at build time and ships no runtime code. |
| [chinedufn/swift-bridge](https://github.com/chinedufn/swift-bridge) | MIT OR Apache-2.0 | Reference only | Rust to Swift bridge. An alternative to UniFFI (already listed); the current small C ABI is still simpler, so no change recommended yet. |

## 6. Wall rendering: video and documents in Godot/.NET

The native Wall currently renders notes only; file, PDF and video viewers are open items.

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries) | MIT (build scripts); PDFium itself is BSD-3-Clause and Apache-2.0 | Candidate dependency | Prebuilt PDFium for macOS, Windows and Linux. Google's PDF engine is the safest permissive PDF renderer; MuPDF is AGPL and should be avoided. Ship PDFium's own licence and third-party notices. |
| [sungaila/PDFtoImage](https://github.com/sungaila/PDFtoImage) | MIT | Candidate dependency | .NET wrapper that renders PDF pages to bitmaps via PDFium. A direct path to page textures in the Godot C# Wall. Check that its SkiaSharp dependency does not conflict with Godot's own rendering before adopting. |
| [GowenGit/docnet](https://github.com/GowenGit/docnet) | MIT | Reference only | Thinner PDFium wrapper for .NET; inactive since 2023, so a fallback only. |
| [EIRTeam/EIRTeam.FFmpeg](https://github.com/EIRTeam/EIRTeam.FFmpeg) | MIT (addon); bundled FFmpeg is LGPL or GPL depending on build flags | Candidate dependency | GDExtension that gives Godot 4 real H.264 video playback (`ffmpeg_video_stream.cpp`), which Godot lacks out of the box. Must be built as LGPL FFmpeg (no `--enable-gpl`), dynamically linked, with notices, and H.264 patent exposure needs a decision. |
| [VoylinsGamedevJourney/gde_gozen](https://github.com/VoylinsGamedevJourney/gde_gozen) | LGPL-2.1 | Reference only | Alternative FFmpeg video addon for Godot. LGPL is usable with dynamic linking, but EIRTeam's MIT wrapper is simpler to comply with. |

Live screens on the Wall should not go through FFmpeg playback; they arrive as WebRTC frames decoded by the chosen media stack and uploaded as textures. These addons are for shared video files.

## 7. Whiteboard, gestures and shared state

| Repository | Licence | Verdict | What to take from it |
| --- | --- | --- | --- |
| [steveruizok/perfect-freehand](https://github.com/steveruizok/perfect-freehand) | MIT | Adapt with notice | Small pressure-sensitive stroke algorithm. Use the npm package in the browser Portal and port the one core function to C# for the Wall so phone and Wall ink look identical. Matches the "clean Apple-like whiteboard" request in the source conversation. |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | MIT | Reference only | Collaborative whiteboard with good patterns for element versioning, reconciliation and presence cursors. Read for behaviour; it is a React app, not something to embed in the Wall. |
| [pmndrs/use-gesture](https://github.com/pmndrs/use-gesture) | MIT | Reference only | Velocity, momentum and pointer capture handling for drag and flick. Its `@use-gesture/vanilla` package could serve the Portal's phone flick-to-Wall gesture, though writing the small velocity tracker ourselves is also reasonable. |
| [automerge/automerge](https://github.com/automerge/automerge), [y-crdt/y-crdt](https://github.com/y-crdt/y-crdt), [loro-dev/loro](https://github.com/loro-dev/loro) | MIT (all three) | Reference only for now | Rust CRDT libraries. The architecture deliberately makes the Go hub the authority with server-issued versions, which a CRDT would bypass. They become relevant only for concurrent text editing or offline ink merge. If that need arrives, Yrs (y-crdt) has the widest client support and Loro the best rich-text and movable-tree model. |

## 8. Prior art for the whole product

These are the closest existing products. All are copyleft or restricted, so they are reading material only, and none should be forked.

| Repository | Licence | What it teaches |
| --- | --- | --- |
| [pavlobu/deskreen](https://github.com/pavlobu/deskreen) | AGPL-3.0 | Turns any device with a browser into a secondary screen over WebRTC, with a QR join and per-viewer approval. Closest public analogue to "phone or laptop receives a live window". Read its join, approval and viewer reconnection flow (`src/client-viewer`); its approach to true extended displays should be checked in its documentation before drawing conclusions. |
| [H-M-H/Weylus](https://github.com/H-M-H/Weylus) | AGPL-3.0 | Phone or tablet as a pen and touch surface for a computer via the browser (`src/websocket.rs`, `src/input/`). Good reference for low-latency pointer events from phones, relevant to laser pointers and phone gestures. |
| [SAGE-3/next](https://github.com/SAGE-3/next) | SAGE3 licence: academic, research and internal use only; no commercial use without a separate licence | Collaborative software for large tiled display walls, from the EVL/LAVA labs. The nearest prior art to the Wall: multiple users pushing windows, apps and documents onto a shared big surface. Read papers and docs for interaction design; do not read source with a view to reuse. |
| [badaix/snapcast](https://github.com/badaix/snapcast) | GPL-3.0 | Synchronised multi-room audio with a shared clock. Reference for the room audio requirement (B15/B31) and why `afplay` per device cannot stay in sync. [RustAudio/cpal](https://github.com/RustAudio/cpal) (Apache-2.0) is the permissive candidate for actual audio output from Rust. |

## 9. Leads for the Mac zero-frame blocker

[NATIVE_QA](../NATIVE_QA_2026-11-03.md) records zero complete frames from `CaptureService` and says not to guess a cause. Reading the references above against `native/macos/Sources/BorderlessCapture/CaptureService.swift` suggests what to instrument first. These are hypotheses, not a diagnosis.

1. **Count every callback, not only complete ones.** `FrameMailbox` returns early for any status other than `.complete`. ScreenCaptureKit sends `.idle` when nothing on the captured window changes, and the window under test is the app's own disposable window. Log raw callback count and each `SCFrameStatus` (idle, blank, suspended, started, stopped) to tell "no callbacks" apart from "callbacks but none complete".
2. **Capture a window that changes.** Selecting the capturing app's own window, which is mostly static, is the least informative target. Try a window playing video in another app.
3. **Queue depth and retained buffers.** The nonstrict example uses `queueDepth = 6` and notes that below 4 capture stutters. Ours uses 3 while also holding the latest `CMSampleBuffer` and enqueuing it into `AVSampleBufferDisplayLayer`, which retains surfaces too. That should not cause zero frames from the start, but it can starve the surface pool later.
4. **Headless or sleeping display.** The test Mac is a Mac mini. If no physical display is attached or the display is asleep, WindowServer may not composite and capture can deliver nothing. The Electron path also decoded zero frames from real capture in the latest run on the same machine, although an earlier run there decoded 748 frames (both in QA_MAC). Two independent capture paths failing at the same time points towards something in the environment having changed, not the Swift adapter alone. Retest with a display attached and awake, or an HDMI dummy plug. DeskPad shows the software equivalent.
5. **Permission identity of ad-hoc builds.** Screen Recording permission is tied to code signature. A rebuilt ad-hoc app can appear granted in a probe yet be treated as a new identity at capture time. Retest after removing and re-granting permission for the exact rebuilt app.

## Recommended next steps

1. Decide the Mac virtual display strategy explicitly: private `CGVirtualDisplay` (DeskPad route, works today, platform risk) versus capture-only windows on the Wall (public API, no true extended display). This blocks the core "drag over the edge" moment more than any library choice.
2. Run one spike sending a real captured window through Pion and through str0m to the Godot Wall, then pick one media stack.
3. For the Wall viewers, spike PDFium via PDFtoImage and EIRTeam.FFmpeg in `native/wall`.
4. For Windows, compare VirtualDrivers/Virtual-Display-Driver with Microsoft's IndirectDisplay sample and choose a base.
5. Add csbindgen to the Rust core build when the next batch of C ABI functions lands.
