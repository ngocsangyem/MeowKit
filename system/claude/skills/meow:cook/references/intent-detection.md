# Intent Detection Logic

Detect user intent from natural language and route to appropriate workflow.

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
  IF keywords contains ["fast", "quick", "rapidly", "asap"]:
    RETURN "fast"
  IF keywords contains ["trust me", "auto", "yolo", "just do it"]:
    RETURN "auto"
  IF keywords contains ["no test", "skip test", "without test"]:
    RETURN "no-test"

  # Priority 4: Complexity detection
  features = extractFeatures(input)
  IF count(features) >= 3: RETURN "parallel"

  # Default
  RETURN "interactive"
```

## Mode Behaviors

| Mode | Skip Research | Skip Test | Review Gates | Auto-Approve |
|------|---------------|-----------|--------------|--------------|
| interactive | No | No | Yes (stops) | No |
| auto | No | No | No (skips) | Yes (score>=9.5) |
| fast | Yes | No | Yes (stops) | No |
| parallel | Optional | No | Yes (stops) | No |
| no-test | No | Yes | Yes (stops) | No |
| code | Yes | No | Yes (stops) | Per plan |

**Key:** Only `auto` mode skips all review gates.

## Conflict Resolution

Priority order when multiple signals detected:
1. Explicit flags (`--fast`, `--auto`, etc.)
2. Path detection (plan files)
3. Keywords in text
4. Feature count analysis
5. Default (interactive)
