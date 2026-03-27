<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# Coding Standards Detail

## Naming Rules

| Element       | Convention                                            |
| ------------- | ----------------------------------------------------- |
| **Variables** | Reveal intent: `userCount` not `n`                    |
| **Functions** | Verb + noun: `getUserById()` not `user()`             |
| **Booleans**  | Question form: `isActive`, `hasPermission`, `canEdit` |
| **Constants** | SCREAMING_SNAKE: `MAX_RETRY_COUNT`                    |

> If you need a comment to explain a name, rename it.

## Function Rules

| Rule                | Description                           |
| ------------------- | ------------------------------------- |
| **Small**           | Max 20 lines, ideally 5-10            |
| **One Thing**       | Does one thing, does it well          |
| **One Level**       | One level of abstraction per function |
| **Few Args**        | Max 3 arguments, prefer 0-2           |
| **No Side Effects** | Don't mutate inputs unexpectedly      |

## Code Structure

| Pattern           | Apply                             |
| ----------------- | --------------------------------- |
| **Guard Clauses** | Early returns for edge cases      |
| **Flat > Nested** | Avoid deep nesting (max 2 levels) |
| **Composition**   | Small functions composed together |
| **Colocation**    | Keep related code close           |

## AI Coding Style

| Situation             | Action                |
| --------------------- | --------------------- |
| User asks for feature | Write it directly     |
| User reports bug      | Fix it, don't explain |
| No clear requirement  | Ask, don't assume     |

## Anti-Patterns (DON'T)

| Pattern                  | Fix                     |
| ------------------------ | ----------------------- |
| Comment every line       | Delete obvious comments |
| Helper for one-liner     | Inline the code         |
| Factory for 2 objects    | Direct instantiation    |
| utils.ts with 1 function | Put code where used     |
| Deep nesting             | Guard clauses           |
| Magic numbers            | Named constants         |
| God functions            | Split by responsibility |

## Before Editing ANY File

| Question                    | Why                      |
| --------------------------- | ------------------------ |
| What imports this file?     | They might break         |
| What does this file import? | Interface changes        |
| What tests cover this?      | Tests might fail         |
| Is this a shared component? | Multiple places affected |

> Edit the file + all dependent files in the SAME task.

## Verification Scripts

MeowKit validation scripts live at `.claude/scripts/`, not inside individual skills:

| Script               | Purpose                     | Command                                     |
| -------------------- | --------------------------- | ------------------------------------------- |
| `validate.py`        | General code validation     | `python .claude/scripts/validate.py`        |
| `security-scan.py`   | Security pattern scanning   | `python .claude/scripts/security-scan.py`   |
| `injection-audit.py` | Prompt injection detection  | `python .claude/scripts/injection-audit.py` |
| `validate-docs.py`   | Documentation consistency   | `python .claude/scripts/validate-docs.py`   |
| `checklist.py`       | Review checklist automation | `python .claude/scripts/checklist.py`       |

**For project-specific linting/testing:** Use the project's own toolchain (e.g., `npm run lint`, `npm test`, `pytest`). MeowKit's developer agent handles this automatically.

Script output handling: READ → SUMMARIZE → ASK → fix. Never ignore output. Never auto-fix without asking.
