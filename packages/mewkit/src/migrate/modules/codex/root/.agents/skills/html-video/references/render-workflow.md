# Render Workflow

## Prerequisites

```bash
ffmpeg -version 2>&1 | head -1
npx playwright --version 2>/dev/null
npm install --no-save @playwright/test
```

Install Playwright Chromium when it is missing:

```bash
npx playwright install chromium
```

If ffmpeg is missing, install it with `brew install ffmpeg` on macOS or your Linux package manager (`apt install ffmpeg` or `dnf install ffmpeg`).

## Capture frames

```bash
HTML_FILE="template.html"
OUTPUT="output.mp4"
FPS=30
DURATION=5
WIDTH=1920
HEIGHT=1080
FRAME_DIR="/tmp/mk-html-video-frames-$$"

node .agents/skills/html-video/scripts/capture-frames.mjs \
  "$HTML_FILE" "$FRAME_DIR" "$FPS" "$DURATION" "$WIDTH" "$HEIGHT"
```

Pass an optional background colour after height when the template needs one. The capture helper uses `window.onFrame` when available; otherwise it waits `1000 / fps` milliseconds between frames.

## Encode and verify

```bash
ffmpeg -y \
  -r "$FPS" \
  -i "$FRAME_DIR/frame_%06d.png" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -preset medium \
  -crf 18 \
  "$OUTPUT"

ffprobe -v quiet -print_format json -show_format -show_streams "$OUTPUT" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['format']['duration'],'s')"
```

Remove the frame directory when using the capture helper directly. `scripts/render-html-to-mp4.sh` cleans it automatically, including on failure.
