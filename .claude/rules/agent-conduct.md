# Agent Conduct

Behavior-critical conduct rules. A2, B1 and B3–B6 (project context first, naming, context ordering, search before building, plan status on resumption, context hygiene) load just in time from `.claude/skills/cook/references/agent-conduct-extended.md`.

## A1. Subagent Status Protocol

Every subagent ends its response with this status block, because the controller decides its next step from it:

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
| **BLOCKED** | Cannot complete task | Assess blocker → provide more context / break task down / escalate to user. Do not retry the same approach. |
| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context → re-dispatch |

### Handling Rules

- BLOCKED and NEEDS_CONTEXT always get a response: add context, shrink the task or escalate to the user before a retry, since an unchanged retry fails the same way.
- After 3 failed attempts on the same task, escalate to the user instead of retrying.
- DONE_WITH_CONCERNS about file growth or tech debt → note it for later and proceed. About correctness or security → address it before review.

## A3. Document Eureka Moments

When reasoning reveals a genuine insight that contradicts the conventional approach with evidence: name it — "EUREKA: Everyone does X because they assume [assumption]. But [evidence] suggests that's wrong here." — and append it as one entry to `.meowkit/memory/gotchas.md` with `mewkit note gotchas` (entry on stdin), not a bare `Edit`, which is neither lint-checked nor serialized against a concurrent agent. A failed write prints one line (`⚠ memory write skipped: <reason>`) and the workflow continues.

## B2. Response Structure (after code changes)

A response that ships code includes:

1. **What changed** — 1-2 sentences
2. **Why** — link to plan/bug/user request
3. **File refs** — `path:line` for every modified file (e.g., `src/auth.ts:42`)
4. **Open questions** — unresolved decisions

"I'm done" or "Task complete" alone tells the user nothing; say what changed and where it stands. Suggest next steps only when natural.
