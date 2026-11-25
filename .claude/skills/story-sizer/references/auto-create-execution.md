# Auto-Create Execution

Per-ticket two-call sequence invoked AFTER the single batch confirmation gate in gating returns `Yes`. **Re-enforces the field whitelist** at call time (defense in depth even though gating already checked).

## Contents

- [Field Whitelist](#field-whitelist)
- [Two-Call Sequence (per story)](#two-call-sequence-per-story)
- [Audit Comment Template](#audit-comment-template)
- [Created Tickets Report Append](#created-tickets-report-append)
- [Sequencing](#sequencing)
- [Skill Rule of Two — call-time re-check](#skill-rule-of-two--call-time-re-check)
- [What This File Does NOT Do](#what-this-file-does-not-do)

## Field Whitelist

Allowed flags on `/mk:jira-issue create`:

- `--project <KEY>` (REQUIRED)
- `--type <Type>` (defaults to `Story`)
- `--summary "..."` (REQUIRED, ≤255 chars)
- `--story-points <N>` (REQUIRED, Fibonacci 1/2/3/5/8/13)
- `--description "..."` (≤5000 chars)
- `--epic <KEY>` (optional, batch-level — same for every story in the batch)
- `--components <comma-list>` (optional)
- `--labels <comma-list>` (optional)

**Strictly forbidden** (call-time stripped): assignee, priority, sprint, blocks, and custom-field overrides. Gating also rejects these; the executor re-strips as defense in depth.

## Two-Call Sequence (per story)

Summary, description and comment body are text quoted from the spec or ticket, so they are data: inside a double-quoted argument the shell would run their backticks and `$( )`. Run the commands exactly as `scripts/execute-auto-create.py` plans them — it escapes `\`, `$`, `` ` `` and `"` in every quoted value. When you build the `jira-as` call yourself, write the text to a file with the file-write tool and pass `--body "$(cat <body-file>)"` (or `--description`), never the text typed inside the quotes.

### Call A — create the ticket

```text
/mk:jira-issue create
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
- Print: `Batch stopped at story <id> (Call A failed). Created so far: <list>. Manual cleanup: /mk:jira-issue delete <KEY> per stranded ticket.`
- Append `## Created Tickets` to the report covering what *did* get created.
- DO NOT retry. DO NOT auto-rollback. The dev decides whether to delete the stranded tickets.

### Call B — restricted audit comment

```text
/mk:jira-collaborate comment add <NEW-KEY> --body "$(cat <rendered-audit-comment-file>)" --visibility-role Administrators
→ returns ok or error
```

The visibility restriction is mandatory. Audit comments must never reach customers or external watchers; Administrators is the safe default, and the user may name a team role instead.

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
Manual cleanup hint: /mk:jira-issue delete <KEY> per ticket above.
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
2. Confirm the flag-build step did NOT include any forbidden flag.
3. Confirm the description was already truncated to ≤5000 chars at gating.

These are belt-and-braces — gating already enforces them — but they live in the executor too so a programmatic re-entry can't bypass them.

## What This File Does NOT Do

- It does NOT execute Jira calls itself. The actual `bash`/`jira-as` invocations are delegated to the peer skills (`mk:jira-issue`, `mk:jira-collaborate`) by the SKILL.md orchestration layer.
- It does NOT auto-link blocks relationships (not done here; dev links via `mk:jira-relationships` post-create).
- It does NOT assign the ticket, set priority, or place it in a sprint. Those are team-poker decisions that happen post-creation.
