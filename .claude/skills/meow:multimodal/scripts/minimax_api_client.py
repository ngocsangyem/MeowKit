"""MiniMax API client — shared HTTP utilities for all MiniMax generation.

Base URL: https://api.minimax.io/v1
Auth: Bearer token via MEOWKIT_MINIMAX_API_KEY.
Uses stdlib only (urllib.request) — no requests dependency.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env, load_env_files

BASE_URL = "https://api.minimax.io/v1"


def find_minimax_api_key() -> Optional[str]:
    """Find MEOWKIT_MINIMAX_API_KEY from env or .env files."""
    api_key = _env('MINIMAX_API_KEY')
    if api_key:
        return api_key
    load_env_files()
    return _env('MINIMAX_API_KEY')


def _request(method: str, url: str, api_key: str,
             body: Optional[Dict] = None, timeout: int = 120) -> Dict[str, Any]:
    """Make HTTP request to MiniMax API."""
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')[:200]
        raise Exception(f"MiniMax API HTTP {e.code}: {body_text}")
    except json.JSONDecodeError:
        raise Exception("MiniMax API returned non-JSON response")
    base_resp = result.get("base_resp", {})
    if base_resp.get("status_code", 0) != 0:
        raise Exception(f"MiniMax API error (code {base_resp.get('status_code')}): "
                        f"{base_resp.get('status_msg', 'Unknown')}")
    return result


def api_post(endpoint: str, payload: Dict, api_key: str,
             verbose: bool = False, timeout: int = 120) -> Dict[str, Any]:
    """POST to MiniMax API endpoint."""
    url = f"{BASE_URL}/{endpoint}"
    if verbose:
        print(f"  POST {url}", file=sys.stderr)
    return _request("POST", url, api_key, body=payload, timeout=timeout)


def api_get(endpoint: str, params: Dict[str, str], api_key: str,
            verbose: bool = False) -> Dict[str, Any]:
    """GET from MiniMax API endpoint with query params."""
    url = f"{BASE_URL}/{endpoint}?{urlencode(params)}"
    if verbose:
        print(f"  GET {url}", file=sys.stderr)
    return _request("GET", url, api_key, timeout=60)


def poll_async_task(task_id: str, task_type: str, api_key: str,
                    poll_interval: int = 10, max_wait: int = 600,
                    verbose: bool = False) -> Dict[str, Any]:
    """Poll async task until completion. Used for video generation."""
    start = time.monotonic()
    while (time.monotonic() - start) < max_wait:
        result = api_get(f"query/{task_type}", {"task_id": task_id}, api_key)
        status = result.get("status", "Unknown")
        elapsed = int(time.monotonic() - start)
        if verbose and elapsed > 0 and elapsed % 30 < poll_interval:
            print(f"  Polling... {elapsed}s, status: {status}", file=sys.stderr)
        if status == "Success":
            return result
        if status in ("Failed", "Error"):
            raise Exception(f"Task failed: {json.dumps(result)}")
        time.sleep(poll_interval)
    raise TimeoutError(f"Task {task_id} timed out after {max_wait}s")


def download_file(file_id: str, api_key: str, output_path: str,
                  verbose: bool = False) -> str:
    """Download file from MiniMax file service by file_id."""
    result = api_get("files/retrieve", {"file_id": file_id}, api_key)
    download_url = result.get("file", {}).get("download_url")
    if not download_url:
        raise Exception(f"No download URL in response: {json.dumps(result)}")
    if not download_url.startswith('https://'):
        raise Exception("Refusing non-HTTPS download URL")
    if verbose:
        print(f"  Downloading to: {output_path}", file=sys.stderr)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(download_url, timeout=300) as resp:
        Path(output_path).write_bytes(resp.read())
    return output_path
