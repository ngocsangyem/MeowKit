---
source: new
original_file: n/a
adapted: no
adaptation_notes: >
  - Lead with a quick explanation of the change, then give more details on context covering where and why
  - structured output with XML tags
  - "Include acceptance criteria", "Be specific about the outcome"
---

# Output Format Rules

These rules govern how agents structure their responses after completing work.

## Rule 1: Every response after code changes MUST include

1. **What changed**: Brief explanation of the change (1-2 sentences)
2. **Why**: The reason for the change (links to plan, bug, or user request)
3. **File refs**: Every modified file listed with path (e.g., `src/auth.ts:42`)
4. **Open questions**: Unresolved issues or decisions needing user input

WHY: Structured responses let users review changes in under 30 seconds.
Source: codex-prompt-guide.md — "Lead with a quick explanation of the change"

### Pattern

```
Changed the session timeout from 5min to 24hr in the auth middleware.
Why: Fixes #123 — users were getting logged out during normal work sessions.
Files: src/middleware/auth.ts:15, src/config/session.ts:8
Open: Should we add a "remember me" checkbox, or apply 24hr universally?
```

## Rule 2: No empty status updates

NEVER respond with only "I'm done" or "Task complete" without specifics.
ALWAYS include what was accomplished and what state things are in.

WHY: "Done" without details forces the user to investigate what changed.
Source: codex-prompt-guide.md — "Include actionable findings in messages"

## Rule 3: Suggest next steps only when natural

If there are logical follow-up actions (run tests, commit, deploy), suggest them briefly.
NEVER suggest next steps when there are none — end the response cleanly.

WHY: Unnecessary suggestions waste attention and create false urgency.
Source: codex-prompt-guide.md — "Do not make suggestions if there are no natural next steps"

## Rule 4: Plan status on resumption

When resuming work on an existing plan, ALWAYS start the response with:

- Current plan status (which phases done/in-progress/blocked)
- What you are about to work on next
- Any blockers discovered

WHY: Resumption context prevents duplicate work and missed steps.
Source: codex-prompt-guide.md — plan closure rule

## Rule 5: Subagent Status Protocol

Every subagent MUST end its response with a structured status block:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary of what was accomplished]
**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]
```

### Status Definitions

| Status                 | Meaning                        | Controller Action                                                                                      |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **DONE**               | Task completed successfully    | Proceed to next step                                                                                   |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts   | If correctness concern → address before review. If tech debt → note, proceed.                          |
| **BLOCKED**            | Cannot complete task           | Assess blocker → provide more context / break task down / escalate to user. NEVER retry same approach. |
| **NEEDS_CONTEXT**      | Missing information to proceed | Provide missing context → re-dispatch                                                                  |

### Handling Rules

- NEVER ignore BLOCKED or NEEDS_CONTEXT — something must change before retry
- NEVER force same approach after BLOCKED — try: more context → simpler task → escalate
- If subagent fails 3+ times on same task → escalate to user, don't retry blindly
- DONE_WITH_CONCERNS about file growth or tech debt → note for future, proceed now
- DONE_WITH_CONCERNS about correctness or security → address before review

WHY: Vague "I'm done" handoffs force the controller to investigate completion state.
Structured status codes eliminate ambiguity and enable automatic routing decisions.
