# MeowKit Memory System

> Per-project, machine-local memory for MeowKit skills. Topic files live at `.claude/memory/` and are read on demand — no auto-injection pipeline. Separate from Claude Code's platform auto-memory.

## 1. Overview

MeowKit maintains a per-project memory system at `.claude/memory/`. It is a **MeowKit convention** — a directory owned by MeowKit skills and hooks, scoped to a single project, and explicitly read/written by the skills that need it.

### Separate from Claude Code auto-memory

Claude Code ships its own auto-memory system. It is **not** the same as MeowKit's memory.

| System | Path | Scope | Auto-load | Written by |
|---|---|---|---|---|
| Claude Code auto-memory | `~/.claude/projects/<project>/memory/` (directory) | Per-git-repo, machine-local | `MEMORY.md` auto-loads at SessionStart (capped at **200 lines or 25 KB**, whichever comes first). Topic files in the same directory load on demand. | Claude via its standard Write/Edit tools |
| MeowKit memory | `<repo>/.claude/memory/` | Per-repo, machine-local (gitignored from v2.4.1+) | Never auto-loaded. Consumer skills `Read` the relevant topic file at task start. | MeowKit hooks (`immediate-capture-handler`, `post-session.sh`) and skills (`mk:memory`, `mk:fix`, etc.) |

The two systems are complementary: Claude Code's auto-memory captures the user's personal, cross-project habits; MeowKit's `.claude/memory/` captures project-specific engineering artifacts (fix patterns, review findings, architecture decisions, cost telemetry) needed by MeowKit's 7-phase workflow.

### Machine-local by default (v2.4.1+)

`.claude/memory/*` is gitignored. Only `.gitkeep` is tracked, so the directory survives clones but its contents do not. Fresh installs via `npx mewkit setup` start with an empty memory directory.

**Why:** memory content is developer-specific working state. Committing it would mix personal session history, secrets, and transient captures into shared git history — and would ship the MeowKit dev team's own memory to every downstream install.

### No auto-inject pipeline

MeowKit **does not** inject memory content into every prompt turn. Consumer skills load only the topic files they need when a task starts. This:
- Eliminates the per-turn token cost of a global memory filter.
- Removes the trust-boundary concern of memory content being rendered as LLM instructions.
- Makes the read path explicit and auditable per skill.

The prior auto-inject pipeline (`memory-loader`, `memory-parser`, `memory-filter`, `memory-injector`) was removed in v2.4.1.

## 2. File Layout

```
.claude/memory/
  fixes.md                    # Bug-class session learnings (mk:fix)
  fixes.json                  # Structured fix patterns — schema v2.0.0
  review-patterns.md          # Review / architecture patterns (mk:review, mk:plan-creator)
  review-patterns.json        # Structured review patterns — schema v2.0.0
  architecture-decisions.md   # Architectural decisions (mk:plan-creator, mk:cook)
  architecture-decisions.json # Structured decisions — schema v2.0.0
  security-notes.md           # Curated security findings (mk:cso, mk:review)
  cost-log.json               # Token usage per task — auto-appended by Stop hook
  decisions.md                # Long-form ADRs — owned by architect agent
  security-log.md             # Raw security audit log
  quick-notes.md              # ##note: capture staging — processed at Reflect
  conversation-summary.md     # Haiku-summarized session cache
  trace-log.jsonl             # Harness trace events (append-trace.sh)
  last-model-id.txt           # Model-change detection for dead-weight audit
  lessons.md                  # ARCHIVED stub — content migrated to topic files (v2.4.1)
  lessons-archive.md          # Historical archive — not actively read
  patterns.json               # DEPRECATED stub — split into 3 scoped files above (v2.4.1)
  .gitkeep                    # Preserves the directory across clones; the only tracked file
```

### Consumer mapping

| Topic file | Consumer skills | Loaded when |
|---|---|---|
| `fixes.md` + `fixes.json` | `mk:fix` | Diagnosing a bug — task start |
| `review-patterns.md` + `review-patterns.json` | `mk:review`, `mk:plan-creator` | Code review or planning — task start |
| `architecture-decisions.md` + `architecture-decisions.json` | `mk:plan-creator`, `mk:cook` | Architecture decisions — task start |
| `security-notes.md` | `mk:cso`, `mk:review` | Security audit — task start |
| `cost-log.json` | `mk:memory`, `analyst` agent | Phase 0 / Phase 6 cost reporting |

Each `.json` file declares `version: "2.0.0"` and a `scope` field; handlers reject writes with mismatched scope to prevent cross-file corruption.

## 3. Write Path

Three mechanisms write to memory:

### a) Immediate capture — `##prefix:` syntax

Type messages with a `##` prefix at any point during a session. The `immediate-capture-handler.cjs` UserPromptSubmit hook routes them:

| Prefix | Target | Entry shape |
|---|---|---|
| `##pattern:bug-class <description>` | `fixes.json` | Structured JSON entry |
| `##pattern:decision <description>` | `architecture-decisions.json` | Structured JSON entry |
| `##pattern: <description>` | `review-patterns.json` | Structured JSON entry (default) |
| `##decision: <description>` | `architecture-decisions.json` | Structured JSON entry |
| `##note: <text>` | `quick-notes.md` | Freeform markdown line |

Captures pass through two guards before persisting:
1. **Injection validation** (`validate-content.cjs`) — blocks content matching known prompt-injection patterns.
2. **Secret scrub** (`secret-scrub.cjs`) — redacts Anthropic, OpenAI, Stripe, AWS, GitHub, GitLab, Slack, JWT, DB URL, Bearer token, email, and generic `api_key=` / `password=` / `token=` patterns. Captured content later re-read into LLM context would otherwise re-expose secrets.

