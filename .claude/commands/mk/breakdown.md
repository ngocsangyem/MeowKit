---
description: "Decompose a spec/PRD into sized user stories with optional Jira ticket creation and codebase-aware tech breakdown. Stops before plan creation."
---

# /mk:breakdown — Spec to stories + optional tickets + tech breakdown

## When to use

Use when you have a Confluence page, Jira epic, GitHub issue, Linear ticket, or pasted PRD and want: (1) refined user stories, (2) optional Jira tickets, (3) codebase-aware tech breakdown report. Stops before plan creation.

- NOT for sprint capacity planning → `mk:planning-engine`
- NOT for bulk ticket creation → `mk:story-sizer --auto-create`
- NOT for implementation planning → `/mk:plan`
- NOT for single-ticket analysis or RCA → `mk:intake` or `mk:jira-analyst`

## Usage

```
/mk:breakdown <source> [--source confluence|jira|github|linear|paste] [--project <KEY>]
```

- `<source>`: Confluence URL/page-id, Jira KEY, GitHub issue URL, Linear URL, file path, or omit when using `--paste`.
- `--source`: Override auto-detection.
- `--project <KEY>`: Required when Jira creation confirmed in Phase D. If absent at first Create, Phase D aborts; spec analysis is preserved; Phase E emits a re-run footer.

**Idempotency:** Same-day re-run overwrites `breakdown-{YYMMDD}-{slug}.md`. Tickets already in Jira remain — pick "Skip" for existing stories on re-run.

## Behavior

### Step 0 — Env preflight

Check `MEOW_JIRA_URL`, `MEOW_JIRA_USER`, `MEOW_JIRA_TOKEN`. If any missing: print `⚠ Jira not configured. Phases C+D will be skipped. Set MEOW_JIRA_* in meowkit/.claude/.env to enable ticket creation.` Set `jira_skip=true`. Otherwise `jira_skip=false`.

### Step 1 — Source detection

Resolve `source_type` from arg + optional `--source` flag (explicit flag wins). Apply patterns in order, stop at first match:

1. `*.atlassian.net/wiki/spaces/*/pages/*` → `confluence`
2. `*.atlassian.net/wiki/x/*` → shortlink, NOT auto-resolved. Print `Confluence shortlink. Provide canonical URL (.../wiki/spaces/{KEY}/pages/{ID}/...).` Exit.
3. digits-only → `confluence`
4. `^[A-Z][A-Z0-9_]+-\d+$` → `jira`
5. `github.com/.*/issues/\d+` → `github`
6. `linear.app/` → `linear`
7. `--paste` OR existing file path → `paste`
8. No match → prompt for paste content or `--source <type>`.

If `source_type=confluence` and `MEOW_CONFLUENCE_*` missing: print `Confluence not configured. Run /mk:confluence-setup.` Exit.

### Step 2 — Output directory

If `MEOWKIT_ACTIVE_PLAN` is set and valid: `output_dir = {MEOWKIT_ACTIVE_PLAN}/research/`. Else: `output_dir = tasks/reports/`. Created by Phase E if absent.

### Step 3 — Phase A: Spec analysis

**Confluence**: invoke `/mk:confluence-spec-analyst analyze <id> --with-commands`. After agent completes:
- Extract `spec_report_path` from final-response sentence starting with `Report written to`.
- Validate: file exists AND `head -1` matches `# Spec Research Report:`. If invalid: print `Phase A failed: spec-analyst report not found or malformed.` Exit without writing report.
- If agent errored (page not found, permission, non-Cloud): print agent error verbatim. Exit.
- Scan response for `[INCOMPLETE: N of M children failed:`. If present: set `spec_incomplete=true`, capture text into `spec_incomplete_note`. Do NOT abort — root succeeded, only children failed; Phase E surfaces as ⚠ banner.

