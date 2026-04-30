# Step 2: Codebase Analysis (Hard/Deep/Parallel/Two Only)

**Skip if:** `planning_mode = fast`. Go directly to `step-03-draft-plan.md`.

Understand existing codebase before drafting plan.

## Instructions

### 2a. Scout Relevant Directories

Invoke `mk:scout` on directories related to the task:
- **Standard (hard):** Identify 2-3 directories most likely to be affected
- **Deep mode:** Identify 3-5 directories, spawn 2-3 parallel scouts for broader coverage
- Scout produces: file map, architecture fingerprint, complexity estimate

If `mk:scout` unavailable, manually Glob + Grep the relevant directories.

### 2b. Read Project Context

Read these files (in priority order). All should exist in a properly-configured kit
project. If absent, note the gap and continue — do NOT silently skip without logging:
1. `docs/project-context.md` — tech stack, conventions, anti-patterns
   **REQUIRED:** If absent, print `WARNING: docs/project-context.md not found — run mk:project-context generate` before proceeding.
2. `docs/system-architecture.md` — system structure
3. `docs/code-standards.md` — coding conventions
4. `.claude/memory/architecture-decisions.json` — recurring architectural patterns

### 2c. Check Existing Plans

Scan `tasks/plans/` for unfinished plans (status ≠ completed/cancelled):
- Read each plan.md frontmatter
- Check for overlapping scope (shared files, same feature area)
- If overlap detected: note for cross-plan dependency in step-03

## Output

- `codebase_findings` — summary of relevant architecture, patterns, conventions
- `existing_plans` — list of plans with potential overlap (for dependency detection)
- Print: `"Codebase: {N} docs read, {M} existing plans checked"`

## Next

Read and follow `step-03-draft-plan.md`
