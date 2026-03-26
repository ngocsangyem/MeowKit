# Prerequisite Skill Offer

## When No Design Doc Found

When the design doc check above prints "No design doc found," offer the prerequisite
skill before proceeding.

Say to the user via AskUserQuestion:

> "No design doc found for this branch. `/meow:office-hours` produces a structured problem
> statement, premise challenge, and explored alternatives — it gives this review much
> sharper input to work with. Takes about 10 minutes. The design doc is per-feature,
> not per-product — it captures the thinking behind this specific change."

Options:
- A) Run /meow:office-hours now (we'll pick up the review right after)
- B) Skip — proceed with standard review

If they skip: "No worries — standard review. If you ever want sharper input, try
/meow:office-hours first next time." Then proceed normally. Do not re-offer later in the session.

If they choose A:

Say: "Running /meow:office-hours inline. Once the design doc is ready, I'll pick up
the review right where we left off."

Read the office-hours skill file from disk using the Read tool:
`~/.claude/skills/meow:office-hours/SKILL.md`

Follow it inline, **skipping these sections** (already handled by the parent skill):
- Preamble (run first)
- AskUserQuestion Format
- Completeness Principle — Boil the Lake
- Search Before Building
- Contributor Mode
- Completion Status Protocol
- Telemetry (run last)

If the Read fails (file not found), say:
"Could not load /meow:office-hours — proceeding with standard review."

After /meow:office-hours completes, re-run the design doc check:
```bash
SLUG=$(~/.claude/skills/meow:browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-$BRANCH-design-*.md 2>/dev/null | head -1)
[ -z "$DESIGN" ] && DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-design-*.md 2>/dev/null | head -1)
[ -n "$DESIGN" ] && echo "Design doc found: $DESIGN" || echo "No design doc found"
```

If a design doc is now found, read it and continue the review.
If none was produced (user may have cancelled), proceed with standard review.

## Mid-Session Detection

During Step 0A (Premise Challenge), if the user can't
articulate the problem, keeps changing the problem statement, answers with "I'm not
sure," or is clearly exploring rather than reviewing — offer `/meow:office-hours`:

> "It sounds like you're still figuring out what to build — that's totally fine, but
> that's what /meow:office-hours is designed for. Want to run /meow:office-hours right now?
> We'll pick up right where we left off."

Options: A) Yes, run /meow:office-hours now. B) No, keep going.
If they keep going, proceed normally — no guilt, no re-asking.

If they choose A: Read the office-hours skill file from disk:
`~/.claude/skills/meow:office-hours/SKILL.md`

Follow it inline, skipping these sections (already handled by parent skill):
Preamble, AskUserQuestion Format, Completeness Principle, Search Before Building,
Contributor Mode, Completion Status Protocol, Telemetry.

Note current Step 0A progress so you don't re-ask questions already answered.
After completion, re-run the design doc check and resume the review.
