---
name: "command-meow"
description: "command-meow"
---

# /meow — Command Entry Point and Router

## Usage

```
/meow [task description]
```

## Behavior

This is the "friendly front door" to the toolkit. Users who don't know which command to use start here.

### Execution Steps

1. **Load context.** Read the relevant topic files in `.meowkit/memory/` on demand based on the task at hand — `.json` store first, `.md` fallback if the `.json` is absent (see `.claude/rules/memory-read-rules.md`): `fixes.json` for bug-class lessons, `review-patterns.json` for review/architecture patterns, `architecture-decisions.json` for past decisions.

2. **Classify task complexity.** Analyze the task description and assign one of three tiers:
   - **Trivial** — single-file change, typo, simple config update, quick question. Route to `the fix skill` (simple mode) or answer directly.
   - **Standard** — feature work, bug fix requiring investigation, test writing. Route to `the cook skill` (full pipeline) or specific command (`the fix skill`, `the testing skill`, `the review skill`).
   - **Complex** — multi-service change, architectural decision, new system design. Route to `the plan-creator skill` first, then `the cook skill`, or `the arch skill` / `the design skill` for design-only work.

3. **Print routing decision:**
   ```
   🐱 Task complexity: [trivial|standard|complex] → routing to [the command skill]
   ```

4. **Route to the appropriate agent/command.** Execute the selected command with the user's task description passed through.

5. **If the task is ambiguous or could be interpreted multiple ways,** ask a clarifying question before routing. Do not guess — the cost of routing wrong is wasted work.

### Classification Heuristics

| Signal | Points toward |
|--------|--------------|
| "fix", "typo", "rename", "update" + single noun | Trivial |
| "add feature", "implement", "build" | Standard |
| "redesign", "migrate", "refactor [system]", "new service" | Complex |
| Mention of multiple services/platforms | Complex |
| Error message pasted directly | Standard (route to `the fix skill`) |
| Question about architecture | Complex (route to `the arch skill` or `the design skill`) |
| "review", "audit", "security" | Route to `the review skill` or `the audit skill` directly |
| "docs", "document" | Route to `/docs:init` or `/docs:sync` |
| "break down spec", "decompose spec", "spec to stories", "breakdown {source}", "stories from spec" | Route to `the breakdown skill` |

### Examples

```
/meow fix the typo in the login button
🐱 Task complexity: trivial → routing to the fix skill

/meow add user avatar upload to profile page
🐱 Task complexity: standard → routing to the cook skill

/meow we need to migrate from REST to GraphQL for the user service
🐱 Task complexity: complex → routing to the plan-creator skill
```