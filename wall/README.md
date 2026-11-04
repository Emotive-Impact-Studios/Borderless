# Borderless native Wall

The room's big screen as a native Rust renderer (`wgpu`: Metal, Direct3D 12 or Vulkan), decided by the user on 4 November 2026. It follows the hub's room state and holds no authority of its own. See `docs/CODEX_BRIEF.md` milestone 2N.

```bash
cargo build --release
# Pair once with the one-use invitation from the Console (Invite, then "Pair a separate display"):
./target/release/borderless-wall --pair "https://room-hub.local:8443/app/wall/<room>#pair=<token>" --display 1
# Later starts reuse the saved Wall session:
./target/release/borderless-wall --room "https://room-hub.local:8443/app/wall/<room>" --display 1
```

`--display N` picks the monitor (0 is the main display); `--windowed` opens a 1280×720 window instead of full screen. Trusted HTTPS is required except on loopback, with no certificate bypass. The Wall session cookie is stored owner-only under `~/Library/Application Support/Borderless Wall/sessions/` (or `BORDERLESS_WALL_HOME`). `BORDERLESS_WALL_CAPTURE=<file.png>` saves each settled frame from the GPU for review evidence. `BORDERLESS_REDUCED_MOTION=1` turns off gliding.

Built so far: pairing and saved session, the live room state stream with reconnect, design-system looks from `design-system/dist/tokens.json`, the dot-grid canvas, windows with shadows and the glass ornament, notes, link cards, file placeholders, live-window placeholders, layout gliding with the design-system easing, the room card and empty state. Next: images, the arrival effects, live video through the LiveKit Rust SDK with hardware decoding, PDFs through pdfium, video files.
