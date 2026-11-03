# Complete delivery plan

The product scope remains the full Borderless platform. This register distinguishes executable alpha work from the native and enterprise work still needed. It is the queue for the next builder, not a claim that platform-specific features have shipped.

## Current engineering baseline

The repository now contains the original source, a complete product requirements document, local hub, three connected browser interfaces, desktop wrapper source, integration tests, recovery tools, signed-package verification and build/CI configuration. The capability matrix states the evidence for each subsystem.

## Work packages

| Package | Status | Deliverable and acceptance |
| --- | --- | --- |
| WP01 Source and product record | Done | Exact original archive, checksum, agreed naming, PRD, flows and implementation/evidence split. |
| WP02 Room authority and control plane | Alpha implemented | Sessions, roles, CSRF, invitation/pairing, commands, ownership, audit and revocation; integration tests pass. |
| WP03 Files and shared canvas | Alpha + rendered acceptance | Electron/Chrome source/package flows pass notes, file send/return integrity, PNG drop/preview, grid, movement and resizing. Document/media preview breadth remains. |
| WP04 Portal and classroom tools | Alpha + rendered acceptance | A 390px Chromium Portal passes send/emulated touch flick, pointer, hand approval/revocation, draw/undo/SVG and quiz reveal in source/package smoke. Motion and physical iPhone/Android remain. |
| WP05 Local live screen sharing | Same-Mac capture/transport/reconnect verified | Real Mac source selection delivers 1450×920 frames to Chrome. Generated media reaches two cookie-sharing Wall tabs, restores after receiver reconnect and ends on explicit stop/owner disconnect. Departed peers are retired. Physical LAN clients, audio/codecs, ICE-failure recovery and OS privacy refusal remain. |
| WP06 Native desktop shell | Mac source acceptance passed | Isolated hub survives native dialogs; renderer sandbox, child lifecycle, native-open cancellation and explicit TextEdit opening pass. Windows/Linux, edge cues, display placement/hotplug and signing remain. |
| WP07 Build and native distribution | Mac unsigned directory/DMG verified | ASAR inspection, image checksum and expanded directory/read-only DMG acceptance pass locally. Hosted Mac build/controlled source+package acceptance passes at cdf5fe9. Signing/notarisation, quarantined installer/upgrade/uninstall and provenance remain. No release publication. |
| WP08 Browser visual, interaction and accessibility QA | Keyboard/reconnect/motion/colour acceptance passed; breadth pending | Source/package Console, 390px Portal and 4K Wall pass 26 checks: drop/flick, versioned keyboard/mouse movement, ownership, nested dialog/panel/Portal focus, tab keys, lost acknowledgements, draft/identity/permission refresh, live reduced motion and eviction recovery. 87 representative settled text/control samples meet 4.5:1 across five themes plus the access banner. Full WCAG/VoiceOver, media/document breadth and physical phones remain. |
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

## Next execution order

1. Mac source/package/DMG acceptance and hosted controlled Mac package checks pass. Keep artefacts private and unsigned. Complete Windows/Linux native acceptance and the installer/signing gates; hosted same-machine media does not qualify LAN/mDNS or OS permission prompts.
2. Complete WP08 assistive-technology/media/document breadth and WP05/G3 on two physical clients plus an iPhone. Same-Mac capture, keyboard/focus, motion/colour samples, draft/authority reconnect and two cookie-sharing media receivers pass; trusted LAN QR, real touch, audio and device breadth remain. Keep representative checks separate from a complete accessibility audit.
3. WP09 has bounded session/receipt retention and real upload/purge SIGKILL tests. Next define room/content/audit retention, expiry administration and run broader crash/load/backup drills. Do not describe logical deletion as certified physical erasure.
4. Ship a labelled local collaboration alpha after its actual-device evidence passes. Continue WP10–14 to fulfil the seamless native display-extension vision.
5. Add identity, managed updates and HA only against a measured deployment need and a documented authority model. Preserve the complete scope register.

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
