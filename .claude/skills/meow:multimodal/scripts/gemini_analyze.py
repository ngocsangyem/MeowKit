#!/usr/bin/env python3
"""
Analyze media files using Gemini API.

Supports: images, video, audio, PDF, documents.
Tasks: analyze, transcribe, extract.

Usage:
  python gemini_analyze.py --files image.png --task analyze
  python gemini_analyze.py --files audio.mp3 --task transcribe
  python gemini_analyze.py --files doc.pdf --task extract
  python gemini_analyze.py --files image.png --task analyze --prompt "Focus on the UI layout"
"""

import argparse
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


# ─── Environment ────────────────────────────────────────────────────

def load_env_files():
    """Load .env files in priority order."""
    if not load_dotenv:
        return
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent
    claude_dir = skill_dir.parent.parent
    for env_path in [claude_dir / '.env', skill_dir / '.env']:
        if env_path.exists():
            load_dotenv(env_path, override=True)


def find_api_key() -> Optional[str]:
    """Find GEMINI_API_KEY from env or .env files."""
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        return api_key

    load_env_files()
    return os.getenv('GEMINI_API_KEY')


# ─── MIME types ──────────────────────────────────────────────────────

MIME_TYPES = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.flac': 'audio/flac', '.aac': 'audio/aac',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.html': 'text/html', '.csv': 'text/csv',
}

MODALITY_MAP = {
    'image': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif'],
    'video': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    'audio': ['.mp3', '.wav', '.m4a', '.flac', '.aac'],
    'document': ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.html', '.csv'],
}


def detect_modality(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    for modality, extensions in MODALITY_MAP.items():
        if ext in extensions:
            return modality
    return 'unknown'


# ─── Task prompts ────────────────────────────────────────────────────

DEFAULT_PROMPTS = {
    'analyze': {
        'image': 'Analyze this image in detail. Describe what you see, identify key elements, and note any text visible.',
        'video': 'Analyze this video. Describe key scenes, actions, and any text or important visual elements.',
        'audio': 'Analyze this audio. Describe what you hear, identify speakers if possible, note the tone and content.',
        'document': 'Analyze this document. Summarize the content, identify key sections, and extract important information.',
    },
    'transcribe': {
        'audio': 'Transcribe this audio accurately. Use the format:\n[HH:MM:SS -> HH:MM:SS] transcript content\n\nInclude speaker identification where possible.',
        'video': 'Transcribe the audio from this video. Use the format:\n[HH:MM:SS -> HH:MM:SS] transcript content\n\nInclude speaker identification where possible.',
    },
    'extract': {
        'document': 'Extract the content of this document to clean, well-formatted Markdown. Preserve structure, tables, and formatting.',
        'image': 'Extract all text visible in this image (OCR). Preserve layout and formatting where possible.',
    },
}


def get_prompt(task: str, modality: str, custom_prompt: Optional[str] = None) -> str:
    if custom_prompt:
        return custom_prompt
    task_prompts = DEFAULT_PROMPTS.get(task, {})
    return task_prompts.get(modality, f'{task.capitalize()} this {modality}.')


# ─── Analysis ────────────────────────────────────────────────────────

def analyze_file(
    file_path: str,
    task: str = 'analyze',
    model: str = 'gemini-2.5-flash',
    custom_prompt: Optional[str] = None,
    verbose: bool = False,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """Analyze a media file using Gemini."""

    api_key = find_api_key()
    if not api_key:
        return {
            'file': file_path,
            'status': 'error',
            'error': 'GEMINI_API_KEY not set. Get one at: https://aistudio.google.com/apikey',
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

    client = genai.Client(api_key=api_key)

    for attempt in range(max_retries):
        try:
            use_file_api = file_size > 20 * 1024 * 1024  # > 20MB

            if use_file_api:
                if verbose:
                    print("Using File API (file > 20MB)...")
                myfile = client.files.upload(file=file_path)
                # Wait for processing
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

            response = client.models.generate_content(model=model, contents=content)
            result_text = response.text if hasattr(response, 'text') else ''

            return {
                'file': file_path,
                'status': 'success',
                'modality': modality,
                'model': model,
                'task': task,
                'file_size_mb': round(file_size_mb, 2),
                'result': result_text,
                'token_estimate': len(result_text) // 4,
            }

        except Exception as e:
            error_str = str(e)

            # Rate limit — retry
            if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                wait = 60
                if verbose:
                    print(f"Rate limited. Waiting {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue

            # Auth error — don't retry
            if '401' in error_str or '403' in error_str:
                return {
                    'file': file_path,
                    'status': 'error',
                    'error': f'API key invalid or expired: {error_str}',
                }

            # Billing error
            if 'billing' in error_str.lower():
                return {
                    'file': file_path,
                    'status': 'error',
                    'error': f'Billing required for this operation. Enable at console.cloud.google.com',
                }

            # Other error — retry with backoff
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                if verbose:
                    print(f"Error: {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                return {'file': file_path, 'status': 'error', 'error': error_str}

    return {'file': file_path, 'status': 'error', 'error': 'Max retries exceeded'}


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Analyze media files with Gemini API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --files image.png --task analyze
  %(prog)s --files meeting.mp3 --task transcribe
  %(prog)s --files document.pdf --task extract
  %(prog)s --files screenshot.png --task analyze --prompt "Describe the UI layout"
  %(prog)s --files a.png b.png --task analyze --json
        """
    )
    parser.add_argument('--files', '-f', nargs='+', required=True, help='File(s) to analyze')
    parser.add_argument('--task', '-t', required=True, choices=['analyze', 'transcribe', 'extract'],
                        help='Task type')
    parser.add_argument('--model', '-m', default='gemini-2.5-flash', help='Gemini model (default: gemini-2.5-flash)')
    parser.add_argument('--prompt', '-p', help='Custom prompt (overrides default)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    results = []
    for file_path in args.files:
        result = analyze_file(
            file_path=file_path,
            task=args.task,
            model=args.model,
            custom_prompt=args.prompt,
            verbose=args.verbose,
        )
        results.append(result)

    if args.json:
        print(json.dumps(results if len(results) > 1 else results[0], indent=2))
    else:
        any_error = False
        for r in results:
            if r['status'] == 'success':
                print(r['result'])
            else:
                print(f"Error [{r.get('file', '?')}]: {r['error']}", file=sys.stderr)
                any_error = True
        if any_error:
            sys.exit(1)


if __name__ == '__main__':
    main()
