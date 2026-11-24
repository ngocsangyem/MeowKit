# Step 1: Research and Scout

Hard-family and product-level modes only; `fast` and `spike` go straight to step 3. Done when the plan directory exists, `research/` holds the researcher reports (or says why none were needed), and you can state the codebase findings.

## 1a. Create the plan directory

Create `tasks/plans/YYMMDD-{slug}/research/` now, so research has a home. Step 3 writes the plan files into it.

## 1b. Research unknowns

If `intake_packet_path` is set, read the packet first and skip any question it already answers with `from:` evidence.

Name the one or two unknowns that would change the plan: usually a technology or approach question, and an existing-codebase pattern or constraint. One unclear aspect means one researcher; a familiar domain means none (note "research skipped: familiar domain"). REDUCTION uses one researcher.

Delegate each aspect to a researcher subagent when the runtime can; for a small question, answer it inline. The brief:

- Goal: what the plan needs to know, and the task it serves.
- Boundaries: at most 5 tool calls; use `mk:docs-finder` for library or API facts, not raw web search.
- Return: write `research/researcher-{N}-{topic}.md` of at most 150 lines with Summary, Key Findings (with `path:line` where applicable), Recommendations and Open Questions.

Collect the report paths, not the content; step 3 cites the files.

## 1c. Scout the codebase

Use `mk:scout` (or Glob and Grep when it is unavailable) on the two or three directories most likely to change. Deep mode follows `references/deep-mode.md`: at most five roots, producing a compact scope map of roots, existing tests, public contracts, risky dependencies and open uncertainties. When the packet has a Scope Shape block, do not re-scout what it covers.

Read, in this order, what exists: `docs/project-context.md` (if absent, say so and run `mk:project-context` later), `docs/architecture/system-architecture.md`, `docs/code-standards.md`, and matching entries in `.meowkit/memory/decisions.md`.

Scan `tasks/plans/` for unfinished plans (status not completed or cancelled) that share files or a feature area; step 3 records them as `blockedBy` / `blocks`.

## Next

`step-03-draft-plan.md`
