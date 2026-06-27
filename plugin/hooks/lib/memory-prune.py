#!/usr/bin/env python3
# memory-prune.py — Prune stale entries from MeowKit memory topic files.
#
# Usage:
#   python3 memory-prune.py <memory_dir> <age_days> <prune_log_path>
#
# Rules:
#   - Scope: *.md files in <memory_dir> only. JSON sidecars (fixes.json,
#     architecture-decisions.json, patterns.json, review-patterns.json) are
#     explicitly out of scope — they need a v2.0.0-schema-aware strategy.
#   - Entries are delimited by lines starting with "## " (H2-level headers).
#   - An entry is pruned IFF:
#       (a) Its header line contains a parseable YYYY-MM-DD date, AND
#       (b) That date is older than <age_days> from today, AND
#       (c) Neither the header NOR the entry body contains
#           "severity: critical" or "severity: security" (case-insensitive).
#   - Entries without a parseable date are PRESERVED (legacy / manually written).
#   - Atomic write: .tmp + os.replace prevents partial writes on crash.
#   - <prune_log_path> MUST be outside <memory_dir>. The log records ONLY
#     "{file} | {date} | {N} entries pruned" — NO entry content, NO header text.
#     Keeping the log outside .claude/memory/ breaks the injection-rules.md
#     Rule 11 carrier chain (memory loaders never scan session-state/).
#   - Exits 0 on success, 1 on any per-file error so the caller can gate
#     its rate-limit advance on success.

import datetime as dt
import os
import re
import sys
import tempfile

ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
SEVERITY_RE = re.compile(r"severity\s*:\s*(critical|security)", re.IGNORECASE)


def parse_header_date(header_line: str):
    m = ISO_DATE_RE.search(header_line)
    if not m:
        return None
    try:
        return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def split_entries(text: str):
    """Split markdown text into (preamble, [entry, ...]) where each entry
    starts at a '## ' header. Lines before the first '## ' are preamble
    and always preserved."""
    lines = text.splitlines(keepends=True)
    preamble, entries, current = [], [], None
    for line in lines:
        if line.startswith("## "):
            if current is not None:
                entries.append("".join(current))
            current = [line]
        elif current is None:
            preamble.append(line)
        else:
            current.append(line)
    if current is not None:
        entries.append("".join(current))
    return "".join(preamble), entries


def prune_file(path: str, cutoff: dt.date):
    """Return (kept_text, n_pruned). Raises on I/O error."""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    preamble, entries = split_entries(text)
    kept, pruned = [], 0
    for entry in entries:
        first_line = entry.split("\n", 1)[0]
        entry_date = parse_header_date(first_line)
        if entry_date is None:
            kept.append(entry)
            continue
        # Severity guard — never auto-prune critical/security entries even
        # when their date is old (matches mk:memory --prune contract).
        if SEVERITY_RE.search(entry):
            kept.append(entry)
            continue
        if entry_date < cutoff:
            pruned += 1
        else:
            kept.append(entry)
    return preamble + "".join(kept), pruned


def atomic_write(path: str, content: str):
    dir_ = os.path.dirname(os.path.abspath(path)) or "."
    fd, tmp = tempfile.mkstemp(prefix=".prune-", dir=dir_)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def append_log_line(log_path: str, file_name: str, today: dt.date, n: int):
    """Append a single count-only line. NO entry content is ever logged
    (Rule 11 carrier-chain break — keeps user-supplied entry text out of any
    file a memory loader would scan.)"""
    line = f"{file_name} | {today.isoformat()} | {n} entries pruned\n"
    os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
    # Append is fine — log is non-critical observability, no atomicity needed.
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line)


def main(argv):
    if len(argv) != 4:
        sys.stderr.write(
            "Usage: memory-prune.py <memory_dir> <age_days> <prune_log_path>\n"
        )
        return 2

    memory_dir, age_days_str, prune_log = argv[1], argv[2], argv[3]

    # Refuse to write the log inside the memory dir — that would re-introduce
    # the Rule 11 injection carrier chain we keep the log outside to break.
    real_mem = os.path.realpath(memory_dir)
    real_log = os.path.realpath(prune_log)
    if real_log.startswith(real_mem + os.sep):
        sys.stderr.write(
            f"REFUSED: prune log path inside memory dir is unsafe ({prune_log})\n"
        )
        return 2

    try:
        age_days = int(age_days_str)
    except ValueError:
        sys.stderr.write(f"Invalid age_days: {age_days_str}\n")
        return 2

    if not os.path.isdir(memory_dir):
        sys.stderr.write(f"Memory dir missing: {memory_dir}\n")
        return 1

    today = dt.date.today()
    cutoff = today - dt.timedelta(days=age_days)

    total_pruned = 0
    files_touched = 0
    any_error = False

    # Only .md files. Skip pruned-log if someone misplaced it inside memory dir.
    md_files = sorted(
        f for f in os.listdir(memory_dir)
        if f.endswith(".md") and f != "pruned-log.md"
    )
    for name in md_files:
        path = os.path.join(memory_dir, name)
        if not os.path.isfile(path):
            continue
        try:
            new_text, n_pruned = prune_file(path, cutoff)
            if n_pruned > 0:
                atomic_write(path, new_text)
                append_log_line(prune_log, name, today, n_pruned)
                total_pruned += n_pruned
                files_touched += 1
        except OSError as e:
            sys.stderr.write(f"Error processing {path}: {e}\n")
            any_error = True

    if total_pruned > 0:
        print(f"Pruned {total_pruned} entries from {files_touched} file(s)")
    return 1 if any_error else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
