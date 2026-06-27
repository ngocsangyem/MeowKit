---
name: mk:html-video
description: Render an HTML/CSS/JS template to a local MP4 video by capturing frames with headless Chromium (via Playwright) and encoding them with ffmpeg. Use when "render my animation as a video", "export HTML to MP4", "make a video from my web template", or "capture CSS animation as MP4". NOT for recording live browser interactions (use `agent-browser record start`); NOT for screen recording; NOT for AI video generation (use mk:multimodal).
keywords:
  - html-to-video
  - mp4-export
  - animation-render
  - css-animation
  - playwright-capture
  - ffmpeg-encode
  - frame-capture
  - html-canvas
when_to_use: Use to render a local HTML/CSS/JS file to an MP4 by capturing frames with Playwright and encoding with ffmpeg. NOT for live browser recording (agent-browser record) or AI video generation (mk:multimodal).
user-invocable: true
owner: utility
criticality: low
status: active
runtime: claude-code
requires_external_service: ["playwright", "ffmpeg"]
default_enabled: false
allowed-tools:
  - Bash
  - Read
  - Write
---

# HTML → MP4 Render Pipeline

Converts a local HTML/CSS/JS file into an MP4 video by:
1. Writing a Playwright capture script
2. Capturing PNG frames (headless Chromium) at a specified frame rate
3. Encoding the frames to MP4 with ffmpeg

## Prerequisites

```bash
# Check dependencies
ffmpeg -version 2>&1 | head -1            # Must be installed
npx playwright --version 2>/dev/null      # Or: node -e "require('@playwright/test')"

# Install Playwright Chromium if missing
npx playwright install chromium
```

If ffmpeg is not installed:
- macOS: `brew install ffmpeg`
- Linux: `apt install ffmpeg` / `dnf install ffmpeg`

## HTML Template Contract

The template must expose an optional JS hook so the capture script can step through frames:

```javascript
// In your HTML <script> block — optional but required for JS-driven animations
window.onFrame = function(frameIndex, totalFrames) {
  // Advance animation to this frame's position
  // e.g. set CSS custom property, GSAP seek, requestAnimationFrame position
  const t = frameIndex / totalFrames;
  document.documentElement.style.setProperty('--progress', t);
};
```

If `window.onFrame` is absent, the capture script uses `setTimeout` delays between frames
(suitable for CSS animations playing at natural speed).

## Usage

```bash
# Render a 5-second animation at 30 fps, 1920×1080
npx mk:html-video render template.html output.mp4

# Custom parameters
npx mk:html-video render template.html output.mp4 \
  --fps 60 \
  --duration 10 \
  --width 1280 \
  --height 720

# With a background colour (for templates with transparent backgrounds)
npx mk:html-video render template.html output.mp4 --background "#000000"
```

> `mk:html-video` is a skill, not an npm package. Run the workflow steps below directly.

## Step-by-Step Workflow

### Step 1 — Write the capture script

Write this to a temporary file (e.g. `/tmp/mk-html-video-capture.mjs`):

```javascript
// Playwright frame-capture script for mk:html-video
// Usage: node capture.mjs <htmlFile> <frameDir> <fps> <durationSecs> <width> <height> [bgColor]

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const [,, htmlFile, frameDir, fps, duration, width, height, bgColor] = process.argv;

const totalFrames = Math.ceil(Number(fps) * Number(duration));
const absHtml = path.resolve(htmlFile);

fs.mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setViewportSize({
  width: Number(width) || 1920,
  height: Number(height) || 1080,
});

if (bgColor) {
  await page.addStyleTag({ content: `body { background: ${bgColor} !important; }` });
}

await page.goto(`file://${absHtml}`, { waitUntil: 'networkidle' });

// Allow CSS animations to settle
await page.waitForTimeout(200);

const hasFrameHook = await page.evaluate(() => typeof window.onFrame === 'function');

for (let i = 0; i < totalFrames; i++) {
  if (hasFrameHook) {
    await page.evaluate(
      ({ fi, total }) => window.onFrame(fi, total),
      { fi: i, total: totalFrames }
    );
  } else {
    // No hook: let natural CSS time elapse between captures
    await page.waitForTimeout(1000 / Number(fps));
  }

  const pad = String(i).padStart(6, '0');
  await page.screenshot({
    path: path.join(frameDir, `frame_${pad}.png`),
    type: 'png',
  });

  if (i % 30 === 0) process.stderr.write(`  frame ${i}/${totalFrames}\n`);
}

