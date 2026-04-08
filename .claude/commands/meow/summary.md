# /meow:summary — Conversation Summary Cache Inspector

## Usage

```
/meow:summary
/meow:summary --clear
/meow:summary --status
```

## Behavior

Inspects, clears, or reports the status of the Phase 9 conversation summary cache
maintained by `.claude/hooks/conversation-summary-cache.sh`.

The cache file lives at `.claude/memory/conversation-summary.md` and is generated
by a background `claude -p --model haiku` summarization on the `Stop` hook event,
then re-injected into the next turn via the `UserPromptSubmit` hook.

This command is the **user-facing consumer** of that cache. It does not do any
summarization itself — it just exposes the cache so you can read, edit, or clear
it without needing to `cat` the file by hand.

### Execution Steps

#### Default (no flags) — show current cache

1. Read `.claude/memory/conversation-summary.md`.
2. If frontmatter `session_id` is empty → print "No summary cached for this session yet."
3. Otherwise print the frontmatter (session_id, last_updated, event_count, transcript_size_bytes, summaries) plus the markdown body.
4. Print a footer: "To clear: /meow:summary --clear  |  To check throttle status: /meow:summary --status"

#### `--clear`

1. Overwrite `.claude/memory/conversation-summary.md` with the empty placeholder.
2. Remove `session-state/conversation-summary.lock` if present (forces next Stop to re-summarize).
3. Print "Conversation summary cache cleared."

#### `--status`

1. Read transcript size from the active transcript path (if available via Claude Code).
2. Read frontmatter from the cache file.
3. Compute throttle conditions:
   - `THRESHOLD` = `${MEOWKIT_SUMMARY_THRESHOLD:-20480}` bytes
   - `EVENT_GAP` = `${MEOWKIT_SUMMARY_TURN_GAP:-30}` events
   - `GROWTH_DELTA` = `${MEOWKIT_SUMMARY_GROWTH_DELTA:-5120}` bytes
4. Report whether the next Stop will trigger a summary or skip.
5. Show whether the lock file exists (background worker still running).

## Notes

- The cache is per-session: when a new Claude Code session starts,
  `project-context-loader.sh` clears it automatically.
- To disable summarization entirely, set `MEOWKIT_SUMMARY_CACHE=off` in your env.
- See `.claude/rules/harness-rules.md` Rule 11 for the rationale.
- See `docs/harness-runbook.md` "Token Savings" section for the math + tuning knobs.

## Related

- Hook: `.claude/hooks/conversation-summary-cache.sh`
- Cache: `.claude/memory/conversation-summary.md`
- Lock: `session-state/conversation-summary.lock`
- Rule: `.claude/rules/harness-rules.md` Rule 11
- Plan: `plans/260407-2331-meowkit-harness-gan-architecture/phase-09-conversation-summary-cache.md`
