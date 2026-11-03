# Capability and verification matrix

Updated 3 November 2026. “Implemented” means the source exists and is connected to the application. “Integration tested” means automated HTTP/WebSocket/storage tests exercised the behaviour. Neither implies a successful physical-device or native-installer test.

| Capability | Implementation | Evidence / remaining gate |
| --- | --- | --- |
| Full original conversation and product plan | Complete | Verbatim 387,055-byte source; SHA-256 checked by `npm run check`. |
| Named rooms and returning leader login | Implemented | HTTP integration tests; password and role checks pass. |
| Browser phone/laptop portal | Implemented | Routes and application assets served; visual and real iPhone/Android verification outstanding. |
| Leader console and shared wall | Implemented | Real shared state and role enforcement tested; rendered UI verification outstanding. |
| QR invitations and codes | Implemented | Locally generated QR image returned in integration test; physical scan outstanding. |
| Separate display pairing | Implemented | One-use pairing, display role and refused writes tested. |
| Real file uploads and downloads | Implemented | Byte round-trip, SHA-256, encrypted disk contents, corruption rejection, MIME checks and room isolation tested. |
| Drag/drop and mobile flick | Implemented in UI | Physical mouse/touch and accessibility checks outstanding. Explicit Send alternative included. |
| Images, PDF, inert text and Office download | Implemented in UI | Content endpoint and security headers tested; renderer/browser compatibility outstanding. |
| Audio/video playback | Implemented in UI | Verified file delivery and byte ranges; codec support and room audio output untested. |
| Notes, ownership, movement, resizing | Implemented | Commands, ownership, stale-version refusal and bounds tested. UI gesture verification outstanding. |
| Grid and focus layout | Implemented | Server command and native coordinates; physical wall layout checks outstanding. |
| Return a file to a chosen device | Implemented | Sender/leader checks, recipient-specific inbox and acceptance tested. iPhone save flow untested. |
| Multi-user touch pointers | Implemented | WebSocket identity and coordinate validation tested. End-to-end pointer latency unmeasured. |
| Relative gyroscope pointer | Implemented in UI | Permission-aware relative tilt and touch fallback; real motion hardware untested. No absolute spatial localisation. |
| Persistent shared ink and SVG export | Implemented | Server-side approval, persistence, undo/clear commands tested; actual drawing gesture and export rendering untested. |
| Classroom hand raise and approvals | Implemented | Deduplication, approval, denial authority and revocation tested. |
| Quiz and aggregate results | Implemented | Correct-answer privacy, single submission, stale quiz refusal, closed results tested. Identity is per device/session, not per human. |
| Pause, resume, eviction, clear, purge, end | Implemented | Server authority, revocation, durable file deletion/retry and terminal session behaviour tested. |
| Local WebRTC screen sharing | Connected browser implementation | Targeted signalling and role checks tested. Actual media capture, ICE connectivity, codecs and audio need two physical clients. |
| Five themes and three GPU entry effects | Implemented in UI | Theme commands and source syntax checked. Rendered visual, contrast and reduced-motion checks outstanding. |
| Reconnect and durable room recovery | Implemented | Restart persistence, surviving credentials/files/ink and stale stream reset tested. Browser reconnect UX unverified. |
| Local SQLite audit chain | Implemented | Room-scoped chain, append-only triggers, export and corruption detection tested. Not immutable against the host administrator. |
| Encrypted uploaded bytes | Implemented | AES-256-GCM, hash/size verification and corruption rejection tested. Key remains on this host. |
| Encrypted SQLite metadata | Not implemented | SQLite database, session roster, names and note contents are not SQLCipher-encrypted. Use disk encryption and restricted host access. |
| TLS 1.3 / WSS | Implemented, configurable | Unsafe non-loopback HTTP is refused. Trusted LAN certificate/device negotiation still needs commissioning. |
| mDNS | Opt-in implementation | Advertisement source included. Multicast discovery not exercised in this managed environment. |
| Crash/orphan reconciliation and purge retry | Implemented | Abandoned uploads and failed deletion fault tests pass; pending file cleanup is visible and retryable. |
| Backup and restore | Implemented | Live database snapshot, encrypted asset verification, full restore and damaged-backup rejection tested. |
| Signed update verification | Implemented as explicit CLI | Ed25519 signature, version, platform, expiry and file hash gates tested. No background binary replacement. |
| Automated update installation / rollback | Not implemented | Requires signed platform artefacts, trusted key distribution and a staged updater. |
| Electron desktop wrapper | Source included | Syntax checked; Linux unsigned directory packaging and embedded Electron/SQLite/HTTP engine checks pass. GUI launch, capture and macOS/Windows packaging still need their native runners. |
| Native application file opening | Source included | Origin checks, hash verification, allowlist and confirmation. Actual OS application launch untested. |
| Desktop global edge cue | Source included | Electron cursor/display polling and room entry event; native test outstanding. Does not move an OS cursor to the wall. |
| True OS virtual display and native window transfer | Not implemented | Windows IddCx/UMDF and supported macOS strategy require platform engineering, signing and hardware tests. |
| Multiple monitor placement / software spanning | Source included | Electron display bounds and spanning window. Mixed-DPI, hotplug and physical layout tests outstanding. |
| Genlock / synchronised scanout | Not implemented | Requires specific display controller/GPU hardware and measured commissioning. |
| Infinite spatial world | Not implemented | Alpha is a bounded normalised canvas. Requires a versioned world-coordinate model migration. |
| Hot-spare failover / active cluster | Not implemented | Single host with backup/recovery today. No automatic replicated authority or media migration. |
| Hardware-backed login, biometrics, WebAuthn | Not implemented | Needs identity policy, authenticators and challenge/replay tests. |
| Production school / enterprise release | Not certified | Requires identity/retention policy, native/device QA, accessibility, load/latency and security review. |

## Verification environment

- Node.js 24.22.1 on managed Linux.
- `npm test`: 29 passing integration/recovery tests in the final local verification run.
- Network tests start the hub and clients inside the same test process environment. They use actual sockets, HTTP, WebSockets and filesystem storage.
- A browser test was attempted through the connected Chrome browser. It received `ERR_CONNECTION_REFUSED` because that browser cannot reach this isolated build process. No screenshot, successful rendered UI run, physical phone test, captured WebRTC media session or native executable launch is claimed.
- Remote GitHub Actions conclusions are separate from local results. Check the PR before relying on hosted CI.
