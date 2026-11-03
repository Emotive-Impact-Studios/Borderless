# Borderless Wall shell

This Tauri 2 shell opens the shared `web/` interface. Paste a one-use Wall
invitation into the opening form; it navigates to the authoritative hub's
`/app/wall/:roomId` endpoint and pairs with the same room cookie as the browser
Wall. The remote page receives no Tauri filesystem, process or shell capability.
Trusted HTTPS is required outside loopback. There is no certificate bypass.

Build the web workspace first with `npm ci --ignore-scripts` and
`npm run build`. Then run `cargo build --locked`
from this directory using its pinned toolchain. The lockfile records the exact
resolved dependency graph. This is a development shell, not a signed installer.

Move its window to the intended display and use the shared Full screen control.
Native display selection, kiosk recovery and signed updates remain later work.
Compilation is separate from launching, WebKit media playback and real-display
acceptance; see `docs/BUILD_HANDOFF.md` for current evidence.
