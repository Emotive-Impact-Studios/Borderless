// Borderless design tokens: the single source of truth.
// `npm run build` turns this into CSS (Wall, Console, web Portal), TypeScript (React Native phone apps)
// and Swift (Mac app). Edit here only; never edit dist/ by hand.
//
// Language: "Glass" (Apple Liquid Glass and visionOS). Content windows carry no chrome; who and what float
// in a glass ornament beneath. Owner colour glows on arrival and while live. Looks (themes) swap colour,
// material and display type, never structure.

export const meta = { name: 'Borderless', version: '0.1.0', language: 'glass' };

// Spacing: 4 px grid, 8 px rhythm. Wall values scale with --bl-wall-scale (1 at 1080p, 2 at 4K).
export const space = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 24, 7: 32, 8: 48, 9: 64, 10: 96 };

// Corner radii. Nest concentrically: inner radius = outer radius - padding.
export const radius = { xs: 6, sm: 10, md: 14, lg: 22, xl: 28, window: 24, capsule: 999 };

export const font = {
  sans: '"SF Pro Text", "SF Pro", -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  display: '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, "Inter Display", "Inter", "Segoe UI Variable Display", system-ui, sans-serif',
  rounded: '"SF Pro Rounded", "SF Pro", -apple-system, "Inter", system-ui, sans-serif',
  mono: '"SF Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
};

// Type ramps follow Apple's text styles. [size, lineHeight, weight, tracking(em)]
// Portal: phones and laptops at arm's length. Wall: 1080p at 3 m (multiply by --bl-wall-scale for 4K).
export const type = {
  portal: {
    caption: [12, 16, 500, 0], footnote: [13, 18, 400, 0], subhead: [15, 20, 400, -0.005], callout: [16, 21, 400, -0.01],
    body: [17, 22, 400, -0.01], headline: [17, 22, 600, -0.01], title3: [20, 25, 600, -0.015], title2: [22, 28, 700, -0.02],
    title1: [28, 34, 700, -0.022], largeTitle: [34, 41, 700, -0.025],
  },
  wall: {
    label: [18, 22, 600, 0], ornament: [20, 24, 600, -0.005], title: [22, 28, 600, -0.01], body: [28, 36, 500, -0.015],
    heading: [40, 46, 700, -0.02], display: [64, 68, 700, -0.03],
  },
  // Minimums: nothing on the Wall below 18 px at 1080p; Portal touch targets at least 44 px.
  min: { wall: 18, touch: 44 },
};

// Motion. Truthful: departure when bytes leave, arrival only when the hub confirms.
export const motion = {
  duration: { instant: 100, fast: 180, base: 250, slow: 400, travel: 600, arrival: 700, ambient: 2400 },
  easing: {
    standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)', // most UI
    enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)', // things arriving
    exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)', // things leaving
    glide: 'cubic-bezier(0.45, 0, 0.2, 1)', // moving across the Wall
    linear: 'linear', // only progress and continuous spin
  },
  // Springs for native (SwiftUI, Reanimated, Godot): response (s) and damping fraction.
  spring: {
    settle: { response: 0.35, damping: 0.78 }, // landing; about 6 % overshoot
    lift: { response: 0.25, damping: 0.9 }, // focus lift
    snappy: { response: 0.2, damping: 1 }, // toggles, chips
    flick: { response: 0.45, damping: 0.7 }, // card leaving the phone
  },
  // Signature sequences (ms). See docs/MOTION.md.
  signature: {
    edgeArm: 200, edgeCross: [450, 700], edgeLand: 300,
    flickLift: 120, flickTravel: 600, flickLand: 350, ripple: 900,
    sendBack: 550, liveBreath: 2400,
  },
  focusScale: 1.02,
};

// Eight owner colours. Light values pass 4.2:1+ on white, dark values 6:1+ on dark surfaces.
// Colour is never the only cue: every owner also shows an initial and a name.
export const owners = {
  light: { blue: '#0A6FE0', orange: '#C45F00', green: '#1A8050', pink: '#D81B60', purple: '#7646D8', teal: '#007C89', gold: '#946C00', indigo: '#4A55C9' },
  dark: { blue: '#4DA3FF', orange: '#FF9F40', green: '#3DD68C', pink: '#FF6B9A', purple: '#B48CFF', teal: '#3CC8D6', gold: '#F2C744', indigo: '#8C96FF' },
};

