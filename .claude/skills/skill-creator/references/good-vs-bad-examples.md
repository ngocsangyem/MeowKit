# Good vs Bad Skill Patterns

## Description Field

The `description` says what the skill does in one sentence, with a `NOT for mk:<neighbour>` clause when it sits near another skill. The trigger goes in `when_to_use`, once.

**Bad** (too vague):
```
description: "Helps with testing"
```

**Bad** (a trigger crammed into the description, or an essay):
```
description: "Use when auditing code for security issues, reviewing auth logic, or scanning dependencies for CVEs. Activates on /audit, security review requests, or pre-ship checks."
```

**Good**:
```
description: "Security audit: secrets, deps, OWASP. NOT for mk:vulnerability-scanner."
when_to_use: "Security audit."
```

## Gotchas Section

A Gotchas section is the highest-signal content once it exists, and it exists only when a real failure earned it. It captures what the model gets wrong by default.

**Bad** (obvious/generic):
```
## Gotchas
- Don't forget to test your code
- Always follow best practices
```

**Good** (specific failure modes with fixes):
```
## Gotchas
- **Mocks hiding integration failures**: All mocked tests pass but real service calls fail → Prefer integration tests for critical paths; mock only external services
- **Test coverage gamed by trivial assertions**: 100% coverage with expect(true).toBe(true) → Pair coverage with mutation testing score
```

## Railroading vs Outcome-Focused

**Bad** (railroading — overly prescriptive steps):
```
1. Run git log to find the commit hash
2. Run git cherry-pick <hash>
3. If conflicts, run git status
4. Open each conflicted file
5. Look for <<<< markers
6. Resolve each conflict manually
```

**Good** (outcome-focused — Claude figures out HOW):
```
Cherry-pick the target commit onto a clean branch.
Resolve any conflicts preserving original intent.
If it cannot land cleanly, explain why and stop.
```

Rule: If Claude can figure out the next step from context, don't spell it out.

## Progressive Disclosure

**Bad** (everything in SKILL.md):
SKILL.md is 400 lines with inline API docs, examples, and reference tables.

**Good** (SKILL.md routes, details in subdirs):

```text
SKILL.md is 80 lines. References (the file names here are examples):
- `references/api-patterns.md` — loaded when making API calls
- `references/error-codes.md` — loaded when handling errors
- `assets/output-template.md` — loaded when generating output
```
