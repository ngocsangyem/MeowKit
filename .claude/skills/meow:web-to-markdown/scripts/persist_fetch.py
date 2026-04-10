#!/usr/bin/env python3
"""
persist_fetch.py — Cache persistence layer for meow:web-to-markdown.

Responsibilities:
  - Directory bootstrap (.claude/cache/web-fetches/ + quarantine/)
  - Slug generation (YYMMDD-HHMMSS-host-kebab-sha256path[:10].md)
  - Frontmatter + content assembly
  - Atomic .tmp → os.replace write
  - Manifest append under fcntl.flock (append-only index.jsonl)
  - Secret scrub on content + URL via secret_scrub module (Layer 7)
  - Layer 8: post-write injection-audit.py scan via importlib direct import

Exports:
  persist(url, content, method, status, http_status, size_bytes,
          content_type, session_id, injection_warn, skill_version, caller) -> str
  quarantine(url, raw_content, reason) -> str
"""

import fcntl
import hashlib
import importlib.util
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from scripts.secret_scrub import scrub_content, scrub_url

# ---------------------------------------------------------------------------
# Path constants (resolved relative to project root at import time)
# ---------------------------------------------------------------------------

def _find_project_root() -> Path:
    """Walk up from this file to find the project root.

    Previous logic searched for .claude/ directory, but skill subdirs also
    contain .claude/, causing resolution to stop at the skill dir instead of
    the actual project root. Uses multiple sentinels for robustness:
    - CLAUDE.md — created by Claude Code and npx mewkit init
    - .claude/settings.json — always exists at project root, never in skill subdirs
    """
    for parent in Path(__file__).resolve().parents:
        if (parent / "CLAUDE.md").exists():
            return parent
        if (parent / ".claude" / "settings.json").exists():
            return parent
    return Path.cwd()


PROJECT_ROOT = _find_project_root()
CACHE_ROOT = PROJECT_ROOT / ".claude" / "cache" / "web-fetches"
QUARANTINE_DIR = CACHE_ROOT / "quarantine"
MANIFEST_PATH = CACHE_ROOT / "index.jsonl"
SECURITY_LOG = PROJECT_ROOT / ".claude" / "memory" / "security-log.md"


# ---------------------------------------------------------------------------
# Directory bootstrap
# ---------------------------------------------------------------------------

def _bootstrap_dirs() -> None:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)
    SECURITY_LOG.parent.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------

def _host_kebab(hostname: str) -> str:
    """docs.example.com → docs-example-com (capped at 40 chars)."""
    import re
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", hostname).strip("-").lower()
    return slug[:40]


def _path_hash(url: str) -> str:
    """SHA-256 of URL path → first 10 hex chars (prevents tokens in filenames — C9)."""
    path = urlparse(url).path or "/"
    return hashlib.sha256(path.encode()).hexdigest()[:10]


def _make_slug(url: str) -> str:
    """YYMMDD-HHMMSS-host-kebab-sha256path[:10].md"""
    ts = datetime.now(timezone.utc).strftime("%y%m%d-%H%M%S")
    host = urlparse(url).hostname or "unknown"
    return f"{ts}-{_host_kebab(host)}-{_path_hash(url)}.md"


# ---------------------------------------------------------------------------
# Frontmatter builder
# ---------------------------------------------------------------------------

def _build_frontmatter(*, url: str, method: str, status: str, http_status: int,
                        size_bytes: int, content_type: str, session_id: str,
                        injection_warn: bool, skill_version: str, caller: str,
                        slug: str) -> str:
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    clean_url = scrub_url(url)
    return (
        "---\n"
        f"url: {clean_url}\n"
        f"fetched_at: {ts}\n"
        f"method: {method}\n"
        f"status: {status}\n"
        f"http_status: {http_status}\n"
        f"size_bytes: {size_bytes}\n"
        f"content_type: {content_type}\n"
        f"session_id: {session_id}\n"
        f"injection_warn: {str(injection_warn).lower()}\n"
        f"caller: {caller}\n"
        f"skill_version: {skill_version}\n"
        f"slug: {slug}\n"
        "---\n\n"
    )


# ---------------------------------------------------------------------------
# Manifest + security log
# ---------------------------------------------------------------------------

def _append_manifest(entry: dict) -> None:
    """Append one JSON line to index.jsonl under an exclusive flock."""
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    with open(MANIFEST_PATH, "a", encoding="utf-8") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            fh.write(line)
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def _log_security(message: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%y%m%d-%H%M%S")
    try:
        with open(SECURITY_LOG, "a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] {message}\n")
    except OSError:
        pass  # log failure must not break main flow


# ---------------------------------------------------------------------------
# Atomic file write helper
# ---------------------------------------------------------------------------

def _atomic_write(dest: Path, content_bytes: bytes) -> None:
    """Write bytes to dest atomically via a .tmp sibling + os.replace."""
    tmp_fd, tmp_path = tempfile.mkstemp(dir=dest.parent, suffix=".tmp")
    try:
        with os.fdopen(tmp_fd, "wb") as fh:
            fh.write(content_bytes)
        os.replace(tmp_path, dest)
    except OSError:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Layer 8: post-write injection-audit.py scan
# ---------------------------------------------------------------------------

def _load_injection_audit():
    """Import injection_audit module via importlib (direct import, not CLI — see security.md §Layer 8)."""
    audit_path = PROJECT_ROOT / ".claude" / "scripts" / "injection-audit.py"
    if not audit_path.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location("injection_audit", audit_path)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)  # type: ignore[union-attr]
        return module
    except Exception:
        return None


