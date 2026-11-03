# For Codex: how to use the design system

This folder replaces the visual spec in `docs/CODEX_BRIEF.md` section 4 ("Look and feel"). Where the two disagree, this folder wins. Section 4's principles still stand (work is the hero, motion tells the truth, calm at rest, visual acceptance). Its sizes, colours and window anatomy are superseded:

| Brief section 4 said | Use instead |
| --- | --- |
| Title bar 36 px inside each window | No title bar. A glass ornament below the window (`bl-window`, `bl-ornament`). |
| Corner radius 14 px | 24 px window radius (`--bl-radius-window`), concentric nesting. |
| Five themes including Synthwave | Four looks: Whiteboard, Studio, Executive, Tactical. |
| Accent `#0066CC`, hand-picked owner colours | Tokens in `tokens/source.mjs`, contrast-checked by `npm run check`. |

## Rules

1. Read `README.md`, then `docs/PRINCIPLES.md`, then open `dist/showcase.html` in a browser.
2. Every colour, size, radius, duration and curve comes from a token. Never hard-code one. If a token is missing, add it to `tokens/source.mjs`, run `npm run check`, and commit the rebuilt `dist/`.
3. Web Wall, Console and Portal: import `dist/tokens.css` and `components/components.css`, and use the `bl-` classes. Wrap them in framework components if you like, but do not restyle them.
4. React Native phone apps: use `dist/tokens.ts`. Match the anatomy and states in `docs/PRINCIPLES.md`.
5. Mac app: use `dist/BorderlessTokens.swift` and native SwiftUI materials (`.glassEffect` or `.ultraThinMaterial`) for glass.
6. Signature motion timings and springs are in `docs/PRINCIPLES.md`. Build them exactly, including reduced motion.
7. Visual acceptance: screenshots of every new screen in Whiteboard and Studio, compared against `dist/showcase.html`. Edem signs off, not tests.

## Open items

- **Tactical look needs another design pass** (Edem, 3 November 2026). Build against the current Tactical tokens for now; expect them to change. Do not polish Tactical-specific styling until the new pass lands.
