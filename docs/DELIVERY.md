# Complete delivery plan

Milestone 2 now has a tested Portal-to-Tauri image flick and leader Console return to one selected Portal. Emulated touch, actual second-display Tauri image rendering and PDF page turns, and returned file byte equality passed. The hub places a flick near its horizontal aim within available space. Physical handset review remains open.

On 4 November 2026 the user accepted the live Mac window flow on the second monitor, including updates, movement or resizing, and Stop. Cross-machine playback and physical latency remain open.

The product scope remains the full Borderless platform. This register distinguishes executable alpha work from the native and enterprise work still needed. It is the queue for the next builder, not a claim that platform-specific features have shipped.

## Current milestone gate

Milestone 0 was accepted by the user on 3 November 2026: real Swift capture, live text update, rising complete-frame count and Stop clearing the preview, after an authorised macOS capture-service restart. Milestone 1 is now authorised: local LiveKit server, hub-controlled media grants, Swift publishing, and a design-system TypeScript/Tauri Wall. Real Swift capture now reaches the Chrome Wall through LiveKit on this Mac, updates beyond 75 seconds, survives authoritative movement/resizing and clears on native Stop. Actual Tauri playback is now verified locally and fullscreen on a second Acer display at 1080p, with Console move/resize, media-generation recovery after viewer join/revocation, source closure and Stop. Whiteboard and Studio use the approved design tokens. Milestone 1 remains incomplete: cross-machine LAN, precise glass-to-glass latency and user review remain. Later core moments are still incomplete. CODEX_BRIEF.md is the build order; its approved Swift/Rust/LiveKit/TypeScript/Tauri stack supersedes older Go/Godot planning below.

Software latency measurements now exist without requiring the user to film: a short real-window → actual Tauri burst gave median source-paint-to-screenshot bounds of 72.5–109.5 ms. This does not certify physical glass-to-glass latency or sustained 60 fps. See [LATENCY_MEASUREMENT.md](LATENCY_MEASUREMENT.md). The permission refresh is resolved. Explicit 60 fps ceilings were tested: repeated 1280×748 runs gave median bounds 33.5–71 ms and about 54.7 presented fps. Real 1920×1080 decoding was confirmed, but a full-resolution run included a 655 ms stall. The user confirmed the later Stop was intentional. The stall cause and sustained full-resolution frame rate remain open.

The 1080p transition is now identified in saved frames. A separate hidden-Wall suspension was reproduced and corrected. In a visible full-minute repeat, Tauri presented 3,134 frames with a 78 ms longest gap. See [LATENCY_MEASUREMENT.md](LATENCY_MEASUREMENT.md) for the paired runs and their limits.

The trusted LAN signalling path and setup instructions are implemented. A disposable test using the Mac’s Ethernet address passed HTTPS pairing, authorised WSS signalling and Stop. The second-machine room test remains open.

## Current engineering baseline

The repository now contains the original source, a complete product requirements document, local hub, three connected browser interfaces, desktop wrapper source, integration tests, recovery tools, signed-package verification and build/CI configuration. The capability matrix states the evidence for each subsystem.

Architecture correction: PRD v2 now follows a complete 14,281-line audit with a 90-block code index. The original Go/Rust/C# reference is restored in NATIVE_ARCHITECTURE. `native/` contains compiled Rust, Swift, Go and .NET/Godot foundations with real cross-language and room-client tests. The Go server replacement, media delivery and display drivers remain incomplete. Node/Electron is the current compatibility runtime, not an agreed replacement architecture. See NATIVE_QA_2026-11-03 and CLAUDE_REVIEW for exact evidence.

## Work packages

