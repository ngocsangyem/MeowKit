---
title: "mk:clean-code"
description: "Pragmatic coding standards — KISS, DRY, YAGNI, SRP, Boy Scout. For ad-hoc quality reviews at any phase. NOT for post-hoc diff/PR review (use mk:review) or behavior-preserving simplification (use mk:simplify)."
---

# mk:clean-code — Clean Code Standards

## What This Skill Does

Enforces pragmatic, AI-oriented coding standards during authoring and ad-hoc quality reviews. Philosophy: be concise, direct, solution-focused. Write working code, not tutorials. Fix bugs immediately, don't explain first.

For post-implementation complexity reduction within the current diff (Phase 3.5), use `mk:simplify`. `mk:clean-code` is for broader quality-standards enforcement at any phase.

**NOT for:** post-hoc diff/PR review (`mk:review`), behavior-preserving simplification (`mk:simplify`).

## When to Use

- During implementation (Phase 3) to enforce quality as code is written.
- Ad-hoc quality reviews at any phase.
- **Triggers:** any code change that adds or modifies logic.

## Core Capabilities

### Core Principles

| Principle | Rule |
|---|---|
| **SRP** | Single Responsibility — each function/class does ONE thing |
| **DRY** | Don't Repeat Yourself — extract duplicates, reuse |
| **KISS** | Keep It Simple — simplest solution that works |
| **YAGNI** | You Aren't Gonna Need It — don't build unused features |
| **Boy Scout** | Leave code cleaner than you found it |

### Coding Standards (`references/coding-standards.md`)

**Naming Rules:**

| Element | Convention |
|---|---|
| Variables | Reveal intent: `userCount` not `n` |
| Functions | Verb + noun: `getUserById()` not `user()` |
| Booleans | Question form: `isActive`, `hasPermission`, `canEdit` |
| Constants | SCREAMING_SNAKE: `MAX_RETRY_COUNT` |

If you need a comment to explain a name, rename it.

**Function Rules:** Max 20 lines (ideally 5-10). Does one thing. One level of abstraction. Max 3 arguments (prefer 0-2). No side effects — don't mutate inputs.

**Code Structure:** Guard clauses (early returns for edge cases). Flat over nested (max 2 levels). Composition (small functions together). Colocation (related code close).

**Anti-Patterns:**

| Pattern | Fix |
|---|---|
| Comment every line | Delete obvious comments |
| Helper for one-liner | Inline the code |
| Factory for 2 objects | Direct instantiation |
| utils.ts with 1 function | Put code where used |
| Deep nesting | Guard clauses |
| Magic numbers | Named constants |
| God functions | Split by responsibility |

**Summary:**

| Do | Don't |
|---|---|
| Write code directly | Write tutorials |
| Let code self-document | Add obvious comments |
| Fix bugs immediately | Explain the fix first |
| Inline small things | Create unnecessary files |
| Name things clearly | Use abbreviations |
| Keep functions small | Write 100+ line functions |

### Process

1. **Read existing code** — understand structure before changing.
2. **Check dependencies** — What imports this file? What does this file import? What tests cover it? Is this a shared component? Edit the file AND all dependent files in the same task.
3. **Apply coding standards** — load `references/coding-standards.md`.
4. **Self-check** — goal met? all files edited? code works? nothing forgotten?
5. **Run verification** — execute validation scripts.

### Verification Scripts

| Script | Purpose | Command |
|---|---|---|
| `validate.py` | General validation | `.claude/skills/.venv/bin/python3 .claude/scripts/validate.py` |
| `security-scan.py` | Security scanning | `.claude/skills/.venv/bin/python3 .claude/scripts/security-scan.py` |
| `injection-audit.py` | Injection detection | `.claude/skills/.venv/bin/python3 .claude/scripts/injection-audit.py` |
| `validate-docs.py` | Doc consistency | `.claude/skills/.venv/bin/python3 .claude/scripts/validate-docs.py` |
| `checklist.py` | Checklist automation | `.claude/skills/.venv/bin/python3 .claude/scripts/checklist.py` |

## Gotchas

- **Over-abstracting simple code:** Creating helpers for one-time operations violates YAGNI. Three similar lines are better than a premature abstraction.
- **Removing error handling deemed unnecessary:** Stripping try-catch from system boundaries loses resilience. Only remove error handling for internal calls with guaranteed contracts.

## Example Prompts

- "Review my code for clean code violations"
- "Apply clean code standards to the auth module"
- "Check if this function follows SRP and is under 20 lines"

## Pro Tips

- Run `mk:clean-code` during implementation, not just at review time. It's cheaper to fix as you write.
- The "Before editing ANY file" checklist prevents the most common mistake: changing a shared component without checking consumers.
- `mk:clean-code` and `mk:simplify` are complementary: clean-code enforces standards as you write; simplify reduces complexity in completed code.