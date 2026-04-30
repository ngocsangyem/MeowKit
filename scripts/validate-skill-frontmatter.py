#!/usr/bin/env python3
"""validate-skill-frontmatter.py — validate every mk:*/SKILL.md frontmatter
against .claude/schemas/skill-schema.json.

Defensive: imports yaml and jsonschema with a helpful ImportError message so
missing venv deps are diagnosed in one run.

Usage:
  .claude/skills/.venv/bin/python3 scripts/validate-skill-frontmatter.py [project-root]

Exit:
  0 — all skills valid
  1 — at least one validation failure
  2 — missing dependency or fatal error
"""
import json
import pathlib
import re
import sys

try:
    import yaml  # noqa: F401
    import jsonschema  # noqa: F401
except ImportError as exc:
    print(f"Missing dependency: {exc.name}", file=sys.stderr)
    print("Run: .claude/skills/.venv/bin/pip install pyyaml jsonschema", file=sys.stderr)
    sys.exit(2)


def main() -> int:
    root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.cwd()
    schema_path = root / ".claude/schemas/skill-schema.json"
    skills_root = root / ".claude/skills"

    if not schema_path.exists():
        print(f"No schema at {schema_path}", file=sys.stderr)
        return 2
    if not skills_root.exists():
        print(f"No skills dir at {skills_root}", file=sys.stderr)
        return 2

    schema = json.loads(schema_path.read_text())
    errors: list[str] = []
    valid = 0

    # Iterate every directory under .claude/skills/ that contains a SKILL.md.
    # Excludes hidden dirs and non-skill files (e.g., SKILLS_ATTRIBUTION.md).
    skill_mds = sorted(
        p
        for p in skills_root.glob("*/SKILL.md")
        if not p.parent.name.startswith(".")
    )

    for skill_md in skill_mds:
        text = skill_md.read_text()
        m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
        if not m:
            errors.append(f"{skill_md.relative_to(root)}: no YAML frontmatter")
            continue
        try:
            fm = yaml.safe_load(m.group(1))
            if not isinstance(fm, dict):
                errors.append(f"{skill_md.relative_to(root)}: frontmatter is not an object")
                continue
            jsonschema.validate(fm, schema)
            valid += 1
        except yaml.YAMLError as exc:
            errors.append(f"{skill_md.relative_to(root)}: YAML parse error: {exc}")
        except jsonschema.ValidationError as exc:
            errors.append(f"{skill_md.relative_to(root)}: {exc.message} (path: {list(exc.absolute_path) or '/'})")

    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        print(f"\n{len(errors)} skill(s) failed validation; {valid} passed", file=sys.stderr)
        return 1

    # Zero-match guard: an empty scan must not phantom-pass.
    if valid == 0:
        print("ERROR: zero SKILL.md files found under .claude/skills/", file=sys.stderr)
        return 2

    print(f"OK: {valid} skill(s) validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
