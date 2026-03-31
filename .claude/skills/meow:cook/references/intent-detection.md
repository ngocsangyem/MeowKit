# Intent Detection Logic

Detect user intent from input and route to appropriate workflow mode.

## Detection Algorithm

```
FUNCTION detectMode(input):
  # Priority 1: Explicit flags (override all)
  IF input contains "--fast": RETURN "fast"
  IF input contains "--parallel": RETURN "parallel"
  IF input contains "--auto": RETURN "auto"
  IF input contains "--no-test": RETURN "no-test"

  # Priority 2: Plan path detection
  IF input matches path pattern (tasks/plans/*, plan.md, phase-*.md):
    RETURN "code"

  # Priority 3: Keyword detection (case-insensitive)
  keywords = lowercase(input)

  IF keywords contains ["fast", "quick", "rapidly", "asap"]:
    RETURN "fast"
  IF keywords contains ["trust me", "auto", "yolo"]:
    RETURN "auto"
  IF keywords contains ["no test", "skip test", "without test"]:
    RETURN "no-test"

  # Priority 4: Complexity detection
  features = extractFeatures(input)
  IF count(features) >= 3 OR keywords contains "parallel":
    RETURN "parallel"

  # Default: interactive workflow
  RETURN "interactive"
```

## Feature Extraction

Detect multiple features from natural language:

```
"implement auth, payments, and notifications" → ["auth", "payments", "notifications"]
"add login + signup + password reset"         → ["login", "signup", "password reset"]
"create dashboard with charts and tables"     → single feature (dashboard)
```

**Parallel trigger:** 3+ distinct features = parallel mode.

## Mode Behaviors

| Mode        | Research | TDD          | Gate 1             | Gate 2    | Parallel  |
| ----------- | -------- | ------------ | ------------------ | --------- | --------- |
| interactive | Yes      | Yes (strict) | Human              | Human     | No        |
| auto        | Yes      | Yes (strict) | Auto (validated)   | **Human** | Per phase |
| fast        | Skip     | Plan-level   | Human              | **Human** | No        |
| parallel    | Optional | Yes (strict) | Human              | **Human** | Yes       |
| no-test     | Yes      | Skip         | Human              | **Human** | No        |
| code        | Skip     | Yes (strict) | Skip (plan exists) | **Human** | Per plan  |

**Gate 2 is ALWAYS human-approved.** No mode bypasses it.

**TDD column:**

- "Yes (strict)" = failing tests written in Phase 2, implementation fills them in Phase 3
- "Plan-level" = tests cover plan intent (not research-level edge cases), still written before implementation
- "Skip" = no-test mode only, user explicitly opted out

## Edge Cases

- **Ambiguous task** (could be 2 modes): Ask user via `AskUserQuestion` — "Looks like a [fast/parallel] task. Confirm?"
- **Stale plan file** (>14 days old in code mode): Warn — "Plan is [N] days old, codebase may have changed. Continue or re-plan?"
- **Mixed signals** ("quick parallel auth"): Explicit flags win → if `--fast`, fast wins over "parallel" keyword

## Conflict Resolution

Priority order when multiple signals detected:

1. Explicit flags (`--fast`, `--auto`, etc.)
2. Path detection (plan files)
3. Keywords in text
4. Feature count analysis
5. Default (interactive)

## Examples

```
"/meow:cook implement user auth"
→ Mode: interactive (default)

"/meow:cook tasks/plans/260329-auth/plan.md"
→ Mode: code (path detected)

"/meow:cook quick fix for the login bug"
→ Mode: fast ("quick" keyword)

"/meow:cook implement auth, payments, notifications, shipping"
→ Mode: parallel (4 features)

"/meow:cook implement everything --auto"
→ Mode: auto (explicit flag)
```
