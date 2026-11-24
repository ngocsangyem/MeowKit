# Prompt types

Load at the start of a rewrite. The type tunes emphasis and length only. It never changes the plain-markdown kernel, never adds a role the user did not ask for, and never performs the task the prompt describes.

## Pick one type

Match the strongest signal in the draft. When signals collide, an explicit user signal wins over a destructive or security verb (migrate, delete, auth), which wins over the default. A prompt spanning two types ("research, then plan") takes the later stage for the output shape and keeps both asks.

| Type | Signal | What to emphasise | Length | Freedom |
|---|---|---|---|---|
| Simple rewrite | One short line, verb and object, no metric, no file | Minimal kernel: a goal and one or two `[FILL-IN]`; skip empty sections | Short | MEDIUM |
| Coding implementation | add, implement, build, create; file paths present | Full kernel; a verification command in the acceptance criteria | Medium | MEDIUM |
| Code review | review, audit, check an existing artifact | Ask for findings (severity, evidence, decisions needed); do not perform the review | Medium | MEDIUM |
| Research | research, find, compare, evaluate, investigate | Allowed sources, a citation requirement, confidence levels, long data first and the question last; frames the discovery, performs none | Medium to long | HIGH |
| Planning | plan, roadmap, "don't implement" | Phases, dependencies, non-goals; keep a stated "no implementation" constraint | Medium | HIGH |
| Debugging | broken, failing, "why does" | The symptom and evidence first, a hypothesis to test, what must not change | Medium | MEDIUM |
| Migration | migrate, port, upgrade, refactor across | Back-compat fence, per-step verification, the public contract preserved | Medium to long | LOW |
| Long context | Over about 5,000 characters, a notes file, many turns | Long data first, the ask last, identifiers instead of pasted bodies | Long | MEDIUM |

Freedom is the suggested level of the OUTPUT FORMAT line: LOW for fragile, sequenced or destructive work, MEDIUM for standard feature work, HIGH for open-ended exploration. Show it with a one-phrase reason so the user can flip it without re-running.

A simple prompt stays short. Do not inflate it into a heavy template.

## Architecture review

When the draft asks for an architecture review, use `references/architecture-review-mode.md`: it rewrites the prompt to ask for a review and never performs one (that is `mk:review`).

## Target notes

When `--analyze` is set and the draft names a target model or runtime, add the notes from `references/target-notes.md` after the analysis. Default mode emits nothing from it.
