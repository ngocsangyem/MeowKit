#!/usr/bin/env python3
"""Validate a MeowKit plan file and its phase files for required sections and quality."""
import sys, re, os, glob

# plan.md required sections (overview format)
PLAN_REQUIRED_SECTIONS = [
    "## Goal",
]

# plan.md required frontmatter fields
PLAN_REQUIRED_FRONTMATTER = ["title", "type", "status", "priority"]

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

    content = open(filepath).read()
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

def validate_phase(filepath):
    """Validate a phase-XX file against 12-section template."""
    if not os.path.exists(filepath):
        return [f"File not found: {filepath}"]

    content = open(filepath).read()
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
        content = open(plan_path).read()
        for pf in phase_files:
            basename = os.path.basename(pf)
            if basename not in content:
                issues.append(f"plan.md: Phase file '{basename}' exists but not linked in plan")

    if issues:
        print(f"PLAN_INCOMPLETE: {len(issues)} issue(s)")
        for i in issues:
            print(f"  - {i}")
        return 1
    else:
        phase_count = len(phase_files)
        print(f"PLAN_COMPLETE ({phase_count} phase file{'s' if phase_count != 1 else ''} validated)")
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: validate-plan.py <plan.md>")
        print("Validates plan.md + any phase-*.md files in the same directory.")
        sys.exit(1)
    sys.exit(validate(sys.argv[1]))
