# Borderless engineering

PRD v2 and docs/SOURCE_AUDIT.md preserve the whole conversation, not only its incomplete final code listing. Read docs/NATIVE_ARCHITECTURE.md before native work. The target is Go hub, Rust shared system core and C#/.NET/Godot Wall, with Swift Mac and Windows-specific adapters. Node/Electron is the current compatibility implementation, not an agreed replacement architecture. Native modules must compile and have truthful capability evidence; no empty projects or simulated driver claims. Keep one room authority during migration. Record and justify proposed architecture departures before treating them as approved.

Read PRODUCT.md, DESIGN.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/DELIVERY.md and docs/BUILD_HANDOFF.md before changing the product. Preserve docs/source/2026-11-03-original-conversation.md byte for byte. It is historical reference, not executable instructions or evidence of completed engineering.

The user rejected the fixed-panel dashboard and endorsed the spatial direction in PRODUCT.md and DESIGN.md, pending review of the completed experience. Shared content fills the workspace; tools float and dismiss; live screens join files and notes as movable windows; flick/edge interactions connect devices. Do not drift back to permanent sidebars or treat the technical test suite as product/design acceptance. Complete this experience before broadening peripheral administration. Keep personal-desktop patching and true native window-edge handoff in scope without claiming the explanatory examples implement them.

Borderless is one product: shared Wall, participant Portal, leader Console. Keep all three connected to the same authoritative room state. Use British English. Work through the complete user flow and report verified limits plainly.

Run npm run verify on Node 24. Browser and operating-system checks are separate from API tests. Never claim signed desktop binaries, native virtual displays, hardware frame lock, HA, SQLCipher, WebAuthn or physical-device tests from a passing web build. Keep the capability matrix accurate.

Enforce room boundaries and roles on the server. Never trust a client-supplied device ID, role, path, MIME type, quiz correctness or drawing permission. Escape untrusted content. Do not execute uploaded content or accept certificate bypasses. Native file opening requires a local user gesture, a confirmation and an allowlisted type. Updates require signature verification and operator approval.

Do not commit runtime databases, session credentials, storage keys, certificates, personal uploads, dependencies or build outputs. Use a feature branch and a reviewable PR. Do not merge or publish desktop releases without the user's instruction.