**Non-Confluence** (`jira`/`github`/`linear`/`paste`): invoke `/mk:intake <source>`. Set `spec_report_path=NONE`. Capture `Suggested Breakdown` section from intake output as `intake_summary`. Then print `ℹ No spec file available for non-Confluence source — planning-engine will run ticket-only (no --spec context).` so the user knows Phase C will be weaker.

Intake failure handling (matches `mk:intake` contract tiers):
- completeness `<40` → return-to-author tier: print intake's response verbatim and exit (the spec is too thin to decompose).
- completeness `40–59` → clarification tier: surface intake's clarification request to the user; if user supplies clarification, re-run intake; if user opts to abort, exit cleanly. Do NOT hard-exit silently.
- injection detected OR adapter missing with no paste fallback → print intake error verbatim. Exit.

### Step 4 — Phase B: Story decomposition

Parse Phase A output into `stories[]`. Source: Confluence → `spec_report_path`'s `## Suggested User Stories` table; non-Confluence → `intake_summary`.

For each story extract: `title`, `ac[]` (from `AC:` or `Acceptance Criteria:` sub-items), `complexity_hint` (else `"unknown"`), `affected_files=[]` (placeholder).

If `stories[]` empty: print `Phase A produced no user stories. Exiting.` Exit without writing report.

### Step 5 — Phase D: Per-story ticket gate

If `jira_skip=true`: mark all stories `ticket="not created (jira not configured)"`. Skip to Step 6.

If `--project` absent: print `Error: --project <KEY> required. Spec analysis preserved. Re-run: /mk:breakdown <source> --project <YOUR_KEY>`. Set `no_project_key=true`. Mark all stories `ticket="not created (no project key)"`. Skip to Step 6 with `ticket_keys=[]`.

Initialize `ticket_keys=[]`, `skip_all=false`.

For each `story` in `stories` (N of M):
- If `skip_all=true`: mark `story.ticket="skipped"`; continue.
- Ask via `AskUserQuestion` (5-rule format: re-ground / simplify / recommend / lettered options with effort `human/CC` annotations / one decision per call):
  - Re-ground: `Story N/M from {source_type}: "{title}"`
  - Simplify: render `ac` as bullets; include `complexity_hint` if not `"unknown"`
  - Recommend: `Choose A if in scope for next sprint. Completeness: A=10/10 B=9/10 C=8/10 D=7/10`
  - Options (lettered with effort `human/CC`):
    - **A) Create ticket** (~10s / ~30s) — invoke `mk:jira-issue` immediately
    - **B) Edit then create** (~2min / ~45s) — capture edits via `Other`/`notes`, then invoke
    - **C) Skip this story** (~5s / ~5s) — no ticket; story still in report
    - **D) Skip all remaining** (~5s / ~5s) — break loop with tickets created so far

**On A:** Invoke `/mk:jira-issue create --project <KEY> --type Story --template story --summary "<title>" --description "<ac as markdown bullets>"`. Extract key via `[A-Z][A-Z0-9_]+-\d+`. Store in `story.ticket`; append to `ticket_keys[]`. On error: `story.ticket="CREATE_FAILED({error})"`; do NOT append to `ticket_keys[]`.

