# Borderless design principles and component rules

Language: **Glass**, after Apple's Liquid Glass and visionOS. Content windows carry no chrome. Who put a window there, and whether it is live, floats beneath it in a glass ornament. Each person's colour glows when their work arrives or is live.

## Principles

1. **The work is the hero.** Content fills the screen. Chrome lives in glass outside the content and fades when nobody needs it. No fixed panels, no dashboards.
2. **Motion tells the truth.** Travel starts when bytes leave. A window lands only when the hub confirms it. Failure is shown, never hidden.
3. **Calm at rest, alive on arrival.** The resting Wall is quiet. The energy goes into the second when something crosses over, in the sender's colour.
4. **Readable from the back row.** Nothing on the Wall below 18 px at 1080p (36 px at 4K). Portal touch targets at least 44 px.
5. **Colour never works alone.** Every owner colour comes with an initial and a name. Live always has a word as well as a red dot.
6. **One structure, four looks.** Whiteboard (default), Studio, Executive and Tactical swap colour, material and the heading face. Nothing moves.

## Contrast (enforced by `npm run check`)

- Text and muted text: 4.5:1 on surface and Wall.
- Accent, Live and the eight owner colours: 3:1 on surface and Wall.
- Text on the accent: 4.5:1.

## Components

### Window (`bl-window`)

- **Anatomy:** content (`bl-window__content`) with 24 px continuous corners at 1080p, then an ornament 8 px below, centred.
- **States:** rest; focused (scale 1.02, lifted shadow, 180 ms); live (2.5 px owner ring plus a soft glow); paused (ring dims to 35%, content desaturates, "Paused" pill); arriving (`bl-arrive`).
- **Note windows** tint the content 13% towards the owner colour. Notes are never tilted.
- **Tactical** halves the radius and numbers every window (01, 02...).

### Ornament (`bl-ornament`)

- Glass capsule, 36 px on the Wall at 1080p, 32 px on the Portal.
- Order: avatar, number (Tactical only), title, Live pill, owner name, then actions.
- Actions (Send to phone, Close, Full screen) appear on hover or focus only. Nothing interactive shows on the Wall at rest.

### Toolbar (`bl-toolbar`)

- One glass capsule, bottom centre, 22 px from the edge. Icon buttons 40 px, pressed state tinted with the accent.
- Dismisses after 4 s of no pointer activity on the Wall; returns on any pointer move.

### Buttons (`bl-button`)

- Capsules, 44 px (32 px small, 56 px large). Variants: default, primary (accent), glass, danger.
- Labels say exactly what happens: "Send to Wall", "Allow", "Clear Wall". Never "OK".

### Join card (`bl-join`)

- Glass card bottom right with the room code in mono and a QR code. Fades to 40% when the room has three or more windows.

### Destinations (`bl-chip`) and mode switch (`bl-segmented`)

- Chips choose where something goes on the Portal: the Wall, a person, everyone. Pressed chip is solid ink.
- Segmented controls choose a mode: Point, Draw, Send.

### Requests (`bl-request`) and toasts (`bl-toast`)

- Requests (hand raised, share request) are glass cards with the person's avatar, a sentence and two buttons. The primary action is on the right.
- Toasts confirm a real event in past tense: "Landed on the Wall", "Saved to your phone". They leave after 3 s.

### Classroom (`bl-option`, `bl-result`)

- Quiz options are 52 px rows with a lettered key. Results are bars in tabular figures that grow over 400 ms.

### Console (`bl-minimap`, `bl-source`)

- The mini-map mirrors the Wall in owner colours and moves with the glide curve.
- Source tiles show live thumbnails with a mono label (number and owner) for patching in control rooms.

### Portal flick card (`bl-flick`)

- States: rest; lifted under the finger (scale 1.04, coloured shadow); sending (flies up and shrinks); failed (falls back with a bounce and an explanation).

## Signature motion

| Moment | Phase | Laptop or phone | Wall | Timing |
| --- | --- | --- | --- | --- |
| Window over the edge | Arm | Edge glow in owner colour, 60% opacity, breathing | Matching glow at the seat's entry point | 200 ms |
| | Cross | Liquid pull towards the edge, dissolving into particles | Particles pour in and resolve into the live window | 450 to 700 ms, tracks the drag |
| | Land | Glow fades | Spring settle (response 0.35, damping 0.78, about 6% overshoot) and one ripple | 300 ms |
| Phone flick | Lift | Card lifts under the finger | | 120 ms |
| | Travel | Card flies off the top and shrinks | Spark at the aimed point with real upload progress | 600 ms |
| | Land | | Particle vortex in the sender's colour, then the window, then a 900 ms ripple | 350 ms |
| Send back | | Phone shows "Saved" | Ghost copy drops from the window; the Wall copy stays | 550 ms |

Curves: standard `cubic-bezier(0.2, 0.8, 0.2, 1)`, enter `cubic-bezier(0.05, 0.7, 0.1, 1)`, exit `cubic-bezier(0.3, 0, 0.8, 0.15)`, glide `cubic-bezier(0.45, 0, 0.2, 1)`. Linear only for progress.

Reduced motion and the room's Quiet setting replace travel with a 150 ms fade and drop ripples and breathing, but every state change stays visible.
