# Gemini Models & Pricing Reference

## Current Models (April 2026)

### Analysis Models

| Model | Use Case | Input Cost | Output Cost | Context |
|-------|----------|-----------|-------------|---------|
| `gemini-2.5-flash` | Default for all analysis | $0.30/1M tokens | $2.50/1M tokens | 1M tokens |
| `gemini-2.5-flash-lite` | Speed/cost optimized | $0.10/1M tokens | $0.40/1M tokens | 1M tokens |
| `gemini-3.1-pro-preview` | Advanced reasoning, agentic | $2.00/1M tokens | $12.00/1M tokens | 1M tokens |

### Generation Models

| Model | Use Case | Cost | Notes |
|-------|----------|------|-------|
| `gemini-3.1-flash-image-preview` | Image gen (Nano Banana 2, **default**) | ~$0.04/image | Fast, text-in-image support |
| `veo-3.1-generate-preview` | Video generation (8s clips) | $0.15-0.40/sec | Requires billing |

## Token Costs by Modality

| Modality | Tokens per Unit |
|----------|----------------|
| Image | ~258 tokens per image |
| Video | ~263 tokens per second (default) / ~100 (low-res) |
| Audio | ~32 tokens per second |
| PDF | ~258 tokens per page |
| Text | ~1 token per 4 characters |

## Size Limits

| Input Method | Max Size |
|-------------|----------|
| Inline (in request) | 20 MB |
| File API (uploaded) | 2 GB |

## Free Tier Limits

- 15 requests per minute (RPM)
- 1M-4M tokens per minute (TPM) depending on model
- 1,500 requests per day (RPD)
- Image/video generation: NO free tier

## Model Selection Guide

- **Simple image analysis** → `gemini-2.5-flash` (cheapest, fast)
- **Complex visual reasoning** → `gemini-3.1-pro-preview` (highest quality)
- **Audio transcription** → `gemini-2.5-flash` (handles 9.5h audio)
- **PDF extraction** → `gemini-2.5-flash` (handles 1000 pages)
- **Image generation** → `gemini-3.1-flash-image-preview` (Nano Banana 2 — fast, text support)
- **Video generation** → `veo-3.1-generate-preview` (8s clips with audio)

Sources:
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- Pricing verified 2026-04-12

> Warning: `gemini-3.1-*` and `veo-3.1-*` are preview model IDs. Preview IDs are renamed or retired on short notice. Verify current IDs at https://ai.google.dev/gemini-api/docs/models before deploying to production.
