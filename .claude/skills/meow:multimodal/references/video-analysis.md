# Video Analysis Reference

## Resolution Modes

| Mode | Tokens/sec | When to Use |
|------|-----------|-------------|
| `default` | ~263 | Scene detail, OCR, object detection |
| `low-res` | ~100 | Content summary, speaker ID, audio focus |

**Savings:** 62% token reduction with low-res. Use for audio-focused tasks.

## Cost Math (gemini-2.5-flash, input tokens only)

| Video Length | Default Cost | Low-Res Cost | Savings |
|-------------|-------------|-------------|---------|
| 1 minute | $0.0047 | $0.0018 | $0.0029 |
| 10 minutes | $0.047 | $0.018 | $0.029 |
| 1 hour | $0.284 | $0.108 | $0.176 |
| 4 hours | $1.14 | $0.43 | $0.71 |

Formula: `duration_sec * tokens_per_sec / 1M * $0.30` (input price as of 2026-04-12)

**Note:** Output tokens (the analysis text) are billed separately at $2.50/1M for gemini-2.5-flash and typically dwarf input cost on long-form transcription tasks.

## Long Video Strategy

- **<5 min:** Process directly (default resolution)
- **5-30 min:** Use low-res unless visual detail matters
- **>30 min:** Split into segments, process key segments only
- **>1 hour:** Extract keyframes or audio-only; full video analysis is expensive

## CLI Examples

```bash
# Standard analysis
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files video.mp4 --task analyze --verbose

# Cost-optimized (low-res)
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files video.mp4 --task analyze --resolution low-res --verbose

# Transcription (low-res sufficient — audio quality unchanged)
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files video.mp4 --task transcribe --resolution low-res
```

## Gotchas

- Audio transcription >15 min: Gemini truncates silently. Split first.
- Default resolution on long videos: token cost can exceed $100 unexpectedly
- Always use `--verbose` for cost estimation before processing expensive videos
- File API required for >20MB videos (handled automatically by script)
