---
name: mk:skill-creator
description: "Scaffolds and registers a new skill. NOT for mk:skill-template-secure."
argument-hint: '[skill-name] [description]'
source: local
original_path: .claude/skills/skill-creator/SKILL.md
adapted_for: claude-code
keywords:
  - skill-creator
  - new-skill
  - scaffold-skill
  - authoring-template
  - gotchas-section
when_to_use: "New skill."
user-invocable: true
owner: portability
criticality: medium
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
---

# Skill Creator

Scaffold and register a new skill, but only when an existing skill cannot carry the need.

Not for the injection-hardened template: `mk:skill-template-secure` holds the block a skill copies when it reads untrusted input.

## When to use

The user asks to create, build or adopt a skill, or to scaffold one from a workflow they repeat. Run from the project root.

## First question

Before scaffolding, ask: what failure or gap was actually observed, and which existing skill was checked and found not to cover it? A skill written without an observed gap tends to add instructions the model follows over the real task, and a skill that duplicates an existing one splits the routing. If an existing skill covers the need, extend that skill instead and say so. If the user cannot name a failure or a checked skill, stop and say what would settle it.

## Process

1. **Load the rules you need.** Read `references/skill-authoring-rules.md` Rules 1, 3, 4, 6, 7, 10, 11, 12 and 13 (the file marks which rules apply to authors). Rule 5 applies when the skill names a `docs/` path. Rules 8 and 9 are kit maintenance and live in `references/maintenance-rules.md`.
2. **Gather intent.** What does it do (one sentence), when does it trigger, when does it not (and which neighbour owns that), what does it return?
3. **Scaffold.** Run the script; it creates `<base>/<slug>/SKILL.md` with the directory named without the `mk:` prefix, like every installed skill (only the frontmatter `name` carries `mk:`):

   ```bash
   node .claude/hooks/lib/skill-python.cjs ${CLAUDE_SKILL_DIR}/scripts/init-skill.py <name> --path .claude/skills
   ```
4. **Write the body** as goal, outcome, boundaries and a way to check the result. Put exact steps only where a step is fragile, destructive or security-sensitive (Rule 6). Move detail into `references/` one level deep, each named in SKILL.md with the condition for loading it.
5. **Untrusted input?** If the skill reads files, pages or API output it does not own, copy the block from `mk:skill-template-secure`.
6. **Check the form.** `mewkit validate --frontmatter` and `mewkit validate --skill-rubric` are the authoritative checks. `scripts/validate-skill.py <dir>` is a quick structural pre-check with one pass mark.
7. **Try it once** on a real task, because form checks cannot show that the skill helps. Fix what the run shows.
8. **Register.** Add a row to `SKILLS_ATTRIBUTION.md` in the skills folder when the project keeps one. Report the directory, the files, the check results and whether it was registered, as one short summary.

## Descriptions

`description` says what the skill does in one sentence, plus `NOT for mk:<neighbour>` when it sits near another skill; the trigger goes in `when_to_use`, stated once (Rule 4, Rule 11). Start with the verb: "Scaffolds and registers a new skill.", not "Use when ...". Examples are in `references/good-vs-bad-examples.md`.

## References

| File | Load when |
| --- | --- |
| `references/skill-authoring-rules.md` | Step 1 (the rulebook) |
| `references/creation-workflow.md` | Step 2 to 4, section-by-section guidance |
| `references/skill-types.md` | Classifying the skill into one of the types |
| `references/good-vs-bad-examples.md` | Writing a description, gotchas or outcome steps |
| `references/filesystem-patterns.md` | Deciding whether the skill needs `scripts/`, `references/` or `assets/` |
| `references/maintenance-rules.md` | Maintaining the kit itself, never for writing a skill |

## Gotchas

- Size caps are one set: SKILL.md at most 500 lines and about 5,000 tokens (Rule 3, Rule 11), with a normal run reading far less. A reference file that sends a normal run through thousands of lines defeats the cap.
- A scaffolded `## Gotchas` section stays out until a real failure earns it; filler entries cost tokens on every read.
- Persistent state a skill creates goes to the host's stable plugin-data location (on Claude Code, `${CLAUDE_PLUGIN_DATA}`), with a fallback of a path the user names; framework state paths (`.meowkit/memory/`, `.meowkit/state/`) are exempt (Rule 2).
