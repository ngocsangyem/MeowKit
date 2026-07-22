# Audio Processing Reference

## Supported Formats

WAV, MP3, AAC, FLAC, M4A, OGG

## Limits

- Max duration: 9.5 hours
- Max size: 20MB inline, 2GB via File API
- Token rate: ~32 tokens/second
- Audio is auto-downsampled to 16 Kbps mono

## Transcription

### Basic
```bash
python scripts/gemini_analyze.py --files meeting.mp3 --task transcribe
```

### With Timestamps
```bash
python scripts/gemini_analyze.py --files podcast.mp3 --task transcribe \
  --prompt "Transcribe with timestamps [HH:MM:SS -> HH:MM:SS] and speaker labels"
```

## Important: 15-Minute Truncation

Gemini output tokens limit causes transcript truncation for audio > 15 minutes.

**Solution:** Split audio into 15-minute segments first:

```bash
# Split with ffmpeg
ffmpeg -i long-meeting.mp3 -f segment -segment_time 900 -c copy segment_%03d.mp3

# Transcribe each segment
for f in segment_*.mp3; do
  python scripts/gemini_analyze.py --files "$f" --task transcribe >> full_transcript.md
done
```

## Audio Analysis (Non-Speech)

```bash
python scripts/gemini_analyze.py --files sample.wav --task analyze \
  --prompt "Identify instruments, tempo, mood, and musical style"
```

## Best Practices

1. **Convert to MP3** before upload for smaller file size
2. **Split long audio** into 15-min segments for transcription
3. **Specify speaker count** in prompt if known
4. **Use gemini-2.5-flash** for transcription (cost-effective, accurate)
