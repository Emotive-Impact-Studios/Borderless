# Borderless design language: research

3 November 2026. Inputs: VISION.md, CODEX_BRIEF.md section 4, the three concept images, the feature-tour prototype, and Edem's reactions in the project.

## What Edem has told us they like

- **"Look and feel like a good-looking, native, Apple-esque product that works across industries."** The bar is Apple, not a SaaS dashboard.
- **All three concept images got "this looks good... you are starting to understand it."** What they share: work fills the screen, floating windows with soft depth, owner colour on every item, light trails and particles for arrivals, a small QR join card, one floating toolbar.
- **Rejected:** fixed-panel dashboards, cramped productivity UI ("needs to look better than this"), anything that looks like a technician's tool (the Barco/Christie lesson).
- **The conversation asked for:** arrivals that are physical and fun, a calm mode, and several looks: Whiteboard (default), Studio, Executive, Tactical.
- **Distrust of OpenAI's design direction.** The language should be reasoned from Apple's own principles, not copied from generated images.

## Reference products and what to take

| Reference | Take | Leave |
| --- | --- | --- |
| Apple Liquid Glass (iOS/macOS 26) | Content first; controls float as translucent glass that refracts what is behind; concentric, continuous corner radii; capsule controls | Glass on content itself (legibility) |
| visionOS | Windows with no title bar; "ornaments" (floating tags and toolbars) attached under a window; depth through shadow and scale, not borders | Eye-gaze specifics |
| Apple Freeform / Keynote | Calm canvas, quiet chrome, typography doing the work | Small, dense controls (unreadable at 3 metres) |
| Universal Control / Sidecar | The edge as the interface: a glow shows the connection | Single-owner model |
| Barco ClickShare | One obvious action; join in one step | Hardware-first look |
| Barco CTRL, Christie Spyder | Saved layouts, source gallery with live thumbnails, numbered sources | Technician styling, dense grey panels |
| Braun, Teenage Engineering | Precision, numbering, monospace labels for control rooms | Novelty |

## Constraints the language must meet

- Readable from 3 metres on a 55-inch 1080p screen: minimum 18 px on the Wall, titles 22 px.
- Works light and dark, and in five settings (boardroom, classroom, studio, hospital, control room) by swapping colour and type tokens, not structure.
- Eight owner colours, each 3:1 against surfaces, distinguishable with common colour-vision deficiencies.
- Motion tells the truth: arrive only when the hub confirms. Reduced-motion and Quiet modes.
- Cross-platform tokens: one source feeding CSS (Wall, Console, Portal), React Native (phone apps) and Swift (Mac app).

## The four directions

Images in `directions/` (source: `directions/board.html`, render with `?d=glass|paper|light|instrument` at 1600x1040). Each shows the same room: the Wall in the Whiteboard look, a dark-room version, the phone Portal and core components.

1. **Glass.** Liquid Glass and visionOS. Content windows with no title bar; owner, title and Live sit in a glass tag underneath. Glass capsule tools. The most Apple-native.
2. **Paper.** Freeform and Keynote calm. Flat white sheets, hairlines, slim title bar, thin owner-colour line. The quietest.
3. **Light.** Owner colour as light: work glows in its owner's colour, arrivals leave trails. The most expressive, closest to the Studio image.
4. **Instrument.** Braun and pro cameras. Measured grid, numbered windows, monospace labels. Strongest for control rooms and hospitals.

## Recommendation

**Glass as the language**, borrowing the owner-colour glow from Light for arrivals and live windows, and Instrument's numbered labels for the Tactical look. That gives Apple-native by default, spectacle on arrival, and a credible control-room mode from one system.

Sources: [Apple, Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [Liquid Glass (Wikipedia)](https://en.wikipedia.org/wiki/Liquid_Glass), [WWDC23 Design for spatial user interfaces notes](https://wwdcnotes.com/documentation/wwdc23-10076-design-for-spatial-user-interfaces/).
