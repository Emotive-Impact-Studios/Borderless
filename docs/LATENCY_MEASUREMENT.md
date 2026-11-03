# Measuring the live Mac-to-Wall path

## What this measures

`scripts/latency-source.swift` draws a timestamp and moving square in an ordinary AppKit window. Select that window in Borderless Native and publish it normally. ScreenCaptureKit captures its actual pixels; LiveKit transports them; the actual Tauri Wall renders them. The fixture does not inject buffers into the publisher or simulate received video.

Read the timestamp from screenshots of the receiver. Record `Date.now()` immediately before and after each computer-use screenshot call, then save the returned PNG. The source uses the same Mac's wall clock. For timestamp `p` and screenshot-call times `s` and `e`, report `[s − p, e − p]` milliseconds. This conservatively brackets the observation time only if the screenshot represents a frame sampled within that call. It includes paint scheduling, capture, encode, transport, decode and screenshot observation; it does not measure photons, panel scan-out or physical display response. Do not call it exact glass-to-glass latency or use it to certify the under-100-ms physical target.

Take direct screenshots of the source as calibration. Bounds spanning zero are expected if the window paints during the screenshot call. A negative lower bound is not negative transport latency. Independent source and receiver samples cannot establish an exact correction to subtract from every frame. Keep both windows visible, preferably on separate physical displays: macOS Spaces and WebKit visibility suspension can otherwise invalidate playback measurements.

## Reproduction

Compile the fixture with `swiftc scripts/latency-source.swift -o <local-output>/LatencySource`. Launch it as a local AppKit application. Keep generated binaries and screenshots under ignored `output/`. A 60 Hz timer requests drawing; it is not proof of 60 rendered or received frames per second.

Select the fixture through the native window picker, then Send to Wall. For a full-resolution sample, enlarge the source before selecting it: capture dimensions are established when capture starts. Confirm the receiver's actual decoded video dimensions separately; a 1920×1080 desktop screenshot alone does not establish encoded resolution.

Save a JSON array alongside the PNG files:

```json
[{"file":"wall-000.png","start":1793740000000,"end":1793740000035}]
```

Run `python3 scripts/read-latency-samples.py <directory>/samples.json` with Pillow installed (10.4.0 was used here). It finds the red/blue delimiters, decodes the 48-bit timestamp and requires at least three agreeing rows. A missing or implausible timestamp fails the run rather than silently dropping a slow frame. `results.json` preserves every decoded sample and the summary. Raw artefacts stay local; commit the method and aggregate findings only.

## Observations on 3 November 2026

Apple M2 Pro, native Swift capture, local LiveKit 1.13.11, actual Tauri/WebKit receiver. Two attached 1920×1080 displays; no second-machine network traversal. These short bursts are diagnostic samples, not sustained performance certification.

| Setup | Samples | Median observation-age bounds | Median screenshot-call duration |
| --- | ---: | ---: | ---: |
| Initial windowed source | 30 | 116–152 ms | 35 ms |
| Windowed source, alternating source/Wall calibration: Wall samples | 30 | 111.5–144 ms | — |
| Same alternating calibration: direct source samples | 30 | −17.5–15.5 ms | — |
| Fullscreen source, receiver visible on separate display, existing 30 fps capture settings | 30 | 72.5–109.5 ms | 32 ms |

Local evidence: `output/native/latency/`, `output/native/latency-paired/`, `output/native/latency-1080-30/`, each with `samples.json`, PNGs and `results.json`. The last burst lasted approximately 1.065 seconds; observed upper bounds ranged up to 139 ms. The difference between runs must not be attributed solely to resolution: visibility, scheduling and playback state also changed.

The existing capture and buffer-capturer settings were 30 fps. The pinned SDK's screen-sharing presets reach at most 30 fps. The explicit capture/buffer/encoder 60 fps candidate (8 Mbps maximum) was subsequently launched after restoring its existing macOS permission. At decoded 1280×748, the first 30 samples gave median bounds 35.5–71.5 ms; a later 60-sample burst gave 33.5–71 ms. Both had a maximum observed upper bound of 92 ms. WebKit frame-callback metadata advanced from 5,044 to 6,281 presented frames in 22.599 seconds: approximately 54.7 fps, not a sustained 60 fps claim. The ordinary timer-driven source itself is not guaranteed to paint at 60 fps. Local artefacts: `output/native/latency-60/` and `output/native/latency-60-repeat/`. This observed improvement is not a controlled physical latency certification.

A subsequent capture selected the fullscreen source after moving controls to the other physical display. WebKit frame-callback metadata confirmed decoded **1920×1080**. Sixty screenshots gave median bounds **37–75 ms**, with a maximum upper bound of **655 ms** during a stalled interval. Raw results are in `output/native/latency-1080-60/`. Capture subsequently ended; whether this was user Stop/source closure or another cause was not established at the time of recording. A second frame counter observation did not complete, so this run supplies no full-resolution frame-rate estimate. Preserve the outlier; do not report only the median as a performance pass.

M1 remains open: the physical latency target, sustained decoded frame rate, another machine over a trusted LAN connection and the user's review are not established by these measurements.
