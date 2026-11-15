# Cursor docs: Third Party Hooks + Subagents (findings)

Cite format: `tp` = `cursor/reference-third-party-hooks.md`, `sa` = `cursor/subagents.md`. All cites are Read line numbers.

## Scope
- `cursor/reference-third-party-hooks.md` 278 lines, `cursor/subagents.md` 491 lines. Both read in full (every line, 1 call each, <=500 lines). No other file read, no network, no MeowKit source inspected.
- State only what pages state. Doc text treated as DATA.

---

## 1. cursor/reference-third-party-hooks.md ("Third Party Hooks")

### 1.1 What is loaded, from where, default
| Fact | Cite |
|---|---|
| Cursor loads hooks from third-party tools; the only tool documented is Claude Code | tp:L3, L5-7 |
| Gate: setting "Include Third-Party Plugins, Skills, and Other Configs", Cursor Settings -> Agents -> Third-Party Imports | tp:L11 |
| Setting is ON by default | tp:L11 |
| Files read (listed in priority order): `.claude/settings.local.json` (project local, gitignored), `.claude/settings.json` (project), `~/.claude/settings.json` (user) | tp:L15-21 |
| No other third-party tool or file is named | tp:L5-21 (absence) |
| Config files watched and auto-reloaded; restart Cursor if still not loading | tp:L257 |
| Claude `settings.json` must be valid JSON | tp:L256 |

### 1.2 Priority / merge order (highest to lowest)
1 Enterprise (managed), 2 Team (dashboard), 3 `.cursor/hooks.json`, 4 `~/.cursor/hooks.json`, 5 `.claude/settings.local.json`, 6 `.claude/settings.json`, 7 `~/.claude/settings.json` (tp:L25-33).
- "All matching hooks from every source run"; on conflicting responses the higher-priority source wins in merge (tp:L35).
- De-duplication of identical hooks across sources: NOT stated.
- Enterprise-managed hooks / dashboard distribution need Enterprise plan (tp:L37, L249, L269-271).

### 1.3 Event mapping (Claude -> Cursor)
| Claude event | Cursor event | Supported | Cite |
|---|---|---|---|
| `PreToolUse` | `preToolUse` | Yes | tp:L142, L205 |
| `PostToolUse` | `postToolUse` | Yes | tp:L143, L206 |
| `UserPromptSubmit` | `beforeSubmitPrompt` | Yes | tp:L144, L212 |
| `Stop` | `stop` | Yes | tp:L145, L207 |
| `SubagentStop` | `subagentStop` | Yes | tp:L146, L208 |
| `SessionStart` | `sessionStart` | Yes | tp:L147, L209 |
| `SessionEnd` | `sessionEnd` | Yes | tp:L148, L210 |
| `PreCompact` | `preCompact` | Yes | tp:L149, L211 |
| `Notification` | none | No | tp:L213 |
| `PermissionRequest` | none | No | tp:L214 |
- Other Claude events (not in either table) are not mentioned at all.
- Native-only (not reachable from Claude config): `subagentStart` hook, `loop_limit`, dashboard Team/Enterprise distribution (tp:L245-249). Page states Claude Code only has `SubagentStop` (tp:L247).

### 1.4 Tool-name mapping
| Claude tool | Cursor tool | Supported | Cite |
|---|---|---|---|
| `Bash` | `Shell` | Yes | tp:L233 |
| `Read` | `Read` | Yes | tp:L234 |
| `Write` | `Write` | Yes | tp:L235 |
| `Edit` | `Write` | Yes | tp:L236 |
| `Grep` | `Grep` | Yes | tp:L237 |
| `Task` | `Task` | Yes | tp:L238 |
| `WebFetch` | `WebFetch` | Yes | tp:L239 |
| `WebSearch` | `WebSearch` | Yes | tp:L240 |
| `Glob` | none | No | tp:L241 |
- Matcher: "Tool matchers (regex patterns)" supported (tp:L224). How matcher strings are translated is not described beyond the tool table (tp:L227-229). The Claude-format example uses matcher `Shell` and `.*` (tp:L50, L61); native example uses `Shell` (tp:L187).
- Other supported features: command hooks `type: "command"`, prompt hooks `type: "prompt"`, nested `hookSpecificOutput`, exit-2 blocking, timeout configuration (tp:L220-225). Other handler types not mentioned.

