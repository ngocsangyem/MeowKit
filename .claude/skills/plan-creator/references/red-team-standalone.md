# Red Team Standalone Subcommand

Subcommand: `/mk:plan red-team {plan_path}`

Run an adversarial red-team review on an existing plan without going through the full planning pipeline.

## Trigger

Activated when argument starts with `red-team` followed by a path to a plan directory or plan.md file.

Examples:
- `/mk:plan red-team tasks/plans/260411-my-feature/`
- `/mk:plan red-team tasks/plans/260411-my-feature/plan.md`

## Workflow

### R1. Resolve Plan Path

1. If path points to a directory, look for `plan.md` inside it
2. If path points to `plan.md`, use its parent as `plan_dir`
3. If plan.md doesn't exist at resolved path: print error → STOP
4. Set `plan_dir` to the absolute path of the plan directory

### R2. Read Plan Files

1. Read `plan.md` from `plan_dir`
2. Glob for `phase-*.md` files in `plan_dir`
3. Read all phase files
4. Count phases for persona scaling

### R3. Execute Step-05 Red Team

Follow the exact instructions in `step-05-red-team.md`, starting from section **5b** (skip the fast-mode check in 5a — standalone always runs):

- 5b: Select personas by phase count
- 5c: Dispatch reviewer subagents
- 5d: Collect and deduplicate findings
- 5e: Agent adjudication
- 5f: Present to user via AskUserQuestion
- 5g: Apply accepted findings to phase files
- 5h: Write full findings report to `{plan_dir}/red-team-findings.md`
- 5i: Write summary section to plan.md with link to findings file

### R4. Summary

Print:
```
Red team complete: {plan_dir}/plan.md
Full report: {plan_dir}/red-team-findings.md
{N} findings: {accepted} accepted, {rejected} rejected
Severity: {C} Critical, {H} High, {M} Medium
```

## Rules

- This subcommand does NOT run semantic checks, validation interview, or Gate 1
- It ONLY runs the red-team review (step-05)
- Findings report written to `{plan_dir}/red-team-findings.md` (full detail)
- Summary written to plan.md `## Red Team Review` section with link to findings file
- Findings are also applied inline to phase files (Key Insights / Risk Assessment)
- Can be run multiple times — previous findings file renamed with date suffix, new session appended to plan.md
