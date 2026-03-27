# Plan Creator Gotchas

- **Over-planning trivial tasks**: Creating a full multi-phase plan for a 2-file config change wastes 15 minutes → Check: if < 3 files AND < 30 min, use plan-quick or skip planning entirely

- **Acceptance criteria that can't be verified**: "Code is clean" or "performance is good" — agent can't check these → Every criterion must name a specific command to run or file to check

- **Plan file too long to resume**: Plans accumulate research notes and inline context until they exceed context budget → Keep plan.md under 80 lines; move research to reports/ subfolder

- **Wrong workflow model selected**: Using feature-model for a bug fix skips the investigation phase → Always match model to task type before drafting

- **Scope creep during planning**: Premise challenge surfaces adjacent improvements that get added to scope → Time-box scope challenge; document expansion ideas as future tasks, don't add to current plan

- **Plans that describe WHAT but not WHY**: Agent fills all sections but the Goal is a task list, not an outcome — next agent can't judge if the plan succeeded → Goal must describe done-state ("Users can log in with OAuth"), not activity ("Implement OAuth flow")

- **Skipping scout/research for unfamiliar codebases**: Planning without understanding current architecture produces plans that conflict with existing patterns → If unfamiliar codebase, always run meow:scout first
