---
title: Memory System
description: How MeowKit persists lessons, patterns, and costs across sessions.
persona: B
---

# Memory System

MeowKit's memory system lets the AI agent learn from past sessions, track costs, and accumulate institutional knowledge. It is team-shared (in-repo, version-controlled) and complementary to Claude Code's machine-local auto-memory.

## Topic files

Memory is split into focused topic files. Each skill reads only the files it needs — there is no auto-injection into every prompt.

| File | Purpose | Format | Consumer |
|------|---------|--------|---------|
| `memory/fixes.md` | Bug-class session learnings | Markdown | meow:fix |
| `memory/fixes.json` | Machine-queryable fix patterns (v2.0.0) | JSON | meow:fix |
| `memory/review-patterns.md` | Review and architecture patterns | Markdown | meow:review, meow:plan-creator |
| `memory/review-patterns.json` | Machine-queryable review patterns (v2.0.0) | JSON | meow:review, meow:plan-creator |
| `memory/architecture-decisions.md` | Architectural decisions | Markdown | meow:plan-creator, meow:cook |
| `memory/architecture-decisions.json` | Machine-queryable decisions (v2.0.0) | JSON | meow:plan-creator, meow:cook |
| `memory/security-notes.md` | Curated security findings | Markdown | meow:cso, meow:review |
| `memory/cost-log.json` | Token usage per task | JSON | analyst agent |
| `memory/decisions.md` | Long-form architecture decision records | Markdown | architect agent |
| `memory/security-log.md` | Raw security audit log | Markdown | security agent |

## How it works

```mermaid
flowchart TD
  USER[User types ##prefix:] -->|validated + written| TF[Topic file\nor JSON entry]
  WORK[Phase 1-4\nWork proceeds] --> P5[Phase 5 Live capture\nnon-obvious decisions]
  P5 --> TF
  TF --> P6[Phase 6 Reflect\nmeow:memory session-capture]
  P6 --> TF
  SKILL[Consumer skill\nat task start] -->|reads on-demand| TF
  STOP[Session ends\nStop hook] -->|cost entry| CL[cost-log.json]
```

### Capture flow

1. **Immediate capture** (`##prefix:` messages): written instantly by `immediate-capture-handler.cjs` — crash-resilient
2. **Live capture** (before shipping): agent captures non-obvious decisions, rejected approaches, surprises — context lost otherwise
3. **Session capture** (Phase 6): `meow:memory` session-capture extracts patterns/decisions/failures and appends to topic files

### On-demand read path

Skills include a "Load memory" step in their SKILL.md. The agent reads only the topic file(s) relevant to the current task. No content is injected into every prompt turn.

## Immediate capture (##prefix:)

For crash-resilient knowledge capture, type messages with `##` prefix:

| Prefix | Routes to | Type |
|--------|-----------|------|
| `##pattern: bug-class <description>` | `fixes.json` | JSON pattern entry |
| `##pattern: <description>` | `review-patterns.json` | JSON pattern entry |
| `##decision: chose X over Y because…` | `architecture-decisions.json` | JSON decision entry |
| `##note: check this later` | `quick-notes.md` | Freeform (classified at Reflect) |

**Why double hash?** Single `#` conflicts with markdown headers and `#123` issue references.

Captures are validated against injection patterns before writing. Invalid content is blocked with a visible warning.

## Split JSON schema (v2.0.0)

```json
{
  "version": "2.0.0",
  "scope": "fixes",
  "consumer": "meow:fix",
  "patterns": [
    {
      "id": "gnu-grep-bre-macos",
      "type": "failure",
      "category": "bug-class",
      "severity": "critical",
      "domain": ["shell", "macos", "grep"],
      "applicable_when": "Writing shell scripts that use grep with alternation or quantifiers",
      "context": "macOS ships BSD grep which silently ignores GNU BRE extensions.",
      "pattern": "Always use grep -E (ERE) for alternation and quantifiers.",
      "frequency": 4,
      "lastSeen": "2026-04-18"
    }
  ],
  "metadata": {
    "created": "2026-04-18",
    "last_updated": "2026-04-18"
  }
}
```

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique kebab-case identifier |
| `type` | Yes | `failure` (avoid) or `success` (repeat) |
| `category` | Yes | `bug-class`, `pattern`, `decision` |
| `severity` | Yes | `critical` or `standard` |
| `domain` | Yes | Array of domain keyword tags |
| `applicable_when` | Yes | One sentence: conditions for future agents to use this |
| `context` | No | Additional background |
| `pattern` | Yes | What to do (or not do) |
| `frequency` | Yes | Number of sessions that surfaced this |
| `lastSeen` | Yes | Date of last occurrence |

## Pruning

When topic files grow large (> 300 lines or JSON > 50 entries), run:

```
/meow:memory --prune              # default 90-day threshold
/meow:memory --prune --days 180   # custom threshold
/meow:memory --prune --dry-run    # preview without writing
```

**What gets pruned:** `severity: standard` entries with a parseable date older than threshold.

**What is exempt:** `severity: critical` / `security` entries; entries without a parseable date.

Pruned entries are moved to `lessons-archive.md` for recovery.

## Cost tracking

Every session appends to `cost-log.json` via the Stop hook (`post-session.sh`). Fields: `date`, `session_id`, `model`, `estimated_cost_usd`, token counts, `cache_read_tokens`, `cache_creation_tokens`, `recent_files`.

View cost report with `npx meowkit memory --stats`.

## MeowKit vs Claude Code memory

| Aspect | MeowKit Memory | Claude Code Auto-Memory |
|--------|---------------|------------------------|
| Location | In-repo (`.claude/memory/`) | Machine-local (`~/.claude/projects/`) |
| Audience | Team (shared via git) | Individual (per machine) |
| Content | Lessons, patterns, costs | Preferences, debugging notes |
| Loading | On-demand by consumer skills | Automatic (Claude Code managed) |
| Promotion | Human-gated → CLAUDE.md | Automatic |

Use MeowKit for team knowledge. Use Claude Code auto-memory for personal insights.

## Privacy

All memory stays project-local in `.claude/memory/`. No data leaves the machine.

The topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`, `security-notes.md`) and split JSON files are team learnings — commit them via git. Machine-local or sensitive files should remain gitignored.

## Migration from pre-simplification MeowKit

If you have an active `lessons.md` from a previous MeowKit version:

```bash
node .claude/scripts/memory-topic-file-migrator.cjs
```

The script is idempotent. It categorizes existing entries into topic files and archives `lessons.md` with a stub header.
