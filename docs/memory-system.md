# MeowKit Memory System

> Team-shared, version-controlled learning system that gets smarter over time.

## Overview

MeowKit maintains an in-repo memory system at `.claude/memory/`. Unlike Claude Code's machine-local auto-memory (personal debugging notes, preferences), MeowKit memory is **team-shared via git** and focuses on **recurring patterns, decisions, failures, and costs**.

The two systems are complementary:
- **MeowKit memory** = team knowledge (code standards, recurring patterns, costs) — lives in the repo
- **Claude Code auto-memory** = personal insights (debugging notes, workflow habits) — lives on your machine

## Architecture

```
.claude/memory/
  lessons.md       # Session learnings — append-only, human-readable
  patterns.json    # Recurring patterns — machine-queryable, frequency-tracked
  decisions.md     # Architecture decisions — append-only
  cost-log.json    # Token usage per task
  security-log.md  # Security audit findings
```

### Data Flow

```
Session ends → Stop hook writes NEEDS_CAPTURE marker to lessons.md
                                    ↓
Next session → Phase 0 → Analyst reads lessons.md
                       → Processes NEEDS_CAPTURE markers (max 3, 2-min budget)
                       → Reconstructs learnings from git log
                                    ↓
Before Phase 5 → Live capture: agent writes non-obvious decisions to lessons.md
                                    ↓
Phase 6 → session-capture: categorizes learnings (patterns/decisions/failures)
        → Updates patterns.json with new entries
                                    ↓
After ~10 sessions → pattern-extraction: proposes high-frequency patterns for CLAUDE.md
                   → Human approval required before any CLAUDE.md changes
                                    ↓
When memory grows large → consolidation: prune stale, merge duplicates, archive old costs
```

## How to Activate

**No manual activation needed.** The system works automatically:

1. **Stop hook** (automatic): Every session end writes a NEEDS_CAPTURE marker. Configured in `.claude/settings.json` → `post-session.sh`.
2. **Phase 0 retroactive capture** (automatic): Next session's analyst processes markers. Controlled by CLAUDE.md instruction.
3. **Live capture** (semi-automatic): Before Phase 5, agent captures non-obvious decisions. Controlled by CLAUDE.md instruction.
4. **Pattern extraction** (manual): After ~10 sessions, invoke `meow:memory` pattern-extraction to review promotion candidates.
5. **Consolidation** (manual): When memory grows large (20+ sessions, 50+ patterns, 500+ cost entries), invoke `meow:memory` consolidation.

## Session Capture

Learnings are captured in 3 categories:

| Category | What to Extract | Example |
|----------|----------------|---------|
| **Patterns** | Reusable approaches that worked | "useAuthToken composable centralizes auth state" |
| **Decisions** | Choices with rationale and outcome | "Chose Redis over in-memory cache — GOOD_CALL" |
| **Failures** | Mistakes with root cause and prevention | "Token refresh race condition — use SELECT FOR UPDATE" |

Each entry in `patterns.json` includes:
- `category`: pattern / decision / failure
- `severity`: critical (saves ≥30 min) / standard
- `applicable_when`: one sentence — when should future agents use this?
- `frequency`: how many sessions surfaced this pattern
- `scope`: optional directory path where this applies

## Pattern Promotion

Patterns are promoted to CLAUDE.md rules when ALL criteria are met:
1. `frequency >= 3` (appeared in multiple sessions)
2. `severity == "critical"` OR `frequency >= 5`
3. Generalizable (not feature-specific)
4. Would save ≥30 min if known in advance
5. **Human approval** — never auto-promoted

Legacy entries without `severity` default to `"standard"` and can still be promoted at frequency ≥ 5.

## Consolidation

Run consolidation manually when memory grows large. Uses a classification rubric:

| Classification | Condition | Action |
|---------------|-----------|--------|
| **Clear match** | Exactly one existing entry owns the lesson | Merge into owner |
| **Ambiguous** | Multiple plausible owners | Ask user to choose |
| **No match** | No existing entry fits, but lesson is durable | Create new entry |
| **No durable signal** | Transient, noisy, or not reusable | Skip |

See `meow:memory` → `consolidation.md` reference for full guide.

## FAQ

**Do I need to do anything?**
No. Session markers are written automatically by the Stop hook. Phase 0 processes them automatically. You only need to act when pattern-extraction proposes CLAUDE.md promotions (approve/reject).

**Where do memories live?**
Four knowledge layers exist in MeowKit projects:
1. `CLAUDE.md` + `.claude/rules/` — instructions and rules (you write these)
2. `.claude/memory/` — team learnings (MeowKit writes, you review)
3. `~/.claude/projects/*/memory/` — personal notes (Claude Code auto-memory)
4. `docs/` — project documentation (maintained by docs-manager agent)

**Can I edit memory files directly?**
Yes. They are plain markdown and JSON. Edit freely. The system will respect your changes.

**What happens if I never run consolidation?**
Memory files grow unbounded. lessons.md becomes hard to scan, patterns.json gets noisy, cost-log.json gets large. Not catastrophic, but consolidation keeps things tidy.

## Limitations

- **Retroactive capture loses "WHY"** — reconstructs WHAT changed from git, but context decisions, rejected approaches, and corrections are lost unless live-captured before Phase 5
- **Consolidation thresholds are initial guesses** — 20/50/500 numbers will be revised after real usage
- **No cross-machine sync** — MeowKit memory syncs via git; Claude Code auto-memory is machine-local only
- **Stop hook cannot invoke skills** — shell script writes markers; actual extraction happens at Phase 0 of the next session

## Migration

No migration needed. Existing empty memory files work with the new schema. New `patterns.json` fields (`category`, `severity`, `applicable_when`) are optional — entries without them remain valid.
