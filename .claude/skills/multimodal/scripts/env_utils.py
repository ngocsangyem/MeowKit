"""Shared env var lookup with MEOWKIT_ prefix + legacy fallback.
Also consolidates load_env_files() (was duplicated in 4 scripts).
"""

import os
import re
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


REFUSED_KEYS = frozenset({
    'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
    'DYLD_FRAMEWORK_PATH', 'IFS', 'BASH_ENV', 'ENV',
})


def parse_env_file(content: str) -> dict:
    """Parse KEY=VALUE lines; the first definition of a key wins. Never evaluates anything."""
    out = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        key, sep, value = line.partition('=')
        key = key.strip()
        if not sep or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            continue
        if key in REFUSED_KEYS or key in out:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] in '"\'' and value.endswith(value[0]):
            # A quoted value keeps a literal `#`, which real API keys contain.
            value = value[1:-1]
        else:
            comment = re.search(r'\s#', value)
            if comment and comment.start() > 0:
                value = value[:comment.start()].rstrip()
        out[key] = value
    return out


def find_project_root() -> Path:
    """The open project: the runtime's variable, else the nearest folder above the working
    directory that holds `.meowkit/` (the home folder's own `.meowkit/` is not a project),
    else the working directory. Bounded so a run outside a project cannot climb to `/`."""
    for name in ('MEOWKIT_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'CURSOR_PROJECT_DIR'):
        if os.environ.get(name):
            return Path(os.environ[name])
    home = Path.home()
    cwd = Path.cwd()
    for candidate in [cwd, *cwd.parents][:12]:
        if candidate != home and (candidate / '.meowkit').is_dir():
            return candidate
    return cwd


def env_files() -> list:
    """The env files in priority order, highest first."""
    root = find_project_root()
    return [root / '.meowkit' / '.env', root / '.claude' / '.env', Path.home() / '.meowkit' / '.env']


def load_env_files():
    """Load the env files into os.environ without replacing anything already set.

    Order, highest first: shell export, the project's `.meowkit/.env`, the env file an
    older install kept in the runtime folder, then the user-wide `~/.meowkit/.env`. No coding agent reads a dotenv
    natively, so these scripts do their own loading, which is why one order works across
    Claude Code, Codex and Cursor. The project comes from the runtime or the working
    directory, not from where this script sits, so a skill installed under the home
    folder still reads the open project.
    """
    for env_path in env_files():
        try:
            content = env_path.read_text(encoding='utf-8')
        except OSError:
            continue
        for key, value in parse_env_file(content).items():
            os.environ.setdefault(key, value)
