"""OpenRouter fallback for image generation.

Uses stdlib only (urllib.request) — no new dependencies.
Requires OPENROUTER_FALLBACK_ENABLED=true.
Always prints a warning when fallback activates (privacy disclosure).

Uses /api/v1/chat/completions with modalities: ["image"] per OpenRouter docs.
"""

import base64
import json
import sys
import time
import urllib.request
from pathlib import Path
from typing import Dict, Any

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def is_fallback_enabled() -> bool:
    """Check if OpenRouter fallback is explicitly enabled."""
    return (_env('OPENROUTER_FALLBACK_ENABLED') or '').lower() == 'true'


def generate_image_openrouter(
    prompt: str,
    output_dir: str = './output',
    model: str = '',
    verbose: bool = False,
) -> Dict[str, Any]:
    """Generate image via OpenRouter chat completions API.

    Returns dict with status, provider, file_path or error.
    """
    model = model or _env('OPENROUTER_IMAGE_MODEL') or 'black-forest-labs/flux-1-schnell'

    if not is_fallback_enabled():
        return {
            'status': 'error',
            'error': 'OpenRouter fallback disabled. Set MEOWKIT_OPENROUTER_FALLBACK_ENABLED=true to enable.',
        }

    api_key = _env('OPENROUTER_API_KEY')
    if not api_key:
        return {'status': 'error', 'error': 'MEOWKIT_OPENROUTER_API_KEY not set (or OPENROUTER_API_KEY)'}

    print(
        "[NOTICE] Falling back to OpenRouter (third-party). "
        "Your prompt will be sent to openrouter.ai.",
        file=sys.stderr,
    )

    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image"],
    }).encode()
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())

        out_path = Path(output_dir) / f"openrouter_{model.split('/')[-1]}_{int(time.time())}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        # Extract image from chat completions response
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})

        # Try message.images format
        images = message.get("images", [])
        if images:
            img_url = images[0].get("image_url", {}).get("url", "")
            if img_url.startswith("data:"):
                b64_data = img_url.split(",", 1)[1]
                out_path.write_bytes(base64.b64decode(b64_data))
            else:
                urllib.request.urlretrieve(img_url, str(out_path))
        # Try content array format
        elif isinstance(message.get("content"), list):
            for part in message["content"]:
                if part.get("type") == "image_url":
                    img_url = part.get("image_url", {}).get("url", "")
                    if img_url.startswith("data:"):
                        b64_data = img_url.split(",", 1)[1]
                        out_path.write_bytes(base64.b64decode(b64_data))
                    else:
                        urllib.request.urlretrieve(img_url, str(out_path))
                    break
        else:
            return {'status': 'error', 'provider': 'openrouter', 'error': 'No image in response'}

        if out_path.exists() and out_path.stat().st_size > 0:
            return {
                'status': 'success',
                'provider': 'openrouter',
                'model': model,
                'output_file': str(out_path),
            }
        return {'status': 'error', 'provider': 'openrouter', 'error': 'Image file empty after download'}

    except Exception as e:
        return {'status': 'error', 'provider': 'openrouter', 'error': str(e)}
