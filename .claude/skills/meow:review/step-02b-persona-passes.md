# Step 2b: Adversarial Persona Passes (Phase B)

**Skip this step entirely if `review_scope = minimal`.**

Phase B dispatches adversarial persona subagents AFTER Phase A base reviewers complete. Personas receive the diff AND a summary of Phase A findings, so they go deeper — not wider.

## Prerequisites

From step-02 (Phase A):
- `base_findings_summary` — condensed Phase A findings
- `diff_content` — full diff (same as Phase A)
- `domain_complexity` — from step-01

## Persona Selection

Select which personas to activate based on scope and domain:

| Condition | Personas Activated | Batching |
|-----------|-------------------|----------|
| `scope=minimal` | NONE — skip this step | — |
| `scope=full, domain=low/medium/unknown` | Security Adversary + Failure Mode Analyst | 1 batch of 2 |
| `scope=full, domain=high` | All 4 personas | 2 batches of 2 |

### Batching Order (domain=high)

- **Batch 1:** Security Adversary + Failure Mode Analyst (run in parallel)
- **Batch 2:** Assumption Destroyer + Scope Complexity Critic (run in parallel, after batch 1 completes)

This respects the max-3-agent rule (Phase A is already done; Phase B runs 2 at a time).

## Persona Dispatch

For each selected persona:
1. Load persona prompt from `prompts/personas/{persona-name}.md`
2. Load skeptic anchor from `prompts/skeptic-anchor.md`
3. Spawn a subagent with this context:

```
# Adversarial Review: {Persona Name}

## Your Role
{load from prompts/personas/{persona-name}.md}

## Diff Under Review
{diff_content}

## Base Review Findings (Phase A)
The following issues were already found by Phase A reviewers.
Do NOT repeat these. Find what was MISSED.

{base_findings_summary}

## Skeptic Re-Anchor
{load from prompts/skeptic-anchor.md}

## Your Mission
1. Do NOT repeat findings listed above
2. Find what the base reviewers MISSED from your specific lens
3. Challenge any base finding you believe is WRONG or understated
4. If a base WARN should be FAIL, provide concrete evidence for the upgrade
5. Output format: [SEVERITY] [FILE:LINE] [CATEGORY] [DESCRIPTION]
6. Max 10 findings (quality over quantity)
```

## Findings Summary Condensation

Before dispatching personas, condense Phase A findings into a compact summary:

**Format** (one line per finding):
```
[SEVERITY] [FILE:LINE] [CATEGORY] [DESCRIPTION] — Source: {reviewer}
```

**Rules:**
- Include: severity, file:line, category, description, source reviewer
- Exclude: rationale paragraphs, code snippets, fix suggestions
- Cap at 100 lines (if Phase A produced more, keep CRITICAL/MAJOR, drop MINOR)

## Execution

1. Condense Phase A findings into `base_findings_summary`
2. Select persona set based on `domain_complexity`
3. Load persona prompts from `prompts/personas/`
4. Load skeptic anchor from `prompts/skeptic-anchor.md` (loaded once, injected per persona)
5. Dispatch persona subagents with context template above (anchor included per dispatch)
6. If 4 personas: run batch 1, wait for completion, then run batch 2
7. Collect all persona findings into `phase_b_findings`
8. Document: `"Phase B: {N} personas activated — {persona names}, skeptic-anchored"`

## Output

- `phase_b_findings` — list of persona findings in standard format, tagged with `[Phase B: {persona-name}]`
- Append `phase_b_findings` to the unified findings list from Phase A

## Plan Review Mode

When reviewing plans (not code diffs), personas receive plan files instead of diff:
- Replace `diff_content` with plan file contents (plan.md + relevant phase files)
- Replace `base_findings_summary` with Phase A plan review findings
- Same persona selection rules apply
- Use `meow:party` as execution vehicle for plan-level adversarial review

## Next

Read and follow `step-03-triage.md`
