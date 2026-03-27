# PRE-REVIEW SYSTEM AUDIT (before Step 0)

Before doing anything else, run a system audit. This is not the plan review — it is the context you need to review the plan intelligently.

Run the following commands:
```
git log --oneline -30                          # Recent history
git diff <base> --stat                           # What's already changed
git stash list                                 # Any stashed work
grep -r "TODO\|FIXME\|HACK\|XXX" -l --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git . | head -30
git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -20  # Recently touched files
```
Then read CLAUDE.md, TODOS.md, and any existing architecture docs.

## Design Doc Check

```bash
SLUG=$(.claude/scripts/bin/meowkit-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
DESIGN=$(ls -t .claude/memory/projects/*-$BRANCH-design-*.md 2>/dev/null | head -1)
[ -z "$DESIGN" ] && DESIGN=$(ls -t .claude/memory/projects/*-design-*.md 2>/dev/null | head -1)
[ -n "$DESIGN" ] && echo "Design doc found: $DESIGN" || echo "No design doc found"
```
If a design doc exists (from `/meow:office-hours`), read it. Use it as the source of truth for the problem statement, constraints, and chosen approach. If it has a `Supersedes:` field, note that this is a revised design.

## Handoff Note Check

Reuses $SLUG and $BRANCH from the design doc check above:
```bash
HANDOFF=$(ls -t .claude/memory/projects/*-$BRANCH-ceo-handoff-*.md 2>/dev/null | head -1)
[ -n "$HANDOFF" ] && echo "HANDOFF_FOUND: $HANDOFF" || echo "NO_HANDOFF"
```
If this block runs in a separate shell from the design doc check, recompute $SLUG and $BRANCH first using the same commands from that block.
If a handoff note is found: read it. This contains system audit findings and discussion
from a prior CEO review session that paused so the user could run `/meow:office-hours`. Use it
as additional context alongside the design doc. The handoff note helps you avoid re-asking
questions the user already answered. Do NOT skip any steps — run the full review, but use
the handoff note to inform your analysis and avoid redundant questions.

Tell the user: "Found a handoff note from your prior CEO review session. I'll use that
context to pick up where we left off."

## TODOS.md Analysis

When reading TODOS.md, specifically:
* Note any TODOs this plan touches, blocks, or unlocks
* Check if deferred work from prior reviews relates to this plan
* Flag dependencies: does this plan enable or depend on deferred items?
* Map known pain points (from TODOS) to this plan's scope

Map:
* What is the current system state?
* What is already in flight (other open PRs, branches, stashed changes)?
* What are the existing known pain points most relevant to this plan?
* Are there any FIXME/TODO comments in files this plan touches?

## Retrospective Check

Check the git log for this branch. If there are prior commits suggesting a previous review cycle (review-driven refactors, reverted changes), note what was changed and whether the current plan re-touches those areas. Be MORE aggressive reviewing areas that were previously problematic. Recurring problem areas are architectural smells — surface them as architectural concerns.

## Frontend/UI Scope Detection

Analyze the plan. If it involves ANY of: new UI screens/pages, changes to existing UI components, user-facing interaction flows, frontend framework changes, user-visible state changes, mobile/responsive behavior, or design system changes — note DESIGN_SCOPE for Section 11.

## Taste Calibration (EXPANSION and SELECTIVE EXPANSION modes)

Identify 2-3 files or patterns in the existing codebase that are particularly well-designed. Note them as style references for the review. Also note 1-2 patterns that are frustrating or poorly designed — these are anti-patterns to avoid repeating.
Report findings before proceeding to Step 0.

## Landscape Check

Read ETHOS.md for the Search Before Building framework (the preamble's Search Before Building section has the path). Before challenging scope, understand the landscape. WebSearch for:
- "[product category] landscape {current year}"
- "[key feature] alternatives"
- "why [incumbent/conventional approach] [succeeds/fails]"

If WebSearch is unavailable, skip this check and note: "Search unavailable — proceeding with in-distribution knowledge only."

Run the three-layer synthesis:
- **[Layer 1]** What's the tried-and-true approach in this space?
- **[Layer 2]** What are the search results saying?
- **[Layer 3]** First-principles reasoning — where might the conventional wisdom be wrong?

Feed into the Premise Challenge (0A) and Dream State Mapping (0C). If you find a eureka moment, surface it during the Expansion opt-in ceremony as a differentiation opportunity. Log it (see preamble).
