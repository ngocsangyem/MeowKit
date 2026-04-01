# Phase 1: Foundation — Step-File Architecture + Scope Challenge

## Context Links

- [CK-Plan Analysis](../../plans/reports/researcher-260331-1737-ck-plan-architecture-analysis.md) — Reference architecture
- [MeowKit Analysis](../../plans/reports/researcher-260331-0840-meow-plan-creator-analysis.md) — Current weaknesses
- [Step-File Rules](../../.claude/rules/step-file-rules.md) — MeowKit step-file constraints
- [CK Scope Challenge](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/scope-challenge.md) — Source pattern

## Overview

- **Priority:** P1 (unblocks all other phases)
- **Status:** Pending
- **Effort:** ~4h
- **Description:** Convert meow:plan-creator from monolithic 7-step SKILL.md to step-file architecture. Add scope challenge as Step 0 to early-exit trivial tasks. This is the structural foundation all other phases build on.

## Key Insights

- Current SKILL.md is 89 lines with inline 7-step workflow. References are loaded but steps aren't isolated → context window bloat.
- CK-Plan uses 14 reference files loaded JIT per step. MeowKit should use ~8 (KISS).
- Scope challenge is the highest-impact quick win: prevents 100k+ token waste on trivial tasks.
- MeowKit already has `meow:scale-routing` for domain complexity — integrate it into scope.

## Requirements

### Functional
1. **Step-file architecture:** Convert SKILL.md to thin entry + workflow.md + 5 step files
2. **Scope challenge (Step 0):** Before any research, ask 3 questions to determine planning intensity
3. **Workflow modes:** Support `fast` (skip research) and `hard` (2 researchers + validation) minimum
4. **Early-exit:** If task is trivial (≤2 files, ≤1h, no arch decisions), recommend `/meow:fix` instead

### Non-Functional
- SKILL.md stays under 100 lines (thin entry point)
- Each step file under 80 lines
- Total reference files ≤8 (merged from current 10+)

## Architecture

### New File Structure

```
meow:plan-creator/
├── SKILL.md                          # Thin entry: metadata + mode detection + gotchas (≤100 lines)
├── workflow.md                       # Step sequence + variable table + flow diagram
├── step-00-scope-challenge.md        # NEW: Scope assessment, early-exit, mode selection
├── step-01-research.md               # Research spawning (conditional on mode)
├── step-02-codebase-analysis.md      # Scout + docs reading
├── step-03-draft-plan.md             # Write plan.md + phase files (Phase 2 template)
├── step-04-validate-and-gate.md      # Validation interview + Gate 1
├── step-05-hydrate-tasks.md          # Task creation from phases
├── references/
│   ├── scope-challenge.md            # KEEP: 3 questions, 3 modes
│   ├── plan-organization.md          # KEEP: directory structure, naming
│   ├── output-standards.md           # KEEP: frontmatter spec, tag vocab
│   ├── phase-template.md             # NEW: 12-section phase file template
│   ├── research-phase.md             # KEEP: researcher spawning protocol
│   ├── solution-evaluation.md        # KEEP: trade-off matrix
│   ├── task-management.md            # KEEP: hydration + cook handoff
│   └── gotchas.md                    # KEEP: common mistakes
├── assets/
│   └── plan-template.md              # UPDATE: thin overview (≤80 lines)
└── scripts/
    └── validate-plan.py              # UPDATE: validate multi-file structure
```

### Scope Challenge Flow (Step 0)

```
Task description input
    ↓
Q1: "What already exists in the codebase for this?" (prevent reinvention)
Q2: "What's the minimum viable scope?" (cut scope creep)
Q3: "Does this require architectural decisions?" (complexity signal)
    ↓
Signals: file_count, estimated_hours, arch_decisions, domain_complexity
    ↓
├── TRIVIAL (≤2 files, ≤1h, no arch, domain≠high)
│   → "Task is trivial. Use /meow:fix." → STOP
├── SIMPLE (≤5 files, ≤4h, no arch)
│   → Fast mode: skip research, basic plan.md only
└── COMPLEX (>5 files, >4h, or arch decisions, or domain=high)
    → Hard mode: 2 researchers, phase files, validation
```

## Related Code Files

### Files to Restructure
- `meowkit/.claude/skills/meow:plan-creator/SKILL.md` → thin entry
- `meowkit/.claude/skills/meow:plan-creator/references/*` → consolidate to 8 files

### Files to Create
- `meowkit/.claude/skills/meow:plan-creator/workflow.md`
- `meowkit/.claude/skills/meow:plan-creator/step-00-scope-challenge.md`
- `meowkit/.claude/skills/meow:plan-creator/step-01-research.md`
- `meowkit/.claude/skills/meow:plan-creator/step-02-codebase-analysis.md`
- `meowkit/.claude/skills/meow:plan-creator/step-03-draft-plan.md`
- `meowkit/.claude/skills/meow:plan-creator/step-04-validate-and-gate.md`
- `meowkit/.claude/skills/meow:plan-creator/step-05-hydrate-tasks.md`

### Files to Read (Context)
- `meowkit/.claude/rules/step-file-rules.md`
- `meowkit/.claude/agents/planner.md`

## Implementation Steps

1. Read current SKILL.md and all references to understand what to preserve
2. Write `workflow.md` — step sequence, variable table, flow diagram
3. Write `step-00-scope-challenge.md` — 3 questions, signal computation, mode selection, early-exit
4. Refactor current Steps 1-7 into step-01 through step-05 files (extract, don't rewrite)
5. Rewrite SKILL.md as thin entry: metadata + mode detection + workflow.md pointer + gotchas
6. Consolidate references: merge small files, remove dead ones, target ≤8 files
7. Update `validate-plan.py` to accept multi-file plan structure

## Todo List

- [ ] Read all current files in meow:plan-creator/
- [ ] Write workflow.md with step sequence and flow diagram
- [ ] Write step-00-scope-challenge.md
- [ ] Extract step-01-research.md from current Step 3
- [ ] Extract step-02-codebase-analysis.md from current Step 2-3
- [ ] Write step-03-draft-plan.md (placeholder for Phase 2 template)
- [ ] Extract step-04-validate-and-gate.md from current Steps 6-7
- [ ] Write step-05-hydrate-tasks.md
- [ ] Rewrite SKILL.md as thin entry (≤100 lines)
- [ ] Consolidate references to ≤8 files
- [ ] Update validate-plan.py for multi-file structure
- [ ] Test: trivial task triggers early-exit
- [ ] Test: complex task routes to hard mode

## Success Criteria

1. SKILL.md ≤100 lines (thin entry)
2. 6 step files exist (step-00 through step-05), each ≤80 lines
3. Scope challenge correctly routes: trivial → early-exit, simple → fast, complex → hard
4. workflow.md has flow diagram + variable table
5. References consolidated to ≤8 files
6. No regression: existing plan creation still works

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Step-file overhead for simple plans | M | L | Step-00 exits early for trivial; fast mode skips most steps |
| Reference consolidation loses content | L | M | Diff old vs new references before deleting |
| validate-plan.py breaks with new structure | L | L | Update incrementally; test with existing plans |
