# Ask-Me Answer Contract

## Depth budgets

| Depth | Greps | Files | Lines/file | Output |
|---|---:|---:|---:|---|
| quick | 2 | 3 | 80 | Direct answer |
| standard | 5 | 8 | 140 | Answer plus evidence |
| deep | 8 | 14 | 220 | Saved report allowed |

## Output

Use `## Answer`, mandatory `**Confidence:**`, and `## Evidence` with `path:line` citations.
Add `## Inference`, `## Limitations`, `## Related Next Skill`, and `## Unresolved Questions` only
when applicable.

## Failures

Redirect specialist-owned work; request a concrete missing question; narrow whole-repo scope;
label unavailable evidence low confidence; refuse forbidden paths or unsafe save paths; show
conflicting evidence; stop at the depth cap; and ask before overwriting an existing save target.
