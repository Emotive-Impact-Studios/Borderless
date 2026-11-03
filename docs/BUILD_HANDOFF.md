# Borderless build handoff

## Start here

Read README, PRD, CAPABILITIES, ARCHITECTURE and DELIVERY. The original conversation is preserved in `docs/source/` and checked against SHA-256. The repository began with only a README at main commit `7b773ca855f0438bdd6e5f08d4e71b556037fd50`.

## What now exists

A working Node 24 local-hub application with three browser views: shared Wall, participant Portal and leader Console. It includes room sessions and roles, invitations/pairing, real encrypted file transfer, notes and ownership, movement/resizing/layout commands, targeted file returns, touch/motion pointer source, shared ink, classroom hand raising, quizzes, live screen-capture/WebRTC source, governance, five themes, arrival shaders, SQLite audit, export, backup/restore and signed-package verification.

The optional Electron source adds native capture selection, display placement/spanning, explicit local file opening and global edge cues. Source packaging and native CI definitions are included. No native signed installer, virtual display driver, physical frame lock, active failover or enterprise identity is claimed.

## Local checks at this checkpoint

- Node 24.22.1; root dependencies installed with the committed lockfile.
- 29 HTTP/WebSocket/storage/recovery tests passed in the final local `npm run verify` run. Syntax/manifests and the portable source build also passed.
- Tests exercise real socket traffic, bytes on disk, AES-GCM integrity, per-room isolation, authorisation, CSRF, item versions, classroom permission, quiz privacy, targeted signalling, revocation, restart, backup/restore and release verification.
- Original conversation checksum matches `4a22132962e087c51190bd4366baed686a2b63eac4afac76261198ecb983e5e1`.
- Native wrapper syntax was checked and locked Electron dependencies installed. Linux unsigned directory packaging passed. Its Electron 45.2.1 / Node 24.22.1 runtime opened SQLite and served HTTP successfully in non-GUI mode. The ASAR contains the app and server and excludes runtime keys/data. GUI launch, capture, macOS/Windows packaging and signed platform release verification remain pending.
- `npm audit --omit=dev` reported zero known vulnerabilities at verification time; this is not a security certification.
- Connected Chrome could not reach the managed process (`ERR_CONNECTION_REFUSED`). No real rendered UI, physical iPhone/Android, captured WebRTC media, mDNS or multi-display hardware result is claimed.
- Hosted CI results must be read from the PR after push; local test output is not a remote CI conclusion.

The final verification record can update the counts here if further tests are added. Do not infer unrecorded platform success from these checks.

## Commands

```sh
npm ci
npm run verify
npm start
```

Run from a real desktop for browser/native work. For phone access, follow OPERATIONS and configure trusted HTTPS with an actual LAN URL. Use synthetic/disposable test content until the release gates are complete.

## Next priorities

1. G2/G3 real-browser and two-device validation, including an iPhone, a classroom cycle and two simultaneous wall/leader tabs.
2. G4 native launch/package checks on Mac/Windows/Linux. Validate permission refusal and stop paths, native-opening cancellation and display hotplug.
3. WP09 retention and process-crash hardening. Durable cleanup/retry, startup orphan reconciliation and visible pending deletion outcomes are implemented and fault-tested; bounded command/session retention remains.
4. WP10–14 true virtual displays, input handoff and commissioned panoramic hardware. Keep this work distinct from the implemented edge cue.

All remaining work has acceptance criteria in DELIVERY. The product name remains Borderless. Do not silently rename it, replace the preserved source or describe aspirational native features as complete.
