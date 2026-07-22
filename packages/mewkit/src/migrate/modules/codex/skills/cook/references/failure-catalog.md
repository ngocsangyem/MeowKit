# Implementation Failure Catalog

Common failure modes during code implementation. Read before starting any build work.

For post-build operational gotchas (parallel deadlocks, stale plans, model tier, memory), see cook `SKILL.md` `## Gotchas`. For implementation-phase generic rationalizations, see `.agents/skills/rule-anti-rationalization.md`.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll test it all at the end" | Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong. Test each slice. |
| "It's faster to do it all at once" | It feels faster until something breaks and you can't find which of 500 changed lines caused it. |
| "These changes are too small to commit separately" | Small commits are free. Large commits hide bugs and make rollbacks painful. |
| "This refactor is small enough to include" | Refactors mixed with features make both harder to review and debug. Separate them. |
| "I already know how to do this" | Knowing is not planning. Write it down. Undisciplined action wastes tokens. |
| "Let me just start coding" | Fastest path = plan then implement then done. Not: implement then debug then rewrite. |

## Red Flags

Observable patterns that indicate you're off-track:

- Skipping Gate 1 because the task "feels simple"
- More than 100 lines of code written without running tests
- Multiple unrelated changes in a single increment
- "Let me just quickly add this too" — scope expansion mid-build
- Build or tests broken between increments
- Large uncommitted changes accumulating
- Touching files outside the task scope "while I'm here"
- Building abstractions before the third use case demands it
- Creating new utility files for one-time operations

## Gate 2 Review-Cycle Failures

- **Silent patch on review-detected regression** — the agent "fixes" the impact (e.g., adds backward-compat code) without surfacing the choice to the user. Recovery: stop, present 2–4 options via the inner harness's clarifying-question surface, record selection in a `## User Decision Addendum` block on the verdict file, then resume per the chosen option. See `review-cycle.md` "Regression Recovery Options".

## Phase 0 / Phase 1 Gate Failures

- **Skipped scout summary** — plan was drafted before the user saw the codebase context. Recovery: pause, run `mk:scout`, present the 3–6 bullet summary, then resume Phase 1.
- **Vague clarifying questions** — options like "Add the feature" instead of "Add to `src/api/users.ts` (matches existing pattern) or new `src/api/profile.ts`". Recovery: re-ask with scout-grounded options that cite file paths.
- **Scout-first / exact-requirements gates fired on plan-path input** — agent misidentified a plan-path invocation as a natural-language task (e.g., `cook "implement feature X described in plan.md"`). Recovery: detect input via path-glob (matches `plan.md` or `phase-*.md`); if matched, skip both gates and load the plan directly.
