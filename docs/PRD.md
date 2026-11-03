# Borderless product requirements

Version 3.0 · 3 November 2026 · Rebuilt around the original conversation, which is the primary source of what the app is

**Read [VISION.md](VISION.md) first.** It describes the app in the original conversation's words, and it takes precedence over this specification. Everything below exists to build that app.

## The app, in one paragraph

Drag a window off the edge of your Mac or PC and it travels, with an effect, onto the room's big screen, live and usable. Flick a file up from your phone and it lands on the wall where you aimed. Send work back down to one person's phone. Everyone in the room can do this at once, side by side, without anyone taking over the screen. One product with three views: the Wall, the Portal on phones and laptops, and the leader's Console (source 115-167, 8559-8597, 13041-13069).

## The three core moments (build these first)

These are the reason Borderless exists. Each has an experience test, judged by the user watching it happen on real devices, and a technical test. Passing the technical test alone is not done.

| ID | Moment | Experience test (user review on real devices) | Technical test |
| --- | --- | --- | --- |
| C1 | **Laptop window over the edge** (115-167, 397, 8585) | On a real Mac, and later a PC, you drag an ordinary application window past the screen edge nearest the wall. The edge glows when armed, the window dissolves on the laptop as it arrives on the wall, and it keeps running live there at your seat's position. You drag it back and it returns. | OS shows a real extended display; the app keeps running on the source; frames are captured, hardware-encoded, sent to the authorised Wall and rendered live; stop, cable or network loss returns the window to a reachable screen. Covers B25, B26, B30. |
| C2 | **Phone flick onto the wall** (129, 399, 3253, 4191, 8571-8573) | On a real iPhone and Android, you pick a photo or PDF, flick it up, see it leave the phone and arrive on the wall as a real openable window near where you aimed, with your colour on the arrival. A short or sideways swipe does nothing; an explicit Send button works too. | Verified bytes, receipt before the arrival is shown as successful, useful preview (image, multipage PDF, video with room sound). Covers B06, B07, B11, B20. |
| C3 | **Live window and send-back** (5159, 11743-11765, 8577-8591) | Someone's live window appears on the wall, or only in a colleague's own desktop window if they choose private; changes keep showing; Stop ends it everywhere. From the wall, a file goes back to one chosen phone and saves there. | Consent before pixels; private audience excludes leader and Wall; first-frame check; stop and revoke; targeted delivery with hash check. Covers B12, B13, B29, B31. |

Until C1-C3 work on real devices and the user has reviewed them, no other feature is a priority. Other features are kept, not cut; they are built around this core.

## Drift record

Twice the build drifted from this app, and the user had to call it out.

1. **Dashboard drift.** The first interface was a fixed-panel management dashboard. The user rejected it; the builder accepted the correction and recorded the spatial direction in PRODUCT.md and DESIGN.md ("write this into our direction so that we dont drift").
2. **Stack and priority drift.** The builder made the Node/Electron prototype route the main architecture without agreement, then measured progress by administration features and passing tests. When the user challenged it, the builder acknowledged the mistake (SOURCE_AUDIT.md, ARCHITECTURE.md), restored Go/Rust/C# .NET/Godot in NATIVE_ARCHITECTURE.md and added native foundations.

The second correction was only partly carried through: the running product is still the Node/Electron web room, PRD v2 led with a 36-row requirements table instead of the app, and none of the three core moments works on real devices yet. Version 3 completes the amendment by putting the conversation's app and the three moments first. Any future builder who finds themselves expanding administration, tests or packaging while C1-C3 are not working on real devices is drifting again.

## Authority and correction

**Build the whole Borderless product on its intended native foundations.** The user did not commission a dashboard or agree to replace Go/Rust/C# with Node/Electron. The existing implementation contains useful, tested room and transfer behaviour, but its existence does not change the requested product or prove native delivery.

This specification incorporates all 14,281 lines of the [original conversation](source/2026-11-03-original-conversation.md), including earlier ideas omitted by its final code listing. The archive stays byte-for-byte unchanged. [SOURCE_AUDIT.md](SOURCE_AUDIT.md) records decisions, contradictions and unsafe/non-functional snippets; [source/code-index.json](source/code-index.json) indexes every delimited code block. Original claims of completion, zero latency, encrypted databases and hardware synchronisation are not engineering evidence. The superseded PRD is retained in `history/PRD-v1.md` solely for historical comparison.

