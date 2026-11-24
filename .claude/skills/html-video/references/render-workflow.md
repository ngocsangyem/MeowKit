# Render Workflow

## Prerequisites

```bash
ffmpeg -version 2>&1 | head -1
npx playwright --version 2>/dev/null
```

Ask the user before installing anything. If `@playwright/test` cannot be resolved, install it in the working directory (`npm install --no-save @playwright/test`); install Chromium when it is missing:

```bash
npx playwright install chromium
```

If ffmpeg is missing, install it with `brew install ffmpeg` on macOS or your Linux package manager (`apt install ffmpeg` or `dnf install ffmpeg`).

## Render

Run the bundled renderer from this skill's directory (the skill's `SKILL.md` gives the full path); it captures frames, encodes H.264 with `yuv420p`, and cleans its temporary directory, including on failure:

```bash
bash scripts/render-html-to-mp4.sh template.html output.mp4 30 5 1920 1080
```

The manual two-step (`scripts/capture-frames.mjs`, then `ffmpeg -framerate <fps> -i <frames>/frame_%06d.png -c:v libx264 -pix_fmt yuv420p`) is only for debugging a capture. The capture helper uses `window.onFrame` when available; otherwise it waits `1000 / fps` milliseconds between frames.

## Verify

```bash
ffprobe -v quiet -print_format json -show_format -show_streams output.mp4 \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['format']['duration'],'s')"
```

Remove the frame directory when using the capture helper directly. `scripts/render-html-to-mp4.sh` cleans it automatically, including on failure.
