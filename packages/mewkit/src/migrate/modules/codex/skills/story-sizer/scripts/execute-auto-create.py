#!/usr/bin/env python3
"""execute-auto-create.py — per-ticket execution after the confirmation gate.

Builds the v1-whitelisted command invocations and either:
  - prints them to stdout in plan mode (--plan-only), so the SKILL.md
    orchestration layer can hand them off to /mk:jira-issue + /mk:jira-collaborate
  - executes them via a mock invoker (--invoker-mock <path>) for tests

The script does NOT call `jira-as` or any credentialed wrapper itself. The
orchestration layer is responsible for routing the planned commands through
the peer skills (`mk:jira-issue`, `mk:jira-collaborate`).

stdin JSON:
    {
      "records": [ <record-with-.sizing>, ... ],
      "project": "AUTH",
      "epic": "AUTH-100" | null,
      "components": ["api","ui"] | null,
      "labels": ["q3"] | null,
      "report_path": "tasks/reports/story-sizing-260511-...md",
      "comment_template_path": "<optional>"     # else MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE or default
    }

stdout JSON:
    {
      "status": "ok" | "partial" | "aborted",
      "created": [ {story_id, new_key, points, title, comment_status} ],
      "stopped_at": "<story_id>" | null,
      "stopped_reason": "<message>" | null,
      "comment_failures": [ {story_id, new_key, error} ],
      "planned_commands": [ {story_id, call: "A"|"B", command: "..."} ]
    }
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

SUMMARY_MAX = 255
DESCRIPTION_MAX = 5000
ALLOWED_V1_FLAGS = (
    "--project", "--type", "--summary", "--story-points",
    "--description", "--epic", "--components", "--labels",
)
FORBIDDEN_V1_FLAGS = (
    "--assignee", "--priority", "--sprint", "--blocks", "--custom-fields",
)
DEFAULT_TEMPLATE = (
    "Initial sizing from mk:story-sizer: {{points}} points (heuristic).\n"
    "Source: {{report_path}} §{{story_id}}.\n"
    "Pending team refinement via mk:jira-estimator."
)


def _truncate(text: str, length: int) -> str:
    text = (text or "").replace("\n", " ").replace('"', "'")
    return text[: length].rstrip()


def _strip_forbidden_flags(text: str) -> str:
    for flag in FORBIDDEN_V1_FLAGS:
        if flag in text:
            text = text.replace(flag, "")
    return text


def _build_create_command(record: dict, project: str, epic: Optional[str],
                          components: Optional[list], labels: Optional[list]) -> str:
    sizing = record.get("sizing") or {}
    summary = _truncate(record.get("title", ""), SUMMARY_MAX)
    description = _truncate(record.get("description", ""), DESCRIPTION_MAX)
    summary = _strip_forbidden_flags(summary)
    description = _strip_forbidden_flags(description)
    parts = [
        "/mk:jira-issue create",
        f'--project {project}',
        f'--type Story',
        f'--summary "{summary}"',
        f'--story-points {sizing.get("points")}',
        f'--description "{description}"',
    ]
    if epic:
        parts.append(f'--epic {epic}')
    if components:
        parts.append(f'--components {",".join(components)}')
    if labels:
        parts.append(f'--labels {",".join(labels)}')
    return " \\\n  ".join(parts)


def _load_template(payload: dict, project_root: Path) -> str:
    override = payload.get("comment_template_path") or os.environ.get(
        "MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE"
    )
    if override:
        path = Path(override)
        if not path.is_absolute():
            path = project_root / path
        if path.exists():
            text = path.read_text(encoding="utf-8")
            if all(p in text for p in ("{{points}}", "{{story_id}}", "{{report_path}}")):
                return text
            sys.stderr.write(
                f"warn: template at {path} missing required placeholders; falling back to default\n"
            )
        else:
            sys.stderr.write(f"warn: template path {path} does not exist; falling back to default\n")
    return DEFAULT_TEMPLATE


def _render_comment(template: str, record: dict, report_path: str) -> str:
    sizing = record.get("sizing") or {}
    return (
        template
        .replace("{{points}}", str(sizing.get("points", "")))
        .replace("{{story_id}}", record.get("id", ""))
        .replace("{{report_path}}", report_path)
    )


def _build_comment_command(new_key: str, body: str) -> str:
    safe_body = body.replace('"', "'")
    return (
        f'/mk:jira-collaborate add-comment {new_key} '
        f'--body "{safe_body}" --internal'
    )


def _validate_v1(command: str, kind: str) -> Optional[str]:
    """Returns an error string if the command violates v1 contract."""
    for flag in FORBIDDEN_V1_FLAGS:
        if flag in command:
            return f"{kind} command contains forbidden v1 flag: {flag}"
    if kind == "B" and "--internal" not in command:
        return "Call B is missing required --internal flag"
    if kind == "B" and "--public" in command:
        return "Call B has --public which violates audit-comment safety"
    return None


def _run_invoker(invoker_path: str, command: str) -> dict:
    """Invokes a mock executor that returns JSON {ok, new_key?, error?}."""
    result = subprocess.run(
        ["bash", invoker_path, command],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        try:
            return json.loads(result.stdout.strip() or "{}")
        except json.JSONDecodeError:
            return {"ok": True, "new_key": result.stdout.strip()}
    try:
        payload = json.loads(result.stdout.strip() or result.stderr.strip() or "{}")
    except json.JSONDecodeError:
        payload = {}
    payload.setdefault("ok", False)
    payload.setdefault("error", result.stderr.strip() or f"exit {result.returncode}")
    return payload


def execute(payload: dict, project_root: Path, plan_only: bool,
            invoker: Optional[str]) -> dict:
    records = payload.get("records") or []
    project = payload["project"]
    epic = payload.get("epic")
    components = payload.get("components")
    labels = payload.get("labels")
    report_path = payload.get("report_path", "")
    template = _load_template(payload, project_root)

    created: list[dict] = []
    comment_failures: list[dict] = []
    planned: list[dict] = []
    stopped_at: Optional[str] = None
    stopped_reason: Optional[str] = None

    for record in records:
        story_id = record.get("id", "?")
        create_cmd = _build_create_command(record, project, epic, components, labels)
        planned.append({"story_id": story_id, "call": "A", "command": create_cmd})

        err = _validate_v1(create_cmd, "A")
        if err:
            stopped_at = story_id
            stopped_reason = err
            break

        new_key = None
        comment_status = "pending"

        if plan_only:
            new_key = f"<{project}-NEW>"
            comment_status = "planned"
        else:
            if not invoker:
                stopped_at = story_id
                stopped_reason = "no invoker provided and not in plan-only mode"
                break
            outcome_a = _run_invoker(invoker, create_cmd)
            if not outcome_a.get("ok"):
                stopped_at = story_id
                stopped_reason = outcome_a.get("error", "Call A failed")
                break
            new_key = outcome_a.get("new_key") or f"{project}-?"

        body = _render_comment(template, record, report_path)
        comment_cmd = _build_comment_command(new_key, body)
        planned.append({"story_id": story_id, "call": "B", "command": comment_cmd})

        err_b = _validate_v1(comment_cmd, "B")
        if err_b:
            comment_failures.append({"story_id": story_id, "new_key": new_key, "error": err_b})
            comment_status = "WARN"
        elif not plan_only:
            outcome_b = _run_invoker(invoker, comment_cmd)
            if outcome_b.get("ok"):
                comment_status = "ok"
            else:
                comment_failures.append({
                    "story_id": story_id,
                    "new_key": new_key,
                    "error": outcome_b.get("error", "Call B failed"),
                })
                comment_status = "WARN"

        created.append({
            "story_id": story_id,
            "new_key": new_key,
            "points": (record.get("sizing") or {}).get("points"),
            "title": record.get("title", ""),
            "comment_status": comment_status,
        })

    status = "ok"
    if stopped_at is not None:
        status = "partial" if created else "aborted"

    return {
        "status": status,
        "created": created,
        "stopped_at": stopped_at,
        "stopped_reason": stopped_reason,
        "comment_failures": comment_failures,
        "planned_commands": planned,
    }


def append_to_report(result: dict, report_path: Optional[str]) -> None:
    if not report_path:
        return
    path = Path(report_path)
    if not path.exists():
        return
    lines = ["", "## Created Tickets", "",
             "| Story | Title | New Key | Points | Comment status |",
             "|-------|-------|---------|--------|----------------|"]
    for entry in result["created"]:
        title = (entry.get("title") or "").replace("|", "\\|")
        lines.append(
            f"| {entry['story_id']} | {title} | {entry['new_key']} | "
            f"{entry.get('points')} | {entry.get('comment_status')} |"
        )
    if result.get("stopped_at"):
        lines += [
            "",
            f"### Stopped at {result['stopped_at']} — Call A failed",
            "",
            f"Reason: {result.get('stopped_reason')}",
            "",
            "Manual cleanup hint: `/mk:jira-lifecycle delete <KEY>` per ticket above.",
        ]
    if result.get("comment_failures"):
        lines += ["", "## Comment Failures", ""]
        for fail in result["comment_failures"]:
            lines.append(f"- {fail['story_id']} ({fail['new_key']}): {fail['error']}")
    lines.append("")
    with path.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main(argv: list[str]) -> int:
    plan_only = "--plan-only" in argv
    invoker = None
    if "--invoker-mock" in argv:
        idx = argv.index("--invoker-mock")
        invoker = argv[idx + 1] if idx + 1 < len(argv) else None

    payload = json.load(sys.stdin)
    project_root = Path(os.environ.get("CLAUDE_PROJECT_DIR", Path.cwd())).resolve()

    result = execute(payload, project_root, plan_only, invoker)

    if not plan_only:
        append_to_report(result, payload.get("report_path"))

    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
