#!/usr/bin/env bash
set -euo pipefail

HTML_FILE="${1:-template.html}"
OUTPUT="${2:-output.mp4}"
FPS="${3:-30}"
DURATION="${4:-5}"
WIDTH="${5:-1920}"
HEIGHT="${6:-1080}"
BACKGROUND="${7:-}"
FRAME_DIR="${TMPDIR:-/tmp}/mk-html-video-$$"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  rm -rf -- "$FRAME_DIR"
}
trap cleanup EXIT

node "$SCRIPT_DIR/capture-frames.mjs" \
  "$HTML_FILE" "$FRAME_DIR" "$FPS" "$DURATION" "$WIDTH" "$HEIGHT" "$BACKGROUND"

ffmpeg -y -r "$FPS" -i "$FRAME_DIR/frame_%06d.png" \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 "$OUTPUT"

echo "Output: $OUTPUT"
