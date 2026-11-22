# Workflow: Full (--full)

Maximum control: the user approves at every major step. For critical projects. Shared steps: `shared-phases.md`.

1. **Git init** (ask first).
2. **Clarify requirements:** one question at a time until what the project does, who uses it, key features and constraints are clear.
3. **Research:** up to 4 researchers, each with a goal and return shape: idea validation and competition; tech stack options; domain-specific topics (auth, payments) only if needed. **Approval:** user approves the research summary.
4. **Tech stack and design:** `scripts/detect-stack.sh`; for a new project `mk:brainstorming --depth deep`. **Approval:** stack. Frontend: `ui-ux-designer` writes guidelines and wireframes to `docs/design-guidelines.md`. **Approval:** design direction.
5. **Plan:** `/mk:plan-creator [requirements summary] --hard` (use `--deep` for 5+ root directories); optionally `mk:plan-ceo-review`. **Approval:** user agrees the plan.
6. **Scaffold:** print the directory tree for the user to confirm, then generate.
7. **Phase A:** `/mk:cook [plan-path]` (interactive), then Phase B and Phase C with the commit offer.
