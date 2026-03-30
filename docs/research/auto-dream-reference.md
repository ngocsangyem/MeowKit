# Auto Dream — Claude Code Memory Consolidation Reference

**Source:** Claude Code v2.1.83
**Extracted from:** Binary reverse-engineering (Piebald-AI/claude-code-system-prompts)
**Full spec:** `docs/research/agent-prompt-dream-memory-consolidation.md` (system prompt)
**Implementation spec:** `compare-kit/docs/skills/DREAM_FEATURE_SPEC.md` (JS extraction)

---

## Architecture

Dream is a **forked work session** (not a tool call) — a complete separate Claude session with its own prompt, spawned via `cW()`. Runs as a background task with type `"dream"`.

### Trigger Conditions

| Condition | Value | Override |
|-----------|-------|---------|
| Min hours since last consolidation | 24h | `tengu_onyx_plover.minHours` |
| Min new sessions since last | 5 | `tengu_onyx_plover.minSessions` |
| Scan throttle | 10 min between checks | `fb$` constant |
| Lock staleness | 1 hour | `EC$` constant |

### Tool Constraints

| Tool | Permission |
|------|-----------|
| Bash (read-only: ls, find, grep, cat, stat, wc, head, tail) | Allowed |
| Bash (write, redirect, modify) | **DENIED** |
| Read, Write, Edit (memory files only) | Allowed |
| All other tools | Standard auto-memory policy |

### Lock Mechanism

- File: `${MEMORY_DIR}/.consolidate-lock` containing PID
- Acquire: write PID → re-read → verify PID matches (prevents race)
- Staleness: lock >1h old + PID dead = stale, can be claimed
- Release: restore prior mtime or unlink

---

## Four Phases

### Phase 1 — Orient
- `ls` memory directory
- Read `MEMORY.md` index
- Skim existing topic files to avoid duplicates
- Check `logs/` and `sessions/` subdirectories

### Phase 2 — Gather Signal
Priority order:
1. **Daily logs** (`logs/YYYY/MM/YYYY-MM-DD.md`) — append-only stream
2. **Drifted memories** — facts contradicting current codebase
3. **Transcript search** — narrow grep on JSONL, NOT exhaustive reads:
   ```bash
   grep -rn "<narrow term>" ${TRANSCRIPTS_DIR}/ --include="*.jsonl" | tail -50
   ```

### Phase 3 — Consolidate
- **Merge** new signal into existing topic files (no near-duplicates)
- **Convert** relative dates → absolute dates
- **Delete** contradicted facts at source

### Phase 4 — Prune & Index
- Keep `MEMORY.md` under 200 lines AND ~25KB
- Each entry: `- [Title](file.md) — one-line hook` (<150 chars)
- Remove stale pointers
- Demote verbose entries (>200 chars → move detail to topic file)
- Resolve contradictions between files

---

## Dream vs ExtractMemories

| | Dream | ExtractMemories |
|---|---|---|
| **Trigger** | Automatic (time + session count) OR manual | Automatic (after N messages in conversation) |
| **Scope** | All sessions since last consolidation | Current conversation only |
| **Tools** | Read-only Bash + memory file writes | Only Write/Read/Edit within memory dir |
| **Goal** | Full memory refresh/prune/index | Capture recent conversation into memory |

---

## Task State Machine

```
Co7() → status: "running", phase: "starting"
  ↓
on each message → So7() → phase: "updating" (if files touched)
  ↓
Eo7() → status: "completed"
  OR
bo7() → status: "failed"
  OR
kill() → status: "killed" (aborts controller, releases lock)
```

---

## Memory File Format

```markdown
---
name: {{memory name}}
description: {{one-line description}}
type: {{user | feedback | project | reference}}
---

{{content — for feedback/project: rule/fact, then **Why:** and **How to apply:**}}
```

### Memory Types

| Type | Purpose |
|------|---------|
| `user` | Role, preferences, knowledge |
| `feedback` | What to avoid/repeat, with Why + How to apply |
| `project` | Project state, goals, initiatives |
| `reference` | Pointers to external systems |

---

## MeowKit Adaptation Plan (`meow:dream` for v1.1.1)

### What to adopt directly
- 4-phase structure (orient → gather → consolidate → prune)
- Lock file mechanism (`.consolidate-lock` with PID)
- Read-only on project code, write-only on memory files
- Merge-into-existing over create-new
- Absolute date conversion
- Index size cap (200 lines, 25KB)

### What to adapt
- **Trigger**: MeowKit doesn't have session transcript JSONL. Use session count from `memory/cost-log.json` entries instead.
- **Signal sources**: MeowKit uses `memory/lessons.md`, `memory/patterns.json`, `memory/decisions.md` instead of daily logs.
- **Execution**: Run as background subagent via analyst agent (already owns `memory/`), not as forked work session.
- **Tool constraints**: Use `disallowedTools: [Edit, Write]` on project files; allow only on `memory/` paths via hook.

### What to skip
- Telemetry events (MeowKit doesn't have telemetry infrastructure)
- `tengu_onyx_plover` setting name (use `meowkit.dream` config key)
- `cW()` fork mechanism (use Claude Code's native `Agent` tool with background flag)

### Trigger condition for MeowKit
```
IF (hours since last dream > 24) AND (sessions since last dream > 5):
  acquire lock → run meow:dream in background → release lock
```

Check trigger at: Phase 0 (Orient), after analyst loads memory.

---

## Status: Deferred to v1.2+

**Decision date:** 2026-03-31
**Reason:** YAGNI — memory files are empty (0 sessions captured). Building consolidation for an unused system is premature. The existing self-improving loop (capture → extract → promote) needs activation first, not replacement.

**What was done instead (v1.1.1):**
- Fixed `post-session.sh` to write structured NEEDS_CAPTURE markers (not HTML comment placeholders)
- Added Phase 0 retroactive capture instruction to CLAUDE.md
- Added live capture instruction before Phase 5 for "WHY" preservation
- Enriched patterns.json schema with category, severity, applicable_when (from Khuym compounding)
- Created consolidation.md reference with Khuym-style classification rubric
- Strengthened pattern-extraction promotion criteria (severity + ≥30 min savings)

**Revisit when:**
- lessons.md > 20 session entries
- patterns.json > 50 patterns
- cost-log.json > 500 entries
- Team says "our memory files are messy"

**Cross-framework analysis:** Khuym's `khuym:dream` has the strongest comparable architecture (7-phase consolidation with ambiguity resolution). GSD has session persistence but not learning extraction. CKE has L1-L5 layered memory (unimplemented beyond L2). Superpowers/gstack/BMAD have no memory consolidation.
