# Desktop wrapper and packaging

## Run source

Install root dependencies with `npm ci`, then `npm run desktop:install` and `npm run desktop`. The desktop tooling lockfile pins Electron 45.2.1. The wrapper loads the same local hub and application, not a separate demo.

The wrapper runs its embedded hub from `<Electron userData>/hub`. Optional `--hub=https://...` connects to an existing trusted hub. Remote HTTP is refused; local loopback HTTP remains available for development. The app does not load arbitrary external content into its privileged window or ignore certificate failures.

The hub runs in an isolated Electron utility process so native capture and file-confirmation dialogs cannot stall other room clients. Graceful quit closes the hub and removes its process lock. Starting Borderless twice reuses its existing desktop instance. `--user-data-dir=<absolute path>` selects a separate desktop profile for disposable QA; do not point two profiles at the same hub data.

Chromium may request local-network or loopback access for WebRTC. Borderless asks for explicit consent from the trusted hub's main frame and remembers approval for the current desktop session. Cancel denies the connection; untrusted origins/subframes and unrelated capabilities remain refused. macOS may separately request Local Network access, described by the package's usage string. Manage an OS refusal through System Settings → Privacy & Security → Local Network. Certificate validation remains enabled.

Room menu includes display placement, a software wall spanning all display bounds and opt-in global desktop edge cues. Edge cues observe the global cursor near a display border and send an entry cue. They do not create a virtual monitor, capture or inject global input, move native application windows or implement seamless remote KVM.

The screen picker requires consent. Native opening verifies room ownership/leader access, checks the downloaded file hash and asks the operator before launching its default application. It never runs an uploaded executable or constructs a shell command from a filename. Temporary native-open files are deleted on graceful exit; crash leftovers in the OS temp directory require normal OS retention policy.

## Build an installer

```sh
npm ci
npm run desktop:install
npm --prefix desktop run package
```

`desktop/build.mjs` uses locked `electron-builder@26.18.0` with `desktop/electron-builder.json`. Outputs go to `release/`. The manual GitHub Actions packaging workflow builds on the corresponding native runners and retains build artefacts for review. It does not publish releases.

| Platform | Configured target | Release gates |
| --- | --- | --- |
| macOS | DMG | Developer ID signing, notarisation, validated entitlements, capture permission, launch and first-run testing. |
| Windows | NSIS installer | Authenticode signing, SmartScreen assessment, standard-user launch, firewall and display/capture testing. |
| Linux | AppImage / deb | Distribution compatibility, sandbox support, X11/Wayland and PipeWire capture, package installation testing. |

Do not label an unsigned build as a signed release. No signing keys or paid vendor accounts are created by these scripts. Source and unsigned packaged applications have passed native/browser acceptance on an Apple Silicon Mac. The initial `ENOSPC` directory build was retried successfully after space recovered, using the installed Electron distribution. No DMG, Developer ID signing or notarisation is claimed. See [the Mac QA record](QA_MAC_2026-11-03.md) and current CI for the separate hosted gate.

## Repeatable desktop acceptance

```sh
npm run desktop:smoke
# After a Mac directory build, inspect its archive and test the packaged executable:
node desktop/verify-package.mjs release/mac-arm64/Borderless.app/Contents/Resources/app.asar
npm --prefix desktop run smoke -- "$PWD/release/mac-arm64/Borderless.app/Contents/MacOS/Borderless"
# Reuse the installed Electron runtime when building locally:
CSC_IDENTITY_AUTO_DISCOVERY=false npm --prefix desktop run package -- --mac --arm64 --dir --publish never --config.electronDist=desktop/node_modules/electron/dist
```

The smoke script uses locked Playwright 1.64.1, installed Google Chrome, a temporary desktop profile and its own ephemeral loopback port. It exercises the real Electron renderer, hub process, mobile-sized Portal, paired 4K Wall, classroom tools, transfer/download integrity and real local WebRTC transport with generated video. It checks native IPC cancellation with a dialog stub, renderer sandboxing, hub responsiveness while the native thread is blocked and graceful lock cleanup. It removes its private runtime state afterwards. Screenshots and a JSON result go under ignored `output/playwright/` (or `output/playwright-packaged/`). Generated video and phone emulation are distinct from OS capture consent and physical-device evidence.

The disposable native/browser test approves room-network consent only for its own hub origin. OS Local Network permission is separate. The Mac icon artwork is generated from the existing `public/assets/icon.svg`; regenerate the tracked ICNS/PNG source assets with `npm --prefix desktop run icon` on macOS (Google Chrome, `sips` and `iconutil` required). No downloaded artwork is used.

Hosted Mac acceptance sets `BORDERLESS_QA_ICE_MODE=unicast` only in the smoke script. The temporary Electron/Chrome processes then expose host ICE candidates instead of mDNS names for the same-machine media check. This does not change the shipped app or OS privacy settings. Default local smoke retains Chromium's normal behaviour. Hosted success cannot qualify mDNS, OS Local Network consent or physical LAN connectivity; those remain G3/native commissioning gates.

The Mac CI job runs source acceptance, builds an unsigned directory package, inspects its ASAR and runs the same acceptance against the packaged executable. Its outcome must be read from Actions after push; configuration alone is not a passing result. Windows/Linux native acceptance, Developer ID/notarisation and hardware hotplug remain separate gates.

## Native QA checklist

1. Start the wrapper on the target OS, create a room and pair an external browser wall.
2. Confirm consented screen/window selection and capture stop. Declining permission must leave the app usable.
3. Share to two wall/leader tabs, including tabs using the same device cookie. Confirm connection-specific SDP routing and independent media lifetimes.
4. Send a benign file, verify its SHA-256, confirm native opening and cancel it. An untrusted origin/subframe must fail IPC checks.
5. Exercise Room menu display placement/spanning on mixed-DPI displays, then hotplug, sleep and resume.
6. Enable edge cues; cross each display edge. Confirm the wall cue while making no claim that a native window has transferred.
7. Quit normally, restart, inspect the persisted room and verify temp-file cleanup. Test the documented crash recovery process.
8. Inspect CSP, renderer sandbox and certificate failure handling in the packaged app.

## Update boundary

`npm run release:verify -- <manifest> <package> <trusted-ed25519-public-key.pem> [installed-version]` verifies a staged package. The manifest signs the canonical JSON fields `version`, `platform`, `sha256`, `bytes` and `expires`. Its `signature` is base64 Ed25519. Trusted key enrolment, package installation, platform signature validation, staged apply and rollback are outstanding work packages. There is no silent arbitrary binary download-and-replace loop.
