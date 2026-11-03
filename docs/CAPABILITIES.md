# Capability and verification matrix

Updated 3 November 2026. “Implemented” means the source exists and is connected to the application. “Integration tested” means automated HTTP/WebSocket/storage tests exercised the behaviour. Neither implies a successful physical-device or native-installer test.

| Capability | Implementation | Evidence / remaining gate |
| --- | --- | --- |
| Full original conversation and product plan | Complete | Verbatim 387,055-byte source; SHA-256 checked by `npm run check`. |
| Named rooms and returning leader login | Implemented | HTTP integration tests; password and role checks pass. |
| Browser phone/laptop portal | Implemented; Chromium acceptance passed | 390px Portal rendered and exercised against native hub. Physical iPhone/Android outstanding. |
| Leader console and shared wall | Implemented; rendered acceptance passed | Native Console and read-only 4K Chromium Wall share the same room. Screenshots and core classroom flow pass. |
| Spatial workspace and local floating utilities | First shell implemented; rendered acceptance passed | Canvas fills the viewport. People/Settings/Activity/Room open as independent movable/resizable/dismissible windows with local geometry, keyboard movement and no shared-canvas reflow. Final user design acceptance remains. |
| QR invitations and codes | Implemented | Locally generated QR image returned in integration test; physical scan outstanding. |
| Separate display pairing | Implemented | One-use pairing, display role and refused writes tested; rendered Wall pairs in an independent browser context. |
| Real file uploads and downloads | Implemented | Byte round-trip, SHA-256, encrypted disk contents, corruption rejection, MIME checks and room isolation tested. |
| Drag/drop and mobile flick | Rendered source/package acceptance passed | PNG DOM drop and emulated Chromium touch flick transfer actual bytes. Physical touch and accessibility breadth remain. Explicit Send alternative included. |
| Images, PDF, inert text and Office download | Implemented in UI | Content endpoint and security headers tested; renderer/browser compatibility outstanding. |
| Audio/video playback | Implemented in UI | Verified file delivery and byte ranges; codec support and room audio output untested. |
| Notes, ownership, movement, resizing | Implemented; rendered keyboard/mouse acceptance passed | Focusable cards open/move/resize by keyboard and native mouse. Foreign movement is refused and removed cards restore canvas focus. API tests cover ownership, stale versions and bounds. |
| Shared window layout and focus/restore | Implemented; API/rendered acceptance passed | Files/notes/live streams share versioned geometry and stacking. Focus restores exact previous bounds; grid includes 60 contributions and six streams. Live video identity/playback survives layout in controlled loopback acceptance. Physical wall checks remain. |
| Live windows on a personal desktop | Not implemented | Consented recipient/destination selection and a real desktop viewing experience remain in WP22. The explanatory examples and room tiles do not deliver this. |
| Return a file to a chosen device | Implemented; rendered acceptance passed | Recipient-specific inbox and actual Chromium download pass with matching SHA-256. Physical iPhone save flow untested. |
| Multi-user touch pointers | Implemented | WebSocket identity/coordinates plus rendered Portal-to-Wall pointer start/stop pass. Physical touch and latency remain unmeasured. |
| Relative gyroscope pointer | Implemented in UI | Permission-aware relative tilt and touch fallback; real motion hardware untested. No absolute spatial localisation. |
| Persistent shared ink and SVG export | Implemented; rendered acceptance passed | Portal drawing, Wall ink, undo and actual SVG download pass alongside persistence/permission tests. Physical touch remains. |
| Classroom hand raise and approvals | Implemented; rendered acceptance passed | Portal request/leader approval unlock drawing; denial/revocation authority integration tested. |
| Quiz and aggregate results | Implemented; rendered acceptance passed | Portal submits once; native leader reveals results on Portal and Wall. Integration tests cover privacy/stale answers. Identity remains per device, not person. |
| Pause, resume, eviction, clear, purge, end | Implemented | Server authority, revocation, durable file deletion/retry and terminal session behaviour tested. |
| Local WebRTC screen sharing | Controlled spatial acceptance passed; normal local connection currently failing | Historical OS capture delivered 1450×920 frames. Current spatial source receives generated media in two Walls, preserves playback while arranging and stops/reconnects correctly using an explicit loopback fixture. Default/unicast interface-address ICE now fails locally, including on the previous dashboard checkpoint. Physical LAN/audio/codecs, OS network/privacy commissioning and ICE-failure recovery remain. |
| Five themes and three GPU entry effects | Rendered motion/colour samples passed | Five themes propagate; 87 representative settled text/control samples meet 4.5:1. Live reduced-motion changes cancel/prevent effects and suppress transitions. Ripple/particle start checks pass; full GPU/platform and WCAG audits remain. |
| Keyboard and focus | Representative rendered acceptance passed | Portal arrow/Home/End tabs, canvas open/move/resize, ownership, nested Escape focus, live Console/Portal/settings refresh and removed-card focus pass. Full keyboard/VoiceOver coverage remains. |
| Reconnect and durable room recovery | Implemented; rendered/integration tested | Fresh HTTP/socket snapshots precede Live; current identity/permissions and open draft survive reconnect. One receipt-bound retry recovers a lost acknowledgement; two lost replies stop with check-canvas guidance. Expiry/revocation stops retries and offers join/login. Restart persistence and stale stream reset also pass. |
| Local SQLite audit chain | Implemented | Room-scoped chain, append-only triggers, export and corruption detection tested. Not immutable against the host administrator. |
| Encrypted uploaded bytes | Implemented | AES-256-GCM, hash/size verification and corruption rejection tested. Key remains on this host. |
| Encrypted SQLite metadata | Not implemented | SQLite database, session roster, names and note contents are not SQLCipher-encrypted. Use disk encryption and restricted host access. |
| TLS 1.3 / WSS | Implemented, configurable | Unsafe non-loopback HTTP is refused. Trusted LAN certificate/device negotiation still needs commissioning. |
| mDNS | Opt-in implementation | Advertisement source included. Multicast discovery not exercised in this managed environment. |
| Crash/orphan reconciliation and purge retry | Implemented; SIGKILL tested | Real process kills before upload SQL commit and before purge unlink recover; incomplete content is never served. Pending cleanup remains visible/retryable. |
| Session and command-receipt retention | Implemented; tested | Startup/30-second retirement preserves active session retries, content and audit while removing expired/revoked credentials, receipts and grants/inboxes. Room/content/audit policy remains open. |
| Backup and restore | Implemented | Live database snapshot, encrypted asset verification, full restore and damaged-backup rejection tested. |
| Signed update verification | Implemented as explicit CLI | Ed25519 signature, version, platform, expiry and file hash gates tested. No background binary replacement. |
| Automated update installation / rollback | Not implemented | Requires signed platform artefacts, trusted key distribution and a staged updater. |
| Electron desktop wrapper | Spatial source/directory acceptance passed in controlled loopback lab | Sandboxed launch, isolated hub, modal responsiveness and native Quit/lock release pass; 392 ASAR entries inspected and eight changed runtime files match source. Historical DMG/hosted receipts predate this shell. Native OS/LAN/mDNS, Windows/Linux GUI and signed release remain. |
| Native application file opening | Mac cancellation/open verified | Real confirmation Cancel and explicit opening of the expected disposable text in TextEdit pass. Automated dialog-stub cancellation also checks IPC. Other OS applications/types remain. |
| Desktop global edge cue | Source included | Electron cursor/display polling and room entry event; native test outstanding. Does not move an OS cursor to the wall. |
| True OS virtual display and native window transfer | Not implemented | Windows IddCx/UMDF and supported macOS strategy require platform engineering, signing and hardware tests. |
| Multiple monitor placement / software spanning | Source included | Electron display bounds and spanning window. Mixed-DPI, hotplug and physical layout tests outstanding. |
| Genlock / synchronised scanout | Not implemented | Requires specific display controller/GPU hardware and measured commissioning. |
| Infinite spatial world | Not implemented | Alpha is a bounded normalised canvas. Requires a versioned world-coordinate model migration. |
| Hot-spare failover / active cluster | Not implemented | Single host with backup/recovery today. No automatic replicated authority or media migration. |
| Hardware-backed login, biometrics, WebAuthn | Not implemented | Needs identity policy, authenticators and challenge/replay tests. |
| Production school / enterprise release | Not certified | Requires identity/retention policy, native/device QA, accessibility, load/latency and security review. |

