# Step 4: Semantic Checks

Semantic quality checks and structural validation. Runs in all modes.

## Instructions

### 4a. Semantic Content Checks (All Modes Except product-level)

Check the plan.md and fix inline if any fail:

| Check                 | Pass                            | Fail (fix it)                              |
| --------------------- | ------------------------------- | ------------------------------------------ |
| Goal is outcome       | "Users can log in with OAuth"   | "Implement OAuth flow" → rewrite           |
| ACs are binary        | `- [ ] Login returns JWT token` | "Code is clean" → make specific            |
| Constraints non-empty | Has ≥1 constraint               | Empty → add "MUST preserve existing tests" |
| ≥1 risk identified    | Risk table has entries          | Empty → add at least 1 risk                |
| plan.md ≤80 lines     | Under limit                     | Over → move detail to phase files          |

### 4a'. Product-Level Semantic Checks (conditional: `planning_mode = product-level`)

Product-level plans use a different schema (product spec, not phase plan). Run these checks instead of 4a:

| Check                            | Pass                                                 | Fail (fix it)                                   |
| -------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Product Vision populated         | 3-5 sentences, ambitious                             | Empty / single sentence → rewrite               |
| Feature count ≥8                 | `grep -c '^### [0-9]' plan.md` ≥ 8                   | < 8 → expand feature set                        |
| Each feature has ≥2 user stories | "As a X, I want Y, so that Z" format, 2+ per feature | Missing → add                                   |
| Each feature has ≥2 ACs          | Binary, behavior-facing                              | Missing → add                                   |
| No forbidden patterns            | POSIX greps from step-03a return zero matches        | Any match → rewrite feature at user-story level |
| Out-of-Scope populated           | ≥2 anti-features with rationale                      | Empty → add                                     |

Run the dedicated product-spec validator (same script invoked at step-03a; running it twice is cheap and catches edits made between steps):

```bash
.claude/skills/plan-creator/scripts/check-product-spec.sh "{plan_dir}/plan.md"
```

Must exit 0 with `PRODUCT_SPEC_COMPLETE: N features, M user stories`. Fix any reported issues before proceeding to step-07.

### 4b. Structural Validation

Run the validation script:

```bash
.claude/skills/.venv/bin/python3 .claude/skills/plan-creator/scripts/validate-plan.py {plan_dir}/plan.md
```

Must output `PLAN_COMPLETE`. Fix reported issues before proceeding.

**Skip if:** `planning_mode = fast` — skip the structural validator (4b). BUT if
`html_mode == true`, you MUST still run §4f (visual CLI probe + validate)
before leaving this step; only then go to step-07-gate.md. If `html_mode == false`,
go directly to step-07-gate.md.

**Skip if:** `planning_mode = product-level` — the `validate-plan.py` script expects phase files and per-phase schema. Product-level plans have a different schema (product spec). Section 4a' above replaces 4b for this mode. Go directly to step-07-gate.md (step-05 red-team and step-06 validation interview are also skipped for product-level v1 — the spec is the deliverable, phase decomposition happens in `mk:autobuild`).

### 4c. Two-Approach Selection (conditional: `planning_mode = two`)

Run 4a and 4b semantic checks on BOTH `plan-approach-a.md` and `plan-approach-b.md`. Fix issues in each file independently. Then:

1. Read the `## Goal` line from each approach file for the summary.
2. Present via AskUserQuestion:

```json
{
	"questions": [
		{
			"question": "Select the implementation approach to proceed with",
			"header": "Approach Selection",
			"options": [
				{ "label": "Approach A: {name from file}", "description": "{Goal line from plan-approach-a.md}" },
				{ "label": "Approach B: {name from file}", "description": "{Goal line from plan-approach-b.md}" }
			],
			"multiSelect": false
		}
	]
}
```

3. Based on user selection:
   - **Selected approach**: generate `plan.md` + `phase-XX-*.md` files from it (using templates in 3b/3c).
   - **Non-selected approach**: move file to `{plan_dir}/archived/`.
4. Set `selected_approach = "a"` or `"b"` in session state.
5. Print: `"Approach {X} selected. Archived non-selected. Proceeding to red-team."`

