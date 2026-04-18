# MeowKit Memory System

> Team-shared, version-controlled learning system. No auto-injection pipeline. Skills read topic files on demand.

## 1. Overview

MeowKit maintains an in-repo memory system at `.claude/memory/`. Unlike Claude Code's machine-local auto-memory (personal debugging notes, preferences), MeowKit memory is **team-shared via git** and focuses on **recurring patterns, decisions, failures, and costs**.

The two systems are complementary:
- **MeowKit memory** = team knowledge (code standards, recurring patterns, costs) — lives in the repo
- **Claude Code auto-memory** = personal insights (debugging notes, workflow habits) — lives on your machine

**Key design principle:** No auto-inject pipeline. Memory is read on-demand by consumer skills at task start. This eliminates the context-budget drain and trust-boundary issues of the former `memory-loader` / `memory-parser` / `memory-filter` / `memory-injector` pipeline (deleted in plan 260418).

## 2. File Layout

```
.claude/memory/
  fixes.md                  # Bug-class session learnings (meow:fix)
  fixes.json                # Machine-queryable fix patterns v2.0.0 (meow:fix)
  review-patterns.md        # Review / architecture patterns (meow:review, meow:plan-creator)
  review-patterns.json      # Machine-queryable review patterns v2.0.0
  architecture-decisions.md # Architectural decisions (meow:plan-creator, meow:cook)
  architecture-decisions.json # Machine-queryable decisions v2.0.0
  security-notes.md         # Curated security findings (meow:cso, meow:review)
  cost-log.json             # Token usage per task — auto-appended by Stop hook
  decisions.md              # Long-form ADRs — owned by architect agent
  security-log.md           # Raw security audit log
  quick-notes.md            # ##note: capture staging — processed at Reflect
  conversation-summary.md   # Haiku-summarized session cache
  trace-log.jsonl           # Harness trace events (append-trace.sh)
  lessons-archive.md        # Historical archive — not actively read
  lessons.md                # ARCHIVED stub — content migrated to topic files
  last-model-id.txt         # Model-change detection for dead-weight audit
  patterns.json             # DEPRECATED stub — split into 3 scoped files above
```

### Consumer mapping

| Topic file | Consumer skills | When loaded |
|-----------|----------------|-------------|
| `fixes.md` + `fixes.json` | meow:fix | Task start: diagnosing bugs |
| `review-patterns.md` + `review-patterns.json` | meow:review, meow:plan-creator | Task start: code review / planning |
| `architecture-decisions.md` + `architecture-decisions.json` | meow:plan-creator, meow:cook | Task start: architecture decisions |
| `security-notes.md` | meow:cso, meow:review | Task start: security audit |
| `cost-log.json` | meow:memory, analyst agent | Phase 0 / 6 cost reporting |

## 3. Write Path

Three ways to write memory:

### a) Immediate capture (##prefix:)

Type messages with `##` prefix during any session. Handled by `immediate-capture-handler.cjs` (UserPromptSubmit hook):

| Prefix | Routes to | Entry type |
|--------|-----------|-----------|
| `##pattern: bug-class <description>` | `fixes.json` | JSON pattern entry |
| `##pattern: <description>` | `review-patterns.json` | JSON pattern entry |
| `##decision: <description>` | `architecture-decisions.json` | JSON decision entry |
| `##note: <text>` | `quick-notes.md` | Freeform markdown |

All captures are validated against injection patterns before writing. Invalid content is blocked with a visible warning.

### b) Session end (post-session.sh)

The Stop hook runs `post-session.sh` which:
- Appends a cost entry to `cost-log.json` (atomic temp-rename, M7 fix)
- Sets a model-change flag in `last-model-id.txt` to trigger dead-weight audit

The NEEDS_CAPTURE pipeline (writing markers to lessons.md) is **deleted**. lessons.md is an archived stub.

### c) Skill-invoked session capture

`meow:memory` session-capture (`references/session-capture.md`) guides extraction of patterns/decisions/failures at Phase 6 (Reflect). Output goes to topic files, not lessons.md.

## 4. Read Path

Memory is loaded **on-demand** by consumer skills:

1. **Consumer skill SKILL.md** includes a "Load memory" step listing which topic files to read
2. **Agent reads** the relevant topic file(s) at task start
3. **No injection** — content is not pushed into every prompt turn

Claude Code's auto-memory (`~/.claude/projects/…/MEMORY.md`) operates separately and is machine-local only.

## 5. Pruning

Run `/meow:memory --prune` to archive old entries from topic files.

**How it works (grep-based — no parser dependency):**
1. For each topic file: grep for `## ` headings with date pattern `(YYYY-MM-DD, severity: standard)`
2. Compute age; identify entries older than threshold (default: 90 days)
3. Append stale entries to `.claude/memory/lessons-archive.md`
4. Rewrite topic file without stale blocks

**Exempt from pruning:** `severity: critical` or `severity: security` entries; entries without a parseable date.

```
/meow:memory --prune              # default 90-day threshold
/meow:memory --prune --days 180   # custom threshold
/meow:memory --prune --dry-run    # preview without writing
```

When to prune: topic file > 300 lines or JSON file > 50 entries.

## 6. Cost Tracking

`cost-log.json` uses v2 schema (M1 fix):

```json
[
  {
    "date": "YYYY-MM-DD HH:MM",
    "session_id": "...",
    "model": "claude-sonnet-4-5",
    "estimated_cost_usd": 0.12,
    "estimated_input_tokens": 45000,
    "estimated_output_tokens": 8000,
    "cache_read_tokens": 12000,
    "cache_creation_tokens": 5000,
    "recent_files": 7
  }
]
```

Written atomically via temp-rename (`os.replace`) — concurrent-safe (M7 fix).

## 7. Deleted Components (Tombstone)

The following components were deleted in plan 260418-1603 (memory simplification):

| Deleted | Replaced by |
|---------|------------|
| `handlers/memory-loader.cjs` | Claude Code auto-memory + per-skill topic file reads |
| `handlers/memory-parser.cjs` | Direct Markdown reads; no parser needed |
| `handlers/memory-filter.cjs` | Per-skill topic file reads (each skill reads only what it needs) |
| `handlers/memory-injector.cjs` | `<memory-data>` wrapper removed; trust boundary is behavioral |
| `NEEDS_CAPTURE` marker system | Eliminated; lessons.md archived; direct topic file writes |
| `lessons.md` as active store | Archived stub; content migrated to topic files (migration script: `.claude/scripts/memory-topic-file-migrator.cjs`) |
| `patterns.json` monolith | Deprecated stub; replaced by `fixes.json`, `review-patterns.json`, `architecture-decisions.json` |

Reason: the auto-inject pipeline added latency on every prompt turn, consumed context budget, and introduced a trust-boundary concern (memory content rendered as instructions). The simpler on-demand model achieves the same learning persistence without these costs.

## Migration

If upgrading from a pre-simplification MeowKit version with an active `lessons.md`:

```bash
node .claude/scripts/memory-topic-file-migrator.cjs
```

The script is idempotent — safe to run multiple times. It reads `lessons.md`, categorizes entries into topic files, and archives `lessons.md` with a stub header.

## Memory vs Cache

**Memory** is team-shared learnings — version-controlled, human-curated, durable. Only canonical files above belong in `.claude/memory/`.

**Cache** is skill-generated ephemeral output — lives at `.claude/cache/` (gitignored). Web-fetched content, per-call outputs: cache, not memory.

**Rule:** if an agent writing the artifact would want to git-commit it → memory. If not → cache.