Later user direction takes precedence: the fixed-panel composition was rejected; the spatial direction was endorsed provisionally; personal desktop live windows and genuine native edge handoff stay in scope. [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) define this direction. Visual acceptance awaits the finished connected experience. Passing a test suite cannot provide that acceptance.

The project and product name is **Borderless**. Use British English. Other suggested names were not selected. Implementation proposals are labelled as such; no builder may silently narrow scope or substitute another stack. Changes to the product promise require a written decision identifying affected requirements and the user's agreement.

## The product we are making

Borderless turns personal devices and a room's shared display into a connected working space. People add their work without displacing the person already presenting. A designer's live application, a colleague's spreadsheet, a phone photograph, a note and shared ink coexist as independently movable content. Tools appear when needed and leave the work visible when dismissed.

It is one product with three connected roles:

| Surface | Purpose | Authority |
| --- | --- | --- |
| Wall | Display actual content across a TV, projector, interactive board or panoramic installation. | Display-only unless an authenticated operator explicitly takes control. |
| Portal | Join, send/flick, point, draw, answer, retrieve and manage one's contributions. Native desktop integration extends this experience. | Participant with explicit per-action grants. |
| Console | Lead the same room: arrange work, approve requests, run quizzes, manage participants and finish a session. | Leader; controls float above the workspace or appear on a tablet. |

A personal receiving window is another view of an authorised live source. Its placement is local; moving it must not move the shared Wall's copy.

### Three distinct cross-device experiences

| Experience | What crosses | What remains on the source | Required proof |
| --- | --- | --- | --- |
| Send / flick a file | Verified bytes and spatial arrival metadata. | Original file. | Exact bytes arrive as useful content; cancellation/failure cannot look successful. |
| Patch in a live screen | Consented live pixels and optionally audio. | Application, files and execution. | Changes keep appearing in a movable Wall/personal window; acceptance, stop and revoke work. |
| Extend / move over an edge | A real OS window moves into an OS-recognised extended display; its frames are transmitted. | The process still executes on the source computer. | Monitor exists in OS settings; ordinary application moves into it; Wall renders it live; input/windows return safely. |

Live viewing does not imply remote input. Cross-device keyboard/mouse control needs a separate revocable lease. Window handoff does not migrate a process or application licence. A cursor effect, screen-share tile or file upload cannot satisfy display extension.

## Intended use and outcomes

- **Meeting:** a presentation stays visible while a colleague flicks a supporting PDF, another shares a live spreadsheet and the leader compares them, then sends the result to a named participant.
- **Creative jam:** Mac and Windows users contribute concurrently; live code/design/music applications sit beside files and notes; a collaborator accepts a live window beside their own desktop work; room audio plays without duplicate echo.
- **Classroom:** students join by local invitation, contribute work, request drawing permission and answer a quiz. The teacher compares submissions, revokes access immediately and reveals results without exposing answers prematurely.
- **Operational room:** calibrated panoramic displays, identifiable contributions, audit, storage lifecycle, recovery and optional HA are commissioned against actual hardware and policy.

The central experience comes first in execution order. Classroom and operational scope is retained, not removed to make a prototype appear complete.

## Spatial and visual contract

1. Shared content fills the workspace. No permanent sidebar, panel grid or management band consumes the main canvas. Compact floating room actions and a tool dock are allowed.
2. Files, notes and live screens share move/resize/raise/focus/restore behaviour, readable ownership, predictable stacking and unobtrusive controls. A file-type placeholder is not a document preview.
3. People, Room, Settings, Activity, transfers and classroom tools open as movable, resizable, dismissible utilities. Closing preserves work and layout; reopening stays obvious.
4. Destination is visible before sending. Seat/edge mapping links departure to arrival. Motion ends in actual content; confirmed arrival follows acknowledgement, not an animation timer.
5. Support the explicitly requested clean, light Whiteboard look alongside Studio, Executive, After hours/Synthwave and Command/Cyber/Tactical families. Themes change the environment consistently without changing permissions. Exact palette, typography and branding still need review; aesthetic suggestions were not final art direction.
6. Retain optional ripple, liquid/metaball pull, particle/holographic dissolution and restrained kinetic feedback. Effects are bounded, interruptible, frame-rate independent and disabled by reduced motion. Quiet operation remains fully functional.
7. World coordinates support pan/zoom, selection, overview and off-screen recovery. Viewport coordinates, physical pixels and personal window bounds are distinct. Today's bounded normalised canvas is an implementation limit, not the final product definition.
8. Keyboard, touch and pointer users can complete every flow. Send substitutes for flick; menus substitute for gestures; utilities stay reachable at zoom/small sizes. Assistive technology gets labels, progress, focus restoration and errors. Colour is never the only ownership/status cue.

