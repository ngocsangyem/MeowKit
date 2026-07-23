#!/usr/bin/env python3
"""parse-paste-stories.py — paste-mode markdown parser.

Reads a strict markdown template from stdin or a path, emits a JSON list of
StoryRecord objects on stdout. Errors (malformed input, length cap violations,
unknown keys) are emitted to stderr with the offending line number; the
exit code is non-zero only when zero valid records can be produced.

Schema (per references/input-adapter.md):

    {
      "source_hash": "<sha256-of-full-paste-body>",
      "records": [
        {
          "id": "S1",
          "title": "...",
          "description": "...",
          "acceptance_criteria": ["...", "..."],
          "source_body": "...",
          "source_hash": "<same as above>",
          "flags": []           # ["[NO_ACS]"] when AC list missing/empty
        }
      ],
      "errors": [               # non-fatal malformed-block messages
        {"line": 12, "code": "[MALFORMED_INPUT]", "message": "..."}
      ]
    }

Caller (SKILL.md / agent layer) decides whether to ABORT based on errors and
record count. A record with the [NO_ACS] flag is included in the output so the
caller can surface "story X has no acceptance criteria" before refusing to size.
"""
from __future__ import annotations

import hashlib
import json
import sys
from typing import Optional

TITLE_MAX = 255
DESCRIPTION_MAX = 5000
AC_MAX = 500
SEPARATOR = "---"
KNOWN_KEYS = ("story:", "description:", "ac:")


def _normalize(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")


def _split_blocks(text: str) -> list[tuple[int, str]]:
    """Return (starting_line_number, block_text) pairs split on bare '---' lines."""
    blocks: list[tuple[int, str]] = []
    current: list[str] = []
    start_line = 1
    line_no = 0
    for line in text.split("\n"):
        line_no += 1
        if line.strip() == SEPARATOR:
            if current:
                blocks.append((start_line, "\n".join(current)))
                current = []
            start_line = line_no + 1
        else:
            current.append(line)
    if current and any(part.strip() for part in current):
        blocks.append((start_line, "\n".join(current)))
    return blocks


def _parse_block(start_line: int, block: str) -> tuple[Optional[dict], list[dict]]:
    """Parse one block. Returns (record-or-None, error-list)."""
    errors: list[dict] = []
    title: Optional[str] = None
    description = ""
    acceptance: list[str] = []

    lines = block.split("\n")
    i = 0
    while i < len(lines):
        raw = lines[i]
        line_no = start_line + i
        line = raw.strip()
        if not line:
            i += 1
            continue

        lower = line.lower()
        if lower.startswith("story:"):
            title = line[len("story:"):].strip()
            i += 1
        elif lower.startswith("description:"):
            description = line[len("description:"):].strip()
            i += 1
        elif lower.startswith("ac:"):
            i += 1
            while i < len(lines):
                ac_raw = lines[i]
                ac_stripped = ac_raw.strip()
                if not ac_stripped:
                    i += 1
                    continue
                if ac_stripped.startswith("-"):
                    item = ac_stripped[1:].strip()
                    if not item:
                        i += 1
                        continue
                    if len(item) > AC_MAX:
                        errors.append({
                            "line": start_line + i,
                            "code": "[MALFORMED_INPUT]",
                            "message": f"acceptance criterion exceeds {AC_MAX} chars",
                        })
                        return None, errors
                    acceptance.append(item)
                    i += 1
                else:
                    break
        else:
            key = line.split(":", 1)[0] + ":"
            errors.append({
                "line": line_no,
                "code": "[MALFORMED_INPUT]",
                "message": f"unknown key '{key.strip()}' (known: {', '.join(KNOWN_KEYS)})",
            })
            return None, errors

    if title is None or not title:
        errors.append({
            "line": start_line,
            "code": "[MALFORMED_INPUT]",
            "message": "missing or empty 'story:' key",
        })
        return None, errors

    if len(title) > TITLE_MAX:
        errors.append({
            "line": start_line,
            "code": "[MALFORMED_INPUT]",
            "message": f"title exceeds {TITLE_MAX} chars",
        })
        return None, errors

    if len(description) > DESCRIPTION_MAX:
        errors.append({
            "line": start_line,
            "code": "[MALFORMED_INPUT]",
            "message": f"description exceeds {DESCRIPTION_MAX} chars",
        })
        return None, errors

    flags = [] if acceptance else ["[NO_ACS]"]

    record = {
        "title": title,
        "description": description,
        "acceptance_criteria": acceptance,
        "source_body": block.strip("\n"),
        "flags": flags,
    }
    return record, errors


def parse(text: str) -> dict:
    normalized = _normalize(text)
    source_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    records: list[dict] = []
    errors: list[dict] = []

    for start_line, block in _split_blocks(normalized):
        record, block_errors = _parse_block(start_line, block)
        errors.extend(block_errors)
        if record is not None:
            records.append(record)

    for idx, record in enumerate(records, start=1):
        record["id"] = f"S{idx}"
        record["source_hash"] = source_hash

    return {
        "source_hash": source_hash,
        "records": records,
        "errors": errors,
    }


def _read_input(argv: list[str]) -> str:
    if len(argv) > 1 and argv[1] != "-":
        with open(argv[1], "r", encoding="utf-8") as handle:
            return handle.read()
    return sys.stdin.read()


def main(argv: list[str]) -> int:
    text = _read_input(argv)
    if not text.strip():
        print(json.dumps({"source_hash": "", "records": [], "errors": [
            {"line": 0, "code": "[MALFORMED_INPUT]", "message": "empty input"}
        ]}, indent=2))
        return 1

    result = parse(text)
    print(json.dumps(result, indent=2))

    if not result["records"] and result["errors"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
