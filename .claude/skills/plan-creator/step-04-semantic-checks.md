# Step 4: Checks

Make the plan structurally valid and factually grounded before anyone reviews it. Done when `mewkit plan check --structural` prints `PLAN_COMPLETE` (every mode except product-level) and the semantic table below holds.

## 4a. Semantic checks

Fix inline whatever fails.

| Check | Pass | Fail, so fix |
|---|---|---|
| Goal is an outcome | "Users can log in with OAuth" | "Implement OAuth flow": rewrite |
| Acceptance criteria are binary | `- [ ] Login returns a JWT` | "Code is clean": name a command or file check |
| Constraints present | at least one | add "Preserve existing tests" or the real one |
| At least one risk | table has a row | add one |
| plan.md at most 80 lines | under | move detail to phase files |

Product-level plans use a different schema: skip the table and the structural check, and run `scripts/check-product-spec.sh {plan_dir}/plan.md` (path relative to this skill's directory). It must exit 0 with `PRODUCT_SPEC_COMPLETE`. Checks: vision of 3-5 sentences; at least 8 features, each with two user stories and two binary criteria; no implementation detail; at least two out-of-scope items with a reason. Then go to step 7.

## 4b. Structural check

```bash
mewkit plan check --structural {plan_dir}/plan.md
```

It enforces the `## Goal` heading, the frontmatter fields title, type, status and priority, a valid optional `handoff.next` (`cook | validate | red-team | autobuild | end`), and the phase-file shape; the rest of the template is judgment. Fix what it reports and rerun. Run it in fast mode too: the plan reaches the user, so it should have been checked.

## 4c. Two-approach selection (`two` only)

Run 4a and 4b on both approach files. Show the `## Goal` line of each and ask which to proceed with. Generate `plan.md` and phase files from the chosen one (step 3 rules), move the other to `archived/`, and set `selected_approach`. Later steps review only the chosen approach.

## 4d. Verification (hard family)

`mewkit plan check` does not confirm that a cited path, symbol or caller count exists. Verify claims in each phase file against the repo with `references/verification-roles.md`: tier by phase count (1-2 Light, 3-4 Standard, 5+ Full). For one or two phases, run the Fact Checker yourself inline; from three phases, delegate read-only subagents, one per role and phase, as that file describes. The orchestrator writes one `## Verification Log` per phase file; subagents never edit. Set `verification_tier`; failed or unverified claims become step 6 interview questions.

## 4e. Prune (hard family)

Walk plan.md and the phase files once: merge or delete a phase with no real implementation step; keep one copy of a duplicated section and link to it; give every todo an acceptance criterion or cut it; tag any Key Insight, Risk, Requirement or Constraint that lacks `from:` or `[ASSUMPTION]`.

## Next

`fast`, `spike` and `product-level`: `step-07-gate.md`. Every other mode: `step-05-red-team.md`.
