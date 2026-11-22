# Workflow: Parallel (--parallel)

Design approval only; independent components are built concurrently. Good for large projects. Shared steps: `shared-phases.md`.

1. **Git init.**
2. **Research:** up to 2 researchers, each with a goal and return shape: stack plus architecture patterns; similar projects plus best practices.
3. **Tech stack and design:** `scripts/detect-stack.sh` or pick from research; frontend gets `ui-ux-designer` guidelines. **Approval:** user approves stack and design direction.
4. **Plan:** `/mk:plan-creator [requirements summary] --parallel`. The plan adds a file ownership matrix, a dependency graph and an execution strategy.
5. **Scaffold:** print the directory tree from the plan, then generate.
6. **Phase A:** `/mk:cook [plan-path] --parallel`. `developer` agents work on non-blocked phases concurrently; file ownership prevents edit conflicts. Then Phase B and Phase C with the commit offer.
