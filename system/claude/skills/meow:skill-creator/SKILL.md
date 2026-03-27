---
name: meow:skill-creator
description: "Create new MeowKit skills with proper structure, compliance checks, and registration. Use when asked to create a skill, build a new skill, or scaffold a skill template. Enforces meow: prefix, sub-agents.md structure, and context engineering principles."
argument-hint: "[skill-name] [description]"
source: claudekit-engineer
original_path: .claude/skills/skill-creator/SKILL.md
adapted_for: meowkit
source: claukit-engineer
---

# Skill Creator

Create new MeowKit skills with proper structure, compliance, and registration.

## When to Invoke

- User asks to "create a skill", "build a new skill", "make a skill for [X]"
- Converting external skill for MeowKit adoption
- Scaffolding a skill from a workflow pattern

Explicit: `/meow:skill-creator [name] [description]`

## Workflow Integration

Meta skill — not tied to a specific Phase. Invoked on-demand for skill development.

## Scripts

**Script-first approach** — Python scripts handle scaffolding and validation. Claude reviews and fills in the content.

```bash
# Scaffold a new skill (creates directory + template SKILL.md)
python3 .claude/skills/meow:skill-creator/scripts/init-skill.py meow:my-feature --path .claude/skills

# Validate an existing skill against compliance checklist
python3 .claude/skills/meow:skill-creator/scripts/validate-skill.py .claude/skills/meow:my-feature
```

## Process

1. **Gather intent** — what should the skill do? When should it trigger? What output format?
2. **Scaffold** — run `init-skill.py` to create directory + template SKILL.md with TODO markers
3. **Fill content** — Claude completes each TODO section in the generated template
4. **Add references/** — if skill body would exceed ~100 lines, split into references
5. **Security boundaries** — load `meow:skill-template-secure` template for trust model if needed
6. **Validate** — run `validate-skill.py` to check compliance (7-point checklist)
7. **Fix failures** — if validation score < 6/7, fix failing items
8. **Register** — add row to `SKILLS_ATTRIBUTION.md`
9. **Report** — output creation summary

## Required Sections in Generated SKILL.md

Every skill MUST have:

```yaml
# Frontmatter
name: "{name}"
description: "{specific trigger keywords + what it does}"
```

If the name already exist then use with prefix `meow:`

```yaml
# Frontmatter
name: meow:{name}
description: "{specific trigger keywords + what it does}"
```

```markdown
## Overview — what + when (2-3 sentences)

## When to Invoke — auto-triggers + explicit syntax

## Process — numbered steps (not prose)

## Output Format — template with placeholders

## Failure Handling — per-failure table

## Workflow Integration — which Phase (0-6)

## Handoff Protocol — next agent + action
```

## MeowKit Compliance Evaluation

After generating, check:

- [ ] `meow:` prefix in skill name
- [ ] Workflow phase anchoring (Phase 0-6 stated)
- [ ] Handoff protocol (next agent specified)
- [ ] Output format uses template with placeholders
- [ ] Failure handling covers identified failure modes
- [ ] SKILL.md ≤ ~100 lines (overflow → references/)
- [ ] No conflict with existing `.claude/rules/`

**Score:** X/7 — PASS (≥6) / FAIL (<6)

If FAIL: fix failing items before registering.

## Output Format

```
## Skill Created: meow:{name}

**Directory:** .claude/skills/meow:{name}/
**Files:** SKILL.md{, references/*.md}
**Compliance:** {X}/7 — {PASS|FAIL}
**Registered:** {yes|no — in SKILLS_ATTRIBUTION.md}

### Compliance Details
{checklist with ✓/✗ per item}
```

## References

| Reference                                                     | When to load                 | Content                                        |
| ------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| **[creation-workflow.md](./references/creation-workflow.md)** | Step 4 — generating SKILL.md | Detailed section-by-section guidance, examples |

## Failure Handling

| Failure                   | Recovery                                   |
| ------------------------- | ------------------------------------------ |
| Name missing meow: prefix | Auto-prepend and warn                      |
| Duplicate skill name      | Suggest alternative or update existing     |
| Compliance check fails    | List failing items, fix before registering |
