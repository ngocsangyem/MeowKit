# Runtime discovery matrix and repo review

Collected 2026-11-17. Sources: vendor documentation (code.claude.com, learn.chatgpt.com, cursor.com/docs, docs.x.ai, pi-mono docs), OMP source `@oh-my-pi/pi-coding-agent` 18.13.3 (`src/discovery/builtin.ts`, `src/discovery/helpers.ts`, `src/tools/builtin-names.ts`), the ak reports in `tasks/reports/261113-…` and `261114-…`, and the ak output in a sample project. "ND" = the documentation does not say.

## 1. What each runtime loads (foreign folders in bold)

| | Skills | Agents | Rules / context | Hooks | MCP |
|---|---|---|---|---|---|
| Claude Code | `.claude/skills` | `.claude/agents` (tools allow-list) | `CLAUDE.md`, `.claude/rules`; `AGENTS.md` only when no `CLAUDE.md` | `.claude/settings.json` (snake_case stdin; an identical handler in two settings files runs once) | `.mcp.json` |
| Codex | `.agents/skills`, and `.codex/skills` (probe X1, not in the docs); same name twice: all listed (X2) | `.codex/agents/*.toml` (`name`, `description`, `developer_instructions`; no tool list) | `AGENTS.md`, one per directory, 32 KiB cap; `.codex/rules/*.rules` is Starlark command policy, not instructions | `.codex/hooks.json` (trust per hash through `/hooks`) | `.codex/config.toml` |
| Cursor | `.cursor/skills`, `.agents/skills`, **`.claude/skills`**, **`.codex/skills`** (dedupe ND) | `.cursor/agents`, **`.claude/agents`**, **`.codex/agents`**; `.cursor` wins on a name clash | `.cursor/rules/*.mdc`, `AGENTS.md` (CLI also `CLAUDE.md`) | `.cursor/hooks.json` + **`.claude/settings*.json`** on by default; all run, no dedupe | `.cursor/mcp.json` |
| Grok | `.grok/skills`, `~/.agents/skills`, **"Claude skills"** (path ND) | `.grok/agents` + **Claude agents** (path and format ND) | `AGENTS.md`, `CLAUDE.md`, `.grok/rules/*.md`, **`.claude/rules`**, **`.cursor/rules`**, all loaded | `.grok/hooks/*.json` + **`.claude/settings.json`** + **`.cursor/hooks.json`** (`/hooks-trust`; camelCase payload; fail-open; only PreToolUse blocks; 5 s default timeout) | `.grok/config.toml` + **`.mcp.json`**, **`.cursor/mcp.json`**, `~/.claude.json` |
| Pi | `.pi/skills`, `.agents/skills` (first wins, warning; realpath dedupe) | none | one file per directory: `AGENTS.override.md` > `AGENTS.md` > `CLAUDE.md` | extensions only (`.pi/extensions`, `pi.on("tool_call")`) | `.pi/mcp.json` |
| OMP | `.omp/skills`, **`.claude/skills`**, **`.agents/skills`**, **`.codex/skills`**; identical copies collapse, differing ones stay as `claude/foo` with a warning | `.omp/agents` only | `.omp/rules`, **`.cursor/rules`**, **`.agents/rules`**; context one file per depth, `AGENTS.md` beats `CLAUDE.md` | `.omp/hooks/{pre,post}` modules; also runs `.ts`/`.js` under **`.claude/hooks/{pre,post}`** and `.codex/hooks/pre-*` | many files, deduped by name and by identical connection |

Trust: Codex (project layer + hooks hash), Grok (`/hooks-trust`), Pi (project trust gates `.pi/*` and project `.agents/skills`), Cursor (workspace trust). OMP has none and deep-merges foreign settings files.

Toggles documented: Grok `GROK_CLAUDE_HOOKS_ENABLED`, `GROK_CURSOR_MCPS_ENABLED`; OMP `disabledProviders`, `enabledProviders`, `skills.enableClaudeProject`; Cursor "Third-Party Imports" (user setting); Claude Code `claude-md-and-agents-md` mode.

## 2. What the repo already has (reviewed at `41a5d75b`; `origin/main` is 4 docs-only commits ahead)

