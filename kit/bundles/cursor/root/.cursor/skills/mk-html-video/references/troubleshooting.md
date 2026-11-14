# HTML Video Troubleshooting

- **ESM import missing:** `capture-frames.mjs` imports `@playwright/test`. Use Node.js 18+ and install the package in the working directory when it cannot be resolved. `npx playwright install` installs browser binaries, not the package itself.
- **Natural CSS animation is slow:** without `window.onFrame`, a 30fps, 10-second video captures for about 10 real seconds. Add the hook for deterministic stepping.
- **`file://` resources do not load:** serve the template locally (for example, `npx serve . --port 8080`) and adapt the capture URL. When necessary, add Chromium's `--allow-file-access-from-files` launch argument for cross-origin local resources.
- **Playback incompatibility:** retain `-pix_fmt yuv420p`; QuickTime and Windows Media Player commonly require it.
- **Frames remain after failure:** the bundled renderer traps exit and cleans its temp directory. If a manually run capture fails, remove `/tmp/mk-html-video-*` yourself.
- **libx264 dimension error:** width and height must be divisible by two. Use even viewport values.
