# Mode: Document

## Activation

Activate with: `mode: document` in task context or by specifying document mode at session start.

## Configuration

- **Phases**: Documentation phase only. No planning, implementation, review, or shipping of code.
- **Gate 1 (Plan)**: Not applicable.
- **Gate 2 (Review)**: Not applicable.
- **Security checks**: Not applicable (no code changes).
- **Model routing**: Standard model (documentation does not require highest tier).
- **Allowed output**: Documentation files only. No source code changes.
- **Active agents**: Documenter agent only.

## Allowed Commands

- `/docs:init` — initial documentation scan and skeleton generation
- `/docs:sync` — incremental documentation update from code changes
- `/retro` — retrospective (generates documentation)
- `/arch list` — list ADRs for reference
- `/budget` — cost reporting (read-only)

## Blocked Commands

- `/cook` — no implementation allowed
- `/fix` — no code changes allowed
- `/test` — no test code allowed
- `/ship` — nothing to ship
- `/canary` — nothing to deploy
- `/plan` — planning is for implementation work

## When to Use

- Documentation sprints (dedicated time to catch up on docs)
- Pre-release documentation updates
- Onboarding documentation creation
- API reference generation
- Changelog and release notes preparation

## What's Different from Default

Only documentation is produced. The documenter agent scans the codebase and generates or updates docs, changelogs, and API references. No code is modified.
