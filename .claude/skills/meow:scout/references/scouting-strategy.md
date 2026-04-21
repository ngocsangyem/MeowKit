# Scouting Strategy — Scale, Division, and Execution

Load this reference during **Steps 2, 4, 5** of the scout process.

## Contents

- [Step 2 — Determine Scale](#step-2-determine-scale)
- [Step 4 — Divide Directories](#step-4-divide-directories)
- [Step 5 — Spawn Parallel Explore Agents](#step-5-spawn-parallel-explore-agents)
- [Step 6 — Collect and Aggregate](#step-6-collect-and-aggregate)
- [Reading File Content (When Needed)](#reading-file-content-when-needed)
- [Architecture Fingerprint Detection](#architecture-fingerprint-detection)


## Step 2 — Determine Scale

Parse the user's prompt. Identify search targets (keywords, file types, patterns).

**SCALE formula** — how many Explore agents to spawn:

```
1. Count top-level source directories (Tier 1 + applicable Tier 2):
   ls -d src/ lib/ app/ api/ packages/ tests/ config/ docs/ 2>/dev/null | wc -l

2. SCALE = min(directory_count, 6)
   - Minimum: 2 (below 2, a single Explore call is faster)
   - Maximum: 6 (beyond 6, context aggregation becomes expensive)

3. If monorepo (packages/ exists): SCALE = min(package_count, 6)
```

If SCALE < 2 → skip parallel scouting, use a single Explore call instead.

## Step 4 — Divide Directories

Split the codebase into SCALE segments. Each segment gets one Explore agent.

**Division rules:**

- Each agent gets distinct directories — **no overlap**
- Group related directories together (e.g., `src/auth/` + `src/middleware/` for auth scouting)
- Tests go to a separate agent from source code
- Config/docs go to a separate agent from implementation
- **Apply Tier rules:** assign only Tier 1 dirs by default. Add Tier 2 if task requires. Never assign Tier 3.

**Example** — "Find authentication files" in a typical project (SCALE=4):

```
Agent 1: src/auth/, src/middleware/, src/guards/     → auth implementation
Agent 2: src/api/, src/routes/, src/controllers/     → auth endpoints
Agent 3: tests/, __tests__/, *.test.ts, *.spec.ts   → auth tests (Tier 2 — included because auth needs test verification)
Agent 4: config/, lib/, types/, interfaces/          → auth config + types
```

**Example** — "Understand project structure" (SCALE=3):

```
Agent 1: src/                    → main application code
Agent 2: lib/, packages/         → shared libraries
Agent 3: config/, types/         → configuration + type definitions
```

## Step 5 — Spawn Parallel Explore Agents

Spawn **all agents in a single message** for parallel execution:

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
    - Identify entry points (main.ts, index.ts, app.py, server.ts, etc.)
    - Time limit: stay focused, do not read entire files

    Report format:
    ## Found Files
    - `path/file.ext` (N lines) — purpose

    ## Entry Points
    - `path/main.ts` — application entry

    ## Patterns
    - Key patterns observed

    ## Dependencies
    - file A imports file B
```

**Important:**

- Each Explore agent has its own context window (~200K tokens)
- Explore agents are **read-only** — they cannot modify files
- Spawn ALL agents in one message, not sequentially
- Include the search target in every agent's prompt so they know what's relevant

## Step 6 — Collect and Aggregate

After all agents return (or after 3-minute timeout per agent):

1. **Deduplicate** file paths across agent results
2. **Merge** descriptions (keep the most informative)
3. **Note gaps** — any agent that timed out or returned empty
4. **Build architecture fingerprint** — detect from root configs (package.json, tsconfig, etc.)
5. **Collect entry points** from all agent results
6. **Detect architectural patterns** — MVC, layered, feature-based, monorepo
7. **Estimate complexity** per area (file count + total lines)
8. **Suggest routing** — which agent should handle each area

## Reading File Content (When Needed)

If a downstream agent needs to read files found by scout, use Claude Code's native Read tool with offset/limit — not bash workarounds:

```
Small file (<500 lines):   Read(file_path)
Medium file (500-1500):    Read(file_path, limit=500) then Read(file_path, offset=500, limit=500)
Large file (>1500):        Read(file_path, offset=0, limit=500) per chunk
```

Never `cat` or `sed` for file reading. The Read tool handles encoding, permissions, and line numbers natively.

## Architecture Fingerprint Detection

After agent results are collected, build a 5-line architecture fingerprint by checking:

```
1. Framework → read package.json dependencies (next, vue, express, etc.)
                or pyproject.toml (django, fastapi, flask)
                or go.mod (gin, echo, fiber)
2. Language  → dominant file extensions from agent results
3. Pattern   → directory structure (app/ = App Router, pages/ = Pages Router,
                src/controllers/ = MVC, src/features/ = feature-based)
4. Monorepo  → packages/ or workspaces in package.json
5. Testing   → jest.config, vitest.config, pytest.ini, etc.
```

This gives the planner and architect structural context without them having to re-derive it from raw file lists.