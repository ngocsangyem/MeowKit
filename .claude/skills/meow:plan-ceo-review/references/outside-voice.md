# Outside Voice — Independent Plan Challenge (optional, recommended)

After all review sections are complete, dispatch a Claude adversarial subagent for an independent second opinion. The subagent has fresh context — it catches structural blind spots that are hard to see from inside the review.

## Offer the outside voice

Use AskUserQuestion:

> "All review sections are complete. Want an outside voice? A Claude subagent with fresh context can give a brutally honest, independent challenge of this plan — logical gaps, feasibility risks, and blind spots. Takes about 2 minutes."
>
> RECOMMENDATION: Choose A — the independent pass catches structural blind spots the primary reviewer is blind to.

Options:

- A) Get the outside voice (recommended)
- B) Skip — proceed to outputs

**If B:** Print "Skipping outside voice." and continue to the next section.

## Construct the prompt

Read the plan file being reviewed (the file the user pointed this review at, or the branch diff scope). If a CEO plan document was written in Step 0D-POST, read that too — it contains the scope decisions and vision.

Construct this prompt (substitute the actual plan content — if plan content exceeds 30KB, truncate to the first 30KB and note "Plan truncated for size"):

"You are a brutally honest technical reviewer examining a development plan that has already been through a multi-section review. Your job is NOT to repeat that review. Instead, find what it missed. Look for: logical gaps and unstated assumptions that survived the review scrutiny, overcomplexity (is there a fundamentally simpler approach the review was too deep in the weeds to see?), feasibility risks the review took for granted, missing dependencies or sequencing issues, and strategic miscalibration (is this the right thing to build at all?). Be direct. Be terse. No compliments. Just the problems.

THE PLAN:
<plan content>"

## Dispatch the Claude subagent

Dispatch via the Agent tool with the prompt above. Present findings under an `OUTSIDE VOICE (Claude subagent):` header:

```
OUTSIDE VOICE (Claude subagent):
════════════════════════════════════════════════════════════
<full subagent output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

**Error handling:** If the subagent fails or times out, the outside voice is informational — skip with "Outside voice unavailable. Continuing to outputs." and proceed.

## Cross-pass tension

After presenting the outside-voice findings, note any points where the outside voice disagrees with the review findings from earlier sections. Flag these as:

```
CROSS-PASS TENSION:
  [Topic]: Review said X. Outside voice says Y. [Your assessment of who's right.]
```

For each substantive tension point, auto-propose as a TODO via AskUserQuestion:

> "Cross-pass disagreement on [topic]. The review found [X] but the outside voice argues [Y]. Worth investigating further?"

Options:

- A) Add to TODOS.md
- B) Skip — not substantive

If no tension points exist, note: "No cross-pass tension — both passes agree."

## Persist the Result

```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"plan-review-outside-voice","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"claude","commit":"'"$(git rev-parse --short HEAD)"'"}'
```

Substitute STATUS: "clean" if no findings, "issues_found" if findings exist. If the subagent failed, do NOT persist.