| Asset | Where | Use in this plan |
|---|---|---|
| Emitter contract: emitters return a `Plan`, one executor and ownership index apply it | `crates/mewkit-adapters/src/contract.rs`, `mewkit_core::exec` | Kept; the resolver feeds emitters a placement |
| Skills kept projectable: own-path, `${CLAUDE_SKILL_DIR}`, tool names listed | `scripts/check-skills-portable.cjs`, `scripts/rewrite-own-skill-paths.cjs` | Source invariants the projection relies on |
| Tool-name map, Claude Code → Codex, Cursor wording, with `unsupported` | `.claude/kit-capabilities.json` | Gains `grok`, `pi`, `omp` columns; drives body rewrites |
| Host-foreign token list, mirrored in Rust | `scripts/lib/host-foreign-tokens.json`, `crates/mewkit-core/src/validate/denied_tokens.rs` | Post-projection check for every runtime |
| Name-form and pin checks (A9, A10, A13) | `scripts/lib/instruction-criteria-host-rules.cjs`, `docs/maintainer/model-pins.md` | Run on projected trees; pins gain three runtimes |
| Hook coverage per runtime | `.claude/hooks/hook-coverage.json`, `docs/maintainer/hook-output-channels.md` | Becomes the hook part of the surface table |
| Dual-install run-once marker | `.claude/hooks/lib/ship-run-once.cjs`, `tests/guards/cursor.guards.test.ts` | Evidence the overlap is real; replaced by placing the hook once, kept as a backstop |
| Probe log, all rows "documented, not probed" | `docs/maintainer/host-probe-log.md` | Phase 1 adds rows |
| Target validation profiles | `crates/mewkit-core/src/validate/targets.rs` (`codex`, `cursor`) | One profile per new runtime |
| Bundle parity check, 70 drift keys | `scripts/check-bundle-parity.cjs`, `scripts/bundle-parity-allow.json` | Removed with the bundles; its allow-list names what projection must decide on |

Bundle-only content with no `.claude/` source, to carry in overlays: Cursor `domain-*.mdc` rules, Codex `.codex/rules/default.rules`, `rule-*` skills holding always-on text, per-runtime hook entry scripts, `autobuild/assets/pm-status-template.md`, `cook/references/advice-checkpoints.md`, the rewritten Cursor agents (32 files, third person with an input contract).

## 3. ak gaps measured in the sample project (requirements here)

- Skills copied byte-identical with Claude Code tokens left in (`AskUserQuestion`, `subagent_type`, `.claude/.env`).
- Codex agents: `description` holds the name only; Claude frontmatter embedded in `developer_instructions`.
- Codex hooks written with absolute paths.
- Cursor `.mdc` rules without frontmatter.
- OMP agents keep Claude tool names, which `normalizeToolName` leaves unmapped; OMP hooks emitted only as a sidecar.
- Each ak adapter owns its write policy and ownership file; MeowKit keeps one.

## 4. Open after documentation (Phase 1)

1. Grok: path of the Claude skills and agents it loads; dedupe against `.grok/`.
2. Cursor: same skill name in `.cursor/skills`, `.agents/skills`, `.claude/skills`.
3. Grok: is `.mdc` frontmatter in `.cursor/rules` parsed or shown raw.
4. OMP: an agent `tools:` entry it does not know; `model:` alias handling.
5. Codex: duplicate agent or MCP names.
6. OMP: which keys of foreign settings files take effect.
7. Grok: matcher names for delegate and checklist tools; agent frontmatter fields.

## 5. Probed 2026-11-17

Rows X1–X9 in `docs/maintainer/host-probe-log.md`. Settled: OMP items 4 and its dedupe and switch (X4–X7); Codex skill roots and dedupe (X1, X2). Still open, on `docs/maintainer/runtime-probe-checklist.md`: Codex duplicate agents (C1), Cursor skill dedupe (C2), every Grok item (C3–C5), OMP foreign settings keys (C7). Grok and Pi are not installed on the maintainer machine.

## 6. Re-read 2026-11-18 for the surface table

Vendor pages read again, each cell with its page; the table in `crates/mewkit-adapters/src/surface_table.json` holds the result and supersedes §1 where they differ.

| Runtime | §1 said | The pages say |
|---|---|---|
| Grok | loads Claude skills, agents, rules, hooks, MCP | also scans Cursor skills and Cursor agent definitions (`GROK_CURSOR_SKILLS_ENABLED`, `GROK_CURSOR_AGENTS_ENABLED`); no path is named for any imported skill or agent folder |
| Grok | toggles `GROK_CLAUDE_HOOKS_ENABLED`, `GROK_CURSOR_MCPS_ENABLED` | ten variables, one per vendor and kind, and `[compat.claude]` / `[compat.cursor]` tables; project config holds MCP servers, plugins and permission rules only, so none of these can be set by an install |
| Pi | one context file per directory, `AGENTS.override.md` > `AGENTS.md` > `CLAUDE.md` | the override replaces the other two in its own directory; `AGENTS.md` against `CLAUDE.md` is not ranked |
| Pi | skill dedupe by realpath | not stated; a name collision keeps the first skill discovered and warns, and the folder order is not stated |
| Claude Code | `AGENTS.md` only when no `CLAUDE.md` | confirmed, from 2.1.277; the mode that reads both is a user or managed setting that a project settings file cannot set |
| Cursor | "Third-Party Imports" covers the imports | documented for hooks only; whether it governs skills and agents is not stated, and it is an application setting |

The Pi repository now lives at `earendil-works/pi`; the `badlogic/pi-mono` raw URLs still resolve (package 1.5.2).
