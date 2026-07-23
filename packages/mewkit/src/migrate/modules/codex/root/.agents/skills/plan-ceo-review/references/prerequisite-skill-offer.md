# Prerequisite Skill Offer

## When No Design Doc Found

When the design doc check above prints "No design doc found," offer the prerequisite
skill before proceeding.

Say to the user via stop and ask the user in chat:

> "No design doc found for this branch. `the office-hours skill` produces a structured problem
> statement, premise challenge, and explored alternatives — it gives this review much
> sharper input to work with. Takes about 10 minutes. The design doc is per-feature,
> not per-product — it captures the thinking behind this specific change."

Options:
- A) Run the office-hours skill now (we'll pick up the review right after)
- B) Skip — proceed with standard review

If they skip: "No worries — standard review. If you ever want sharper input, try
the office-hours skill first next time." Then proceed normally. Do not re-offer later in the session.

If they choose A:

Say: "Running the office-hours skill inline. Once the design doc is ready, I'll pick up
the review right where we left off."

Read the office-hours skill file from disk using the Read tool:
`.agents/skills/office-hours/SKILL.md`

Follow it inline, **skipping these sections** (already handled by the parent skill):
- Preamble (run first)
- stop and ask the user in chat Format
- Completeness Principle — Boil the Lake
- Search Before Building
- Contributor Mode
- Completion Status Protocol
- Telemetry (run last)

If the Read fails (file not found), say:
"Could not load the office-hours skill — proceeding with standard review."

After the office-hours skill completes, re-run the design doc check:
```bash
SLUG=$(.codex/scripts/bin/workflow-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
DESIGN=$(ls -t .meowkit/memory/projects/*-$BRANCH-design-*.md 2>/dev/null | head -1)
[ -z "$DESIGN" ] && DESIGN=$(ls -t .meowkit/memory/projects/*-design-*.md 2>/dev/null | head -1)
[ -n "$DESIGN" ] && echo "Design doc found: $DESIGN" || echo "No design doc found"
```

If a design doc is now found, read it and continue the review.
If none was produced (user may have cancelled), proceed with standard review.

## Mid-Session Detection

During Step 0A (Premise Challenge), if the user can't
articulate the problem, keeps changing the problem statement, answers with "I'm not
sure," or is clearly exploring rather than reviewing — offer `the office-hours skill`:

> "It sounds like you're still figuring out what to build — that's totally fine, but
> that's what the office-hours skill is designed for. Want to run the office-hours skill right now?
> We'll pick up right where we left off."

Options: A) Yes, run the office-hours skill now. B) No, keep going.
If they keep going, proceed normally — no guilt, no re-asking.

If they choose A: Read the office-hours skill file from disk:
`.agents/skills/office-hours/SKILL.md`

Follow it inline, skipping these sections (already handled by parent skill):
Preamble, stop and ask the user in chat Format, Completeness Principle, Search Before Building,
Contributor Mode, Completion Status Protocol, Telemetry.

Note current Step 0A progress so you don't re-ask questions already answered.
After completion, re-run the design doc check and resume the review.
