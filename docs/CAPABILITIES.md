# Capability and verification matrix

Updated 3 November 2026. “Implemented” means the source exists and is connected to the application. “Integration tested” means automated HTTP/WebSocket/storage tests exercised the behaviour. Neither implies a successful physical-device or native-installer test.

| Capability | Implementation | Evidence / remaining gate |
| --- | --- | --- |
| Full original conversation and product plan | Complete | Verbatim 387,055-byte source; SHA-256 checked by `npm run check`. |
| Named rooms and returning leader login | Implemented | HTTP integration tests; password and role checks pass. |
| Browser phone/laptop portal | Implemented; Chromium acceptance passed | 390px Portal rendered and exercised against native hub. Physical iPhone/Android outstanding. |
| Leader console and shared wall | Implemented; rendered acceptance passed | Native Console and read-only 4K Chromium Wall share the same room. Screenshots and core classroom flow pass. |
| QR invitations and codes | Implemented | Locally generated QR image returned in integration test; physical scan outstanding. |
| Separate display pairing | Implemented | One-use pairing, display role and refused writes tested; rendered Wall pairs in an independent browser context. |
| Real file uploads and downloads | Implemented | Byte round-trip, SHA-256, encrypted disk contents, corruption rejection, MIME checks and room isolation tested. |
| Drag/drop and mobile flick | Implemented in UI | Physical mouse/touch and accessibility checks outstanding. Explicit Send alternative included. |
| Images, PDF, inert text and Office download | Implemented in UI | Content endpoint and security headers tested; renderer/browser compatibility outstanding. |
| Audio/video playback | Implemented in UI | Verified file delivery and byte ranges; codec support and room audio output untested. |
| Notes, ownership, movement, resizing | Implemented | Commands, ownership, stale-version refusal and bounds tested. UI gesture verification outstanding. |
| Grid and focus layout | Implemented | Server command and native coordinates; physical wall layout checks outstanding. |
| Return a file to a chosen device | Implemented; rendered acceptance passed | Recipient-specific inbox and actual Chromium download pass with matching SHA-256. Physical iPhone save flow untested. |
| Multi-user touch pointers | Implemented | WebSocket identity/coordinates plus rendered Portal-to-Wall pointer start/stop pass. Physical touch and latency remain unmeasured. |
| Relative gyroscope pointer | Implemented in UI | Permission-aware relative tilt and touch fallback; real motion hardware untested. No absolute spatial localisation. |
| Persistent shared ink and SVG export | Implemented; rendered acceptance passed | Portal drawing, Wall ink, undo and actual SVG download pass alongside persistence/permission tests. Physical touch remains. |
| Classroom hand raise and approvals | Implemented; rendered acceptance passed | Portal request/leader approval unlock drawing; denial/revocation authority integration tested. |
| Quiz and aggregate results | Implemented; rendered acceptance passed | Portal submits once; native leader reveals results on Portal and Wall. Integration tests cover privacy/stale answers. Identity remains per device, not person. |
| Pause, resume, eviction, clear, purge, end | Implemented | Server authority, revocation, durable file deletion/retry and terminal session behaviour tested. |
| Local WebRTC screen sharing | Same-Mac capture and transport verified | Native OS-picked Borderless window delivers 1450×920 video to Chrome. Generated video reaches two Wall tabs with shared cookie; visible Stop sharing ends tracks. Two physical clients/audio/codecs remain. |
| Five themes and three GPU entry effects | Implemented in UI | Theme commands and source syntax checked. Rendered visual, contrast and reduced-motion checks outstanding. |
| Reconnect and durable room recovery | Implemented | Restart persistence, surviving credentials/files/ink and stale stream reset tested. Browser reconnect UX unverified. |
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
| Electron desktop wrapper | Mac source acceptance passed | Sandboxed launch, isolated utility hub, modal responsiveness, restart and graceful exit tested. Earlier Linux directory build predates isolation change. Local Mac packaging hit ENOSPC; current Mac CI package outcome must be checked separately. |
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
- `npm test`: 37 passing integration/recovery/process tests in the current local run. Original 29-test managed Linux checkpoint remains historical.
- Network tests start the hub and clients inside the same test process environment. They use actual sockets, HTTP, WebSockets and filesystem storage.
- `npm run desktop:smoke`: native source plus real rendered Chromium Portal/Wall acceptance passed with no renderer errors. Screenshots and result JSON are in ignored `output/playwright/`. Separate native UI acceptance verified OS capture and file opening. See [QA_MAC_2026-11-03.md](QA_MAC_2026-11-03.md).
- Physical phones, a second physical client, trusted LAN certificate/QR and hardware display commissioning remain open. Local Mac packaging failed for lack of disk space; no local DMG, signed/notarised build or packaged launch is claimed.
- Remote GitHub Actions conclusions are separate from local results. Check the PR before relying on hosted CI.