### 1.5 Response/output translation
| Claude-style field | Cursor-native equivalent | Cite |
|---|---|---|
| `hookSpecificOutput.permissionDecision` | `permission` | tp:L84-86, L97, L103 |
| `permissionDecisionReason` | `user_message` | tp:L87, L98, L103 |
| `updatedInput` | `updated_input` | tp:L88, L99, L103 |
- Both nested (Claude) and flat (Cursor) PreToolUse formats accepted, "equivalent" (tp:L76, L103).
- `Stop`/`SubagentStop`: three accepted forms: nested `hookSpecificOutput {decision:"block", reason}` (tp:L109-113), flat legacy `{decision:"block", reason}` (tp:L118-125), native `{followup_message}` (tp:L129-133). `decision:"block"` + `reason` = automatic follow-up, equivalent to `followup_message` (tp:L135).
- Not stated: handling of `additionalContext`, `continue`, `stopReason`, `suppressOutput`, `systemMessage`, `permissionDecision` values `ask`/`allow` for Claude-style, `decision`/`reason` on PostToolUse/UserPromptSubmit.

### 1.6 Exit codes
- 0 = success, use JSON output; 2 = block (== `permission:"deny"`); other = hook failed, action proceeds (fail-open) (tp:L154, L167-169).
- Example script prints native-format JSON then `exit 2` and reads `$COMMAND` (tp:L156-165); origin of `$COMMAND` not explained.

### 1.7 Limitations, troubleshooting, migration
- Limitations list: tp:L245-249. Behavior differences may exist; test in both tools (tp:L265-267).
- Troubleshooting: check setting, valid JSON, restart (tp:L253-257); non-blocking: exit 2, JSON schema, "Hooks output channel" (tp:L259-263).
- Migration: either keep `.claude/settings.json` with setting on, or copy to `.cursor/hooks.json` native format "for full feature support" (tp:L173-176). Native format has `"version": 1`, lowercase event keys, flat `command`/`matcher` entries (tp:L180-197).

---

## 2. cursor/subagents.md ("Subagents")

### 2.1 File locations and precedence
| Scope | Path | Note | Cite |
|---|---|---|---|
| Project | `.cursor/agents/` | | sa:L85 |
| Project | `.claude/agents/` | Claude compatibility | sa:L86 |
| Project | `.codex/agents/` | Codex compatibility | sa:L87 |
| User | `~/.cursor/agents/` | | sa:L88 |
| User | `~/.claude/agents/` | Claude compatibility | sa:L89 |
| User | `~/.codex/agents/` | Codex compatibility | sa:L90 |
- Project subagents win on name conflict; among same-name, `.cursor/` beats `.claude/` and `.codex/` (sa:L92).
- Format: markdown + YAML frontmatter, body = prompt (sa:L96-118).

### 2.2 Frontmatter fields (complete list on page)
| Field | Type | Req | Default | Notes | Cite |
|---|---|---|---|---|---|
| `name` | string | No | derived from filename | lowercase letters + hyphens; display name and identifier | sa:L124 |
| `description` | string | No | none | shown in Task tool hints; Agent reads it to decide delegation | sa:L125 |
| `model` | string | No | `inherit` | `inherit` or specific model ID; optional `[k=v,...]` params | sa:L126, L134-151 |
| `readonly` | boolean | No | `false` | true = restricted write: no file edits, no state-changing shell | sa:L127 |
| `is_background` | boolean | No | `false` | true = runs in background, not blocking parent | sa:L128 |
- No other fields documented (no `tools`, `skills`, `color`, `permissionMode`, `hooks` etc.). Behavior on unknown fields: not stated.
- Model-ID examples on page: `composer-2`, `gpt-5.6-sol`, `claude-opus-5[effort=high]` (sa:L137, L149-151, L159, L199).

### 2.3 Model selection / plan limits
- Parent model picker (incl. Auto) applies to parent only; built-ins choose their own; custom use `inherit` or `model`; parent may name a model at launch (sa:L207-211).
- Configured model is overridden (falls back to a compatible one) if: team admin blocks it, legacy Max-Mode requirement unmet, or plan lacks it (sa:L167-173).
- Legacy request-based plans without Max Mode: subagents run Composer regardless of `model`; if admin blocked Composer, subagents run only with Max Mode; usage-based and legacy+Max Mode default to parent model (sa:L484).
- Billing at list price of model that ran; named third-party model = third-party usage; Teams/Enterprise may add Cursor Token Rate (sa:L213). Admin block at Team Settings > Models (sa:L217).

