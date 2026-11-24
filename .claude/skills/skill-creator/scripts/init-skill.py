#!/usr/bin/env python3
"""Scaffold a new skill directory with a minimal SKILL.md.

The directory is named after the slug, without the `mk:` prefix, like every
installed skill (`.claude/skills/<slug>/`); only the frontmatter name carries
the prefix.

Usage:
  python3 init-skill.py <skill-name> [--path <path>]
  python3 init-skill.py my-feature --path .claude/skills
"""

import re
import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {full_name}
description: "[TODO: what it does in one sentence. NOT for mk:<neighbour skill>.]"
when_to_use: "[TODO: the trigger, in a few words]"
keywords:
  - {slug}
user-invocable: true
---

# {title}

[TODO: the goal in one or two sentences: what a finished run leaves behind.]

## When to use

[TODO: the situations that call for it.]

Not for: [TODO: the neighbour skill that owns the adjacent job, and when to use it instead.]

## Outcome

[TODO: what must be true when the skill is done, the boundaries it must respect, and how to check it. Spell out exact steps only for fragile, destructive or security-sensitive work.]
"""


def parse_skill_name(raw_name):
    """Return (full_name, slug, title, error). The mk: prefix is added if missing."""
    name = raw_name.strip().strip('"').strip("'")
    if not name.startswith("mk:"):
        name = f"mk:{name}"

    slug = name.split(":", 1)[1]
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", slug):
        return None, None, None, f"Slug '{slug}' must be lowercase letters, digits and hyphens, with no leading or trailing hyphen"
    if len(slug) > 40:
        return None, None, None, f"Slug '{slug}' exceeds 40 chars"

    title = " ".join(word.capitalize() for word in slug.split("-"))
    return name, slug, title, None


def init_skill(skill_name, base_path):
    """Create `<base>/<slug>/SKILL.md`; return the directory or None on error."""
    full_name, slug, title, error = parse_skill_name(skill_name)
    if error:
        print(f"Error: {error}", file=sys.stderr)
        return None

    skill_dir = Path(base_path).resolve() / slug
    if skill_dir.exists():
        print(f"Error: Directory already exists: {skill_dir}", file=sys.stderr)
        return None

    skill_dir.mkdir(parents=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(SKILL_TEMPLATE.format(full_name=full_name, title=title, slug=slug), encoding="utf-8")

    print(f"Skill scaffolded: {full_name}")
    print(f"  Directory: {skill_dir}")
    print(f"  SKILL.md: {skill_md}")
    print("Fill every [TODO] marker, add references/ only if the body outgrows one screen, add a")
    print("## Gotchas section when a real failure teaches something, then run")
    print("`mewkit validate --frontmatter` and `mewkit validate --skill-rubric`.")
    return skill_dir


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 init-skill.py <skill-name> [--path <base-path>]")
        print("Examples:")
        print("  python3 init-skill.py my-feature")
        print("  python3 init-skill.py mk:data-validator --path .claude/skills")
        print("Note: the mk: prefix is added to the name if missing; the directory has no prefix")
        sys.exit(1)

    base_path = ".claude/skills"
    if "--path" in sys.argv:
        idx = sys.argv.index("--path")
        if idx + 1 < len(sys.argv):
            base_path = sys.argv[idx + 1]

    sys.exit(0 if init_skill(sys.argv[1], base_path) else 1)


if __name__ == "__main__":
    main()
