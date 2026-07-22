# Team Coordination

> Loaded by `mk:team-config` when team mode activates. This is the team-only detail
> moved out of always-loaded `.agents/skills/rule-parallel-execution-rules.md` (Rule 7) so it
> costs zero context in standard single-session work. Standard sessions use
> `.agents/skills/rule-orchestration-rules.md`; these rules apply ONLY when a team/worktree
> workflow is active.

When team mode is active:

- Define file ownership in every teammate task.
- Teammates never force-push.
- Teammates commit to their worktree branch, not `main` or `dev`.
- Completion messages must be actionable, not just "done".
- The lead evaluates docs impact after implementation work.

WHY: Team mode needs extra coordination that normal sessions do not — and that extra
coordination is dead weight in the common single-session path, so it lives here and
loads only on team activation.
