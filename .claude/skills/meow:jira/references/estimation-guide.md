# Estimation Guide — Heuristic Signals & Escalation

Used by jira-estimator agent. Single-ticket only. No --batch, no --deep (v3).

## Estimation Flow

1. Read ticket via MCP (description, type, components, links, existing points)
2. Wrap in DATA boundaries (same as evaluate)
3. Qualitative analysis against signals below
4. Suggest Fibonacci range with reasoning
5. Check escalation triggers
6. Output estimate + reasoning + escalation (if any)

## Heuristic Signals

| Signal | Low (1-3pt) | Medium (3-8pt) | High (8-13pt) |
|--------|-------------|----------------|---------------|
| Areas touched | 1 module | 2-3 modules | 4+ or cross-cutting |
| Integration | None | Internal APIs | External/3rd-party |
| Clarity | Clear AC, specific | Partial AC | No AC, vague |
| Precedent | Many similar done | Some precedent | No precedent |
| Risk keywords | None | "update", "extend" | "refactor", "migrate", "rewrite" |

Do NOT use additive scoring. Reason qualitatively, then suggest a Fibonacci number.

## Escalation Triggers

Auto-flag for human estimation when ANY apply:
- Range spans >1 Fibonacci step (e.g., 5-13 = too uncertain)
- Zero historical precedent for this type of work
- References technology not in current codebase
- Description <30 words with no AC

Output: "Human estimation recommended" + reasons.

## JQL Escaping

All user-derived terms: `bash .claude/skills/meow:jira/scripts/jql-sanitize.sh '<term>'`

## JQL Error vs Zero Results

- Query error (syntax, MCP failure, auth) → NOT "zero results." Skip historical signal, note "historical comparison unavailable"
- Successful query, 0 results → "no precedent"

## Evaluate-First

If evaluate output available in session, use its signals. Otherwise include:
"Tip: run `/meow:jira evaluate {ISSUE-KEY}` first for more informed estimation."

## Gotchas

- This is LLM self-assessment, not calibrated prediction
- Estimation accuracy improves with historical data in the project
- Never present estimates as fact — always include reasoning
- Tickets with <30 words cannot be reliably estimated
