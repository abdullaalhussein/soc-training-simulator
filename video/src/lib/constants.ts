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
// Demo V2 — Clip paths (populated by collect-clips.js)
// ---------------------------------------------------------------------------

export const CLIPS_V2 = {
  admin: "/clips/act1-admin.mp4",
  trainer: "/clips/act2-trainer.mp4",
  trainee: "/clips/act3-trainee.mp4",
  splitTrainer: "/clips/act4-split-trainer.mp4",
  splitTrainee: "/clips/act4-split-trainee.mp4",
} as const;

// Actual clip durations in frames (V3 — from ffprobe, rounded up)
const CLIP_FRAMES = {
  admin:   726,   // 24.2s
  trainer: 879,   // 29.3s
  trainee: 1260,  // 42.0s
  split:   1362,  // 45.4s (shorter of the two — trainer side)
} as const;

const TITLE_DUR = 60;  // 2s title card
const OUTRO_DUR = 90;  // 3s outro

// ---------------------------------------------------------------------------
// Per-role compositions (title + clip + outro)
// ---------------------------------------------------------------------------

export const ADMIN_COMP = {
  title:   { from: 0, duration: TITLE_DUR },
  clip:    { from: TITLE_DUR, duration: CLIP_FRAMES.admin },
  outro:   { from: TITLE_DUR + CLIP_FRAMES.admin, duration: OUTRO_DUR },
  total:   TITLE_DUR + CLIP_FRAMES.admin + OUTRO_DUR, // 708 = 23.6s
} as const;

export const TRAINER_COMP = {
  title:   { from: 0, duration: TITLE_DUR },
  clip:    { from: TITLE_DUR, duration: CLIP_FRAMES.trainer },
  outro:   { from: TITLE_DUR + CLIP_FRAMES.trainer, duration: OUTRO_DUR },
  total:   TITLE_DUR + CLIP_FRAMES.trainer + OUTRO_DUR, // 1074 = 35.8s
} as const;

export const TRAINEE_COMP = {
  title:   { from: 0, duration: TITLE_DUR },
  clip:    { from: TITLE_DUR, duration: CLIP_FRAMES.trainee },
  outro:   { from: TITLE_DUR + CLIP_FRAMES.trainee, duration: OUTRO_DUR },
  total:   TITLE_DUR + CLIP_FRAMES.trainee + OUTRO_DUR, // 572 = 19.1s
} as const;

// ---------------------------------------------------------------------------
// Combined composition (intro + all clips + split + outro)
// ---------------------------------------------------------------------------

const INTRO_DUR = 90;  // 3s

function buildCombined() {
  let f = 0;
  const intro = { from: f, duration: INTRO_DUR }; f += INTRO_DUR;
  const admin = { from: f, duration: CLIP_FRAMES.admin }; f += CLIP_FRAMES.admin;
  const trainer = { from: f, duration: CLIP_FRAMES.trainer }; f += CLIP_FRAMES.trainer;
  const trainee = { from: f, duration: CLIP_FRAMES.trainee }; f += CLIP_FRAMES.trainee;
  const split = { from: f, duration: CLIP_FRAMES.split }; f += CLIP_FRAMES.split;
  const outro = { from: f, duration: 120 }; f += 120; // 4s outro
  return { intro, admin, trainer, trainee, split, outro, total: f };
}

export const COMBINED_COMP = buildCombined();
// total = 90+726+879+1260+1362+120 = 4437 frames = ~147.9s
