---
name: meow:scout
description: "Fast parallel codebase scouting. Spawns multiple Explore subagents to search directories simultaneously, returning a consolidated file map with architecture fingerprint, complexity estimates, and routing suggestions. Use before planning, debugging, or any task spanning multiple directories."
# Source: claudekit-engineer
# Original: .claude/skills/scout/SKILL.md
# Adapted for MeowKit — see improvement comment below for full changelog.
---

<!-- Improvements over claudekit-engineer/scout:
- 3-tier search scope (Always/On-Request/Never): addresses W1 [CLASS A]
- Architecture fingerprint in report: addresses W2 [CLASS B]
- Entry point identification: addresses W4 [CLASS B]
- Explicit handoff protocol: addresses W3 [CLASS B]
- Architectural pattern detection: addresses W6 [CLASS C]
- Specific memory path: addresses W5 [CLASS C]
- Progressive disclosure: SKILL.md is decision router, references/ has execution detail
- Applies P1-P8 from Anthropic context engineering research
-->

# Scout

Fast, parallel codebase exploration using Explore subagents. Divides the project into segments, searches them simultaneously, and returns a consolidated report.

## When to Use

- Starting a feature that spans multiple directories
- User asks to "find", "locate", or "search for" files
- Before planning (Phase 1) on complex tasks — understand what exists first
- Debugging session requiring file relationship understanding
- User asks about project structure or where functionality lives

## Workflow Integration

Operates in **Phase 0 (Orient)** and **Phase 1 (Plan)**.

- Orchestrator invokes scout before planner on COMPLEX tasks
- Planner may invoke scout when the technical approach needs codebase understanding
- Developer may invoke scout when implementation touches unfamiliar areas

## Quick Start

```
/meow:scout authentication      → find all auth-related files
/meow:scout database migrations  → find DB migration files
/meow:scout [any search target]  → parallel search across codebase
```

## Scout Process

1. **Analyze** — parse user prompt, identify search targets (keywords, file types)
2. **Determine scale** — calculate SCALE using formula in `references/scouting-strategy.md`
3. **Apply search scope** — include Tier 1 always, Tier 2 if task-relevant, exclude Tier 3 always (see `references/search-scope.md`)
4. **Divide directories** — assign each Explore agent a distinct scope (no overlap)
5. **Spawn agents** — all in a single message for parallel execution (see `references/scouting-strategy.md`)
6. **Collect results** — deduplicate, merge, note gaps/timeouts
7. **Build report** — fill structured template (see `references/report-and-handoff.md`)
8. **Execute handoff** — route to next agent per handoff protocol

## References

Load these **only when executing** the corresponding step — not upfront.

| Reference | When to load | What it contains |
|-----------|-------------|-----------------|
| **[search-scope.md](./references/search-scope.md)** | Step 3 — applying scope rules | Tier 1/2/3 directory lists, justification, exclusion patterns |
| **[scouting-strategy.md](./references/scouting-strategy.md)** | Steps 2, 4, 5 — spawning agents | SCALE formula, directory division rules, Explore agent prompt template, parallel execution, file reading patterns |
| **[report-and-handoff.md](./references/report-and-handoff.md)** | Steps 7, 8 — writing output | Report template with all sections, handoff protocol per phase, memory integration, context budget |

## Constraints

- **Read-only** — scout NEVER modifies files
- **Maximum 6 parallel agents** — beyond this, aggregation cost exceeds benefit
- **3-minute timeout** per agent — skip non-responders, don't retry
- **No external tool dependencies** — uses only Claude Code built-in Explore
- **Security** — never access .env, credentials, or SSH keys during scouting
- **Tier 3 always excluded** — no exceptions regardless of task