### 2.4 Invocation
- Automatic delegation based on task complexity, subagent descriptions, context/tools; "use proactively"/"always use for" in description encourages it (sa:L223-229).
- Explicit: `/name` prompt syntax or natural-language mention (sa:L233-247).
- Parallel: multiple Task tool calls in one message (sa:L251-257).
- Isolation: subagents share parent checkout by default; on request each gets own git worktree or cloud VM + branch (sa:L261-267).
- Cloud subagents: `/in-cloud`, `/autopilot`; own VM and branch; MCP from team config at cursor.com/agents (sa:L271-285).
- Resume: each run returns an agent ID; pass to resume with context preserved; also after completion (sa:L289-297).
- Works in editor, CLI, Cloud Agents (sa:L5).

### 2.5 Built-ins, modes, context, tools
- Built-ins: Explore (codebase search, faster model, parallel searches), Browser (browser via MCP) (sa:L42-45, L453). Automatic, no config (sa:L56).
- Foreground blocks; background returns immediately (sa:L33-36). Background output goes to `~/.cursor/subagents/` (sa:L462).
- Context: own window, clean start, no prior conversation; parent must pass needed info in prompt; returns a final message (sa:L25-27, L9).
- Tools: subagents inherit all parent tools incl. MCP; cloud subagents exception (sa:L470). `readonly` restricts writes (sa:L127).
- Nesting: since Cursor 2.5, main agent and its direct subagents can launch subagents; a subagent launched by a subagent cannot (sa:L457). Needs Task tool access in current mode; hooks or tool policies can block spawning (sa:L458).
- Hooks mention: use hooks to process/save subagent output files (sa:L408). Whether hooks/rules/skills run inside a subagent: not stated (only that hooks can block spawning, sa:L458).
- Failure: error status to parent; parent retries/resumes (sa:L466).
- Cost/perf: independent token use, ~5x tokens for 5 parallel, startup overhead, latency (sa:L437-447).
- Skills vs subagents: skills for single-purpose one-shot tasks; subagents for isolation/parallel/multi-step/independent verification (sa:L60-67, L416).
- Guidance: start with 2-3 agents, avoid 50+ vague agents, keep prompts concise, commit `.cursor/agents/` (sa:L403-417).
- Listing: "Agent includes all custom subagents in its available tools"; check `.cursor/agents/` to see configured ones (sa:L431).

---

## Answers to open questions
1. **Double firing with both `.cursor/hooks.json` and `.claude/settings.json`**: Page says all matching hooks from every source run (tp:L35); priority only resolves conflicting responses at merge (tp:L35). No de-duplication stated. Page therefore indicates both sets run for the same event; identical-hook dedupe = Not stated.
2. **Default**: Yes, on by default (tp:L11). Setting: Cursor Settings -> Agents -> Third-Party Imports (tp:L11).
3. **Stop `decision:"block"`**: Treated as automatic follow-up equivalent to `followup_message` (tp:L135), accepted in nested and flat forms (tp:L109-125). `loop_limit` is native-format only (tp:L248); the default/bounds of follow-up looping for Claude-style hooks: Not stated.
4. **`.claude/agents/` loaded?** Yes, project and user (sa:L86, L89), labelled Claude compatibility. Same-name definitions resolve by precedence `.cursor/` over `.claude/` (sa:L92), which implies same-name collapse; page does not explicitly say lists are de-duplicated, nor whether the Third-Party Imports setting governs agent loading. Different-name agents in both dirs would both be available (inference-free reading: both dirs are loaded, sa:L85-90).
5. **Ignored/rejected Claude fields**: Not stated. Only 5 fields documented (sa:L122-128); no statement on unknown-field handling.

