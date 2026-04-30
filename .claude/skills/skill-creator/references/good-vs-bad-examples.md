# Good vs Bad Skill Patterns

## Description Field

The description is a TRIGGER CONDITION — it tells Claude WHEN to activate the skill.

**Bad** (summary — tells what it does):
```
description: "This skill analyzes code for security vulnerabilities using OWASP patterns"
```

**Good** (trigger — tells when to use):
```
description: "Use when auditing code for security issues, reviewing auth logic, or scanning dependencies for CVEs. Activates on /audit, security review requests, or pre-ship checks."
```

**Bad** (too vague):
```
description: "Helps with testing"
```

**Good** (specific triggers):
```
description: "Use when writing unit/integration tests, enforcing TDD red-green-refactor, or validating test coverage. Auto-activates during Phase 2 (Test RED) and Phase 3 (Build GREEN)."
```

## Gotchas Section

The Gotchas section is the HIGHEST SIGNAL content. It captures what Claude gets wrong by default.

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
SKILL.md is 80 lines. References:
- `references/api-patterns.md` — loaded when making API calls
- `references/error-codes.md` — loaded when handling errors
- `assets/output-template.md` — loaded when generating output
