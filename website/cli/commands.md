---
title: Runtime Commands
description: MeowKit CLI runtime commands reference.
persona: B
---

# npx mewkit commands

Runtime tools for managing your MeowKit project. Run from your project root.

## doctor

Diagnose environment issues with auto-fix for permissions.

```bash
npx mewkit doctor [--report]
```

**Checks:** Node.js 20+, Python 3.9+, Git, `.claude/` structure, hooks executable, scripts present, memory writable, MCP config, Python venv, config validity.

**Auto-fixes:** Hook file permissions (`chmod +x`).

| Flag       | Description                       |
| ---------- | --------------------------------- |
| `--report` | Print shareable diagnostic report |

## setup

Guided post-scaffold configuration. Each step is idempotent.

```bash
npx mewkit setup [--only=<step>]
```

| Step        | What it does                                                    |
| ----------- | --------------------------------------------------------------- |
| `venv`      | Creates Python venv for skill scripts at `.claude/skills/.venv` |
| `mcp`       | Copies `mcp.json.example` → `.mcp.json`                         |
| `env`       | Copies `env.example` → `.env`                                   |
| `gitignore` | Appends MeowKit entries to `.gitignore`                         |

```bash
npx mewkit setup              # Run all steps
npx mewkit setup --only=venv  # Run single step
```

## task

Create and manage structured task files. See [Task Commands](/cli/task-commands) for details.

```bash
npx mewkit task new --type feature "Add user auth"
npx mewkit task list [--all] [--status done]
```

## validate

Verify `.claude/` structure integrity.

```bash
npx mewkit validate
```

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file.

## budget

View token usage and cost tracking.

```bash
npx mewkit budget [--monthly] [--session [id]] [--day [YYYY-MM-DD]]
```

| Flag | Description |
| --- | --- |
| `--monthly` | Aggregate by month instead of showing the last 10 entries |
| `--session` | Filter to the current Claude Code session id |
| `--session <id>` | Filter to a specific session id from `cost-log.json` |
| `--day` | Filter to today using `YYYY-MM-DD` |
| `--day <date>` | Filter to a specific day in `YYYY-MM-DD` format |

**Behavior:**
- Without filters, `budget` shows the latest 10 rows and the all-time token total.
- `--session` resolves the current session from `HOOK_SESSION_ID` first, then `session-state/last-session-id`.
- `--day` without a value uses today.
- Filters compose, so `--session --day` reports the intersection.

**Examples:**

```bash
npx mewkit budget
npx mewkit budget --monthly
npx mewkit budget --session
npx mewkit budget --session 9adf6a6b-9fbf-45ca-b36b-b0dd55356ac1
npx mewkit budget --day
npx mewkit budget --day 2026-05-01
npx mewkit budget --session --day 2026-05-01
```

## memory

View or manage cross-session memory.

```bash
npx mewkit memory              # Summary (line counts, pattern count)
npx mewkit memory --show       # Display summary of topic files (fixes.md, review-patterns.md, architecture-decisions.md)
npx mewkit memory --stats      # Sessions captured, patterns learned
npx mewkit memory --clear      # Clear all memory (with confirmation)
```

## upgrade

Update mewkit to the latest version.

```bash
npx mewkit upgrade [--check] [--beta] [--list]
```

| Flag      | Description                                        |
| --------- | -------------------------------------------------- |
| `--check` | Show available update (shows both stable and beta) |
| `--beta`  | Install beta channel                               |
| `--list`  | List all available versions with channel info      |

**Examples:**

```bash
npx mewkit upgrade              # Upgrade to latest stable
npx mewkit upgrade --beta       # Upgrade to latest beta
npx mewkit upgrade --check      # Check without installing
npx mewkit upgrade --list       # Show all versions
```

**Output of `--list`:**

```
Channels:
  stable:  1.2.0
  beta:    1.3.0-beta.2

Recent versions:
  1.2.0 (installed)
  1.1.1
  1.1.0
  1.0.0
```

## status

Print version, channel, and current config.

```bash
npx mewkit status
```

Shows: MeowKit version with channel indicator (stable/beta), project config from `.claude/meowkit.config.json`.

