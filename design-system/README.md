# Borderless design system

The design language for the Wall, the Portal (phones and laptops) and the Console. One token source feeds every platform. Live reference: open `dist/showcase.html`.

> Status: v0.1. Edem chose this direction on 3 November 2026: **Glass**, with the owner-colour glow from **Light** and numbered labels from **Instrument** in the Tactical look. The other directions are kept in `docs/directions/` for reference.

## Layout

| Path | What it is |
| --- | --- |
| `tokens/source.mjs` | The single source of truth: spacing, radii, type ramps, motion, owner colours, the four looks. |
| `scripts/build.mjs` | Builds `dist/` from the source. Run `npm run build`. |
| `scripts/contrast.mjs` | Fails if any look breaks the contrast rules. Run `npm run check`. |
| `dist/tokens.css` | CSS custom properties (`--bl-*`) for the web Wall, Console and Portal. |
| `dist/tokens.ts` | Typed tokens for the React Native phone apps. |
| `dist/BorderlessTokens.swift` | SwiftUI colours, springs, spacing and radii for the Mac app. |
| `dist/tokens.json` | Everything, for any other consumer (the Godot or native Wall if kept). |
| `components/components.css` | The component library as CSS classes (`bl-*`). |
| `components/index.src.html` | Source of the reference page; built into `dist/showcase.html`. |
| `docs/CODEX.md` | Start here if you are building: what this replaces in the Codex brief, and the rules. |
| `docs/PRINCIPLES.md` | The rules, anatomy and states of each component, and the signature motion. |
| `docs/RESEARCH.md` | What the language is based on. |
| `docs/directions/` | The four directions shown to Edem. |

## Using it

Web:

```html
<link rel="stylesheet" href="design-system/dist/tokens.css">
<link rel="stylesheet" href="design-system/components/components.css">
<body class="bl" data-bl-theme="whiteboard"> <!-- or studio, executive, tactical -->
```

React Native: `import tokens from 'design-system/dist/tokens'` and read `tokens.themes.whiteboard.color.ink`, `tokens.motion.spring.settle` and so on.

Swift: add `dist/BorderlessTokens.swift` to the target and use `BL.Themes.whiteboard.ink`, `BL.Springs.settle`, `BL.Radius.window`.

## Rules

- Never hard-code a colour, size or duration in product code. Add a token instead.
- Never edit `dist/` by hand. Edit `tokens/source.mjs` and run `npm run check`.
- Looks change colour, material and the heading face only. Structure stays the same.
