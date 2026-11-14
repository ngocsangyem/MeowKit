# Auto-Create Execution (Phase 7)

Per-ticket two-call sequence invoked AFTER the single batch confirmation gate in Phase 6 returns `Yes`. **Re-enforces the v1 field whitelist** at call time (defense in depth even though Phase 6 already checked).

## Field Whitelist (v1)

Allowed flags on `the jira-issue skill create`:

- `--project <KEY>` (REQUIRED)
- `--type <Type>` (defaults to `Story`)
- `--summary "..."` (REQUIRED, ≤255 chars)
- `--story-points <N>` (REQUIRED, Fibonacci 1/2/3/5/8/13)
- `--description "..."` (≤5000 chars)
- `--epic <KEY>` (optional, batch-level — same for every story in the batch)
- `--components <comma-list>` (optional)
- `--labels <comma-list>` (optional)

**Strictly forbidden in v1** (call-time stripped): assignee, priority, sprint, blocks, and custom-field overrides. Phase 6 also rejects these at gating time; the executor re-strips as defense in depth.

## Two-Call Sequence (per story)

### Call A — create the ticket

```text
the jira-issue skill create
    --project <KEY> --type Story
    --summary "<story.title>"
    --story-points <story.sizing.points>
    --description "<story.description (≤5000)>"
    [--epic <KEY>]                       # only when batch flag set
    [--components <list>]                # only when supplied
    [--labels <list>]                    # only when supplied
→ returns NEW-KEY (e.g. AUTH-201) or error
```

On non-zero exit / error envelope:

- STOP the batch immediately.
- Print: `Batch stopped at story <id> (Call A failed). Created so far: <list>. Manual cleanup: the jira-lifecycle skill delete <KEY> per stranded ticket.`
- Append `## Created Tickets` to the report covering what *did* get created.
- DO NOT retry. DO NOT auto-rollback. The dev decides whether to delete the stranded tickets.

### Call B — internal audit comment

```text
the jira-collaborate skill add-comment <NEW-KEY> --body "<rendered audit-comment template>" --internal
→ returns ok or error
```

The `--internal` flag is mandatory. Audit comments are team-only and must never leak to customers/external watchers.

On Call-B error:

- Log a WARN.
- Continue to the next story (do NOT stop the batch).
- Add a row to `## Comment Failures` in the report with story-id, NEW-KEY, and the error message.

## Audit Comment Template

Default template (rendered with the three placeholders below):

```text
Initial sizing from mk:story-sizer: {{points}} points (heuristic).
Source: {{report_path}} §{{story_id}}.
Pending team refinement via mk:jira-estimator.
```

Placeholders (NEVER include raw description text — PII safety):

- `{{points}}` — sized point estimate
- `{{report_path}}` — relative path to the sizing report
- `{{story_id}}` — story id in the report (S1, S2, …)

### Template override

`MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE` env var, if set, points to a file path containing a custom template with the same placeholders. The legacy `MEOW_*` prefix is NOT honored — only `MEOWKIT_*`.

```bash
export MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE=/path/to/team-template.txt
```

If the path does not exist or the file lacks any placeholder, the script logs a warning and falls back to the default template.

## Created Tickets Report Append

After the batch (whether fully or partially) finishes, append a `## Created Tickets` section to the sizing report:

```text
## Created Tickets

| Story | Title              | New Key  | Points | Comment status |
|-------|--------------------|----------|--------|----------------|
| S1    | Add Google OAuth   | AUTH-201 | 3      | ok             |
| S2    | Logout button      | AUTH-202 | 1      | WARN (network) |
```

When Call A stopped mid-batch, also append:

```text
### Stopped at S3 — Call A failed

Reason: <error message>
Manual cleanup hint: the jira-lifecycle skill delete <KEY> per ticket above.
```

When any Call B failed, also append:

```text
## Comment Failures

- S2 (AUTH-202): <error message>
```

## Sequencing

Stories execute **sequentially** in `id` order — never in parallel. Sequential execution:

- Lets `jira-as` rate-limit naturally.
- Keeps the "Stopped at story X" message accurate (no partial parallel completion).
- Avoids interleaved tickets that the cleanup hint would struggle to enumerate.

## Skill Rule of Two — call-time re-check

Before every Call A:

1. Confirm the agent body (story-sizer) is NOT invoking the credentialed Jira wrapper directly.
2. Confirm the flag-build step did NOT include any forbidden v1 flag.
3. Confirm the description was already truncated to ≤5000 chars at Phase 6.

These are belt-and-braces — Phase 6 already enforces them — but they live in the executor too so a programmatic re-entry can't bypass them.

## What This File Does NOT Do

- It does NOT execute Jira calls itself. The actual `bash`/`jira-as` invocations are delegated to the peer skills (`mk:jira-issue`, `mk:jira-collaborate`) by the SKILL.md orchestration layer.
- It does NOT auto-link blocks relationships (deferred from v1; dev links via `mk:jira-relationships` post-create).
- It does NOT assign the ticket, set priority, or place it in a sprint. Those are team-poker decisions that happen post-creation.
