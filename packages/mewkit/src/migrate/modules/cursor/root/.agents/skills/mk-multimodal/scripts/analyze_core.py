"""Core analysis logic for Gemini media analysis.

Contains find_api_key() and analyze_file() — the main analysis function.
"""

import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai not installed. Run: pip install google-genai")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env, load_env_files
from analyze_constants import (
    MIME_TYPES, MEDIA_RESOLUTION_MAP, MAX_OUTPUT_CHARS,
    detect_modality, get_prompt,
)


def find_api_key() -> Optional[str]:
    """Find GEMINI_API_KEY from env or .env files."""
    api_key = _env('GEMINI_API_KEY')
    if api_key:
        return api_key
    load_env_files()
    return _env('GEMINI_API_KEY')


def analyze_file(
    file_path: str,
    task: str = 'analyze',
    model: str = 'gemini-2.5-flash',
    custom_prompt: Optional[str] = None,
    verbose: bool = False,
    max_retries: int = 3,
    rotator=None,
    resolution: str = 'default',
) -> Dict[str, Any]:
    """Analyze a media file using Gemini."""

    api_key = rotator.current_key if rotator else find_api_key()
    if not api_key:
        return {
            'file': file_path,
            'status': 'error',
            'error': 'MEOWKIT_GEMINI_API_KEY not set (or GEMINI_API_KEY). Get one at: https://aistudio.google.com/apikey',
        }

    file_path_obj = Path(file_path)
    if not file_path_obj.exists():
        return {'file': file_path, 'status': 'error', 'error': f'File not found: {file_path}'}

    modality = detect_modality(file_path)
    if modality == 'unknown':
        return {'file': file_path, 'status': 'error', 'error': f'Unsupported format: {file_path_obj.suffix}'}

    file_size = file_path_obj.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    prompt = get_prompt(task, modality, custom_prompt)
    mime_type = MIME_TYPES.get(file_path_obj.suffix.lower(), 'application/octet-stream')

    if verbose:
        print(f"File: {file_path} ({file_size_mb:.1f} MB, {modality})")
        print(f"Model: {model}")
        print(f"Task: {task}")

    if modality == 'video' and verbose:
        try:
            from media_optimizer import get_media_info, estimate_video_cost
            info = get_media_info(file_path)
            if info.get('duration_sec'):
                cost = estimate_video_cost(info['duration_sec'], resolution=resolution, model=model)
                print(f"Estimated cost: {cost['tokens']:,} tokens (~${cost['cost_usd']}){cost['disclaimer']}")
        except Exception:
            pass

    compressed = None
    if file_size_mb > 15 and modality in ('video', 'audio'):
        try:
            from media_optimizer import compress_media
            compressed = compress_media(file_path)
            if compressed:
                file_path = compressed
                file_path_obj = Path(file_path)
                file_size = file_path_obj.stat().st_size
                file_size_mb = file_size / (1024 * 1024)
                if verbose:
                    print(f"Pre-compressed to {file_size_mb:.1f} MB")
        except Exception:
            pass

    client = genai.Client(api_key=api_key)

    def _cleanup():
        if compressed:
            Path(compressed).unlink(missing_ok=True)

    for attempt in range(max_retries):
        try:
            use_file_api = file_size > 20 * 1024 * 1024

            if use_file_api:
                if verbose:
                    print("Using File API (file > 20MB)...")
                myfile = client.files.upload(file=file_path)
                elapsed = 0
                while myfile.state.name == 'PROCESSING' and elapsed < 300:
                    time.sleep(2)
                    myfile = client.files.get(name=myfile.name)
                    elapsed += 2
                content = [prompt, myfile]
            else:
                with open(file_path, 'rb') as f:
                    file_bytes = f.read()
                content = [prompt, types.Part.from_bytes(data=file_bytes, mime_type=mime_type)]

            media_res = MEDIA_RESOLUTION_MAP.get(modality)
            if resolution == 'low-res' and modality == 'video':
                media_res = 'MEDIA_RESOLUTION_LOW'
            gen_config = None
            if media_res:
                try:
                    gen_config = types.GenerateContentConfig(
                        media_resolution=getattr(types.MediaResolution, media_res),
                    )
                except (AttributeError, TypeError):
                    gen_config = None
            response = client.models.generate_content(
                model=model, contents=content, config=gen_config,
            )
            result_text = response.text if hasattr(response, 'text') else ''

            if len(result_text) > MAX_OUTPUT_CHARS:
                result_text = result_text[:MAX_OUTPUT_CHARS] + (
                    '\n\n[Output truncated to stay within context budget. '
                    'Use --prompt for targeted extraction.]'
                )

            _cleanup()
            return {
                'file': file_path, 'status': 'success', 'modality': modality,
                'model': model, 'task': task, 'file_size_mb': round(file_size_mb, 2),
                'result': result_text, 'token_estimate': len(result_text) // 4,
            }

        except Exception as e:
            error_str = str(e)

            if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                if rotator and rotator.has_more_keys:
                    new_key = rotator.rotate()
                    if new_key:
                        if verbose:
                            print(f"Rate limited. Rotating API key (attempt {attempt + 1}/{max_retries})...")
                        client = genai.Client(api_key=new_key)
                        continue
                wait = 60
                if verbose:
                    print(f"Rate limited. Waiting {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue

            if '401' in error_str or '403' in error_str:
                _cleanup()
                return {'file': file_path, 'status': 'error',
                        'error': f'API key invalid or expired: {error_str}'}

            if 'billing' in error_str.lower():
                _cleanup()
                return {'file': file_path, 'status': 'error',
                        'error': 'Billing required for this operation. Enable at console.cloud.google.com'}

            if attempt < max_retries - 1:
                wait = 2 ** attempt
                if verbose:
                    print(f"Error: {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                _cleanup()
                return {'file': file_path, 'status': 'error', 'error': error_str}

    _cleanup()
    return {'file': file_path, 'status': 'error', 'error': 'Max retries exceeded'}
