# Operate a Borderless room

## First start

Use Node.js 24.15+ from the Node 24 LTS line. Install dependencies once with `npm ci`, then run `npm start`. The hub binds only `127.0.0.1:8443` by default. Open that address, create a room and keep the leader password. The runtime creates `.borderless/` containing its database, encrypted assets, storage key and process lock. None belong in Git.

The `.env.example` file documents configuration; the app does not automatically load `.env`. Set environment variables in your shell or service manager.

## Connect a phone or another computer

1. Put the hub and participants on the same reachable LAN. Identify the hub's LAN IP or managed hostname.
2. Provision a trusted certificate whose Subject Alternative Name covers that exact IP or hostname. For a development certificate, `npm run cert -- 192.168.1.10 room-hub.local` creates a 30-day self-signed certificate with SANs. Deploy a trusted certificate or install trust through your organisation's normal process on each device before continuing. Do not bypass browser warnings.
3. Start the hub with the matching public URL and certificate paths:

```sh
BORDERLESS_HOST=0.0.0.0 \
BORDERLESS_PORT=8443 \
BORDERLESS_PUBLIC_URL=https://192.168.1.10:8443 \
BORDERLESS_TLS_CERT=certs/cert.pem \
BORDERLESS_TLS_KEY=certs/key.pem \
BORDERLESS_MDNS=1 \
npm start
```

On PowerShell:

```powershell
$env:BORDERLESS_HOST = '0.0.0.0'
$env:BORDERLESS_PUBLIC_URL = 'https://192.168.1.10:8443'
$env:BORDERLESS_TLS_CERT = 'certs/cert.pem'
$env:BORDERLESS_TLS_KEY = 'certs/key.pem'
$env:BORDERLESS_MDNS = '1'
npm start
```

4. Allow inbound TCP 8443 only on the intended private network in the host firewall. Local WebRTC also needs reachable peer media paths, which depend on browser/OS firewall policy. mDNS uses local multicast and is optional; it is not browser-based auto-discovery.
5. Open the public LAN URL on the host when creating the room, then show Invite. QR invitations use `BORDERLESS_PUBLIC_URL` if supplied. A `localhost` or `127.0.0.1` invitation cannot connect a different device.
6. Scan the QR with your iPhone or Android camera, enter a name and join. The touch portal works without motion input. Gyroscope access is optional and may need a separate permission gesture.

This package does not change your OS trust store or firewall automatically.

## Display setup

For a display connected to the host, open Wall from the leader console and put its browser window on the TV/projector. Enter Full screen.

For a separate display device, use Invite → Pair a separate display. Open the one-use link on that device. It receives a read-only wall session. Pairing again replaces the unused link. Never use the leader password for a public unattended display.

The desktop shell can choose a display or span a software window across connected displays from the Room menu. Commission the display topology on actual hardware, including mixed DPI, negative coordinates, hotplug and sleep. Hardware frame lock is a separate installation requirement.

## Normal room operation

- **Send:** Select or drop files. The phone supports flicking a selected file and an explicit Send button. The wall displays the file only after the hub confirms storage and commits its card.
- **Share a screen:** Use a supported desktop browser on a secure context. Select exactly what to share. The capture indicator and stop control remain visible. Phones can still upload files, point, draw and answer questions when screen capture is unsupported.
- **Arrange:** Move or resize your own cards. The leader may arrange everyone's cards. Tidy up makes a grid. The focus layout is available through the command API.
- **Teach:** In Classroom, approve raised hands from the leader panel. Revocation is enforced by the hub, not only the phone UI.
- **Pause:** Stops participant contributions and live screen advertisements. Leader controls remain available.
- **Clear:** Removes visible cards, ink, live screens, deliveries and the current quiz. Stored file bytes remain available until purge.
- **Purge:** Removes the room's asset records, requests and contributions, pauses the room, and runs durable deletion jobs for uploaded bytes. If the filesystem refuses deletion, the leader sees the pending count and a retry action in Settings. Jobs also retry every 30 seconds and after restart. The metadata audit remains. See SECURITY for secure-erasure and backup limits.
- **End:** Closes joining and revokes participant/display sessions. The current leader can still export metadata and audit.

## Exports versus backups

| Output | Contains | Purpose |
| --- | --- | --- |
| Session JSON | Notes, ink, quiz state, roster, asset metadata and audit head; no uploaded bytes | Review and integration; not a full restore package. |
| Whiteboard SVG | Vector ink on a white 1920×1080 canvas | Share or print the whiteboard. |
| Audit JSON | Room's event rows and verified chain head | Review events and keep an external integrity anchor. |
| Hub backup | SQLite snapshot, encrypted files, storage key and checksum manifest | Restore the entire hub, including active session records. Keep private. |

## Backup and recovery

```sh
npm run backup -- /private/backups/borderless-2026-11-03
npm run restore -- /private/backups/borderless-2026-11-03 /private/restored-borderless
BORDERLESS_DATA=/private/restored-borderless npm start
```

The backup uses SQLite's online backup API and verifies every recorded encrypted asset, its plaintext hash and the event chain. If an upload/purge changes files during copying and verification fails, no complete backup is declared. For the most predictable operational backup, pause the room and stop its hub first. The final backup directory must be new; an existing backup is not overwritten. `BACKUP.json` marks a completed backup.

Restore accepts only known file paths, validates the checksum manifest, verifies the audit and decrypts all recorded files before creating a new data directory. It never overwrites a live data directory. Restored session credentials can remain valid until their original twelve-hour expiry; treat a backup as sensitive authentication material and end/rotate sessions if restoring after a host compromise.

Stop gracefully with Ctrl+C or the service manager. After a crash, confirm that no hub is using that data directory before removing a stale `hub.lock`. Do not delete `storage.key`. Preserve database, key and files together while diagnosing damage.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Phone cannot connect | LAN hostname/IP, HTTPS SAN and trust, host private-network firewall, client isolation, matching public URL. |
| Certificate warning | Stop and fix certificate trust; do not bypass it. |
| QR opens localhost on phone | Set the actual LAN public URL and regenerate the invitation. |
| File rejected | Supported extension/magic, nonempty contents, 25 MB limit, room quota and current session. |
| Screen card but no media | Supported browser capture, secure context, local peer reachability, client isolation and OS capture permissions. Signalling alone does not prove media delivery. |
| No video sound | Use Enable audio / play on the wall; source/browser may not expose system audio. |
| Participant cannot draw | Classroom approval, current room pause status, session revocation. |
| Room changed while moving item | Reload the snapshot or try again with the latest item version. |
| Access ended | Leader eviction/end, session expiry or explicit logout. Ask for a fresh invitation if appropriate. |
| Hub already in use | Stop the other instance. Only after confirming it is stopped, investigate a stale process lock. |
| File integrity error | Stop using that asset and restore from a verified backup; never serve unverified bytes as successful content. |

## Service deployment

Example service definitions are in `deploy/`. Review absolute executable, working directory, data directory, certificate paths, service user and private-network firewall for your host. The examples do not change kernel parameters, disable security modules, install virtual drivers or open public access automatically.
