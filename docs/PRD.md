# Borderless product requirements

Version 1.0 · 3 November 2026 · Source of truth for the product vision

## Product identity

The working experience direction is recorded in [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md), following the user's 3 November review. The dashboard composition was rejected. Shared content must lead in a full workspace, with floating content/utility windows and direct cross-device interactions. The user endorsed that direction provisionally; completion still requires reviewing the actual finished experience.

The project and product are both **Borderless**, the name explicitly selected in the source conversation. RoomCanvas, FlickCanvas and other naming suggestions were not accepted product names.

Borderless is one spatial collaboration product with three interfaces: the shared Wall, the participant Portal and the leader Console. It connects people in the same physical room across Mac, Windows, Linux, iPhone, iPad and Android. The long-term promise is to make the boundaries between personal screens and a shared room display feel natural and permeable.

## The problem

Meetings, creative sessions and classrooms often make a whole room wait while one person controls a cable or a screen-share session. Participants have useful material on different devices, but adding a picture, note, code sample, spreadsheet or explanation interrupts the presenter. Teachers need contributions without giving up control of the board. A display should accept several perspectives at once, with clear ownership and predictable controls.

## Outcomes

1. A leader can start a room and put its wall on a TV or projector.
2. A participant can join from an invitation without creating an account.
3. Several participants can contribute independent files, thoughts, ink and live screens.
4. Contributions have distinct owners, colours and positions. They remain available after reconnection or restart where persistence applies.
5. The leader can govern the room, approve classroom drawing, collect answers and recover from disruption.
6. Files and room data remain on the configured local hub unless an authorised person exports or downloads them.
7. The experience looks appropriate for a studio, classroom, boardroom or operational room. Motion is expressive but optional.

## Users and contexts

| User | Needs | Main interface |
| --- | --- | --- |
| Meeting leader | Keep a presentation visible while others add supporting material; arrange and focus the wall. | Console |
| Creative collaborator | Compare work, send images or code, play a clip, share a live window, connect ideas in ink. | Portal / Canvas |
| Teacher | Lead from a tablet, approve contributions, ask a question, show anonymous aggregate results, stop disruption. | Console |
| Student / audience member | Join quickly, contribute without public accounts, request drawing permission, answer once. | Portal |
| Display operator | Pair a room display without receiving leader rights, choose full-screen and display placement. | Wall / Desktop |
| IT / room administrator | Operate certificates, backups, updates, display topology and local network deployment. | Host tooling |

## Requirements and acceptance

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| B01 | Preserve the whole supplied conversation. | Exact original bytes are in the repo with a checked SHA-256 checksum; future engineering references source line numbers. |
| B02 | One coherent product and data model. | All three interfaces use the same authoritative room, identities, ownership and revision stream. |
| B03 | Create and return to a room. | Leader creates a named room and separate leader password; returning login restores leader access without exposing that password to participants. |
| B04 | Easy invitation and local discovery. | QR invitation, readable room code and invitation link work; desktop/hub advertises a local discovery service when enabled. Browser QR remains available where multicast is blocked. |
| B05 | Distinct participant and display roles. | A join code cannot create an admin session. A paired display cannot write, draw, upload, run quizzes or issue leader commands. |
| B06 | Genuine file contribution. | Select or drag supported files, transfer bytes to the hub, verify SHA-256 and render or offer an appropriate download. Failed or rejected uploads do not create successful cards. |
| B07 | Mobile flick gesture. | A selected file can be sent by an upward gesture; an explicit Send button provides an accessible alternative. Feedback shows progress and confirmed receipt. |
| B08 | Spatial arrival and layout. | Normalised room coordinates support left/centre/right seats, movement and resizing. Leader can arrange a grid or focus an item. |
| B09 | Multi-user identity and ownership. | The server assigns identities and colours. Client claims cannot impersonate another device. Owners and leaders can change items; other participants cannot. |
| B10 | Notes and text. | Contribute and edit notes; code/text files preview as inert text. Content is escaped. |
| B11 | Images, documents and multimedia. | Images preview; PDFs open where the browser supports them; audio and video use explicit playback controls. Office files download for their native application. No automatic shell execution or unfounded conversion claim. |
| B12 | Live screen or window sharing. | Supported desktop clients choose a source with OS/browser consent; several streams appear at the wall through real WebRTC peer connections. No cloud relay is assumed. |
| B13 | Reverse file delivery. | Leader or sender selects a target device; only that device sees and accepts its inbox invitation. Download requires a user gesture on platforms that require it. |
| B14 | Touch pointer and motion input. | Each participant has an independent coloured reticle. Touch is always the baseline; motion is opt-in, permission-aware, calibrated relative tilt, not absolute room localisation. |
| B15 | Persistent multi-user whiteboard. | Ink is broadcast, saved, restored and exportable as SVG; users can undo their own last stroke. Leader can clear ink. |
| B16 | Classroom hand raising. | Drawing is locked by default for participants. Hand raising is deduplicated, the leader approves or denies, and the server checks approval for every committed stroke. Revocation takes effect immediately. |
| B17 | Live quiz. | Leader starts a question with 2–6 options, participants submit once per device, correct answer and aggregate option counts remain hidden from participants while open, and close reveals results. |
| B18 | Leader governance. | Leader can pause, resume, change themes, arrange, close contributions, evict devices, clear, purge and end. Each consequential action is enforced and audited by the hub. |
| B19 | Multiple aesthetics. | Studio, clean Whiteboard, Executive, After hours and Command themes update together. Reduced motion disables arrival effects. |
| B20 | Expressive entry effects. | Ripple, liquid and particle modes use a bounded GPU overlay; unsupported WebGL degrades to a functioning canvas. No network state depends on animation completion. |
| B21 | Persistence and audit. | Room state and metadata persist transactionally; important events form a verifiable per-room hash chain. Pointer frames and SDP are not durable event logs. |
| B22 | Secure transport and storage. | Non-loopback operation requires TLS, cookies are HttpOnly and scoped to a room, mutations require CSRF, and uploaded file bytes are authenticated ciphertext at rest. Explicitly identify metadata encryption limits. |
| B23 | Recovery. | Reconnection obtains a current snapshot; restart restores durable content and clears dead stream advertisements. A verified backup and restore recovers file bytes and the audit. |
| B24 | Desktop presence. | Native shell offers display placement, consented screen capture, explicit file-open confirmation and optional edge cues. Packaging includes OS-specific permissions and signing gates. |
| B25 | True virtual display extension. | A real OS-recognised display accepts windows, hardware capture streams its pixels, and pointer transfer has a reliable return/escape path. Requires platform driver/entitlement work and real machine tests. Edge cues do not satisfy B25. |
| B26 | Panoramic video wall. | Software placement/spanning works across a chosen display topology; frame lock, tearing and bezel compensation are measured on target hardware. Independent window VSYNC is not evidence of hardware frame lock. |
| B27 | Managed deployment and updates. | Reproducible builds, signed platform packages, verified signed manifests, rollback and an operator-controlled application boundary. Never replace an executing binary based only on a version string. |
| B28 | Advanced enterprise options. | HA, hardware-backed identity, managed retention, SQLCipher/OS key protection and physical room localisation have explicit designs, tests and release gates before being advertised. |