## orchviz

Live web visualizer for the active Claude Code session. Tails the JSONL transcript at `~/.claude/projects/<encoded-cwd>/<session>.jsonl`, parses it into structured `AgentEvent`s, and serves them at `http://127.0.0.1:<port>/` as a Canvas2D + d3-force interactive graph plus a live transcript panel and MeowKit-specific overlays (Gate state, model tier, today's tokens, phase).

```bash
npx mewkit orchviz [flags]
```

### Flags

| Flag                   | Description                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `--port <number>`      | Bind to fixed port (`0` = random; default: random)                                                   |
| `--open` / `--no-open` | Auto-launch browser (default: `--open`)                                                              |
| `--session <id>`       | Pin to a single Claude Code session id                                                               |
| `--workspace <path>`   | Override watched workspace (default: cwd)                                                            |
| `--verbose`            | Print sanitized `AgentEvent`s to stderr                                                              |
| `--log [path]`         | Persist events to markdown (default: `.claude/logs/orchviz-<sid>.md`; custom path must end in `.md`) |

### Examples

```bash
# Default: random port, auto-open browser
npx mewkit orchviz

# Fixed port, don't auto-launch the browser
npx mewkit orchviz --port 3001 --no-open

# Pin to a single session id
npx mewkit orchviz --session <uuid>

# Override watched workspace
npx mewkit orchviz --workspace .

# Persist events to default log path
npx mewkit orchviz --log

# Persist events to a custom .md path
npx mewkit orchviz --log /tmp/run.md
```

### Environment Variables

| Variable                     | Effect                                                                    |
| ---------------------------- | ------------------------------------------------------------------------- |
| `MEOWKIT_ORCHVIZ_WRITABLE=1` | Opt into write mode (enables todo-toggle endpoint). Default is read-only. |
| `MEOWKIT_ORCHVIZ_READONLY=1` | Force read-only mode (defensive lock).                                    |
| `MEOWKIT_ORCHVIZ_READONLY=0` | Legacy opt-in to write mode (kept for backwards compatibility).           |

### HTTP API

The orchviz server exposes these endpoints on `http://127.0.0.1:<port>`:

**`GET /api/plans`** — list non-archived plans sorted by mtime (newest first).

```bash
curl http://127.0.0.1:3001/api/plans
# { "plans": [{ "slug": "260501-my-plan", "title": "...", "status": "draft", ... }] }
```

**`GET /api/plan?slug=<slug>`** — full plan state with per-phase ETags. Omit `?slug=` to get the most-recently-modified plan.

```bash
curl "http://127.0.0.1:3001/api/plan?slug=260501-my-plan"
# { "plan": { ... }, "phaseEtags": { "1": "<hex64>", "2": "<hex64>" }, "readonly": true }
```

**`POST /api/plan/todo`** — toggle a todo checkbox (write mode only).

```bash
MEOWKIT_ORCHVIZ_WRITABLE=1 npx mewkit orchviz   # opt in to write mode

curl -X POST http://127.0.0.1:3001/api/plan/todo \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3001" \
  -d '{"slug":"260501-my-plan","phase":1,"todoIdx":0,"checked":true,"etag":"<hex64>"}'
# 200: { "ok": true, "changed": true, "etag": "<new-hex64>" }
# 409: { "error": "stale", "currentEtag": "<latest-hex64>" }  → re-fetch and retry
# 403: Origin header missing or not in allowlist
# 405: server is in read-only mode (the default)
```

POST requests must include `Origin: http://127.0.0.1:<port>` or `Origin: http://localhost:<port>` to prevent cross-origin writes.

### Security

- Server binds `127.0.0.1` only.
- Host-header guarded against DNS rebinding.
- SSE frames sanitized: ANSI strip + strict-prefix secret scrub (`sk-…`, `ghp_…`, `AKIA…`, PEM blocks).
- Path traversal blocked on the static file server.
- Read-only by default — opt into writes explicitly via env var.

### Notes

- If the web UI bundle is missing at `dist/orchviz-web/`, run `npm run build:web` in the `mewkit` package to produce it.
- When no `.claude/` is detected from the workspace, overlays render empty but the graph still streams events.
- Closing with `Ctrl+C` prints a final event count summary before exit.

## migrate

Export your `.claude/` kit (agents, commands, skills, config, rules, hooks) to external coding-agent tools.

```bash
npx mewkit migrate <tool> [flags]
npx mewkit migrate --all
npx mewkit migrate                    # interactive multiselect
```

**Supported tools:** `cursor`, `codex`, `droid`, `opencode`, `goose`, `gemini-cli`, `antigravity`, `github-copilot`, `amp`, `kilo`, `kiro`, `roo`, `windsurf`, `cline`, `openhands`. (`claude-code` is the source format and is not a valid migration target.)

### Flags

| Flag                                            | Description                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `--all`                                         | Migrate to all 15 selectable targets in one pass                               |
| `--global`                                      | Install to user's home (`~/.cursor/`, etc.) instead of project-local paths     |
| `--yes`, `-y`                                   | Non-interactive — auto-confirm prompts                                         |
| `--dry-run`                                     | Compute and display the plan without writing any files                         |
| `--force`                                       | Overwrite user-edited target files without prompting on conflict               |
| `--source PATH`                                 | Override source `.claude/` directory (default: `CWD/.claude/` or bundled kit)  |
| `--only CSV`                                    | Restrict to listed types: `agents,commands,skills,config,rules,hooks`          |
| `--skip-config`, `--skip-rules`, `--skip-hooks` | Exclude one or more types                                                      |
| `--respect-deletions`                           | Skip items whose target was deleted by the user (default re-installs)          |
| `--reinstall-empty-dirs`                        | Re-install items even if the user emptied the target directory (default: true) |

### Model routing

`mewkit migrate` reads model routing from project config before converting agents and commands:

1. `.meowkit.config.json`
2. `.claude/meowkit.config.json` (legacy fallback)
3. Target-agent defaults when no config is present

The migration maps Claude source tiers (`opus`, `sonnet`, `haiku`) to configured target tiers (`heavy`, `balanced`, `light`). It does not ship target model IDs in code. If a provider/tier is missing, the migrated item inherits the target agent's default model.

```json
{
  "modelRouting": {
    "providers": {
      "codex": {
        "tiers": {
          "heavy": { "model": "your-codex-heavy-model", "reasoningEffort": "xhigh" },
          "balanced": { "model": "your-codex-balanced-model", "reasoningEffort": "high" },
          "light": { "model": "your-codex-light-model", "reasoningEffort": "medium" }
        }
      },
      "opencode": {
        "default": { "model": "your-provider/your-model" }
      }
    }
  }
}
```

### Capability matrix

What each selectable target accepts at runtime after MeowKit applies provider contracts. ✓ installed · — skipped by MeowKit. The runtime gate is code-driven: config paths that are not marked `documented` in `providers/{id}/contract.ts` are nulled before installation (`packages/mewkit/src/migrate/provider-overrides.ts:44-61`).

| Tool           | Agents | Commands | Skills | Config | Rules | Hooks | Evidence |
| -------------- | :----: | :------: | :----: | :----: | :---: | :---: | -------- |
| Cursor         |   —    |    —     |   —    |   ✓    |   ✓   |   —   | Cursor rules provide system-level instructions and live in rule files ([Cursor rules](https://docs.cursor.com/en/context/rules)); custom modes are UI behavior, not portable agent files ([custom modes](https://docs.cursor.com/agent/custom-modes)). |
| Codex          |   ✓    |    —     |   ✓    |   ✓    |   ✓   |   ✓   | OpenAI documents `AGENTS.md`, subagents, skills, rules, and hooks ([AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [subagents](https://developers.openai.com/codex/subagents), [skills](https://developers.openai.com/codex/skills), [rules](https://developers.openai.com/codex/rules), [hooks](https://developers.openai.com/codex/hooks)). |
| Droid          |   ✓    |    ✓     |   ✓    |   ✓    |   —   |   —   | Factory documents custom droids, slash commands, skills, and `AGENTS.md` ([custom droids](https://docs.factory.ai/cli/configuration/custom-droids), [slash commands](https://docs.factory.ai/cli/configuration/custom-slash-commands), [skills](https://docs.factory.ai/cli/configuration/skills), [AGENTS.md](https://docs.factory.ai/factory-cli/configuration/agents-md)). |
| OpenCode       |   ✓    |    ✓     |   —    |   —    |   —   |   —   | OpenCode documents agents and config; MeowKit currently enables only agents and commands by contract ([agents](https://opencode.ai/docs/agents/), [config](https://opencode.ai/docs/config)). |
| Goose          |   —    |    —     |   ✓    |   ✓    |   —   |   —   | Goose documents skills and Goosehints project context ([skills](https://goose-docs.ai/docs/guides/context-engineering/using-skills/), [Goosehints](https://goose-docs.ai/docs/guides/context-engineering/using-goosehints/)). |
| Gemini CLI     |   —    |    ✓     |   ✓    |   ✓    |   —   |   —   | Gemini CLI documents custom commands and context files; hooks are documented upstream but not yet enabled by MeowKit's contract ([custom commands](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md), [configuration](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md), [hooks reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)). |
| Antigravity    |   —    |    —     |   —    |   —    |   ✓   |   —   | Flutter's Antigravity-related AI rules docs are the only contract-enabled surface ([AI rules](https://docs.flutter.dev/ai/ai-rules)). |
| GitHub Copilot |   ✓    |    —     |   —    |   ✓    |   ✓   |   —   | GitHub documents custom agents and custom instructions ([custom agents](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents), [custom instructions](https://docs.github.com/en/copilot/reference/custom-instructions-support)). |
| Amp            |   —    |    —     |   —    |   ✓    |   —   |   —   | Amp documents agent instructions through its manual / `AGENTS.md` guidance ([manual](https://ampcode.com/manual), [AGENTS.md](https://ampcode.com/news/AGENTS.md)). |
| Kilo Code      |   —    |    —     |   —    |   —    |   —   |   —   | Kilo has provider paths in code, but no surfaces are enabled by `kilo/contract.ts`; update the contract before relying on this target ([Kilo docs](https://kilocode.ai/docs)). |
| Kiro IDE       |   ✓    |    —     |   ✓    |   ✓    |   ✓   |   —   | Kiro documents custom agents, skills, and steering; hooks are documented upstream but not yet migrated ([custom agents](https://kiro.dev/docs/cli/custom-agents/), [skills](https://kiro.dev/docs/skills/), [steering](https://kiro.dev/docs/steering/), [hooks](https://kiro.dev/docs/hooks/)). |
| Roo Code       |   —    |    —     |   —    |   —    |   —   |   —   | Roo is deprecated in MeowKit and has no contract-enabled surfaces; first-party docs document modes, instructions, and skills ([custom modes](https://docs.roocode.com/features/custom-modes), [custom instructions](https://docs.roocode.com/features/custom-instructions), [skills](https://docs.roocode.com/features/skills)). |
| Windsurf       |   —    |    ✓     |   ✓    |   ✓    |   ✓   |   —   | Windsurf documents workflows, skills, memories/rules, and `AGENTS.md` ([workflows](https://docs.windsurf.com/windsurf/cascade/workflows), [skills](https://docs.windsurf.com/windsurf/cascade/skills), [memories](https://docs.windsurf.com/windsurf/cascade/memories), [AGENTS.md](https://docs.windsurf.com/ro/windsurf/cascade/agents-md)). |
| Cline          |   —    |    —     |   ✓    |   —    |   ✓   |   —   | Cline documents rules and skills; hooks and slash commands are documented upstream but not yet enabled by MeowKit's contract ([rules](https://docs.cline.bot/features/cline-rules), [skills](https://docs.cline.bot/customization/skills), [hooks](https://docs.cline.bot/features/hooks/hook-reference), [slash commands](https://docs.cline.bot/features/slash-commands/new-task)). |
| OpenHands      |   —    |    —     |   —    |   —    |   —   |   —   | OpenHands has provider paths in code, but no surfaces are enabled by `openhands/contract.ts`; repository customization is documented upstream ([repository customization](https://docs.openhands.dev/openhands/usage/customization/repository)). |

**Known limitations:**

- Code-declared provider paths are not enough to make a surface migrate: MeowKit disables every surface whose provider contract is not marked `documented` (`packages/mewkit/src/migrate/provider-overrides.ts:44-61`).
- Kilo Code, Roo Code, and OpenHands currently have no contract-enabled runtime surfaces, even though first-party docs document some corresponding concepts. Treat those targets as placeholders until their contracts are updated.
- Gemini CLI hooks, Droid rules/hooks, Kiro hooks, Cline hooks/commands, and OpenCode config are documented upstream but are not enabled by the current contracts.
- Codex command migration is disabled intentionally: OpenAI documents built-in slash/app commands, not a custom command directory for portable command files ([Codex slash commands](https://developers.openai.com/codex/cli/slash-commands)).
- Codex rules in OpenAI's docs are exec-policy `.rules` files. MeowKit behavioral rules migrate into `AGENTS.md`; they are not converted into sandbox exec-policy rules.
- Shell hooks (`.sh`/`.ps1`/`.bat`/`.cmd`/`.py`) are filtered at discovery — only node-runnable hooks (`.cjs`/`.mjs`/`.js`/`.ts`) migrate (`packages/mewkit/src/migrate/discovery/hooks-discovery.ts:7-33`).

### Examples

```bash
# Preview before any writes
npx mewkit migrate cursor --dry-run

# Single tool, project scope
npx mewkit migrate cursor

# Multi-tool batch (uses interactive picker if TTY)
npx mewkit migrate

# All 15 selectable targets, non-interactive (CI-friendly)
npx mewkit migrate --all --yes

# Global install scope
npx mewkit migrate codex --global

# Restrict scope to specific types
npx mewkit migrate cursor --only=skills,rules
npx mewkit migrate codex --skip-hooks

# Force overwrite user edits
npx mewkit migrate cursor --force
```

### Idempotency

mewkit tracks every installation in `~/.mewkit/portable-registry.json` with SHA-256 source + target checksums. Re-running `migrate` reconciles per file:

- Source unchanged + target unchanged → **skip**
- Source changed + target unchanged → **update**
- Source unchanged + target edited by user → **skip** (preserves your edits)
- Source changed + target edited by user → **conflict** (interactive prompt)
- Source removed + registry entry exists → **delete**
- Brand new item → **install**

A `mewkit upgrade` followed by `mewkit migrate cursor` propagates kit updates to Cursor without losing local edits.

### Exit codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 0    | Success                                                      |
| 1    | Partial failure (one or more items failed; others succeeded) |
| 2    | Invalid flags or unknown tool name                           |
| 130  | User cancelled (Ctrl+C during interactive prompt)            |

### Concurrent invocations

A PID-based file lock at `SCOPE/.mewkit/.lock` blocks two `mewkit migrate` runs from racing on the same registry. Stale locks (dead PID) are auto-cleared after 60 seconds.

## init --migrate (one-shot scaffold + export)

`mewkit init` accepts three migrate-related flags so you can scaffold AND export in a single command.

```bash
# Interactive picker after kit unpacks
npx mewkit init --migrate

# Pre-set tools, no picker
npx mewkit init --migrate-to cursor,codex,droid

# All 15 selectable targets
npx mewkit init --migrate-to all

# Global install scope
npx mewkit init --migrate-to cursor --migrate-global
```

| Flag                      | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| `--migrate`               | After unpack, prompt for providers via interactive multiselect (TTY required) |
| `--migrate-to <csv\|all>` | After unpack, export to listed providers (`cursor,codex` or `all`)            |
| `--migrate-global`        | Use global install paths (`~/.cursor/`, etc.) instead of project-local        |

**Behavior:**

- Migration runs after kit unpacks successfully — failures don't roll back the kit install. If migration fails, init still completes; re-run `mewkit migrate` to retry.
- Init uses the same orchestrator, registry, and reconciler as the standalone `migrate` command. Idempotent re-runs work the same way.
- `--migrate-to` implies `--yes` (non-interactive), so it's safe to use in CI scripts.
