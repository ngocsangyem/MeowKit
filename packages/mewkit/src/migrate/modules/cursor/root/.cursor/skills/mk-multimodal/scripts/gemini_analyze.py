#!/usr/bin/env python3
"""Analyze media files using Gemini API — CLI entry point.

Re-exports from analyze_constants and analyze_core for backward compat.

Usage:
  python gemini_analyze.py --files image.png --task analyze
  python gemini_analyze.py --files audio.mp3 --task transcribe
  python gemini_analyze.py --files doc.pdf --task extract
  python gemini_analyze.py --files image.png --task analyze --prompt "Focus on the UI layout"
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Re-exports for backward compat (tests and other scripts import from here)
from analyze_constants import (  # noqa: F401
    MIME_TYPES, MODALITY_MAP, DEFAULT_PROMPTS,
    MEDIA_RESOLUTION_MAP, MAX_OUTPUT_CHARS,
    detect_modality, get_prompt,
)
from analyze_core import find_api_key, analyze_file  # noqa: F401


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
    parser.add_argument('--resolution', choices=['default', 'low-res'], default='default',
                        help='Video resolution for analysis (low-res saves 62%% tokens)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    from api_key_rotator import KeyRotator
    rotator = KeyRotator(max_retries=3)

    results = []
    for file_path in args.files:
        result = analyze_file(
            file_path=file_path,
            task=args.task,
            model=args.model,
            custom_prompt=args.prompt,
            verbose=args.verbose,
            rotator=rotator,
            resolution=args.resolution,
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
