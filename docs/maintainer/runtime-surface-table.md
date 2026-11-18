# Runtime surface table

<!-- Generated from crates/mewkit-adapters/src/surface_table.json. Do not edit: change the data, then run `MEWKIT_BLESS=1 cargo test -p mewkit-adapters --test surface_table_doc`. -->

Which project paths each runtime loads, and where the kit therefore writes for a set of runtimes sharing one project. Collected 2026-11-18. Project scope only.

A root enters the table with a vendor page, a source file and version, or a probe row. "Unsure" marks a read the vendor leaves open: it counts as a possible second copy and is never a runtime's only copy.

## What each runtime loads

### claude-code

Checked: vendor pages read 2026-11-18; Claude Code 2.1.322 installed.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.claude/skills` | yes |  |  | https://code.claude.com/docs/en/skills#choose-where-skills-load |
| agents | `.claude/agents` | yes |  |  | https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope |
| always-on | `.claude/rules` | yes |  |  | https://code.claude.com/docs/en/memory#organize-rules-with-claude-rules |
| always-on | `CLAUDE.md` |  |  |  | https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files |
| always-on | `AGENTS.md` |  | read only when no CLAUDE.md or CLAUDE.local.md is in the working directory or above (default mode, from 2.1.277) |  | https://code.claude.com/docs/en/memory#agents-md |
| hooks | `.claude/settings.json` | yes |  |  | https://code.claude.com/docs/en/hooks#hook-locations |
| mcp | `.mcp.json` | yes |  |  | https://code.claude.com/docs/en/mcp#project-scope |

- always-on: The mode that reads both files is a user or managed setting; a project settings file cannot set it (https://code.claude.com/docs/en/memory#choose-which-instruction-files-load).
- hooks: The same handler in two settings files runs once (https://code.claude.com/docs/en/hooks#hook-handler-fields).

### codex

Checked: vendor pages read 2026-11-18; Codex CLI 0.167.0 probed 2026-11-17.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.agents/skills` | yes |  |  | https://learn.chatgpt.com/docs/build-skills#where-to-save-skills |
| skills | `.codex/skills` |  |  |  | docs/maintainer/host-probe-log.md row X1 |
| agents | `.codex/agents` | yes |  |  | https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents |
| always-on | `AGENTS.md` | yes |  |  | https://learn.chatgpt.com/docs/agent-configuration/agents-md |
| hooks | `.codex/hooks.json` | yes |  |  | https://learn.chatgpt.com/docs/hooks |
| mcp | `.codex/config.toml` | yes |  |  | https://developers.openai.com/codex/mcp#connect-codex-to-an-mcp-server |

