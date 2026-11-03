# Borderless build handoff

## Start here

Read README, PRD, CAPABILITIES, ARCHITECTURE and DELIVERY. The original conversation is preserved in `docs/source/` and checked against SHA-256. The repository began with only a README at main commit `7b773ca855f0438bdd6e5f08d4e71b556037fd50`.

## What now exists

A working Node 24 local-hub application with three browser views: shared Wall, participant Portal and leader Console. It includes room sessions and roles, invitations/pairing, real encrypted file transfer, notes and ownership, movement/resizing/layout commands, targeted file returns, touch/motion pointer source, shared ink, classroom hand raising, quizzes, live screen-capture/WebRTC source, governance, five themes, arrival shaders, SQLite audit, export, backup/restore and signed-package verification.

The Electron source adds native capture selection, display placement/spanning, explicit local file opening and global edge cues. Its hub now runs in an isolated utility process so macOS dialogs cannot suspend everyone else's room connection. Inactive session credentials and command receipts have bounded lifetimes, with startup/periodic retirement and process-crash tests. No native signed installer, virtual display driver, physical frame lock, active failover or enterprise identity is claimed.

## Local checks at this checkpoint

- Local project: `/Users/augustusedem/Borderless`, branch `feat/borderless-platform`, containing draft PR #1. No pre-existing local files were overwritten. The clone began at `3ee217e3109c3cb0eb595bfa2ae53743dd433776`.
- Apple Silicon Mac, macOS 14.5 and Xcode 16.2. Node 24.22.1 installed with Volta and pinned in package.json. Root and desktop dependencies installed; Electron 45.2.1 and Playwright 1.64.1.
- 40 tests passed in `npm run verify`, including three desktop process lifecycle tests, three trusted network-consent tests, three retention/expiry tests and two actual SIGKILL recovery tests. Syntax/manifests and portable source build also passed.
- Tests exercise real socket traffic, bytes on disk, AES-GCM integrity, per-room isolation, authorisation, CSRF, item versions, classroom permission, quiz privacy, targeted signalling, revocation, restart, backup/restore, release verification and crash boundaries.
- Original conversation checksum matches `4a22132962e087c51190bd4366baed686a2b63eac4afac76261198ecb983e5e1`.
- `npm run desktop:smoke` passed real Electron/Chrome acceptance: sandboxed launch, hub responsiveness with a blocked native thread, keyboard room-mode selection, 390px Portal, paired 4K Wall, notes/files, PNG drop/preview, grid/move/resize, emulated touch flick, pointer, approved/revoked ink, undo/SVG, quiz, hash-checked return, native-open cancellation stub, all five themes, zoom/fit, pause/resume and generated WebRTC pixels to two Wall tabs sharing a cookie. Graceful quit releases its temporary hub lock. Local screenshots and JSON receipts are in ignored `output/playwright/`.
- Separate native UI testing exercised the real screen picker, cancellation and consented capture of the Borderless window. Chrome received live 1450×920 frames on the same Mac. Real native file-open Cancel and explicit opening into TextEdit passed. See [QA_MAC_2026-11-03.md](QA_MAC_2026-11-03.md) for evidence and limits.
- Local macOS directory packaging initially failed with `ENOSPC`. After task-output cleanup and the user's space recovery, the unsigned arm64 directory build succeeded using installed Electron. ASAR inspection verifies 389 entries, with the isolated hub/permission handler and no runtime credentials/build tools. `release/mac-arm64/Borderless.app` and the corrected, read-only mounted `release/Borderless-0.1.0-arm64.dmg` both passed all 15 smoke checkpoints. The DMG's image checksum verifies; SHA-256 is `448791236aeb52eca6a6081e41caf1e15004a6e8ee7cd9931bca6f44de9bc5f6`. Source-derived Borderless artwork replaces the generic Electron icon. See ignored `output/playwright-packaged/desktop-smoke.json`. Developer ID signing, notarisation and quarantined-download acceptance remain open.
- The earlier managed Linux checkpoint passed an unsigned directory build and embedded SQLite/HTTP checks. That result predates the new utility-process implementation; it is historical evidence only. Windows/Linux GUI acceptance remains open.
- `npm audit --omit=dev`: zero known production vulnerabilities. The separate desktop build-tool audit has 15 moderate transitive findings; review before release. No automatic major downgrade was applied.
- No physical iPhone/Android, second physical machine, trusted LAN QR, system-audio, mDNS, hotplug or frame-lock evidence is claimed.
- Hosted code checkpoint `cdf5fe9c084b222087aad4bd121fee3474737ed4`: [push run 41600017639](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41600017639) and [PR run 41600024211](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41600024211) are green for core verification and Mac source smoke, unsigned directory build, ASAR inspection and packaged smoke. CI uses an explicit disposable unicast-host-candidate mode; production/default local QA retain normal Chromium candidate privacy/discovery. The default unattended runner could not exchange mDNS candidates, so this controlled result does not qualify mDNS, OS Local Network prompts or physical LAN connectivity. Any later documentation-only head must be checked separately.
- The packaged application is left running on the restored disposable “Borderless Mac lab” room at loopback port 8443. It reuses the same local profile and saved contributions as source testing. Preview: ignored `output/playwright/native-packaged-preview.png`. The build artefacts are local/private; no GitHub release or merge was performed.

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

1. Keep the hosted code checkpoint and the local unsigned DMG receipts separate from Developer ID/notarisation, quarantined installation and release publication. No merge/release has been performed. Check any later head's CI before relying on it.
2. Broaden G2 accessibility: reduced motion, contrast, keyboard/focus breadth and reconnect UX. Image drop, emulated flick, move/resize, themes, zoom and drawing revocation now pass the expanded local smoke flow. Physical touch remains separate.
3. Complete G3 with a physical iPhone/Android and second physical client over trusted LAN HTTPS, including QR trust/join and real screen/audio delivery.
4. Complete G4 on Windows/Linux and actual Mac display placement, hotplug/sleep, edge cues and OS privacy refusal. Local file-open cancellation/opening and source capture have passed on Mac.
5. WP09 next: room/content/audit retention policy and broader crash/load/backup drills. Session/receipt retention and the upload/purge SIGKILL boundaries are implemented and tested; they do not constitute physical erasure.
6. Continue WP10–14 native display/window transfer and hardware commissioning, then the remaining full-scope packages. Keep these distinct from desktop edge cues and the current bounded canvas.

All remaining work has acceptance criteria in DELIVERY. The product name remains Borderless. Do not silently rename it, replace the preserved source or describe aspirational native features as complete.
