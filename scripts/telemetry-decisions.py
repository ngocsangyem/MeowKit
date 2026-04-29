#!/usr/bin/env python3
"""telemetry-decisions.py — read hook + trace logs, compute per-week event rates,
apply documented gate thresholds, and emit ship/reject recommendations.

Reads:
  .claude/hooks/.logs/hook-log.jsonl   (hook-fire telemetry)
  .claude/memory/trace-log.jsonl       (harness/build telemetry)

Time window: default last 14 days; override with --days N.

Outputs:
  - One-line summary per gate item with VERDICT and evidence
  - Optional --report path to write structured Markdown decision log

Usage:
  .claude/skills/.venv/bin/python3 scripts/telemetry-decisions.py
  .claude/skills/.venv/bin/python3 scripts/telemetry-decisions.py --days 30
  .claude/skills/.venv/bin/python3 scripts/telemetry-decisions.py --report /tmp/decisions.md
"""
import argparse
import collections
import datetime as dt
import json
import pathlib
import sys
from typing import Iterable

VERDICT_SHIP = "SHIP"
VERDICT_REJECT = "REJECT"
VERDICT_INSUFFICIENT = "INSUFFICIENT_DATA"
VERDICT_MANUAL = "NEEDS_MANUAL_INPUT"


def load_jsonl(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def parse_ts(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def filter_window(rows: Iterable[dict], cutoff: dt.datetime, ts_key: str = "ts") -> list[dict]:
    out: list[dict] = []
    for row in rows:
        parsed = parse_ts(row.get(ts_key, ""))
        if parsed and parsed >= cutoff:
            out.append(row)
    return out


def per_week_rate(count: int, days: int) -> float:
    if days <= 0:
        return 0.0
    return round(count / (days / 7.0), 2)


def evaluate(hook_rows: list[dict], trace_rows: list[dict], days: int) -> list[dict]:
    hook_counts = collections.Counter(r.get("hook", "") for r in hook_rows)
    control_fires = hook_counts.get("control-probe", 0)

    decisions: list[dict] = []

    # AD2-a — PreCompact summary flush
    pre_fires = hook_counts.get("precompact-probe", 0)
    pre_rate = per_week_rate(pre_fires, days)
    if control_fires == 0:
        verdict = VERDICT_INSUFFICIENT
        reason = "control-probe never fired — logger may be broken; cannot trust probe counts"
    elif pre_fires == 0:
        verdict = VERDICT_REJECT
        reason = f"precompact-probe never fired in {days}d; control fired {control_fires}x — event likely unsupported"
    elif pre_rate >= 1.0:
        verdict = VERDICT_SHIP
        reason = f"precompact-probe fires at {pre_rate}/week (≥1/week threshold met)"
    else:
        verdict = VERDICT_REJECT
        reason = f"precompact-probe fires at {pre_rate}/week (<1/week threshold)"
    decisions.append({"item": "AD2-a PreCompact summary flush", "verdict": verdict, "reason": reason, "fires": pre_fires})

    # AD2-b — PostToolUseFailure logger
    ptf_fires = hook_counts.get("posttoolfailure-probe", 0)
    ptf_rate = per_week_rate(ptf_fires, days)
    if control_fires == 0:
        verdict = VERDICT_INSUFFICIENT
        reason = "control-probe never fired — logger may be broken; cannot trust probe counts"
    elif ptf_fires == 0:
        verdict = VERDICT_REJECT
        reason = f"posttoolfailure-probe never fired in {days}d; control fired {control_fires}x — event likely unsupported"
    elif ptf_rate >= 5.0:
        verdict = VERDICT_SHIP
        reason = f"posttoolfailure-probe fires at {ptf_rate}/week (≥5/week threshold met)"
    else:
        verdict = VERDICT_REJECT
        reason = f"posttoolfailure-probe fires at {ptf_rate}/week (<5/week threshold)"
    decisions.append({"item": "AD2-b PostToolUseFailure logger", "verdict": verdict, "reason": reason, "fires": ptf_fires})

    # AD1 — type:"prompt" git-commit gate
    # Telemetry: hook-log doesn't record commit messages; this gate requires manual review of git log
    decisions.append({
        "item": "AD1 LLM git-commit gate",
        "verdict": VERDICT_MANUAL,
        "reason": "needs manual review: count commits in last %dd that (a) failed `meow:ship` for non-conventional message OR (b) introduced suspicious patterns. Threshold ≥3/week." % days,
        "fires": None,
    })

    # AD3 — per-hook config toggle
    # Telemetry: no automated source for user opt-out requests
    decisions.append({
        "item": "AD3 per-hook config toggle",
        "verdict": VERDICT_MANUAL,
        "reason": "needs manual count: user requests for hook-X-only-disable in last %dd. Threshold ≥3 distinct requests not served by existing MEOWKIT_* env vars." % days,
        "fires": None,
    })

    return decisions


def render_report(decisions: list[dict], days: int, hook_count: int, trace_count: int) -> str:
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    lines = [
        "# Telemetry Decisions Report",
        "",
        f"Generated: {today}",
        f"Window: last {days} days",
        f"Hook-log entries in window: {hook_count}",
        f"Trace-log entries in window: {trace_count}",
        "",
        "## Per-item verdicts",
        "",
        "| Item | Verdict | Reason |",
        "|------|---------|--------|",
    ]
    for d in decisions:
        lines.append(f"| {d['item']} | **{d['verdict']}** | {d['reason']} |")
    lines.extend([
        "",
        "## Verdict definitions",
        "",
        "- **SHIP** — gate threshold met; safe to implement and enable",
        "- **REJECT** — gate threshold not met OR event unsupported by Claude Code; do not implement",
        "- **INSUFFICIENT_DATA** — control probe absent; logger may be broken or window too short",
        "- **NEEDS_MANUAL_INPUT** — gate cannot be answered from logs alone; needs human review of git log or user feedback",
        "",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14, help="Time window in days (default 14)")
    ap.add_argument("--report", type=pathlib.Path, help="Optional path to write Markdown report")
    ap.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd(), help="Project root (default cwd)")
    args = ap.parse_args()

    if args.days <= 0:
        print("--days must be > 0", file=sys.stderr)
        return 2

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)
    hook_log = args.root / ".claude/hooks/.logs/hook-log.jsonl"
    trace_log = args.root / ".claude/memory/trace-log.jsonl"

    hook_rows = filter_window(load_jsonl(hook_log), cutoff)
    trace_rows = filter_window(load_jsonl(trace_log), cutoff)

    decisions = evaluate(hook_rows, trace_rows, args.days)

    print(f"Telemetry window: last {args.days} days")
    print(f"Hook-log entries: {len(hook_rows)}  |  Trace-log entries: {len(trace_rows)}")
    print()
    for d in decisions:
        print(f"  [{d['verdict']}] {d['item']}")
        print(f"     {d['reason']}")

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(render_report(decisions, args.days, len(hook_rows), len(trace_rows)))
        print(f"\nReport written to {args.report}")

    # Exit 0 always — this is an advisory tool, not a CI guard
    return 0


if __name__ == "__main__":
    sys.exit(main())
