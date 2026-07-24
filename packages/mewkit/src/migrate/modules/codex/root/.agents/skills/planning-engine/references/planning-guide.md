# Planning Guide — Capacity Model & Grouping Heuristics

Used by planning-reporter agent.

## Capacity Model

Sprint capacity = user-provided number via `--capacity`. The skill does NOT calculate capacity — that requires human input (PTO, ceremonies, focus factor).

When `--capacity` is provided:
- Use `scripts/capacity-bin.py` for deterministic bin-packing
- Flag `[INCOMPLETE]` when >30% tickets lack estimates
- Always add disclaimer: "Verify accounts for PTO, ceremonies, focus factor"

When `--capacity` is NOT provided:
- Report total points across all tickets
- Ask user: "Provide sprint capacity with --capacity N to see sprint fit analysis"

## Grouping Heuristics

Group tickets by (in priority order):
1. **Epic** — tickets sharing the same epic link
2. **Component** — tickets sharing Jira components
3. **Dependency chain** — tickets that block each other (must be in same sprint)
4. **Labels** — tickets sharing labels (weaker signal)
5. **Summary similarity** — related by topic (weakest signal)

## Sequencing Rules

Use dependency graph from `scripts/dep-graph.py`:
1. Tickets with no blockers → start first
2. Tickets blocked by #1 → start after
3. Continue topological order
4. Tickets with no links → can start anytime (parallel)
5. If circular deps → present cycle, skip sequencing for affected tickets

## Sprint Goal

Suggest a candidate based on:
- Dominant epic or theme across selected tickets
- Single sentence: "Deliver [coherent increment] so that [user benefit]"
- Label as DRAFT — team negotiates the real goal

## Over-Commitment Detection

Flag if total estimated points > capacity:
- List overflow tickets (sorted by lowest priority first)
- Suggest which to defer: lowest priority, fewest dependencies

## Tickets Needing Human Decision

Always separate these from auto-planned tickets:
- Escalated by mk:jira estimator ("human estimation recommended")
- Unestimated (no story points)
- Flagged as [AMBIGUOUS] by spec analysis
- Circular dependency participants