// Looks. Each sets colour, material and the display face. Structure never changes.
export const themes = {
  whiteboard: {
    mode: 'light', label: 'Whiteboard', for: 'Default. Meetings, classrooms, hospitals.',
    color: {
      wall: '#F4F5F8', wallWashA: '#E3ECFF', wallWashB: '#FFE9E0', grid: 'rgba(29,29,31,0.07)',
      surface: '#FFFFFF', surfaceRaised: '#FFFFFF', surfaceSunken: '#ECEEF3',
      ink: '#1D1D1F', inkMuted: '#6E6E73', inkFaint: '#AEAEB2', line: 'rgba(0,0,0,0.08)',
      accent: '#0071E3', accentInk: '#FFFFFF', live: '#FF3B30', danger: '#D70015', success: '#1A8050', warning: '#B25000',
      focus: '#0071E3', scrim: 'rgba(0,0,0,0.25)', shadow: '30,40,80',
    },
    glass: { fill: 'rgba(255,255,255,0.55)', stroke: 'rgba(255,255,255,0.55)', highlight: 'rgba(255,255,255,0.95)', blur: 24, saturate: 1.8 },
    displayFont: null,
  },
  studio: {
    mode: 'dark', label: 'Studio', for: 'Creative jams, evening sessions, dark rooms.',
    color: {
      wall: '#0C0D12', wallWashA: '#1D2B55', wallWashB: '#3A1D33', grid: 'rgba(255,255,255,0.06)',
      surface: '#1C1D22', surfaceRaised: '#25262C', surfaceSunken: '#111216',
      ink: '#F2F3F5', inkMuted: '#9A9FAD', inkFaint: '#5D616C', line: 'rgba(255,255,255,0.10)',
      accent: '#4DA3FF', accentInk: '#06101E', live: '#FF453A', danger: '#FF6961', success: '#3DD68C', warning: '#FFB340',
      focus: '#4DA3FF', scrim: 'rgba(0,0,0,0.5)', shadow: '0,0,0',
    },
    glass: { fill: 'rgba(40,42,52,0.55)', stroke: 'rgba(255,255,255,0.12)', highlight: 'rgba(255,255,255,0.18)', blur: 28, saturate: 1.6 },
    displayFont: null,
  },
  executive: {
    mode: 'light', label: 'Executive', for: 'Boardrooms and client presentations.',
    color: {
      wall: '#F6F1E9', wallWashA: '#FFF4E2', wallWashB: '#EFE4D6', grid: 'rgba(80,60,30,0.06)',
      surface: '#FFFFFF', surfaceRaised: '#FFFDF9', surfaceSunken: '#EDE6DA',
      ink: '#1C1712', inkMuted: '#6B6459', inkFaint: '#A79F92', line: 'rgba(80,60,30,0.12)',
      accent: '#8A4B12', accentInk: '#FFFFFF', live: '#C62828', danger: '#B3261E', success: '#2E7D32', warning: '#8A4B12',
      focus: '#8A4B12', scrim: 'rgba(30,20,10,0.3)', shadow: '60,40,10',
    },
    glass: { fill: 'rgba(255,252,246,0.6)', stroke: 'rgba(255,255,255,0.6)', highlight: 'rgba(255,255,255,0.9)', blur: 24, saturate: 1.4 },
    displayFont: '"Playfair Display", "New York", Georgia, serif',
  },
  tactical: {
    mode: 'dark', label: 'Tactical', for: 'Mission control, operations and command rooms.',
    color: {
      wall: '#070A0C', wallWashA: '#0B1A17', wallWashB: '#070A0C', grid: 'rgba(46,230,166,0.07)',
      surface: '#0D1416', surfaceRaised: '#132024', surfaceSunken: '#050809',
      ink: '#D7F5EC', inkMuted: '#7FA79C', inkFaint: '#3F5B54', line: 'rgba(46,230,166,0.22)',
      accent: '#2EE6A6', accentInk: '#03130D', live: '#FF5A5A', danger: '#FF5A5A', success: '#2EE6A6', warning: '#FFB020',
      focus: '#2EE6A6', scrim: 'rgba(0,0,0,0.6)', shadow: '0,0,0',
    },
    glass: { fill: 'rgba(13,24,26,0.7)', stroke: 'rgba(46,230,166,0.25)', highlight: 'rgba(46,230,166,0.12)', blur: 16, saturate: 1.2 },
    displayFont: '"IBM Plex Mono", "SF Mono", ui-monospace, monospace',
    // Tactical borrows the Instrument direction: numbered sources, monospace labels, tighter radii.
    numbered: true, radiusScale: 0.5,
  },
};

// Elevation recipes. {shadow} is replaced with the theme's shadow RGB.
export const elevation = {
  rest: '0 2px 6px rgba({shadow},0.08), 0 24px 48px rgba({shadow},0.12)',
  lifted: '0 4px 10px rgba({shadow},0.10), 0 36px 72px rgba({shadow},0.20)',
  floating: '0 10px 30px rgba({shadow},0.14)',
  ornament: '0 6px 16px rgba({shadow},0.10)',
};
