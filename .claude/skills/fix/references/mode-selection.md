# Mode Selection

Use `AskUserQuestion` at start of fixing workflow.

## AskUserQuestion Format

```json
{
  "questions": [{
    "question": "How should I handle the fix workflow?",
    "header": "Fix Mode",
    "options": [
      {
        "label": "Autonomous (Recommended)",
        "description": "Auto-fixes blocking issues, then stops at ready-for-approval; never self-approves"
      },
      {
        "label": "Human-in-the-loop",
        "description": "Pause for approval at each major step"
      },
      {
        "label": "Quick fix",
        "description": "Fast debug-fix-review cycle for simple issues"
      }
    ],
    "multiSelect": false
  }]
}
```

## Mode Recommendations

| Issue Type | Recommended Mode |
|------------|------------------|
| Type errors, lint errors | Quick |
| Single file bugs | Quick or Autonomous |
| Multi-file, unclear root cause | Autonomous |
| Production/critical code | Human-in-the-loop |
| System-wide/architecture | Human-in-the-loop |
| Security vulnerabilities | Human-in-the-loop |

## Skip Mode Selection When

- Issue is clearly trivial (type error keyword detected) → default Quick
- User explicitly specified mode in prompt
- Previous context already established mode
