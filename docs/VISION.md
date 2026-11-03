# Borderless: the app we are making

This page comes first. It describes the app the way the original conversation does (`docs/source/2026-11-03-original-conversation.md`). The PRD, architecture and delivery documents exist to build this. Where they seem to point somewhere else, this page wins. Any change to it needs the user's agreement.

## The idea, in the user's words

> "if i was to make software that connects to the mac or pc then it allows you to connect to a massive screen so that if you wanted to drag something from your screen onto it it would be simple like dragging onto the side of the screen and then it does some effect and now you can add the big screen ... and the function works on phone as well" (source line 115, spelling tidied)

The name says the point: Borderless erases the hard borders between your laptop, your phone and the big screen, so they behave as if they were physically connected (source line 13153).

## The moment that matters

1. **Laptop to wall.** You move a window or your mouse to the edge of your laptop screen. The edge glows to show it is connected. The window crosses the border with a dissolve or particle effect on your laptop, the same effect plays in reverse on the big screen, and it looks as if the window travelled through the air. It lands on the wall, live and ready to use (115-167). This is a real window on a real extended display, not a screenshot or an uploaded file.
2. **Phone to wall.** You pick a photo, PDF or file on your phone and flick it up towards the screen. It flies off your phone and lands on the wall as a real, openable window, with an arrival effect at the place you aimed (129, 3253, 4191).
3. **Wall to phone.** Someone at the wall sends a file straight back down to one person's phone (5159, 11743).

If these three do not feel effortless and magical, Borderless is not done, however many other features work.

## Why it is better than screen sharing

Normal meeting software lets one person share, and they take over the whole display. Borderless is inclusive and spatial: the room screen is like a big table where everyone can put their work down at the same time without fighting for control (8595-8597). A colleague can add a spreadsheet next to the presentation without interrupting it (8569-8575).

## Where it is used

- **Meetings:** add supporting work beside whatever is already being presented.
- **Creative jam sessions:** designers, coders and musicians on Macs, Windows laptops, iPhones and Androids all put live windows, snippets and files on one shared board. Everyone can see, arrange and resize everything, and each person's colour shows who added what (8577-8591).
- **Classrooms:** a student circles the answer on the teacher's slide from their seat. Students raise a hand to get permission to draw. The teacher casts a quiz, compares student work side by side, and can remove anyone instantly (11225-11281, 11807-11829).
- **Command rooms:** large video walls across several panels, running the same way, with an audit trail (29-113, 6219-7613).

## One product, three views

One system, like Uber has a rider app, a driver app and an office dashboard (13041-13069):

- **The Wall:** the big screen, looking beautiful, where everything lands.
- **The Portal:** the phone or laptop, which changes to suit what you are doing: send files, point, draw or answer a quiz.
- **The Console:** the leader's controls to arrange the wall, approve requests, run quizzes and clear the board.

## How it should feel

- Arrivals are physical and fun: liquid pull, particle dissolve, ripple waves, holographic grid snapping (761-767, 7641-7649). There is a calm mode too.
- Several looks: a clean, light, Apple-style whiteboard as well as executive, synthwave and tactical styles (10583-10633, 11093, 11283-11297).
- Work fills the screen and tools get out of the way (the user's direction on 3 November, recorded in PRODUCT.md and DESIGN.md).

## Everything else the user asked for

Phones as laser pointers. Drawing on the wall from your seat. Video files that play their sound through the room speakers. Seats mapped so that your work appears on your side of the wall. Several monitors and panoramic walls. Opening files on the host computer. Secure connections. An audit trail. Installers and updates. Themes. Classroom hand raise and quiz. The user's words were "we are building the entire thing" (13259, spelling tidied). None of these is optional or cut. They are built around the core moment, not instead of it.

## Build order

1. Make the three moments above work for real, on real devices: native capture, a real extended display, real flick and arrival, using the Go, Rust and C#/Godot stack the conversation chose (12959).
2. Then layer everything else onto that working core.

## What this page is not

The conversation's code does not run as written, and its "complete" and "production-ready" claims were not true. This page takes the conversation's vision, not its engineering claims. SOURCE_AUDIT.md records which code ideas were kept and which were corrected.
