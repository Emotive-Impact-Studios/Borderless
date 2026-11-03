# Complete conversation audit

Reviewed 3 November 2026. Scope: all 14,281 lines, including code, alternatives, repeated revisions, naming and the user's final rejection of an MVP-only build. Archive: 387,055 bytes; SHA-256 `4a22132962e087c51190bd4366baed686a2b63eac4afac76261198ecb983e5e1`. This file interprets the archive; it never edits it.

## What went wrong

The builder pursued the Node/Electron prototype option as the main architecture without agreement, then treated breadth of implemented administration and passing tests as progress towards the complete native product. The first UI also contradicted the intended spatial workspace. Those were delivery decisions, not changes requested by the user. The latest correction restores Go/Rust/C# as the reference and makes native/platform acceptance independent of web/API coverage.

There is a second, separate problem: many original assistant snippets cannot compile, are insecure, or simulate a capability described as complete. Preserving the user's intent requires correcting those snippets, not executing them literally. The final listing omits earlier features; it is not a complete source tree. No original compiled application, driver, media encoder or installer was actually supplied.

## Source-to-product register

All ranges refer to `source/2026-11-03-original-conversation.md`. The [code index](source/code-index.json) identifies individual blocks and their raw-byte hashes. B IDs refer to PRD v2; WP IDs retain delivery history.

