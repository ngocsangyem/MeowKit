"""Shared env var lookup with MEOWKIT_ prefix + legacy fallback.
Also consolidates load_env_files() (was duplicated in 4 scripts).
"""

import os
from pathlib import Path
from typing import Optional


def _env(name: str) -> Optional[str]:
    """Get env var: MEOWKIT_{name} first, then {name} (legacy fallback).
    Returns None for empty/whitespace-only values.
    """
    val = os.getenv(f'MEOWKIT_{name}') or os.getenv(name)
    if val and val.strip():
        return val.strip()
    return None


def _find_meowkit_dir(start: Path) -> Optional[Path]:
    """Walk up for the project's `.meowkit/` state dir. Bounded so a script run from
    outside a project cannot climb to the filesystem root."""
    for candidate in [start, *start.parents][:12]:
        meowkit = candidate / '.meowkit'
        if meowkit.is_dir():
            return meowkit
    return None


def load_env_files():
    """Load .env files. Priority: shell exports > skill .env > .meowkit/.env > the bundle's own .env.

    Uses override=False so shell exports always win and the first file to set a var wins.

    `.meowkit/.env` is the project-wide file shared by every provider. No coding agent reads
    a dotenv natively — Codex documents only `[shell_environment_policy]` for passing env to
    subprocesses — so these scripts do their own loading, which is exactly why one shared
    location works across Claude Code, Codex, and Cursor. The provider-local `.env` stays as
    a fallback for installs that predate the move.
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent
    agents_dir = skill_dir.parent.parent
    meowkit_dir = _find_meowkit_dir(script_dir)
    candidates = [skill_dir / '.env']
    if meowkit_dir is not None:
        candidates.append(meowkit_dir / '.env')
    candidates.append(agents_dir / '.env')
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=False)
