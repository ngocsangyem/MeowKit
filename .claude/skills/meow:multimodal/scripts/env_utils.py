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


def load_env_files():
    """Load .env files. Priority: shell exports > skill .env > .claude/.env.

    Uses override=False so shell exports always win.
    Loads skill-specific FIRST (higher priority), then central (lower priority).
    First file to set a var wins (since override=False).
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent
    claude_dir = skill_dir.parent.parent
    # Skill .env first (higher priority), then central .env (defaults)
    for env_path in [skill_dir / '.env', claude_dir / '.env']:
        if env_path.exists():
            load_dotenv(env_path, override=False)
