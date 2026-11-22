# Workflow: Auto (default)

Balanced. Research runs automatically; the only approval is the design direction. Good for most projects. Shared steps: `shared-phases.md`.

1. **Git init** (no prompt).
2. **Research:** up to 3 researchers, each with a goal and return shape. Angles: validation and competition; tech stack; design patterns for the domain (if applicable).
3. **Tech stack:** run `scripts/detect-stack.sh`; for a new project use `mk:brainstorming` (quick) and pick the best option from research.
4. **Design** (frontend only): `ui-ux-designer` writes `docs/design-guidelines.md`. **Approval:** user approves the direction. No frontend: skip.
5. **Plan:** `/mk:plan-creator [requirements summary] --auto`.
6. **Scaffold**, auto-confirmed.
7. **Phase A:** `/mk:cook [plan-path] --auto`, then Phase B, then Phase C with the commit offer.
