# Skill Activation Matrix

When to activate each skill and agent during fix workflows.

## Always Activate

| Skill/Agent | Reason |
|-------------|--------|
| `meow:investigate` | Core to all fix workflows — find root cause first |

## Conditional Activation

| Skill/Agent | Activate When |
|-------------|---------------|
| `meow:scout` | Codebase exploration needed, multiple areas affected |
| brainstormer agent | Multiple valid approaches, architecture decision needed |
| researcher agent | External docs needed, latest best practices |

## Agent Usage by Step

| Agent | When |
|-------|------|
| Explore (parallel) | Scout multiple areas simultaneously |
| Bash (parallel) | Verify implementation (typecheck, lint, build) |
| researcher | External docs, best practices |
| planner | Complex fix needs breakdown |
| tester | After implementation, verify fix |
| reviewer | After fix, verify quality and security |
| shipper | After approval, commit + PR |
| documenter | API/behavior changes need doc updates |
| journal-writer | Significant failures worth documenting |

## Workflow → Activation Map

| Workflow | Skills/Agents Activated |
|----------|------------------------|
| Quick | investigate, reviewer, parallel Bash verification |
| Standard | Above + scout, tester, documenter, shipper |
| Deep | All above + brainstormer, researcher, planner, journal-writer |
| Parallel | Per-issue task trees + developer agents per issue |
