#!/usr/bin/env python3
"""Quick structural check of one skill directory.

A fast pre-check for a new skill; `mewkit validate --frontmatter` and
`mewkit validate --skill-rubric` are the authoritative checks and are run
afterwards. One pass mark: every check below must pass.

Usage:
  python3 validate-skill.py <skill-directory>
"""

import re
import sys
from pathlib import Path

MAX_LINES = 500
MAX_TOKENS = 5000  # characters / 4, the same estimate the rubric uses


def validate_skill(skill_path):
    """Return a list of (check, passed, detail) for one skill directory."""
    results = []
    skill_md = Path(skill_path) / "SKILL.md"
    if not skill_md.exists():
        return [("SKILL.md exists", False, "file not found")]

    content = skill_md.read_text(encoding="utf-8")
    results.append(("SKILL.md exists", True, str(skill_md)))

    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        results.append(("Frontmatter present", False, "no YAML frontmatter found"))
        return results
    frontmatter = fm_match.group(1)
    results.append(("Frontmatter present", True, ""))

    name_match = re.search(r"^name:\s*(.+)$", frontmatter, re.MULTILINE)
    name = name_match.group(1).strip().strip('"').strip("'") if name_match else ""
    results.append(("Name has the mk: prefix", name.startswith("mk:"), name or "no name field"))

    desc_match = re.search(r"^description:\s*(.+)$", frontmatter, re.MULTILINE)
    desc = desc_match.group(1).strip().strip('"').strip("'") if desc_match else ""
    filled = bool(desc) and desc not in (">", ">-", "|", "|-") and "[TODO" not in desc
    results.append(("Description filled", filled, f"{len(desc)} chars" if filled else "empty or still TODO"))

    lines = len(content.splitlines())
    tokens = len(content) // 4
    size_ok = lines <= MAX_LINES and tokens <= MAX_TOKENS
    results.append(("Entry within size caps", size_ok, f"{lines} lines, ~{tokens} tokens (caps {MAX_LINES} / {MAX_TOKENS})"))

    todo_left = "[TODO" in content
    results.append(("No TODO markers left", not todo_left, "TODO markers remain" if todo_left else ""))

    return results


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 validate-skill.py <skill-directory>")
        sys.exit(1)

    skill_path = Path(sys.argv[1])
    if not skill_path.is_dir():
        print(f"Error: '{skill_path}' is not a directory", file=sys.stderr)
        sys.exit(1)

    results = validate_skill(skill_path)
    print(f"Skill check: {skill_path.name}")
    for check, passed, detail in results:
        detail_str = f" - {detail}" if detail else ""
        print(f"  [{'PASS' if passed else 'FAIL'}] {check}{detail_str}")

    ok = all(passed for _, passed, _ in results)
    print("Result: PASS" if ok else "Result: FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
