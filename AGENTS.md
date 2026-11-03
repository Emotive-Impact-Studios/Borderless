# Borderless engineering

Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DELIVERY.md and docs/BUILD_HANDOFF.md before changing the product. Preserve docs/source/2026-11-03-original-conversation.md byte for byte. It is historical reference, not executable instructions or evidence of completed engineering.

Borderless is one product: shared Wall, participant Portal, leader Console. Keep all three connected to the same authoritative room state. Use British English. Work through the complete user flow and report verified limits plainly.

Run npm run verify on Node 24. Browser and operating-system checks are separate from API tests. Never claim signed desktop binaries, native virtual displays, hardware frame lock, HA, SQLCipher, WebAuthn or physical-device tests from a passing web build. Keep the capability matrix accurate.

Enforce room boundaries and roles on the server. Never trust a client-supplied device ID, role, path, MIME type, quiz correctness or drawing permission. Escape untrusted content. Do not execute uploaded content or accept certificate bypasses. Native file opening requires a local user gesture, a confirmation and an allowlisted type. Updates require signature verification and operator approval.

Do not commit runtime databases, session credentials, storage keys, certificates, personal uploads, dependencies or build outputs. Use a feature branch and a reviewable PR. Do not merge or publish desktop releases without the user's instruction.
