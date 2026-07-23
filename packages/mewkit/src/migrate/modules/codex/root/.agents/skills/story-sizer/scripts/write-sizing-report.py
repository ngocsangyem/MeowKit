#!/usr/bin/env python3
"""write-sizing-report.py — render a Story Sizing Report markdown file.

Reads a JSON payload on stdin:

    {
      "source_path": "<paste|spec-path|intake-path>",
      "source_hash": "<sha256>",
      "scout_used": false,
      "slug": "...",                  # optional; auto-derived if missing
      "report_dir": "tasks/reports",  # optional override
      "records": [ <records with .sizing field>, ... ]
    }

Writes the rendered report to `<report_dir>/story-sizing-<YYMMDD>-<slug>.md`
and prints the resolved absolute path on stdout.

If a report exists at the resolved path with the same `source_hash`, exits with
code 2 and prints `{"existing": "<path>", "match": true}` so the caller can
prompt the user.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

V1_TYPE_DEFAULT = "Story"
DESCRIPTION_TRUNCATE = 500


def _slug_from_title(title: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", title.lower())
    return "-".join(tokens[:6]) or "paste"


def _resolve_slug(payload: dict) -> str:
    slug = payload.get("slug")
    if slug:
        return re.sub(r"[^a-z0-9-]+", "-", slug.lower()).strip("-") or "paste"
    records = payload.get("records") or []
    if records:
        return _slug_from_title(records[0].get("title", "paste"))
    return "paste"


def _resolve_path(payload: dict, project_root: Path) -> Path:
    report_dir = payload.get("report_dir") or "tasks/reports"
    date_stamp = dt.datetime.now().strftime("%y%m%d")
    slug = _resolve_slug(payload)
    return project_root / report_dir / f"story-sizing-{date_stamp}-{slug}.md"


def _existing_hash(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            for _ in range(20):
                line = handle.readline()
                if not line:
                    break
                m = re.match(r".*Source hash.*`([0-9a-f]{64})`", line)
                if m:
                    return m.group(1)
    except OSError:
        return None
    return None


def _truncate(text: str, length: int) -> str:
    text = (text or "").replace("\n", " ").replace('"', "'").strip()
    return text[: length].rstrip()


def _format_dimension_scores(scores: dict) -> str:
    if not scores:
        return ""
    parts = [f"{k}={v}" for k, v in scores.items()]
    return "(" + ", ".join(parts) + ")"


def _suggested_command(record: dict) -> Optional[str]:
    sizing = record.get("sizing") or {}
    if sizing.get("refusal_reason") or sizing.get("points") is None:
        return None
    summary = _truncate(record.get("title", ""), 250)
    description = _truncate(record.get("description", ""), DESCRIPTION_TRUNCATE)
    return (
        f'the jira-issue skill create --project <PROJECT> --type {V1_TYPE_DEFAULT} \\\n'
        f'  --summary "{summary}" \\\n'
        f'  --story-points {sizing["points"]} \\\n'
        f'  --description "{description}"'
    )


def _render_story_section(record: dict) -> str:
    sizing = record.get("sizing") or {}
    title = record.get("title", "")
    rec_id = record.get("id", "?")
    points = sizing.get("points")
    points_label = "REFUSED" if points is None else str(points)
    complexity = sizing.get("complexity", "n/a")
    uncertainty = sizing.get("uncertainty", "±0")
    drivers = sizing.get("drivers_score", 0)
    dim_scores = _format_dimension_scores(sizing.get("dimension_scores") or {})

    body = [
        f"## {rec_id} — {title}",
        "",
        f"- **Points:** {points_label} ({complexity}) · uncertainty **{uncertainty}**",
        f"- **Drivers score:** {drivers} — {dim_scores}",
        "",
    ]

    description = record.get("description") or ""
    if description.strip():
        body.append(f"> {description.strip()}")
        body.append("")

    acs = record.get("acceptance_criteria") or []
    if acs:
        body.append("### Acceptance criteria")
        body.append("")
        for ac in acs:
            body.append(f"- {ac}")
        body.append("")

    inconsistencies = sizing.get("inconsistencies") or []
    if inconsistencies:
        body.append("### Inconsistencies")
        body.append("")
        for entry in inconsistencies:
            body.append(f"- {entry}")
        body.append("")

    signals = sizing.get("codebase_signals")
    if signals:
        body.append("### Codebase signals (from the scout skill)")
        body.append("")
        if isinstance(signals, dict):
            for key, value in signals.items():
                body.append(f"- **{key}:** {value}")
        else:
            for entry in signals:
                body.append(f"- {entry}")
        body.append("")

    dor = sizing.get("dor_status")
    if dor:
        body.append("### Definition of Ready")
        body.append("")
        body.append(f"- Verdict: **{dor.get('verdict', 'n/a')}**")
        body.append(f"- User phrase: {dor.get('has_user_phrase')}")
        body.append(f"- Benefit phrase: {dor.get('has_benefit_phrase')}")
        body.append(f"- Testable ACs: {dor.get('testable_acs')}")
        body.append(f"- Dependencies named: {dor.get('dependencies_named')}")
        reasons = dor.get("reasons") or []
        if reasons:
            body.append(f"- Reasons: {', '.join(reasons)}")
        body.append("")

    split = sizing.get("split_proposal")
    if split:
        body.append("### Split suggestion (advisory)")
        body.append("")
        body.append(f"Trigger: **{split.get('trigger', 'size')}**")
        body.append("")
        body.append(split.get("rationale", ""))
        body.append("")
        for sub in split.get("sub_stories") or []:
            body.append(
                f"- **{sub.get('title')}** ({sub.get('focus')}) — ~{sub.get('est_points')} pts"
            )
        body.append("")

    refusal = sizing.get("refusal_reason")
    if refusal:
        body.append("### REFUSED")
        body.append("")
        body.append(f"Reason: {refusal}. Add the missing signal and re-paste.")
        body.append("")

    cmd = _suggested_command(record)
    if cmd:
        body.append("### Suggested Jira create command")
        body.append("")
        body.append("```bash")
        body.append(cmd)
        body.append("```")
        body.append("")

    body.append("---")
    body.append("")
    return "\n".join(body)


def _render_summary_table(records: list) -> str:
    lines = [
        "## Summary",
        "",
        "| # | Story | Points | Split? | Notes |",
        "|---|-------|--------|--------|-------|",
    ]
    for record in records:
        sizing = record.get("sizing") or {}
        points = sizing.get("points")
        points_label = "REFUSED" if points is None else str(points)
        split_marker = "yes" if sizing.get("split_proposal") else ""
        notes_parts: list[str] = []
        if sizing.get("inconsistencies"):
            notes_parts.append(f"{len(sizing['inconsistencies'])} inconsistencies")
        if sizing.get("refusal_reason"):
            notes_parts.append(sizing["refusal_reason"])
        notes = "; ".join(notes_parts)
        title = (record.get("title") or "").replace("|", "\\|")
        lines.append(
            f"| {record.get('id', '?')} | {title} | {points_label} | {split_marker} | {notes} |"
        )
    lines.append("")
    return "\n".join(lines)


def render(payload: dict) -> str:
    records = payload.get("records") or []
    source_path = payload.get("source_path") or "paste"
    source_hash = payload.get("source_hash", "")
    scout_used = bool(payload.get("scout_used"))
    scout_status = "yes" if scout_used else "[NO_CODEBASE_CONTEXT]"
    slug = _resolve_slug(payload)
    sized_count = sum(1 for r in records if (r.get("sizing") or {}).get("points") is not None)
    split_count = sum(1 for r in records if (r.get("sizing") or {}).get("split_proposal"))
    generated_at = dt.datetime.now().isoformat(timespec="seconds")

    header = [
        f"# Story Sizing Report — {slug}",
        "",
        "| Field | Value |",
        "|-------|-------|",
        f"| Generated | {generated_at} |",
        f"| Source | {source_path} |",
        f"| Source hash | `{source_hash}` |",
        f"| Scout context | {scout_status} |",
        f"| Stories sized | {sized_count} / {len(records)} |",
        f"| Flagged for split | {split_count} |",
        "",
        "> Default mode is advisory only. Copy the suggested commands per story OR re-run with `--auto-create --project <KEY>` for a batch handoff behind a single confirmation gate.",
        "",
    ]

    body = [_render_story_section(r) for r in records]
    summary = _render_summary_table(records)

    return "\n".join(header) + "\n".join(body) + "\n" + summary


def main(argv: list[str]) -> int:
    payload = json.load(sys.stdin)
    project_root = Path(os.environ.get("the project environment", Path.cwd())).resolve()

    target = _resolve_path(payload, project_root)
    target.parent.mkdir(parents=True, exist_ok=True)

    existing_hash = _existing_hash(target)
    if existing_hash and existing_hash == payload.get("source_hash"):
        print(json.dumps({"existing": str(target), "match": True}))
        return 2

    rendered = render(payload)
    target.write_text(rendered, encoding="utf-8")
    print(str(target))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
