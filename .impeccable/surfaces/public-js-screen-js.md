---
version: 1
slug: "public-js-screen-js"
primary_target: "public/js/screen.js"
related_targets: ["public/screen.html","public/screen.css","public/js/app.js","public/js/board.js"]
---

# Personal live-window receiver

Mode: Operate. Extend the confirmed spatial workspace; preserve its themes, identity, room data and ownership.

## Direction contract

THESIS: Bring a deliberately shared live window beside a person's own desktop work, with real pixels and reversible access.

OWN-WORLD: Inherit Borderless theme surfaces, workhorse UI type, quiet elevation and existing SVG icons. The video owns the window; controls occupy one compact header.

STORY: The source owner invites a room member. That person opens a separate native window, accepts there, sees changes live and can stop receiving. The owner can revoke access or stop capture. Closing a receiver leaves the room share running.

FIRST VIEWPORT: Source/title and connection status at the top; a persistent, contained video fills the remaining area. Consent, lost connection, revoked access and ended-share messages occupy that same content area. No room sidebar or dashboard chrome.

FORM: Precisely specified extension of the user's approved live-window direction; inherited composition, no concept seed or new brand exercise.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented extension · 3 November 2026

The receiver follows the incumbent spatial direction without changing the visual system. It inherits the authoritative room theme, existing UI font, button treatments and SVG icons. A compact header carries the title (14px), view-only owner/room information and connection status (12px), plus reception controls. One persistent, contained video fills the remaining window. Consent, connection recovery, revoked access and ended-share messages use that same content area. At narrow widths the controls wrap; coarse-pointer controls have a 44px minimum target.

- The source owner invites a room member, who opens an independent native Mac window and explicitly accepts before receiving media. The owner retains capture stop and per-viewer revoke controls.
- Closing the receiver preserves the owner's capture and the accepted invitation. Stop receiving removes that recipient's grant. Retry video and room reconnection have separate recovery controls; an initial snapshot failure shows Disconnected and Reconnect now, then refreshes authority before presenting pending consent. Revoked access asks for a new invitation.
- Native participant joins open the full room canvas. Pending live-window invitations lead the floating People utility and have a badge on its opener. The receiver and local utilities remain independent of authoritative shared content geometry.

## Implementation evidence and limits

Checked `public/screen.html`, `public/screen.css`, `public/js/screen.js`, `public/js/live-windows.js`, the related workspace styles and integration, and `desktop/main.mjs` against PRODUCT.md and DESIGN.md. The private captures in `.impeccable/review/` cover source invitation, desktop inbox, consent, desktop video, narrow video, revoked access and initial connection failure (`initial-offline.png`). They show the dominant video, compact controls, independent room workspace and explicit recovery.

The recorded source native/browser acceptance passes 35 checks with 127 representative contrast samples; current unsigned packaged acceptance passes 35 checks with 134 samples. Both use an explicit same-Mac loopback media fixture and have a minimum contrast of 4.888:1 across the five themes. The checks include consent, persistent media, retry, reconnect, revoke, close, Stop receiving and a deliberately aborted initial snapshot recovering to pending consent. The separate code gate passes 54 tests. The fresh finish review records `ship`, persistence pass and matching relevant contract rows; a separate review of initial recovery also records `ship`, with no material fixes. These verdicts apply only to this receiver extension.

Video frames are synthetic QA data. No shipping raster assets were added; screenshots are private and ignored. Normal local-interface media remains unresolved. This evidence does not establish two-physical-device delivery, OS capture consent, physical-phone acceptance, signed distribution, an OS virtual display, native window-edge handoff, remote input or final user design acceptance. PRODUCT.md and DESIGN.md remain the confirmed working direction.
