# Video Generation Reference

## Models

| Model | Duration | Resolution | Cost | Notes |
|-------|----------|-----------|------|-------|
| `veo-3.1-generate-preview` | 8s clips | Up to 1080p | Preview pricing | With audio |

## Process

1. Submit prompt via `generate_videos()` API
2. Poll `operations.get()` every 10s (timeout: 600s)
3. Download completed video via `files.download()`
4. Average generation time: 60-180 seconds

## Prompt Tips

- Describe camera movement: "slow zoom in", "tracking shot left to right"
- Specify lighting: "golden hour", "studio lighting", "neon"
- Include audio direction: "upbeat music", "quiet ambient"
- Keep prompts under 200 words (longer = less predictable)

## Cost Estimation

- Each generation: 1 API call + polling calls (free) + download
- Preview pricing varies; budget ~$0.10-0.50 per generation
- Failed generations may still incur cost (check billing dashboard)

## CLI Example

```bash
.claude/skills/.venv/bin/python3 .claude/skills/multimodal/scripts/gemini_generate.py \
  --task generate-video \
  --prompt "A cat playing piano, cinematic lighting, slow dolly in" \
  --verbose
```

## Gotchas

- Requires Google billing (NO free tier for video gen)
- Max 8 seconds per clip; longer videos need stitching
- Polling timeout at 600s; some complex prompts take longer
- No seed/reproducibility — same prompt gives different results each time
- Audio quality varies; music direction works better than speech
