---
name: mk:context-audit
preamble-tier: 1
version: 1.0.0
description: "Read-only audit of .claude/ overhead. NOT for mk:context-engineering."
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
keywords:
  - context
  - window
  - tokens
  - audit
  - overhead
  - claude-md
  - skills
  - agents
  - mcp
  - structural
when_to_use: "Bloated session."
user-invocable: true
phase: on-demand
trust_level: kit-authored
injection_risk: medium
source: local
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# /mk:context-audit — Context Window Structural Audit

Read-only audit of `.claude/` structural overhead. Surfaces what is loaded into
every host-runtime session and how much of the context window it consumes,
then recommends the highest-leverage trims.

Complementary lens: `mewkit validate --substrate` shows the same artifact set
grouped by the responsibility each serves (covered / partial / missing), so a trim
can be checked against responsibility coverage before removing an artifact. The
per-phase read budget that bounds what an audit-driven session should load lives in
`.claude/skills/agent-detector/references/context-budget-rules.md`.

## When to Use

Three concrete triggers:

1. **Pre-add capacity check** — before adding a new agent, skill, or rule file,
   confirm the project is below the 25% structural-overhead threshold.
2. **Post-degradation diagnostic** — when sessions feel slow, off-topic, or
   over-compacted, audit to see if structural overhead has grown past 10%.
3. **Periodic health audit** — on model upgrades, confirm the always-on bundle
   still pays its keep (the dead-weight audit in
   `.claude/skills/cook/references/harness-rules.md` Rule 7, where that tooling is present).

## Context vs Cost (Boundary)

| Concern | Mechanism | Unit |
| --- | --- | --- |
| Monetary cost | `mewkit budget` and `.claude/skills/autobuild/scripts/budget-tracker.sh` | USD |
| Window utilization (this skill) | `/mk:context-audit` and `scripts/inventory-context.sh` | tokens / % |

This skill measures only what is statically loaded into every session: the always-on bundle (project instructions, agents, skills, rules, any project commands, MCP config). Conversation history, tool output and active edits live elsewhere.

## Workflow

Run the pipeline from the project root (or pass the root as the first argument):

```bash
SCAN_ROOT="${1:-$PWD}"
bash ${CLAUDE_SKILL_DIR}/scripts/inventory-context.sh "$SCAN_ROOT" \
  | bash ${CLAUDE_SKILL_DIR}/scripts/estimate-tokens.sh \
  | bash ${CLAUDE_SKILL_DIR}/scripts/format-audit-report.sh
```

The scripts print a markdown report (summary, top consumers, recommendations, banner) and write no files. The banner and its thresholds come from the script; `references/token-cost-model.md` owns the numbers and their reasoning. The window size defaults to 200,000 tokens and `MEOWKIT_CONTEXT_WINDOW` overrides it. If a script exits non-zero, show its stderr and stop.

Print the script output as it is: header, summary table, top consumers (top 10), recommendations sorted by token impact, and how to act (cost: `mewkit budget`; an agent file costs tokens only when that agent is spawned).

## Integration Points

- **Reuses, does not duplicate:** the chars/4 heuristic of the budget-tracker
  hook. Shell scripts inline the same heuristic with a citation comment.
- **Reads, does not write:** `.meowkit/telemetry/cost-log.json`,
  `.claude/`, `.mcp.json`. No file writes anywhere.
- **Discovery:** via `keywords:` frontmatter and a cross-reference from
  `mewkit budget`. There is no separate routing rule.

## Gotchas

- Inventory counts bytes, not what a host actually loads: an agent file costs tokens only when that agent is spawned, so weigh trims by how often the file is loaded.

## Related Rules

- `.claude/skills/skill-creator/references/skill-authoring-rules.md` — discovery + Gotchas section requirements
- `.claude/rules/injection-rules.md` Rule 11 — Skill Rule of Two; this skill
  scores 2 of 3 (untrusted SCAN_ROOT input + filename inventory may surface
  sensitive paths) so paths are canonicalized via `realpath` and never executed.
