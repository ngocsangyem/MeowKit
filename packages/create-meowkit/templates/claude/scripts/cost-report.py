#!/usr/bin/env python3
"""Generate formatted cost report from memory/cost-log.json.

Usage:
  python cost-report.py              # Last 10 entries
  python cost-report.py --monthly    # Aggregate by month
  python cost-report.py --by-command # Aggregate by command type
  python cost-report.py --export     # Write to docs/cost-report.md

Requirements: Python 3.9+, no external dependencies.
"""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


COST_LOG = Path(".claude/memory/cost-log.json")


def load_cost_log() -> list[dict]:
    """Load cost log, returning empty list if missing or invalid."""
    if not COST_LOG.is_file():
        print(f"No cost log found at {COST_LOG}")
        return []
    try:
        data = json.loads(COST_LOG.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            print("Warning: cost-log.json is not an array, returning empty.")
            return []
        return data
    except (json.JSONDecodeError, OSError) as e:
        print(f"Error reading cost log: {e}")
        return []


def format_table(headers: list[str], rows: list[list[str]]) -> str:
    """Format a simple text table."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(str(cell)))

    lines = []
    header_line = "  ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    lines.append(header_line)
    lines.append("  ".join("-" * w for w in col_widths))
    for row in rows:
        lines.append("  ".join(str(cell).ljust(col_widths[i]) for i, cell in enumerate(row)))
    return "\n".join(lines)


def show_recent(entries: list[dict], count: int = 10) -> str:
    """Show last N entries as formatted table."""
    recent = entries[-count:]
    if not recent:
        return "No entries to display."

    headers = ["Date", "Command", "Tier", "Tokens", "Summary"]
    rows = []
    for e in recent:
        rows.append([
            e.get("date", "—"),
            e.get("command", "—"),
            e.get("tier", "—"),
            str(e.get("estimated_tokens", 0)),
            e.get("task_summary", "")[:40],
        ])
    return format_table(headers, rows)


def show_monthly(entries: list[dict]) -> str:
    """Aggregate by month."""
    if not entries:
        return "No entries to display."

    monthly: dict[str, dict] = defaultdict(lambda: {"tokens": 0, "count": 0})
    for e in entries:
        date_str = e.get("date", "")
        if len(date_str) >= 7:
            month = date_str[:7]
        else:
            month = "unknown"
        monthly[month]["tokens"] += e.get("estimated_tokens", 0)
        monthly[month]["count"] += 1

    headers = ["Month", "Commands", "Total Tokens"]
    rows = []
    for month in sorted(monthly.keys()):
        data = monthly[month]
        rows.append([month, str(data["count"]), str(data["tokens"])])

    total_tokens = sum(d["tokens"] for d in monthly.values())
    total_commands = sum(d["count"] for d in monthly.values())
    rows.append(["TOTAL", str(total_commands), str(total_tokens)])

    return format_table(headers, rows)


def show_by_command(entries: list[dict]) -> str:
    """Aggregate by command type."""
    if not entries:
        return "No entries to display."

    by_cmd: dict[str, dict] = defaultdict(lambda: {"tokens": 0, "count": 0})
    for e in entries:
        cmd = e.get("command", "unknown")
        by_cmd[cmd]["tokens"] += e.get("estimated_tokens", 0)
        by_cmd[cmd]["count"] += 1

    headers = ["Command", "Invocations", "Total Tokens", "Avg Tokens"]
    rows = []
    for cmd in sorted(by_cmd.keys(), key=lambda c: by_cmd[c]["tokens"], reverse=True):
        data = by_cmd[cmd]
        avg = data["tokens"] // data["count"] if data["count"] else 0
        rows.append([cmd, str(data["count"]), str(data["tokens"]), str(avg)])

    return format_table(headers, rows)


def export_report(entries: list[dict], directory: Path = Path(".")) -> Path:
    """Write full report to docs/cost-report.md."""
    docs_dir = directory / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    report_path = docs_dir / "cost-report.md"

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    sections = [
        f"# Cost Report — {now}",
        "",
        "## Recent Activity",
        "```",
        show_recent(entries, count=20),
        "```",
        "",
        "## Monthly Summary",
        "```",
        show_monthly(entries),
        "```",
        "",
        "## By Command",
        "```",
        show_by_command(entries),
        "```",
        "",
    ]

    report_path.write_text("\n".join(sections), encoding="utf-8")
    return report_path


def main() -> int:
    entries = load_cost_log()
    args = set(sys.argv[1:])

    if "--export" in args:
        path = export_report(entries)
        print(f"Report exported to {path}")
        return 0

    if "--monthly" in args:
        print(show_monthly(entries))
        return 0

    if "--by-command" in args:
        print(show_by_command(entries))
        return 0

    # Default: show recent
    print(show_recent(entries))
    return 0


if __name__ == "__main__":
    sys.exit(main())