**Important:** Step-05 red-team reviews ONLY the selected approach's phase files.

### 4d. Verification Roles

**Skip if:** `planning_mode = fast` OR `planning_mode = product-level` — verification has no concrete file-path claims to verify in those modes.

**Skip if:** 4a or 4b failed — fix structural / semantic issues first.

Algorithm: see `references/verification-roles.md` (tier selection, role responsibilities, dispatch brief, output format, aggregation).

1. Count phase files: `glob phase-XX-*.md` in `{plan_dir}`.
2. Select tier:
   - 1–2 phases → Light (Fact Checker only)
   - 3–4 phases → Standard (Fact Checker + Contract Verifier)
   - 5+ phases → Full (Fact Checker + Flow Tracer + Scope Auditor + Contract Verifier)
3. Set session variable `verification_tier ∈ {light, standard, full}` for step-06 consumption.
4. For each role in the tier × each phase file, spawn one read-only Agent subagent (`subagent_type=Explore`) using the dispatch brief in `references/verification-roles.md`. Dispatch ALL roles in PARALLEL via a single message — never serial.
5. Collect all subagent verdict lists. Drop any line that does not match the verdict grammar.
6. Group verdicts by phase file. For each phase file:
   - Read the existing phase file.
   - Build the `## Verification Log` block with one sub-section per role + ISO timestamp.
   - Apply ONE Edit per phase file inserting the block BEFORE the existing `## Next Steps` heading. Create the section if missing.
7. Record verdict counts in session state: `{verified, failed, unverified}` aggregated across all phases. Step-06 reads this to prioritize interview questions from FAILED / UNVERIFIED entries.

**Important — subagent file ownership.** Subagents are READ-ONLY. The orchestrator (planner agent) performs the single Edit per phase file. This avoids the parallel-write race that would violate file-ownership rules.

### 4e. Pruning Pass (before red team)

**Skip if:** `planning_mode = fast` OR `planning_mode = product-level` (no phase files to prune).

Walk plan.md + phase files with this checklist; fix inline:

- (a) Phase with no real implementation step → merge into a neighbor or delete.
- (b) Section duplicated across phase files → keep one, link from the others.
- (c) Task/todo without an acceptance criterion → add one or cut the task.
- (d) plan.md > 80 lines → compress Overview, move detail to phase files.
- (e) Key Insight / Risk / Requirement / Constraint claim missing `from:` or `[ASSUMPTION]` → tag it.

Set `pruning_result = "{N} items pruned/fixed"` for step-05 context.

### 4f. Visual CLI Probe + Validate (gated: `html_mode == true`; ALL modes)

Runs whenever `html_mode == true` — including fast mode (fast skips the
Markdown validator 4b, but a `--html` plan MUST still be probed + validated here).

1. **Capability probe** — confirm the LOCAL `mewkit` install has the `visual-plan`
   subcommand (never a registry-fetching `npx`). Version floor: **>=1.16.0** (first
   release shipping the CLI); subcommand-presence is the primary check.
2. On probe failure: HARD BLOCK with install/upgrade instructions (the user opted into
   `--html`, so Gate 1 cannot silently skip the visual artifact).
3. **Validate** — `mewkit visual-plan validate {plan_dir} --json`. On failure, read the
   exact JSON-path errors, self-repair the offending frame/state, re-validate. Bounded
   retry (~3) then surface to the user.

Detail + remediation loop: `references/visual-plan-integration.md` §4.

## Output

- Semantic check results (pass/fail per row)
- `PLAN_COMPLETE` from validation script
- `selected_approach` set (two mode only)
- `verification_tier` set (skipped in fast / product-level)
- `pruning_result` set (skipped in fast / product-level)
- `## Verification Log` written to each phase file (skipped in fast / product-level)

## Next

If `planning_mode = fast` → read and follow `step-07-gate.md`
If `planning_mode = product-level` → read and follow `step-07-gate.md` (skip red-team + validation interview; phase decomposition is the harness's job)
Otherwise → read and follow `step-05-red-team.md`
