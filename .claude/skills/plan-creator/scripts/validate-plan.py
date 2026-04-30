#!/usr/bin/env python3
"""Validate a MeowKit plan file and its phase files for required sections and quality.

Dependencies:
    PyYAML >= 6.0  (parses phase frontmatter; installed via `npx mewkit setup`)

Usage:
    .claude/skills/.venv/bin/python3 validate-plan.py <plan.md>

Exit codes: 0 = PLAN_COMPLETE (warnings tolerated); 1 = PLAN_INCOMPLETE (errors).
"""
import sys, re, os, glob
import yaml  # PyYAML — required for phase frontmatter parsing

# plan.md required sections (overview format)
PLAN_REQUIRED_SECTIONS = [
    "## Goal",
]

# plan.md required frontmatter fields
PLAN_REQUIRED_FRONTMATTER = ["title", "type", "status", "priority"]

# Phase frontmatter schema
PHASE_VALID_STATUS = {"pending", "active", "in_progress", "completed", "failed", "abandoned"}
PHASE_FRONTMATTER_FIELDS = ["phase", "title", "status", "priority", "effort", "dependencies"]
PHASE_FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---", re.DOTALL)
TODO_RE = re.compile(r"^\s*-\s*\[(\s|x|X)\]\s+", re.MULTILINE)
PHASE_FILENAME_RE = re.compile(r"^phase-(\d+)")

# Phase file required sections (12-section template)
PHASE_REQUIRED_SECTIONS = [
    "## Context Links",
    "## Overview",
    "## Key Insights",
    "## Requirements",
    "## Architecture",
    "## Related Code Files",
    "## Implementation Steps",
    "## Todo List",
    "## Success Criteria",
    "## Risk Assessment",
    "## Security Considerations",
    "## Next Steps",
]

def validate_frontmatter(content, filepath):
    """Check YAML frontmatter exists and has required fields."""
    issues = []
    if not content.startswith("---"):
        issues.append(f"{filepath}: Missing YAML frontmatter")
    else:
        fm = content.split("---")[1] if "---" in content else ""
        for field in PLAN_REQUIRED_FRONTMATTER:
            if field + ":" not in fm:
                issues.append(f"{filepath}: Missing frontmatter: {field}")
    return issues

