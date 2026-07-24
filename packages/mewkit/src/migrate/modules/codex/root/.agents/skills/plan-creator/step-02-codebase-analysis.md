# Step 2: Codebase Analysis (Hard/Deep/Parallel/Two Only)

**Skip if:** `planning_mode = fast`. Go directly to `step-03-draft-plan.md`.

Understand existing codebase before drafting plan.

## Instructions

If `intake_packet_path` is set (not `none`), read the packet's Scope Shape block
first — do not re-scout areas the packet already covers with `from:` evidence.

### 2a. Scout Relevant Directories

Invoke `mk:scout` on directories related to the task:
- **Standard (hard):** Identify 2-3 directories most likely to be affected
- **Deep mode:** Follow `references/deep-mode.md`: scout max 5 roots and produce a compact scope map with roots, existing tests, public contracts, risky dependencies, and an uncertainty list
- Scout produces: file map, architecture fingerprint, complexity estimate

If `mk:scout` unavailable, manually Glob + Grep the relevant directories.

### 2b. Read Project Context

Read these files (in priority order). All should exist in a properly-configured kit
project. If absent, note the gap and continue — do NOT silently skip without logging:
1. `docs/project-context.md` — tech stack, conventions, anti-patterns
   **REQUIRED:** If absent, print `WARNING: docs/project-context.md not found — run mk:project-context generate` before proceeding.
2. `docs/architecture/system-architecture.md` — system structure
3. `docs/code-standards.md` — coding conventions
4. `.meowkit/memory/architecture-decisions.json` — recurring architectural patterns (canonical; fall back to `architecture-decisions.md` only if absent — see AGENTS.md (Memory))

### 2c. Check Existing Plans

Scan `tasks/plans/` for unfinished plans (status ≠ completed/cancelled):
- Read each plan.md frontmatter
- Check for overlapping scope (shared files, same feature area)
- If overlap detected: note for cross-plan dependency in step-03

### 2d. UI Evidence Inventory (gated: `html_mode == true`)

Skip entirely when `html_mode == false`. Otherwise gather a bounded,
in-memory inventory of UI surfaces/states + their code evidence (routes, shells,
component hierarchy, state sources, roles/flags, per-screen default/loading/empty/
error/disabled/success states, secondary surfaces, reusable components/tokens,
proving tests/stories). This feeds `uiCoverage` at step-03V. Existing UI needs
code evidence refs; net-new UI cites plan requirements (`planned`). Full checklist:
`references/visual-plan-integration.md` §2.

(Fast mode skips step-02; a fast-mode `--html` plan gathers a minimal inline
inventory at step-03V instead. Without `--html` there is no visual work at all.)

## Output

- `codebase_findings` — summary of relevant architecture, patterns, conventions
- `existing_plans` — list of plans with potential overlap (for dependency detection)
- `ui_evidence` — bounded UI inventory when `html_mode == true` (else unset)
- Print: `"Codebase: {N} docs read, {M} existing plans checked"`

## Next

Read and follow `step-03-draft-plan.md`
