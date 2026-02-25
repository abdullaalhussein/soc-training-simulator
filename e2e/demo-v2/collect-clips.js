#!/usr/bin/env node

/**
 * collect-clips.js
 *
 * Gathers recorded .webm clips from Playwright test-results/ and converts
 * them to H.264 MP4 for optimal Remotion rendering performance.
 * All clips are converted at full 1920x1080 resolution (top/bottom split layout).
 *
 * Usage:
 *   node e2e/demo-v2/collect-clips.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const TEST_RESULTS = path.join(ROOT, 'test-results');
const CLIPS_DIR = path.join(ROOT, 'video', 'public', 'clips');

// Expected clip mapping: directory pattern → output filename
const CLIP_MAP = [
  { pattern: /Act-1.*Admin|00-admin/i, output: 'act1-admin' },
  { pattern: /Act-2.*Trainer|01-trainer/i, output: 'act2-trainer' },
  { pattern: /Act-3.*Trainee|02-trainee/i, output: 'act3-trainee' },
  { pattern: /split-trainer/i, output: 'act4-split-trainer' },
  { pattern: /split-trainee/i, output: 'act4-split-trainee' },
];

function findWebmFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findWebmFiles(fullPath));
    } else if (entry.name.endsWith('.webm')) {
      results.push(fullPath);
    }
  }
  return results;
}

function hasFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function convertToMp4(webmPath, mp4Path) {
  console.log(`  Converting to MP4: ${path.basename(mp4Path)}`);
  execSync(
    `ffmpeg -y -i "${webmPath}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p "${mp4Path}"`,
    { stdio: 'inherit' }
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Collecting demo-v2 clips...\n');

// Ensure output directory exists
fs.mkdirSync(CLIPS_DIR, { recursive: true });

const allWebm = findWebmFiles(TEST_RESULTS);
console.log(`Found ${allWebm.length} .webm file(s) in test-results/\n`);

const canConvert = hasFFmpeg();
if (!canConvert) {
  console.log('ERROR: ffmpeg is required for MP4 conversion.');
  console.log('Install ffmpeg and re-run this script.\n');
  console.log('Falling back to raw .webm copies (slower Remotion rendering).\n');
}

let copied = 0;

for (const clip of CLIP_MAP) {
  // Find matching webm file
  const match = allWebm.find((f) => clip.pattern.test(f));

  if (!match) {
    console.log(`  SKIP: No match for ${clip.output} (pattern: ${clip.pattern})`);
    continue;
  }

  const destMp4 = path.join(CLIPS_DIR, `${clip.output}.mp4`);

  if (canConvert) {
    try {
      convertToMp4(match, destMp4);
    } catch (err) {
      console.log(`  WARN: MP4 conversion failed for ${clip.output}: ${err.message}`);
      // Fallback: copy raw webm
      const destWebm = path.join(CLIPS_DIR, `${clip.output}.webm`);
      fs.copyFileSync(match, destWebm);
      console.log(`  FALLBACK: Copied raw .webm for ${clip.output}`);
    }
  } else {
    // No ffmpeg — copy raw webm as fallback
    const destWebm = path.join(CLIPS_DIR, `${clip.output}.webm`);
    fs.copyFileSync(match, destWebm);
    console.log(`  COPY: ${path.relative(ROOT, match)} → clips/${clip.output}.webm`);
  }

  copied++;
}

console.log(`\nDone. ${copied}/${CLIP_MAP.length} clips collected to video/public/clips/`);

if (copied < CLIP_MAP.length) {
  console.log('\nMissing clips? Make sure all 4 demo-v2 specs ran successfully:');
  console.log('  npx playwright test --project=demo-v2 --headed');
}
