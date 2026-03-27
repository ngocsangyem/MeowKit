#!/usr/bin/env python3
"""Initialize a new MeowKit skill with proper structure.

Offloads deterministic scaffolding (directory creation, template filling)
so Claude only needs to review and customize the generated content.

Usage:
  python3 init-skill.py <skill-name> [--path <path>]
  python3 init-skill.py meow:my-feature --path .claude/skills

Adapted from claudekit-engineer/skill-creator/scripts/init_skill.py for MeowKit.
"""

import re
import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {full_name}
description: "[TODO: Specific trigger keywords + what it does. Include WHEN to use — file types, tasks, or scenarios that trigger it.]"
---

<!-- Created by meow:skill-creator -->

# {title}

## Overview

[TODO: 1-2 sentences — what this skill does and when to use it]

## When to Invoke

**Auto-activate on:**
- [TODO: keyword patterns Claude watches for]

**Explicit:** `/meow:{slug} [args]`

**Do NOT invoke when:**
- [TODO: conditions where this skill is not appropriate]

## Workflow Integration

Operates in **Phase [TODO: 0-6]** of MeowKit's workflow. Output supports the `[TODO: agent name]` agent.

## Process

1. [TODO: first step]
2. [TODO: second step]
3. [TODO: third step]

## Output Format

```
## {title}: {{result}}

**[TODO: field]:** {{value}}

### Findings
{{structured output}}
```

## Failure Handling

| Failure | Recovery |
|---------|----------|
| [TODO: failure mode] | [TODO: recovery action] |

## Handoff Protocol

On completion → `[TODO: agent]` receives: [TODO: what]

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| [TODO: if needed] | [TODO: when] | [TODO: what] |
"""


def parse_skill_name(raw_name):
    """Parse and validate skill name. Enforce meow: prefix."""
    name = raw_name.strip().strip('"').strip("'")

    # Auto-prepend meow: if missing
    if not name.startswith("meow:"):
        name = f"meow:{name}"

    parts = name.split(":", 1)
    if len(parts) != 2:
        return None, None, None, "Invalid name format"

    namespace, slug = parts

    # Validate slug
    pattern = r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'
    if not re.match(pattern, slug):
        return None, None, None, f"Slug '{slug}' must be lowercase, hyphens, no leading/trailing hyphens"

    if len(slug) > 40:
        return None, None, None, f"Slug '{slug}' exceeds 40 chars"

    title = " ".join(word.capitalize() for word in slug.split("-"))

    return name, slug, title, None


def init_skill(skill_name, base_path):
    """Create skill directory with template SKILL.md."""
    full_name, slug, title, error = parse_skill_name(skill_name)
    if error:
        print(f"Error: {error}", file=sys.stderr)
        return None

    skill_dir = Path(base_path).resolve() / f"meow:{slug}"

    if skill_dir.exists():
        print(f"Error: Directory already exists: {skill_dir}", file=sys.stderr)
        return None

    # Create structure
    skill_dir.mkdir(parents=True)
    (skill_dir / "references").mkdir()

    # Generate SKILL.md
    content = SKILL_TEMPLATE.format(
        full_name=full_name,
        title=title,
        slug=slug,
    )

    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(content, encoding="utf-8")

    # Print summary as JSON-like for Claude to parse
    print(f"Skill scaffolded: {full_name}")
    print(f"  Directory: {skill_dir}")
    print(f"  SKILL.md: {skill_md} ({len(content.splitlines())} lines)")
    print(f"  references/: created (empty)")
    print()
    print("TODO items for Claude to complete:")
    print("  1. Fill description in frontmatter with specific trigger keywords")
    print("  2. Write Overview section (1-2 sentences)")
    print("  3. Define auto-activate patterns in When to Invoke")
    print("  4. Set workflow phase (Phase 0-6)")
    print("  5. Write numbered Process steps")
    print("  6. Define Output Format template with placeholders")
    print("  7. Fill Failure Handling table")
    print("  8. Set Handoff Protocol (which agent receives output)")

    return skill_dir


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 init-skill.py <skill-name> [--path <base-path>]")
        print()
        print("Examples:")
        print("  python3 init-skill.py meow:my-feature")
        print("  python3 init-skill.py my-feature --path .claude/skills")
        print("  python3 init-skill.py meow:data-validator --path .claude/skills")
        print()
        print("Note: meow: prefix is auto-prepended if missing")
        sys.exit(1)

    skill_name = sys.argv[1]
    base_path = ".claude/skills"

    if "--path" in sys.argv:
        idx = sys.argv.index("--path")
        if idx + 1 < len(sys.argv):
            base_path = sys.argv[idx + 1]

    result = init_skill(skill_name, base_path)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
