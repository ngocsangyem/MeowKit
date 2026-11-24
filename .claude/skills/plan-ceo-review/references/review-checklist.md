# Review Checklist

Read the plan once, then report under the areas that apply. Skip an area that does not (no UI means no UX section) and say why. For each finding give the severity, the location and the fix. Ask the user one question per real decision.

## Severity

- **BLOCKER**: must be fixed before implementation; the plan is not executable as written.
- **HIGH-LEVERAGE**: fixing it noticeably improves the outcome.
- **POLISH**: a small gain; note it and do not block.

Format: `[BLOCKER] Missing auth on /api/payments`.

## What to look for

Five failure patterns matter in every area. State the reason behind a finding, not only the finding.

1. **Silent failures.** Every failure must be visible to the system, the team or the user. A path with no rescue, no test and nothing shown to the user is a BLOCKER.
2. **Unnamed errors.** "Handle errors" is not a plan. Name the failure, what triggers it, what catches it, what the user sees and whether a test covers it. Catch-all handlers are a smell.
3. **Shadow paths.** Each new data flow has a happy path and three more: missing input, empty input, upstream error. Trace all four. User interactions have edge cases too: double submit, navigating away mid-action, a slow connection, stale state.
4. **Deferred work that is not written down.** Anything the plan defers needs a named place (a follow-up task or a "Not in scope" line), or it is lost.
5. **Observability as scope.** New dashboards, alerts and runbooks are deliverables, not post-launch cleanup.

## Areas

| Area | Questions |
|---|---|
| Architecture | Component boundaries and new coupling (is it justified?); what breaks first at 10x load; single points of failure; rollback if it breaks right after shipping and how long it takes. For EXPANSION, what design would make a new engineer say "obvious and clever"? |
| Errors | For each new method or codepath that can fail: what can go wrong, which error, rescued or not, what the user sees. For LLM calls: malformed, empty and refused responses are separate failures. |
| Security | New attack surface (endpoints, params, file paths, jobs); input validation and what happens on bad input; authorization (who can call it, see it, change it); secrets; dependency risk. Blocked patterns are in `.claude/rules/security-rules.md`. |
| Data flow and interaction | The shadow paths above, for every new flow and user-visible interaction. |
| Code quality | Duplication, over- or under-engineering, files over 200 lines, abstractions that do not earn their cost. |
| Tests | Which new behaviours and failure paths have a test or an explicit reason not to; the criteria must be checkable by a command. |
| Performance | Queries in loops, unbounded lists, large payloads, caching and invalidation. |
| Observability | Logs, metrics and traces for new codepaths; how an on-call would diagnose a failure at 3am. |
| Rollout | Partial states, migrations, feature flags, the rollback procedure. |
| Trajectory | Does this move toward or away from where the system is heading in 6-12 months; technical debt created; how reversible the main decisions are. |
| UX (only with UI scope) | States (loading, empty, error, partial), accessibility, responsiveness, and whether the flow matches the user's intent. |

A plan that is a fundamentally worse approach than an available one should hear "scrap it and do this instead", once, with the reason.
