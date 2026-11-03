# Borderless build handoff

## Start here

Read PRODUCT.md and DESIGN.md first, then README, PRD, CAPABILITIES, ARCHITECTURE and DELIVERY. The original conversation is preserved in `docs/source/` and checked against SHA-256. The repository began with only a README at main commit `7b773ca855f0438bdd6e5f08d4e71b556037fd50`.

## User direction correction · 3 November 2026

The user rejected the fixed-panel dashboard as significantly missing the intended experience. After reviewing examples of live windows on the room display and on a person's Mac, plus phone flick transfer, they endorsed that as a better direction and explicitly asked that it be recorded to prevent drift. Final acceptance depends on the completed experience. PRODUCT.md and DESIGN.md are now the working authority: content fills the workspace; content and utility windows float; live screens are spatial windows; deliberate flick/edge interactions connect devices. The old technical receipts below do not establish visual/product acceptance. Immediate work is the spatial shell and live-window interaction, ahead of peripheral storage/enterprise work. Personal desktop patching and true OS window-edge handoff remain real implementation tasks, not claims satisfied by the examples.

## What now exists

A working Node 24 local-hub application with three browser views: shared Wall, participant Portal and leader Console. It includes room sessions and roles, invitations/pairing, real encrypted file transfer, notes and ownership, movement/resizing/layout commands, targeted file returns, touch/motion pointer source, shared ink, classroom hand raising, quizzes, live screen-capture/WebRTC source, governance, five themes, arrival shaders, SQLite audit, export, backup/restore and signed-package verification.

The Electron source adds native capture selection, display placement/spanning, explicit local file opening and global edge cues. Its hub runs in an isolated utility process so macOS dialogs cannot suspend everyone else's room connection. Inactive credentials/receipts have bounded lifetimes with process-crash tests. Reconnect now refreshes authority before Live, retries one lost acknowledgement under the original receipt/identity and preserves open drafts. Keyboard canvas/tab controls, focus restoration, live reduced motion and representative theme contrast pass rendered acceptance. No native signed installer, virtual display driver, physical frame lock, active failover or enterprise identity is claimed.

## Spatial workspace checkpoint

- The user-endorsed direction is implemented as the first spatial shell: full-window canvas, compact overlay controls, closed-by-default local utility windows, safe inline text previews and shared movable/resizable/focusable live windows alongside notes/files. Existing saved room content and credentials restore in the updated Mac app. This is a foundation for the direction, not final product/design acceptance.
- `npm run verify` passes 50 tests. Three new spatial tests exercise owner/leader authority, version conflicts, focus receipt idempotency, saved bounds through restart and the full 60-item/six-stream arrangement.
- The source passes 28 real Mac/Chrome smoke checks with `BORDERLESS_QA_ICE_MODE=loopback`. New checks cover full canvas bounds, independent utility movement/resizing/dismissal/reopening and live-window geometry/focus/restore while retaining the same video element and MediaStream and decoding further frames. Existing file, flick, classroom, recovery, motion and colour checks remain. The fixture rewrites host candidate addresses to loopback only inside the disposable test; it is excluded from the shipped runtime.
- Default and unicast interface-address media currently fail on this Mac despite successful offer/answer/candidate exchange. Repeating the prior dashboard checkpoint `c5b4f38` reproduces the failure. Loopback transport is controlled evidence for real same-machine media and layout only; normal network/LAN/OS privacy and ICE failure recovery remain open. Saved diagnostic reports are ignored under `output/playwright/`.
- The spatial unsigned arm64 directory build contains 392 inspected ASAR entries; all eight changed runtime files match source byte for byte. The packaged executable and read-only mounted DMG each pass all 28 checks with the explicit loopback fixture, including native Quit and hub-lock release. The new DMG verifies and contains the identical archive; SHA-256 `090789e02e1affa872f0c8c2b333e88e086a564ce3619f1e89db1f9fb87fc887`. Reports are ignored under `output/playwright-directory/` and `output/playwright-packaged/`. No signing, notarisation or release publication.
- Code checkpoint `2e99b131d44fa20112ae480fd0f590cd2010d78e` passes hosted core verification; its first Mac runs fail a utility-test assumption on the shorter hosted viewport (the window correctly clamps after growing). The test now moves upward and shortens within available space. Check the resulting head's hosted source/build/package outcomes before relying on CI; the runtime archive is unchanged by this harness correction.
- Personal-desktop patching, consented recipient selection and true native desktop-edge handoff remain incomplete. They are the next experience work, ahead of peripheral administration. Do not substitute a browser simulation or a floating room tile for these features.

## Historical recovery/accessibility checkpoint