def validate_plan(filepath):
    """Validate plan.md overview file."""
    if not os.path.exists(filepath):
        return [f"File not found: {filepath}"]

    content = open(filepath, encoding="utf-8").read()
    issues = validate_frontmatter(content, "plan.md")

    # Check required sections
    for section in PLAN_REQUIRED_SECTIONS:
        if section not in content:
            issues.append(f"plan.md: Missing section: {section}")

    # Check goal is outcome-focused (heuristic: shouldn't start with verb)
    goal_match = re.search(r'## Goal\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if goal_match:
        goal = goal_match.group(1).strip()
        activity_verbs = ["implement", "create", "build", "add", "write", "set up", "configure"]
        for verb in activity_verbs:
            if goal.lower().startswith(verb):
                issues.append(f"plan.md: Goal starts with activity verb '{verb}' — rewrite as outcome")
                break

    # Check line count
    line_count = len(content.strip().split("\n"))
    if line_count > 100:
        issues.append(f"plan.md: {line_count} lines (max 80 recommended) — move detail to phase files")

    return issues

def parse_phase_frontmatter(content):
    """Extract YAML frontmatter from a phase file. Returns dict, or None if missing/malformed."""
    match = PHASE_FRONTMATTER_RE.match(content)
    if not match:
        return None
    try:
        parsed = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None
    return parsed if isinstance(parsed, dict) else None


def count_checkbox_state(content):
    """Count total and checked todos in '## Todo List' section. Returns (total, checked)."""
    section = re.search(r"## Todo List\n(.*?)(?=\n##|\Z)", content, re.DOTALL)
    if not section:
        return 0, 0
    total = 0
    checked = 0
    for marker in TODO_RE.findall(section.group(1)):
        total += 1
        if marker in ("x", "X"):
            checked += 1
    return total, checked


def validate_phase_frontmatter(content, basename):
    """Validate phase frontmatter. Returns (warnings, errors).

    Backward-compatible: missing block produces a single WARN, never ERROR.
    Errors fire on drift (status=completed with unchecked) and integrity (phase number mismatch, sentinel/invalid status).
    """
    warnings, errors = [], []
    fm = parse_phase_frontmatter(content)

    # Missing or malformed frontmatter → WARN only (legacy compat)
    if fm is None:
        warnings.append(
            f"{basename}: missing or malformed frontmatter (legacy compat — add per phase-template.md)"
        )
        return warnings, errors

    # Required fields present
    for field in PHASE_FRONTMATTER_FIELDS:
        if field not in fm:
            warnings.append(f"{basename}: frontmatter missing field '{field}'")

    # Status enum validation
    status = fm.get("status", "")
    # Empty / null status — fail-soft WARN (parser will default it but author intent unclear)
    if status is None or status == "":
        warnings.append(
            f"{basename}: frontmatter 'status' has no value — author should set explicit status"
        )
        status = ""
    elif isinstance(status, str):
        status = status.lower()
    if status == "unknown":
        errors.append(
            f"{basename}: 'status: unknown' is reserved as parser sentinel — never write"
        )
    elif status and status not in PHASE_VALID_STATUS:
        errors.append(
            f"{basename}: invalid status '{status}'; allowed: {sorted(PHASE_VALID_STATUS)}"
        )

    # phase int matches filename
    fname_match = PHASE_FILENAME_RE.match(basename)
    if fname_match and "phase" in fm:
        try:
            expected = int(fname_match.group(1))
            actual = int(fm["phase"])
            if actual != expected:
                errors.append(
                    f"{basename}: frontmatter phase={actual} != filename phase={expected}"
                )
        except (ValueError, TypeError):
            errors.append(f"{basename}: frontmatter 'phase' is not an integer")

    # Drift: completed with unchecked todos
    if status == "completed":
        total, checked = count_checkbox_state(content)
        if total > 0 and checked < total:
            errors.append(
                f"{basename}: status=completed but {total - checked}/{total} todos unchecked (drift)"
            )

    return warnings, errors


def validate_phase(filepath):
    """Validate a phase-XX file against 12-section template + frontmatter schema."""
    if not os.path.exists(filepath):
        return [f"File not found: {filepath}"]

    content = open(filepath, encoding="utf-8").read()
    basename = os.path.basename(filepath)
    issues = []

    for section in PHASE_REQUIRED_SECTIONS:
        if section not in content:
            issues.append(f"{basename}: Missing section: {section}")

    # Check for empty todo list
    todo_match = re.search(r'## Todo List\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if todo_match:
        todo = todo_match.group(1).strip()
        if not todo or ("- [ ]" not in todo and "- [x]" not in todo):
            issues.append(f"{basename}: Todo List has no checkboxes")

    # Check line count
    line_count = len(content.strip().split("\n"))
    if line_count > 200:
        issues.append(f"{basename}: {line_count} lines (max 150 recommended)")

    # Frontmatter validation (warnings + errors)
    fm_warnings, fm_errors = validate_phase_frontmatter(content, basename)
    for w in fm_warnings:
        issues.append(f"WARN {w}")
    for e in fm_errors:
        issues.append(f"ERROR {e}")

    return issues

def validate(plan_path):
    """Validate plan.md and all linked phase files."""
    issues = validate_plan(plan_path)

    # Find phase files in same directory
    plan_dir = os.path.dirname(plan_path)
    phase_files = sorted(glob.glob(os.path.join(plan_dir, "phase-*.md")))

    if phase_files:
        # Validate each phase file
        for pf in phase_files:
            issues.extend(validate_phase(pf))

        # Check plan.md references all phase files
        content = open(plan_path, encoding="utf-8").read()
        for pf in phase_files:
            basename = os.path.basename(pf)
            if basename not in content:
                issues.append(f"plan.md: Phase file '{basename}' exists but not linked in plan")

    # Separate errors from warnings: only ERRORs (and legacy unprefixed issues) fail the script.
    # Legacy issues (missing sections, line count, etc.) don't carry the WARN/ERROR prefix and
    # still count as errors for backward compatibility with existing CI invocations.
    warn_count = sum(1 for i in issues if i.startswith("WARN "))
    hard_errors = [i for i in issues if not i.startswith("WARN ")]

    if hard_errors:
        print(f"PLAN_INCOMPLETE: {len(hard_errors)} error(s), {warn_count} warning(s)")
        for i in issues:
            print(f"  - {i}")
        return 1
    else:
        phase_count = len(phase_files)
        warn_suffix = f" ({warn_count} warning{'s' if warn_count != 1 else ''})" if warn_count else ""
        print(f"PLAN_COMPLETE ({phase_count} phase file{'s' if phase_count != 1 else ''} validated){warn_suffix}")
        if warn_count:
            for i in issues:
                if i.startswith("WARN "):
                    print(f"  - {i}")
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: validate-plan.py <plan.md>")
        print("Validates plan.md + any phase-*.md files in the same directory.")
        sys.exit(1)
    sys.exit(validate(sys.argv[1]))
