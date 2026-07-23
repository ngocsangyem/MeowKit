# Input Adapter — Paste Mode (v1)

Single normalized contract: paste-mode markdown → `List<StoryRecord>` (v2 may add `--from-spec`, `--from-intake` adapters; both must produce this same schema).

## StoryRecord Schema

```text
StoryRecord {
  id:                 string         # auto-assigned: "S1", "S2", ...
  title:              string         # 1..255 chars, non-empty
  description:        string         # may be empty; capped to 5000 chars
  acceptance_criteria: string[]      # each AC ≤500 chars; ≥1 required unless [NO_ACS] flagged
  source_body:        string         # the raw markdown block for this story
  source_hash:        string         # SHA-256 hex of the FULL paste body (same for every story in a run)
  flags:              string[]       # subset of {"[NO_ACS]"}
}
```

The `source_hash` is the SHA-256 hex digest of the *entire* paste body (the full blob the user submitted, NOT per-story). This identifies the run for the auto-create source-consistency check. Identical paste bodies produce identical hashes; one character of drift produces a different hash.

## Paste Template (strict)

```text
story: <title — required, 1..255 chars>
description: <body — optional; whitespace-tolerant>
ac:
  - <ac1 — required, ≤500 chars>
  - <ac2>
---
story: <next title>
description: <...>
ac:
  - <...>
```

Rules:

- Required keys per story: `story:` and `ac:` (with ≥1 list item).
- Optional key: `description:`.
- Story separator: a line containing only `---` between blocks.
- The final story does not need a trailing `---`.
- Leading/trailing whitespace tolerated on keys and values.
- Blank lines inside a block are tolerated; the parser ignores them.
- Unknown keys: REJECT with `[MALFORMED_INPUT]` and the offending line number.

## Failure Modes

| Condition | Result |
|-----------|--------|
| Missing `story:` key in a block | `[MALFORMED_INPUT]` — line N — record dropped |
| `story:` value empty | `[MALFORMED_INPUT]` — line N |
| `title` length > 255 chars | REJECT — line N |
| `ac:` list absent OR empty | Record kept with `flags: ["[NO_ACS]"]` — caller must REFUSE to size |
| Any single AC > 500 chars | REJECT — line N (whole story dropped) |
| `description` > 5000 chars | REJECT — line N |
| Unknown key inside a block | `[MALFORMED_INPUT]` — line N |

`[MALFORMED_INPUT]` errors carry the offending line number in the parser output so the user can fix the paste and re-run.

## Validation Order

1. Split the paste body on lines containing only `---`.
2. For each block:
   1. Strip leading/trailing whitespace.
   2. Tokenize on the first colon per non-list line; collect `story:` / `description:` / `ac:` keys.
   3. Validate required-key presence.
   4. Apply length caps.
   5. Build the `StoryRecord`.
3. Compute SHA-256 of the entire paste body (UTF-8, no normalization beyond trailing-newline stripping).
4. Assign `source_hash` to every record in the batch.
5. Auto-assign `id` as `S{index}` starting from `S1`.

## Whitespace Tolerance

- Indentation of `ac:` list items: 2 or 4 spaces (both accepted).
- Trailing spaces on keys/values stripped before validation.
- Carriage returns (`\r\n`) normalized to `\n` before parsing.

## What This Adapter Does NOT Do

- No URL fetching. No file reading except the paste body the SKILL.md layer hands in.
- No upstream-spec/intake awareness — v1 is paste-only.
- No `blocks:` key parsing — v1 input format does not carry blocks metadata; the dev links manually via `mk:jira-relationships` after creation.

## Caller Contract

The SKILL.md orchestration layer is responsible for:

1. Prompting for / receiving the paste body.
2. Calling this adapter logic to produce `List<StoryRecord>`.
3. Pre-flight validation:
   - If ALL stories are flagged `[NO_ACS]` → ABORT with: "No sizeable stories — please add acceptance criteria first."
   - If `--story <id>` was passed and the id does not match any record → ABORT.
4. Passing the (validated) record list inline to the `story-sizer` agent.
