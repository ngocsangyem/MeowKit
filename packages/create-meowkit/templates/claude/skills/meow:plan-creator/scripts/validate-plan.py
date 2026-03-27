#!/usr/bin/env python3
"""Validate a MeowKit plan file for required sections and quality."""
import sys, re, os

REQUIRED_SECTIONS = [
    "## Goal",
    "## Context",
    "## Scope",
    "## Constraints",
    "## Acceptance Criteria",
    "## Agent State",
]

REQUIRED_FRONTMATTER = ["title", "type", "status", "priority"]

def validate(filepath):
    if not os.path.exists(filepath):
        print(f"FAIL: File not found: {filepath}")
        return 1

    content = open(filepath).read()
    issues = []

    # Check frontmatter
    if not content.startswith("---"):
        issues.append("Missing YAML frontmatter")
    else:
        fm = content.split("---")[1] if "---" in content else ""
        for field in REQUIRED_FRONTMATTER:
            if field + ":" not in fm:
                issues.append(f"Missing frontmatter: {field}")

    # Check required sections
    for section in REQUIRED_SECTIONS:
        if section not in content:
            issues.append(f"Missing section: {section}")

    # Check acceptance criteria are binary (checkboxes)
    ac_match = re.search(r'## Acceptance Criteria\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if ac_match:
        ac_text = ac_match.group(1)
        if "- [ ]" not in ac_text and "- [x]" not in ac_text:
            issues.append("Acceptance criteria must use checkboxes (- [ ])")
        # Check for subjective criteria
        subjective = ["is clean", "is good", "works correctly", "is nice", "looks good"]
        for s in subjective:
            if s.lower() in ac_text.lower():
                issues.append(f"Subjective criterion detected: '{s}' — make it binary/measurable")

    # Check constraints not empty
    c_match = re.search(r'## Constraints\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if c_match and c_match.group(1).strip() == "":
        issues.append("Constraints section is empty")

    # Check out of scope exists under Scope
    if "### Out of scope" not in content and "### Out of Scope" not in content:
        issues.append("Missing 'Out of scope' subsection under Scope")

    if issues:
        print(f"PLAN_INCOMPLETE: {len(issues)} issue(s)")
        for i in issues:
            print(f"  - {i}")
        return 1
    else:
        print("PLAN_COMPLETE")
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: validate-plan.py <plan-file.md>")
        sys.exit(1)
    sys.exit(validate(sys.argv[1]))
