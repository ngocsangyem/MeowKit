# Report Writer

Translates the sized story list (from `scripts/score-story.py`) into a Story Sizing Report at `tasks/reports/story-sizing-{YYMMDD}-{slug}.md`.

## Path Resolution

```text
default:  tasks/reports/story-sizing-{YYMMDD}-{slug}.md
```

- `{YYMMDD}` is the absolute generation date in the local TZ.
- `{slug}` is derived from:
  1. an explicit `--slug` flag at the SKILL.md layer, OR
  2. the first 6 lowercase-kebab tokens of the first story's title, OR
  3. `"paste"` as the final fallback.
- If `tasks/reports/` does not exist, create it.
- If the resolved path already exists AND has the same `source_hash`, surface an idempotency prompt:
  > "Existing report at PATH has same source hash. [Overwrite] [Show diff] [Cancel]"

## Renderer Contract

The writer (`scripts/write-sizing-report.py`) accepts the JSON payload from `score-story.py` plus a small metadata header:

```text
{
  "source_path": "<paste|spec-path|intake-path>",
  "source_hash": "<sha256>",
  "scout_used": false,
  "slug": "...",
  "report_path": "tasks/reports/story-sizing-YYMMDD-slug.md",
  "records": [ <enriched StoryRecord with .sizing>, ... ]
}
```

Rendered Markdown sections per story:

1. **Heading** — `## {id} — {title}` with the sized points + complexity inline.
2. **Description** — italic blockquote.
3. **Acceptance criteria** — bullet list.
4. **Inconsistencies** — bullet list (omitted when empty).
5. **Codebase signals** — bullet list (omitted when `scout_used == false`).
6. **DoR** — sub-section (omitted when `dor_status` is null).
7. **Split suggestion** — sub-section (omitted when `split_proposal` is null).
8. **Refusal notice** — sub-section (only when `refusal_reason` is set).
9. **Suggested Jira create command** — fenced bash block (v1 whitelist: `--project --type --summary --story-points --description [--epic] [--components] [--labels]`). Omitted for REFUSED records.

The summary table at the end lists every story.

## Suggested Create Command — v1 Field Whitelist

Allowed flags:

- `--project <KEY>`  (placeholder `<PROJECT>` until user supplies)
- `--type <Type>`    (defaults to `Story`)
- `--summary "..."`
- `--story-points <N>`
- `--description "..."`  (truncated to 500 chars in the suggested block; full description is in the per-story section)
- `--epic <KEY>`        (only when known at render time)
- `--components <comma-list>`
- `--labels <comma-list>`

Not in v1: `--assignee`, `--priority`, `--sprint`, `--blocks`, `--custom-fields`. Phase 6 / 7 enforce the same whitelist at auto-create time.

## Idempotency

The `source_hash` in the report header is the single mechanism for detecting "is this the same paste body as last time?". If the user re-runs the skill with an identical paste, the writer notices and prompts before overwriting.

## Auto-Create Side Effects (Phase 7)

`auto-create-execution.md` appends `## Created Tickets` (and optionally `## Comment Failures`) to the same report file. Those sections are NOT part of the initial render — they are appended only after batch confirmation completes.
