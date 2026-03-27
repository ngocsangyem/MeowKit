# Skill Creation Workflow — Detailed Guide

## Step 1: Gather Intent

Ask the user (or infer from context):
1. What should the skill do? (one sentence purpose)
2. When should it auto-activate? (trigger keywords/patterns)
3. What input does it accept? (arguments, flags, file paths)
4. What output does it produce? (structured template? file? report?)
5. Which MeowKit phase does it operate in? (Phase 0-6 or meta)
6. Which agent receives the output? (planner, developer, reviewer, etc.)

## Step 2: Scaffold Directory

```
.claude/skills/meow:{name}/
├── SKILL.md          # Main skill definition (≤100 lines)
└── references/       # Detailed content (if needed)
    └── *.md
```

## Step 3: Generate Frontmatter

```yaml
---
name: meow:{name}
description: "{trigger keywords} + {what it does}"
---
```

Description must be specific enough for Claude to decide when to delegate. Include trigger phrases the user would say.

## Step 4: Fill Required Sections

### Overview (2-3 sentences)
What the skill does + when to use it. Not a marketing pitch — a factual description.

### When to Invoke
- Auto-activate patterns (keywords Claude watches for)
- Explicit call syntax: `/meow:{name} [args]`
- "Do NOT invoke when:" (prevent misuse)

### Process (numbered steps)
Each step must be independently executable. No "do the right thing" steps. If a step needs detail, create a reference file.

### Output Format
Template with `{placeholders}` the agent fills. Not freeform prose. Consuming agent receives consistent structure.

### Failure Handling
| Failure | Detection | Recovery | Message |
|---------|-----------|----------|---------|
For every way the skill can fail: what detects it, what to do, what to tell the user.

### Workflow Integration
"This skill operates in Phase [X] of MeowKit's workflow."
"Output is passed to: [agent name]"

### Handoff Protocol
On completion: what to pass, to whom, in what format.

## Step 5: Security Check

If the skill processes untrusted input, load meow:skill-template-secure and verify:
- Rule of Two compliance (max 2 of: untrusted input, sensitive data, state change)
- Trust model table (what's trusted vs untrusted)
- Content processing rules

## Step 6: Register

Add to `.claude/skills/SKILLS_ATTRIBUTION.md`:
```
| meow:{name} | MeowKit (original) | — | MIT | .claude/skills/meow:{name}/ |
```

## Anti-Patterns

- Don't create skills that duplicate existing agent behavior
- Don't create skills with vague triggers ("when appropriate")
- Don't create skills over 200 lines without references/
- Don't create skills that modify files outside .claude/
