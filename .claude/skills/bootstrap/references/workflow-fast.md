# Workflow: Fast (--fast)

No approvals, no design step. For prototypes, hackathons and small utilities. Shared steps: `shared-phases.md`.

1. **Git init.**
2. **Research:** one or two researchers, each with a goal and return shape. Cover stack plus best practices; add idea validation only if the idea is unfamiliar.
3. **Plan:** `/mk:plan-creator [requirements summary] --fast`; it creates the plan without asking.
4. **Scaffold**, with no confirmation.
5. **Phase A:** `/mk:cook [plan-path] --auto`, then Phase B and Phase C.
6. **Commit** automatically (stage generated files by path, no push).
