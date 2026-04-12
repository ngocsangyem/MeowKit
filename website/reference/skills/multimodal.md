---
title: "meow:multimodal"
description: "Multi-provider media analysis and generation via Gemini, MiniMax, and OpenRouter with intelligent fallback."
---

# meow:multimodal

Multi-provider media processing: analyze images/video/audio/PDFs, generate images/videos/speech/music, convert documents to Markdown. Intelligent provider fallback (Gemini → MiniMax → OpenRouter), all configurable via `.env`.

## What This Skill Does

Claude can't natively process binary media files. `meow:multimodal` bridges this gap with Python scripts that call Gemini and MiniMax APIs. Provider routing is automatic — set API keys, the router picks the best available. TTS and music generation are MiniMax-exclusive capabilities.

## Core Capabilities

- **Analysis** — screenshot description, audio transcription, video scene detection, PDF extraction, OCR
- **Image generation** — Nano Banana 2 (Gemini), image-01 (MiniMax), Flux (OpenRouter)
- **Video generation** — Veo 3.1 (Gemini), Hailuo 2.3 (MiniMax)
- **Text-to-Speech** — MiniMax speech-2.8 (332 voices, 24 languages)
- **Music generation** — MiniMax music-2.6 (lyrics + prompt)
- **Document conversion** — PDF/DOCX/images → clean Markdown with batch mode
- **Provider resilience** — auto-fallback chain, API key rotation, cost estimation
- **Structured output** — JSON-shaped analysis (~50% more token-efficient)

::: warning API Keys Required
- **Gemini:** `MEOWKIT_GEMINI_API_KEY` (or legacy `GEMINI_API_KEY`) — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **MiniMax (optional):** `MEOWKIT_MINIMAX_API_KEY` — [platform.minimax.io](https://platform.minimax.io/)
- **OpenRouter (optional):** `MEOWKIT_OPENROUTER_API_KEY` + `MEOWKIT_OPENROUTER_FALLBACK_ENABLED=true`
:::

## Provider Router

Auto-selects best available provider based on API keys in `.env`:

| Task | Default Chain | Override Env Var |
|------|--------------|-----------------|
| Image gen | Gemini → MiniMax → OpenRouter | `MEOWKIT_IMAGE_PROVIDER_CHAIN` |
| Video gen | Gemini → MiniMax | `MEOWKIT_VIDEO_PROVIDER_CHAIN` |
| TTS | MiniMax only | `MEOWKIT_SPEECH_PROVIDER_CHAIN` |
| Music | MiniMax only | `MEOWKIT_MUSIC_PROVIDER_CHAIN` |

Force a specific provider: `--provider gemini|minimax|openrouter`

## Cost Optimization

| Feature | Savings | How |
|---------|---------|-----|
| `--resolution low-res` | 62% on video | Reduces tokens from 263/sec to 100/sec |
| Media pre-compression | 10-20% on large files | Auto-compresses >15MB if ffmpeg available |
| API key rotation | 4x throughput | Rotates `MEOWKIT_GEMINI_API_KEY_2/3/4` on rate limits |
| Structured JSON output | ~50% | JSON prompts vs narrative text |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| **API Keys** | | |
| `MEOWKIT_GEMINI_API_KEY` | Yes (for Gemini) | Falls back to `GEMINI_API_KEY` |
| `MEOWKIT_GEMINI_API_KEY_2`, `_3`, `_4` | No | Additional keys for rotation |
| `MEOWKIT_MINIMAX_API_KEY` | Yes (for MiniMax) | Image/video/TTS/music generation |
| `MEOWKIT_OPENROUTER_API_KEY` | No | Image gen fallback |
| `MEOWKIT_OPENROUTER_FALLBACK_ENABLED` | No | Must be `true` to enable |
| **Provider Chains** | | |
| `MEOWKIT_IMAGE_PROVIDER_CHAIN` | No | Default: `gemini,minimax,openrouter` |
| `MEOWKIT_VIDEO_PROVIDER_CHAIN` | No | Default: `gemini,minimax` |
| `MEOWKIT_SPEECH_PROVIDER_CHAIN` | No | Default: `minimax` |
| `MEOWKIT_MUSIC_PROVIDER_CHAIN` | No | Default: `minimax` |
| **Model Overrides** | | |
| `MEOWKIT_IMAGE_GEN_MODEL` | No | Default: `gemini-3.1-flash-image-preview` |
| `MEOWKIT_VIDEO_GEN_MODEL` | No | Default: `veo-3.1-generate-preview` |
| `MEOWKIT_MINIMAX_IMAGE_MODEL` | No | Default: `image-01` |
| `MEOWKIT_MINIMAX_VIDEO_MODEL` | No | Default: `MiniMax-Hailuo-2.3` |
| `MEOWKIT_MINIMAX_SPEECH_MODEL` | No | Default: `speech-2.8-hd` |
| `MEOWKIT_MINIMAX_MUSIC_MODEL` | No | Default: `music-2.6` |
| `MEOWKIT_MINIMAX_SPEECH_VOICE` | No | Default: `Wise_Woman` |

## Gotchas

- **Audio >15 min**: Gemini truncates silently. Split into chunks first.
- **PDF >100 pages**: Quality degrades. Process in 20-page chunks.
- **Video cost**: ~263 tokens/sec at default resolution. Use `--verbose` for cost estimate.
- **Image gen requires billing**: Free tier = no gen. MiniMax/OpenRouter as fallback.
- **MiniMax video timeout**: Hailuo takes 60-180s. Max 600s poll timeout.
- **TTS voices**: 332 system voices across 24 languages. Default: `Wise_Woman`.
- **Text in images**: Nano Banana 2 supports text rendering in images.
- **Temperature**: Keep Gemini at 1.0. Lowering causes degraded output.

::: info Skill Details
**Phase:** any · **Version:** 2.3.8
:::

## Related

- [`meow:docs-finder`](/reference/skills/docs-finder) — For text-based documentation
- [`meow:qa-manual`](/reference/skills/qa-manual) — Uses browser screenshots for visual QA
