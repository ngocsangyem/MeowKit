#!/usr/bin/env python3
"""
Tests for gemini_generate.py — unit tests (no API key / network required).

Tests cover:
- find_api_key(): missing key behavior
- generate_image(): missing key error, billing error, model selection
- generate_video(): missing key error, billing error
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

# Mock google.genai before import
mock_genai = MagicMock()
mock_types = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = mock_genai
sys.modules['google.genai.types'] = mock_types

from gemini_generate import (
    find_api_key,
    generate_image,
    generate_video,
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


print("Running gemini_generate.py tests...\n")

# ─── find_api_key ─────────────────────────────────────────────────────
print("## find_api_key()")

with patch.dict(os.environ, {}, clear=True):
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ.pop('MEOWKIT_GEMINI_API_KEY', None)
    eq(find_api_key(), None, "Returns None when key not set")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestGenKey'}):
    eq(find_api_key(), 'AIzaTestGenKey', "Returns key from env")

# ─── generate_image — missing API key ─────────────────────────────────
print("\n## generate_image() — missing API key")

with patch.dict(os.environ, {}, clear=True):
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ.pop('MEOWKIT_GEMINI_API_KEY', None)
    result = generate_image("A sunset", output_dir=tempfile.mkdtemp())
    eq(result['status'], 'error', "Missing key → error")
    ok('GEMINI_API_KEY' in result['error'] or 'MEOWKIT_GEMINI_API_KEY' in result['error'],
       "Error mentions API key")

# ─── generate_image — imagen model success ────────────────────────────
print("\n## generate_image() — imagen model (mocked)")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    output_dir = tempfile.mkdtemp()

    mock_img = MagicMock()
    mock_img.image.image_bytes = b'\x89PNG fake image data'

    mock_response = MagicMock()
    mock_response.generated_images = [mock_img]

    mock_client = MagicMock()
    mock_client.models.generate_images.return_value = mock_response

    with patch('gemini_generate.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_image(
            "A sunset over mountains",
            model='imagen-4.0-generate-001',
            output_dir=output_dir,
        )

        eq(result['status'], 'success', "Imagen generation → success")
        eq(result['model'], 'imagen-4.0-generate-001', "Model preserved")
        eq(result['prompt'], 'A sunset over mountains', "Prompt preserved")
        ok('output_file' in result, "Result has output_file")
        ok(result['output_file'].endswith('.png'), "Output file is .png")
        ok(Path(result['output_file']).exists(), "Output file was created")
        ok('aspect_ratio' in result, "Result has aspect_ratio")

# ─── generate_image — nano banana model success ──────────────────────
print("\n## generate_image() — nano banana model (mocked)")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    output_dir = tempfile.mkdtemp()

    mock_part = MagicMock()
    mock_part.inline_data.mime_type = 'image/png'
    mock_part.inline_data.data = b'\x89PNG nano banana image'

    mock_content = MagicMock()
    mock_content.parts = [mock_part]

    mock_candidate = MagicMock()
    mock_candidate.content = mock_content

    mock_response = MagicMock()
    mock_response.candidates = [mock_candidate]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch('gemini_generate.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_image(
            "A logo design",
            model='gemini-2.5-flash-image',
            output_dir=output_dir,
        )

        eq(result['status'], 'success', "Nano Banana generation → success")
        eq(result['model'], 'gemini-2.5-flash-image', "Model preserved")
        ok('output_file' in result, "Result has output_file")

# ─── generate_image — no image in response ────────────────────────────
print("\n## generate_image() — no image in response")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    mock_response = MagicMock()
    mock_response.generated_images = []

    mock_client = MagicMock()
    mock_client.models.generate_images.return_value = mock_response

    with patch('gemini_generate.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_image("test", model='imagen-4.0-generate-001',
                                output_dir=tempfile.mkdtemp())
        eq(result['status'], 'error', "Empty response → error")
        ok('no image' in result['error'].lower(), "Error mentions no image")

# ─── generate_image — billing error ───────────────────────────────────
print("\n## generate_image() — billing error")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    mock_client = MagicMock()
    mock_client.models.generate_images.side_effect = Exception(
        "Billing is not enabled for this project"
    )

    with patch('gemini_generate.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_image("test", model='imagen-4.0-generate-001',
                                output_dir=tempfile.mkdtemp())
        eq(result['status'], 'error', "Billing error → error")
        ok('billing' in result['error'].lower(), "Error mentions billing")

# ─── generate_video — missing API key ─────────────────────────────────
print("\n## generate_video() — missing API key")

with patch.dict(os.environ, {}, clear=True):
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ.pop('MEOWKIT_GEMINI_API_KEY', None)
    result = generate_video("A cat", output_dir=tempfile.mkdtemp())
    eq(result['status'], 'error', "Missing key → error")
    ok('GEMINI_API_KEY' in result['error'] or 'MEOWKIT_GEMINI_API_KEY' in result['error'],
       "Error mentions API key")

# ─── generate_video — billing error ───────────────────────────────────
# generate_video lives in video_generator.py — patch that module's genai
print("\n## generate_video() — billing error")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    mock_client = MagicMock()
    mock_client.models.generate_videos.side_effect = Exception(
        "Billing account not configured"
    )

    with patch('video_generator.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_video("test", output_dir=tempfile.mkdtemp())
        eq(result['status'], 'error', "Billing error → error")
        ok('billing' in result['error'].lower(), "Error mentions billing")

# ─── generate_video — generic error ──────────────────────────────────
print("\n## generate_video() — generic error")

with patch.dict(os.environ, {'GEMINI_API_KEY': 'AIzaTestKey12345678901234567890'}):
    mock_client = MagicMock()
    mock_client.models.generate_videos.side_effect = Exception("Network timeout")

    with patch('video_generator.genai') as patched_genai:
        patched_genai.Client.return_value = mock_client

        result = generate_video("test", output_dir=tempfile.mkdtemp())
        eq(result['status'], 'error', "Generic error → error")
        ok('network timeout' in result['error'].lower(), "Error preserves original message")

# ─── Summary ──────────────────────────────────────────────────────────
print(f"\n## Test Summary")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Total: {passed + failed}")

sys.exit(1 if failed > 0 else 0)
