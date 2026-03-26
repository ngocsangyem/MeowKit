---
name: meow:scout
description: "Fast parallel codebase scouting. Spawns multiple Explore subagents to search directories simultaneously, returning a consolidated file map. Use before planning, debugging, or any task spanning multiple directories."
# Source: claudekit-engineer
# Original: .claude/skills/scout/SKILL.md
# Adapted for MeowKit:
#   - Removed external mode (Gemini/OpenCode CLI) — zero dependencies
#   - Removed TaskCreate/TaskUpdate orchestration — uses Agent tool directly
#   - Replaced sed/cat chunking with Claude Code native Read tool (offset/limit)
#   - Added concrete SCALE formula instead of vague heuristic
#   - Anchored to MeowKit Phase 0 (Orient) and Phase 1 (Plan)
#   - Added memory integration for repeat scouting
#   - Improved report format with complexity estimates and routing suggestions
---

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

## Step 1 — Analyze and Determine Scale

Parse the user's prompt. Identify search targets (keywords, file types, patterns).

**SCALE formula** — how many Explore agents to spawn:

```
1. Count top-level source directories:
   ls -d src/ lib/ app/ api/ packages/ tests/ config/ docs/ 2>/dev/null | wc -l

2. SCALE = min(directory_count, 6)
   - Minimum: 2 (below 2, a single Explore call is faster)
   - Maximum: 6 (beyond 6, context aggregation becomes expensive)

3. If monorepo (packages/ exists): SCALE = min(package_count, 6)
```

If SCALE < 2, skip parallel scouting — use a single Explore call instead.

## Step 2 — Divide Directories

Split the codebase into SCALE segments. Each segment gets one Explore agent.

**Division rules:**
- Each agent gets distinct directories — no overlap
- Group related directories together (e.g., `src/auth/` + `src/middleware/` for auth scouting)
- Tests go to a separate agent from source code
- Config/docs go to a separate agent from implementation

**Example** — "Find authentication files" in a typical project (SCALE=4):

```
Agent 1: src/auth/, src/middleware/, src/guards/     → auth implementation
Agent 2: src/api/, src/routes/, src/controllers/     → auth endpoints
Agent 3: tests/, __tests__/, *.test.ts, *.spec.ts   → auth tests
Agent 4: config/, lib/, types/, interfaces/          → auth config + types
```

## Step 3 — Spawn Parallel Explore Agents

Spawn all agents in a **single message** for parallel execution:

```
For each segment, spawn:
  subagent_type: "Explore"
  prompt: |
    Scout {DIRECTORIES} for files related to: {SEARCH_TARGET}

    Instructions:
    - Use Glob for file discovery by name patterns
    - Use Grep for content search by keywords
    - List every relevant file with: path, line count, one-sentence purpose
    - Note key patterns (naming conventions, directory structure)
    - Note dependencies between files (imports, references)
    - Time limit: stay focused, do not read entire files

    Report format:
    ## Found Files
    - `path/file.ext` (N lines) — purpose

    ## Patterns
    - Key patterns observed

    ## Dependencies
    - file A imports file B
```

**Important:**
- Each Explore agent has its own context window (~200K tokens)
- Explore agents are read-only — they cannot modify files
- Spawn ALL agents in one message, not sequentially

## Step 4 — Collect and Aggregate

After all agents return (or after 3-minute timeout per agent):

1. **Deduplicate** file paths across agent results
2. **Merge** descriptions (keep the most informative)
3. **Note gaps** — any agent that timed out or returned empty
4. **Estimate complexity** per area (file count + total lines)
5. **Suggest routing** — which MeowKit agent should handle each area

## Step 5 — Write Report

Output a structured scout report:

```markdown
# Scout Report: {SEARCH_TARGET}

## Summary
{one-sentence overview: N files found across M directories}

## File Map

### {Area 1} (N files, ~X lines total)
- `path/file.ext` (lines) — purpose
- `path/file.ext` (lines) — purpose

### {Area 2} (N files, ~X lines total)
- `path/file.ext` (lines) — purpose

## Dependencies
- `file A` → imports → `file B`
- `file C` → imports → `file D`

## Complexity Estimate
| Area | Files | Lines | Complexity |
|------|-------|-------|-----------|
| {area} | N | ~X | low/medium/high |

## Suggested Routing
- Implementation: developer agent → {files}
- Tests needed: tester agent → {test files}
- Architecture review: architect agent → {if new patterns found}

## Gaps
- {any directories not searched or agents that timed out}
```

## Reading File Content (When Needed)

If a downstream agent needs to read files found by scout, use Claude Code's native Read tool with offset/limit — not bash workarounds:

```
Small file (<500 lines):   Read(file_path)
Medium file (500-1500):    Read(file_path, limit=500) then Read(file_path, offset=500, limit=500)
Large file (>1500):        Read(file_path, offset=0, limit=500) per chunk
```

Never `cat` or `sed` for file reading. The Read tool handles encoding, permissions, and line numbers natively.

## Memory Integration

After completing a scout:
- If `.claude/memory/` exists, check for previous scout reports on similar targets
- Previous reports can accelerate re-scouting (skip unchanged directories)
- Do NOT write scout reports to memory by default — they are ephemeral task context
- Only write to memory if the user explicitly asks to save the scout results

## Constraints

- Read-only — scout NEVER modifies files
- Maximum 6 parallel agents — beyond this, aggregation cost exceeds benefit
- 3-minute timeout per agent — skip non-responders, don't retry
- No external tool dependencies — uses only Claude Code built-in Explore
- Respects MeowKit security rules — never access .env, credentials, or SSH keys during scouting