- skills: Two skills with one name are both listed (docs/maintainer/host-probe-log.md row X2).
- agents: Two agents with one name: not settled (docs/maintainer/host-probe-log.md row X3, checklist C1).
- always-on: At most one file per directory, 32 KiB in all. `.codex/rules` is command policy, not instructions (https://learn.chatgpt.com/docs/agent-configuration/rules).

### cursor

Checked: vendor pages read 2026-11-18; Cursor Agent 2026.07.23-e383d2b installed.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.cursor/skills` | yes |  |  | https://cursor.com/docs/skills#skill-directories |
| skills | `.agents/skills` | yes |  |  | https://cursor.com/docs/skills#skill-directories |
| skills | `.claude/skills` |  |  |  | https://cursor.com/docs/skills#skill-directories |
| skills | `.codex/skills` |  |  |  | https://cursor.com/docs/skills#skill-directories |
| agents | `.cursor/agents` | yes |  |  | https://cursor.com/docs/subagents#file-locations |
| agents | `.claude/agents` |  |  |  | https://cursor.com/docs/subagents#file-locations |
| agents | `.codex/agents` |  |  |  | https://cursor.com/docs/subagents#file-locations |
| always-on | `.cursor/rules` | yes |  |  | https://cursor.com/docs/rules#rule-file-structure |
| always-on | `AGENTS.md` | yes |  |  | https://cursor.com/docs/rules#agents-md |
| always-on | `CLAUDE.md` |  |  |  | https://cursor.com/docs/cli/using#rules |
| hooks | `.cursor/hooks.json` | yes |  |  | https://cursor.com/docs/hooks |
| hooks | `.claude/settings.json` |  |  | user: Cursor Settings > Agents > Third-Party Imports: "Include Third-Party Plugins, Skills, and Other Configs" off | https://cursor.com/docs/reference/third-party-hooks#requirements |
| mcp | `.cursor/mcp.json` | yes |  |  | https://cursor.com/docs/mcp#using-mcp-json |

- skills: The same name in two folders is not documented and could not be listed without a model turn (docs/maintainer/host-probe-log.md row X8, checklist C2). Whether the Third-Party Imports setting governs skills is not stated.
- agents: An item found under several of these roots loads from the first listed. `.cursor/` wins a name clash; `.claude/` against `.codex/` is not ranked.
- always-on: `CLAUDE.md` is read by the CLI at the project root; the editor page does not mention it. Only `.mdc` files in `.cursor/rules` load.
- hooks: All matching hooks from every source run (https://cursor.com/docs/reference/third-party-hooks#priority-order). `.claude/settings.local.json` is read too.

### grok

Checked: vendor pages read 2026-11-18 (pages dated July to October 2026); not installed, nothing probed.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.grok/skills` | yes |  |  | https://docs.x.ai/build/features/skills-plugins-marketplaces |
| skills | `.claude/skills` |  | the vendor page says these are read and names no path; checklist C3 | user: `GROK_CLAUDE_SKILLS_ENABLED=false` or `[compat.claude] skills = false` in `~/.grok/config.toml` | https://docs.x.ai/build/features/skills-plugins-marketplaces |
| skills | `.cursor/skills` |  | the vendor page says these are read and names no path; checklist C3 | user: `GROK_CURSOR_SKILLS_ENABLED=false` or `[compat.cursor] skills = false` in `~/.grok/config.toml` | https://docs.x.ai/build/settings/reference |
| agents | `.grok/agents` | yes |  |  | https://docs.x.ai/build/features/subagents |
| agents | `.claude/agents` |  | the vendor page says these are read and names no path; checklist C3 |  | https://docs.x.ai/build/features/skills-plugins-marketplaces |
| agents | `.cursor/agents` |  | the vendor page says these are read and names no path; checklist C3 | user: `GROK_CURSOR_AGENTS_ENABLED=false` | https://docs.x.ai/build/settings/reference |
| always-on | `AGENTS.md` | yes |  |  | https://docs.x.ai/build/features/project-rules |
| always-on | `.grok/rules` | yes |  |  | https://docs.x.ai/build/features/project-rules |
| always-on | `CLAUDE.md` |  |  |  | https://docs.x.ai/build/features/project-rules |
| always-on | `.claude/rules` |  |  | user: `GROK_CLAUDE_RULES_ENABLED=false` | https://docs.x.ai/build/features/project-rules |
| always-on | `.cursor/rules` |  |  | user: `GROK_CURSOR_RULES_ENABLED=false` | https://docs.x.ai/build/features/project-rules |
| hooks | `.grok/hooks` | yes |  |  | https://docs.x.ai/build/features/hooks |
| hooks | `.claude/settings.json` |  |  | user: `GROK_CLAUDE_HOOKS_ENABLED=false` | https://docs.x.ai/build/features/hooks |
| hooks | `.cursor/hooks.json` |  |  | user: `GROK_CURSOR_HOOKS_ENABLED=false` | https://docs.x.ai/build/features/hooks |
| mcp | `.grok/config.toml` | yes |  |  | https://docs.x.ai/build/features/mcp-servers |
| mcp | `.mcp.json` |  |  | user: `[compat.claude] mcps = false` in `~/.grok/config.toml` | https://docs.x.ai/build/features/mcp-servers |
| mcp | `.cursor/mcp.json` |  |  | user: `[compat.cursor] mcps = false` in `~/.grok/config.toml` | https://docs.x.ai/build/features/mcp-servers |

- skills: A project `.agents/skills` is not mentioned; the user-level `~/.agents/skills` is. The same name in two folders is not documented.
- agents: File format and fields are not documented on the page read (checklist C3).
- always-on: Every file found is loaded in full. Whether `.mdc` frontmatter is parsed is not stated (checklist C4).
- hooks: Hooks fail open; only PreToolUse blocks; the default timeout is 5 s. Project config cannot hold the compatibility switches (https://docs.x.ai/build/settings).
- mcp: The imported files merge below `config.toml`; one server defined in two of them is not documented.

### pi

Checked: docs on the default branch read 2026-11-18, package 1.5.2; not installed, nothing probed.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.agents/skills` | yes |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/skills.md |
| skills | `.pi/skills` | yes |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/configuration.md |
| always-on | `AGENTS.md` | yes |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/configuration.md |
| always-on | `CLAUDE.md` |  |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/configuration.md |
| hooks | `.pi/extensions` | yes |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/extensions.md |
| mcp | `.pi/mcp.json` | yes |  |  | https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/mcp.md |

- skills: A name collision keeps the first skill discovered and warns; the folder order is not stated. Both folders need project trust (https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/security.md).
- always-on: Parent directories are walked. `AGENTS.md` against `CLAUDE.md` in one directory is not ranked in the docs.
- hooks: No hook file: an extension blocks a call from `pi.on("tool_call")`.

### omp

Checked: source read and probed 2026-11-17, OMP 18.13.3.

| Kind | Root | Kit writes | Unsure | Switch | Source |
|---|---|---|---|---|---|
| skills | `.agents/skills` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/agents.ts:30; docs/maintainer/host-probe-log.md row X5 |
| skills | `.omp/skills` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/builtin.ts:316 |
| skills | `.claude/skills` |  |  | project: `.omp/config.yml` `disabledProviders: [claude]` | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/claude.ts:210; docs/maintainer/host-probe-log.md row X6 |
| skills | `.codex/skills` |  |  | project: `.omp/config.yml` `disabledProviders: [codex]` | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/codex.ts:268; docs/maintainer/host-probe-log.md row X6 |
| agents | `.omp/agents` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/task/discovery.ts:119 |
| always-on | `AGENTS.md` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/agents-md.ts:13 |
| always-on | `.omp/rules` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/builtin.ts:407 |
| always-on | `CLAUDE.md` |  |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/claude-md.ts:13 |
| always-on | `.cursor/rules` |  |  | project: `.omp/config.yml` `disabledProviders: [cursor]` | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/cursor.ts:118 |
| always-on | `.agents/rules` |  |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/agents.ts:202 |
| hooks | `.omp/hooks` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/builtin.ts:720 |
| mcp | `.omp/mcp.json` | yes |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/builtin.ts:238 |
| mcp | `.codex/config.toml` |  |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/codex.ts:109 |
| mcp | `.cursor/mcp.json` |  |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/cursor.ts:85 |
| mcp | `.mcp.json` |  |  |  | @oh-my-pi/pi-coding-agent 18.13.3 src/discovery/mcp-json.ts:171 |

- skills: Copies that differ all stay listed, under a provider prefix (docs/maintainer/host-probe-log.md row X4). Turning a provider off turns off everything it imports, not skills alone.
- always-on: One context file per directory depth; the provider with the higher priority shadows the other (@oh-my-pi/pi-coding-agent 18.13.3 src/capability/context-file.ts:36).
- hooks: Also runs modules under `.claude/hooks/{pre,post}` and `.codex/hooks` (@oh-my-pi/pi-coding-agent 18.13.3 src/discovery/claude.ts:383, codex.ts:406), so kit hook scripts stay outside those folders.
- mcp: An item found under several of these roots loads from the first listed. Servers are keyed by name; the provider with the higher priority wins (@oh-my-pi/pi-coding-agent 18.13.3 src/capability/mcp.ts:112).

## Where the kit writes

The resolver tries every combination of writable roots and keeps the one with, in order: the fewest certain double loads, the fewest runtimes reading another runtime's wording, the fewest possible double loads, the fewest roots. One runtime, each pair, and all six:

| Set | Skills | Agents | Always-on | Hooks | MCP |
|---|---|---|---|---|---|
| claude-code | `.claude/skills` | `.claude/agents` | `.claude/rules` | `.claude/settings.json` | `.mcp.json` |
| codex | `.agents/skills` | `.codex/agents` | `AGENTS.md` | `.codex/hooks.json` | `.codex/config.toml` |
| cursor | `.cursor/skills` | `.cursor/agents` | `.cursor/rules` | `.cursor/hooks.json` | `.cursor/mcp.json` |
| grok | `.grok/skills` | `.grok/agents` | `AGENTS.md` | `.grok/hooks` | `.grok/config.toml` |
| pi | `.agents/skills` | none | `AGENTS.md` | `.pi/extensions` | `.pi/mcp.json` |
| omp | `.agents/skills` | `.omp/agents` | `AGENTS.md` | `.omp/hooks` | `.omp/mcp.json` |
| claude-code + codex | `.claude/skills`, `.agents/skills` | `.claude/agents`, `.codex/agents` | `.claude/rules`, `AGENTS.md` | `.claude/settings.json`, `.codex/hooks.json` | `.mcp.json`, `.codex/config.toml` |
| claude-code + cursor | `.claude/skills` | `.claude/agents`, `.cursor/agents` | `.claude/rules`, `.cursor/rules` | `.claude/settings.json` | `.mcp.json`, `.cursor/mcp.json` |
| codex + cursor | `.agents/skills` | `.codex/agents`, `.cursor/agents` | `AGENTS.md` | `.codex/hooks.json`, `.cursor/hooks.json` | `.codex/config.toml`, `.cursor/mcp.json` |
| claude-code + grok | `.claude/skills`, `.grok/skills` | `.claude/agents`, `.grok/agents` | `.claude/rules` | `.claude/settings.json` | `.mcp.json` |
| codex + grok | `.agents/skills`, `.grok/skills` | `.codex/agents`, `.grok/agents` | `AGENTS.md` | `.codex/hooks.json`, `.grok/hooks` | `.codex/config.toml`, `.grok/config.toml` |
| cursor + grok | `.agents/skills`, `.grok/skills` | `.cursor/agents`, `.grok/agents` | `AGENTS.md` | `.cursor/hooks.json` | `.cursor/mcp.json` |
| claude-code + pi | `.claude/skills`, `.agents/skills` | `.claude/agents` | `.claude/rules`, `AGENTS.md` | `.claude/settings.json`, `.pi/extensions` | `.mcp.json`, `.pi/mcp.json` |
| codex + pi | `.agents/skills` | `.codex/agents` | `AGENTS.md` | `.codex/hooks.json`, `.pi/extensions` | `.codex/config.toml`, `.pi/mcp.json` |
| cursor + pi | `.agents/skills` | `.cursor/agents` | `AGENTS.md` | `.cursor/hooks.json`, `.pi/extensions` | `.cursor/mcp.json`, `.pi/mcp.json` |
| grok + pi | `.grok/skills`, `.agents/skills` | `.grok/agents` | `AGENTS.md` | `.grok/hooks`, `.pi/extensions` | `.grok/config.toml`, `.pi/mcp.json` |
| claude-code + omp | `.claude/skills`, `.agents/skills` | `.claude/agents`, `.omp/agents` | `.claude/rules`, `.omp/rules` | `.claude/settings.json`, `.omp/hooks` | `.mcp.json` |
| codex + omp | `.agents/skills` | `.codex/agents`, `.omp/agents` | `AGENTS.md` | `.codex/hooks.json`, `.omp/hooks` | `.codex/config.toml` |
| cursor + omp | `.agents/skills` | `.cursor/agents`, `.omp/agents` | `AGENTS.md` | `.cursor/hooks.json`, `.omp/hooks` | `.cursor/mcp.json` |
| grok + omp | `.grok/skills`, `.agents/skills` | `.grok/agents`, `.omp/agents` | `AGENTS.md` | `.grok/hooks`, `.omp/hooks` | `.grok/config.toml`, `.omp/mcp.json` |
| pi + omp | `.agents/skills` | `.omp/agents` | `AGENTS.md` | `.pi/extensions`, `.omp/hooks` | `.pi/mcp.json`, `.omp/mcp.json` |
| claude-code + codex + cursor + grok + pi + omp | `.claude/skills`, `.agents/skills`, `.grok/skills` | `.claude/agents`, `.codex/agents`, `.cursor/agents`, `.grok/agents`, `.omp/agents` | `.claude/rules`, `AGENTS.md` | `.claude/settings.json`, `.codex/hooks.json`, `.pi/extensions`, `.omp/hooks` | `.mcp.json`, `.codex/config.toml`, `.cursor/mcp.json`, `.pi/mcp.json` |

## Double loads no placement removes

The runtime loads the content from two written roots in every placement of these sets.

| Kind | Runtime | Also loads | Smallest sets | User setting that stops it |
|---|---|---|---|---|
| skills | cursor | `.claude/skills` | claude-code + codex + cursor | none documented |
| always-on | grok | `.claude/rules` | claude-code + codex + grok; claude-code + cursor + grok; claude-code + grok + pi | `GROK_CLAUDE_RULES_ENABLED=false` |
| mcp | grok | `.cursor/mcp.json` | claude-code + cursor + grok | `[compat.cursor] mcps = false` in `~/.grok/config.toml` |

## Reads that are not settled

The runtime may load a second copy from the root; the reason is in the last column.

| Kind | Runtime | Also loads | Smallest sets | Why |
|---|---|---|---|---|
| skills | grok | `.claude/skills` | claude-code + grok | the vendor page says these are read and names no path; checklist C3 |
| agents | grok | `.claude/agents` | claude-code + grok | the vendor page says these are read and names no path; checklist C3 |
| agents | grok | `.cursor/agents` | cursor + grok | the vendor page says these are read and names no path; checklist C3 |
| always-on | claude-code | `AGENTS.md` | claude-code + codex; claude-code + pi | read only when no CLAUDE.md or CLAUDE.local.md is in the working directory or above (default mode, from 2.1.277) |
