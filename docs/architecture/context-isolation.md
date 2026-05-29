---
title: "Context Isolation Architecture"
version: "1.0.0"
status: "draft"
updated: "2026-05-15"
---

# MeowKit Context Isolation Architecture

MeowKit is an **outer harness** — it sits on top of inner coding agents (Claude Code, Codex, Gemini CLI, OpenHands). This document defines how context flows through MeowKit, where isolation boundaries exist, and what mechanisms enforce them.

## Outer vs. Inner Harness

| Role          | System                   | Responsibility                                                   |
| ------------- | ------------------------ | ---------------------------------------------------------------- |
| Outer harness | MeowKit                  | Workflow orchestration, rule injection, memory, hooks, skills    |
| Inner harness | Claude Code, Codex, etc. | File edits, tool calls, LLM execution, context window management |

MeowKit controls what context is **injected** at session boundaries. It cannot control what the inner harness retains or compresses within its context window. All isolation mechanisms must respect this constraint.

**Critical constraint:** MeowKit deliberately leaves `SubagentStart`/`SubagentStop` hooks empty — wiring them would cause infinite recursion inside subagents. All subagent isolation is prompt-protocol-based.

## Context Injection Points

### 1. SessionStart (once per session)

| Source                      | Content                             | Token estimate | Cap                   |
| --------------------------- | ----------------------------------- | -------------- | --------------------- |
| `project-context-loader.sh` | `docs/project-context.md`           | ~500–3000t     | 12KB warn, 24KB error |
| `project-context-loader.sh` | `.claude/memory/preferences.md`     | ≤1000t         | 4096B hard cap        |
| `project-context-loader.sh` | Directory tree (depth 2)            | ~80t           | 30 lines              |
| `project-context-loader.sh` | Tool availability + package scripts | ~100t          | 10 scripts            |
| `orientation-ritual.cjs`    | Checkpoint context (resume only)    | ~100t          | Fixed schema          |

### 2. UserPromptSubmit (every user message)

| Source                          | Content                    | Token estimate | Cap            |
| ------------------------------- | -------------------------- | -------------- | -------------- |
| `conversation-summary-cache.sh` | Prior conversation summary | ≤1000t         | 4096B hard cap |

### 3. Agent-detector (every message, step 0)

| Step    | Action                      | Files                                                                                                   | Optimization                        |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Step 0  | Verify 5 safety rules exist | `security-rules.md`, `injection-rules.md`, `gate-rules.md`, `core-behaviors.md`, `development-rules.md` | Session sentinel skips on turns 2-N |
| Step 0b | Load 4 phase-zero rules     | `phase-contracts.md`, `agent-routing.md`, `model-selection-rules.md`, `scale-adaptive-rules.md`         | Session sentinel skips on turns 2-N |

### 4. On-demand (skills + orchestration)

Skills load step files JIT (one step at a time). Memory topic files load per-skill "Load memory" instruction. Subagents receive only what the orchestrator explicitly passes.

## Isolation Boundaries

| Boundary              | Level           | Pass                                               | Do NOT pass                                                       |
| --------------------- | --------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Session → Subagent    | Prompt-only     | Task + file paths + acceptance criteria + plan ref | Session history, conversation context, CLAUDE.md contents         |
| Orchestrator → Worker | Slim brief      | Specific subtask + relevant files + output format  | Full plan, other workers' results, orchestrator's reasoning chain |
| Plan → Phase          | Phase file path | Path to `phase-XX-*.md`                            | Full `plan.md` + other phase files                                |
| Memory → Subagent     | Named files     | Specific topic file paths needed for the task      | Entire `.claude/memory/` directory                                |
| Workflow → Step       | Step file (JIT) | Current step content only                          | Prior step files, `workflow.md`, full `SKILL.md`                  |

## Existing Mechanisms (What Works)

**Strong:**

- `conversation-summary-cache.sh`: raw transcript → background Haiku summary → ≤4KB injection per turn. Best context management in MeowKit.
- `orientation-ritual.cjs`: ~100-token checkpoint recovery on resume (not full transcript re-injection).
- Step-file JIT architecture: workflow steps load one at a time; never bulk-loaded.
- Memory tombstone: auto-inject memory pipeline removed (v2.4.0); memory is on-demand per skill.
- `session-state/` lifecycle: root-level runtime files are cleared on session ID change.

**Moderate:**