## Requirements and acceptance contracts

Existing B identifiers remain traceable to historical tests. New identifiers expand previously compressed native/operational scope. “Required” describes the target; implementation status belongs in [CAPABILITIES.md](CAPABILITIES.md).

| ID | Requirement | Acceptance contract |
| --- | --- | --- |
| B01 | Whole conversation preserved | Verify exact archive hash and code index. Every significant idea maps to a requirement/work package, including rejected alternatives and corrections. |
| B02 | One authoritative room | All surfaces/agents share hub-issued identity, ownership, revision and permissions. No parallel Node/Go writers or independent native room model. |
| B03 | Room lifecycle | Create, return, rename, pause, resume, end and restore durable work. Ended-room join fails clearly; lost leader login has a documented recovery path. |
| B04 | Join/discovery | QR, link, readable code and opt-in local discovery; manual join if multicast fails. Trusted reachable host; no mandatory cloud account for a local room. |
| B05 | Roles/pairing | Participant code cannot grant leader rights. Wall pairing is one-use/display-only. Rotation, expiry, logout and eviction invalidate HTTP/socket/media access. |
| B06 | Real files | Bounded byte transfer, independent type validation, hash, storage, commit, receipt and preview/download. Duplicate names do not overwrite assets; retries do not duplicate commits. |
| B07 | Mobile flick | Stage selected content, choose destination, show trajectory, cancel short/sideways/multi-touch/interrupted gestures, send once, show pending/progress/receipt and preserve failed selections. Physical iPhone/Android tests and explicit Send required. |
| B08 | Spatial layout | Seat/edge mapping, movement, resize, stacking, grid and focus/restore. Reject stale updates without destroying media/drafts. |
| B09 | Ownership | Server-issued identities; owner-labelled contributions; only owner/leader or explicit delegate alters shared work. Client colours/IDs never confer authority. |
| B10 | Notes/code | Edit inert text/code; preserve drafts through reconnect; escape untrusted content. Never execute uploaded scripts. |
| B11 | Useful previews | Images, multipage PDF, text, audio/video have appropriate viewers. Office has honest download/open until a licensed preview adapter exists. Unsupported formats retain the original safely. |
| B12 | Live sharing | OS-selected source, independent concurrent streams, first-frame readiness, explicit stop/retry/revoke and no silent recapture. Negotiate and measure codecs/audio. |
| B13 | Reverse delivery | Only named authorised recipient sees/accepts/downloads the offered asset; bytes verify. Edited returns create a linked immutable version; renaming alone is not editing. |
| B14 | Pointer/motion | Independent labelled reticles; touch baseline; opt-in relative gyro, calibration, yaw wrap and cancellation. Stale input expires; tilt is not absolute room location. |
| B15 | Whiteboard | Authorised persistent strokes, own undo, clear/export/reconnect and bounded points. Previews are ephemeral; committed ink is durable and shared across native/browser renderers. |
| B16 | Hand raising | Deduplicated pending request, approve/deny, scoped expiring grant, immediate revoke. Server checks previews and commits; hiding tools is not enforcement. |
| B17 | Quiz | Server owns answer key, correctness and deduplication. One answer per active identity; receipt, close/reveal/dismiss and late-join/reconnect phases; no early key exposure. |
| B18 | Governance | Arrange, pause, evict, clear, purge, end; distinct consequences, destructive confirmation, server enforcement and audit. Leader status does not silently grant private capture/input. |
| B19 | Multiple aesthetics | Coherent theme families including clean Whiteboard, consistent tokens and actual-size contrast. Preserve playback/focus/geometry during changes. |
| B20 | Arrival effects | GPU feedback follows truthful transfer state, respects reduced motion and degrades gracefully; simultaneous arrivals stay legible. |
| B21 | State/audit | Transactional mutations, receipts and audit; asset integrity; searchable/exportable history. Hash chain is not host-admin immutability. Never log secrets or every video/pointer frame. |
| B22 | Transport/storage | Trusted TLS/WSS, room isolation, bounded input, browser CSRF/origin controls, authenticated encrypted assets, OS-protected keys and explicit metadata encryption policy. No accept-all certificate callbacks. |
| B23 | Recovery | Reconnect refreshes authority; crashes reconcile assets; verified backup/restore; capture/input grants fail safely. No hidden capture or stranded input on loss. |
| B24 | Native integration | OS consent/source selection, displays, safe file opening, menu/tray, hotplug and lifecycle. Native-open requires gesture, local confirmation, verified asset and allowlisted data type; no remote path/shell command. |
| B25 | Extended display | Real monitor enumeration/mode setting/frame acquisition/encode/reception/return on each claimed OS. Separate API/driver, signing and machine gates. |
| B26 | Panoramic Wall | Mixed DPI, rotation, negative coordinates, bezel compensation, per-head rendering and touch mapping. Hotplug preserves reachable work. Hardware frame lock is independently measured. |
| B27 | Installation/updates | Signed/notarised packages, standard-user runtime, least-privilege driver install; verified signed update, operator approval, staging, safe switch and rollback. |
| B28 | Managed operations | Retention, school/enterprise identity, hardware-backed login, HA and localisation have explicit designs and release gates. Optional deployment capabilities remain in scope. |
| B29 | Personal live windows | Owner offers; recipient accepts before pixels. Independent native placement. Close, Stop receiving, revoke and Stop sharing differ. No grants survive a new capture. |
| B30 | Edge/input handoff | Calibrated adjacency/deliberate activation; scoped control lease; Escape/loss release all pressed keys/buttons and restore local control. No unsolicited interception. |
| B31 | Room audio | One selected output per source, consent/mute/volume, no duplicate echo, common video/audio clock and lifecycle. Test seek, device change and reconnect. |
| B32 | Infinite space | Versioned logical world, pan/zoom/overview, reveal/fit and bounded rendering. Deterministic migration of current normalised coordinates; no lost work. |
| B33 | Native interoperability | Versioned wire contracts, bounded FFI/IPC, OS adapters, capability negotiation and clear unsupported states. Shared fixtures across implementations. |
| B34 | Editing/version return | Immutable original; native opening never auto-uploads private changes. User explicitly returns an edited revision; parent/new hashes retained. |
| B35 | Commissioning | Tested GPU/displays/cables/network/DPI/rotation/codecs, latency/load/scanout/recovery report. Installation-specific evidence supports claims. |
| B36 | Accessibility/privacy | Whole-flow keyboard/assistive-tech tests, gesture alternatives, readable distant content, consent/stop and minimum data/retention policy before managed rollout. |
| B37 | Private live audience | A live window can be shared to the room or privately to chosen people. Private shares never reach the leader or Wall unless the owner adds them. Leader status grants no access to private shares (source 8577-8591; F03). |
| B38 | Classroom activities | Besides multiple-choice quizzes: pointer voting, where students aim their phones at an option on the wall, and drag-into-column sorting. Server owns answers and scoring as in B17 (source 11279-11281). |
| B39 | Arrival effect language | Desktop edge crossings use the liquid pull; phone throws use the particle vortex; arrivals carry the sender's colour as a secondary cue. Kinetic ripple may nudge nearby windows visually but never changes their stored positions (source 2405, 4213, 7641-7649). |
| B40 | Signed contributions | Optional per-installation mode where a hardware key or phone biometric signs each upload, separate from login (B28). Unsigned uploads are refused when the mode is on (source 7165). |
| B41 | Room-wide choices | Recorded decisions: themes are a leader choice, not any participant's (departure from source 10653, 11801, made for classroom control); the Console works on the full canvas, with an optional mini-map for tablets driving large Walls (source 13065, 13185); NDI is an optional installation integration, not the default transport (source 141, 435); BLE seat detection is optional per installation with manual correction (source 8657). |
| B42 | Links and web pages | A web link found on a phone or laptop can be sent to the Wall like a file: from the phone app's share sheet in any browser or app (pick Borderless, then flick or tap Send), by pasting into the Portal, or by dragging the link to the laptop edge. The Wall shows the page itself as a live, scrollable window in a sandboxed web view with no stored logins, no cookies shared with other windows, and no downloads or pop-ups; a readable preview card (title, image, site) appears first and stays if the page refuses to load. Only http(s) links; the leader can switch links off or limit them to chosen sites. Owner, move, resize, send-back and audit work as for files. (Added 3 November 2026 at the user's request.) |
| B43 | Source patching | A gallery of every live source in the room (laptop and PC screens, phones, cameras, capture cards) on the leader's Console, each as a live thumbnail. The leader picks a source and cuts it onto a chosen panel, region or the whole Wall, swaps or replaces sources, and saves layouts as presets, like a broadcast or control-room video router. A person's screen appears in the gallery only after they choose to make it available, and they can withdraw at any time; private shares (B37) never appear. Every cut is audited. Cameras and capture cards join through the same agent or as standard network video sources. (Added 3 November 2026 at the user's request.) |
| B44 | Direct screen links | Every Wall, panel and live source can have its own link and QR code. **Send-to link:** opening it on any phone or laptop drops files, links or notes straight onto that screen or panel, after the same join and permission checks. **Watch link:** the leader can share a view-only link to the whole Wall, one panel or one source, so someone not in the room can watch it live in a browser. Watch links expire, can need the leader's approval or a code, can be revoked instantly, show a visible "being watched" indicator in the room, never include private shares (B37), and are audited. Inside the room network they work with no internet; outside it they need an explicitly configured relay, which is off by default. (Added 3 November 2026 at the user's request.) |
| B45 | Whiteboard | A full shared whiteboard, built by Borderless (not on tldraw, whose licence needs payment for commercial use): an endless board with pan and zoom, sticky notes, pens and highlighters, shapes, arrows and connectors, text, frames to group work, and images, files and live windows placed on the board. Everyone in the room can use it at once from a laptop, phone or touch wall, with named cursors. It sits beside or behind other Wall content, is saved with the room, can be locked or cleared by the leader (classroom control, B16), supports undo per person, and exports as an image or PDF. Ink is built on perfect-freehand (MIT); Excalidraw (MIT) is a behaviour reference. Extends B15. (Added 3 November 2026 at the user's request.) |
| B46 | Smart layout | The Wall can arrange itself so everything stays readable from across the room. As content arrives it chooses a layout from what is there: one window large, two side by side, a lead window with the rest stacked beside it, or a grid. The lead is the live window, the presenter's or the leader's choice, never chosen by colour or position alone. It respects aspect ratios (tall documents, wide sheets, 16:9 screens), keeps minimum readable text size, avoids splitting a window across physical panel bezels, and never covers existing work. Modes: Auto, Side by side, Stack (each person's windows as a deck; tap to fan out) and Focus. Windows someone moves by hand stay pinned until released. Changes animate smoothly and are undoable; the leader can switch Auto off. Works per panel on multi-panel walls. (Added 3 November 2026 at the user's request.) |

## Complete flows

### F01 — Start, pair and join (B02–05, B22–24)

Leader launches the host, chooses room mode/name and establishes credentials. Selects a Wall display or issues a one-use pairing invitation. Participants scan/join, confirm room/name and correct their seat. Hub assigns identity and returns an actor-filtered snapshot; Connected requires a live handshake and current state.

Handle invalid/rotated code, unknown host, TLS trust, guest-network isolation, room capacity, ended room, expired pairing and lost leader login separately. Joining does not grant capture, arbitrary files, sensors or remote input. Ask OS permissions at the action that needs them.

### F02 — Select, flick and land (B06–11, B20)

Stage → destination/seat → drag preview → cancel/release → upload/verify → authoritative receipt → arrival → usable content. Selection is not a send. Cancellation, backgrounding, insufficient movement and competing touches restore the selection. Pending work survives ordinary updates. Failed/uncertain uploads offer inspect/retry without blind duplicate sends. Recheck permissions at commit. Concurrent contributions do not replace the presentation.

Wrong type, size, quota, full disk, corruption and revoked access show honest failure without a phantom item. The Wall renders useful content, clear origin and meaningful geometry; decorative timing never invents delivery.

### F03 — Live source and personal patch (B12, B29, B31)

Owner chooses source through the OS picker, destination and audio. Starting lasts until complete frames arrive; connected transport with no frames is a capture error. Source always retains visible stop. Room-share and personal/private audiences are distinct; leaders cannot secretly add personal viewers.

Owner selects a member; recipient sees source/owner and accepts/declines. Pending offer expires after ten minutes. Acceptance is capture-scoped, not permanent trust. Personal window movement does not alter the Wall. Close hides that window; Stop receiving removes that viewer; revoke clears that viewer; Stop sharing ends all. New capture requires new grants.

Test source end/minimise/resize, stale frames, permission denial/withdrawal, sleep/wake, reconnect, receiver close and late signalling. Refresh authority before renegotiation. A socket ping is not decoded-media evidence. Personal views default muted; audio plays only at selected destinations.

### F04 — Desktop edge extension (B25, B26, B30)

User enables a connected edge, confirms target and sees an extended monitor in OS settings. Source application continues running locally when dragged into it. Driver/capture frames feed hardware encode and authenticated transport; Wall renders them at calibrated coordinates alongside other work. Local keyboard focus still reaches the source application. Input from another device requires a separate lease.

Disarm, Escape, network/cable loss, permission withdrawal, source crash and display removal release pressed input and recover windows to a reachable physical display. Mixed scale/rotation/negative coordinates/multiple monitors and accidental edge hover are covered. File edge-drop and application display extension remain distinct operations.

Windows IddCx provides a supported driver route. macOS capture has a public route; software virtual-monitor creation remains an explicit platform decision. Do not mislabel CoreMediaIO, a private API or a hardware adapter as a universally supported software driver. Keep B25 open until proven.

### F05 — Arrange and work (B08–11, B15, B32)

Select, move, resize, raise, grid, focus and restore. Stale concurrent edits reveal conflict/current state. Capture/media nodes survive geometry changes. Pan/zoom is a viewer transform; deliberate shared placement edits change room state. Utilities keep local placement and dismiss without losing staged files, notes or quiz drafts.

### F06 — Return and edit (B13, B24, B34)

Select content → choose recipient → authorised offer → accept → verified download/save. Native-open adds local confirmation and allowlisted type. Edits remain private until explicitly returned as a new revision linked to parent/hash. Revocation blocks new downloads but cannot recall existing copies.

### F07 — Point, draw and teach (B14–16, B36)

Hold/move touch pad produces a labelled reticle; release/cancel/loss removes it. Optional gyro asks on gesture, calibrates neutral, handles yaw wrap and offers reset/touch fallback. Draw commits bounded points. Classroom actors request, wait, receive approve/deny/expiry and draw only under a current server grant. Revoke stops previews and commits. Own-stroke undo, leader clear and SVG export preserve attribution and underlying documents.

### F08 — Ask, answer and reveal (B17)

Leader drafts/validates question, options and answer key, then starts. Wall shows prompt; participants receive choices without key. Submission gets receipt; one answer per active identity. Close stops submissions and reveals configured results; dismiss restores the same work. Late join/reconnect sees current phase. Device identity is not unique student identity; managed rosters are separate.

### F09 — Govern, finish and recover (B18, B21–23, B28)

Pause stops interaction according to policy; resume never silently restarts capture. Evict invalidates actor grants/sockets. Clear removes visible contributions/ink; purge removes asset access and schedules durable byte cleanup; end closes joining and participant/display access. Explain retention before destructive actions. Audit/pending deletion survives crashes. Logical deletion does not promise physical secure erase or recall from exports/backups.

Session summary/manifest export differs from verified backup. Restore validates schema, asset hashes, encryption and audit without reviving capture/control. Managed retention defines room/upload/quiz/audit lifetimes rather than keeping everything indefinitely.

### F10 — Commission, update and fail over (B26–28, B35)

Installer checks prerequisites/permissions, selects display/audio/network and runs a real room session. Updates verify, stage, await operator approval, switch at a safe restart and roll back on failed health checks. No invisible interruption. HA requires state/asset replication, election, leases/fencing, receipt deduplication and media renegotiation. Backup/second process alone is not HA; test host loss and partition.

## Architecture and platform constraints

**Approved stack (3 November 2026, [ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md)):** native agents (Swift on Mac; Rust and a C++ IddCx driver on Windows), Rust engine and hub, LiveKit for live media, one TypeScript front end for the Wall, Console and Portal with the Wall in a Tauri shell, and a React Native phone app after the core moments. This replaces the earlier reference of Go hub + Rust system core + C#/.NET/Godot Wall described next. The recommended refinement is thin native adapters: **Swift/AppKit/ScreenCaptureKit/VideoToolbox on Mac**, **C# host plus C++ Windows.Graphics.Capture/Media Foundation/IddCx on Windows**, and portal/PipeWire adapters on Linux. All share contracts, identity and content, rather than forcing every OS API through one language. [NATIVE_ARCHITECTURE.md](NATIVE_ARCHITECTURE.md) defines ownership, alternatives and migration.

The web Portal is a production surface for joining, files and classroom controls. It cannot install drivers or capture arbitrary mobile apps. Native mobile share targets/screen capture remain in scope with version-specific APIs/consent. Local rooms need no public cloud relay; cross-network relays require explicit configuration/policy.

Use hardware codecs where supported; negotiate a tested format, colour space, size and frame rate. H.265 cannot be the only path without decoder/distribution review. Bound surface/buffer ownership across languages and avoid repeated raw-frame copies. Rust does not guarantee zero latency; .NET/Go do not inherently preclude it. Measure the whole path.

## Targets and evidence

These are proposed engineering budgets, not measured claims. Initial reproducible profile: one 4K Wall, 12 participants, four 1080p/30 sources and a 30-minute session on a documented wired/Wi-Fi LAN. Separately test a 30-student classroom with a presentation, concurrent ink and quiz. Report CPU/GPU, memory, bandwidth, packet loss, codecs, frame drops and temperatures.

| Measure | Initial target | Evidence |
| --- | --- | --- |
| Valid invitation to joined | Under 30 seconds | Physical phone cold-start with trusted TLS. |
| Note/layout commit | p95 under 300 ms | Client/hub timing under stated load. |
| Pointer/ink presentation | p95 under 100 ms | Input-to-visible, not only socket RTT. |
| Glass-to-glass live screen | p95 under 150 ms at 1080p/30; pursue 60 fps for edge work | Time-coded source and capture/encode/network/decode/render breakdown; p99/failures. |
| First-frame failure feedback | Within 10 seconds | Real OS capture, missing-frame and denial cases. |
| Input link loss | Release pressed state within 1 second; immediate local Escape | Physical keyboard/mouse, unplug and process-kill cases. |
| Topology changes | No lost/unreachable content | Mixed display/DPI/rotation/hotplug report. |
| Audio/video sync | Absolute skew under 80 ms | Actual output, mute/seek/reconnect/output changes. |

Current alpha limits (64 sessions, 60 cards, six advertisements, 25 MB/file, 512 MB/room, 500 strokes/20,000 points) are safety limits, not commercial capacity. Native budgets come from tests. Infinite space does not mean unbounded decoding/memory.

Code, rendered flows, OS/device checks and user review are separate gates. Signed builds, true display extension, frame lock, SQLCipher, WebAuthn, physical phones and HA cannot be inferred from web tests.

## Build order and completion

Build from the conversation's app, core moments first. Each step ends with the user watching it work on real devices.

1. **Real capture.** Fix the zero-frame ScreenCaptureKit result (see CLAUDE_REVIEW_RESULTS.md H1) and make capture state truthful: first-frame checks, failed state, Stop that always stops.
2. **C3 first slice: live window on the Wall.** Native Mac capture, then hardware encode, then authenticated transport, then native Godot Wall decode, in the same room, with room and private audiences (B37), stop, revoke and reconnect.
3. **C2: phone flick onto the native Wall** with real previews, sender-coloured arrival (B39) and send-back to one phone. Physical iPhone and Android.
4. **C1: window over the edge.** Windows IddCx virtual display and the user's decision on the Mac display route, then edge arming, glow, crossing effect, live render at the seat position and safe return (B25, B30).
5. **User review of C1-C3** on real devices. Adjust until the user says it is the app.
6. **Everything else, built onto the working core:** pointers and drawing, room audio, classroom tools including B38, themes, multihead and frame lock, installers and updates, audit and operations, B40 and HA.

These are increments of the shipping architecture, not throwaway prototypes. No “Borderless complete” claim while C1-C3 or other required flows remain absent. [DELIVERY.md](DELIVERY.md) is the queue, [BUILD_HANDOFF.md](BUILD_HANDOFF.md) holds evidence and [CLAUDE_REVIEW_RESULTS.md](CLAUDE_REVIEW_RESULTS.md) lists the current findings.
