# Security model and limits

## Trust boundary

The alpha is for a trusted operator running a local room hub. The operator controls the host, certificates, network and data directory. Participants are untrusted clients and must not gain leader authority, another room's data or arbitrary OS execution by altering messages.

The host administrator remains privileged. Someone who can read the data directory can read the SQLite metadata and local storage key, decrypt files, access backed-up session material or rewrite the complete database. Full-disk encryption, private filesystem permissions and host access policy matter. The audit is tamper-evident within its local chain and guarded against normal SQL update/delete; it is not a remotely witnessed immutable ledger. Export and keep audit heads outside the host when external anchoring is required.

## Implemented controls

- TLS 1.3 minimum when enabled; plain HTTP allowed only on loopback.
- SAN-aware development certificate tooling; no `rejectUnauthorized:false`, certificate-error override or browser warning bypass.
- Room-scoped random sessions stored as token hashes; HttpOnly, SameSite Strict cookies, Secure under HTTPS and twelve-hour expiry.
- Separate room invitation code, leader password and one-use display pairing secret.
- Scrypt password hashing, origin/host checks, CSRF on mutations, endpoint and live-frame rate limits.
- Server-side room, role, item ownership, drawing approval, recipient and quiz validation.
- Frame/payload/file/room quotas and a slow-socket backpressure boundary.
- Authenticated encryption for uploaded file bytes and plaintext SHA-256/size verification before download body release.
- No direct public file storage path, uploaded scripts, arbitrary server file paths, shell interpolation or auto-execution of received files.
- Escaped participant text and a self-hosted CSP with no third-party scripts, fonts or analytics.
- Renderer sandbox, context isolation, disabled Node integration, narrow preload API, main-frame origin validation, explicit native file-open confirmation and extension allowlist.
- Explicit trusted-main-frame consent for Chromium local-network/loopback permissions; independent macOS Local Network privacy remains enforced.
- Ed25519 verification for explicitly supplied release packages. A signed manifest also constrains platform, version, size, hash and expiry.

## Known release boundaries

1. **Database confidentiality:** SQLite is not encrypted. Names, notes, participant roster, state and audit metadata are readable to the host. AES-GCM covers uploaded bytes, not the database.
2. **Certificate trust:** Self-signed development credentials are not automatically trusted on iPhones or laptops. Provision trust through the host organisation. A local web app cannot solve its own trust bootstrap by disabling validation.
3. **Room code strength:** The six-character code is an invitation convenience, protected by rate limits. It is not enterprise identity. Anyone given the current invitation can join as another participant, including someone evicted earlier. Rotate invitations when removing access from the wider audience.
4. **Device identity:** One quiz answer is per session/device identity. There is no school directory, student roster binding or proof that one human has not rejoined.
5. **Active documents:** Basic filename/magic checks are not antivirus or content disarm. PDF and Office content can carry risk in the receiving application. Native opening is explicit and should be limited to trusted content.
6. **Storage lifecycle:** File writes and SQLite commits are not one filesystem/database transaction. Startup reconciles abandoned `.part` and orphan ciphertext files. Purge commits removal of room access and durable cleanup jobs together, then attempts unlink before responding. Filesystem failures remain visible to the leader and retry automatically or manually. This is not certified hardware secure erasure and cannot recall participant downloads or backups.
7. **Availability and retention:** One authoritative hub process and one SQLite writer; the desktop hub is isolated from native dialogs. No HA, distributed failover or hostile-network DDoS claim. Expired/revoked credentials and their command receipts retire at startup and every 30 seconds, preserving active-session retry receipts. Room/content/audit retention policy and unattended enterprise operation remain release gates. Logical SQL deletion does not erase old database pages or backups.
8. **Media:** Room leaders/displays retain access to a room capture. Additional personal participants require a source-owner offer and their own acceptance; only that source owner can revoke or extend these invitations. Signals recheck fresh room sessions, grants and the bound capture connection. Snapshot invitation records are restricted to source/recipient; revoke/expiry/logout/capture reset retire access and client peers. WebRTC uses local ICE candidates only; do not assume it crosses isolated Wi-Fi clients, VLANs, NAT or firewalls. Receiving is view only; no remote mouse/keyboard injection is implemented.
9. **Native validation:** Mac source and unsigned arm64 directory-package acceptance have passed locally, including real native capture/file confirmation and generated peer media to two Wall tabs. Hosted macOS 26 media permission handling is being verified separately. Physical phones, two physical hosts, display hotplug, Windows/Linux GUI, Developer ID signing and notarisation remain gates. See the Mac QA record.
10. **Updates:** The CLI verifies signatures; it does not constitute a complete unattended updater, OS code signing, rollback system or trusted-key enrolment process.
11. **Local network:** No runtime cloud services are configured. That does not make a Wi-Fi network air-gapped or guarantee an application receiving shared content has no independent internet access.

## Reporting and response

For private development, report a reproducible security defect in the private repository without including session cookies, storage keys, uploaded private files or certificate private keys. Pause contributions, rotate the invitation, revoke affected devices, export a verified audit and take a restricted backup before investigating. Ending a room revokes participant/display sessions. Protect or remove backups separately according to the operator's retention policy.
