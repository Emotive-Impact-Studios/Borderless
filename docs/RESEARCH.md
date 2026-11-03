# Technical research and dependency register

Reviewed 3 November 2026. This register distinguishes upstream references from code actually included. No third-party source repository has been silently vendored into this project.

## Official engineering references

| Source | What it supports | Decision / correction |
| --- | --- | --- |
| [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer) | Source enumeration, consented capture, system picker and platform constraints. | Use the supported source-picker path; do not assume silent capture or universal system audio. |
| [Electron screen](https://www.electronjs.org/docs/latest/api/screen) | Display bounds and cursor information after app readiness; DPI coordinate distinctions. | Use for desktop placement and optional edge cues. It does not create a virtual monitor. |
| [Electron session](https://www.electronjs.org/docs/latest/api/session) | Permission and display-media request handlers. | Enforce hub origin and explicit capture choice. No certificate override. |
| [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) | Renderer isolation, sandbox and IPC boundaries. | Narrow preload, no Node integration, same-origin navigation. |
| [Node.js 24 SQLite](https://nodejs.org/download/release/v24.8.0/docs/api/sqlite.html) | DatabaseSync, statements and online backup. | Use installed Node 24 APIs and integration tests. The latest-v24 documentation URL could not be fetched during this research; local implementation is exercised directly. |
| [Microsoft indirect display driver overview](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/indirect-display-driver-model-overview) | IddCx/UMDF adapter/monitor surfaces and remote-display support. | A real IDD is a UMDF user-mode driver; the source's generic “kernel Rust hook” does not implement one. The driver must follow supported APIs and WDK/signing requirements. |
| [Microsoft Windows driver samples, IndirectDisplay](https://github.com/microsoft/Windows-driver-samples/tree/main/video/IndirectDisplay) | Reference implementation for the Windows work package. | Reference only. Review its licence and pin a revision when acquiring. Not incorporated or claimed compiled here. |
| [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit) | Supported Mac screen/window capture APIs. | Capture is different from virtual display creation. CoreMediaIO is not a generic virtual monitor API. Native virtual display strategy remains a research gate. |
| [W3C Screen Capture](https://www.w3.org/TR/screen-capture/) | Browser getDisplayMedia consent and capture semantics. | Supported desktop browsers with user choice, secure context and visible stop; do not claim arbitrary background iPhone capture. |
| [WebRTC specification](https://www.w3.org/TR/webrtc/) | Peer media negotiation and ICE lifecycle. | Separate media from the authenticated control plane. A successful signalling test is not proof of pixel/audio delivery. |

## Corrections to the supplied draft

- Ordinary SQLite drivers do not make a database encrypted. This build encrypts uploaded file bytes; metadata remains ordinary SQLite.
- TLS encrypts the link but does not, by itself, identify every authorised participant. Room sessions, roles, CSRF and per-action checks are separate.
- A self-signed certificate is not automatically trusted. Disabling certificate verification is not a production trust strategy.
- Global mouse observation and a coloured edge animation do not create an extended monitor or move native windows between machines.
- Independent rendering loops, FIFO swapchains and software VSYNC do not guarantee hardware frame lock across separate panels.
- Screen capture and hardware encoding do not imply a universal latency number. Measure each hardware, codec and network path.
- A local IP link is not proof of an air gap. iOS web downloads require user-facing handling and cannot silently force files into arbitrary device storage.
- A SHA-256 chain is not externally immutable if the host administrator can rewrite and rehash the entire database. Keep external anchors when that property is required.
- A downloaded binary with a higher version string is not a trusted update. This build supplies an Ed25519 verifier and leaves managed installation to a staged updater work package.
- No software or hardware system should be described as unhackable.

## Runtime dependencies

| Package | Pinned version | Licence | Purpose |
| --- | --- | --- | --- |
| `ws` | 8.22.1 | MIT | Bounded WebSocket transport. |
| `qrcode` | 1.5.4 | MIT | Offline invitation QR images. |
| `bonjour-service` | 1.4.4 | MIT | Opt-in LAN service advertisement. |
| Electron | 45.2.1 | MIT with bundled component notices | Optional native shell and Chromium media/display support. |
| electron-builder | 26.18.0 | MIT | Locked native packaging tool. |

Root and desktop lockfiles record transitive dependencies. Retain upstream licence notices with distributions. The proprietary project itself is marked `UNLICENSED`; this does not change third-party licences. Run the package audit again at release time and review actual advisories rather than assuming a pinned package is permanently safe.

## Acquisition policy

When WP10–20 needs source acquisition, record the exact upstream URL, commit SHA, licence, intended module boundary, changes and reproducible build. Do not paste third-party driver examples into a shipping module and mark the capability complete. Keep vendor hardware SDK redistribution terms separate from open-source licence checks.
