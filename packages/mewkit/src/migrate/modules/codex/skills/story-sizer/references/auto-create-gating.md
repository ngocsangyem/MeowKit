# Auto-Create Gating (Phase 6)

How `--auto-create --project <KEY>` reaches the human confirmation prompt — and the 5 pre-flight checks that ABORT before the prompt is ever shown. **No actual Jira mutation in this phase.** Execution lives in `references/auto-create-execution.md`.

## Arg validation

```text
--auto-create                     REQUIRES --project <KEY>      (else REJECT with usage message)
--project <KEY>                   shape: ^[A-Z][A-Z0-9_]+$        (else REJECT)
--epic <KEY>                      optional. shape: ^[A-Z][A-Z0-9_]+-\d+$
--dry-run-only                    optional test-mode flag. Stops AFTER table render, BEFORE stop and ask the user in chat.
```

Unknown flags REJECT the run.

## 5 Auto-Abort Triggers (run in order)

For each Story Record + its sized output, run all five checks. Any ABORT stops the batch immediately; later checks may not run. The single batch-level prompt only appears when all five pass for every story.

### 1. NO_ACS

```text
for record in records:
    if "[NO_ACS]" in record.flags OR record.sizing.refusal_reason:
        ABORT with: "Story <id> has no sizeable signal: <reason>.
                     Resolve in the paste body and re-run the story-sizer skill --paste."
```

### 2. Injection patterns (Rule 1)

```text
for record in records:
    for haystack in (record.suggested_summary, record.suggested_description):
        for pattern in load_patterns("references/injection-patterns.md"):
            if pattern.lower() in haystack.lower():
                ABORT with quoted pattern + offending field + story id.
                If .claude/scripts/injection-audit.py exists, also fire it
                per injection-rules.md Rule 10.
```

### 3. Length cap

```text
for record in records:
    if len(suggested_summary) > 255:         ABORT "summary exceeds Jira's 255-char limit"
    if len(suggested_description) > 5000:    ABORT "description exceeds 5000-char paste cap"
```

The 5000-char description cap is intentionally below Atlassian's 32k limit so we never hit a partial-truncation surprise.

### 4. Duplicate suspect (deterministic via mk:jira-search)

```text
for record in records:
    sanitized = bash .agents/skills/jira/scripts/jql-sanitize.sh "<suggested_summary>"
    the jira-search skill query "project = <PROJECT> AND summary ~ \"<sanitized>\""
    if response has ANY match:
        ABORT batch with: "<suggested_summary> matches existing <JIRA-KEY>.
                           Close/prune the dupe (or edit the suggestion) and re-run."
```

No similarity threshold — Jira's `~` token matching is the arbiter. Any match aborts the **entire batch**. The user manually prunes or closes duplicates and re-runs — there is no per-ticket override path.

### 5. Source-body hash

```text
recompute_hash = sha256(current_paste_body)
report_hash    = read("source_hash" from report header)
if recompute_hash != report_hash:
    ABORT with: "Paste body changed since sizing. Re-paste the original or
                 re-run the story-sizer skill --paste to regenerate the report."
```

Prevents the "I edited the paste then re-ran auto-create" footgun.

## Dry-run Table

Once all five checks pass, render this markdown table (no Blocks column in v1):

```text
| # | Summary                  | Type  | Points | Epic       | Notes               |
|---|--------------------------|-------|--------|------------|---------------------|
| 1 | Add Google OAuth login   | Story | 3      | AUTH-100   |                     |
| 2 | Logout button in header  | Story | 1      | AUTH-100   |                     |
| 3 | Reset-password flow      | Story | 5      | AUTH-100   | SPLIT SUGGESTED     |
```

Columns:

- `#` — sequential within the batch.
- `Summary` — truncated to 60 chars in the table (full summary in the report).
- `Type` — defaults to `Story`. v1 has no `--type` override flag.
- `Points` — heuristic estimate from Phase 3.
- `Epic` — value of `--epic` if provided, blank otherwise.
- `Notes` — `SPLIT SUGGESTED` marker only; no `Blocks #N` in v1.

## Single Confirmation Gate

After the table, exactly ONE `stop and ask the user in chat`:

```text
Confirm batch creation? (You are about to create <N> tickets in <PROJECT>.)
[Yes, create all]  [No, abort]
```

- `Yes` → hand off to `references/auto-create-execution.md`.
- `No` → exit code 0. Print: "Aborted by user. Report at <path> remains for review."

No "skip confirmation" escape hatch exists. No per-ticket prompt. The batch-level question is the only human gate.

## Dry-run-only Test Mode

When `--dry-run-only` is set:

1. Run all five checks.
2. Render the table.
3. STOP — do NOT call `stop and ask the user in chat`.
4. Print the rendered table to stdout.
5. Exit code 0 (or non-zero if any check ABORTed).

This is the entry point for tests in `tests/story-sizer-auto-create-gating.test.sh`. It exists for unit testing only — a real user never benefits from this flag.

## Defense in depth

Phase 7 execution re-runs the v1 field whitelist + injection-pattern scan at call time. If a future caller bypasses Phase 6 gating (e.g., a programmatic re-entry), Phase 7 still refuses to emit forbidden flags or injection-tainted content.