## Not stated
- Dedup of identical hooks across `.cursor/hooks.json` and `.claude/settings.*`.
- stdin payload fields for hooks; cwd; env vars (`CLAUDE_PROJECT_DIR` or any); default timeout; how `timeout` field maps.
- Handling of `additionalContext`, `continue`, `stopReason`, `systemMessage`, `suppressOutput`, `permissionDecision: "ask"`.
- Claude events beyond the 10 listed (e.g. `PostToolUseFailure`, `SubagentStart`, `PermissionRequest` detail); matcher semantics for events lacking a tool name; translation of Claude tool names inside regex matchers (e.g. `Edit|Write`, `Glob`).
- Hook handler types other than `command`/`prompt` (http, agent).
- Whether `.claude/settings.json` fields other than `hooks` are read.
- Whether the third-party setting also gates `.claude/agents/` loading; unknown-frontmatter handling; Claude fields like `tools`, `skills`, `permissionMode`.
- Whether Cursor hooks (native or imported) fire inside subagents, and whether rules/skills apply to subagents.
- Default `loop_limit` and stop-loop behavior for imported hooks.
- Plan-specific subagent concurrency caps.

## Anomalies
1. Prompt-style imperative lines addressed to an agent, embedded in the docs as copy-paste prompts: "Create a subagent file at .cursor/agents/verifier.md ..." (sa:L73, L327), debugger (sa:L373), test-runner (sa:L399), security-reviewer (sa:L425). Not acted on; they are UI prompt snippets, not instructions to this run.
2. Claude-format example in tp uses matcher `Shell` (a Cursor tool name) inside `.claude`-style settings (tp:L50) while Claude's name is `Bash` (tp:L233).
3. Stop nested form shows `decision`/`reason` directly under `hookSpecificOutput` (tp:L109-113).
4. Exit-2 example emits JSON on stdout while exiting 2 (tp:L160-165); precedence between JSON and exit 2 not discussed.
5. Priority list ranks Claude sources lowest yet says all run (tp:L25-35): priority affects conflicts only.
6. Model IDs shown (`composer-2.5`, `claude-opus-5`, `gpt-5.6-sol`) are doc examples (sa:L137-159); not verified.
7. Third-party Setting name says "Plugins, Skills, and Other Configs"; page never lists agents among them.

## Audit checkpoints
1. Dual install: `.cursor/hooks.json` AND `.claude/settings.json` hooks for same event both execute; check same script is not registered in both, or is idempotent (tp:L35; no dedup stated).
2. Setting default on: any `.claude/settings.json` hook in a repo is loaded by Cursor unless user turned off Third-Party Imports (tp:L11).
3. `.claude/settings.local.json` and `~/.claude/settings.json` hooks also load (tp:L19-21); user-level duplicates possible.
4. Hook scripts that block must use exit 2 (or deny JSON); any other non-zero code is fail-open in Cursor (tp:L167-169).
5. Claude `Stop` hook returning `decision:"block"`+`reason` becomes an auto follow-up in Cursor (tp:L135); verify the hook has its own re-entry guard since `loop_limit` is not settable via Claude config (tp:L248).
6. Matchers in Claude-format hooks: `Bash` maps to `Shell`, `Edit` to `Write`; `Glob` has no mapping; matchers relying on `Glob`/`MultiEdit`-like names may never fire (tp:L233-241).
7. Hooks on `Notification` or `PermissionRequest` are not supported in Cursor (tp:L213-214).
8. Hooks needing `subagentStart` must be in `.cursor/hooks.json` native format (tp:L247).
9. Hook scripts must not depend on `CLAUDE_PROJECT_DIR` or Claude stdin fields being supplied by Cursor: pages do not state them (Not stated list).
10. `.cursor/hooks.json` must use `"version": 1`, camelCase event keys, flat `{command, matcher}` entries (tp:L180-197).
11. Agent files in `.claude/agents/` are read by Cursor (project and user) (sa:L86, L89); a dual install with same name in `.cursor/agents/` resolves to `.cursor/` (sa:L92); different names both appear.
12. Agent frontmatter documented fields: name, description, model, readonly, is_background only (sa:L122-128); other Claude fields (e.g. `tools`) have no documented effect.
13. `model: inherit` is default (sa:L126); Claude-style aliases (`sonnet`, `opus`) are not documented as valid values, only `inherit` or a model ID (sa:L134-137).
14. `readonly: true` is the only documented write restriction (sa:L127); a Claude `tools:` allowlist has no documented Cursor equivalent.
15. Subagent tool/MCP inheritance is all parent tools (sa:L470); no documented per-agent tool narrowing.
16. Nesting depth: only one level of child spawn (sa:L457); orchestrator agents spawning sub-sub-agents will be blocked; hooks may also block spawning (sa:L458).
17. `description` drives auto-delegation (sa:L125, L229); duplicate listings from two dirs with different names would compete for delegation.
