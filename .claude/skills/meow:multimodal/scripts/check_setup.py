#!/usr/bin/env python3
"""
Validate meow:multimodal skill setup.

Checks:
- GEMINI_API_KEY presence and format
- Python dependencies (google-genai, pillow)
- Live API connection test
"""

import os
import sys
from pathlib import Path

# Fix Windows encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


def ok(msg): print(f"{GREEN}✓ {msg}{RESET}")
def warn(msg): print(f"{YELLOW}⚠ {msg}{RESET}")
def fail(msg): print(f"{RED}✗ {msg}{RESET}")
def info(msg): print(f"{BLUE}ℹ {msg}{RESET}")


sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env, load_env_files


def check_api_key():
    """Check GEMINI_API_KEY presence and format."""
    print(f"\n{BOLD}{BLUE}Checking API Key{RESET}")

    load_env_files()
    api_key = _env('GEMINI_API_KEY')

    if not api_key:
        fail("GEMINI_API_KEY not found")
        info("Set it: export MEOWKIT_GEMINI_API_KEY='your-key'")
        info("Legacy: export GEMINI_API_KEY='your-key' (also works)")
        info("Or add to .env: MEOWKIT_GEMINI_API_KEY=your-key")
        info("Get a key: https://aistudio.google.com/apikey")
        return None

    ok("GEMINI_API_KEY found")

    # Format check
    if api_key.startswith('AIza'):
        ok("Key format: Google AI Studio (AIza...)")
    elif len(api_key) > 20:
        warn("Key format: not standard AIza prefix (may be Vertex AI)")
    else:
        fail("Key format: too short — likely invalid")
        return None

    info(f"Key preview: {api_key[:4]}...{api_key[-2:]}")
    return api_key


def check_dependencies():
    """Check required Python packages."""
    print(f"\n{BOLD}{BLUE}Checking Dependencies{RESET}")

    deps = {
        'google.genai': 'google-genai',
        'PIL': 'pillow',
    }

    missing = []
    for module, package in deps.items():
        try:
            __import__(module)
            ok(f"{package} installed")
        except ImportError:
            fail(f"{package} NOT installed")
            missing.append(package)

    # Optional deps
    try:
        from dotenv import load_dotenv
        ok("python-dotenv installed (optional)")
    except ImportError:
        warn("python-dotenv not installed (optional — .env files won't auto-load)")

    if missing:
        fail(f"\nInstall missing: pip install {' '.join(missing)}")
        return False

    return True


def test_api_connection(api_key):
    """Test live API connection."""
    print(f"\n{BOLD}{BLUE}Testing API Connection{RESET}")

    try:
        from google import genai
        client = genai.Client(api_key=api_key)

        info("Listing models...")
        models = list(client.models.list())
        ok(f"API connection OK — {len(models)} models available")

        # Check for key models
        model_names = {m.name for m in models}
        for needed in ['models/gemini-2.5-flash', 'models/gemini-2.5-pro']:
            if needed in model_names:
                ok(f"  {needed.split('/')[-1]} available")

        return True

    except Exception as e:
        fail(f"API connection failed: {e}")
        return False


def main():
    print(f"\n{BOLD}meow:multimodal — Setup Checker{RESET}")

    all_ok = True

    api_key = check_api_key()
    if not api_key:
        all_ok = False

    if not check_dependencies():
        all_ok = False

    if api_key and all_ok:
        if not test_api_connection(api_key):
            all_ok = False

    print(f"\n{BOLD}{BLUE}{'='*50}{RESET}")
    if all_ok:
        ok("All checks passed! meow:multimodal is ready.")
        print(f"\nQuick test:")
        print(f"  python scripts/gemini_analyze.py --files image.png --task analyze")
    else:
        fail("Some checks failed. Fix the issues above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
