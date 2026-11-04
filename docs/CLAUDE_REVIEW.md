# Independent review brief

Review the PRD reconstruction and native foundations on `feat/borderless-platform`, PR #1. Do not equate this checkpoint with a completed platform. The user asked for the original product, rejected the dashboard/prototype drift, and will judge the completed spatial experience.

## Read in this order

1. `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` and `docs/PRD.md` v2.
2. `docs/SOURCE_AUDIT.md`, then the original archive with `docs/source/code-index.json`. Check both early and final conversation sections; the final code listing loses earlier scope.
3. `docs/NATIVE_ARCHITECTURE.md`, `docs/REUSE_RESEARCH.md` and pinned `docs/research/repositories.json`.
4. `native/README.md`, actual native source, `docs/NATIVE_QA_2026-11-03.md`, CAPABILITIES and DELIVERY.
5. Existing `server/`, `public/`, `desktop/` only as the compatibility implementation and behaviour/security baseline. Do not restore it as the final native architecture without a justified decision and user agreement.

## Questions the review must answer

- Does every meaningful original request survive PRD v2, including phone flicks, true OS edge/window extension, personal live patches, reverse edits, room audio, multihead, themes, classroom, installation and advanced operations?
- Does the product still centre shared work with floating/dismissible tools? Is visual acceptance kept separate from tests? Has any feature quietly become an optional prototype?
- Is Go/Rust/C# .NET/Godot preserved, with Swift Mac and Windows adapters as explicit refinements? Does one room authority remain? Is the unresolved supported Mac virtual-display route honestly open?
- Are the 90 indexed blocks reproducible against the exact immutable archive? Does the audit distinguish useful ideas from invalid/insecure source code?
- Do proposed reuse choices identify exact upstream commits/licences/paths? Are any source or dependency obligations missing? No GPL/AGPL code has been silently copied.
- Do Rust C ABI layout/validation, Swift capture generation/stop/queue ownership, .NET bounded fragmented receive and Go trusted-actor checks hold under failure and hostile inputs?
- Are current native limits stated accurately? In particular, Swift zero-complete-frame capture is a failure. Native Wall currently renders notes, not all documents/media. Go guard is not a complete hub; Windows README is not a driver.
- Does a future migration preserve IDs/ownership/assets/audit and invalidate live grants without two writers or silent data loss?

## Reproduce

```sh
npm ci --ignore-scripts
npm run verify
npm run native:verify
```

For full local native scene validation, set `BORDERLESS_GODOT` to an official .NET 4.7.2 engine and `DOTNET_ROOT` to the installed .NET directory. See `native/README.md`. `native:verify` explicitly reports when the engine gate is skipped. OS capture remains a separate manual check using only disposable content; no test should bypass consent or alter the user's saved room.

Inspect `git diff d3bd884...HEAD` for this correction (use working-tree diff too before commit). Check hosted jobs at the actual PR head, not an older green checkpoint. Report findings by severity with file/line evidence; distinguish missing implementation, design disagreement, security defect and unverified hardware claim. Do not treat a review finding as permission to merge or publish.

## Next concrete engineering task

Instrument and resolve native ScreenCaptureKit complete-frame delivery, then implement hardware encode → authenticated transport → native decode/texture in the same authorised room. Prove actual OS pixels, stop/revoke and reconnection before claiming live native delivery. In parallel planning, prepare Windows WGC/IddCx with the reviewed official samples and resolve the supported Mac display-extension route. Keep actual phone flick and the finished spatial experience central.