- Orchestration prompt template: documented delegation checklist with named anti-patterns.
- `gate-enforcement.sh` + `privacy-block.sh`: block access to sensitive files/dirs before they enter context.
- Build-verify cache: file-hash cache skips re-running build on unchanged files.

## Subagent Delegation Protocol

Use `mk:spawn` to assemble a context-isolated subagent prompt. The command enforces the isolation boundary by construction — it outputs a prompt that contains only what the subagent needs.

```
/mk:spawn [task description]
```

**Anti-patterns (from orchestration-rules.md):**

| Bad                                   | Good                                         |
| ------------------------------------- | -------------------------------------------- |
| "Continue from where we left off"     | "Implement X per spec in phase-02.md"        |
| "Fix the issues we discussed"         | "Fix null check in auth.ts:45"               |
| "Look at the codebase and figure out" | "Read src/api/routes.ts and add POST /users" |
| Passing 50+ lines of conversation     | 5-line task summary with file paths          |

## Inner Harness Compatibility

| Harness     | Task tool  | Rules auto-injected                           | SubagentStart hook  |
| ----------- | ---------- | --------------------------------------------- | ------------------- |
| Claude Code | Agent tool | CLAUDE.md + `.claude/rules/` (platform-level) | Intentionally empty |
| Codex       | Agent tool | AGENTS.md (32KB hard cap)                     | Not supported       |
| Gemini CLI  | Varies     | `gemini.md`                                   | Not supported       |
| OpenHands   | Varies     | May not honor CLAUDE.md                       | Not supported       |

For non–Claude Code inner harnesses: do NOT assume rule files are auto-loaded into subagent context. Pass required rule content explicitly in the Task prompt when needed. Keep spawn prompts under 32KB to stay within Codex's AGENTS.md cap.

Provider artifact roots are intentionally separate: Claude Code uses `.claude/`, Codex uses `.codex/`, Gemini CLI uses `.gemini/`, and portable skills may use `.agents/skills/` where that provider has a documented skill surface. MeowKit does not create a project-local `.mewkit/` runtime directory for these installs.

## Rejected Patterns

These approaches were explicitly evaluated and rejected:

| Pattern                                           | Reason                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| SubagentStart hook for context injection          | Infinite-loop inside subagents — documented platform constraint           |
| PreToolUse:Task hook to validate subagent prompts | Violates outer-harness principle; blocks legitimate Task calls            |
| Per-task memory namespaces                        | Requires database infrastructure; plan directory already serves this role |
| Vector embedding of conversation history          | Requires external infra; over-engineering for a workflow harness          |
| Proactive context restart at 60-70% window        | MeowKit cannot measure inner harness context window fill                  |
| "AI OS" unified context abstraction layer         | Unmaintainable union-of-all-APIs; violates KISS                           |
| SUBAGENT-STOP marker on skills                    | No runtime mechanism to detect "inside subagent" without a hook           |

## Memory Lifecycle

Memory topic files in `.claude/memory/` have a 90-day automated pruning policy:

- `post-session.sh` runs pruning on Stop (daily rate-limit via `session-state/last-prune-date`)
- Only entries with ISO 8601 date markers in headers are pruned
- Entries without date markers are preserved (require manual review)
- Pruned entries logged to `.claude/memory/pruned-log.md`
- Override: `MEOWKIT_MEMORY_PRUNE=off` / `MEOWKIT_MEMORY_PRUNE_AGE_DAYS=N`

## Env Var Reference

| Variable                            | Default | Effect                                               |
| ----------------------------------- | ------- | ---------------------------------------------------- |
| `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` | `12288` | project-context.md size warn threshold; `0` disables |
| `MEOWKIT_SKIP_SAFETY_SENTINEL`      | `on`    | Set `off` to always run agent-detector 9-file check  |
| `MEOWKIT_MEMORY_PRUNE`              | `on`    | Set `off` to disable auto-pruning                    |
| `MEOWKIT_MEMORY_PRUNE_AGE_DAYS`     | `90`    | Days before memory entries are pruned                |
| `MEOWKIT_SUMMARY_CACHE`             | `on`    | Set `off` to disable conversation summary injection  |

## See Also

- `orchestration-rules.md` — delegation template, isolation boundaries, anti-patterns
- `harness-rules.md` Rule 11 — conversation-summary-cache write protocol
- `development-rules.md` — tool output limits (Glob 50, Grep 20, Read offset+limit)
- `docs/memory-system.md` — memory system overview and tombstone history
