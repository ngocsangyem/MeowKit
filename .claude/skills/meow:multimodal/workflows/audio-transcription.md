# Audio Transcription Workflow

**Use when:** Task involves meeting recordings, podcasts, interviews

**Speed:** Moderate (30-120s depending on length)
**Model:** gemini-2.5-flash (default)

## Steps

```bash
# 1. Check audio length
ffprobe -v quiet -show_format -print_format json <audio-file> | jq '.format.duration'

# 2a. Short audio (< 15 min) — direct transcription
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files <audio-file> \
  --task transcribe

# 2b. Long audio (> 15 min) — split first, then transcribe
ffmpeg -i <audio-file> -f segment -segment_time 900 -c copy /tmp/segment_%03d.mp3

for f in /tmp/segment_*.mp3; do
  .claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
    --files "$f" --task transcribe >> full_transcript.md
done

# 3. For video → extract audio first
ffmpeg -i video.mp4 -vn -acodec mp3 audio.mp3
.claude/skills/.venv/bin/python3 .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files audio.mp3 --task transcribe
```

## Output Format

Transcripts use timestamped format:
```
[00:00:00 -> 00:00:15] Speaker 1: Welcome to the meeting...
[00:00:15 -> 00:00:32] Speaker 2: Thanks, let's start with...
```
