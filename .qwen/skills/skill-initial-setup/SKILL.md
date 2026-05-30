---
name: skill-initial-setup
description: Initialize a new MeowKit-style skill with correct frontmatter and discovery rules
source: auto-skill
extracted_at: '2026-05-30T12:29:38.537Z'
---

Procedure:

1) Create directory: `.qwen/skills/<skill-name>/`
2) Create `SKILL.md` with frontmatter fields:
   - `name`
   - `description`
   - `source: auto-skill`
   - `extracted_at: <timestamp>`
3) In body, write the skill’s operational algorithm in small steps:
   - Inputs (what user provides / what runtime provides)
   - Preconditions (files to read, invariants)
   - Execution steps (ordered)
   - Outputs (what files/tools are produced)
   - Verification (how to validate locally)
4) Ensure the skill is consistent with repo conventions:
   - Use FULL paths when referencing project files
   - Avoid brand-prose violations if the skill text lives under markdown that is linted
5) Run quick validation:
   - `npm run format:check`
   - `npm run lint`

Notes:
- This is a template/seed skill; do not over-expand scope.