**On B:** Capture revised content via the `Other` free-text input (or option's `notes` annotation). Parse: line 1 = `story.title`; lines starting with `- ` or `* ` = `story.ac[]`. Empty response: treat as A; print `No edits captured — creating as-is.` Validate: if updated title empty, reject and re-prompt once; after 2 rejections, fall back to C (Skip). Then proceed as A with updated values.

**On C:** `story.ticket="skipped"`.

**On D:** `story.ticket="skipped"`; `skip_all=true`; print `Skipping remaining stories. Proceeding with {len(ticket_keys)} ticket(s).`

### Step 6 — Phase C: Tech breakdown

If `ticket_keys[]` empty: print `Phase C skipped — no tickets created.` Set `planning_report_path=NONE`. Proceed to Step 7.

Build invocation: `tickets_arg = ticket_keys joined with commas`. Command: `/mk:planning-engine plan --tickets {tickets_arg}`. If `spec_report_path != NONE`: append ` --spec "{spec_report_path}"` (quote to handle spaces). Do NOT pass `--capacity` or `--scout` (v1 scope).

Invoke. After agent completes, extract `planning_report_path` from sentence starting with `Planning report written to` or `Report saved to`. If neither matches: `planning_report_path=NONE`.

If planning-engine errors (jira-as missing, ticket not found, etc.): set `planning_report_path=NONE`, record error as `phase_c_error`, print `Phase C error: {error}. Tech breakdown will be omitted from report.` Proceed to Step 7.

Degradation flags (non-fatal — record, do not abort):
- `[NO_SPEC_CONTEXT: *]` → `phase_c_note="Spec context unavailable during breakdown"`
- `[NO_CODEBASE_CONTEXT]` → `phase_c_note="Codebase context unavailable (run /mk:scout first for richer breakdown)"`

### Step 7 — Phase E: Write report

Reached when Phase A succeeded AND `stories[]` non-empty. Phase A hard-fail and empty `stories[]` exit before this step (no partial-write commitment).

**Filename:** `date=YYMMDD`; `slug` = kebab-case from source: Confluence → last URL path segment lowercased; Jira KEY → lowercase (`eng-123`); GitHub → `{repo}-issue-{number}`; Linear → `linear-{id}`; paste/file → `paste` or basename. Empty slug → fall back to `source_type`. `report_path = {output_dir}/breakdown-{date}-{slug}.md`. Create `output_dir` if absent.

**Report sections** (write to `report_path`):

- `# Breakdown Report — {slug}`
- `## Source` — Type/Link/Analyzed timestamp
- `## Spec Summary` — if `spec_incomplete`: prepend `⚠ PARTIAL SPEC: {spec_incomplete_note}. Re-run with --include-children 5 after Confluence recovers.` Then Phase A requirements/gaps/ambiguities. If `spec_report_path != NONE`: append `Full spec report: {spec_report_path}`.
- `## Stories` — per story: `### Story {N} — {title}` with `AC:`, `Ticket: {story.ticket}`, `Complexity: {complexity_hint or "n/a"}`, `Affected files / Dependencies / Risk flags:` (from planning-engine, else `n/a`).
- `## Open Questions` — Phase A gaps/ambiguities; `None identified.` if empty.
- `## Tech Breakdown` — `Full planning report: {planning_report_path}` if set; `Tech breakdown error: {phase_c_error}` if set; `{phase_c_note}` if set; `Tech breakdown skipped — no project key supplied.` if `no_project_key=true`; `Tech breakdown skipped — no tickets created.` if `ticket_keys=[]` and `jira_skip=false` and `no_project_key` not set; `Tech breakdown skipped — Jira not configured.` if `jira_skip=true`.
- `## Suggested Next Action` — pick footer below.

**Footer selection** (first match wins):

| State | Footer |
|---|---|
| `jira_skip=true` | `Jira not configured. Set MEOW_JIRA_* in meowkit/.claude/.env and re-run: /mk:breakdown <source> --project <KEY>` |
| `no_project_key=true` | `--project <KEY> not supplied. Spec analysis preserved. Re-run: /mk:breakdown <source> --project <YOUR_KEY> (same-day overwrites). Or create tickets manually then /mk:planning-engine plan --tickets <KEYs> [--spec {spec_report_path}].` |
| `ticket_keys` non-empty AND `planning_report_path != NONE` | `Run /mk:plan {report_path} when ready to write an implementation plan.` |
| `ticket_keys` non-empty AND `planning_report_path == NONE` | `Tech breakdown not generated. Run: /mk:planning-engine plan --tickets {keys-joined} [--spec {spec_report_path}]. Then: /mk:plan {report_path}` |
| Else (no tickets, Jira enabled, project supplied) | `No tickets created (all skipped). Create manually then run /mk:planning-engine plan --tickets <KEYs>. When done: /mk:plan {report_path}` |

After write, print: `✓ Breakdown report written to: {report_path}`.
