# Report Format and Handoff Protocol

Load this reference during **Steps 7, 8** of the scout process when assembling the final output.

## Report Template

Fill in every placeholder. The report is the primary deliverable of scout.

```markdown
## Scout Report: {SEARCH_TARGET}

**Scanned:** {timestamp} | {N} directories | SCALE={N}
**Entry points:** {main.ts, app.py, index.ts — top 5 key files}

### Architecture Fingerprint
{Framework: Next.js 14 | Language: TypeScript | Pattern: App Router + Server Components}
{Monorepo: no | Test framework: vitest | Styling: Tailwind CSS}
{5 lines max — derived from package.json, config files, directory structure}

### Key Directories
- `src/` — application source code ({N} files)
- `lib/` — shared utilities ({N} files)
{one line per directory — purpose + file count}

### Files Relevant to: {SEARCH_TARGET}
- `path/file.ext` ({N} lines) — {purpose}
- `path/file.ext` ({N} lines) — {purpose}
{only files directly relevant to the search target}

### Dependencies
- `file A` → imports → `file B`
{cross-file dependencies relevant to the task}

### Patterns Found
- Naming: {kebab-case files, PascalCase components}
- Architecture: {layered, MVC, feature-based modules}
- Anti-patterns: {any concerns noticed}

### Complexity Estimate
| Area | Files | Lines | Complexity |
|------|-------|-------|------------|
| {area} | {N} | ~{X} | low/medium/high |

### Handoff
**Next agent:** {planner | developer | architect}
**Action:** {what they should do with this information}
**Key files to read first:** {top 3 files the next agent should open}

### Gaps
- {any directories not searched or agents that timed out}
```

## Context Budget

**~2,000 tokens max** for the entire report.

If scan results exceed this:
1. Drop Tier 2 file listings first (keep Tier 1)
2. Collapse small areas into single lines
3. Keep Architecture Fingerprint, Entry Points, and Handoff at full detail — these are highest signal
4. Summarize file lists: "17 additional test files found — see `tests/` directory" instead of listing each

**WHY:** The report is consumed by another agent (planner, developer). Oversized reports waste that agent's context window on scout data instead of implementation reasoning.

## Handoff Protocol

On completion, scout outputs:

1. **Summary line:** "{N} files found across {M} directories for {SEARCH_TARGET}"
2. **Report:** The structured template above
3. **Next agent recommendation** — based on invoking phase:

| Invoked during | Hand off to | With message |
|----------------|-------------|-------------|
| Phase 0 (Orient) | **planner** | "Plan implementation for {SEARCH_TARGET} using these {N} files" |
| Phase 1 (Plan) | **planner** | "Here's the codebase map for {SEARCH_TARGET}" |
| Phase 3 (Build) | **developer** | "Key files to read first: {top 3 paths}" |
| Any phase — if architecture concern found | **architect** | "Review architecture for {concern}" |

## Memory Integration

After completing a scout:

- **Read first:** If `.claude/memory/codebase-map.md` exists, read it before scouting — previous scouts can accelerate re-scouting by identifying unchanged areas
- **Do NOT write by default** — scout reports are ephemeral task context that becomes stale quickly
- **Write only on explicit request** — user says "save this scout" or "remember this structure"
- **Path:** `.claude/memory/codebase-map.md`
- **What to save:** Architecture Fingerprint + Key Directories only (not the full task-specific file map — that's ephemeral)

**WHY:** Codebase structure changes frequently. A stale codebase map is worse than no map because it gives false confidence. Fresh scouts are cheap (30-60 seconds). Memory is best reserved for insights that don't change with code (e.g., "this project uses a non-standard auth pattern because of [reason]").
