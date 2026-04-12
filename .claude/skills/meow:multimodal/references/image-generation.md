# Image Generation Reference

## Models

| Model | Speed | Quality | Cost | When to Use |
|-------|-------|---------|------|-------------|
| `gemini-3.1-flash-image-preview` (Nano Banana 2) | Fast (2-5s) | Good | ~$0.04/image | **Default.** Quick iterations, UI mockups, icons, text-in-image |

## Nano Banana 2

`gemini-3.1-flash-image-preview` is the **recommended default** for all image generation:
- 2-5 second generation time
- Supports text rendering in images
- Works via `generate_content` API (not `generate_images`)
- Good quality for most use cases

## OpenRouter Fallback

When Google billing is unavailable, image gen falls back to OpenRouter via chat completions API:
- Model: `black-forest-labs/flux-1-schnell` (megapixel-based pricing — see openrouter.ai/models for current rates)
- Requires: `OPENROUTER_API_KEY` env var + `OPENROUTER_FALLBACK_ENABLED=true`
- Always prints privacy notice (prompt is sent to third party)
- Quality: good for illustrations, weaker for photorealism
- Override model via `OPENROUTER_IMAGE_MODEL` env var

## Prompt Tips

- Be specific about style: "flat vector illustration" vs "photorealistic"
- Specify dimensions: "square 1:1", "wide 16:9", "portrait 9:16"
- Avoid: abstract concepts without visual anchors
- For text in images: Nano Banana 2 handles this well

## CLI Examples

```bash
# Default (Nano Banana 2)
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_generate.py \
  --task generate-image --prompt "UI mockup, flat vector"

# With aspect ratio
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_generate.py \
  --task generate-image --prompt "Sunset landscape" --aspect-ratio 16:9
```

## Gotchas

- Image gen requires Google billing (free tier = no image gen)
- Nano Banana may return text + image; extract image part from response
- NSFW/violent prompts are blocked silently (no error, just empty response)
