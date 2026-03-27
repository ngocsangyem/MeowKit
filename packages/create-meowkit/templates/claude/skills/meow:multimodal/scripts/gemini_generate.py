#!/usr/bin/env python3
"""
Generate images and videos using Gemini API.

Usage:
  python gemini_generate.py --task generate-image --prompt "A sunset over mountains"
  python gemini_generate.py --task generate-video --prompt "A cat playing piano"
  python gemini_generate.py --task generate-image --prompt "Logo design" --model imagen-4.0-generate-001
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai not installed. Run: pip install google-genai")
    sys.exit(1)


def load_env_files():
    if not load_dotenv:
        return
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent
    claude_dir = skill_dir.parent.parent
    for env_path in [claude_dir / '.env', skill_dir / '.env']:
        if env_path.exists():
            load_dotenv(env_path, override=True)


def find_api_key() -> Optional[str]:
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        return api_key
    load_env_files()
    return os.getenv('GEMINI_API_KEY')


# ─── Image generation ────────────────────────────────────────────────

def generate_image(
    prompt: str,
    model: str = 'imagen-4.0-generate-001',
    output_dir: str = './output',
    aspect_ratio: str = '1:1',
    verbose: bool = False,
) -> Dict[str, Any]:
    """Generate an image using Gemini/Imagen."""

    api_key = find_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'GEMINI_API_KEY not set'}

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
        error_str = str(e)
        if 'billing' in error_str.lower():
            return {'status': 'error', 'error': 'Image generation requires billing. Enable at console.cloud.google.com'}
        return {'status': 'error', 'error': error_str}


# ─── Video generation ────────────────────────────────────────────────

def generate_video(
    prompt: str,
    model: str = 'veo-3.1-generate-preview',
    output_dir: str = './output',
    verbose: bool = False,
) -> Dict[str, Any]:
    """Generate a video using Veo."""

    api_key = find_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'GEMINI_API_KEY not set'}

    client = genai.Client(api_key=api_key)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        if verbose:
            print(f"Generating video with {model}...")
            print(f"Prompt: {prompt}")
            print("This may take 1-3 minutes...")

        operation = client.models.generate_videos(
            model=model,
            prompt=prompt,
        )

        # Poll for completion
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

            # Download video
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


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Generate images and videos with Gemini API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --task generate-image --prompt "A sunset over mountains"
  %(prog)s --task generate-image --prompt "Logo" --model imagen-4.0-generate-001 --aspect-ratio 1:1
  %(prog)s --task generate-video --prompt "A cat playing piano"
        """
    )
    parser.add_argument('--task', '-t', required=True, choices=['generate-image', 'generate-video'])
    parser.add_argument('--prompt', '-p', required=True, help='Generation prompt')
    parser.add_argument('--model', '-m', help='Model override')
    parser.add_argument('--output', '-o', default='./output', help='Output directory (default: ./output)')
    parser.add_argument('--aspect-ratio', default='1:1', help='Aspect ratio for images (default: 1:1)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.task == 'generate-image':
        model = args.model or os.getenv('IMAGE_GEN_MODEL', 'imagen-4.0-generate-001')
        result = generate_image(args.prompt, model=model, output_dir=args.output,
                                aspect_ratio=args.aspect_ratio, verbose=args.verbose)
    else:
        model = args.model or os.getenv('VIDEO_GEN_MODEL', 'veo-3.1-generate-preview')
        result = generate_video(args.prompt, model=model, output_dir=args.output, verbose=args.verbose)

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
