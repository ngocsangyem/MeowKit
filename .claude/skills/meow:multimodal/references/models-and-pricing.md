# Gemini Models & Pricing Reference

## Current Models (March 2026)

### Analysis Models

| Model | Use Case | Input Cost | Output Cost | Context |
|-------|----------|-----------|-------------|---------|
| `gemini-2.5-flash` | Default for all analysis | $0.15/1M tokens | $0.60/1M tokens | 1M tokens |
| `gemini-2.5-pro` | Advanced reasoning | $1.25/1M tokens | $10.00/1M tokens | 1M tokens |
| `gemini-2.5-flash-lite` | Speed/cost optimized | $0.075/1M tokens | $0.30/1M tokens | 1M tokens |
| `gemini-3-pro-preview` | Latest, agentic | $2.00/1M (< 200k) | $12.00/1M tokens | 1M tokens |

### Generation Models

| Model | Use Case | Cost | Notes |
|-------|----------|------|-------|
| `imagen-4.0-generate-001` | Image generation (standard) | ~$0.02/image | Requires billing |
| `imagen-4.0-ultra-generate-001` | Image generation (quality) | ~$0.04/image | Requires billing |
| `imagen-4.0-fast-generate-001` | Image generation (speed) | ~$0.01/image | Requires billing |
| `gemini-2.5-flash-image` | Image gen (Nano Banana Flash) | ~$1/1M tokens | Requires billing |
| `veo-3.1-generate-preview` | Video generation (8s clips) | Preview pricing | Requires billing |

## Deprecation Schedule

- Gemini 2.0 Flash: retiring June 1, 2026
- Gemini 2.0 Flash-Lite: retiring June 1, 2026

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
- **Complex visual reasoning** → `gemini-2.5-pro` (highest quality)
- **Audio transcription** → `gemini-2.5-flash` (handles 9.5h audio)
- **PDF extraction** → `gemini-2.5-flash` (handles 1000 pages)
- **Image generation** → `imagen-4.0-generate-001` (production quality)
- **Quick image gen** → `gemini-2.5-flash-image` (Nano Banana, fast)
- **Video generation** → `veo-3.1-generate-preview` (8s clips with audio)

Sources:
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API Pricing](https://ai.google.dev/pricing)
