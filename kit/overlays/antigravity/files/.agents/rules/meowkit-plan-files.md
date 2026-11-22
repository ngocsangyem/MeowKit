---
trigger: glob
globs: tasks/plans/**/*.md
description: Layout of an implementation plan.
---

# Plan files

- A plan is a folder `tasks/plans/YYMMDD-name/` holding an overview `plan.md` (80 lines at
  most: each phase with its status, a link to its file, key dependencies) and one
  `phase-XX-name.md` per phase.
- A phase file states its goal in one outcome-focused sentence, its acceptance criteria
  (binary pass or fail only), its constraints (what must not change), its scope (in and out),
  the files to change, numbered steps and a checkbox todo list.
- Agree the plan with the user before building. Read the plan before touching code, and mark a
  task done only when every acceptance criterion is met.
