#!/usr/bin/env python3
"""MiniMax generation CLI — image, video (Hailuo), TTS, music.

Usage:
  python minimax_generate.py --task generate-image --prompt "A cat in space"
  python minimax_generate.py --task generate-video --prompt "A dancer"
  python minimax_generate.py --task generate-speech --text "Hello world"
  python minimax_generate.py --task generate-music --lyrics "Verse 1..."
"""

import argparse
import base64
import json
import sys
import time
import urllib.request
from pathlib import Path
from typing import Dict, Any

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env
from minimax_api_client import (
    find_minimax_api_key, api_post, poll_async_task, download_file,
)


def generate_image(prompt, model='', output_dir='./output', verbose=False) -> Dict[str, Any]:
    model = model or _env('MINIMAX_IMAGE_MODEL') or 'image-01'
    api_key = find_minimax_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_MINIMAX_API_KEY not set'}
    try:
        result = api_post("image_generation", {"model": model, "prompt": prompt},
                          api_key, verbose=verbose)
        images = result.get("data", {}).get("image_list", [])
        if not images:
            return {'status': 'error', 'error': 'No image in response'}
        img_b64 = images[0].get("image_base64", "")
        if not img_b64:
            return {'status': 'error', 'error': 'Empty image data from MiniMax'}
        out_path = Path(output_dir) / f"minimax_{int(time.time())}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            out_path.write_bytes(base64.b64decode(img_b64))
        except Exception:
            return {'status': 'error', 'error': 'Invalid base64 image data'}
        return {'status': 'success', 'provider': 'minimax', 'model': model,
                'output_file': str(out_path)}
    except Exception as e:
        return {'status': 'error', 'provider': 'minimax', 'error': str(e)}


def generate_video(prompt, model='', output_dir='./output', verbose=False) -> Dict[str, Any]:
    model = model or _env('MINIMAX_VIDEO_MODEL') or 'MiniMax-Hailuo-2.3'
    api_key = find_minimax_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_MINIMAX_API_KEY not set'}
    try:
        if verbose:
            print(f"Submitting video generation ({model})...", file=sys.stderr)
        result = api_post("video_generation", {"model": model, "prompt": prompt},
                          api_key, verbose=verbose, timeout=30)
        task_id = result.get("task_id")
        if not task_id:
            return {'status': 'error', 'error': 'No task_id in response'}
        poll_result = poll_async_task(task_id, "video_generation", api_key, verbose=verbose)
        file_id = poll_result.get("file_id")
        if not file_id:
            return {'status': 'error', 'error': 'No file_id after polling'}
        out_path = str(Path(output_dir) / f"minimax_video_{int(time.time())}.mp4")
        download_file(file_id, api_key, out_path, verbose=verbose)
        return {'status': 'success', 'provider': 'minimax', 'model': model,
                'output_file': out_path}
    except (TimeoutError, Exception) as e:
        return {'status': 'error', 'provider': 'minimax', 'error': str(e)}


def generate_speech(text, model='', voice_id='', output_dir='./output',
                    verbose=False) -> Dict[str, Any]:
    model = model or _env('MINIMAX_SPEECH_MODEL') or 'speech-2.8-hd'
    voice_id = voice_id or _env('MINIMAX_SPEECH_VOICE') or 'Wise_Woman'
    api_key = find_minimax_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_MINIMAX_API_KEY not set'}
    try:
        result = api_post("t2a_v2", {
            "model": model, "text": text,
            "voice_setting": {"voice_id": voice_id},
        }, api_key, verbose=verbose)
        audio_data = result.get("data", {}).get("audio", "")
        if not audio_data:
            return {'status': 'error', 'error': 'No audio in response'}
        out_path = Path(output_dir) / f"minimax_speech_{int(time.time())}.mp3"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            out_path.write_bytes(base64.b64decode(audio_data))
        except Exception:
            return {'status': 'error', 'error': 'Invalid audio data encoding'}
        return {'status': 'success', 'provider': 'minimax', 'model': model,
                'output_file': str(out_path)}
    except Exception as e:
        return {'status': 'error', 'provider': 'minimax', 'error': str(e)}


def generate_music(lyrics, model='', prompt='', output_dir='./output',
                   verbose=False) -> Dict[str, Any]:
    model = model or _env('MINIMAX_MUSIC_MODEL') or 'music-2.6'
    api_key = find_minimax_api_key()
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_MINIMAX_API_KEY not set'}
    try:
        payload = {"model": model, "lyrics": lyrics}
        if prompt:
            payload["prompt"] = prompt
        result = api_post("music_generation", payload, api_key, verbose=verbose)
        audio_url = result.get("data", {}).get("audio_url", "")
        if not audio_url:
            return {'status': 'error', 'error': 'No audio_url in response'}
        if not audio_url.startswith('https://'):
            return {'status': 'error', 'error': 'Refusing non-HTTPS audio URL'}
        out_path = Path(output_dir) / f"minimax_music_{int(time.time())}.mp3"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(audio_url, timeout=300) as resp:
            out_path.write_bytes(resp.read())
        return {'status': 'success', 'provider': 'minimax', 'model': model,
                'output_file': str(out_path)}
    except Exception as e:
        return {'status': 'error', 'provider': 'minimax', 'error': str(e)}


def main():
    parser = argparse.ArgumentParser(description='MiniMax generation CLI')
    parser.add_argument('--task', '-t', required=True,
                        choices=['generate-image', 'generate-video',
                                 'generate-speech', 'generate-music'])
    parser.add_argument('--prompt', '-p', default='', help='Generation prompt')
    parser.add_argument('--text', help='Text for TTS')
    parser.add_argument('--lyrics', help='Lyrics for music generation')
    parser.add_argument('--model', '-m', default='', help='Model override')
    parser.add_argument('--voice-id', default='', help='TTS voice ID')
    parser.add_argument('--output', '-o', default='./output', help='Output dir')
    parser.add_argument('--json', action='store_true', help='JSON output')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    dispatch = {
        'generate-image': lambda: generate_image(args.prompt, model=args.model,
                                                  output_dir=args.output, verbose=args.verbose),
        'generate-video': lambda: generate_video(args.prompt, model=args.model,
                                                  output_dir=args.output, verbose=args.verbose),
        'generate-speech': lambda: generate_speech(args.text or args.prompt, model=args.model,
                                                    voice_id=args.voice_id, output_dir=args.output,
                                                    verbose=args.verbose),
        'generate-music': lambda: generate_music(args.lyrics or args.prompt, model=args.model,
                                                  prompt=args.prompt, output_dir=args.output,
                                                  verbose=args.verbose),
    }
    result = dispatch[args.task]()

    if args.json:
        print(json.dumps(result, indent=2))
    elif result['status'] == 'success':
        print(f"Generated: {result['output_file']}")
    else:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
