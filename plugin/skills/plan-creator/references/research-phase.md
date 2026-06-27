# Research Phase

When to research: unfamiliar tech, multiple approaches possible, architectural decisions.

## Process
1. **Scout first** — spawn `mk:scout` to map relevant directories
2. **Research in parallel** — spawn 1-2 researcher subagents on specific topics
3. **Save reports** — each report goes to `tasks/plans/YYMMDD-name/reports/`

## Report Format
Use `tasks/templates/report.md` template. Each report must have:
- Summary (2-3 sentences)
- Key Findings (numbered, most important first)
- Recommendations (actionable)
- Confidence levels

## When to Skip
- `--fast` mode
- Task is well-understood (familiar tech, clear approach)
- Effort is xs/s (small tasks don't need research)

## Token Budget
Research reports should be concise (under 100 lines each).
Researcher subagents have 200K context — don't overload them.