## Complete user flows

### Start the room

Leader opens the host, selects Studio, Meeting or Classroom, supplies a name and leader password, and creates a room. The host saves the room and issues the leader session. The leader opens Wall on a connected display or generates a one-use pairing link for a separate display. A room invitation shows QR and code. Guests scan it over the same reachable network, give a name, choose a seat and receive server-assigned identities.

Errors: unavailable host, invalid invite, ended room, expired session, device limit, wrong leader password and certificate trust failure. Each needs a clear recovery path. A browser certificate warning is not bypassed by the application.

### Contribute and collaborate

Participant chooses a file, uses Send or flicks upward, and sees progress. Hub validates the permitted type and size, writes encrypted bytes, verifies metadata, commits an owned card and broadcasts the new revision. Wall animates the arrival. People can add notes at the same time. The sender or leader moves, edits, resizes, removes or returns a card. Office files have a download path; unsupported inline media reports its browser limit.

Errors: size/type mismatch, disconnection, quota, room paused during upload, permission revoked mid-transfer, full canvas and corrupt storage. An incomplete transfer cannot be presented as delivered. Repeated command IDs do not duplicate changes.

### Present a live screen

Desktop user starts screen sharing through a supported secure browser or native shell, chooses a screen/window and retains its capture indicator and stop control. Hub registers an owned transient stream. Authorised wall/leader connections request the stream; signalling is targeted to the specific browser connection. Media travels through local-network WebRTC. A shared tab ending capture, owner disconnection, pause, purge or end removes its live advertisement and tears down tracks. The app distinguishes signalling tests from actual media/device tests.

### Point, draw and teach

Participant selects Point, touches the pad and moves an independent reticle. Optional relative motion input requires an explicit permission gesture. Draw uses local touch or mouse coordinates. Studio and meeting participants can draw while open. In Classroom they raise a hand, wait for leader approval, draw, then lose permission when revoked. Leader can undo their own work, clear ink, export the whiteboard and compare student contributions in a grid.

### Ask a question

Leader writes the question, answer choices and correct option. Participants receive the prompt. Each device submits one answer; later changes or stale question IDs are rejected. The leader sees counts and closes the question when ready. Wall and participants see aggregate results, with the correct option revealed. Device uniqueness is not person uniqueness: preventing a participant rejoining as a new device requires a later school identity integration.

### Return, govern and finish

Leader or file sender selects a device. Its inbox receives an invitation and explicit download action. Leader can pause contributions, revoke drawing or evict a device without changing everyone else's identities. Clear resets visible content while retaining files; Purge removes the room's uploads and pauses it; End revokes participant/display sessions and closes joining. Exports and verified backups serve different purposes. Metadata audit remains available to the leader after the session ends.

## Product constraints and success measures

- Browser clients cannot install virtual drivers, capture arbitrary background phone apps, open global OS windows or silently bypass iOS download restrictions.
- Capture, network latency, colour accuracy and hardware frame lock are measured targets, not promises derived from language choice.
- Local-network operation is not automatically air-gapped. The network administrator determines isolation.
- The alpha canvas is bounded and uses a shared normalised coordinate system. An infinite, pan/zoom world is a later spatial model migration; it must preserve existing exports.
- Alpha limits: 64 active device sessions, 60 visible file/note cards, 6 screen advertisements, 25 MB per file, 512 MB of uploaded file bytes per room, 500 strokes / 20,000 total points. Device and stream limits require physical load validation before commercial claims.
- Target lab measurements: join in under 30 seconds with a valid QR and trusted certificates; confirmed notes under 300 ms at p95 on a controlled LAN; pointer and ink frame delivery latency measured separately; 1080p/30 live screen with a visible capture stop path. No hardware latency acceptance has been measured here.

## Scope preservation

The complete platform is the goal. This PR is not described as completing the kernel, signed distribution, HA or physical classroom rollout. [CAPABILITIES.md](CAPABILITIES.md) records implementation and evidence. [DELIVERY.md](DELIVERY.md) retains every outstanding engineering work package so another builder can continue without losing the wider product.
