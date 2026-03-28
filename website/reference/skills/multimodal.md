---
title: "meow:multimodal"
description: "Image, video, audio, and document analysis via Gemini API with script-driven processing and context budget management."
---

# meow:multimodal

Image, video, audio, and document analysis via Gemini API with script-driven processing and context budget management.

## What This Skill Does

Claude can't natively process binary media files — images, video, audio, PDFs. `meow:multimodal` bridges this gap by sending files to Google Gemini's multimodal API and returning structured analysis. Python scripts handle the API calls, file uploads, and response parsing. Claude only reviews the final analysis. The skill also supports image generation (Imagen 4) and video generation (Veo 3).

## Core Capabilities

- **Analysis** — Screenshot description, mockup analysis, audio transcription, video scene detection, PDF text extraction, OCR
- **Generation** — Image creation via Imagen 4, video creation via Veo 3.1
- **Smart model selection** — `gemini-2.5-flash` for analysis (cost-effective), `imagen-4.0-generate-001` for images, `veo-3.1-generate-preview` for video
- **Size handling** — Files <20MB inline, >20MB via File API (up to 2GB)
- **Audio splitting guidance** — For transcripts >15 min, recommends splitting to avoid truncation
- **Context budget** — 3000 tokens inline max. Overflow to `.claude/memory/multimodal-cache/`

::: warning Requires GEMINI_API_KEY
This skill requires a Google Gemini API key. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The skill will stop immediately if the key is missing — it never attempts an API call without it.
:::

## When to Use This

::: tip Use meow:multimodal when...
- You need to analyze a screenshot, mockup, or diagram
- You need to transcribe a meeting recording or podcast
- You need to extract text from a PDF or scanned document
- You need to generate an image or video from a description
:::

## Usage

```bash
# Analyze an image
/meow:multimodal screenshot.png analyze

# Transcribe audio
/meow:multimodal meeting.mp3 transcribe

# Extract text from PDF
/meow:multimodal document.pdf extract

# Generate an image
/meow:multimodal --generate "sunset over mountains"
```

## Example Prompts

| Prompt | Model used | Output |
|--------|-----------|--------|
| `analyze this screenshot` + image path | gemini-2.5-flash | Structured description of UI elements |
| `transcribe this meeting` + audio path | gemini-2.5-flash | Timestamped transcript `[HH:MM:SS]` |
| `extract text from this PDF` + PDF path | gemini-2.5-flash | Markdown-formatted content |
| `generate image of a logo` | imagen-4.0-generate-001 | Generated PNG file |

## Quick Workflow

```
File path → API Key Check (STOP if missing)
  → Detect modality (image/video/audio/PDF)
  → Check file size (inline <20MB, File API >20MB)
  → Select model → Execute Python script
  → Budget check (≤3000 tokens inline, else write to cache)
  → Return structured analysis
```

::: info Skill Details
**Phase:** any
:::

## Related

- [`meow:docs-finder`](/reference/skills/docs-finder) — For text-based documentation
- [`meow:qa-manual`](/reference/skills/qa-manual) — Uses browser screenshots for visual QA