def _post_write_audit(report_path: Path, url: str, manifest_entry: dict) -> str | None:
    """
    Layer 8: run injection_audit.scan_file after successful persist.
    On CRITICAL findings → retroactive quarantine, corrective manifest entry, security-log.
    Returns INJECTION_STOP string if quarantined, None if clean.
    """
    audit = _load_injection_audit()
    if audit is None:
        return None
    try:
        findings = audit.scan_file(report_path)
    except Exception as exc:
        # Fail-closed: a runtime scan_file exception is suspicious (corrupted pattern file,
        # bad Path type, import error). Log as WARN and treat as CRITICAL to quarantine.
        _log_security(f"[WARN] [meow:web-to-markdown] Layer 8 audit errored: {exc} — treating as CRITICAL (url={scrub_url(url)})")
        # Retroactive quarantine on audit failure
        content_sha = hashlib.sha256(report_path.read_bytes()).hexdigest()[:16] if report_path.exists() else "unknown"
        q_path = QUARANTINE_DIR / f"{content_sha}-audit-error.quarantined"
        try:
            if report_path.exists():
                shutil.move(str(report_path), str(q_path))
                q_path.chmod(0o400)
        except OSError:
            pass
        correction = dict(manifest_entry)
        correction["status"] = "superseded_by_quarantine"
        correction["quarantine_path"] = str(q_path)
        correction["layer8_criticals"] = [f"audit_exception: {exc}"]
        _append_manifest(correction)
        return (
            f"INJECTION_STOP (Layer 8 audit error): scan_file raised {exc!r}\n"
            f"Content quarantined at {q_path}\n"
            "Manual review required. No programmatic bypass."
        )

    criticals = [f for f in findings if getattr(f, "level", "") == "CRITICAL"]
    if not criticals:
        return None

    # Retroactive quarantine
    content_sha = hashlib.sha256(report_path.read_bytes()).hexdigest()[:16]
    q_path = QUARANTINE_DIR / f"{content_sha}.quarantined"
    try:
        shutil.move(str(report_path), str(q_path))
        q_path.chmod(0o400)
    except OSError:
        pass

    # Corrective manifest entry
    correction = dict(manifest_entry)
    correction["status"] = "superseded_by_quarantine"
    correction["quarantine_path"] = str(q_path)
    correction["layer8_criticals"] = [c.description for c in criticals]
    _append_manifest(correction)

    desc = criticals[0].description
    _log_security(
        f"[CRITICAL] [meow:web-to-markdown] [Layer8] Post-write audit: {desc} "
        f"→ retroactive quarantine {q_path} (url={scrub_url(url)})"
    )
    return (
        f"INJECTION_STOP (post-write audit): {desc}\n"
        f"Content quarantined at {q_path}\n"
        "Manual review required. No programmatic bypass."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def persist(
    url: str,
    content: str,
    method: str,
    status: str,
    http_status: int,
    size_bytes: int,
    content_type: str,
    session_id: str,
    injection_warn: bool,
    skill_version: str,
    caller: str = "user:direct",
) -> str:
    """
    Write fetched markdown to .claude/cache/web-fetches/<slug>.md atomically.
    Applies Layer 7 secret scrub before write.
    Appends manifest entry under fcntl.flock.
    Runs Layer 8 post-write audit; on CRITICAL → retroactive quarantine.

    Returns report file path string, or INJECTION_STOP string on Layer 8 hit.
    """
    _bootstrap_dirs()
    slug = _make_slug(url)
    report_path = CACHE_ROOT / slug

    # Layer 7: secret scrub before any disk write
    clean_content = scrub_content(content)
    clean_url = scrub_url(url)

    frontmatter = _build_frontmatter(
        url=url, method=method, status=status, http_status=http_status,
        size_bytes=size_bytes, content_type=content_type, session_id=session_id,
        injection_warn=injection_warn, skill_version=skill_version, caller=caller,
        slug=slug,
    )
    full_text = frontmatter + clean_content
    _atomic_write(report_path, full_text.encode("utf-8"))

    # Manifest entry
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    sha = hashlib.sha256(clean_content.encode()).hexdigest()[:16]
    manifest_entry: dict = {
        "ts": ts, "url": clean_url, "caller": caller, "method": method,
        "status": status, "http_status": http_status, "size": size_bytes,
        "content_type": content_type, "report": str(report_path), "sha": sha,
        "session": session_id, "skill_version": skill_version,
        "injection_warn": injection_warn,
    }
    _append_manifest(manifest_entry)

    # Layer 8
    stop_msg = _post_write_audit(report_path, url, manifest_entry)
    if stop_msg:
        return stop_msg

    return str(report_path)


def quarantine(url: str, raw_content: str | bytes, reason: str) -> str:
    """
    Write injection-stopped content to quarantine bucket with 0400 perms.
    Log to security-log. Append manifest entry with status=injection_stop.
    Returns quarantine file path string.
    """
    _bootstrap_dirs()

    raw_bytes = raw_content.encode("utf-8", errors="replace") if isinstance(raw_content, str) else raw_content
    content_sha = hashlib.sha256(raw_bytes).hexdigest()[:16]
    q_path = QUARANTINE_DIR / f"{content_sha}.quarantined"

    _atomic_write(q_path, raw_bytes)
    try:
        q_path.chmod(0o400)
    except OSError:
        pass

    clean_url = scrub_url(url)
    _log_security(
        f"[CRITICAL] [meow:web-to-markdown] Injection detected → quarantined "
        f"at {q_path} — reason: {reason} (url={clean_url})"
    )

    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    _append_manifest({
        "ts": ts, "url": clean_url, "caller": "unknown", "method": "unknown",
        "status": "injection_stop", "http_status": 0, "size": len(raw_bytes),
        "content_type": "", "report": str(q_path), "sha": content_sha,
        "session": "", "skill_version": "unknown", "injection_warn": True,
    })

    return str(q_path)
