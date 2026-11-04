# Borderless product direction

<!-- impeccable:product-schema 1 -->

## Platform

web

The current compatibility interfaces use web technology. The target is the original native architecture: Go room hub, Rust shared system core and C#/.NET/Godot Wall, with Swift Mac and Windows-specific OS adapters. The web Portal remains part of this one product. Native libraries introduced in this revision are foundations, not proof of complete display extension. See docs/NATIVE_ARCHITECTURE.md and docs/PRD.md v2 before building.

## Users

People working together in the same physical room: collaborators, meeting leaders, teachers/students and display operators. They bring their own Mac, PC, phone or tablet and contribute to a shared display while keeping their personal work available.

## Product purpose

Make personal devices feel connected to one shared spatial workspace. A person should be able to bring a live window into the room, send a file with a deliberate gesture, arrange contributions alongside other people's work, and retain clear ownership and control.

## Confirmed direction · 3 November 2026

The user rejected the dashboard composition as significantly missing the mark, especially its fixed panels and lost screen space. They then reviewed two interactive examples: another person's live window arriving on the room display, and that live window appearing beside their own work on a Mac, with a phone flicking a file into the shared space.

Their instruction was: “yes this is abetter direction” and “write this into our direction so that we dont drift”. They will decide whether it is exactly right once this direction has been completed. This is approval to pursue the experience, not final acceptance of its finished visuals or implementation.

The durable commitments are:

- The shared content occupies the workspace. Fixed navigation, permanent people/settings panels, large header/footer areas and duplicated commands must not take priority over it.
- Files, notes and live screens act as independent movable, resizable windows or objects. Live screens participate in the workspace rather than sitting in a fixed video strip.
- Room tools appear when needed as floating, movable, dismissible windows. Their placement is a personal preference; moving a tool must not resize or rearrange everyone else's shared content.
- A live window can be brought onto the room display, or into a participant's own desktop workspace beside their local work. Sharing/viewing is deliberate and consented; input control is a separate capability and must not be silently implied.
- A phone can flick/swipe a selected file into the space, with a visible destination, travel/arrival feedback and confirmed receipt. Keep an explicit Send alternative.
- Moving a real desktop window across a screen edge remains part of the original vision. A decorative edge cue or ordinary upload does not fulfil native window/display handoff.

## Operating context

One product with connected Wall, Portal and leader controls, all using the same authoritative room and ownership model. The visible experience should feel like working in a shared space. Administration supports that activity and stays out of its way.

## Capabilities and constraints

The existing local hub provides sessions/roles, file transfer/storage, notes, shared ink, classroom approval, quizzes, screen capture/signalling, audit and recovery. Technical checks are evidence for the specific tested behaviours, not proof that the user accepts the product experience.

The interaction examples are explanatory simulations. They do not prove native personal-desktop patching, remote input, virtual display drivers, physical phone gestures or cross-machine screen delivery. The implementation must turn the direction into actual connected behaviour and label any remaining limits honestly.

Keep server authority, room boundaries, current ownership, capture consent/stop, unsent drafts and existing room data through the redesign. Do not solve a visual problem by dropping working workflows or creating a disconnected demo app.

## Brand commitments

The name is Borderless. Use British English. No new product name, marketing claims or final colour/type direction has been approved by this feedback. Existing themes and assets are implementation foundations, not a reason to retain the rejected dashboard composition.

## Evidence on hand

- docs/source/2026-11-03-original-conversation.md: preserved historical vision, including desktop edge transfer and phone flicks; exact checksum is checked by npm run verify.
- docs/PRD.md: complete requirements and user flows.
- docs/DELIVERY.md and docs/CAPABILITIES.md: outstanding work and implementation/evidence limits.
- The user's review in this chat: rejection of fixed-panel dashboard, followed by endorsement of the illustrated spatial direction pending review of the completed experience.

## Product principles

1. Shared work leads; controls recede.
2. Keep the connection between source device, gesture and destination visible.
3. Treat files and live windows as spatial content, with predictable ownership and lifetimes.
4. Complete the connected experience before expanding peripheral platform features.
5. Judge success by real use and user review as well as technical verification.

## Accessibility and inclusion

Provide keyboard movement/focus controls, an explicit alternative to gestures, visible capture stop and reduced-motion support. Floating controls must remain reachable at small sizes and browser zoom. Never use an animation as proof that a transfer succeeded.