| Source lines | Discussion/decision | Requirement and destination | Treatment |
| --- | --- | --- | --- |
| 1–113 | Organise the entire discussion; save source; NASA/large display context | B01, B26; source archive, PRD | Preserve whole scope and terminology, not unsupported operational claims. |
| 115–249 | Mac/PC windows crossing edges, phones, effects; .NET or Rust | B07, B12, B25, B30, B33; native core/adapters | Actual extended display and native APIs. Language latency claims need measurement. |
| 259–475 | Existing tools, host/client/discovery/dual paths; architecture selected | B02, B04, B12; hub and native architecture | Node/Electron is listed as an option for a PoC, not the final architecture. Novelty claim is unverified. |
| 485–795 | Every option, do it all; Godot/Unity/.NET/Rust/hardware alternatives | B06–08, B20, B25–26 | Keep full outcome; later Go/Rust/Godot selection resolves alternatives. Hardware KVM is an installation option. |
| 797–1143 | Rust boundary tracker, C++ DXGI, Go/mDNS | B04, B12, B25, B30 | Cursor polling is not a driver; DXGI code incomplete; Go import invalid and no authority. |
| 1145–1649 | WebGL metaballs; Flutter flick/elastic return | B07, B20 | Gesture/effect concepts retained; dummy asset/timers are not transfer. Flutter is not a requirement to rewrite the web Portal. |
| 1669–2391 | Go broadcast bus and Rust monitor | B02, B09, B22, B33 | Replace invalid select/derive, blocking broadcasts and unauthenticated identities. |
| 2401–3271 | More flick/shader integration | B07–08, B20 | Correct coordinate/velocity handling, cancellation and shader maths; receipt controls success. |
| 3273–4209 | Native Godot C# renderer and real upload/storage | B06, B11, B21–24 | Native Wall retained; labels do not render documents. HTTP memory limit is not total upload limit. |
| 4211–5173 | Multi-user ownership and native file breakout | B09, B24, B34 | Identity must be server-issued. No network-supplied shell path; explicit confirmed allowlisted open. |
| 5175–6217 | TLS and targeted reverse delivery | B13, B22, B34 | Trust certificates properly; targeted offer must not broadcast globally. Edited return needs new bytes/hash. |
| 6219–6389 | Multihead coordinate mapping | B25–26, B30, B35 | Handle negative coordinates, scale, rotation and hotplug; fixed 3×1920 geometry is not hardware proof. |
| 6391–6669 | SQLite transaction ledger | B21–23, B28 | Plain SQLite is not encrypted/immutable. Transactional state, audit head and retention needed. |
| 6671–7155 | Panoramic native windows and phone audit view | B11, B21, B26 | Fullscreen size is not OS topology; escape audit text; no certificate bypass. |
| 7157–7615 | Prediction, HA, hardware keys, audit console, Vulkan frame lock | B21, B26, B28, B35 | Keep advanced scope; prediction is optional measured optimisation. FIFO VSYNC is not multi-panel frame lock. |
| 7625–8007 | Hardware commissioning and cyber/holographic effects | B20, B26, B35 | Select actual hardware/topology; do not infer universal cable distance, zero latency or security. |
| 8009–8547 | Linux deployment, leader tablet, align/evict/purge | B18, B24, B27 | No blind global kernel changes; authority-backed controls float. Clearing UI is not erasing files. |
| 8559–8661 | Meeting/jam use; physical seating and optional BLE beacons | B08, B12, B28, B32 | Core scenarios. Manual correction required; RSSI is not precise positioning. |
| 8663–9103 | Phone gyro and multi-user laser pointers | B14 | Null/permission/cancel handling, yaw wrap, correct reticle teardown and rate limits. |
| 9115–9777 | Whiteboard and room audio | B15, B31 | Bounded persistent ink and shared media clock; shelling out afplay/aplay is not synchronised audio routing. |
| 9779–10031 | Build scripts and installers | B27 | Real manifests/dependencies, OS-specific packages, writable data separation, signing and lifecycle. |
| 10041–10573 | Premium look and automatic updater | B19, B27 | Retain polished design and managed updates; reject unsigned invisible binary hot-swap. |
| 10583–11223 | More looks; explicit clean Apple-like whiteboard | B19–20, B36 | Retain all theme families; irrelevant search response did not resolve user's Whiteboard request. |
| 11225–11837 | Schools, complete flows, participation, QR, hand raising/quiz | B03–18, B36 | Teacher control and low-friction join; LAN alone is not air gap or student browsing restriction. |
| 11849–12941 | Explicitly fill missed hand raise, quiz, schema and token validation | B05, B16–17, B21–22 | Server authority; no client role/correctness, global token broadcasts, unsafe HTML or endless register/ack loop. |
| 12951–12981 | Builder handoff explicitly names Go/Rust/C# .NET/Godot | B33; NATIVE_ARCHITECTURE | Architecture reference. Old version numbers require maintained toolchain qualification. |
| 12983–13249 | Naming; one product with three views; Borderless chosen | B02, identity | Borderless selected. Assistant suggests reducing to prototype; user rejects below. |
| 13259–14281 | “We are building the entire thing”; final blueprint/directives | All; PRD/delivery | Full product scope overrides suggested MVP. Final code omits earlier features and still contains defects. |

## Corrections to supplied code

