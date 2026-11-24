# Plan completion audit

Compare the plan's actionable items with what the diff delivers. Report gaps; the user decides what to do about them.

## Find the plan

1. A `tasks/plans/*/plan.md` the user or the session named is the most reliable signal.
2. Otherwise search `tasks/plans/` for the current branch name, then the repo name, then the newest plan edited in the last 24 hours. Read its first 20 lines to confirm it fits this branch's work; if it looks like another project or feature, treat it as no plan.
3. No plan, or an unreadable one, or one with no actionable items: say so and skip.

## Extract items

Take what describes work to be done: checkbox items, numbered implementation steps, imperative statements ("Add X to Y"), file-level specs, test requirements, data-model changes. Ignore context and background sections, open questions (`?`, "TBD"), review report sections, decision records, and explicitly deferred items ("Future:", "Out of scope:", P2 to P4). Tag each CODE, TEST, MIGRATION, CONFIG or DOCS. If the plan runs past about 50 items, audit the phase files this branch touches and say the rest was not audited.

## Cross-reference the diff

Use `git diff origin/<base>...HEAD` and `git log origin/<base>..HEAD --oneline`. Classify each item:

- **DONE**: clear evidence in the diff; cite the files. A touched file alone is not enough, the described behaviour must be there.
- **PARTIAL**: some of the work is present and some is missing.
- **NOT DONE**: no evidence.
- **CHANGED**: a different approach reaches the same goal; note the difference.

Report a checklist per category with the totals, for example `COMPLETION: 4/7 DONE, 1 PARTIAL, 1 NOT DONE, 1 CHANGED`.

## Outcomes

- All DONE or CHANGED: pass.
- Only PARTIAL left: continue, and note it in the PR body.
- Any NOT DONE: show the checklist and ask: A) stop and implement the missing items, B) ship anyway and record each as a follow-up (a P1 entry in `TODOS.md` "Deferred from plan: <path>" if the repo keeps one), C) the items were intentionally dropped (note that in the PR body). Recommend A when core behaviour is missing and B when only docs or config items are.

Add a `## Plan Completion` section with the checklist to the PR body.

If the plan has a verification section, finish with one line: "Plan contains verification steps. Run `/mk:qa` against a running build to check them." Ship does not run them.
