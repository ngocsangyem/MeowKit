#!/usr/bin/env python3
"""Convert documents to Markdown using Gemini API.

Supports PDF, images (OCR), Office docs (DOCX, XLSX, PPTX).
Saves clean Markdown output to file.

Usage:
  python document_converter.py --files doc.pdf --output ./output/
  python document_converter.py --files a.pdf b.docx --output ./docs/
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

sys.path.insert(0, str(Path(__file__).parent))
from analyze_constants import detect_modality, MIME_TYPES
from analyze_core import find_api_key

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai not installed. Run: pip install google-genai")
    sys.exit(1)

CONVERT_PROMPT = (
    'Convert this document to clean, well-formatted Markdown.\n'
    'Preserve heading hierarchy (# ## ###). Convert tables to Markdown tables.\n'
    'Skip headers, footers, page numbers. For images: [Image: brief description].\n'
    'Output ONLY the Markdown content, no preamble.'
)


def convert_file(file_path: str, model: str = 'gemini-2.5-flash',
                 custom_prompt: Optional[str] = None,
                 verbose: bool = False) -> Dict[str, Any]:
    """Convert a single document to Markdown."""
    api_key = find_api_key()
    if not api_key:
        return {'file': file_path, 'status': 'error',
                'error': 'MEOWKIT_GEMINI_API_KEY not set'}

    path = Path(file_path)
    if not path.exists():
        return {'file': file_path, 'status': 'error',
                'error': f'File not found: {file_path}'}

    if path.stat().st_size == 0:
        return {'file': file_path, 'status': 'error',
                'error': 'File is empty (0 bytes)'}

    modality = detect_modality(file_path)
    if modality not in ('document', 'image'):
        return {'file': file_path, 'status': 'error',
                'error': f'Unsupported for conversion: {modality}. '
                         f'Use gemini_analyze.py --task extract for {modality} files.'}

    mime = MIME_TYPES.get(path.suffix.lower(), 'application/octet-stream')
    prompt = custom_prompt or CONVERT_PROMPT
    client = genai.Client(api_key=api_key)

    if verbose:
        print(f"Converting: {file_path} ({modality})", file=sys.stderr)

    try:
        file_size = path.stat().st_size
        if file_size > 20 * 1024 * 1024:
            uploaded = client.files.upload(file=file_path)
            elapsed = 0
            while uploaded.state.name == 'PROCESSING' and elapsed < 300:
                time.sleep(2)
                uploaded = client.files.get(name=uploaded.name)
                elapsed += 2
            content = [prompt, uploaded]
        else:
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
            content = [prompt, types.Part.from_bytes(data=file_bytes, mime_type=mime)]

        response = client.models.generate_content(model=model, contents=content)
        markdown = response.text if hasattr(response, 'text') else ''
        return {'file': file_path, 'status': 'success', 'markdown': markdown,
                'model': model, 'chars': len(markdown)}

    except Exception as e:
        return {'file': file_path, 'status': 'error', 'error': str(e)}


def save_markdown(result: Dict, output_dir: str) -> Optional[str]:
    """Save conversion result to Markdown file."""
    if result['status'] != 'success':
        return None
    stem = Path(result['file']).stem
    ext = Path(result['file']).suffix.lstrip('.')
    out_path = Path(output_dir) / f"{stem}_{ext}.md"
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(result['markdown'], encoding='utf-8')
        return str(out_path)
    except Exception as e:
        print(f"Error saving {out_path}: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description='Convert documents to Markdown')
    parser.add_argument('--files', '-f', nargs='+', required=True, help='File(s) to convert')
    parser.add_argument('--output', '-o', default='./output', help='Output directory')
    parser.add_argument('--model', '-m', default='gemini-2.5-flash', help='Gemini model')
    parser.add_argument('--prompt', '-p', help='Custom conversion prompt')
    parser.add_argument('--json', action='store_true', help='JSON output')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    results = []
    for file_path in args.files:
        result = convert_file(file_path, model=args.model,
                              custom_prompt=args.prompt, verbose=args.verbose)
        if result['status'] == 'success':
            saved = save_markdown(result, args.output)
            result['saved_to'] = saved
        results.append(result)

    if args.json:
        print(json.dumps(results if len(results) > 1 else results[0], indent=2))
    else:
        for r in results:
            if r['status'] == 'success':
                print(f"Converted: {r['file']} → {r.get('saved_to', '?')} ({r['chars']} chars)")
            else:
                print(f"Error [{r['file']}]: {r['error']}", file=sys.stderr)


if __name__ == '__main__':
    main()
