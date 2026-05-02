---
title: "mk:scout"
description: "mk:scout"
---

## What This Skill Does

`mk:scout` performs fast, parallel codebase exploration by spawning up to 6 read-only Explore subagents to search multiple directories simultaneously. It returns a consolidated report with an architecture fingerprint, file map, complexity estimates, and routing suggestions. The report is capped at 2,000 tokens to preserve downstream agent context.

## When to Use

- Starting a feature that spans multiple directories
- Before planning (Phase 1) on complex tasks — understand what exists first
- Debugging sessions requiring file relationship understanding
- User asks about project structure or where functionality lives
- User asks to "find", "locate", or "search for" files

## Core Capabilities

### 3-Tier Search Scope

**Tier 1 — ALWAYS scan (high signal, low cost):**
`src/`, `lib/`, `app/`, `api/`, `packages/`, `config/`, `types/`, `interfaces/`, and root config files (`package.json`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`). Every scout run includes Tier 1. No exceptions.

**Tier 2 — SCAN ON REQUEST (medium cost, task-dependent):**
`tests/`, `__tests__/`, `spec/`, `e2e/`, `docs/`, `scripts/`, `tools/`, `infra/`, `migrations/`, `seeds/`, `fixtures/`, `.github/`, `.gitlab/`, `ci/`. Include only when query mentions tests, docs, CI, migrations, or infrastructure.

**Tier 3 — NEVER scan (noise, always excluded):**
`node_modules/`, `vendor/`, `.pnpm-store/`, `dist/`, `build/`, `.next/`, `.nuxt/`, `.output/`, `coverage/`, `.cache/`, `.turbo/`, `.vercel/`, `.terraform/`, `__pycache__/`, `.venv/`, `venv/`, `.tox/`, `.mypy_cache/`, `.git/`, `*.min.js`, `*.min.css`, `*.map`, binary assets (`.png`, `.jpg`, `.gif`, `.svg`, `.ico`, `.woff`, `.wasm`, `.so`, `.dylib`, `.dll`, `.exe`). Excluded regardless of task. No exceptions.

**Rationale:** A single `node_modules/` scan can consume an Explore agent's entire 200K context window with zero useful information.

### SCALE Formula

```
1. Count top-level source directories (Tier 1 + applicable Tier 2)
2. SCALE = min(directory_count, 6)
3. Minimum: 2 (below 2, use a single Explore call)
4. Maximum: 6 (beyond 6, aggregation cost exceeds benefit)
5. If monorepo (packages/ exists): SCALE = min(package_count, 6)
```

### Directory Division Rules

- Each agent gets distinct directories — no overlap
- Group related directories together (e.g., `src/auth/` + `src/middleware/` for auth scouting)
- Tests go to a separate agent from source code
- Config/docs go to a separate agent from implementation
- Apply Tier rules: Tier 1 always, Tier 2 if task-relevant, never Tier 3

### Constraints

- **Read-only** — NEVER modifies files
- **Maximum 6 parallel agents** — beyond this, aggregation cost exceeds benefit
- **3-minute timeout per agent** — skip non-responders, don't retry
- **No external tool dependencies** — uses only Claude Code built-in Explore
- **Security** — never access .env, credentials, or SSH keys
- **Tier 3 always excluded** — no exceptions regardless of task

### Report Structure (2,000 token budget)

```
## Scout Report: {SEARCH_TARGET}
**Scanned:** {timestamp} | {N} directories | SCALE={N}
**Entry points:** top 5 key files

### Architecture Fingerprint (5 lines max)
Framework, Language, Pattern, Monorepo, Testing — derived from config files

### Key Directories
One line per directory — purpose + file count

### Files Relevant to: {SEARCH_TARGET}
Only files directly relevant — path, line count, purpose

### Dependencies
Cross-file dependencies relevant to the task

### Patterns Found
Naming conventions, architecture patterns, anti-patterns

### Complexity Estimate
Per-area: files, lines, complexity (low/medium/high)

### Handoff
Next agent, action, key files to read first

### Gaps
Directories not searched, agents that timed out
```

If scan results exceed budget: drop Tier 2 listings first, collapse small areas, summarize file lists. Keep Architecture Fingerprint, Entry Points, and Handoff at full detail.

### Handoff Protocol

| Invoked during | Hand off to | Message |
|----------------|-------------|---------|
| Phase 0 (Orient) | planner | "Plan implementation for {TARGET} using these {N} files" |
| Phase 1 (Plan) | planner | "Here's the codebase map for {TARGET}" |
| Phase 3 (Build) | developer | "Key files to read first: {top 3 paths}" |
| Any phase — architecture concern | architect | "Review architecture for {concern}" |

### Memory Integration

- **Read** `.claude/memory/codebase-map.md` before scouting if it exists — previous scouts can accelerate re-scouting
- **Do NOT write by default** — scout reports are ephemeral and become stale quickly
- **Write only on explicit request** — user says "save this scout" or "remember this structure"
- **What to save:** Architecture Fingerprint + Key Directories only (not the full task-specific file map)

## Workflow

1. **Analyze** — Parse user prompt, identify search targets (keywords, file types, patterns)
2. **Determine scale** — Calculate SCALE using the formula. If SCALE < 2, skip parallel scouting
3. **Apply search scope** — Include Tier 1 always, Tier 2 if task-relevant, exclude Tier 3 always
4. **Divide directories** — Assign each Explore agent a distinct scope (no overlap)
5. **Spawn agents** — All in a single message for parallel execution. Each gets the search target and a structured prompt with Glob/Grep instructions
6. **Collect results** — Deduplicate, merge descriptions (keep most informative), note gaps/timeouts
7. **Build report** — Fill the structured template. Detect architecture fingerprint from root configs. Cap at 2,000 tokens
8. **Execute handoff** — Route to next agent per handoff protocol

## Usage

```bash
/mk:scout authentication          # Find all auth-related files
/mk:scout database migrations     # Find DB migration files
/mk:scout [any search target]     # Parallel search across codebase
```

## Example Prompt

```
User: /mk:scout authentication

Scout process:
1. Search target: "authentication" — keywords: auth, login, session, token, OAuth
2. SCALE calculation: src/ lib/ app/ api/ config/ = 5 dirs → SCALE = 4
3. Tier 2 trigger: include tests/ (auth tests may exist)

Agent 1: src/auth/, src/middleware/, src/guards/     → auth implementation
Agent 2: src/api/, src/routes/, src/controllers/     → auth endpoints
Agent 3: tests/, __tests__/, *.test.ts, *.spec.ts   → auth tests (Tier 2)
Agent 4: config/, lib/, types/, interfaces/          → auth config + types

Report output includes architecture fingerprint, key directories,
all auth-relevant files with line counts, and handoff to planner.
```

## Common Use Cases

- **Pre-planning exploration** — orchestrator invokes scout before planner on COMPLEX tasks
- **Unfamiliar codebase navigation** — developer invokes scout when touching unknown areas
- **Finding where functionality lives** — user asks "where is the authentication logic?"
- **Debugging spanning multiple modules** — understand file relationships before fixing

## Pro Tips

- The 6-agent cap is intentional — scout uses read-only Explore subagents which don't produce write conflicts. This is distinct from the 3-agent parallel execution rule for write-capable agents.
- Scout reports are ephemeral by design — don't save them to memory unless explicitly asked. Fresh scouts are cheap (30-60 seconds).
- For large files found by scout, downstream agents should use `Read(file_path, offset, limit)` — never `cat` or `sed`.
- Subagents may return truncated output if context window exceeded. Set explicit file count limits per subagent and merge results with dedup.
- Include dotfiles explicitly when scanning config directories — default glob patterns skip them.