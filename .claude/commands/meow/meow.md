# /meow — MeowKit Entry Point and Router

## Usage

```
/meow [task description]
```

## Behavior

This is the "friendly front door" to MeowKit. Users who don't know which command to use start here.

### Execution Steps

1. **Load context.** Read `memory/lessons.md` for project-specific learnings, patterns, and past decisions that may affect routing.

2. **Classify task complexity.** Analyze the task description and assign one of three tiers:
   - **Trivial** — single-file change, typo, simple config update, quick question. Route to `/meow:fix` (simple mode) or answer directly.
   - **Standard** — feature work, bug fix requiring investigation, test writing. Route to `/meow:cook` (full pipeline) or specific command (`/meow:fix`, `/meow:test`, `/meow:review`).
   - **Complex** — multi-service change, architectural decision, new system design. Route to `/meow:plan` first, then `/meow:cook`, or `/meow:arch` / `/meow:design` for design-only work.

3. **Print routing decision:**
   ```
   🐱 Task complexity: [trivial|standard|complex] → routing to [/meow:command]
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
| Error message pasted directly | Standard (route to `/meow:fix`) |
| Question about architecture | Complex (route to `/meow:arch` or `/meow:design`) |
| "review", "audit", "security" | Route to `/meow:review` or `/meow:audit` directly |
| "docs", "document" | Route to `/docs:init` or `/docs:sync` |

### Examples

```
/meow fix the typo in the login button
🐱 Task complexity: trivial → routing to /meow:fix

/meow add user avatar upload to profile page
🐱 Task complexity: standard → routing to /meow:cook

/meow we need to migrate from REST to GraphQL for the user service
🐱 Task complexity: complex → routing to /meow:plan
```
