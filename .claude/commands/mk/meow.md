# /meow — MeowKit Entry Point and Router

## Usage

```
/meow [task description]
```

## Behavior

This is the "friendly front door" to MeowKit. Users who don't know which command to use start here.

### Execution Steps

1. **Load context.** Read the relevant topic files in `.claude/memory/` — `fixes.md` for bug-class lessons, `review-patterns.md` for review/architecture patterns, `architecture-decisions.md` for past decisions. Load on demand based on the task at hand.

2. **Classify task complexity.** Analyze the task description and assign one of three tiers:
   - **Trivial** — single-file change, typo, simple config update, quick question. Route to `/mk:fix` (simple mode) or answer directly.
   - **Standard** — feature work, bug fix requiring investigation, test writing. Route to `/mk:cook` (full pipeline) or specific command (`/mk:fix`, `/mk:testing`, `/mk:review`).
   - **Complex** — multi-service change, architectural decision, new system design. Route to `/mk:plan-creator` first, then `/mk:cook`, or `/mk:arch` / `/mk:design` for design-only work.

3. **Print routing decision:**
   ```
   🐱 Task complexity: [trivial|standard|complex] → routing to [/mk:command]
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
| Error message pasted directly | Standard (route to `/mk:fix`) |
| Question about architecture | Complex (route to `/mk:arch` or `/mk:design`) |
| "review", "audit", "security" | Route to `/mk:review` or `/mk:audit` directly |
| "docs", "document" | Route to `/docs:init` or `/docs:sync` |

### Examples

```
/meow fix the typo in the login button
🐱 Task complexity: trivial → routing to /mk:fix

/meow add user avatar upload to profile page
🐱 Task complexity: standard → routing to /mk:cook

/meow we need to migrate from REST to GraphQL for the user service
🐱 Task complexity: complex → routing to /mk:plan-creator
```
