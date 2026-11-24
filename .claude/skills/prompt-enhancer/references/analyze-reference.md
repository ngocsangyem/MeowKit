# Analyze reference

Load only for `--analyze`: the checklist behind the "what was weak and why" view. A default rewrite uses it silently, only as a prompt to itself.

## Five components

Label each `present`, `partial` or `missing` in the input. Never rewrite while labelling.

| Component | Present | Partial | Missing |
|---|---|---|---|
| Goal | A measurable outcome ("reduce p50 latency to 200ms") | A verb and object with no metric ("fix the bug") | No outcome ("what do you think?") |
| Context | A file path, system, prior decision | Generic ("for our app") | An action with no anchor ("delete the orphans"): the model fills the gap |
| Constraints | "must not", "preserve", back-compat | Soft preferences | None |
| Acceptance criteria | Checkable items ("all tests pass") | Subjective ("looks clean") | None |
| Output format | A concrete shape (JSON, a PR, 5 bullets) | Vague ("nicely") | None |

## Ten detections

Each is found or not found, citing the exact fragment. List only the found ones, with the fix.

| # | Issue | Cue | Fix (never invent a fact; unknowns become `[FILL-IN: ...]`) |
|---|---|---|---|
| 1 | Goal vague | No measurable noun ("fix", "improve"); a file:line next to "fix" is not vague | One sentence with a metric or scope, or `[FILL-IN: metric]` |
| 2 | No context | No path, system or domain; pure research is exempt | A CONTEXT section from what the user gave, placeholders for the rest |
| 3 | No constraints | No "must not" or preserve | A CONSTRAINTS section: back-compat, forbidden dependencies, untouchable APIs |
| 4 | No acceptance criteria | No checkable item | Two to four binary checks, with `[FILL-IN]` for any number the user did not state |
| 5 | No output format | No shape | An OUTPUT FORMAT section; default to a concise summary with file references |
| 6 | Negative-only instruction | "Don't X" with nothing to do instead | Add "INSTEAD: [FILL-IN: positive direction]" |
| 7 | Laundry-list edge cases | Five or more distinct cases listed | One to three canonical examples plus "and similar cases"; note the reduction |
| 8 | Mixed instructions and data | No separator between a pasted dump and the command | A plain `--- DATA START ---` / `--- DATA END ---` fence around the data, instruction outside it |
| 9 | Wrong ordering | Long content within about 200 characters of the end (inputs over 800 characters) | Long content first, the instruction last |
| 10 | Model-coupled framing | XML tags, role-as-XML, "think step by step", vendor tool names, a hardcoded model name | Plain markdown headings; drop the vendor tokens; keep the ask. The rewrite stays portable across coding agents |

## Rules that hold for every fix

- Keep the user's core ask verbatim ("compare A and B" stays "compare A and B").
- Add no new requirement: suggest "add one to three examples" but do not invent and embed them.
- No padding: three findings means three suggestions.
- With `--deep`, a scout hit becomes `[FILL-IN: description (suggested: path)]`; the user stays the source of truth.
