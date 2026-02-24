/**
 * merge-videos.js — Concatenate trainer + trainee demo videos and burn text overlays.
 *
 * Usage:
 *   node e2e/demo/merge-videos.js
 *
 * Prerequisites:
 *   - ffmpeg and ffprobe on PATH (or installed via WinGet)
 *   - Both demo specs have been run: npx playwright test e2e/demo/ --project=demo --headed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Locate ffmpeg / ffprobe
// ---------------------------------------------------------------------------

const wingetFfmpeg = process.env.LOCALAPPDATA
  ? path.join(
      process.env.LOCALAPPDATA,
      'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin'
    )
  : '';

function findBin(name) {
  // Try WinGet path first (Windows), then fall back to PATH
  if (wingetFfmpeg) {
    const full = path.join(wingetFfmpeg, `${name}.exe`);
    if (fs.existsSync(full)) return `"${full}"`;
  }
  return name; // assume on PATH
}

const ffmpeg = findBin('ffmpeg');
const ffprobe = findBin('ffprobe');

// ---------------------------------------------------------------------------
// Find the two .webm video files from test-results
// ---------------------------------------------------------------------------

const resultsDir = path.resolve('test-results');

function findVideo(pattern) {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`test-results directory not found at ${resultsDir}`);
  }
  const dirs = fs.readdirSync(resultsDir).filter((d) => d.includes(pattern));
  for (const dir of dirs) {
    const videoPath = path.join(resultsDir, dir, 'video.webm');
    if (fs.existsSync(videoPath)) return videoPath;
  }
  throw new Error(`No video found matching "${pattern}" in ${resultsDir}`);
}

const trainerVideo = findVideo('01-trainer');
const traineeVideo = findVideo('02-trainee');

console.log('Trainer video:', trainerVideo);
console.log('Trainee video:', traineeVideo);

// ---------------------------------------------------------------------------
// Get video durations via ffprobe
// ---------------------------------------------------------------------------

function getDuration(videoPath) {
  const cmd = `${ffprobe} -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`;
  const output = execSync(cmd, { encoding: 'utf-8' }).trim();
  return parseFloat(output);
}

const trainerDuration = getDuration(trainerVideo);
const traineeDuration = getDuration(traineeVideo);

console.log(`Trainer duration: ${trainerDuration.toFixed(1)}s`);
console.log(`Trainee duration: ${traineeDuration.toFixed(1)}s`);

// ---------------------------------------------------------------------------
// Build text overlays
// ---------------------------------------------------------------------------

const fontB = os.platform() === 'win32'
  ? 'C\\\\:/Windows/Fonts/segoeuib.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const fontR = os.platform() === 'win32'
  ? 'C\\\\:/Windows/Fonts/segoeui.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

// Scene splits within each video (proportional)
// Trainer: Console ≈ first 45%, Monitor ≈ remaining 55%
// Trainee: Dashboard ≈ 12%, Investigation ≈ 40%, (Checkpoints no overlay) ≈ 13%, SOC Mentor ≈ 15%, Dashboard return + Final ≈ 20%
const t1 = 0;                                          // trainer start
const t1_console_end = Math.round(trainerDuration * 0.45);
const t1_monitor_end = Math.round(trainerDuration);
const t2 = Math.round(trainerDuration);                // trainee start (offset)
const t2_dash_end = t2 + Math.round(traineeDuration * 0.12);
const t2_invest_end = t2 + Math.round(traineeDuration * 0.52);
const t2_mentor_start = t2 + Math.round(traineeDuration * 0.65);
const t2_mentor_end = t2 + Math.round(traineeDuration * 0.80);
const t2_final_start = t2 + Math.round(traineeDuration * 0.90);
const t2_final_end = t2 + Math.round(traineeDuration);

const overlays = [
  // Trainer scenes
  { t: [t1, t1_console_end], title: 'TRAINER CONSOLE', sub: 'Create sessions, assign scenarios, monitor trainees in real-time.' },
  { t: [t1_console_end, t1_monitor_end], title: 'SESSION MONITOR', sub: 'Activity feed, discussion, send hints, broadcast alerts.' },
  // Trainee scenes
  { t: [t2, t2_dash_end], title: 'TRAINEE DASHBOARD', sub: 'Join sessions, track progress, review past attempts.' },
  { t: [t2_dash_end, t2_invest_end], title: 'INVESTIGATION WORKSPACE', sub: 'Search, filter, collect evidence, build your timeline.' },
  { t: [t2_mentor_start, t2_mentor_end], title: 'AI-POWERED SOC MENTOR', sub: 'Context-aware Socratic guidance. Never gives away answers.' },
  // Final card
  { t: [t2_final_start, t2_final_end], title: 'github.com/abdullaalhussein/soc-training-simulator', sub: null },
];

console.log('\nOverlay timestamps:');
for (const o of overlays) {
  console.log(`  ${o.t[0]}s–${o.t[1]}s  ${o.title}`);
}

const filters = [];
for (const o of overlays) {
  const enable = `between(t\\,${o.t[0]}\\,${o.t[1]})`;
  const titleSize = o.sub ? 36 : 28;
  const titleY = o.sub ? 'h-150' : 'h-120';
  filters.push(
    `drawtext=fontfile=${fontB}:text='${o.title}':fontsize=${titleSize}:fontcolor=white:x=(w-text_w)/2:y=${titleY}:enable='${enable}':box=1:boxcolor=black@0.6:boxborderw=12`
  );
  if (o.sub) {
    filters.push(
      `drawtext=fontfile=${fontR}:text='${o.sub}':fontsize=22:fontcolor=white:x=(w-text_w)/2:y=h-105:enable='${enable}':box=1:boxcolor=black@0.6:boxborderw=8`
    );
  }
}

// ---------------------------------------------------------------------------
// Concatenate + overlay in a single ffmpeg pass
// ---------------------------------------------------------------------------

// Write concat file list
const concatFile = path.join(os.tmpdir(), 'demo-concat.txt');
fs.writeFileSync(
  concatFile,
  `file '${trainerVideo.replace(/\\/g, '/')}'\nfile '${traineeVideo.replace(/\\/g, '/')}'\n`
);

const output = path.resolve('demo.mp4');
const vf = filters.join(',');

const cmd = `${ffmpeg} -y -f concat -safe 0 -i "${concatFile}" -vf "${vf}" -c:v libx264 -preset fast -crf 23 -movflags +faststart "${output}"`;

console.log('\nRunning ffmpeg (concat + overlays)...');
try {
  execSync(cmd, { stdio: 'inherit', windowsHide: false });
  console.log(`\nDone! Output: ${output}`);
  console.log(`Total duration: ~${(trainerDuration + traineeDuration).toFixed(1)}s`);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
} finally {
  // Clean up temp concat file
  try { fs.unlinkSync(concatFile); } catch {}
}