| Package | Status | Deliverable and acceptance |
| --- | --- | --- |
| WP01 Source and product record | Reconstructed; ready for independent review | PRD v2: 36 requirements, ten complete flows, entire source audit, 90-block checked index, native ADR, repository/licence research and review guide. Source hash unchanged. Product acceptance is still pending. |
| WP02 Room authority and control plane | Alpha implemented | Sessions, roles, CSRF, invitation/pairing, commands, ownership, audit and revocation; integration tests pass. |
| WP03 Files and shared canvas | Alpha + rendered acceptance | Electron/Chrome source/package flows pass notes, file send/return integrity, PNG drop/preview, grid, movement and resizing. Document/media preview breadth remains. |
| WP04 Portal and classroom tools | Alpha + rendered acceptance | A 390px Chromium Portal passes send/emulated touch flick, pointer, hand approval/revocation, draw/undo/SVG and quiz reveal in source/package smoke. Motion and physical iPhone/Android remain. |
| WP05 Local live screen sharing | Controlled spatial media passed; normal-candidate generated-media QA fails locally | Historical Mac source selection delivered 1450×920 frames. Current spatial source/package/DMG receive generated media in two Walls, preserve playback while arranging and stop/reconnect correctly in an explicit loopback fixture. Default/unicast generated-media tests fail locally, including on the old checkpoint; this does not establish a cause or qualify real OS-picked capture. Physical LAN, audio/codecs, ICE-failure recovery and OS privacy commissioning remain. |
| WP06 Native desktop shell | Mac source acceptance passed | Isolated hub survives native dialogs; renderer sandbox, child lifecycle, native-open cancellation and explicit TextEdit opening pass. Windows/Linux, edge cues, display placement/hotplug and signing remain. |
| WP07 Build and native distribution | Personal receiver unsigned Mac directory/DMG verified | Local 397-entry ASAR inspection, image checksum and 35-check directory/read-only DMG acceptance pass with loopback media. Code checkpoint `328adee` passes hosted 54-test core/source/build/archive/35-check package acceptance using unicast. Check later heads separately. Signing/notarisation, quarantined installer/upgrade/uninstall and provenance remain. No release publication. |
| WP08 Browser visual, interaction and accessibility QA | Receiver/spatial/recovery samples passed; product acceptance pending | 35 controlled checks include full canvas, utility geometry, real personal native windows, consent, initial/video/socket recovery, revoke/close/stop and capture reset alongside existing room flows. Package/DMG sample 134 colour pairs, minimum 4.888:1. Fresh scoped receiver/recovery UI review: ship. Final user review, full WCAG/VoiceOver, preview breadth and physical devices remain. |
| WP09 Storage lifecycle and retention | Session/receipt retention + SIGKILL recovery tested | Startup/30-second retirement removes inactive credentials, receipts and grants/inboxes while preserving active deduplication, content and audit. Real process kills at pre-upload-commit and post-purge/pre-unlink boundaries recover correctly. Room/content/audit policy, expiry administration and broader crash/load drills remain. |
| WP10 True Windows virtual display | Native engineering required | Base adapter on Microsoft's IddCx/UMDF sample and supported WDK, with a separate signed driver package. Enumerate an actual extended monitor, process its DirectX surface, encode through supported hardware paths, stream and provide safe disconnect/input return. Verify standard-user operation after authorised driver installation. |
| WP11 macOS display/capture strategy | Platform research + native engineering | ScreenCaptureKit for consented capture. Decide a supported virtual-monitor approach after API, entitlement, App Store and signing review. Do not substitute CoreMediaIO or private `CGVirtualDisplay` snippets as a shipping public API. Validate Intel/Apple Silicon, permissions, sleep and hotplug. |
| WP12 Native pointer/window handoff | Pending WP10/11 | Seamless edge traversal, per-display transforms, gesture/input ownership and reliable Escape/return. Explicit user control. Demonstrate a real OS window entering an extended monitor and continuing to render at the wall. Desktop edge cues are only a visual precursor. |
| WP13 Multi-display geometry and panoramic commissioning | Partial source | Mixed DPI, display rotation, negative coordinates, bezel compensation, touch mapping, reconnect, spanning and multi-head layout. Build a physical commissioning report for each installation. |
| WP14 Hardware synchronisation | Hardware-dependent | Choose a supported GPU/display/controller topology, verify genlock/frame-lock telemetry and measure scanout/tearing with test footage. Software VSYNC and a Vulkan swapchain alone do not prove panel synchronisation. |
| WP15 Infinite canvas and advanced collaboration | Pending | Versioned world coordinates, pan/zoom, out-of-viewport discovery, selection/focus UX, timeline/history, bounded snapshot deltas and export migration. Preserve ownership and room authority. |
| WP16 Managed secure storage and identity | Pending | OS-protected encryption key, database encryption strategy, user/tenant retention policy, school roster or enterprise directory, WebAuthn challenge validation and replay protection where required. Threat-model and test recovery before enabling. |
| WP17 Managed staged updater | Verification primitive implemented | Trusted signing-key enrolment, platform code-signature validation, resumable download, staging, operator approval, atomic apply at restart, rollback, fleet policy and key rotation. Never execute updates solely on a version comparison. |
| WP18 High availability | Pending architecture | Replicated authoritative state, leader election, lease/fencing, asset replication, observer failover and media renegotiation. Demonstrate host loss without cross-room or duplicate-command corruption. Backups alone are not HA. |
| WP19 Native mobile integrations | Pending | Native share extension / Android share target, managed local network permission/discovery, optional ReplayKit/MediaProjection with visible consent/stop, battery and foreground/background tests. Browser portal already covers files, touch, ink and quizzes. |
| WP20 Physical spatial discovery | Optional research | BLE/proximity and calibration with measured uncertainty, user-correctable seat assignment and privacy policy. RSSI alone is not exact pointer position. |
| WP21 Operational release | Pending all relevant gates | Security review, supported-browser matrix, load/latency report, backup drills, school/enterprise retention, accessible flows, signed builds, support and installation guide. Publish only tested capability claims. |
| WP22 Spatial experience correction | Shell and personal receiver alpha implemented; experience incomplete | Full workspace/floating utilities and shared file/note/live geometry now extend into owner-invited, recipient-accepted independent Mac receiver windows. Consent, retry/reconnect, revoke, close/Stop receiving and capture reset pass in 35 controlled checks, with 54 code tests. Normal interface media, physical trusted-LAN/audio/phone/flick acceptance and final user review remain. True native handoff stays in WP10–12. |
| WP23 Native foundation and authority migration | First compiled units, not complete | Rust C ABI geometry/health; Swift picker/capture/preview/stop; .NET authenticated read-only room client; Godot notes/geometry scene; strict Go move guard. Eight Rust, three Swift, 19 .NET checks, Go race tests and headless Godot scene pass locally. Local Swift capture/update/Stop accepted after capture-service recovery; no native media transport/encoder/driver implemented. Complete native capture-to-receiver before expanding administration. |
| WP24 Audio, edit-return and full content rendering | Explicitly retained | PRD B11/B31/B34: actual document/media renderers, synchronised selected room output, immutable edited revisions with parent hash and explicit return. Existing file download is not native preview or audio routing. |

