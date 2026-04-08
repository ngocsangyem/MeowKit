# Step 5: Generate Generator Feedback

For each FAIL/WARN finding, produce one-line specific fix guidance the generator agent can act on. Emit handoff message + return overall verdict to caller.

## Instructions

### 5a. Build the iteration feedback list

Walk `findings` (from step-03) and pull every FAIL or WARN. For each, write a one-line fix guidance entry:

```
{N}. {VERDICT}: {rubric}/{criterion-summary} — {specific actionable}
```

Examples:

```
1. FAIL: functionality/Form submit persistence — POST returns 201 but record never appears in GET. Check item-create handler write to DB.
2. FAIL: design-quality/Hero gradient — purple→pink gradient + Playfair Display is the canonical AI slop signature. Replace with single accent color + one font family.
3. WARN: originality/Hero copy — "TaskFlow — the modern way to manage tasks" is generic. Specific copy referencing the actual product mechanic.
4. FAIL: product-depth/Real-time sync — spec promised real-time but build polls every 5s. Wire WebSocket or SSE for true real-time.
```

**Rules:**
- Specific (cites file or feature, not vague "improve UX")
- Actionable (the generator can do something immediately)
- Single-line (no multi-paragraph debates)
- Cites the rubric (so the generator knows what dimension it failed)
- No vibes ("feels off") — point at the anchor pattern

### 5b. Append the feedback section to the verdict file

Open `verdict_file` (set in step-04) and replace the placeholder Iteration Feedback section:

```markdown
## Iteration Feedback (for generator)

1. FAIL: {rubric}/{criterion} — {fix guidance}
2. FAIL: {rubric}/{criterion} — {fix guidance}
3. WARN: {rubric}/{criterion} — {fix guidance}
...
```

If overall verdict is PASS with no WARN/FAIL findings, write:

```markdown
## Iteration Feedback (for generator)

PASS — no iteration feedback. Proceed to ship.
```

### 5c. Cleanup

If step-02 booted a build process (`build_pid` is set), kill it now:

```bash
if [ -n "${build_pid:-}" ]; then
  kill "$build_pid" 2>/dev/null || true
  echo "Stopped booted build PID $build_pid"
fi
```

Leave the evidence directory in place — it's the verdict's source of truth and the generator may need to read screenshots.

### 5d. Emit the handoff message

Print a structured handoff for the orchestrator/harness:

```
EVALUATOR_VERDICT: {overall_verdict}
VERDICT_FILE: {verdict_file}
WEIGHTED_SCORE: {score}
HARD_FAIL: {true|false}
ITERATIONS_REMAINING: (set by harness, not by evaluator)

FEEDBACK_COUNT: {N}
{feedback list inline}

NEXT_ACTION:
  - PASS → route to shipper (Phase 5)
  - WARN → optional one more iteration (harness decides per budget)
  - FAIL → route back to generator with feedback list above
```

### 5e. Status block

End the evaluator session with the structured status block per `output-format-rules.md` §5:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
**Summary:** {1-2 sentences: overall verdict + key driver}
**Concerns/Blockers:** {if any criteria could not be probed, list them}
```

Examples:

- `DONE` — verdict written, all criteria probed, validator stamped
- `DONE_WITH_CONCERNS` — verdict written, but 2 criteria could not be probed because the WebSocket endpoint was unreachable; verdict reflects partial coverage
- `BLOCKED` — could not produce a verdict (target never came up, rubric library missing, validator persistently rejected)

## Output

- `verdict_file` — final verdict file with feedback section populated
- `overall_verdict` — returned to caller
- `feedback` — list of one-line fix-guidance strings

## Next

This is the final step. Return to the caller (the harness skill or the user who invoked `/meow:evaluate`).

The harness (Phase 5) consumes:
- `overall_verdict` to decide whether to loop the generator or proceed to ship
- `feedback` list to pass into the next generator iteration
- `verdict_file` path for archival in the sprint contract record

End the session.
