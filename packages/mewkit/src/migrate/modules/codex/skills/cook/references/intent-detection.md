# Intent Detection Logic

Detect user intent from input and route to appropriate workflow mode.

## Contents

- [Detection Algorithm](#detection-algorithm)
- [Feature Extraction](#feature-extraction)
- [Mode Behaviors](#mode-behaviors)
- [Modifier Flags](#modifier-flags)
  - [Auto-Strict Trigger](#auto-strict-trigger)
- [Edge Cases](#edge-cases)
- [Conflict Resolution](#conflict-resolution)
- [Examples](#examples)


## Detection Algorithm

```
FUNCTION detectMode(input):
  # Priority 0.5: Modifier flags (do not change mode, layer on top)
  IF input contains "--verify": SET verify_flag = true
  IF input contains "--strict": SET strict_flag = true
  IF input contains "--no-strict": SET strict_flag = false  # overrides auto-trigger
  IF input contains "--tdd": SET tdd_flag = true

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

| Mode        | Research | TDD        | Gate 1             | Gate 2    | Parallel  |
| ----------- | -------- | ---------- | ------------------ | --------- | --------- |
| interactive | Yes      | RED-strict | Human              | Human     | No        |
| auto        | Yes      | RED-strict | **Human**          | **Human** | Per phase |
| fast        | Skip     | Plan-level | Human              | **Human** | No        |
| parallel    | Optional | RED-strict | Human              | **Human** | Yes       |
| no-test     | Yes      | Skip       | Human              | **Human** | No        |
| code        | Skip     | RED-strict | Skip (plan exists) | **Human** | Per plan  |

**Gate 1 and Gate 2: human approval mandatory in every mode — see `.claude/rules/gate-rules.md` for the full contract.** No mode auto-approves a gate. Auto mode automates the work between gates; validator and evaluator output is evidence presented at a gate, never the approval itself. (`code` mode skips Gate 1 because the plan it executes was already approved at Gate 1 when it was created.)

**TDD column:**

- `RED-strict` = failing tests written in Phase 2 before any implementation. Enforced ONLY when `--tdd` / `MEOWKIT_TDD=1` is active; otherwise Phase 2 stays optional and the developer may implement directly per the approved plan.
- `Plan-level` = tests cover plan intent (not research-level edge cases), no RED gate.
- `Skip` = no Phase 2 (`--no-test` mode; user explicitly opted out).

## Modifier Flags

Modifier flags layer on TOP of the detected mode. They do not change the mode itself.

| Flag | Effect | When It Fires | Relative cost† |
|------|--------|---------------|----------------|
| `--verify` | Light browser check after review passes | Phase 4.5 (between Review and Ship) | [LIGHT] |
| `--strict` | Full evaluator (mk:evaluate) after review passes | Phase 4.5 (between Review and Ship) | [HEAVY] |
| `--no-strict` | Suppress auto-strict trigger from scale-routing | — | — |
| `--tdd` | Write failing tests before implementation | Phase 2 (Test RED) | Varies |

† `[LIGHT]` vs `[HEAVY]` is a relative ordering only. Concrete cost depends on the inner harness, model tier, and target surface — see `SKILL.md` for the canonical variability note.

**Priority:** `--strict` supersedes `--verify` (strict includes verification). If both present, only `--strict` runs.
**Combination:** All modifiers can combine with any mode (`--verify --fast`, `--strict --parallel`, etc.).

### Auto-Strict Trigger

When `mk:scale-routing` returns `level=high` at Phase 0 (Orient), `strict_flag` is automatically set to `true` — even without explicit `--strict` in input.

**Rationale:** High-complexity domains (fintech, healthcare, IoT, gaming) have behavioral requirements that code review alone misses.

**Transparency:** Phase 4.5 logs the reason: `"scale-routing level=high ({domain}), auto-triggering strict evaluation"`.

**Override:** `--no-strict` suppresses auto-strict even when scale-routing says high.

```
# At Phase 0, after scale-routing returns:
IF scale_routing.level == "high" AND NOT input contains "--no-strict":
  SET strict_flag = true
  SET strict_trigger = "auto:scale-routing"
```

## Edge Cases

- **Ambiguous task** (could be 2 modes): Ask user via `stop and ask the user in chat` — "Looks like a [fast/parallel] task. Confirm?"
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
"the cook skill implement user auth"
→ Mode: interactive (default)

"the cook skill tasks/plans/260329-auth/plan.md"
→ Mode: code (path detected)

"the cook skill quick fix for the login bug"
→ Mode: fast ("quick" keyword)

"the cook skill implement auth, payments, notifications, shipping"
→ Mode: parallel (4 features)

"the cook skill implement everything --auto"
→ Mode: auto (explicit flag)

"the cook skill build dashboard --verify"
→ Mode: interactive, verify_flag=true (light browser check)

"the cook skill build payment flow --strict"
→ Mode: interactive, strict_flag=true (full evaluator)

"the cook skill quick fix login --verify --fast"
→ Mode: fast, verify_flag=true (fast workflow + browser verify)
```