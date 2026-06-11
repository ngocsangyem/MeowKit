#!/usr/bin/env python3
"""validate-skill-frontmatter.py — validate every mk:*/SKILL.md frontmatter
against .claude/schemas/skill-schema.json.

Defensive: imports yaml and jsonschema with a helpful ImportError message so
missing venv deps are diagnosed in one run.

Two-tier severity:
  ERROR — schema violation (missing required, type mismatch, length out of range,
          keywords > 15, etc.). Exits 1.
  WARN  — missing recommended field (currently: when_to_use). Logged but does NOT
          contribute to exit 1 unless --strict is passed.

Usage:
  .claude/skills/.venv/bin/python3 scripts/validate-skill-frontmatter.py [project-root] [--strict]

Exit:
  0 — all skills valid (warnings allowed unless --strict)
  1 — at least one ERROR (or WARN with --strict)
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


# Recommended-but-not-required fields. Missing → WARN (not ERROR).
RECOMMENDED_FIELDS = ["when_to_use"]

# External-service env-var anchors that mark a SKILL.md body as an external-service
# entrypoint. Anchored to MEOW_/_API_KEY forms — NOT bare GEMINI_API_KEY (multimodal's
# real key is MEOWKIT_GEMINI_API_KEY; the bare form appears only in a legacy-fallback
# description string and would false-positive).
EXTERNAL_SERVICE_PATTERNS = [
    re.compile(r"\bMEOW_JIRA_"),
    re.compile(r"\bMEOW_CONFLUENCE_"),
    re.compile(r"\bMEOWKIT_GEMINI_API_KEY\b"),
    re.compile(r"\bMEOWKIT_MINIMAX_API_KEY\b"),
]


def is_external_service_entrypoint(fm: dict, body: str) -> bool:
    """True when a skill is an external-service entrypoint: its body references an
    external-service env var, OR its frontmatter marks a user-invocable Jira/Confluence
    leaf (owner: jira|confluence, or agent: jira-*/confluence-*)."""
    if any(p.search(body) for p in EXTERNAL_SERVICE_PATTERNS):
        return True
    # Non-user-invocable internals are excluded from the frontmatter-marker path.
    if fm.get("user-invocable") is False:
        return False
    owner = fm.get("owner")
    if owner in ("jira", "confluence"):
        return True
    agent = fm.get("agent")
    if isinstance(agent, str) and (agent.startswith("jira-") or agent.startswith("confluence-")):
        return True
    return False


def check_tool_contract_fields(fm: dict, body: str) -> list[str]:
    """Advisory WARNs for the tool-contract fields. Never an ERROR (calibration phase)."""
    warns: list[str] = []
    if is_external_service_entrypoint(fm, body) and "requires_external_service" not in fm:
        warns.append("external-service entrypoint missing 'requires_external_service'")
    if "requires_external_service" in fm and "default_enabled" not in fm:
        warns.append("'requires_external_service' present but 'default_enabled' missing")
    return warns


def main() -> int:
    args = [a for a in sys.argv[1:] if a]
    strict = "--strict" in args
    args = [a for a in args if not a.startswith("--")]
    root = pathlib.Path(args[0]) if args else pathlib.Path.cwd()

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
    warnings: list[str] = []
    valid = 0

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
            # Recommended-field check — runs only if schema validation passed.
            for field in RECOMMENDED_FIELDS:
                if field not in fm:
                    warnings.append(
                        f"{skill_md.relative_to(root)}: recommended field '{field}' missing"
                    )
            # Tool-contract advisory checks (WARN-only) — body is everything after frontmatter.
            body = text[m.end():]
            for w in check_tool_contract_fields(fm, body):
                warnings.append(f"{skill_md.relative_to(root)}: {w}")
            valid += 1
        except yaml.YAMLError as exc:
            errors.append(f"{skill_md.relative_to(root)}: YAML parse error: {exc}")
        except jsonschema.ValidationError as exc:
            errors.append(
                f"{skill_md.relative_to(root)}: {exc.message} (path: {list(exc.absolute_path) or '/'})"
            )

    # Output
    for line in errors:
        print(f"ERROR: {line}", file=sys.stderr)
    for line in warnings:
        print(f"WARN:  {line}", file=sys.stderr)

    if errors:
        print(
            f"\n{len(errors)} ERROR(s), {len(warnings)} WARN(s); {valid} skill(s) valid",
            file=sys.stderr,
        )
        return 1

    if valid == 0:
        print("ERROR: zero SKILL.md files found under .claude/skills/", file=sys.stderr)
        return 2

    if warnings and strict:
        print(
            f"\n{len(warnings)} WARN(s) (--strict mode promotes to error); {valid} skill(s) valid",
            file=sys.stderr,
        )
        return 1

    msg = f"OK: {valid} skill(s) validated"
    if warnings:
        msg += f" ({len(warnings)} warning(s) — use --strict to fail)"
    print(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
