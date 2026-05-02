---
title: "mk:multimodal"
description: "Process and generate images, video, audio, PDFs, and speech via Gemini and MiniMax APIs. Image analysis, transcription, OCR, document conversion, image/video/music generation with multi-provider fallback."
---

## What This Skill Does

Analyzes non-text media files (images, video, audio, PDFs) using Gemini API. Generates images via Nano Banana 2 (Gemini) or MiniMax, video via Veo 3.1 or MiniMax Hailuo, speech via MiniMax TTS, music via MiniMax. Converts documents to Markdown. Multi-provider fallback: Gemini -> MiniMax -> OpenRouter ensures resilience.

## When to Use

**Auto-activates on:**
- Image files (.png, .jpg, .webp), video (.mp4, .mov), audio (.mp3, .wav), documents (.pdf, .docx)
- Tasks: "analyze", "describe", "transcribe", "extract", "OCR"
- "generate image", "generate video", "create image"
- "generate speech", "text to speech", "TTS"
- "generate music", "create music"
- "convert document", "convert PDF to markdown"

**Do NOT invoke for:** text-only files (use Read), Gemini API docs (use `mk:docs-finder`), already-described images in context.

## Core Capabilities

### Analysis
| Capability | Script | Default Model |
|-----------|--------|---------------|
| Image analysis (caption, classify, Q&A, object detection, OCR) | `gemini_analyze.py` | gemini-2.5-flash |
| Video analysis (multi-resolution) | `gemini_analyze.py` | gemini-2.5-flash |
| Audio transcription (<15 min) | `gemini_analyze.py` | gemini-2.5-flash |
| PDF/document extraction | `gemini_analyze.py` or `document_converter.py` | gemini-2.5-flash |
| Document to Markdown | `document_converter.py` | local conversion |

### Generation
| Capability | Script | Provider Chain |
|-----------|--------|----------------|
| Image generation | `gemini_generate.py` | Gemini (Nano Banana 2) -> MiniMax -> OpenRouter |
| Video generation | `gemini_generate.py` | Gemini (Veo 3.1) -> MiniMax (Hailuo 2.3) |
| Speech/TTS | `minimax_generate.py` | MiniMax only |
| Music | `minimax_generate.py` | MiniMax only |

## Arguments

| Script | Arguments |
|--------|----------|
| `gemini_analyze.py` | `--files `PATH` --task <analyze|transcribe|extract> [--resolution low-res] [--json] [--verbose]` |
| `gemini_generate.py` | `--task <generate-image|generate-video> --prompt "..." [--provider minimax|openrouter] [--json]` |
| `minimax_generate.py` | `--task <generate-image|generate-video|generate-speech|generate-music> --prompt "..." [--json]` |
| `document_converter.py` | `--files doc.pdf --output ./docs/ [--json] [--verbose]` |
| `check_setup.py` | (no args) — verify API keys and dependencies |

**Important path convention:** All scripts run via `.claude/skills/.venv/bin/python3` from the project root. Prefix paths with `"$CLAUDE_PROJECT_DIR/"` when invoking from subdirectories.

## Models & Limits

Analysis default: `gemini-2.5-flash` (stable).
Image gen: `gemini-3.1-flash-image-preview` (Nano Banana 2, preview-channel).
Video gen: `veo-3.1-generate-preview` (preview-channel) or `MiniMax-Hailuo-2.3`.
TTS: `speech-2.8-hd` (MiniMax, 300+ system voices).
Music: `music-2.6` (MiniMax).

**Warning:** Preview-channel model IDs may rotate without notice. Re-verify via provider dashboards before relying on specific IDs. Full live table with pricing: `references/models-and-pricing.md`.

## API Keys

