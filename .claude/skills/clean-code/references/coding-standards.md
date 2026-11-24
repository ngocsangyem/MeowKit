# Coding standards defaults

Defaults for code that has no project convention. The project's lint config and `docs/code-standards.md` win over this file.

## Naming

| Element | Convention |
|---|---|
| Variables | Reveal intent: `userCount`, not `n` |
| Functions | Verb and noun: `getUserById()` |
| Booleans | Question form: `isActive`, `hasPermission` |
| Constants | `SCREAMING_SNAKE` |

If a name needs a comment to explain it, rename it.

## Functions and structure

- Do one thing at one level of abstraction. Past about 50 lines or three levels of nesting, look for a split; these numbers are rules of thumb, and `mk:simplify` uses the same ones.
- More than three arguments usually means an options object or a missing type.
- Prefer guard clauses and early returns to nesting, and keep related code together.
- Do not mutate inputs unexpectedly.

## Anti-patterns

| Pattern | Instead |
|---|---|
| A comment on every line | Delete the obvious ones |
| A helper for a one-liner | Inline it |
| A factory for two objects | Instantiate directly |
| A `utils` file with one function | Put the code where it is used |
| Magic numbers | Named constants |
| God functions | Split by responsibility |

## Checks

Use the project's own toolchain for lint and tests. `mk:lint-and-validate` runs the fast post-edit subset. Read a tool's output before acting on it and summarize it; ask before auto-fixing files you did not change.
