"""Media pre-optimization via ffmpeg.

Optional: gracefully degrades if ffmpeg not installed.
Compresses video/audio files >15MB before upload to reduce token cost.
"""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any


def check_ffmpeg() -> bool:
    """Check if ffmpeg is available."""
    return shutil.which('ffmpeg') is not None


def get_media_info(file_path: str) -> Dict[str, Any]:
    """Get duration, bitrate, size via ffprobe."""
    if not shutil.which('ffprobe'):
        return {}
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json',
             '-show_format', '-show_streams', '--', file_path],
            capture_output=True, text=True, timeout=10,
        )
        data = json.loads(result.stdout)
        fmt = data.get('format', {})
        return {
            'duration_sec': float(fmt.get('duration', 0)),
            'size_bytes': int(fmt.get('size', 0)),
            'bitrate': int(fmt.get('bit_rate', 0)),
        }
    except Exception:
        return {}


def estimate_video_cost(
    duration_sec: float,
    resolution: str = 'default',
    model: str = 'gemini-2.5-flash',
) -> Dict[str, Any]:
    """Estimate token cost for video analysis.

    Accepts model param; warns if using non-default pricing.
    """
    # Per ai.google.dev/pricing (verified 2026-04-12):
    # Gemini video tokens/sec: 100 at low-res, 263 at default (medium/high).
    tokens_per_sec = 100 if resolution == 'low-res' else 263
    total_tokens = duration_sec * tokens_per_sec
    price_map = {
        'gemini-2.5-flash': 0.30,
        'gemini-2.5-pro': 1.25,
        'gemini-2.5-flash-lite': 0.10,
    }
    price = price_map.get(model, 0.30)
    cost_usd = (total_tokens / 1_000_000) * price
    disclaimer = ''
    if model not in price_map:
        disclaimer = f' (estimated at gemini-2.5-flash rates; actual {model} may differ)'
    return {
        'tokens': int(total_tokens),
        'cost_usd': round(cost_usd, 4),
        'model': model,
        'disclaimer': disclaimer,
    }


def compress_media(file_path: str, target_mb: int = 15) -> Optional[str]:
    """Compress media file to target size. Returns path to compressed file or None.

    Uses -- separator before file paths (subprocess injection safety).
    Caller MUST clean up returned path with try/finally.
    """
    if not check_ffmpeg():
        return None
    out_fd, out_path = tempfile.mkstemp(suffix='.mp4', prefix='meow_compressed_')
    os.close(out_fd)
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', file_path, '-b:v', '1M', '-preset', 'fast', '--', out_path],
            capture_output=True, timeout=120,
        )
        if Path(out_path).stat().st_size > 0:
            return out_path
    except Exception:
        pass
    Path(out_path).unlink(missing_ok=True)
    return None
