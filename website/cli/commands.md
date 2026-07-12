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

| Flag              | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `--report`        | Print shareable diagnostic report                                                                      |
| `--consolidation` | Show the consolidation/deprecation ledger — each candidate's status (canonical / keep-legacy / authoring-only / experimental / deprecated). Status is a classification, **not** a runtime-availability claim. |

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

**Checks:** Agents (10+), skills (30+), commands dir, modes (5+), rules (10+), hooks executable, scripts present, settings.json, CLAUDE.md, config file. Run a focused suite with any of the flags below (no flag = the full sweep).

| Flag | Description |
| --- | --- |
| `--plugin` | Plugin namespace purity + manifest contract + version alignment with the root `package.json`. |
| `--packs` | Pack-manifest coherence + the exact-path safety invariant. |
| `--workflow` | Workflow drift-check (CLAUDE.md / phase docs vs `workflow.yaml`). |
| `--ownership` | Artifact ownership coverage. |
| `--substrate` | Substrate-view freshness + responsibility coverage. |
| `--rules` | Routing-table breadth. |
| `--portable` | Portable-migration manifest checks. |
| `--strict` | Promote recommended-field WARNs to errors. |

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

### budget context

Estimate the loadable `.claude/` context size for a profile (the context-budget guardrail; also wired into CI).

```bash
npx mewkit budget context --profile <core|developer|full> [--fail-over N] [--json]
```

`--fail-over N` exits non-zero when the estimated loadable context exceeds `N` tokens.

## memory

View or manage cross-session memory.

```bash
npx mewkit memory              # Summary (line counts, pattern count)
npx mewkit memory --show       # Display summary of curated memory stores
npx mewkit memory --stats      # Sessions captured, patterns learned
npx mewkit memory --clear      # Clear all memory (with confirmation)
```

## wiki

Long-term, gated, provenance-bearing project knowledge with full-text search. Agents may only *propose* candidates; a human `approve` (which always re-scans) is the only path to a canonical page. Canonical files live under `tasks/wikis/<slug>/`; `.claude/memory/wiki-index.db` is a derived, rebuildable FTS index. Wiki content is DATA, never an instruction.

```bash
npx mewkit wiki init <slug> --title "<title>"
npx mewkit wiki propose <slug> --title T --file F [--origin agent] [--source-id ID]… [--reuse-scope S] [--salience-json f.json]
npx mewkit wiki approve <slug> <candidate-id> --by <name>
npx mewkit wiki reject <slug> <candidate-id> --reason "<r>"
npx mewkit wiki search "<query>" [--json]
npx mewkit wiki hint "<query>"
npx mewkit wiki context "<keywords>" [--max-pages N] [--json] [--include-content]
npx mewkit wiki handoff suggest --skill <name> --from <artifact> --slug <s> [--json]
npx mewkit wiki handoff propose --skill <name> --from <artifact> --slug <s>
npx mewkit wiki handoff profiles [--json]
npx mewkit wiki list <slug>
npx mewkit wiki render <slug> [--out file.html]
npx mewkit wiki reindex
```

| Subcommand | Purpose |
| --- | --- |
| `init` | Create `tasks/wikis/<slug>/wiki.json`. |
| `propose` | Scan + scrub content into a candidate (never a page). Provenance flags: `--origin`, `--source-id` (repeatable), `--reuse-scope`, `--verification-state`, `--risk-score`, `--review-after`, `--novelty-delta`, `--salience-json <file>`. Defaults preserve prior behavior (human origin, no sources, CLI salience). |
| `approve` | The ONLY canonical-page write path; re-runs the scanner before writing. |
| `reject` | Record a rejection intervention. |
| `search` / `hint` | FTS results with a project-root-readable `path`; `hint` is title/score/path only (no body). |
| `context` | Disciplined Phase-0 recall: ranked pages with a readable `path`, snippet, and token estimate. Snippets only unless `--include-content`. Fails open (exit 0) when no index exists. |
| `handoff suggest` | Read-only — build a handoff packet + decision for a skill's terminal artifact; writes nothing. |
| `handoff propose` | Scan the artifact and propose a candidate when salience clears the gate and the scan is clean; appends one handoff record. Rejects sensitive or out-of-root `--from` paths before reading. |
| `handoff profiles` | List registered skills with handoff class (required / conditional / none) + profile. |
| `list` | Page filenames for a slug. |
| `render` | Self-contained (no-CDN) HTML snapshot. |
| `reindex` | Rebuild the wiki tables in `wiki-index.db` from the canonical files. |

## index

Build or refresh the derived SQLite index (`.claude/memory/wiki-index.db`) from the canonical append logs (`.claude/memory/*.jsonl`) and the wiki tree. Disposable and deterministic — delete it and re-run to get an identical index.

```bash
npx mewkit index [--json]
```

## query

Run read-only aggregate queries over the derived index (events by type, runs, friction by responsibility, cost by model). Requires a prior `mewkit index`.

```bash
npx mewkit query [--json]
```

## inventory

