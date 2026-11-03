# Decisions and understanding, 3 November 2026

This records what the user and Claude settled in the review-and-rebuild conversation on 3 November 2026, so a builder gets the whole picture: the original conversation (`docs/source/`) plus everything learned since. VISION.md says what the app is. CODEX_BRIEF.md says how to build it. This file says what has been decided, what has been shown to the user, and what is still waiting on the user.

## What the user wants

The app in the original conversation: drag a real window off your laptop edge and watch it travel, with an effect, onto the room's big screen, still live; flick a file up from your phone so it lands where you aimed; send work back to someone's phone; everyone at once, side by side. The user's own words when the earlier build was reviewed: it "isn't even close to the app", and "it needs to look better than this". They want "the best" long term, not a quick prototype.

## Why the earlier build drifted

The builder measured progress by what it could check in a sandbox (compiles, tests pass), so it built a web server and web pages and called that progress. The real moments (a window crossing a real screen edge, a real phone flick, a real big screen) need native code and real devices. It also worked from the last code listing in the conversation, which had already lost the vision. The rule now: the three core moments come first, and each is done only when the user has seen it on real devices (CODEX_BRIEF.md section 7).

## What the user has seen and liked

On reviewing the concept images and the clickable prototype, the user said: "this looks good... ok you are starting to understand it". This approves the direction, not a final design.

- **Concept images** (made with OpenAI image generation): `docs/design/option-a-whiteboard.png` (clean, bright, Apple-like), `option-b-studio.png` (dark, cinematic, neon particles), `option-c-executive.png` (warm boardroom, serif, gold). Each shows all three moments in one room. The text inside the images is illustrative.
- **Clickable prototype**: `docs/design/prototype.html` (also published privately at https://claude.ai/artifact/3FP2xBSoLKyLJzQHkPkj2s). It is a guided tour of every main feature (window over the edge, phone flick, sharing a link, private live window, send-back, point and draw, classroom, leader console, mission control, patching screens onto panels, whiteboard, smart layout) in four looks. It is a design reference, not product code.

Use these as the visual target with CODEX_BRIEF.md section 4.

## Decided

- The conversation is the primary source of what the app is; PRD v3 and VISION.md follow it.
- Milestone order: real capture, live window on the Wall, phone flick, live window on a colleague's Mac, window over the edge, user review, then everything else.
- Joining a room never needs an account (QR code or room code).
- A sign-in screen briefly added to the brief was meant for a different project and was removed.

## Decided by the user on 3 November 2026

The user accepted all four recommendations: "yes whatever just make sure it works as intended".

| Decision | Choice |
| --- | --- |
| Look | A, the clean Whiteboard, as the default; B Studio and C Executive as switchable room looks |
| Architecture | ARCHITECTURE_DECISION.md option 1: native agents, Rust engine and hub, LiveKit media, one TypeScript Wall/Console/Portal, Tauri Wall shell |
| Phone apps | React Native (Expo), after the core moments; the web Portal stays |
| Mac window over the edge | `CGVirtualDisplay` (as DeskPad), isolated behind one interface, with a physical adapter documented for locked-down rooms |

The user also asked that the **mission control room** be a full intention, not an afterthought. It is now in VISION.md and is milestone 6b in CODEX_BRIEF.md.

## Practical state

- Local commits on `feat/borderless-platform` could not be pushed from Claude's session because of a permission rule; the user needs to run `git push` in the Borderless folder.
- The real capture test (share a blank TextEdit window in the Borderless Native app and report the Diagnostics line) is still outstanding.