| Env Var | Required | Purpose | Fallback |
|---------|----------|---------|----------|
| `MEOWKIT_GEMINI_API_KEY` | Yes (for analysis) | Gemini analysis + generation | Falls back to `GEMINI_API_KEY` (legacy) |
| `MEOWKIT_MINIMAX_API_KEY` | No | MiniMax generation (image/video/TTS/music) | If missing, MiniMax generation skipped |
| `MEOWKIT_OPENROUTER_API_KEY` | No | OpenRouter fallback for image gen | If missing, OpenRouter skipped |

**Without any Gemini key:** analysis fails. Generation falls back to MiniMax/OpenRouter if available. Run `check_setup.py` first to verify.

## Workflow

### Analysis Flow
1. Detect media format -> select model -> run `gemini_analyze.py`
2. For >20MB files: use File API
3. For audio >15 min: split first (Gemini truncates silently)
4. For PDF >100 pages: process in 20-page chunks
5. Output: structured JSON/Markdown, capped at ~3000 tokens

### Generation Flow
1. Provider router auto-selects best available provider by checking API keys
2. Image: Gemini -> MiniMax -> OpenRouter
3. Video: Gemini -> MiniMax (60-180s for Hailuo, max 600s timeout)
4. TTS/Music: MiniMax only
5. Force provider: `--provider gemini|minimax|openrouter`

## Reference Files (Load On-Demand)

| Reference | When |
|-----------|------|
| `vision-understanding.md` | Image analysis |
| `audio-processing.md` | Audio/video transcription |
| `models-and-pricing.md` | Model selection, cost estimation |
| `image-generation.md` | Image generation |
| `video-generation.md` | Video generation, async polling |
| `video-analysis.md` | Video analysis, resolution modes |
| `minimax-generation.md` | MiniMax image/video/TTS/music |
| `document-conversion.md` | Document conversion, batch mode |

## Workflow Guides

| Workflow | Content |
|----------|---------|
| `audio-transcription.md` | Audio transcription step-by-step |
| `document-extraction.md` | PDF/docx extraction step-by-step |
| `image-analysis.md` | Image analysis step-by-step |

## Failure Handling

| Failure | Recovery |
|---------|----------|
| Missing API key | STOP + setup instructions |
| Invalid key (401) | STOP + re-check key |
| Rate limit (429) | Key rotation (`MEOWKIT_GEMINI_API_KEY_2/3/4`), else wait 60s |
| Billing required | Provider router tries MiniMax/OpenRouter fallback |

## Common Use Cases

1. **"Describe this screenshot"** -> `gemini_analyze.py --files screenshot.png --task analyze`
2. **"Transcribe this meeting recording"** -> split if >15 min, then `gemini_analyze.py --files meeting.mp3 --task transcribe`
3. **"Generate a hero image for my blog"** -> `gemini_generate.py --task generate-image --prompt "..."` (falls back through providers)
4. **"Convert this PDF to markdown"** -> `document_converter.py --files report.pdf --output ./docs/`
5. **"Extract text from this receipt"** -> `gemini_analyze.py --files receipt.jpg --task extract`
6. **"Generate TTS narration"** -> `minimax_generate.py --task generate-speech --prompt "..."`

## Example Prompt

> /mk:multimodal
> I have a 45-minute team meeting recording at ./recordings/standup.mp3. Transcribe it and give me a bullet-point summary of all decisions made and action items assigned.

## Pro Tips

- Run `check_setup.py` before first use to surface missing env vars
- Use `--resolution low-res` for video analysis (62% token savings)
- Keep Gemini temperature at 1.0 — lowering degrades output
- TTS default voice: `Wise_Woman`; see provider catalog for 300+ alternatives
- Video cost: ~263 tokens/sec at default resolution; use `--verbose` for estimate
- Image gen requires billing on free tier; use MiniMax/OpenRouter as fallback
- Prerequisites: `npx mewkit setup` once to create the Python venv

### Notes

- 14 Python scripts in `scripts/` (including provider_router, api_key_rotator, media_optimizer, env_utils)
- Full skill tree: 8 reference files, 3 workflow guides, `.env.example` for overrides
- Source: claudekit-engineer, version 2.1.0, trust_level: kit-authored