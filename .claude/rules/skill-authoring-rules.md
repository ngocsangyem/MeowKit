# Skill Authoring Rules

These rules govern how new and existing `meow:*` skills are authored, audited, and persisted.
Source: consolidated from Anthropic *Skill Authoring Best Practices* + *Lessons from Building Claude Code* (see `docs/skill-authoring-guidelines.md`).

## Rule 1: Every Skill MUST Include a Gotchas Section

Every `SKILL.md` MUST include a `## Gotchas` section. Empty is acceptable on day 1 (use placeholder `(none yet — grow from observed failures)`), but the section header itself is mandatory.

The `meow:skill-creator` template MUST emit this section by default for every new skill it scaffolds.

WHY: Anthropic's field report identifies the Gotchas section as the highest-signal content in any skill — it captures non-default knowledge accumulated from real failures. A skill without a gotchas section discards institutional learning every time Claude hits a new edge case.

**Bad example: No failure log** (institutional knowledge lost):

```markdown
# Billing Lib

How to use the internal billing library.
See the lib README for full API docs.
```

**Good example: Gotchas section grows over time**:

```markdown
# Billing Lib

How to use the internal billing library.

## Gotchas

- Proration rounds DOWN, not to nearest cent.
- test-mode skips the `invoice.finalized` hook.
- Idempotency keys expire after 24h, not 7d.
- Refunds need charge ID, not invoice ID.
```

INSTEAD of: a polished SKILL.md with no failure log
USE: a SKILL.md with `## Gotchas` that grows one bullet per observed edge case

## Rule 2: Persistent Skill State MUST Use ${CLAUDE_PLUGIN_DATA}

When a skill needs to persist data across sessions (append-only logs, JSON state, SQLite databases, history files), it MUST write to `${CLAUDE_PLUGIN_DATA}` — NOT to the skill's own directory.

WHY: Skill-directory state is wiped on plugin upgrade per Anthropic's documented behavior. Silent data loss is the failure mode. `${CLAUDE_PLUGIN_DATA}` is the stable, upgrade-safe folder.

EXCEPTION: MeowKit-internal infrastructure (`.claude/memory/`, `tasks/`, `session-state/`) keeps its current paths — these are framework state, not skill-owned state. The rule applies to data the skill itself creates and consumes (e.g., `standup-post` history, `babysit-pr` retry logs).

**Bad example: Skill-dir path** (wiped on plugin upgrade):

```python
# scripts/append-history.py
LOG_PATH = ".claude/skills/meow:standup-post/history.log"
with open(LOG_PATH, "a") as f:
    f.write(entry)
```

**Good example: Stable plugin-data path**:

```python
# scripts/append-history.py
import os
DATA_DIR = os.environ["CLAUDE_PLUGIN_DATA"]
LOG_PATH = f"{DATA_DIR}/standup-post/history.log"
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
with open(LOG_PATH, "a") as f:
    f.write(entry)
```

INSTEAD of: appending to `.claude/skills/meow:foo/log.json`
USE: appending to `${CLAUDE_PLUGIN_DATA}/foo/log.json`

## Rule 3: SKILL.md Body MUST Stay Under 500 Lines

Every `SKILL.md` body (excluding YAML frontmatter) MUST stay under 500 lines. Skills exceeding this MUST be decomposed via either:

- Reference files (one level deep) per progressive-disclosure pattern — link from SKILL.md to `references/*.md`
- Step-file architecture per `step-file-rules.md` — `workflow.md` + `step-NN-*.md` files

WHY: Once SKILL.md loads, every token competes with conversation history and other context. The 500-line cap is Anthropic's empirically-validated threshold for context efficiency. Beyond this, partial reads (`head -100`) start to miss content.

PERIODIC AUDIT: Run a length check on `meow:*` SKILL.md files quarterly OR on every model-tier upgrade (per `harness-rules.md` Rule 7 dead-weight audit cadence). Flag oversized monoliths for decomposition. Step-filed skills auto-pass — only the SKILL.md entrypoint counts.

MEASURABLE CHECK:
```bash
find .claude/skills -name SKILL.md -exec sh -c 'wc -l "$1" | awk "{if (\$1 > 500) print}"' _ {} \;
```

**Bad example: Monolithic 900-line SKILL.md** (every load consumes the full file):

```text
meow:my-skill/
└── SKILL.md   # 900 lines: overview + all references + all examples + all gotchas inline
```

**Good example: Decomposed via progressive disclosure** (load only what's needed):

```text
meow:my-skill/
├── SKILL.md           # 180 lines: overview + routing table
├── references/
│   ├── api.md         # loaded only when API details needed
│   └── examples.md    # loaded only when examples needed
└── scripts/
    └── helper.py      # executed via bash, never loaded into context
```

**Good example: Step-file decomposition** (auto-passes the 500-line check):

```text
meow:my-workflow/
├── SKILL.md           # 60 lines: metadata + entrypoint
├── workflow.md        # step sequence
├── step-01-load.md
├── step-02-process.md
└── step-03-emit.md
```

INSTEAD of: a 900-line monolithic SKILL.md
USE: a ≤500-line SKILL.md routing to `references/*.md` or step files

## Applies to

- `meow:skill-creator` (must enforce Rules 1 + 3 in templates)
- All future skill authoring (all 3 rules)
- Quarterly audits and model-upgrade audits (Rule 3 measurable check)
- Skill maintenance for any skill with persistent state (Rule 2)
