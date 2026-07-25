#!/usr/bin/env python3
"""
Generate images and videos using Gemini API.

Usage:
  python gemini_generate.py --task generate-image --prompt "A sunset over mountains"
  python gemini_generate.py --task generate-video --prompt "A cat playing piano"
  python gemini_generate.py --task generate-image --prompt "Logo design" --aspect-ratio 1:1
"""

import argparse
import base64
import json
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


def find_api_key() -> Optional[str]:
    api_key = _env('GEMINI_API_KEY')
    if api_key:
        return api_key
    load_env_files()
    return _env('GEMINI_API_KEY')


# ─── Image generation ────────────────────────────────────────────────

def generate_image(
    prompt: str,
    model: str = 'gemini-3.1-flash-image-preview',
    output_dir: str = './output',
    aspect_ratio: str = '1:1',
    verbose: bool = False,
) -> Dict[str, Any]:
    """Generate an image using Gemini/Imagen."""

    api_key = find_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_GEMINI_API_KEY not set (or GEMINI_API_KEY)'}

    client = genai.Client(api_key=api_key)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        if verbose:
            print(f"Generating image with {model}...")
            print(f"Prompt: {prompt}")

        # Imagen models use generate_images
        if 'imagen' in model:
            response = client.models.generate_images(
                model=model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                ),
            )

            if response.generated_images:
                img = response.generated_images[0]
                timestamp = int(time.time())
                filename = f"generated_{timestamp}.png"
                filepath = output_path / filename

                with open(filepath, 'wb') as f:
                    f.write(img.image.image_bytes)

                return {
                    'status': 'success',
                    'model': model,
                    'prompt': prompt,
                    'output_file': str(filepath),
                    'aspect_ratio': aspect_ratio,
                }
            else:
                return {'status': 'error', 'error': 'No image generated'}

        else:
            # Gemini native image generation (Nano Banana)
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                ),
            )

            # Extract image from response
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith('image/'):
                    timestamp = int(time.time())
                    filename = f"generated_{timestamp}.png"
                    filepath = output_path / filename

                    with open(filepath, 'wb') as f:
                        f.write(part.inline_data.data)

                    return {
                        'status': 'success',
                        'model': model,
                        'prompt': prompt,
                        'output_file': str(filepath),
                    }

            return {'status': 'error', 'error': 'No image in response'}

    except Exception as e:
        return {'status': 'error', 'error': str(e)}


# ─── Video generation (extracted to video_generator.py) ──────────────

from video_generator import generate_video


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Generate images and videos with Gemini API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --task generate-image --prompt "A sunset over mountains"
  %(prog)s --task generate-image --prompt "Logo" --aspect-ratio 1:1
  %(prog)s --task generate-video --prompt "A cat playing piano"
        """
    )
    parser.add_argument('--task', '-t', required=True, choices=['generate-image', 'generate-video'])
    parser.add_argument('--prompt', '-p', required=True, help='Generation prompt')
    parser.add_argument('--model', '-m', help='Model override')
    parser.add_argument('--provider', choices=['gemini', 'minimax', 'openrouter'],
                        help='Force specific provider (default: auto-detect from available keys)')
    parser.add_argument('--output', '-o', default='./output', help='Output directory (default: ./output)')
    parser.add_argument('--aspect-ratio', default='1:1', help='Aspect ratio for images (default: 1:1)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    # Always use provider router for auto-fallback (Gemini → MiniMax → OpenRouter)
    from provider_router import route_generation
    result = route_generation(
        args.task, force_provider=args.provider, verbose=args.verbose,
        prompt=args.prompt, model=args.model or '', output_dir=args.output,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result['status'] == 'success':
            print(f"Generated: {result['output_file']}")
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