await browser.close();
process.stderr.write(`Captured ${totalFrames} frames to ${frameDir}\n`);
```

### Step 2 — Capture frames

```bash
HTML_FILE="template.html"
OUTPUT="output.mp4"
FPS=30
DURATION=5
WIDTH=1920
HEIGHT=1080
FRAME_DIR="/tmp/mk-html-video-frames-$$"

node /tmp/mk-html-video-capture.mjs \
  "$HTML_FILE" "$FRAME_DIR" "$FPS" "$DURATION" "$WIDTH" "$HEIGHT"
```

### Step 3 — Encode to MP4

```bash
ffmpeg -y \
  -r "$FPS" \
  -i "$FRAME_DIR/frame_%06d.png" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -preset medium \
  -crf 18 \
  "$OUTPUT"

# Verify output
ffprobe -v quiet -print_format json -show_format -show_streams "$OUTPUT" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['format']['duration'],'s')"
```

### Step 4 — Clean up

```bash
rm -rf "$FRAME_DIR"
echo "Done: $OUTPUT"
```

## Complete One-Shot Script

```bash
#!/usr/bin/env bash
set -euo pipefail

HTML_FILE="${1:-template.html}"
OUTPUT="${2:-output.mp4}"
FPS="${3:-30}"
DURATION="${4:-5}"
WIDTH="${5:-1920}"
HEIGHT="${6:-1080}"
FRAME_DIR="/tmp/mk-html-video-$$"

# Write capture script
cat > /tmp/mk-html-video-capture.mjs << 'JSEOF'
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
const [,, htmlFile, frameDir, fps, duration, width, height] = process.argv;
const totalFrames = Math.ceil(Number(fps) * Number(duration));
fs.mkdirSync(frameDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: Number(width)||1920, height: Number(height)||1080 });
await page.goto(`file://${path.resolve(htmlFile)}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
const hasHook = await page.evaluate(() => typeof window.onFrame === 'function');
for (let i = 0; i < totalFrames; i++) {
  if (hasHook) await page.evaluate(({fi,t}) => window.onFrame(fi,t), {fi:i,t:totalFrames});
  else await page.waitForTimeout(1000/Number(fps));
  await page.screenshot({ path: path.join(frameDir,`frame_${String(i).padStart(6,'0')}.png`) });
}
await browser.close();
JSEOF

node /tmp/mk-html-video-capture.mjs \
  "$HTML_FILE" "$FRAME_DIR" "$FPS" "$DURATION" "$WIDTH" "$HEIGHT"

ffmpeg -y -r "$FPS" \
  -i "$FRAME_DIR/frame_%06d.png" \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 \
  "$OUTPUT"

rm -rf "$FRAME_DIR" /tmp/mk-html-video-capture.mjs
echo "Output: $OUTPUT"
```

## Canvas / WebGL Templates

For `<canvas>` or WebGL animations, the same approach works. Ensure the template
exposes `window.onFrame(i, total)` to seek the animation state. If the animation uses
`requestAnimationFrame` internally, pause it and advance manually:

```javascript
// Example: GSAP-based template
import gsap from 'gsap';
const tl = gsap.timeline({ paused: true });

window.onFrame = (i, total) => {
  tl.progress(i / total);
};
```

## Gotchas

- **`@playwright/test` must be importable as ESM**: The capture script uses ES modules
  (`import`). Run with Node.js 18+ and ensure `@playwright/test` is installed in the
  working directory (`npm install --no-save @playwright/test` or install globally). If
  `@playwright/test` is missing, install with `npx playwright install`.
- **CSS animations play at real time without `window.onFrame`**: Without the hook, the
  script inserts real `waitForTimeout` delays between frames. A 30-fps, 10-second video
  takes ~10 actual seconds to capture. For fast renders, implement `window.onFrame`.
- **`file://` URL restrictions**: Some HTML templates load external resources via relative
  paths. If images or fonts are missing, serve the template locally instead:
  `npx serve . --port 8080` and use `http://localhost:8080/template.html`.
- **ffmpeg `yuv420p` requirement**: Some players (QuickTime, Windows Media Player) require
  `yuv420p` pixel format. Always include `-pix_fmt yuv420p` even if quality looks identical
  without it.
- **Frame directory cleanup on failure**: If the script fails mid-capture, the temp frame
  directory is left on disk. Check `/tmp/mk-html-video-*` and remove manually.
- **Odd-dimension mp4 error**: libx264 requires width and height divisible by 2. If viewport
  dimensions are odd, ffmpeg errors with `width not divisible by 2`. Use even numbers only.
- **Headless Chrome security flags for `file://`**: Chromium may block some resources loaded
  from `file://` origins (CORS). Pass `--allow-file-access-from-files` via Playwright
  `launchOptions.args` in the capture script if cross-origin file resources are needed.
