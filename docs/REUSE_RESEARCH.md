# Reuse research and dependency plan

Reviewed 3 November 2026 against upstream repositories, source files and licence text. Exact reviewed commits and pinned licence links are in [research/repositories.json](research/repositories.json). A reviewed HEAD is research provenance, not an instruction to ship an unreleased HEAD. No third-party source has been vendored in this revision; the native code here is newly written. Godot packages, when restored, retain their own licence obligations.

## Highest-value reuse

| Project | Licence inspected | Reuse/learning target | Integration destination and work still needed |
| --- | --- | --- | --- |
| [Microsoft Windows driver samples](https://github.com/microsoft/Windows-driver-samples/tree/main/video/IndirectDisplay) | MS-PL | `IddSampleDriver/Driver.cpp`: adapter/monitor/mode/swapchain lifecycle. | `native/windows/driver/` when Windows build is available. Adapt supported sample rather than inventing a driver; replace sample EDIDs, implement bounded frame handoff/IPC, test WDK/HLK, sign. MS-PL notices and source-distribution terms apply. |
| [Win32CaptureSample](https://github.com/robmikh/Win32CaptureSample) | MIT | `Win32CaptureSample/SimpleCapture.cpp`: WGC free-threaded frame pool, resize, pixel format and close. | Windows capture bridge. Retain attribution if adapting; add Borderless grants, encoder, source generation and failure reporting. It is capture, not virtual display creation. |
| [Pion WebRTC](https://github.com/pion/webrtc) | MIT | Native Go WebRTC; RTP/RTCP, ICE, negotiation and encoded-media examples. | Candidate transport sidecar/Go media integration. Feed encoded OS capture; do not invent ICE/DTLS/SRTP. Test current browser/native peers and exact H.264 profile. Do not add an unnecessary central media hop. |
| [Godot](https://github.com/godotengine/godot) | MIT | Native C# scene/rendering/window/material system. | `native/wall/`. Use a pinned stable .NET build, not reviewed development HEAD (currently a beta). Real textures/documents/audio, accessibility and multihead commissioning remain ours. |
| [LocalSend](https://github.com/localsend/localsend) | Apache-2.0 | Local discovery, explicit receiver acceptance, transfer progress/cancel and platform packaging patterns. | Portal/native transfer design. Reuse isolated compatible pieces with notices if useful; do not replace authoritative rooms with LocalSend's peer model or copy trust policy without review. |

## Useful with specific obligations or limitations

| Project | Licence inspected | Recommendation |
| --- | --- | --- |
| [libdatachannel](https://github.com/paullouisageneau/libdatachannel) | MPL-2.0 | Serious native WebRTC candidate with C/C++ boundary. Compare one working capture-to-decoder path with Pion, then choose. Covered-file source/notice duties need packaging support; do not describe it as MIT. |
| [UniFFI](https://github.com/mozilla/uniffi-rs) | MPL-2.0 | Swift/Kotlin bindings when the Rust object model grows. Current small C ABI is simpler and tested from Swift/.NET. C# binding generators are third-party, so qualification is needed. |
| [Sunshine](https://github.com/LizardByte/Sunshine) | GPL-3.0 | Study hardware capture/encode, streaming latency and platform failure handling. No source copied into this currently UNLICENSED product; whole-source reuse needs an explicit compatible distribution decision. |
| [RustDesk](https://github.com/rustdesk/rustdesk) | AGPL-3.0 | Study session consent, native capture/input and cross-platform recovery. Its remote-desktop product model differs; no silent code lift into a closed product. |
| [Deskflow](https://github.com/deskflow/deskflow) | GPL-2.0, project documents OpenSSL exception | Study edge transitions, keyboard state and disconnect recovery. It shares input; it does not transfer a window's rendered pixels or create the shared room canvas. No copy without a compatible licensing decision. |

For any actual import: pin commit/release, record exact files and modifications, include upstream notices/licence, inspect transitive dependencies, add build/SBOM evidence and run our conformance/OS tests. A permissive root licence is not a blanket statement about every bundled asset or dependency. Copyleft projects are not unusable; the current recommendation is reference-only until the product's distribution/licensing choice is explicit.

## Platform references

- [Apple ScreenCaptureKit sample](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos): supported filter/stream lifecycle; current sample targets macOS 15. Our adapter targets public APIs available on macOS 14 and is compiled against the local SDK. No Apple sample source was copied.
- [Apple system sharing picker](https://developer.apple.com/documentation/screencapturekit/sccontentsharingpicker): explicit source selection, not background blanket capture.
- [Microsoft IDD model](https://learn.microsoft.com/windows-hardware/drivers/display/indirect-display-driver-model-overview): real monitor creation/frame processing; separate UMDF/IddCx driver, not the original Rust cursor loop.
- [Godot C# prerequisites](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html): .NET SDK and .NET-enabled engine are separate prerequisites. A browser Portal is still needed; do not assume native C# Wall code exports to web.

## What speeds us up without another detour

Use the driver/capture samples for their exact OS integration, an established media stack for transport, and Godot for the chosen spatial renderer. Reuse the existing Borderless authority/file/consent test cases while moving them onto the target stack. Avoid forking a complete remote-desktop application and trying to turn its UI into a collaborative room.

The claim that nothing comparable exists has not been established. These projects already cover important constituent capabilities. The product opportunity is the coherent combination and its spatial interaction, not the mere existence of capture, file transfer or shared pointers. A separate competitor/market study would be needed before making exclusivity claims.
