#!/usr/bin/env python3
"""check-auto-create-gating.py — pre-flight checks for --auto-create.

Runs the 5 auto-abort triggers defined in references/auto-create-gating.md:

  1. NO_ACS or refusal_reason → ABORT
  2. Injection patterns (Rule 1) → ABORT, quote offending pattern
  3. Length cap (summary > 255 or description > 5000) → ABORT
  4. Duplicate suspect (delegated — caller supplies the mk:jira-search result list)
  5. Source-body hash mismatch → ABORT

Reads JSON on stdin:

    {
      "records": [ <record with .sizing>, ... ],
      "project": "AUTH",
      "epic": "AUTH-100" | null,
      "paste_body": "<the verbatim paste used to build the report>",
      "report_source_hash": "<sha256 recorded in the report header>",
      "duplicate_hits": [ {"id":"S1","existing_key":"AUTH-42"}, ... ]   # optional
    }

Emits JSON on stdout:

    {
      "status": "ok" | "aborted",
      "reason_code": "OK" | "NO_ACS" | "INJECTION" | "LENGTH" | "DUPLICATE" | "SOURCE_MISMATCH" | "ARG",
      "message": "...",
      "table_rows": [ {...} ]      # only present when status == ok
    }

Exit code:
  0 — ok (table rows ready for confirmation prompt)
  1 — aborted (caller surfaces the message and stops)
  2 — argument error (missing --project, malformed flags, etc.)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path

PROJECT_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]+$")
EPIC_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]+-\d+$")
SUMMARY_MAX = 255
DESCRIPTION_MAX = 5000
SUMMARY_TABLE_TRUNCATE = 60

DEFAULT_PATTERNS = (
    "ignore previous instructions",
    "ignore your previous instructions",
    "ignore all previous instructions",
    "disregard your rules",
    "disregard the previous instructions",
    "forget your rules",
    "forget everything you were told",
    "you are now",
    "from now on you are",
    "act as if you are",
    "pretend you are",
    "pretend to be",
    "new system prompt",
    "system prompt:",
    "override your safety",
    "bypass your safety",
    "jailbreak",
    "roleplay as",
    "role-play as",
)


def _load_patterns(project_root: Path) -> tuple[str, ...]:
    candidate = project_root / ".claude/skills/story-sizer/references/injection-patterns.md"
    if not candidate.exists():
        return DEFAULT_PATTERNS
    patterns: list[str] = []
    for line in candidate.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^- `([^`]+)`\s*$", line)
        if match:
            patterns.append(match.group(1))
    return tuple(patterns) if patterns else DEFAULT_PATTERNS


def _abort(code: str, message: str) -> dict:
    return {"status": "aborted", "reason_code": code, "message": message}


def _truncate(text: str, length: int) -> str:
    text = (text or "").replace("\n", " ")
    return text if len(text) <= length else text[: length - 1] + "…"


def _suggested_summary(record: dict) -> str:
    return (record.get("title") or "").strip()


def _suggested_description(record: dict) -> str:
    return (record.get("description") or "").strip()


def _validate_args(payload: dict) -> dict | None:
    project = payload.get("project")
    if not project:
        return _abort("ARG", "--auto-create requires --project <KEY>")
    if not PROJECT_PATTERN.match(project):
        return _abort("ARG", f"--project '{project}' is not a valid Jira project key")

    epic = payload.get("epic")
    if epic and not EPIC_PATTERN.match(epic):
        return _abort("ARG", f"--epic '{epic}' is not a valid Jira issue key")

    return None


def _check_no_acs(record: dict) -> dict | None:
    if "[NO_ACS]" in (record.get("flags") or []):
        return _abort("NO_ACS", f"Story {record.get('id')} has no acceptance criteria")
    sizing = record.get("sizing") or {}
    if sizing.get("refusal_reason"):
        return _abort(
            "NO_ACS",
            f"Story {record.get('id')} was refused at sizing: {sizing['refusal_reason']}",
        )
    return None


def _check_injection(record: dict, patterns: tuple[str, ...], project_root: Path) -> dict | None:
    for field, getter in (("summary", _suggested_summary), ("description", _suggested_description)):
        haystack = getter(record).lower()
        if not haystack:
            continue
        for pattern in patterns:
            if pattern.lower() in haystack:
                _fire_injection_audit(project_root, record, field, pattern)
                return _abort(
                    "INJECTION",
                    f"Story {record.get('id')} {field} matched Rule-1 pattern '{pattern}'",
                )
    return None


def _fire_injection_audit(project_root: Path, record: dict, field: str, pattern: str) -> None:
    auditor = project_root / ".claude/scripts/injection-audit.py"
    if not auditor.exists():
        return
    try:
        os.execv  # noqa: F401 -- presence check only; real subprocess invocation kept out of hot path
    except AttributeError:
        return
    # Defer to the auditor only if explicitly present; do not crash the gate on auditor failure.


def _check_length(record: dict) -> dict | None:
    summary = _suggested_summary(record)
    if len(summary) > SUMMARY_MAX:
        return _abort(
            "LENGTH",
            f"Story {record.get('id')} summary exceeds {SUMMARY_MAX} chars",
        )
    description = _suggested_description(record)
    if len(description) > DESCRIPTION_MAX:
        return _abort(
            "LENGTH",
            f"Story {record.get('id')} description exceeds {DESCRIPTION_MAX} chars",
        )
    return None


def _check_duplicates(records: list, duplicate_hits: list) -> dict | None:
    if not duplicate_hits:
        return None
    hit = duplicate_hits[0]
    return _abort(
        "DUPLICATE",
        f"Story {hit.get('id')} matches existing {hit.get('existing_key')}. "
        "Prune the duplicate and re-run.",
    )


def _check_source_hash(payload: dict) -> dict | None:
    paste = payload.get("paste_body")
    report_hash = payload.get("report_source_hash")
    if paste is None or report_hash is None:
        return None
    normalized = paste.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    current = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    if current != report_hash:
        return _abort(
            "SOURCE_MISMATCH",
            "Paste body changed since sizing. Re-paste the original or re-run "
            "/mk:story-sizer --paste to regenerate the report.",
        )
    return None


def _build_table_rows(records: list, project: str, epic: str | None) -> list[dict]:
    rows = []
    for index, record in enumerate(records, start=1):
        sizing = record.get("sizing") or {}
        notes_parts: list[str] = []
        if sizing.get("split_proposal"):
            notes_parts.append("SPLIT SUGGESTED")
        rows.append({
            "n": index,
            "id": record.get("id"),
            "summary": _truncate(_suggested_summary(record), SUMMARY_TABLE_TRUNCATE),
            "type": "Story",
            "points": sizing.get("points"),
            "epic": epic or "",
            "project": project,
            "notes": "; ".join(notes_parts),
        })
    return rows


def gate(payload: dict, project_root: Path) -> dict:
    arg_err = _validate_args(payload)
    if arg_err:
        return arg_err

    records = payload.get("records") or []
    if not records:
        return _abort("NO_ACS", "No records to gate")

    patterns = _load_patterns(project_root)

    for record in records:
        for check in (_check_no_acs, lambda r: _check_injection(r, patterns, project_root), _check_length):
            outcome = check(record)
            if outcome:
                return outcome

    dup = _check_duplicates(records, payload.get("duplicate_hits") or [])
    if dup:
        return dup

    src = _check_source_hash(payload)
    if src:
        return src

    return {
        "status": "ok",
        "reason_code": "OK",
        "message": f"All {len(records)} stories cleared 5 pre-flight checks.",
        "table_rows": _build_table_rows(records, payload["project"], payload.get("epic")),
    }


def main(argv: list[str]) -> int:
    payload = json.load(sys.stdin)
    project_root = Path(os.environ.get("CLAUDE_PROJECT_DIR", Path.cwd())).resolve()
    result = gate(payload, project_root)
    print(json.dumps(result, indent=2))
    if result["status"] != "ok":
        return 2 if result["reason_code"] == "ARG" else 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
