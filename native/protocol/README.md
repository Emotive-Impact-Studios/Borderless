# Native contracts, v1

One room authority. Existing HTTP/WebSocket semantics are documented in `docs/ARCHITECTURE.md`; `RoomClient.cs` currently consumes that compatibility protocol. The wire roles are `admin`, `participant`, `wall` (product labels: leader, participant, display). Do not introduce a native bypass.

The Go `control.Move` envelope is the first **proposed versioned migration command**, not a new public endpoint. It adds `protocol`, `requestId`, `roomId`, `type`, `itemId`, `expectedVersion`, `x`, `y`. The adapter will map legacy `{id, version}` and receipt scope explicitly; until then no running server accepts it. Validation requires all fields, rejects duplicates/unknowns, uses trusted actor context and rechecks the target room/owner/version. No claim of Go hub parity is made.

Rust C ABI v1 is defined in `../core/include/borderless_core.h`: numerical values only, no ownership-bearing pointers. Swift links the static library; .NET calls the same code through P/Invoke. Coordinates use one OS logical unit system with origin/size/rotation supplied by the adapter. Scale conversion happens before this API. Out-of-bounds/non-finite coordinates fail. This mapping alone creates no monitor and sends no input.

Capture health is distinct from transport health. A complete-frame count of zero can never produce Receiving. Clock values must be from one monotonic process clock. Stale means no recent complete frame; an idle ScreenCaptureKit source may retain a valid static image. Permission, source-ending and stream errors are separate adapter states. Each new capture gets fresh counters and an independent generation; old callbacks cannot revive it.

Future transport negotiation must carry version, codecs/colour/size/rate, source generation, connection ID and server-authorised audience. File bytes, durable commands, ephemeral pointer input and media each have separate budgets/lifetimes. Do not transmit native pointers, filesystem paths or arbitrary executable names.