- Local project: `/Users/augustusedem/Borderless`, branch `feat/borderless-platform`, containing draft PR #1. No pre-existing local files were overwritten. The clone began at `3ee217e3109c3cb0eb595bfa2ae53743dd433776`.
- Apple Silicon Mac, macOS 14.5 and Xcode 16.2. Node 24.22.1 installed with Volta and pinned in package.json. Root and desktop dependencies installed; Electron 45.2.1 and Playwright 1.64.1.
- 47 tests passed in `npm run verify`, including three desktop lifecycle tests, three trusted network-consent tests, three retention/expiry tests, two actual SIGKILL recovery tests and seven client/socket readiness/retry/identity/peer-cleanup tests. Syntax/manifests and portable source build also passed.
- Tests exercise real socket traffic, bytes on disk, AES-GCM integrity, per-room isolation, authorisation, CSRF, item versions, classroom permission, quiz privacy, targeted signalling, revocation, restart, backup/restore, release verification and crash boundaries.
- Original conversation checksum matches `4a22132962e087c51190bd4366baed686a2b63eac4afac76261198ecb983e5e1`.
- `npm run desktop:smoke` passes 26 real Electron/Chrome checks: sandboxed launch, a responsive isolated hub, 390px Portal/4K Wall, notes/files/drop/flick, keyboard and mouse movement/resizing, ownership, tab keys, nested/remote-update focus, classroom drawing/quiz/return, lost acknowledgement, draft/identity/revoked-permission reconnect, explicit retry/join recovery, live reduced motion, five themes, zoom/pause and generated video to two cookie-sharing Wall tabs. Receiver reconnect restores media and retires departed peers; owner loss ends capture until an explicit new share. All 87 representative settled text/control samples meet 4.5:1 (minimum 4.888:1). Graceful quit releases its lock; no unexpected renderer errors. One deliberately aborted response is separately recorded. See ignored `output/playwright/desktop-smoke.json` and the QA record for limits.
- Separate native UI testing exercised the real screen picker, cancellation and consented capture of the Borderless window. Chrome received live 1450×920 frames on the same Mac. Real native file-open Cancel and explicit opening into TextEdit passed. See [QA_MAC_2026-11-03.md](QA_MAC_2026-11-03.md) for evidence and limits.
- Local macOS directory packaging initially failed with `ENOSPC`, then succeeded after task-output cleanup and the user's space recovery. The recovery/accessibility slice has now been rebuilt using installed Electron. ASAR inspection verifies 389 entries, without runtime credentials/build tools. `release/mac-arm64/Borderless.app` and the read-only mounted `release/Borderless-0.1.0-arm64.dmg` each pass all 26 smoke checks. The current DMG's image checksum verifies; SHA-256 is `1287985aebb7a0b4166332be224c0551b5f25204d00b4e6fb156925a4488615d`. This supersedes the earlier 15-check image. See ignored `output/playwright-directory/desktop-smoke.json` and `output/playwright-packaged/desktop-smoke.json`. Developer ID signing, notarisation and quarantined-download acceptance remain open.
- The earlier managed Linux checkpoint passed an unsigned directory build and embedded SQLite/HTTP checks. That result predates the new utility-process implementation; it is historical evidence only. Windows/Linux GUI acceptance remains open.
- `npm audit --omit=dev`: zero known production vulnerabilities. The separate desktop build-tool audit has 15 moderate transitive findings; review before release. No automatic major downgrade was applied.
- No physical iPhone/Android, second physical machine, trusted LAN QR, system-audio, mDNS, hotplug or frame-lock evidence is claimed.
- Hosted code checkpoint `19f61b6b7feb60b4c452187ff898658c42ebf72d`: [push run 41605380790](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41605380790) and [PR run 41605389561](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41605389561) both pass 47-test core verification and 26-check Mac source/build/archive/package acceptance. CI exposed delayed dialog-close focus theft, which is fixed with an explicit regression. Fault injection now observes actual socket closure before blocking reconnect HTTP. Any later documentation-only head's Actions result must still be checked separately.
- CI uses disposable unicast host candidates; production/default local QA retain normal Chromium privacy/discovery. Controlled hosted media and explicit socket-close faults do not qualify mDNS, OS Local Network prompts, physical LAN or cable/Wi-Fi loss.
- The rebuilt application is left running on the restored disposable “Borderless Mac lab” room at loopback port 8443, with its saved contributions and credentials. Native dialog Escape restores its file button. All eight changed runtime files match the packaged ASAR byte for byte. Preview: ignored `output/playwright/native-packaged-preview.png`. The build artefacts are local/private; no GitHub release or merge was performed.

The final verification record can update the counts here if further tests are added. Do not infer unrecorded platform success from these checks.

## Commands

```sh
npm ci
npm run verify
npm run desktop:install
npm run desktop
# Disposable, automated native/browser acceptance (installed Google Chrome required):
npm run desktop:smoke
# Standalone hub alternative:
npm start
```

Run from a real desktop for browser/native work. For phone access, follow OPERATIONS and configure trusted HTTPS with an actual LAN URL. Use synthetic/disposable test content until the release gates are complete.

## Next priorities

1. Complete WP22: consented personal-desktop live-window patching, destination/ownership/stop interactions and the connected phone flick journey. Show the actual running experience for user review. Preserve unsent drafts and existing data.
2. Investigate normal interface-address WebRTC and ICE-failure recovery; qualify trusted HTTPS/QR, capture/audio and gestures with a physical phone and second physical client. The loopback fixture cannot satisfy G3.
3. Continue WP10–14 native display/window-edge handoff and hardware commissioning. A real OS window must cross into an extended display with safe return; room-window focus is separate.
4. Complete VoiceOver/full keyboard, preview/codec and Windows/Linux/display hotplug breadth, then signing/notarisation and quarantined installation. Keep exact-head CI and unsigned local receipts distinct from release acceptance. No merge/release has been performed.
5. Continue the remaining full-scope packages in DELIVERY after the spatial experience: room/content/audit retention, broader crash/load/backup drills, managed identity/updates and measured hardware/HA work.

All remaining work has acceptance criteria in DELIVERY. The product name remains Borderless. Do not silently rename it, replace the preserved source or describe aspirational native features as complete.