Writes are atomic (temp-file + rename) and use per-target-file locks, so concurrent `##decision:` / `##pattern:decision` writes to the same target serialize correctly.

### b) Session end — `post-session.sh`

The Stop hook:
- Appends a cost entry to `cost-log.json` using atomic `os.replace`.
- Flips the model-change flag in `last-model-id.txt` when the active model changes, triggering the dead-weight audit playbook.

### c) Skill-invoked session capture

`mk:memory session-capture` (see `skills/mk:memory/references/session-capture.md`) runs at Phase 6 (Reflect) and extracts patterns / decisions / failures from the session, appending to the right topic files.

## 4. Read Path

Memory loads **on demand**, never automatically:

1. A consumer skill's SKILL.md includes a "Load memory" step naming the topic files it reads.
2. The agent uses the standard `Read` tool to load those files when the task starts.
3. Nothing is injected on subsequent turns; re-reads happen only if the skill explicitly requires them.

The files in `.claude/memory/` are plain Markdown and JSON. Claude Code's platform does not treat this path specially; it reads these files the same way it reads any project file.

## 5. Pruning

Run `/mk:memory --prune` to archive stale entries from topic files.

```bash
/mk:memory --prune              # default 90-day threshold
/mk:memory --prune --days 180   # custom threshold
/mk:memory --prune --dry-run    # preview without writing
```

**Mechanics** (grep-based, no parser dependency):
1. For each topic file, find `## ` headings with date pattern `(YYYY-MM-DD, severity: <level>)`.
2. Compute age; identify entries older than the threshold.
3. Move matching blocks into `.claude/memory/lessons-archive.md`.
4. Rewrite the topic file without those blocks.

**Exempt from pruning:** entries marked `severity: critical` or `severity: security`; entries with no parseable date.

**When to prune:** any single topic file > 300 lines, or the sum of topic files > 500 lines, or a JSON file with > 50 patterns.

## 6. Cost Tracking

`cost-log.json` uses schema v2 (v2.4.1 alignment):

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

Writes use temp-file + `os.replace` so a crash mid-write cannot corrupt the file. Concurrent hooks are safe.

## 7. Interaction with Claude Code Platform Memory

These pieces of Claude Code's own memory system are **separate** from MeowKit's and remain available:

- **`CLAUDE.md`** — project / user / managed / local scopes, `@path` imports, `.claude/rules/` path-scoped instructions. Loaded every session.
- **Auto-memory** (`~/.claude/projects/<project>/memory/`) — Claude writes its own learnings here. `MEMORY.md` auto-loads at SessionStart, capped at **200 lines or 25 KB**, whichever comes first. Topic files in the same directory load on demand when Claude uses `Read`.
- **Subagent memory** — each subagent has its own memory directory at `~/.claude/agent-memory/<agent-name>/`. Subagents do **not** inherit the parent session's `MEMORY.md`.
- **`/memory` slash command** — opens Claude Code's built-in browser for the auto-memory directory. Disjoint from MeowKit's `##prefix:` capture system.
- **`autoMemoryEnabled` setting** (and env var `CLAUDE_CODE_DISABLE_AUTO_MEMORY`) — toggles platform auto-memory off without affecting MeowKit's `.claude/memory/`.
- **`/compact` and compaction** — in-session only; does not write to any memory file.

## 8. Tombstone — components removed in v2.4.1

| Removed | Replaced by |
|---|---|
| `handlers/memory-loader.cjs` | On-demand skill-level `Read` calls |
| `handlers/memory-parser.cjs` | Direct Markdown / JSON reads; no parser |
| `handlers/memory-filter.cjs` | Per-skill scoped topic files |
| `handlers/memory-injector.cjs` | No auto-inject; trust boundary enforced behaviorally |
| `NEEDS_CAPTURE` marker system | Eliminated; retroactive capture replaced by direct writes and Phase 6 `mk:memory session-capture` |
| `lessons.md` as active store | Archived stub; content migrated to topic files via `memory-topic-file-migrator.cjs` |
| `patterns.json` monolith | Deprecated stub; replaced by `fixes.json` + `review-patterns.json` + `architecture-decisions.json` |
| `.claude/memory/*` committed to git | Gitignored — machine-local by default |

## 9. Migration (pre-v2.4.1 → v2.4.1)

If you are upgrading a project that still has an active `lessons.md` or a monolithic `patterns.json`:

```bash
node .claude/scripts/memory-topic-file-migrator.cjs
```

The script is idempotent — safe to run multiple times. It:
- Reads `lessons.md` and `patterns.json`.
- Categorizes each entry (bug-class → `fixes.*`, review/architecture → `review-patterns.*`, decision → `architecture-decisions.*`).
- Dedupes semantic duplicates detected during the first migration.
- Archives `lessons.md` with a stub header; leaves `patterns.json` as a deprecated stub for one release.

After migration, your team's topic files exist but remain **machine-local**. If you want a team-shared subset of learnings, promote the highest-value patterns to `CLAUDE.md` or `.claude/rules/` — those are committed to the repo and loaded platform-wide.

## 10. Memory vs Cache

| | Memory | Cache |
|---|---|---|
| Location | `.claude/memory/` | `.claude/cache/` |
| Purpose | Durable, human-curated learnings | Skill-generated, regeneratable output |
| Examples | Fix patterns, architecture decisions, cost log | Web-fetched docs, pack snapshots, per-call outputs |
| Gitignored | Yes (v2.4.1+) | Yes |

Rule of thumb: if the agent that produced the artifact would want a human to inspect it later → memory. If the agent would rebuild it on demand → cache.
