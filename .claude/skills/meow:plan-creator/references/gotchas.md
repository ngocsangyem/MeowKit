# Plan Creator Gotchas

- **Over-planning trivial tasks**: Creating a full multi-phase plan for a 2-file config change wastes 15 minutes → Check: if < 3 files AND < 30 min, use plan-quick or skip planning entirely

- **Acceptance criteria that can't be verified**: "Code is clean" or "performance is good" — agent can't check these → Every criterion must name a specific command to run or file to check

- **Plan file too long to resume**: Plans accumulate research notes and inline context until they exceed context budget → Keep plan.md under 80 lines; move research to reports/ subfolder

- **Wrong workflow model selected**: Using feature-model for a bug fix skips the investigation phase → Always match model to task type before drafting

- **Scope creep during planning**: Premise challenge surfaces adjacent improvements that get added to scope → Time-box scope challenge; document expansion ideas as future tasks, don't add to current plan

- **Plans that describe WHAT but not WHY**: Agent fills all sections but the Goal is a task list, not an outcome — next agent can't judge if the plan succeeded → Goal must describe done-state ("Users can log in with OAuth"), not activity ("Implement OAuth flow")

- **Skipping scout/research for unfamiliar codebases**: Planning without understanding current architecture produces plans that conflict with existing patterns → If unfamiliar codebase, always run meow:scout first

- **Red-team personas too aggressive on small plans**: 4 personas on a 2-phase plan floods findings with noise → Dynamic scaling: 1-3 phases = 2 personas only, 4-5 = 3, 6+ = 4

- **Security-sensitive plans need /meow:cso before Security persona ships**: Plan red-team currently uses Assumption Destroyer + Scope Critic only. For auth/payments/PII plans, run `/meow:cso` separately until Security Adversary persona is A/B tested and shipped

- **Two-approach mode doubles research cost**: Both approaches share the same research reports from step-01 → No additional researcher spawning needed; approach files synthesize existing research differently

- **Parallel ownership misses shared utilities**: Utility files used by multiple phases have no single owner → Setup/infrastructure phase always runs first and owns shared files; parallel phases own only their layer-specific files

- **Step renumbering broke references**: After renumbering steps 04-08, old "step-04" or "step-05" references became stale → Always grep for `step-NN` patterns across all meow:plan-creator files before renaming or deleting step files
