#!/usr/bin/env python3
"""
Tests for gemini_analyze.py — unit tests (no API key / network required).

Tests cover:
- detect_modality(): file extension → modality mapping
- get_prompt(): default and custom prompt selection
- MIME_TYPES: coverage for all supported extensions
- MODALITY_MAP: all extensions mapped correctly
- find_api_key(): missing key behavior
- analyze_file(): missing key, missing file, unsupported format errors
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent to path so we can import the scripts
sys.path.insert(0, str(Path(__file__).parent.parent))

# Mock google.genai before importing gemini_analyze
# This allows tests to run without google-genai installed
mock_genai = MagicMock()
mock_types = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = mock_genai
sys.modules['google.genai.types'] = mock_types

from gemini_analyze import (
    detect_modality,
    get_prompt,
    find_api_key,
    analyze_file,
    MIME_TYPES,
    MODALITY_MAP,
    DEFAULT_PROMPTS,
)

passed = 0
failed = 0


def ok(condition, message):
    global passed, failed
    if condition:
        print(f"✓ {message}")
        passed += 1
    else:
        print(f"✗ {message}")
        failed += 1


def eq(actual, expected, message):
    global passed, failed
    if actual == expected:
        print(f"✓ {message}")
        passed += 1
    else:
        print(f"✗ {message}")
        print(f"  Expected: {expected}")
        print(f"  Actual:   {actual}")
        failed += 1


print("Running gemini_analyze.py tests...\n")

# ─── detect_modality ─────────────────────────────────────────────────
print("## detect_modality()")

eq(detect_modality("photo.png"), "image", "PNG → image")
eq(detect_modality("photo.jpg"), "image", "JPG → image")
eq(detect_modality("photo.jpeg"), "image", "JPEG → image")
eq(detect_modality("photo.webp"), "image", "WEBP → image")
eq(detect_modality("photo.heic"), "image", "HEIC → image")
eq(detect_modality("photo.heif"), "image", "HEIF → image")
eq(detect_modality("photo.gif"), "image", "GIF → image")

eq(detect_modality("clip.mp4"), "video", "MP4 → video")
eq(detect_modality("clip.mov"), "video", "MOV → video")
eq(detect_modality("clip.avi"), "video", "AVI → video")
eq(detect_modality("clip.mkv"), "video", "MKV → video")
eq(detect_modality("clip.webm"), "video", "WEBM → video")

eq(detect_modality("audio.mp3"), "audio", "MP3 → audio")
eq(detect_modality("audio.wav"), "audio", "WAV → audio")
eq(detect_modality("audio.m4a"), "audio", "M4A → audio")
eq(detect_modality("audio.flac"), "audio", "FLAC → audio")
eq(detect_modality("audio.aac"), "audio", "AAC → audio")

eq(detect_modality("doc.pdf"), "document", "PDF → document")
eq(detect_modality("doc.docx"), "document", "DOCX → document")
eq(detect_modality("doc.xlsx"), "document", "XLSX → document")
eq(detect_modality("doc.pptx"), "document", "PPTX → document")
eq(detect_modality("doc.txt"), "document", "TXT → document")
eq(detect_modality("doc.html"), "document", "HTML → document")
eq(detect_modality("doc.csv"), "document", "CSV → document")

eq(detect_modality("file.xyz"), "unknown", "Unknown ext → unknown")
eq(detect_modality("file.py"), "unknown", ".py → unknown")
eq(detect_modality("file"), "unknown", "No extension → unknown")

# Case insensitive
eq(detect_modality("PHOTO.PNG"), "image", "Uppercase .PNG → image")
eq(detect_modality("video.MP4"), "video", "Uppercase .MP4 → video")

# Path with directories
eq(detect_modality("/Users/test/Downloads/photo.jpg"), "image", "Full path → image")
eq(detect_modality("./relative/path/doc.pdf"), "document", "Relative path → document")

# ─── MIME_TYPES coverage ──────────────────────────────────────────────
print("\n## MIME_TYPES coverage")

ok('.png' in MIME_TYPES, "PNG MIME type defined")
ok('.jpg' in MIME_TYPES, "JPG MIME type defined")
ok('.mp4' in MIME_TYPES, "MP4 MIME type defined")
ok('.mp3' in MIME_TYPES, "MP3 MIME type defined")
ok('.pdf' in MIME_TYPES, "PDF MIME type defined")
ok('.docx' in MIME_TYPES, "DOCX MIME type defined")
ok('.csv' in MIME_TYPES, "CSV MIME type defined")

eq(MIME_TYPES['.png'], 'image/png', "PNG MIME = image/png")
eq(MIME_TYPES['.mp4'], 'video/mp4', "MP4 MIME = video/mp4")
eq(MIME_TYPES['.mp3'], 'audio/mpeg', "MP3 MIME = audio/mpeg")
eq(MIME_TYPES['.pdf'], 'application/pdf', "PDF MIME = application/pdf")

# Verify all MODALITY_MAP extensions have MIME types
all_extensions = set()
for exts in MODALITY_MAP.values():
    all_extensions.update(exts)

missing_mime = [ext for ext in all_extensions if ext not in MIME_TYPES]
ok(len(missing_mime) == 0, f"All modality extensions have MIME types (missing: {missing_mime})")

# ─── MODALITY_MAP consistency ─────────────────────────────────────────
print("\n## MODALITY_MAP consistency")

ok('image' in MODALITY_MAP, "image modality exists")
ok('video' in MODALITY_MAP, "video modality exists")
ok('audio' in MODALITY_MAP, "audio modality exists")
ok('document' in MODALITY_MAP, "document modality exists")
ok(len(MODALITY_MAP) == 4, f"Exactly 4 modalities (got {len(MODALITY_MAP)})")

# No overlap between modalities
all_exts = []
for exts in MODALITY_MAP.values():
    all_exts.extend(exts)
ok(len(all_exts) == len(set(all_exts)), "No overlapping extensions between modalities")

# ─── get_prompt ───────────────────────────────────────────────────────
print("\n## get_prompt()")

# Default prompts
p1 = get_prompt('analyze', 'image')
ok('image' in p1.lower() or 'analyze' in p1.lower(), "Default analyze/image prompt is meaningful")

p2 = get_prompt('transcribe', 'audio')
ok('transcribe' in p2.lower() or 'HH:MM:SS' in p2, "Default transcribe/audio prompt has timestamp format")

p3 = get_prompt('extract', 'document')
ok('markdown' in p3.lower() or 'extract' in p3.lower(), "Default extract/document prompt mentions markdown")

p4 = get_prompt('extract', 'image')
ok('ocr' in p4.lower() or 'text' in p4.lower(), "Default extract/image prompt mentions OCR/text")

# Custom prompt overrides default
p5 = get_prompt('analyze', 'image', custom_prompt="Focus on colors")
eq(p5, "Focus on colors", "Custom prompt overrides default")

# Fallback for unknown task/modality combo
p6 = get_prompt('analyze', 'unknown_modality')
ok(len(p6) > 0, "Unknown modality returns a fallback prompt")
ok('unknown_modality' in p6.lower(), "Fallback prompt includes modality name")

p7 = get_prompt('unknown_task', 'image')
ok(len(p7) > 0, "Unknown task returns a fallback prompt")

# ─── DEFAULT_PROMPTS structure ────────────────────────────────────────
print("\n## DEFAULT_PROMPTS structure")

ok('analyze' in DEFAULT_PROMPTS, "analyze task has prompts")
ok('transcribe' in DEFAULT_PROMPTS, "transcribe task has prompts")
ok('extract' in DEFAULT_PROMPTS, "extract task has prompts")

ok('image' in DEFAULT_PROMPTS['analyze'], "analyze has image prompt")
ok('video' in DEFAULT_PROMPTS['analyze'], "analyze has video prompt")
ok('audio' in DEFAULT_PROMPTS['analyze'], "analyze has audio prompt")
ok('document' in DEFAULT_PROMPTS['analyze'], "analyze has document prompt")

ok('audio' in DEFAULT_PROMPTS['transcribe'], "transcribe has audio prompt")
ok('video' in DEFAULT_PROMPTS['transcribe'], "transcribe has video prompt")

ok('document' in DEFAULT_PROMPTS['extract'], "extract has document prompt")
ok('image' in DEFAULT_PROMPTS['extract'], "extract has image prompt")

# ─── find_api_key — missing key ──────────────────────────────────────
print("\n## find_api_key() — missing key")

with patch.dict(os.environ, {}, clear=True):
    # Remove GEMINI_API_KEY if present
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ.pop('MEOWKIT_GEMINI_API_KEY', None)
    result = find_api_key()
    eq(result, None, "Returns None when GEMINI_API_KEY not set")

# ─── find_api_key — key present ──────────────────────────────────────
print("\n## find_api_key() — key present")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    result = find_api_key()
    eq(result, 'AIzaTestKey12345678901234567890', "Returns key from env")

# ─── analyze_file — error cases ──────────────────────────────────────
print("\n## analyze_file() — error cases")

# Missing API key
with patch.dict(os.environ, {}, clear=True):
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ.pop('MEOWKIT_GEMINI_API_KEY', None)
    result = analyze_file('/tmp/test.png', task='analyze')
    eq(result['status'], 'error', "Missing key → error status")
    ok('GEMINI_API_KEY' in result['error'] or 'MEOWKIT_GEMINI_API_KEY' in result['error'],
       "Error mentions API key")
    ok('aistudio.google.com' in result['error'], "Error includes setup URL")

# Missing file
with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    result = analyze_file('/tmp/nonexistent_file_xyz.png', task='analyze')
    eq(result['status'], 'error', "Missing file → error status")
    ok('not found' in result['error'].lower() or 'File not found' in result['error'],
       "Error mentions file not found")

# Unsupported format
with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    # Create a temp file with unsupported extension
    with tempfile.NamedTemporaryFile(suffix='.xyz', delete=False) as f:
        f.write(b"test")
        temp_path = f.name

    result = analyze_file(temp_path, task='analyze')
    eq(result['status'], 'error', "Unsupported format → error status")
    ok('unsupported' in result['error'].lower() or '.xyz' in result['error'],
       "Error mentions unsupported format")

    os.unlink(temp_path)

# ─── analyze_file — success path structure ────────────────────────────
print("\n## analyze_file() — success path (mocked)")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    # Create a temp PNG file
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        f.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)  # Minimal PNG-like bytes
        temp_png = f.name

    # Mock the genai client
    mock_response = MagicMock()
    mock_response.text = "This is a test image showing a landscape."
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch('analyze_core.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = analyze_file(temp_png, task='analyze')

        eq(result['status'], 'success', "Mocked call → success status")
        eq(result['modality'], 'image', "Modality detected as image")
        eq(result['model'], 'gemini-2.5-flash', "Default model is gemini-2.5-flash")
        eq(result['task'], 'analyze', "Task preserved")
        ok('result' in result, "Result contains 'result' field")
        ok('file_size_mb' in result, "Result contains file_size_mb")
        ok('token_estimate' in result, "Result contains token_estimate")
        ok(isinstance(result['token_estimate'], int), "token_estimate is int")

    os.unlink(temp_png)

# ─── analyze_file — auth error handling ───────────────────────────────
print("\n## analyze_file() — auth error (401)")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaBadKey'}):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        f.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
        temp_png = f.name

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("401 Unauthorized")

    with patch('analyze_core.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = analyze_file(temp_png, task='analyze', max_retries=1)
        eq(result['status'], 'error', "401 → error status")
        ok('invalid or expired' in result['error'].lower() or '401' in result['error'],
           "Error mentions auth failure")

    os.unlink(temp_png)

# ─── analyze_file — billing error handling ────────────────────────────
print("\n## analyze_file() — billing error")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        f.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
        temp_png = f.name

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception(
        "Billing account not configured for this project"
    )

    with patch('analyze_core.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = analyze_file(temp_png, task='analyze', max_retries=1)
        eq(result['status'], 'error', "Billing error → error status")
        ok('billing' in result['error'].lower(), "Error mentions billing")

    os.unlink(temp_png)

# ─── Summary ──────────────────────────────────────────────────────────
print(f"\n## Test Summary")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Total: {passed + failed}")

sys.exit(1 if failed > 0 else 0)
