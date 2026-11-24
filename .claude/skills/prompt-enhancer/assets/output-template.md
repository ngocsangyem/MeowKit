<!-- Filled by mk:prompt-enhancer. One template; the variants are short diffs below it.
     Plain markdown headings only: no XML tags, no role line, no vendor tokens.
     Skip a section the prompt does not need (a short prompt keeps only GOAL and a placeholder or two). -->

## Template (default: the rewritten prompt only)

The default mode emits ONLY the code block below: no headings, no preamble, no analysis, because the output is pasted into another agent. `--deep` may add the "Suggested context" block after it.

```
GOAL: <one-sentence outcome with metric or scope>

CONTEXT:
- <file path, optionally with :line>
- <prior decision, ADR, or relevant section of docs/project-context.md>
- <motivation: the problem this solves and for whom>

CONSTRAINTS:
- <what must NOT change>
- <forbidden dependencies or tools>
- <back-compat fences>

ACCEPTANCE CRITERIA:
- [ ] <binary check 1>
- [ ] <binary check 2>

OUTPUT FORMAT:
Freedom level: <LOW | MEDIUM | HIGH> (reason: <one phrase>)
Verbosity: <terse | structured | confirmation>
Shape:
- <for example: "Modified files with a one-line rationale per file.">
- <for example: "New tests under tests/<path> covering hit, miss and fallback.">

EXAMPLES (only if the user supplied them or asked for them):
- <input and output pair>
```

Unknown values are `[FILL-IN: <description>]` placeholders, never invented.

## Variant: `--analyze`

Put these in front of the code block, in order:

1. **Decomposition**: a table of the five components with `present`, `partial` or `missing` and a note.
2. **Issues found**: only the detections that were found, each citing the fragment that triggered it.
3. **Suggestions**: one per finding, from `references/analyze-reference.md`.
4. **Enhanced prompt**: the code block above.

If the draft named a target, add the notes block from `references/target-notes.md` after the suggestions; the rewrite does not change.

## Variant: `--deep`

After the code block, when the scout found at least one hit:

```
### Suggested context (from --deep scout)

- `[FILL-IN: <description>]` -> suggested: `<path-or-symbol>` (one-line public summary if available)

> Deep-mode footer: codebase snapshot `<git-sha>`; docs/project-context.md last updated `<YYYY-MM-DD>`.
```
