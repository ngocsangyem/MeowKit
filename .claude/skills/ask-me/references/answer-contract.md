# Ask-Me Answer Contract

## Depth guidance

Stop when the answer is supported; these are ceilings, not targets.

| Depth | Typical effort | Output |
|---|---|---|
| quick | A couple of targeted greps and reads of the small slices they find | Direct answer |
| standard | A handful of greps and files, each read only where the grep points | Answer plus evidence |
| deep | Wider reading across modules, up to about 8 greps and 14 files | Saved report allowed |

## Output

Use `## Answer`, mandatory `**Confidence:**`, and `## Evidence` with `path:line` citations.
Add `## Inference`, `## Limitations`, `## Related Next Skill`, and `## Unresolved Questions` only
when applicable.

## Failures

Redirect specialist-owned work; request a concrete missing question; narrow whole-repo scope;
label unavailable evidence low confidence; refuse forbidden paths or unsafe save paths; show
conflicting evidence; stop at the deep ceiling and say what was left unread; and ask before overwriting an existing save target.
