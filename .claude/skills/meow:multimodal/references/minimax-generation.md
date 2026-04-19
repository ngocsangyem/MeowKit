# MiniMax Generation Reference

## Models

| Task | Model | Speed | Pricing |
|------|-------|-------|---------|
| Image | `image-01` | Fast (2-5s) | ~$0.01/image |
| Video | `MiniMax-Hailuo-2.3` | Slow (60-180s) | $0.017–$0.08/sec |
| Video (fast) | `MiniMax-Hailuo-2.3-Fast` | Medium (30-90s) | $0.017–$0.04/sec |
| TTS | `speech-2.8-hd` | Fast (1-3s) | $0.06/1K chars |
| TTS (fast) | `speech-2.8-turbo` | Faster | $0.03/1K chars |
| Music | `music-2.6` | Medium (10-30s) | ~$0.035/gen |

## Auth

- Env var: `MEOWKIT_MINIMAX_API_KEY`
- Get from: https://platform.minimax.io/
- Base URL: `https://api.minimax.io/v1`

## CLI Examples

```bash
# Image generation
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/minimax_generate.py \
  --task generate-image --prompt "A futuristic city" --verbose

# Video generation (Hailuo — async, 60-180s)
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/minimax_generate.py \
  --task generate-video --prompt "A dancer in the rain" --verbose

# Text-to-Speech
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/minimax_generate.py \
  --task generate-speech --text "Hello, welcome to the project" --voice-id Wise_Woman

# Music generation
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/minimax_generate.py \
  --task generate-music --lyrics "Verse 1: Walking through the morning light..."
```

## TTS Voices

332 system voices across 24 languages. Default: `Wise_Woman`.
Override: `--voice-id` flag or `MEOWKIT_MINIMAX_SPEECH_VOICE` env var.
Full voice list: https://platform.minimax.io/docs/faq/system-voice-id

## Gotchas

- Video is async — 60-180s typical, max 600s timeout
- Image returns base64 (no download step needed)
- Music lyrics max ~500 chars
- Free tier has rate limits (image: 10 RPM)
- All generation requires MiniMax API key (no free tier without key)
