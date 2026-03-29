---
source: new
original_file: n/a
adapted: no
adaptation_notes: >
  "Queries at the end can improve response quality by up to 30% in tests,
  especially with complex, multi-document inputs."
  Also draws from prompt-crafting-for-different-models.md:
  "Provide context before instructions" (universal principle).
---

# Context Ordering Rules

These rules govern how agents structure prompts, plan files, and task descriptions.

## Rule 1: Long Content First, Query Last

When constructing prompts or plan files with substantial context:
ALWAYS place long-form content (code, docs, background) at the TOP.
ALWAYS place the specific task, query, or instruction at the BOTTOM.

WHY: Anthropic testing shows queries at the end improve response quality
by up to 30%, especially with complex, multi-document inputs.
Source: claude-prompting-best-practices.md — "Long context prompting"

### Structure pattern

```
1. Background / existing code / reference docs     ← TOP (long)
2. Context: what exists now, what the problem is    ← MIDDLE
3. Specific task / instruction / question           ← BOTTOM (short)
```

## Rule 2: Context Before Constraint

When writing rules, plans, or instructions:
ALWAYS explain WHAT and WHY before stating the constraint.

WHY: Agents follow rules more reliably when they understand the reason.
Source: prompt-crafting-for-different-models.md — "Provide context before instructions"

### Pattern

```
BAD:  "NEVER use any type"
GOOD: "TypeScript's any defeats type safety and hides bugs.
       NEVER use any. INSTEAD use unknown + type guards."
```

## Rule 3: Self-Contained Documents

Every plan file, task description, and handoff message MUST be self-contained.
A fresh agent session with zero prior context MUST be able to understand
the document without reading additional files.

WHY: Context windows reset. Agent sessions end. Plans must survive both.
Source: codex-prompt-guide.md — autonomy and persistence principles

### Required in every self-contained document

- WHAT: the goal (one sentence)
- WHERE: file paths for all relevant code
- WHY: the problem being solved
- STATUS: what's done, what's next

## Rule 4: Project Context First

When `docs/project-context.md` exists, ALWAYS load it BEFORE task-specific context.
This file is the agent "constitution" — tech stack, conventions, anti-patterns, testing approach.

WHY: Ensures all agents share the same understanding of project conventions. Without it, agents infer independently and make conflicting assumptions about stack, patterns, and coding standards. Loading it first grounds all subsequent decisions in project reality.