## Verification environment

- Node.js 24.22.1 on Apple Silicon macOS 14.5; Electron 45.2.1; Playwright 1.64.1 with installed Google Chrome.
- `npm test`: 50 passing integration/recovery/process/permission/client/spatial tests in the current local run, including geometry authority, durable focus restore and full-capacity arrangement. Original 29-test managed Linux checkpoint remains historical.
- Network tests start the hub and clients inside the same test process environment. They use actual sockets, HTTP, WebSockets and filesystem storage.
- Current spatial source: `BORDERLESS_QA_ICE_MODE=loopback npm run desktop:smoke` passes 28 checks, including utility geometry/full canvas and retained live video during shared layout. 87 representative contrast samples pass. This explicit test-only candidate fixture is same-machine media evidence, not a fix for the current default/unicast local ICE failure. Historical 26-check package/DMG and native picker/file-open receipts are separate. See [QA_MAC_2026-11-03.md](QA_MAC_2026-11-03.md).
- Physical phones, a second physical client, trusted LAN certificate/QR and hardware display commissioning remain open. Local unsigned directory and read-only mounted DMG apps pass; the image checksum verifies. Developer ID signing/notarisation and quarantined-download acceptance remain open. Hosted media uses a controlled unicast test mode whose actual outcome must be checked separately; it cannot qualify LAN/mDNS or OS prompts.
- Remote GitHub Actions conclusions are separate from local results. Check the PR before relying on hosted CI.
