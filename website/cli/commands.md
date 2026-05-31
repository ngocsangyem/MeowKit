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
npx mewkit doctor [--report] [--hard-gates] [--providers] [--state]
```

**Checks:** Node.js 20+, Python 3.9+, Git, `.claude/` structure, hooks executable, scripts present, memory writable, MCP config, Python venv, config validity.

**Auto-fixes:** Hook file permissions (`chmod +x`).

| Flag | Description |
| ---- | ----------- |
| `--report` | Print shareable diagnostic report |
| `--hard-gates` | Live-probe the plan, privacy, and injection hard gates through the configured hook path |
| `--providers` | Include provider contract diagnostics |
| `--state` | Include state taxonomy diagnostics |

`--hard-gates` is the release-grade check for gate enforcement. It verifies the same hook wiring the product uses, including exit codes and block markers.

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
npx mewkit validate [--strict]
npx mewkit validate --workflow
npx mewkit validate --ownership
npx mewkit validate --packs
npx mewkit validate --portable
```

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file.

| Flag | Description |
| ---- | ----------- |
| `--strict` | Treat warnings as failures |
| `--workflow` | Run only the `.claude/workflow.yaml` drift check |
| `--ownership` | Run only artifact ownership coverage for agents, skills, rules, hooks, and commands |
| `--packs` | Run only pack-manifest coherence and pack safety checks |
| `--portable` | Include provider portability contract checks |

Default validation is resilient for normal projects. Scoped validation is stricter and is the better choice for CI or release review of a specific surface.

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

### Context budget

Estimate loadable context by profile.

```bash
npx mewkit budget context
npx mewkit budget context --profile core
npx mewkit budget context --profile full --fail-over 120000
```

Use `--fail-over <N>` in CI when a profile has a hard token budget.

## inventory

List shipped harness artifacts and governance metadata.

```bash
npx mewkit inventory
npx mewkit inventory --json
npx mewkit inventory --check
npx mewkit inventory --stale
npx mewkit inventory --critical
npx mewkit inventory --portable-missing
npx mewkit inventory --unused
npx mewkit inventory --rarely-used --threshold 2 --since 30d
```

| Flag | Description |
| ---- | ----------- |
| `--json` | Emit machine-readable inventory |
| `--check` | Fail when README or index counts drift from actual artifacts |
| `--stale` | Show deprecated or experimental artifacts |
| `--critical` | Show only critical artifacts |
| `--portable-missing` | Show artifacts without runtime portability coverage |
| `--unused` | Show artifacts with no usage evidence |
| `--rarely-used` | Show artifacts below the usage threshold |
| `--threshold <N>` | Usage count threshold for `--rarely-used` |
| `--since <Nd|Nh>` | Usage lookback window |

Usage analysis is evidence-based. Until usage emitters exist for a class of artifact, `--unused` and `--rarely-used` report `N/A` instead of pretending static metadata proves usage.

## pack

Manage installed profile packs after scaffold or upgrade.

```bash
npx mewkit pack list
npx mewkit pack add atlassian
npx mewkit pack remove atlassian
npx mewkit pack suggest-prune
```

`pack add` installs files for the requested pack and must not delete existing user files. `pack remove` deletes only pristine, pack-exclusive files; shared files, base safety files, settings-referenced files, and user-edited files are preserved.

`pack suggest-prune` is report-only. It never deletes files.

## memory

View or manage cross-session memory.

```bash
npx mewkit memory              # Summary (line counts, pattern count)
npx mewkit memory --show       # Display summary of topic files (fixes.md, review-patterns.md, architecture-decisions.md)
npx mewkit memory --stats      # Sessions captured, patterns learned
npx mewkit memory --clear      # Clear all memory (with confirmation)
npx mewkit memory conflicts    # Surface contradictory entries
npx mewkit memory compact      # Dry-run exact duplicate compaction
npx mewkit memory archive --older-than 90d
```

