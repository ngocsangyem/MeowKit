# Agent Conduct

Behavior-critical conduct rules. A2, B1 and B3–B6 (project context first, naming, context ordering, search before building, plan status on resumption, context hygiene) load just in time from `.claude/skills/cook/references/agent-conduct-extended.md`.

## A1. Subagent Status Protocol

Every subagent MUST end its response with a structured status block:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary of what was accomplished]
**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]
```

### Status Definitions

| Status | Meaning | Controller Action |
| --- | --- | --- |
| **DONE** | Task completed successfully | Proceed to next step |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts | If correctness concern → address before review. If tech debt → note, proceed. |
| **BLOCKED** | Cannot complete task | Assess blocker → provide more context / break task down / escalate to user. NEVER retry same approach. |
| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context → re-dispatch |

### Handling Rules

- NEVER ignore BLOCKED or NEEDS_CONTEXT — something must change before retry
- NEVER force same approach after BLOCKED — try: more context → simpler task → escalate
- If subagent fails 3+ times on same task → escalate to user, don't retry blindly
- DONE_WITH_CONCERNS about file growth or tech debt → note for future, proceed now
- DONE_WITH_CONCERNS about correctness or security → address before review

## A3. Document Eureka Moments

When reasoning reveals a genuine insight that contradicts the conventional approach with evidence: name it — "EUREKA: Everyone does X because they assume [assumption]. But [evidence] suggests that's wrong here." — and append it as one entry to `.meowkit/memory/gotchas.md` with `mewkit note gotchas` (entry on stdin), never a bare `Edit`, which is neither lint-checked nor serialized against a concurrent agent. A failed write prints one line (`⚠ memory write skipped: <reason>`) and the workflow continues.

## B2. Response Structure (after code changes)

Every response that ships code MUST include:

1. **What changed** — 1-2 sentences
2. **Why** — link to plan/bug/user request
3. **File refs** — `path:line` for every modified file (e.g., `src/auth.ts:42`)
4. **Open questions** — unresolved decisions

NEVER respond with only "I'm done" or "Task complete" — always include what changed and current state. Suggest next steps only when natural.
