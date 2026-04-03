# Parallel Mode Reference

## When to Use

Use `--parallel` when the task has **3+ independent layers or modules** with no shared files:
- Multi-tier architecture (DB / API / UI as separate phases)
- Independent feature modules (auth, billing, notifications)
- Do NOT use for: sequential pipelines, tasks where Phase N needs Phase N-1 output mid-file

## File Ownership Matrix Template

Add `## Execution Strategy` to plan.md (after the Phases table):

```markdown
## Execution Strategy

| Group | Phases | Parallel? | Ownership |
|-------|--------|-----------|-----------|
| A | 1, 2 | Yes | src/api/*, src/db/* |
| B | 3, 4 | Yes (after A) | src/ui/*, src/components/* |
| C | 5 | Sequential (after B) | tests/*, docs/* |
```

## Rules

1. **Zero file overlap** — No two parallel phases may own overlapping file paths.
2. **Max 3 parallel groups** — Beyond 3 groups, coordination overhead exceeds benefit.
3. **Setup phase always sequential** — Infrastructure/env/config phase runs first, before any parallel group.
4. **Integration/test phase always sequential** — Final test/docs phase runs after all parallel groups complete.
5. **Explicit ownership** — Each phase file MUST declare `ownership` in frontmatter (glob patterns).

## Phase Frontmatter Addition

Every phase in a parallel group adds:

```yaml
---
phase: 2
ownership: ["src/api/**", "src/models/**"]
parallel_group: "A"
---
```

## Dependency Hydration (step-08)

- Phases **within the same group**: NO `addBlockedBy` between them.
- Phases in **later groups**: `addBlockedBy` the last phase of the prior group.
- Add `parallel_group: "{letter}"` to task metadata.

## Integration with MeowKit Rules

Parallel phases MUST follow `parallel-execution-rules.md`:
- Worktree isolation per agent
- Gate 1 and Gate 2 are never parallelized
- Full test suite required after merge
