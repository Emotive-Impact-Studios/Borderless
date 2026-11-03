# Borderless

**One room. Every screen.**

Borderless turns a TV, projector or room display into a shared canvas. People join from a phone, tablet or laptop to send files, leave notes, sketch, point, answer questions or share a live screen. The leader runs the room from the same application.

This is a working local-hub alpha, with real HTTP, WebSocket, SQLite and encrypted file flows. The desktop application source is included. Signed installers, OS virtual display drivers and hardware frame synchronisation have separate delivery gates. See [the capability matrix](docs/CAPABILITIES.md) for precise status.

**Architecture correction:** the complete product follows the original Go hub, Rust system core and C#/.NET/Godot Wall, with a Swift Mac adapter and Windows-specific OS integration. Node/Electron remains the current compatibility implementation. Read the reconstructed [PRD v2](docs/PRD.md), [native architecture](docs/NATIVE_ARCHITECTURE.md), [reuse research](docs/REUSE_RESEARCH.md) and [native build guide](native/README.md). Native foundations now compile, but native capture-to-Wall delivery and display extension are not complete. For an independent review, start with [CLAUDE_REVIEW.md](docs/CLAUDE_REVIEW.md).

## Run on this computer

Install Node.js **24 LTS**, version 24.15 or later, then:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:8443**. Create a room, choose a leader password of at least 10 characters, and open its wall view in a second tab or on a connected display. There are no default credentials, external services or cloud accounts to configure.

To connect real phones and other computers, configure trusted HTTPS and the host's LAN address using [the room setup guide](docs/OPERATIONS.md). The default loopback address is deliberately limited to this computer. There is no automatic certificate bypass.

## The three views

| View | Route | Purpose |
| --- | --- | --- |
| Leader console / canvas | `/room/:roomId` | Arrange contributions, invite people, manage drawing, run quizzes, pause, export and end sessions. |
| Participant portal | `/portal/:roomId` | Send or flick files, contribute thoughts, draw, use touch or optional motion pointers, receive files and answer quizzes. |
| Shared wall | `/wall/:roomId` | Full-screen canvas, live screens, pointers, ink, room QR and quiz display. A separate device pairs with a one-use display link. |

Participants join at `/join/:roomId` with the room code. Returning leaders use `/leader/:roomId` with the leader password. The leader password and participant code are separate.

An invited personal live window opens at `/screen/:roomId/:streamId`. Its owner chooses the recipient, and that person accepts a view-only stream. The Mac app gives it an independent desktop window; closing that window leaves the room share running. Stop receiving removes the recipient's grant, while the source keeps the capture stop control. This is separate from native OS window-edge transfer.

## Desktop source

```sh
npm run desktop:install
npm run desktop
```

The Electron wrapper starts a local hub or can connect to a trusted existing hub:

```sh
npm --prefix desktop start -- --hub=https://your-room-hub.example:8443
```

It includes a screen picker, explicit native file-open confirmation, display placement, a wall spanning connected displays and optional desktop edge cues. **Edge cues do not create an OS virtual monitor or move native windows.** Use consented screen sharing for live pixels. Packaging instructions and host-specific checks are in [DESKTOP.md](docs/DESKTOP.md).

Native invitation joins open the full room canvas. Share a screen, use its **Invite a viewer** action, then choose someone in the room. They open the invitation in **People** and accept it in the new live window. Browser participants find invitations above their Portal tools. Same-Mac acceptance uses explicit controlled media fixtures; normal local interface-address media and physical LAN delivery still need commissioning, as recorded in the QA/handoff.

## Verify and build

```sh
npm run verify
```

This checks JavaScript and JSON, verifies the preserved original conversation, runs integration/recovery tests and produces a portable source distribution in `dist/`. `npm run desktop:smoke` additionally exercises the real Electron app, a phone-sized Chrome Portal and paired Wall in disposable state. See [the Mac QA record](docs/QA_MAC_2026-11-03.md). CI also builds and tests an unsigned Mac directory package; the separate cross-platform installer workflow remains manual. No check produces a signed native release.

```sh
npm run audit:verify
npm run backup -- /absolute/path/to/a/new-backup-directory
npm run restore -- /absolute/path/to/backup /absolute/path/to/new-data-directory
```

Back up the database, encrypted assets **and storage key** together. Losing the key makes uploaded files unrecoverable. Keep backups private: they contain the local encryption key and session credentials. Session JSON exports include metadata, notes and ink, but not uploaded file bytes.

## Product and engineering record

- [Original conversation, preserved verbatim](docs/source/2026-11-03-original-conversation.md) and [SHA-256 checksum](docs/source/SHA256SUMS)
- [Product requirements](docs/PRD.md)
- [Architecture and protocol](docs/ARCHITECTURE.md)
- [Capability and verification matrix](docs/CAPABILITIES.md)
- [Remaining delivery work packages](docs/DELIVERY.md)
- [Operations and recovery](docs/OPERATIONS.md)
- [Security model and limits](docs/SECURITY.md)
- [Current build handoff](docs/BUILD_HANDOFF.md)
- [Technical research and dependency register](docs/RESEARCH.md)

The source conversation includes proposed code and enthusiastic completion claims from another assistant. Those claims are not treated as implementation or validation evidence. Borderless keeps the complete vision while recording separately what is implemented, what has passed tests and what still needs native engineering or physical hardware validation.
