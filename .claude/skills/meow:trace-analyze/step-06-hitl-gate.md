# Step 6: HITL Gate — Human Review of Each Suggestion

Present each suggestion individually via `AskUserQuestion`. Approved suggestions land in `suggestions.md`. Modified suggestions get the user's revised version. Rejected suggestions land in `rejected.md` with the reason. **No auto-apply, ever.**

## Instructions

### 6a. Read the draft

```bash
DRAFT="$analysis_dir/suggestions-draft.md"
[ -f "$DRAFT" ] || { echo "BLOCKED: no suggestions-draft.md from step-05" >&2; exit 1; }
```

### 6b. For each suggestion, present via AskUserQuestion

The agent walks the YAML blocks in `suggestions-draft.md`. For each one:

```
AskUserQuestion(
  question: "Suggestion {N}/{total}: pattern '{pattern}' detected {occurrences} times across runs {affected_runs}.

  Proposed fix: {change_description}

  Rationale: {rationale}

  Expected impact: {expected_impact}

  How do you want to proceed?",
  header: "Trace Analyzer",
  options: [
    { label: "Approve", description: "Add this suggestion to the follow-up plan as-is" },
    { label: "Modify", description: "I'll provide a revised version" },
    { label: "Reject", description: "Skip this suggestion (with reason)" }
  ]
)
```

**One suggestion per AskUserQuestion call.** No bulk-approve. No "approve all remaining."

### 6c. Process the user's selection

| User selection | Action |
|---|---|
| Approve | Append the suggestion verbatim to `$analysis_dir/suggestions.md` |
| Modify | Ask follow-up `AskUserQuestion` for the revised text; append revised version to `suggestions.md` |
| Reject | Ask follow-up for the reason; append `{pattern}: rejected — {reason}` to `$analysis_dir/rejected.md` |

### 6d. After the loop

Write final summary to `$analysis_dir/analysis.md`:

```markdown
# Trace Analysis — {date}

## Summary
- Records analyzed: {N}
- Runs analyzed: {M}
- Patterns above threshold: {K}
- Approved suggestions: {A}
- Rejected suggestions: {R}
- Modified suggestions: {M}

## Approved Suggestions
See suggestions.md (full YAML).

## Rejected Suggestions
See rejected.md (with reasons).

## Next Action
{If A > 0}: Generate a follow-up plan via:
  meow:plan-creator --hard "Apply trace-analyzer suggestions from {analysis_dir}"

{If A == 0}: No actionable changes from this analysis. Re-analyze after more harness runs.
```

### 6e. Optional: Generate the follow-up plan draft

If ≥1 suggestion approved AND user opts in via a final AskUserQuestion:

```
AskUserQuestion(
  question: "{A} suggestion(s) approved. Generate a follow-up plan now via meow:plan-creator?",
  options: [
    { label: "Yes — generate plan", description: "Spawn meow:plan-creator --hard with the approved suggestions" },
    { label: "No — defer", description: "I'll generate the plan manually later" }
  ]
)
```

If yes: dispatch the planner agent with the approved suggestions as input.

### 6f. NEVER skip the gate

The HITL gate is the load-bearing piece per the plan's anti-overfitting principle. If the agent thinks "this suggestion is obviously correct, let me skip the gate," that IS the failure mode the gate exists to prevent.

## Output

- `$analysis_dir/suggestions.md` — approved suggestions only
- `$analysis_dir/rejected.md` — rejected with reasons
- `$analysis_dir/analysis.md` — final summary

Print: `"HITL gate complete. {A} approved, {R} rejected, {M} modified. See {analysis_dir}/analysis.md"`

## Status protocol

End the trace-analyze session with the structured status block:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
**Summary:** {1-2 sentences: pattern count + approval count}
**Concerns/Blockers:** {if any}
```

## Next

This is the final step. Return control to the caller. If the user opted to generate a follow-up plan, the planner agent runs after this step exits.
