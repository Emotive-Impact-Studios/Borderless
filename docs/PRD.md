# Borderless — product requirements

Version 2.0 · 3 November 2026 · Whole-product specification reconstructed from the complete conversation

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

The reference stack remains **Go hub + Rust system core + C#/.NET/Godot Wall**. The recommended refinement is thin native adapters: **Swift/AppKit/ScreenCaptureKit/VideoToolbox on Mac**, **C# host plus C++ Windows.Graphics.Capture/Media Foundation/IddCx on Windows**, and portal/PipeWire adapters on Linux. All share contracts, identity and content, rather than forcing every OS API through one language. [NATIVE_ARCHITECTURE.md](NATIVE_ARCHITECTURE.md) defines ownership, alternatives and migration.

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

1. Restore source traceability/architecture; preserve tested room/security behaviours; implement native modules with stable contracts and truthful unsupported states.
2. Prove consented native Mac capture produces frames, then transmit encoded frames to authorised native Wall/personal receivers. Validate the same contract on Windows with real OS content.
3. Deliver spatial Wall/phone flow with useful content, live windows, floating tools, ownership, return and cancellation. Review the running experience with the user.
4. Deliver Windows extended-display/edge recovery and resolve the Mac display-extension route. Commission multi-display geometry, audio and physical clients.
5. Bring retained classroom/ink/themes through the native Wall, finish accessibility, then managed retention/identity/updates and optional HA/hardware packages.

These are increments of the shipping architecture, not throwaway prototypes. No “Borderless complete” claim while required native/spatial flows remain absent. [DELIVERY.md](DELIVERY.md) is the queue, [BUILD_HANDOFF.md](BUILD_HANDOFF.md) holds evidence and [CLAUDE_REVIEW.md](CLAUDE_REVIEW.md) gives independent review entry points.