| Original pattern / example | Why it cannot ship | Replacement and acceptance |
| --- | --- | --- |
| Rust GetSystemMetrics/cursor loop (797 onward) | Creates no monitor; does not capture/encode frames or transfer an OS window. | Supported IDD/platform strategy, native capture, media path and OS enumeration acceptance. |
| DXGI snippet: `pub:`, `GetOutputs`, Acquire/Release only | Invalid/incomplete C++; no encoded media. | Supported WGC/D3D11/IddCx APIs with lifecycle and hardware encoder. |
| CoreMediaIO presented as virtual monitor | Media/camera plumbing is not a documented extended display API. | Separate Mac display decision; public ScreenCaptureKit for capture. |
| Malformed Go import, `case client := Strain(...)`, raw-message `.String()` | Does not compile. | Compiled Go packages with strict typed decoding and tests. |
| Trust `deviceId`, `role`, `sessionId`, `isCorrect` | Impersonation, privilege escalation and forged results. | Derive actor from authenticated connection; key/correctness stay server-side. |
| `CheckOrigin: true`, certificate callbacks returning true | Bypasses origin/trust protections. | Explicit origin/host rules and OS certificate validation. |
| Broadcast all packets/tokens/return URLs | Leaks grants and private deliveries across clients. | Actor-filtered snapshots and targeted routes rechecking current authority. |
| Global mutex during socket writes, concurrent writes, no frame limit | Slow peer blocks room; unsafe concurrent connection use; resource exhaustion. | Per-peer bounded writer queue, deadlines, single writer and disconnect/re-snapshot policy. |
| `ParseMultipartForm` as upload cap, file name as path, ignored I/O | Disk exhaustion/overwrite/partial files and false success. | Bounded streamed body, generated asset ID, type/hash verification and staged durable commit. |
| Public `/storage/`, network-provided disk path | Room isolation bypass and OS path exposure. | Authenticated room asset IDs; local path resolution only in trusted adapter. |
| `OS.Execute(cmd /c start ... path)` and unsigned self-updater | Command injection/unauthorised execution; no signature/rollback. | Confirmed allowlisted file opening; separate verified staged updater. |
| `new byte`, `[Deferred]`, missing scenes/themes, replaced MainCanvas classes | Does not compile or compose into the claimed Wall. | Buildable C# project, actual scene resources, bounded background parsing/main-thread scene updates. |
| One ReceiveAsync call assumed to hold all JSON | WebSocket fragmentation breaks parsing; no size bound. | Aggregate bounded fragments through EndOfMessage, handle close/cancel and reject invalid data. |
| Label/file-name window called a document preview | It is an empty shell. | Actual safe image/PDF/text/media surface; explicit fallback. |
| Whole-screen 5760×1080 + FIFO called hardware frame lock | No monitor topology/synchronised scanout evidence. | Calibrated heads, hardware-specific synchronisation and measured report. |
| Reversed `smoothstep` edges, frame-dependent energy | Undefined/unstable rendering. | Ordered edges, bounded time-based effect, reduced-motion fallback. |
| `touches.clientY`, zero sentinel gyro, unbounded points | Broken gesture access, incorrect neutral angle and memory growth. | Pointer capture/cancel, finite calibrated state, yaw wrap and point/time bounds. |
| `innerHTML` with names/questions, inline onclick | Script injection. | Inert text and bound event handlers. |
| Random short identity and client-held drawing token broadcast globally | Collision/spoofing; UI unlock mistaken for server grant. | Strong session identity, stored grant, per-event authority check and revoke. |
| Quiz key sent to everyone; client reports correctness | Cheating and forged statistics. | Server scoring, answer receipt uniqueness and controlled reveal. |
| Register only after ACK; ACK only after register | Deadlock or repeated registration loop. | Explicit authenticated session bootstrap and one hello/snapshot handshake. |
| “MODIFIED_” filename with unchanged bytes | No real edit/version return. | New explicit upload with parent reference and verified content hash. |
| `afplay`/`aplay` on arbitrary multimedia, independent video clock | Format mismatch, duplicate output, no A/V sync. | Media decoder/mixer with shared timestamps and selected output. |
| Plain SQLite named secure_ledger.db | Filename does not encrypt data or make audit immutable. | Explicit encrypted metadata/key-management design and tamper model. |
| “Local = air-gapped/unhackable”, “production-ready”, “flawless” | Claims unsupported by code or tests. | Measured capability matrix and deployment-specific evidence. |

## Later instructions carried into this revision

The user rejected fixed panels; requested floating/dismissible tools, full working space, phone swipes and patching another person's live screen into personal work; provisionally endorsed that spatial direction; challenged omission of .NET/Rust; and explicitly requested a full PRD correction, reusable-repository research and code ready for independent Claude review. These instructions do not approve a new palette, a replacement architecture, a reduced product or publication of releases.

No original code is copied blindly into executable source. The index preserves the location/hash of every block; new code lives in native component directories with tests and documented limits. A useful reference is not automatically an approved dependency or permission to ignore its licence.
