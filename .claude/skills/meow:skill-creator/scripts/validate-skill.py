#!/usr/bin/env python3
"""Validate a MeowKit skill against compliance checklist.

Offloads deterministic checks (frontmatter, name format, required sections)
so Claude only sees the pass/fail summary and fixes what failed.

Usage:
  python3 validate-skill.py <skill-directory>
  python3 validate-skill.py .claude/skills/meow:my-feature

Adapted from open-source upstream (MIT) for MeowKit.
"""

import re
import sys
from pathlib import Path


def validate_skill(skill_path):
    """Validate a MeowKit skill directory against compliance checklist.

    Returns (score, max_score, results) where results is a list of (check, passed, detail).
    """
    skill_path = Path(skill_path)
    results = []

    # Check 1: SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        results.append(("SKILL.md exists", False, "File not found"))
        return 0, 7, results

    content = skill_md.read_text(encoding="utf-8")
    results.append(("SKILL.md exists", True, str(skill_md)))

    # Check 2: Frontmatter with name field
    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        results.append(("Frontmatter present", False, "No YAML frontmatter found"))
        has_fm = False
    else:
        has_fm = True
        frontmatter = fm_match.group(1)
        results.append(("Frontmatter present", True, ""))

    # Check 3: meow: prefix in name
    if has_fm:
        name_match = re.search(r"name:\s*(.+)", frontmatter)
        if name_match:
            name = name_match.group(1).strip().strip('"').strip("'")
            if name.startswith("meow:"):
                results.append(("meow: prefix", True, name))
            else:
                results.append(("meow: prefix", False, f"Name '{name}' missing meow: prefix"))
        else:
            results.append(("meow: prefix", False, "No name field in frontmatter"))
    else:
        results.append(("meow: prefix", False, "No frontmatter to check"))

    # Check 4: description in frontmatter
    if has_fm:
        if "description:" in frontmatter:
            desc_match = re.search(r"description:\s*(.+)", frontmatter)
            desc = desc_match.group(1).strip().strip('"').strip("'") if desc_match else ""
            if desc and desc not in (">", ">-", "|", "|-") and "[TODO" not in desc:
                results.append(("Description filled", True, f"{len(desc)} chars"))
            else:
                results.append(("Description filled", False, "Description is empty or still TODO"))
        else:
            results.append(("Description filled", False, "No description field"))
    else:
        results.append(("Description filled", False, "No frontmatter"))

    # Check 5: Workflow phase anchoring
    phase_pattern = r"Phase\s+[0-6]|Phase\s+\d+\s*\("
    if re.search(phase_pattern, content, re.IGNORECASE):
        results.append(("Workflow phase", True, "Phase reference found"))
    elif "meta" in content.lower() and "not tied" in content.lower():
        results.append(("Workflow phase", True, "Meta skill (standalone)"))
    else:
        results.append(("Workflow phase", False, "No Phase 0-6 reference found"))

    # Check 6: Output format with template
    if "```" in content and ("{" in content or "placeholder" in content.lower()):
        results.append(("Output template", True, "Template with placeholders found"))
    elif "## Output" in content:
        results.append(("Output template", True, "Output section exists"))
    else:
        results.append(("Output template", False, "No output format section or template"))

    # Check 7: SKILL.md line count (progressive disclosure per skill-authoring-rules.md Rule 3)
    line_count = len(content.splitlines())
    has_refs = (skill_path / "references").exists()
    has_workflow = (skill_path / "workflow.md").exists()
    if has_workflow:
        results.append(("Progressive disclosure", True, f"{line_count} lines (step-file skill auto-passes)"))
    elif line_count <= 500:
        results.append(("Progressive disclosure", True, f"{line_count} lines (≤500)"))
    elif has_refs:
        results.append(("Progressive disclosure", True, f"{line_count} lines but has references/"))
    else:
        results.append(("Progressive disclosure", False, f"{line_count} lines, no references/ — should split"))

    # Check 8: Gotchas section present (skill-authoring-rules.md Rule 1 — mandatory)
    if re.search(r"^##\s+Gotchas\b", content, re.MULTILINE):
        results.append(("Gotchas section", True, "`## Gotchas` header present"))
    else:
        results.append(("Gotchas section", False, "Missing mandatory `## Gotchas` header (Rule 1)"))

    # Calculate score
    score = sum(1 for _, passed, _ in results if passed)
    max_score = len(results)

    return score, max_score, results


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 validate-skill.py <skill-directory>")
        print()
        print("Checks:")
        print("  1. SKILL.md exists")
        print("  2. Frontmatter present")
        print("  3. meow: prefix in name")
        print("  4. Description filled (not TODO)")
        print("  5. Workflow phase anchoring")
        print("  6. Output template present")
        print("  7. Progressive disclosure (≤500 lines, or step-file, or references/)")
        print("  8. Gotchas section present (Rule 1)")
        sys.exit(1)

    skill_path = Path(sys.argv[1])
    if not skill_path.is_dir():
        print(f"Error: '{skill_path}' is not a directory", file=sys.stderr)
        sys.exit(1)

    score, max_score, results = validate_skill(skill_path)

    print(f"MeowKit Skill Validation: {skill_path.name}")
    print(f"{'=' * 50}")

    for check, passed, detail in results:
        mark = "PASS" if passed else "FAIL"
        detail_str = f" — {detail}" if detail else ""
        print(f"  [{mark}] {check}{detail_str}")

    print(f"{'=' * 50}")
    verdict = "PASS" if score >= max_score - 1 else "FAIL"
    print(f"Score: {score}/{max_score} — {verdict}")

    sys.exit(0 if verdict == "PASS" else 1)


if __name__ == "__main__":
    main()