JSON memory stores are canonical. Markdown views are generated from JSON. `conflicts` surfaces contradictions for review instead of silently merging them.

## reflect

Summarize recent harness evidence from the canonical trace log.

```bash
npx mewkit reflect
npx mewkit reflect --last 7d
npx mewkit reflect --task TASK-123
```

Task filtering only applies to workflow events whose payload includes `data.task`. Gate, privacy, and hook events are not task-tagged today.

## health

Show a one-command harness control panel.

```bash
npx mewkit health
npx mewkit health --last 24h
```

Health combines hard-gate status, inventory, stale-index checks, context budget, memory health, provider portability, and event-derived failure counts. Hook failures are counted as events, not reported as a rate with an undefined denominator.

## simulate

Run declarative gate scenarios against a temporary harness.

```bash
npx mewkit simulate --all
npx mewkit simulate --all --allow-skip
npx mewkit simulate --scenario gate-plan-required
```

Scenario results are `PASS`, `FAIL`, or `SKIP`. `SKIP` means the scenario did not apply to the current project or provider. It is useful information, but it is not a pass unless you explicitly use `--allow-skip` for an advisory sweep.

## evolve

Proposal-only harness evolution from the canonical trace log.

```bash
npx mewkit evolve suggest
npx mewkit evolve suggest --json --last 30d
npx mewkit evolve report --out plans/reports/evolution-report.md
```

`evolve` consumes event clusters, repeated review failures, malformed trace rows, memory signals, and pack signals when available. It returns suggestions with evidence, confidence, impact, and risk. Suggestions are never auto-applied.

Useful suggestion types include rule edits, skill split/merge candidates, hook tests, pack pruning, and new regression scenarios.

## portability

Provider capability matrix built from checked-in provider contracts.

```bash
npx mewkit portability matrix
npx mewkit portability explain codex
npx mewkit portability coverage --json
```

Unsupported or disabled provider surfaces are rendered honestly, not counted as passing coverage. Use `matrix` for the full table, `explain <provider>` for one provider, and `coverage` for summary health.

## policy

Explain or set explicit gate policy profiles.

```bash
npx mewkit policy explain
npx mewkit policy set strict
npx mewkit policy set lightweight --yes
```

Profiles tune gate strictness. Missing policy keeps legacy behavior. Malformed policy fails safe as strict. Privacy and prompt-injection blocking are never disabled by policy.

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
| `--all`                                         | Migrate to all 15 supported tools in one pass                                  |
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

What each tool emits at runtime. ✓ migrated · — not migrated.

The matrix reflects what `mewkit migrate` actually writes per provider. Each provider's contract (`providers/{id}/contract.ts`) declares which surfaces are first-party documented; surfaces not in that contract are nulled by the runtime disable loop, even if `config.ts` declares a path for them. See "Known limitations" below for documented-upstream surfaces that the runtime currently skips.

| Tool                     |   Agents   | Commands | Skills | Config | Rules | Hooks |
| ------------------------ | :--------: | :------: | :----: | :----: | :---: | :---: |
| Cursor                   |     —      |    —     |   —    |   ✓    |   ✓   |   —   |
| Codex                    |     ✓      |    —     |   ✓    |   ✓    |   ✓   |   ✓   |
| Droid                    |     ✓      |    ✓     |   ✓    |   ✓    |   —   |   —   |
| OpenCode                 |     ✓      |    ✓     |   —    |   —    |   —   |   —   |
| Goose                    |     —      |    —     |   ✓    |   ✓    |   —   |   —   |
| Gemini CLI               |     —      |    ✓     |   ✓    |   ✓    |   —   |   —   |
| Antigravity              |     —      |    —     |   —    |   —    |   ✓   |   —   |
| GitHub Copilot           |     ✓      |    —     |   —    |   ✓    |   ✓   |   —   |
| Amp                      |     —      |    —     |   —    |   ✓    |   —   |   —   |
| Kilo Code [unverified]   |     —      |    —     |   —    |   —    |   —   |   —   |
| Kiro IDE                 |     ✓      |    —     |   ✓    |   ✓    |   ✓   |   —   |
| Roo Code [deprecated]    |     —      |    —     |   —    |   —    |   —   |   —   |
| Windsurf                 |     —      |    ✓     |   ✓    |   ✓    |   ✓   |   —   |
| Cline                    |     —      |    —     |   ✓    |   —    |   ✓   |   —   |
| OpenHands                |     —      |    —     |   —    |   —    |   —   |   —   |

