#!/usr/bin/env python3
"""Video generation using Veo via Gemini API.

Extracted from gemini_generate.py to keep files under 200 lines.
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


def _find_api_key() -> Optional[str]:
    api_key = _env('GEMINI_API_KEY')
    if api_key:
        return api_key
    load_env_files()
    return _env('GEMINI_API_KEY')


def generate_video(
    prompt: str,
    model: str = 'veo-3.1-generate-preview',
    output_dir: str = './output',
    verbose: bool = False,
) -> Dict[str, Any]:
    """Generate a video using Veo."""

    api_key = _find_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_GEMINI_API_KEY not set (or GEMINI_API_KEY)'}

    client = genai.Client(api_key=api_key)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        if verbose:
            print(f"Generating video with {model}...")
            print(f"Prompt: {prompt}")
            print("This may take 1-3 minutes...")

        operation = client.models.generate_videos(model=model, prompt=prompt)

        elapsed = 0
        while not operation.done and elapsed < 600:
            time.sleep(10)
            operation = client.operations.get(operation)
            elapsed += 10
            if verbose and elapsed % 30 == 0:
                print(f"  Generating... {elapsed}s")

        if not operation.done:
            return {'status': 'error', 'error': f'Video generation timed out after {elapsed}s'}

        if operation.response and operation.response.generated_videos:
            video = operation.response.generated_videos[0]
            timestamp = int(time.time())
            filename = f"generated_{timestamp}.mp4"
            filepath = output_path / filename

            video_data = client.files.download(file=video.video)
            with open(filepath, 'wb') as f:
                f.write(video_data)

            return {
                'status': 'success',
                'model': model,
                'prompt': prompt,
                'output_file': str(filepath),
            }

        return {'status': 'error', 'error': 'No video generated'}

    except Exception as e:
        error_str = str(e)
        if 'billing' in error_str.lower():
            return {'status': 'error', 'error': 'Video generation requires billing. Enable at console.cloud.google.com'}
        return {'status': 'error', 'error': error_str}
