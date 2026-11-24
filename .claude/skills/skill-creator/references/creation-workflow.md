# Skill creation: section-by-section guidance

Use alongside `references/skill-authoring-rules.md`. Everything here is guidance, not a required template: include a section only when the skill needs it.

## Gather intent

Ask the user, or infer from context:

1. What failure or gap prompted this, and which existing skill was checked? (Rule 12)
2. What should the skill do? One sentence.
3. When should it trigger, and when not? Which neighbour owns the adjacent job?
4. What input does it accept, and what does it return?
5. If it delegates: what is the brief, and when should it not delegate?

## Layout

```
.claude/skills/<slug>/
├── SKILL.md          # entry: at most 500 lines and about 5,000 tokens
├── references/       # detail loaded on demand, one level deep
└── scripts/          # deterministic work the model should run, not re-derive
```

The directory carries no `mk:` prefix; the frontmatter name does.

## Frontmatter

```yaml
---
name: mk:<slug>
description: "<what it does, in one sentence>. NOT for mk:<neighbour>."
when_to_use: "<the trigger, once>"
keywords: [<5 to 15 lowercase-hyphenated strings>]
user-invocable: true
---
```

The description says what the skill does; `when_to_use` says when. Neither repeats the other.

## What a SKILL.md should say

- The goal, in terms of what a finished run leaves behind.
- When to use it, and when not (name the neighbour skill).
- The outcome and its boundaries, with exact steps only for fragile, destructive or security-sensitive work.
- What it returns, and the exit path when its premise fails. If it reports to a controller, the four-status block.
- Which reference to load for which situation.
- A `## Gotchas` section once a real failure teaches something.

## Security check

If the skill reads untrusted input, copy the block from `mk:skill-template-secure` and apply the Rule of Two (at most two of: untrusted input, sensitive data, state change).

## Register

Add a row to `SKILLS_ATTRIBUTION.md` in the skills folder, when the project keeps one:

```
| mk:<slug> | <org> (original) | | MIT | .claude/skills/<slug>/ |
```

## Anti-patterns

- A skill that duplicates what an existing skill or agent already does.
- Vague triggers ("when appropriate").
- A body past the size caps with no references.
- A skill that writes outside the project.