**Notes:**

- Codex command migration is disabled until OpenAI documents a custom command directory. Codex's documented slash/app commands remain built in to Codex itself.
- Codex rules in OpenAI's docs are exec-policy `.rules` files. MeowKit behavioral rules migrate into `AGENTS.md`; they are not converted into sandbox exec-policy rules.
- Hooks: only Codex migrates hooks. Other providers' hook surfaces are documented upstream but currently disabled — see "Known limitations".
- Shell hooks (`.sh`/`.ps1`/`.bat`) are filtered at discovery — only node-runnable hooks (`.cjs`/`.mjs`/`.js`) migrate.
- Kilo Code is `[unverified]` — config paths are ported verbatim from upstream but no real install was tested; the contract is empty and migration emits nothing.
- Roo Code is `[deprecated]` — upstream announced product shutdown effective May 15, 2026; the contract is empty and migration emits nothing even with `--force`.

### Known limitations

The runtime is **contract-driven, not config-driven**. A provider's `config.ts` may declare file paths and converter formats for a surface, but unless that surface is listed in the provider's `contract.ts` `surfaces` field, the runtime disable loop nulls it before installation. This is intentional — it guarantees that only surfaces with verified first-party documentation are migrated. The trade-off: some surfaces are documented upstream but not yet enabled in the contract.

**Providers whose contracts are intentionally empty (migration emits nothing):**

- **Kilo Code** — config declares modes/skills/rules/instructions paths, but the contract is empty. The adapter is kept for compatibility; converter output has not been verified against a real Kilo install. Migration emits nothing until the contract is populated.
- **Roo Code** — upstream shut down on May 15, 2026. The contract is empty by design even though `--force` allows selecting Roo as a target.
- **OpenHands** — config declares paths, but no first-party portable-surface contract has been verified. Migration emits nothing.

**Documented upstream but not yet enabled in the contract:**

- **Gemini CLI hooks** — Gemini documents hooks via `.gemini/settings.json` (`https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md`), and a converter (`gemini-hook-event-map.ts`) exists, but the contract currently disables this surface. Hook migration is limited to Codex.
- **Droid rules and hooks** — Factory documents `.factory/rules/` (`https://docs.factory.ai/guides/power-user/rules-conventions`) and a settings-based hooks system (`https://docs.factory.ai/cli/configuration/hooks-reference`); both surfaces are disabled by contract today.
- **Kiro IDE hooks** — Kiro documents hooks (`https://kiro.dev/docs/hooks/`); neither `config.ts` nor `contract.ts` currently expose a Kiro hooks path or converter.
- **Cline hooks and slash-command workflows** — Cline documents hooks (`https://docs.cline.bot/features/hooks/hook-reference`) and slash-command workflows (`https://docs.cline.bot/features/slash-commands/workflows/index`); neither surface has a converter in `config.ts` and both are disabled by contract.
- **OpenCode config (`AGENTS.md`)** — OpenCode documents config via `AGENTS.md` (`https://opencode.ai/docs/config`); `config.ts` declares the path, but the contract currently exposes only agents and commands.

Filing an issue or PR with a verified converter output is the path to enabling any of the above.

### Examples

```bash
# Preview before any writes
npx mewkit migrate cursor --dry-run

# Single tool, project scope
npx mewkit migrate cursor

# Multi-tool batch (uses interactive picker if TTY)
npx mewkit migrate

# All 15 tools, non-interactive (CI-friendly)
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

# All 15 tools
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
