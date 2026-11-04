# Independent review results

Reviewed 3 November 2026. Branch `feat/borderless-platform`, PR #1 (draft, open), head `32511a5427e76c1f4f90b169e2f35a5cc53196d3`, local and remote heads identical, working tree clean before the review. Scope: the full review brief (requirements fidelity, architecture, implementation, reuse, evidence) plus the entry points in `docs/CLAUDE_REVIEW.md`.

Review only. No product code, archive or other documentation was changed. Nothing was committed, pushed, merged or published. This is the only file written in the repository. All probes ran on disposable data in a scratch directory outside the repository and were deleted afterwards.

**Confidence labels.** **Confirmed** means I reproduced the problem or read code that shows it directly. **Hypothesis** means a likely cause I have not proved.

## Status after fixes (same day)

After this review the user authorised fixes. Done: PRD v3 and VISION.md (fidelity table items B37-B41), H2 private audience, M1 and M2 Swift failed state and diagnostics, M3 web Stop race, M4 web first-frame check. Still open: H1 (needs the user's real capture re-test), H3, M5-M8, L1-L8, V1, V2. See BUILD_HANDOFF.md for evidence.

## Overall assessment

**Fidelity.** PRD v2 is a faithful and unusually honest reconstruction. I read all 1,032 non-code lines of the original conversation (every user turn and every assistant proposal). Nearly every meaningful request has a requirement ID and an acceptance contract, and the source audit correctly separates useful intent from code that is invalid or insecure. The omissions I found are narrow and listed below. The most significant is a privacy gap in the running implementation rather than in the PRD: today every live screen is delivered to the leader and the Wall, so there is no private personal-only patch.

**Architecture.** Go hub, Rust core, Godot/.NET Wall, and Swift and Windows adapters is a practical split, and ADR 001 records it honestly. The largest unaddressed decision is how the native Wall decodes live video and renders documents. Godot has no built-in H.264 decoder and no PDF renderer, so a native media and document path has to be chosen before the native Wall can show live windows or real files.

**Implementation.** The native foundations compile, pass their gates and held up under every hostile input I tried. They are foundations only, and the documents say so. The one blocking engineering fault is unchanged: real ScreenCaptureKit capture on this Mac produces zero complete frames, and the Electron path on the same Mac fails the same way. In the compatibility web client I found a confirmed Stop race in capture start-up and no source-side first-frame check.

**Readiness.** Not ready for product acceptance or release, and nothing claims to be. Ready for the next engineering step once the capture fault is diagnosed.

## Tests performed

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts && npm run verify`, Node 24.22.1 | Pass: check, 54/54 tests, build. Includes archive SHA-256 and code-index regeneration. |
| `npm run native:verify` without engine | Pass: Rust fmt/clippy, 8 tests and build; Go race tests; .NET build; 19 .NET checks against a disposable loopback room; 3 Swift tests; Godot project build. The script reports the skipped engine gate. |
| Same, with local official Godot .NET 4.7.2 and `DOTNET_ROOT=~/.dotnet` | Pass, including editor import and the headless scene smoke ("actual text, stable surface, authoritative move/removal"). |
| Godot error guard in `scripts/verify-native.mjs` | Probed with a scratch project calling `push_error`. Piped output prints a plain `ERROR:` line, so the guard catches it. With `dotnet` missing from PATH the engine hangs rather than exiting, and the script's 180 s timeout is what fails it. |
| Hostile WebSocket probe of `RoomClient.WatchAsync` (copied source, scratch `ws` server) | Three-fragment message reassembles into one document. 5 MB of fragments rejected with `InvalidDataException` before EndOfMessage. Binary frame rejected. Abrupt close mid-fragment raises `WebSocketException`, and no partial document is yielded. |
| Archive and index | `shasum -c` OK: 14,281 lines, 387,055 bytes, unchanged since `3ee217e`. All 90 `Use code with caution.` end markers are indexed, and the archive has no other fenced code. |
| Reuse provenance | All ten pinned commits exist upstream with the stated dates, each named licence file exists at that commit, and both cited source paths exist. Godot `4.7.2-stable` is a published release. |
| Hosted CI at `32511a5` | All checks pass (`verify`, `mac-desktop`, `native` on Ubuntu and macOS) for push and pull_request, for example run 41628593591. Hosted native jobs skip the Godot engine gate. |
| Rendered Console and Wall (Playwright on a disposable room: two notes and one PNG) | The workspace fills the viewport, the chrome floats, the Wall mirrors the room's geometry and shows a QR join card. Findings V1 and V2. |

**Not performed:** real OS capture (it needs an interactive consent dialog with disposable content, so it is the user's manual check), live-screen and flick rendering, Windows, physical phones, LAN, multihead, assistive technology. My scripted phone join did not complete in the headless browser; I did not investigate, because the existing rendered acceptance covers that flow. About 4 GiB of disk was free and no large installs were needed.

## Findings by severity

Classification key: **MI** missing implementation, **DD** design disagreement or gap, **SD** security or privacy defect, **UH** unverified hardware or OS claim, **TG** test gap, **DOC** documentation accuracy, **VF** visual or interaction fidelity.

### High

**H1 · UH/MI · Confirmed failure, cause unknown. Native capture returns zero complete frames, and Electron fails the same way on this Mac.**
`docs/NATIVE_QA_2026-11-03.md` and `docs/BUILD_HANDOFF.md:19` record zero complete frames from Apple's picker in the Swift host. `docs/CAPABILITIES.md:34` separately records that an OS-picked window via Electron decodes zero frames "despite a live track and granted Screen Recording status". On macOS 14 both paths depend on ScreenCaptureKit, and `docs/DELIVERY.md` WP05 says this Mac previously delivered 1450×920 frames.
*Hypothesis:* the cause is shared (OS, permission state or source choice), not adapter-specific. `BUILD_HANDOFF.md:19` calls the two failures separate, which risks two investigations of one fault.
*Diagnostic order, using disposable content only:*
1. Baseline the OS with Apple's own tools (QuickTime screen recording, or `screencapture -l <windowID>`) on a disposable window owned by another app.
2. Select a window from a different process. The recorded test captured only the host's own window, which mostly shows its own black preview layer.
3. Count every callback before filtering (M2) and log `stream(_:didStopWithError:)`.
4. Check TCC churn: `scripts/package-native-mac.mjs` ad-hoc signs each rebuild, which changes the code identity. Confirm whether picker-mediated capture on 14.5 still depends on a Screen Recording grant for that identity.
5. Read the unified log for the ScreenCaptureKit and replayd subsystems during an attempt.

**H2 · SD/DD · Confirmed. No private live audience: every screen share reaches the leader and the Wall.**
`server/stream-policy.mjs:9` grants receipt to the owner, to every `admin` and `wall` session, and to accepted invitees. `stream.start` (`server/app.mjs:636-668`) has no audience parameter. PRD F03 (`docs/PRD.md:118`) says "Room-share and personal/private audiences are distinct; leaders cannot secretly add personal viewers", and B18 says leader status does not grant private capture. Consequence: someone who wants to patch their screen only into a colleague's personal window (the creative-jam scenario, source 8577-8591) must also publish it to the leader and the room display. That is not deceptive, since the share is visible, but the required private mode does not exist.
*Correction:* add an explicit audience (`room` or `personal`) to `stream.start`. Personal streams get no Wall or leader grant and no Wall surface, and only accepted invitees receive them. Test that a leader cannot receive or signal a personal stream. The native transport must keep the same rule.

**H3 · DD/MI · Confirmed by absence. The native Wall has no media or document rendering path.**
`docs/NATIVE_ARCHITECTURE.md` describes "decoder → GPU texture" without naming a decoder. Godot's built-in video player supports only Ogg Theora, and Godot has no PDF renderer. B11 (useful previews) and the live-window experience therefore depend on a decision that has not been made: platform decoders (VideoToolbox, Media Foundation) feeding textures through a Godot extension, or an FFmpeg-based plugin, plus PDFium for documents. Each option has different licence and packaging consequences (see Reuse).
*Correction:* add this to ADR 001 as an explicit decision, and prove one H.264 stream and one multipage PDF rendering in the Godot scene before more Wall interaction work.

### Medium

**M1 · MI · Confirmed. A zero-frame capture never enters a failed state (Swift).**
`native/macos/Sources/BorderlessCapture/CaptureService.swift:116-127` maps `.stale` with zero frames to a status string but keeps `active == true` and the stream running indefinitely. The only public state is `status: String`, `frames` and `active` (lines 34-36). PRD F03 calls connected transport without frames a capture error. Publish the typed `FrameHealth`, add a failed state after the first-frame deadline, and stop the stream or prompt. A room layer must never parse UI strings.

**M2 · TG · Confirmed. The Swift mailbox drops invalid frames without counting them.**
`CaptureService.swift:13-18` silently ignores non-screen, invalid, incomplete or zero-size samples. That is the right gate for counting live frames, but it also explains why the QA cannot say whether callbacks arrive at all. Keep diagnostic counters for raw callbacks, for each `SCFrameStatus`, and for missing attachments or image buffers. Never log pixels.

**M3 · SD · Confirmed by reading, not reproduced. Stop race during web capture start-up.**
In `public/js/rtc.js:52-68`, `getDisplayMedia` resolves, then `stream.start` is awaited, and only afterwards is `onended` attached to the video track. If the person presses the browser's own "Stop sharing" bar while that command is in flight, the `ended` event fires with no handler. The room keeps a stream record for a capture that has ended, and the owner's client keeps `this.local` with dead tracks until a reconnect. This matches the class of race the brief asks about.
*Correction:* attach `onended` immediately after `getDisplayMedia` resolves. After the command returns, check `track.readyState`, and if it has ended, send `stream.stop`. Add a regression test that ends the track during the command.

**M4 · MI · Confirmed. No source-side first-frame check in the web capture path.**
The personal receiver checks real frames through `requestVideoFrameCallback` (`public/js/screen.js:112-119`), but the source in `rtc.js:52-70` treats a resolved `getDisplayMedia` as success. That is exactly the "live track, zero frames" state recorded in `CAPABILITIES.md:34`. B12 requires first-frame readiness. Mirror the Swift policy: wait for a first decoded frame on a local preview, apply the same Rust health thresholds, and show "no frames" as a capture error.

**M5 · DD · Migration plan gaps.**
`docs/NATIVE_ARCHITECTURE.md:79-87` correctly requires an offline importer, preserved IDs, ownership, geometry and hash chains, invalidated sessions and a single writer. Missing:
- **Command receipts.** A client retry that straddles cutover can commit twice if the receipt table is not imported.
- **Pending durable work.** The cleanup and purge queue must carry over so that purges requested before cutover still complete.
- **Fencing.** "Old hub remains stopped" is a procedure, not an enforcement. Write an epoch or tombstone into the old database at export so the Node hub refuses to start as authority again.
- **Rollback.** Line 84 contradicts itself: a checkpoint restore does erase work committed on the Go hub after cutover, unless there is a reverse export or a freeze window. State which applies.
- **Grants.** State explicitly that capture grants, personal-window invitations and Wall pairings are invalidated as well as sessions, and that the audit chain is re-verified after any asset re-encryption.

**M6 · DD · The proposed v1 move envelope freezes the bounded canvas.**
`native/hub/control/move.go:87` accepts only `0 <= x,y <= 1`, while `native/protocol/README.md` presents it as the first versioned migration command. B32 calls the normalised canvas a current limit to be migrated to world coordinates, so a v1 contract that cannot express them forces a second migration. Add a coordinate-space field, or define v1 in world units with the normalised mapping as an adapter.

**M7 · TG · The native Wall parser is tested only against hand-written fixtures.**
`scripts/test-native-room.mjs` drives the real hub, but the .NET checks stop at counting hello/state messages, and `WallSnapshot.Parse` never sees a real server snapshot. The parser duplicates its limits (`native/dotnet/Borderless.Native/WallSnapshot.cs:15,24-26`: 60 items, 240 title, 80 owner, 8000 note). Today they exceed the server's limits (`server/protocol.mjs` 60 items, note 4000, title 120, file name 160), but nothing detects drift. Parsing is all-or-nothing, so one unexpected item freezes the whole Wall. `x + w <= 1` is not checked. Generate a hub fixture and assert that the Wall renders it (B33).

**M8 · DD · One capture per device.**
`server/app.mjs:638` rejects a second stream from the same device, while the jam scenario (source 8585) has one person contributing a window while others share theirs. A designer who wants a design tool and a terminal both live must use two devices. If this limit is deliberate, record it as a safety bound with a target. Otherwise allow several sources per device, keeping a separate generation and grant for each capture (which B29 already requires).

### Low

**L1 · DD · Edge ownership in display mapping.** `native/core/src/lib.rs:48` treats both edges as inside (`0..=1`). A point exactly on the boundary between adjacent displays therefore maps validly to both, which matters for edge handoff. Use half-open ranges or a documented tie-break. The rotation convention is self-consistent but is not yet tied to `CGDisplayRotation` or Windows `DISPLAYCONFIG_ROTATION` values; each adapter needs a fixture.

**L2 · MI · Swift links the debug Rust library through an unsafe relative flag.** `native/macos/Package.swift:12`. Fine for diagnostics. Release builds, and use of the package as a dependency, need a binary target or a build step.

**L3 · Swift details.** `FrameHealth.swift:8` uses `precondition` for an ABI mismatch, which terminates the app, whereas .NET throws. The picker observer added at `CaptureService.swift:48` is never removed. The height clamp at line 90 keeps the full 1920 width, so for tall sources the configured size no longer matches the aspect ratio. The mailbox and `AVSampleBufferDisplayLayer` both retain buffers against a `queueDepth` of 3, so watch for pool starvation once frames flow.

**L4 · TG · Wall threading versus the ADR.** `NATIVE_ARCHITECTURE.md:65` says to validate off the scene thread, but `native/wall/Wall.cs:69-77` queues raw JSON and parses up to 4 MB inside `_Process`. Move parsing to the network task and hand the main thread a validated `WallSnapshot`.

**L5 · DD · Revocation of live viewing is enforced by the sharer's client.** Media is peer-to-peer. The hub stops signalling, and the owner's `rtc.js:92-103` closes peers that are no longer granted. That is reasonable, because the sharer is the party with an interest in enforcing it, but it should be written down as a design property. The native transport must keep it, or move enforcement to a hub-side media relay (see Architecture).

**L6 · SD (hardening) · CI actions are pinned by mutable tags.** `.github/workflows/native.yml:19-28`. Pin them to commit SHAs. Permissions are already read-only.

**L7 · DOC · "Native" is ambiguous.** `docs/CAPABILITIES.md:16,26` says "native Console" and "native receiver window" for Electron, while `native/` means Swift and Godot, so Electron evidence can be misread as native-stack evidence. `NATIVE_ARCHITECTURE.md:73` says to reject "fragmented payloads", while the client correctly accepts bounded fragmentation; reword it to "oversized or incomplete".

**L8 · DOC · "Optional" wording.** BLE beacon seating (source 8657) appears only in `docs/SOURCE_AUDIT.md` and as WP20 "Optional research" (`docs/DELIVERY.md:34`). HA is "optional" in B28 and F10. Say explicitly that these are in scope and optional per installation, so they are not read as dropped.

**V1 · VF · New contributions land on top of existing work.** In the rendered room, the uploaded PNG covered most of the second note. File placement cycles `y` modulo 3 (`server/app.mjs:1107`) without avoiding occupied space. F02 says concurrent contributions must not displace what is already shown. Place new content in free space near the destination, or near the seat when there is none.

**V2 · VF · Decorative tilt on notes.** `public/style.css:1038-1043` rotates notes by -1.5° and +1.2°. On a distant Wall, rotated text is harder to read, and DESIGN.md asks for quiet, legible content. Consider removing the tilt in Wall mode at least. This is a taste call for the user's final visual review, not a defect.

## Missing or disputed requirements

| Source lines | Original request | PRD v2 / implementation | Assessment |
| --- | --- | --- | --- |
| 8577-8591, 13175 | A person's live window can join someone else's work privately or in the room | B29, F03 specify private audiences; the code always includes leader and Wall | **Weakened in code** (H2). |
| 11281 | Classroom: 30 students point to vote and drag keywords into the correct columns | B17 covers multiple-choice quiz only | **Omitted.** Add pointer voting and a categorise/drag activity to B17, or record a decision to drop them. |
| 141, 435 | NDI offered alongside WebRTC for low-latency video | Not mentioned in PRD, ADR or reuse research | **Omitted decision.** NDI is a proprietary SDK; record whether it is an optional installation integration or out of scope. |
| 7165 | A hardware security key or phone biometric signs each upload | B28 covers hardware-backed login only | **Weakened.** Per-transaction signing differs from login; record a decision. |
| 2405, 4213 | Dual-mode arrival effects (liquid for desktop edge, particle vortex for phone), tinted with the sender's colour | B20 and PRD contract 6 retain the effects, but not the mapping from effect to transfer type or the sender's colour | **Partly weakened.** Add both points, keeping colour as a secondary cue (B36). |
| 10653, 11801 | Any participant's theme button changes the room's look | `ARCHITECTURE.md:105`: leader-only | **Reasonable departure, undocumented.** Record it as a decision. |
| 13065, 13185 | Leader console shows a mini-map of the Wall | Console now works on the same full canvas | **Reasonable departure.** Record it; a mini-map may still help on a tablet driving a large panoramic Wall. |
| 8657 | BLE beacon seat assignment | Audit and WP20 only | See L8. |
| 115-167, 13233 | Mouse glides off the laptop edge onto the wall; real window moves into an extended display | B25, B30, F04, kept open | **Preserved and honestly open.** |
| Remaining | Phone flicks, reverse delivery and edited returns, room audio, multihead and frame lock, themes including the clean Whiteboard look, classroom hand raise and quiz, installers and signed updates, audit, HA, Linux deployment | B06-B36, F01-F10 | **Preserved.** Unsafe proposals (certificate bypass, shell execution, unsigned self-update, client-side scoring) are correctly corrected, not dropped. |

No feature has quietly been turned into a prototype. The source's own suggestion to cut to an MVP (13219-13243) was overridden by the user (13259), and PRD v2 follows the user.

## Architecture assessment

**Boundaries.** Practical, with one caveat: the product now spans Go, Rust, C#, Swift and soon C++, plus the web Portal. That works only because the Rust ABI is small and value-only, and because the hub stays the single authority. Keep it that way. Rust should own pure, shared policy (geometry, health, input leases, frame bookkeeping), not OS calls that Swift or C++ already reach directly.

**Go hub.** A good fit, and Pion is a credible media companion. The guard unit is well written. Port behaviour behind conformance fixtures generated from the Node hub before writing more Go commands (M5, M6).

**Godot/.NET Wall.** A reasonable choice for the spatial renderer and effects, but it carries the two gaps in H3 (video decode, document rendering), plus multi-window per-head output, which needs early qualification. Check the screen-reader support (AccessKit integration) of the pinned Godot version before relying on it for B36.

**Swift Mac adapter.** Correct use of the public picker and ScreenCaptureKit. Capture is public and supported. Virtual-display creation is not, and ADR 001 keeps those two separate correctly. Options for the display route:
- A private `CGVirtualDisplay` approach (the pattern DeskPad uses): works today, but App Store-incompatible and liable to break with OS updates.
- A physical or USB display adapter: supported, but needs hardware.
- An Apple-supported partner route, if one exists.
Ordinary live-window patching does not need a virtual display, so it should not wait for this decision.

**Windows adapters.** IddCx is the supported route, and WGC is the right capture API. Driver signing and HLK are the real schedule risk; start the attestation-signing account early.

**Media transport, and an alternative worth costing.** Today media is peer-to-peer and revocation is enforced by the sharer (L5).
- *Option A:* keep peer-to-peer WebRTC (Pion or libdatachannel natively, the browser on the Portal). Lowest latency and no media load on the hub. Every receiver needs its own encode or a shared simulcast, and audience enforcement stays on the sender.
- *Option B:* a selective forwarding unit beside the Go hub (Pion supports this). Audience and revocation are enforced by the authority, one upload serves many receivers, and recording or relay become possible. The cost is an extra network hop, about 1 to 5 ms on a LAN, plus hub CPU and bandwidth.
For rooms with a Wall, a leader and several personal viewers, B is likely better. For a single personal patch, A is simpler. Measure both with one real capture before choosing; supporting both is reasonable if the audience model is shared.

## Reuse

The pinned research is accurate (see Tests performed). Additional candidates I found worth recording; licences were checked through the GitHub API on 3 November 2026 and still need commit pinning:

| Project | Licence | Use | Integrate or reference |
| --- | --- | --- | --- |
| `VirtualDrivers/Virtual-Display-Driver` | MIT | Maintained IddCx virtual monitor derived from the Microsoft sample | Integration candidate for WP10, next to the Microsoft sample. Review its EDID, IPC and installer code; MIT notice required. |
| `Stengo/DeskPad` | MIT | macOS virtual monitor using private `CGVirtualDisplay` | Reference only, until the user makes an explicit private-API decision (WP11). |
| `nomi-san/parsec-vdd` | MIT | Controls Parsec's virtual display driver | Reference only. The driver binary it controls is Parsec's own, with separate terms. |
| `EIRTeam/EIRTeam.FFmpeg` | MIT (plugin); FFmpeg LGPL or GPL depending on build | FFmpeg-based video decoding inside Godot | Candidate for H3. An LGPL-only FFmpeg build with dynamic linking keeps obligations manageable; avoid GPL components. |
| `bblanchon/pdfium-binaries` and `sungaila/PDFtoImage` | MIT packaging; PDFium BSD-3/Apache-2.0 | Multipage PDF rendering to textures for the native Wall | Integration candidates for B11. Notices required. |
| `webrtc-rs/webrtc` | Apache-2.0 | Rust WebRTC | Only if the transport moves into the Rust core. Otherwise Pion is the stronger, more mature choice. |
| `AccessKit/accesskit` | BSD-3-Clause | Accessibility tree | Check how Godot integrates it, before writing custom accessibility. |
| GStreamer | LGPL (mixed plugin licences) | Decode, mix and output media, `webrtcbin` | Heavy but complete. Consider it for room audio (B31) if a decoder plugin is not enough. Plugin-by-plugin licence review needed. |

Packaging obligations still missing from the plan: Godot's third-party copyright file and the .NET runtime notices when the Wall ships, plus the notices for any of the decoders above. Nothing GPL or AGPL is copied. All native code is new; I read every line.

## Answers to the brief's specific questions

- **Do all original requests survive?** Yes, apart from the table above.
- **Spatial direction?** The Console and Wall render as the endorsed full-canvas layout with floating tools. I saw no permanent panels. Visual acceptance correctly remains with the user.
- **Stack and single authority?** Preserved. The Node hub is the sole writer, the Go code is not a running server, and the .NET Wall client is read-only. The Mac display route is honestly open.
- **Archive and audit?** Reproduced exactly. The audit distinguishes intent from defective code.
- **Native code under hostile input?**
  - Rust ABI: the struct layout matches across Rust, C and .NET, all invalid inputs return the invalid result, and no pointers cross the boundary.
  - Swift: generation and stop ordering holds under the interleavings I traced, and a Stop during `startCapture` merely stops the stream twice.
  - .NET: bounded fragmented receive, confirmed by the probe.
  - Go guard: rejects duplicate keys (including escaped and case-variant spellings), unknown, null, missing and trailing input, oversize input and out-of-range values, and takes authority only from trusted state.
- **Are limits stated accurately?** Yes. Zero frames is recorded as a failure, the Wall is described as notes only, the Go unit is not a hub, and the Windows directory is a README. L7 is the only accuracy risk.
- **Migration safety?** The principles are right; the specifics are in M5.

## Ordered engineering plan

1. **Diagnose capture (H1, M2).** Add the raw callback counters, then follow the diagnostic order. Exit: complete frames from a disposable window of another app in the Swift host, with the cause written down. Reuse the finding to fix or explain the Electron path.
2. **Make capture state truthful (M1, M3, M4).** Typed failed state in Swift; fix the web Stop race and add source first-frame checks, with regression tests.
3. **Fix the audience model (H2) in the current hub**, with tests, so that the native transport inherits a correct rule.
4. **Decide media transport and native decode (H3, Architecture).** Measure peer-to-peer against a forwarding unit using one real capture, choose a Godot decode path and PDF renderer, and record both in ADR 001 with licences.
5. **First native vertical slice.** ScreenCaptureKit, then VideoToolbox H.264, then authenticated transport tied to the hub grant, then Godot decode to a texture, in the same room. Prove stop, revoke, reconnect, and that a new capture needs new grants, on real OS pixels.
6. **Native personal receiver** (AppKit window, local placement), defaulting to muted, with Close, Stop receiving, Revoke and Stop sharing behaving as distinct actions.
7. **Native Wall content parity (M7):** generated hub fixtures, files, PDF, images, notes, ink and quiz views, then moving and resizing through hub commands, with non-overlapping placement (V1).
8. **Physical spatial flow.** Phone flick with a visible destination and acknowledged arrival on real iPhone and Android, then two physical computers on a trusted LAN. Show it to the user for visual review. This gate cannot be met by tests alone.
9. **Close the PRD gaps** from the table: classroom activities, NDI decision, per-upload signing, effect mapping, and the theme and mini-map decisions.
10. **Go migration (M5, M6).** Conformance fixtures first, world-coordinate contract, importer with receipts, queue and fencing, then a single cutover.
11. **Display extension.** Windows IddCx (consider Virtual-Display-Driver) with signing started early. In parallel, the user decides the Mac display route. Then edge handoff with input leases and Escape/loss release (B30).
12. **Multihead, audio, accessibility, packaging, then managed operations,** in the PRD's build order.

This review is not approval to merge, publish or change the architecture.