## Next execution order

The user's latest priority is the spatial experience in PRODUCT.md and DESIGN.md. Complete the full-workspace shell, floating tools/content, live screen windows and deliberate phone/desktop transfer flow before broadening peripheral administration. The old dashboard is not an accepted product direction, regardless of its technical test results. Personal desktop patching and actual OS window-edge handoff remain in scope and must not be represented by the explanatory simulations.

0. **Superseding order (PRD v3):** follow the "Build order and completion" steps in PRD.md, which put the three core moments C1-C3 first and build everything else onto them. The items below remain the detailed queue within that order. Current findings are in CLAUDE_REVIEW_RESULTS.md.
1. Review VISION/PRD v3/SOURCE_AUDIT/NATIVE_ARCHITECTURE and the compiled foundations in `native/`. Real ScreenCaptureKit complete-frame delivery is now accepted on this Mac; add hardware encode, authorised native transport/decoder and an actual live native Wall/personal window. Keep the same room authority. Native library tests are not this end-to-end gate.
2. Bring the full spatial content/utility model and phone flick/destination into the native Wall; implement genuine viewers and room audio, preserve existing browser/classroom behaviour and test physical clients. Current Electron default mDNS peers connect but source frames fail; the Swift route now works locally after capture-service recovery; this does not retest Electron. Do not assume either failure is caused by ICE, permissions or language choice without evidence.
3. Continue WP10–14 to fulfil native display/window-edge handoff with a real extended monitor, safe input return and measured hardware behaviour. Retain the bounded canvas as an explicit current limit.
4. Complete WP08 assistive-technology/media/document breadth, Windows/Linux/hotplug and installer/signing gates. Keep artefacts private/unsigned and check current hosted source/package outcomes separately. Release a labelled alpha only after its device gates pass.
5. After the spatial experience, continue WP09 content/audit retention and broader crash/load/backup drills, then managed identity/updates and measured HA. Logical deletion is not certified physical erasure; preserve the complete scope register.

## Test gates

| Gate | Required evidence |
| --- | --- |
| G1 Local code | Syntax/manifests, original checksum, integration/recovery tests and portable source build. |
| G2 Browser | Screenshots and user-flow results from reachable real browser; no console errors; phone and desktop layout checks. |
| G3 Device room | Two physical clients, iPhone/Android portal, real screen/video/audio, TLS trust, join/eviction/reconnect. |
| G4 Native | OS-specific wrapper launch, capture refusal/stop, IPC tests, display hotplug, safe local opening and signed installer verification. |
| G5 Display extension | Actual OS-recognised extended monitor, hardware capture/encode and reliable pointer/window return on each claimed platform. |
| G6 Enterprise | Storage lifecycle, identity/retention, external audit anchoring if required, staging/rollback, load report and hardware/HA evidence for advertised features. |

## Source traceability

Line numbers refer to `docs/source/2026-11-03-original-conversation.md`.

| Source area | Lines | Destination |
| --- | --- | --- |
| Original phone/laptop-to-wall concept, architecture options | 115–795 | PRD B02–B14; WP02–06, WP10–12 |
| Driver/capture/discovery/GLSL and mobile gesture proposals | 797–3271 | Architecture; WP05, WP10–14, WP19 |
| Real storage, multi-user ownership, native open, reverse flow, TLS | 3273–6217 | PRD B06–B14, B21–B24; security corrections |
| Multi-head, audit, failover, hardware identity, sync suggestions | 6219–8007 | WP09–18 and research register |
| Leader console, live meeting/jam, spatial seats, pointer, ink/audio | 8009–9777 | PRD flows and WP03–06, WP13, WP20 |
| Installers, update proposals and multiple aesthetics | 9779–11223 | Desktop/release tools, B19–B20, WP07, WP17 |
| Classroom, hand raising, quiz and complete flows | 11225–12981 | PRD B15–B18; classroom implementation/tests |
| Final naming choice and entire-platform instruction | 12983–14281 | Borderless identity, full-scope delivery register |

The source's repeated statements that everything is “production-ready” are historical claims. They are not accepted as test evidence or reasons to skip these gates.
