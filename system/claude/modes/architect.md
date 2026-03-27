# Mode: Architect

## Activation

Activate with: `mode: architect` in task context or by specifying architect mode at session start.

## Configuration

- **Phases**: Only Phase 1 (Plan) is active. No implementation phases.
- **Gate 1 (Plan)**: Enforced.
- **Gate 2 (Review)**: Not applicable (no code to review).
- **Security checks**: Design-level security review only (threat modeling, not code scanning).
- **Model routing**: Best available model (design decisions warrant highest quality reasoning).
- **Allowed output**: Documentation only. No source code, no test code, no configuration changes.
- **Active agents**: Planner, Architect, Documenter only. Developer and Tester agents are disabled.

## Allowed Commands

- `/plan` — create implementation plans
- `/arch` — create and manage ADRs
- `/design` — system design consultation
- `/docs:init`, `/docs:sync` — documentation
- `/retro` — retrospective analysis

## Blocked Commands

- `/cook` — requires implementation (blocked)
- `/fix` — requires code changes (blocked)
- `/test` — requires test code (blocked)
- `/ship` — nothing to ship (blocked)
- `/canary` — nothing to deploy (blocked)

## When to Use

- Early-stage design before any code is written
- System design reviews with the team
- Architecture spikes to explore options
- Evaluating major refactoring before committing to it
- Pre-project planning sessions

## What's Different from Default

All output is documentation. No implementation code is produced. This mode is for thinking and planning, not building.