Report harness-artifact coverage. With `--substrate`, map artifacts onto the responsibility taxonomy (covered / partial / missing); `--emit` rewrites the generated `harness-substrate.md` view.

```bash
npx mewkit inventory [--json]
npx mewkit inventory --substrate [--emit]
npx mewkit inventory --stale | --critical | --portable-missing | --check | --emit-counts
```

## trace

Inspect the append-only trace log for entropy and recurring friction, and record friction inline so future sessions can recall it. Advisory — always exits 0.

```bash
npx mewkit trace audit            # orphaned / stale / unverified / repeated-friction signals
npx mewkit trace propose          # group repeated friction (≥2) into advisory backlog items
npx mewkit trace score            # entropy score
npx mewkit trace --friction "<note>" [--responsibility <r>] [--commit]
```

## pack

Manage optional capability packs layered over the base kit.

```bash
npx mewkit pack list [--json]
npx mewkit pack add <pack>… [--yes] [--beta]
npx mewkit pack remove <pack>…
```

## providers

Show migration-target provider support (level, role, surfaces). `explain-support` is an alias that takes a single provider. With `--lifecycle`, show the capability-adapter view instead: the four support levels, repo-context acquisition tools, storage boundary, and the per-lifecycle-event matrix (which events a provider fires and which it can actually gate/deny on).

```bash
npx mewkit providers [<provider>] [--json]
npx mewkit explain-support <provider>
npx mewkit providers --lifecycle              # event × provider matrix (proven-gate markers)
npx mewkit providers <provider> --lifecycle   # one provider: levels, acquisition, lifecycle, evidence
```

| Flag          | Description                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `--lifecycle` | Capability-adapter view: support levels + acquisition + lifecycle-event support. A `gate` is claimed only where a runtime hook can deny/block (never for version-gated or observe-only events). |
| `--json`      | Machine-readable output.                                                                                      |

## capabilities

Inspect and resolve the capability manifest — the semantic map of installed skills/agents/commands/hooks plus authored tool and context/state services. The manifest is a resolution surface; it is **never** injected into a model session.

```bash
npx mewkit capabilities list [--json]
npx mewkit capabilities explain <id> [--json]
npx mewkit capabilities resolve --intent "implement this feature" [--provider <id>] [--json]
npx mewkit capabilities view          # render the trigger-registry table from the manifest
npx mewkit capabilities bootstrap [--provider <id>]   # the always-visible discovery bootstrap
npx mewkit capabilities projections [--json]          # per-provider discovery + 4 support levels
```

| Subcommand    | Purpose                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `list`        | All capabilities with kind, owner, install state, and intents.                                                                      |
| `explain <id>`| One capability's requirements, support levels, verification, and provenance.                                                        |
| `resolve`     | Rank capabilities for an `--intent` and, with `--provider`, report host availability, the safe invocation, any repo-context requirement + how that provider acquires it, and the adapter + evidence behind the claim. |
| `view`        | Render the capabilities table (the generated portion of the trigger registry).                                                      |
| `bootstrap`   | Print the bounded, brand-neutral discovery bootstrap for a provider (`--write` regenerates the committed file).                     |
| `projections` | Per-provider discovery projection + the four support levels (`discoverable`/`selectable`/`invocable`/`enforceable`).                |

## context

Task-scoped repository-context evidence — an on-demand freshness + provenance ledger, not a retrieval engine. MeowKit records and verifies evidence; the host's own tools acquire the content. Each path resolves to its **own** owning repository, so a folder containing many repos (e.g. an Aspire-style parent) never conflates their context.

```bash
npx mewkit context resolve <path> [--root <boundary>] [--json]         # owning repo, revision, content hash, redaction
npx mewkit context check <envelope.json> [--root <boundary>] [--json]  # per-path freshness, grouped by owning repo
npx mewkit context record --task <id> <envelope.json> [--root <boundary>] [--json]  # merge evidence into a durable task record
```

| Subcommand | Purpose                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve`  | Build an evidence ref for a path: owning repo + revision (read from git refs, no `git` binary), content hash, and a redaction flag for secret-shaped paths. |
| `check`    | Re-hash a recorded envelope's evidence and report `fresh` / `stale` / `missing` / `out-of-scope` per path, grouped by owning repo (with its revision). Boundary-scoped: paths outside `--root` are never stat-ed. |
| `record`   | Merge an envelope's distinct owning repos + evidence paths into an **existing** durable task record (advisory, best-effort). |

## build-plugin

Regenerate the native plugin distribution (`plugin/` payload + Claude/Codex marketplaces) from `.claude/`. Release tooling — run after editing `.claude/` outside a release, then `npx mewkit validate --plugin`.

```bash
npx mewkit build-plugin [--json]
```

## verdict-gate

Gate 2 proof-bundle check. Reads a machine-readable review verdict and exits `0` (PASS / PASS_WITH_RISK or a tolerated legacy markdown-only verdict), `1` (BLOCKED / invalid / missing), or `2` (usage error).

```bash
npx mewkit verdict-gate <slug | path-to-verdict.json>
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
# 200: { "ok": true, "changed": true, "etag": "<new-hex64>", "archived": false }
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
