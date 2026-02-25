// Video specs
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 3600; // 2 minutes

// Colors — from app dark theme
export const COLORS = {
  darkBg: "#080d1a",
  primaryText: "#f0f4f8",
  mutedText: "#8b9dc3",
  cyanAccent: "#00e5ff",
  greenAccent: "#00ff88",
  overlayStart: "rgba(8, 13, 26, 0.75)",
  overlayEnd: "rgba(8, 13, 26, 0.55)",
} as const;

// Scene timing (frame ranges)
export const SCENES = [
  { id: 1, from: 0, duration: 450 },
  { id: 2, from: 450, duration: 450 },
  { id: 3, from: 900, duration: 600 },
  { id: 4, from: 1500, duration: 750 },
  { id: 5, from: 2250, duration: 600 },
  { id: 6, from: 2850, duration: 450 },
  { id: 7, from: 3300, duration: 300 },
] as const;

// Screenshot paths (relative to public/)
export const SCREENSHOTS = {
  landing: "/screenshots/00-landing-hero.png",
  trainer: "/screenshots/05-trainer-console.png",
  dashboard: "/screenshots/07-trainee-dashboard-dark.png",
  investigation: "/screenshots/09-trainee-investigation.png",
  scenarios: "/screenshots/03-admin-scenarios-dark.png",
} as const;

// Animation constants
export const FADE_FRAMES = 20;
export const STAGGER_DELAY = 8;

// ---------------------------------------------------------------------------
// Demo V2 — Video clip composition (3:30 = 210s = 6300 frames)
// ---------------------------------------------------------------------------

export const TOTAL_FRAMES_V2 = 6300;

// Clip paths (relative to public/) — populated by collect-clips.js
export const CLIPS_V2 = {
  admin: "/clips/act1-admin.webm",
  trainer: "/clips/act2-trainer.webm",
  trainee: "/clips/act3-trainee.webm",
  splitTrainer: "/clips/act4-split-trainer.webm",
  splitTrainee: "/clips/act4-split-trainee.webm",
} as const;

// Scene timing for V2 (frame ranges)
export const SCENES_V2 = {
  // Opening title card — 4.0s
  intro:       { from: 0,    duration: 120 },
  // ACT 1 title — 2.5s
  act1Title:   { from: 120,  duration: 75 },
  // ACT 1 content (admin clip) — 35.0s
  act1Content: { from: 195,  duration: 1050 },
  // ACT 2 title — 2.5s
  act2Title:   { from: 1245, duration: 75 },
  // ACT 2 content (trainer clip) — 40.0s
  act2Content: { from: 1320, duration: 1200 },
  // ACT 3 title — 2.5s
  act3Title:   { from: 2520, duration: 75 },
  // ACT 3 content (trainee clip) — 80.0s
  act3Content: { from: 2595, duration: 2400 },
  // ACT 4 title — 2.5s
  act4Title:   { from: 4995, duration: 75 },
  // ACT 4 content (split-screen) — 35.0s
  act4Content: { from: 5070, duration: 1050 },
  // Closing card — 6.0s
  outro:       { from: 6120, duration: 180 },
} as const;
