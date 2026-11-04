# Windows adapter and display driver

Target: .NET participant host using `../dotnet/Borderless.Native`, shared Rust C ABI, C++/WinRT WGC capture bridge, hardware encoder, and a separately signed IddCx/UMDF driver. This directory is an implementation boundary, not a completed Windows adapter.

Start from the pinned sources in `docs/research/repositories.json`: Microsoft `video/IndirectDisplay/IddSampleDriver/Driver.cpp` for adapter/monitor/swapchain lifecycle, and robmikh `Win32CaptureSample/SimpleCapture.cpp` for free-threaded WGC frame arrival, resize and teardown. Retain licences/notices for imported code. Do not copy sample EDID identity into a shipping monitor or run installer/driver registration from a normal app without the required operator action.

First Windows deliverable: native picker → WGC complete D3D11 frame → bounded encoder input → authorised receiver, with source close/resize, denied consent, sleep and GPU reset. Second: real IDD monitor → same frame path → actual window edge movement → local Escape/network-loss recovery. The sample is not a complete driver product; IPC ACLs, mode validation, adapter selection, frame release, shutdown, signing and WDK/HLK tests remain.

No Windows device/driver test has been run on this Mac. `.NET` cross-platform tests prove the shared client and Rust binding only. Driver source copied without a Windows build would not provide stronger evidence.
