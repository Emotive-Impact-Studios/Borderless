# Borderless build handoff

## Start here

Read README, PRD, CAPABILITIES, ARCHITECTURE and DELIVERY. The original conversation is preserved in `docs/source/` and checked against SHA-256. The repository began with only a README at main commit `7b773ca855f0438bdd6e5f08d4e71b556037fd50`.

## What now exists

A working Node 24 local-hub application with three browser views: shared Wall, participant Portal and leader Console. It includes room sessions and roles, invitations/pairing, real encrypted file transfer, notes and ownership, movement/resizing/layout commands, targeted file returns, touch/motion pointer source, shared ink, classroom hand raising, quizzes, live screen-capture/WebRTC source, governance, five themes, arrival shaders, SQLite audit, export, backup/restore and signed-package verification.

The Electron source adds native capture selection, display placement/spanning, explicit local file opening and global edge cues. Its hub runs in an isolated utility process so macOS dialogs cannot suspend everyone else's room connection. Inactive credentials/receipts have bounded lifetimes with process-crash tests. Reconnect now refreshes authority before Live, retries one lost acknowledgement under the original receipt/identity and preserves open drafts. Keyboard canvas/tab controls, focus restoration, live reduced motion and representative theme contrast pass rendered acceptance. No native signed installer, virtual display driver, physical frame lock, active failover or enterprise identity is claimed.

## Local checks at this checkpoint

- Local project: `/Users/augustusedem/Borderless`, branch `feat/borderless-platform`, containing draft PR #1. No pre-existing local files were overwritten. The clone began at `3ee217e3109c3cb0eb595bfa2ae53743dd433776`.
- Apple Silicon Mac, macOS 14.5 and Xcode 16.2. Node 24.22.1 installed with Volta and pinned in package.json. Root and desktop dependencies installed; Electron 45.2.1 and Playwright 1.64.1.
- 47 tests passed in `npm run verify`, including three desktop lifecycle tests, three trusted network-consent tests, three retention/expiry tests, two actual SIGKILL recovery tests and seven client/socket readiness/retry/identity/peer-cleanup tests. Syntax/manifests and portable source build also passed.
- Tests exercise real socket traffic, bytes on disk, AES-GCM integrity, per-room isolation, authorisation, CSRF, item versions, classroom permission, quiz privacy, targeted signalling, revocation, restart, backup/restore, release verification and crash boundaries.
- Original conversation checksum matches `4a22132962e087c51190bd4366baed686a2b63eac4afac76261198ecb983e5e1`.
- `npm run desktop:smoke` passes 25 real Electron/Chrome checks: sandboxed launch, a responsive isolated hub, 390px Portal/4K Wall, notes/files/drop/flick, keyboard and mouse movement/resizing, ownership, tab keys, nested/remote-update focus, classroom drawing/quiz/return, lost acknowledgement, draft/identity/revoked-permission reconnect, explicit retry/join recovery, live reduced motion, five themes, zoom/pause and generated video to two cookie-sharing Wall tabs. Receiver reconnect restores media and retires departed peers; owner loss ends capture until an explicit new share. All 87 representative settled text/control samples meet 4.5:1 (minimum 4.888:1). Graceful quit releases its lock; no unexpected renderer errors. One deliberately aborted response is separately recorded. See ignored `output/playwright/desktop-smoke.json` and the QA record for limits.
- Separate native UI testing exercised the real screen picker, cancellation and consented capture of the Borderless window. Chrome received live 1450×920 frames on the same Mac. Real native file-open Cancel and explicit opening into TextEdit passed. See [QA_MAC_2026-11-03.md](QA_MAC_2026-11-03.md) for evidence and limits.
- Local macOS directory packaging initially failed with `ENOSPC`, then succeeded after task-output cleanup and the user's space recovery. The recovery/accessibility slice has now been rebuilt using installed Electron. ASAR inspection verifies 389 entries, without runtime credentials/build tools. `release/mac-arm64/Borderless.app` and the read-only mounted `release/Borderless-0.1.0-arm64.dmg` each pass all 25 smoke checks. The current DMG's image checksum verifies; SHA-256 is `8b71ec518e01b93a97ab2e2fbda72fc9abf28303bfd28764f0f2946b9b951702`. This supersedes the earlier 15-check image. See ignored `output/playwright-directory/desktop-smoke.json` and `output/playwright-packaged/desktop-smoke.json`. Developer ID signing, notarisation and quarantined-download acceptance remain open.
- The earlier managed Linux checkpoint passed an unsigned directory build and embedded SQLite/HTTP checks. That result predates the new utility-process implementation; it is historical evidence only. Windows/Linux GUI acceptance remains open.
- `npm audit --omit=dev`: zero known production vulnerabilities. The separate desktop build-tool audit has 15 moderate transitive findings; review before release. No automatic major downgrade was applied.
- No physical iPhone/Android, second physical machine, trusted LAN QR, system-audio, mDNS, hotplug or frame-lock evidence is claimed.
- Last verified hosted head before this continuation: `4d53cbc9511dd1b83fe8fd60b81b044142318d28`, with [push run 41600542514](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41600542514) and [PR run 41600548738](https://github.com/Emotive-Impact-Studios/Borderless/actions/runs/41600548738) green. Those runs cover the earlier 40-test/15-check checkpoint, not the new recovery/accessibility slice. Read the exact newly pushed head's Actions result before claiming current CI. CI uses disposable unicast host candidates; production/default local QA retain normal Chromium privacy/discovery. Controlled hosted media does not qualify mDNS, OS Local Network prompts or physical LAN connectivity.
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
2. Continue G2 with VoiceOver/full keyboard and document/media preview breadth. Representative keyboard/focus, live reduced motion, settled colour samples, draft/authority reconnect and explicit recovery now pass 25 source/package/DMG checks. This does not certify WCAG or physical touch. ICE-failure recovery still needs work beyond socket reconnect.
3. Complete G3 with a physical iPhone/Android and second physical client over trusted LAN HTTPS, including QR trust/join and real screen/audio delivery.
4. Complete G4 on Windows/Linux and actual Mac display placement, hotplug/sleep, edge cues and OS privacy refusal. Local file-open cancellation/opening and source capture have passed on Mac.
5. WP09 next: room/content/audit retention policy and broader crash/load/backup drills. Session/receipt retention and the upload/purge SIGKILL boundaries are implemented and tested; they do not constitute physical erasure.
6. Continue WP10–14 native display/window transfer and hardware commissioning, then the remaining full-scope packages. Keep these distinct from desktop edge cues and the current bounded canvas.

All remaining work has acceptance criteria in DELIVERY. The product name remains Borderless. Do not silently rename it, replace the preserved source or describe aspirational native features as complete.
