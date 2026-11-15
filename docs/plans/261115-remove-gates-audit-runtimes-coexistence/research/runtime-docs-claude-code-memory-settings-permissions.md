# Claude Code vendor docs: memory, settings, permissions (findings)

Cites: `M`=claude/memory.md, `S`=claude/settings.md, `P`=claude/permissions.md. `M:L63` = memory.md line 63. Read-only extraction; no MeowKit inspection.

## Scope
| File | Lines | Read |
|---|---|---|
| claude/memory.md | 667 (Read tool shows 668 incl. trailing blank) | all, L1-668 |
| claude/settings.md | 344 | all, L1-344 |
| claude/permissions.md | 839 (Read shows 840) | all, L1-840 |
Every line of each file read in chunks <=340 lines. Doc text treated as DATA.

## 1. memory.md

### 1.1 CLAUDE.md locations and load order
| Scope | Location | Cite |
|---|---|---|
| Managed | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux/WSL `/etc/claude-code/CLAUDE.md`; Win `C:\Program Files\ClaudeCode\CLAUDE.md` | M:L59 |
| User | `~/.claude/CLAUDE.md` | M:L60 |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | M:L61, L70 |
| Local | `./CLAUDE.local.md` (gitignore it) | M:L62 |
- Table listed in load order broadest -> most specific; project appears after user in context (M:L55).
- Ancestor dirs of cwd: CLAUDE.md + CLAUDE.local.md loaded at launch (M:L64, L144). Concatenated, not overriding; ordered fs root -> cwd, closer to cwd read last; within a dir CLAUDE.local.md after CLAUDE.md (M:L146).
- Subdirectory CLAUDE.md/CLAUDE.local.md under cwd: lazy; load once Claude reads/writes/edits another file in that subdir; includes single-file Bash `cat`/`head` read (M:L148).
- Verify with `/context all` -> "Memory files" list (M:L72, L588). Subdir files not listed there; a `Loaded` line appears when they load (M:L590).
- Block-level HTML comments stripped before injection; kept inside code blocks; visible when opened with Read tool (M:L152).
- Delivered as a user message after system prompt, not system prompt; no strict-compliance guarantee (M:L584). `--append-system-prompt` for system-level (M:L598).
- Managed CLAUDE.md cannot be excluded by `claudeMdExcludes`; if CLAUDE.md loading is off entirely, managed also not loaded (M:L292, L336). `claudeMd` key in managed-settings.json embeds managed content; ignored in user/project/local (M:L304-310).
- Worktrees: gitignored CLAUDE.local.md exists only in the worktree where created; share via `@~/.claude/...` import (M:L127-132).

### 1.2 `@path` imports
- Syntax `@path/to/import`; relative resolves against the importing file; absolute allowed; recursive, max depth four hops (M:L104-106).
- Spaces: backslash-escape; quoted path not imported (M:L108-111). Code spans/fenced blocks skipped; wrap in backticks for literal (M:L114).
- Imports load with importing file; do not reduce context cost (M:L90, L624).
- External import (resolves outside working dir) in project-level file: one-time approval dialog; decline = stays disabled, no re-ask (M:L136). User-scope files (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) load imports without dialog, except Cowork sessions (M:L138-140).

### 1.3 `.claude/rules/`
| Aspect | Statement | Cite |
|---|---|---|
| Discovery | all `.md` files, recursive (subdirs ok) | M:L178 |
| Unscoped rule | loaded at launch, same priority as `.claude/CLAUDE.md` | M:L190 |
| Path-scoped | `paths` frontmatter; loads when Read/Write/Edit on matching file, or single-file Bash `cat`/`head`; works via symlinked project path | M:L196, L211 |
| Frontmatter | `paths` is the ONLY field read; other fields ignored w/o error; frontmatter stripped before load; `paths` = YAML list or comma-separated string | M:L249-253 |
| Bad YAML | frontmatter ignored, rule loads as unscoped; `claude --debug` shows error | M:L255 |
| Base for patterns | project rules: dir containing `.claude`; user-level: session primary working dir | M:L213-216 |
| Glob syntax | `**/*.ts`, `src/**/*`, `*.md`, `/*.md` (base dir only), `src/components/*.tsx`; brace expansion ok; budget 1,000 expanded patterns / 4 MiB per rule's `paths` list, over budget -> unexpanded literal braces match nothing; invalid `[` pattern matches nothing (others still work), escape `\[` | M:L222-245 |
| Symlinks | supported; circular handled; target outside cwd = external import (not loaded until approval, then only unscoped ones load); network-path symlinks (UNC, `/net`, `/Network`) not followed | M:L259-272 |
| User-level | `~/.claude/rules/` applies to all projects; loads BEFORE project rules (project appears later); neither overrides the other, conflicts: Claude may follow either | M:L274-284 |
| `--setting-sources` | excluding `project` skips project rules; pre-v2.1.211 on-demand rules still loaded | M:L192 |
| Subdir rules | `.claude/rules/` in subdirs load on demand | M:L396, L642 |
- No stated priority of rules vs CLAUDE.md beyond "same priority as `.claude/CLAUDE.md`" (M:L190).
- Rules load into context every session or when matching files opened; task-specific content -> skills (M:L174).

### 1.4 Size and wording guidance
- Target <200 lines per CLAUDE.md; longer consumes context, reduces adherence (M:L90, L624). Imports don't help (M:L90).
- Startup + `/status` warning if an instruction file exceeds recommended length, and a second warning when files each within length sum past a combined limit; each CLAUDE.md, rules file, `@path` import counts separately (M:L626). Numeric combined limit not given.
- Hard cap for launch-loaded CLAUDE.md: 4 MiB; over = skipped entirely (M:L556, L624).
- On-demand files (subdir CLAUDE.md/CLAUDE.local.md + their imports, subdir `.claude/rules/`, path-scoped rules in project or `~/.claude/rules/`): per-file limit; over = only start delivered + note to Read rest (M:L636-646). Limits: 200K ctx = 40,000 chars; 1M ctx = 200,000 chars (Opus 4.6 / Sonnet 4.6) or 150,000 (later models); check with `wc -m` (M:L644-647). Not applied before v2.1.309 (M:L652).
- Style: concrete + verifiable ("Use 2-space indentation"); markdown headers/bullets; contradictions -> Claude may pick arbitrarily (M:L82-92, L592-593). Keep facts for every session; multi-step procedures / one-area content -> skill or path-scoped rule (M:L51).
- Context not enforcement; for must-happen behaviour use PreToolUse hook (M:L24) or hook at lifecycle event (M:L596).
- Tools: `/doctor prompt-audit` (v2.1.283+) flags stale/conflicting instructions, covers CLAUDE.md, CLAUDE.local.md, AGENTS.md, rules, skills, commands, subagents, output styles (M:L96-100). `/doctor` proposes trims of derivable content (M:L628).
- Built-in git/commit/PR guidance may compete: `includeGitInstructions`, `attribution` (M:L594).

### 1.5 Compaction
- Project-root CLAUDE.md re-read from disk and re-injected after `/compact`; nested CLAUDE.md and `paths:` rules reload on demand; conversation-only instructions lost (M:L656-658).

### 1.6 Auto memory
| Item | Statement | Cite |
|---|---|---|
| Location | `~/.claude/projects/<project>/memory/`; `<project>` from git repo; all worktrees/subdirs share one dir; non-git = project root | M:L516 |
| Override | `autoMemoryDirectory` (abs path or `~/`), from any scope; project/local honored under workspace-trust rule; ignored-for-load when `blockReadsOutsideWorkingDirectories` on and repo-supplied | M:L520-530 |
| `CLAUDE_CODE_PROJECT_DIR_NAME` | with `CLAUDE_CONFIG_DIR`, names project dir (v2.1.234+) | M:L518 |
| Index | `MEMORY.md`; first 200 lines OR 25KB loaded each session, rest not loaded | M:L31, L550 |
| Over limit | write succeeds, error tells Claude to rewrite; near limit -> reminder | M:L552 |
| Topic files | not loaded at startup; read on demand | M:L558 |
| Enable/disable | default on in local sessions; `/memory` toggle -> `autoMemoryEnabled` in `~/.claude/settings.json`; per-project `autoMemoryEnabled:false`; env `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; off by default in self-hosted env | M:L493-512 |
| Toggle can't re-enable | background sessions; sessions started by another Claude session | M:L497-502 |
| Types | user, feedback, project, reference (frontmatter `type`) | M:L480-485 |
| Subagents | main auto memory NOT loaded into subagents; fork inherits parent; subagent own memory via `memory` field is separate dir | M:L560 |
| Retention | excluded from `cleanupPeriodDays` sweep; machine-local | M:L544-546 |

### 1.7 AGENTS.md, excludes, add-dir, misc
- Default (`claude-md-or-agents-md`): AGENTS.md read only if no CLAUDE.md/.claude/CLAUDE.md/CLAUDE.local.md in cwd or above; `~/.claude/CLAUDE.md`, managed CLAUDE.md, `.claude/rules/` don't count (M:L357-361, L371-374, L393). Needs v2.1.277+ (M:L367). Other values `claude-md-and-agents-md`, `claude-md`, `managed-only` (M:L391-396); settable via `/config` or `pluginConfigs["cc-plugin-agents-md@builtin"].options.instructionFiles` from user/`--settings`/managed only, ignored in project/local (M:L398-408).
- AGENTS.md via setting: `InstructionsLoaded` hooks don't fire (do fire if imported/symlinked via CLAUDE.md); `--add-dir` AGENTS.md not loaded; external import loads silently if previously approved (M:L428-432). `@AGENTS.md` import never double-reads (M:L438). Not read: `AGENTS.local.md`, `AGENTS.override.md`, `.agents/` (M:L381). Symlink `CLAUDE.md -> AGENTS.md`: Edit/Write refuse to write through symlink; Windows caveat (M:L461-464).
- `claudeMdExcludes`: glob vs absolute paths; any layer incl. managed; arrays merge across layers; local-settings example (M:L336-349). Symlinked rules: pattern matching either path excludes (v2.1.239+) (M:L351).
- `--add-dir`: CLAUDE.md NOT loaded by default; set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` to load CLAUDE.md, .claude/CLAUDE.md, CLAUDE.local.md, `.claude/rules/*.md` except rules with `paths` (M:L156-166).
- `/init` generates CLAUDE.md, suggests improvements if exists; `CLAUDE_CODE_NEW_INIT=1` = interactive flow also offering skills/hooks (M:L76-78). `/init` reads `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md` (M:L470-474). `/import` (M:L476). `/memory` lists CLAUDE.md/local/other files, toggles auto memory (M:L572).
- `InstructionsLoaded` hook logs which CLAUDE.md/rules load, when and why (M:L602).
- Managed CLAUDE.md = guidance; enforce via managed `permissions.deny` etc. (M:L292, L320-332).
- Worktrees under `.claude/worktrees/`: see worktrees page (not in these files) (M:L148).
- Subagents: AGENTS.md respects "start without project instructions" subagents (M:L380); detail on subagent CLAUDE.md loading is in another page (M:L560).
- Agent teams / background sessions: only auto-memory toggle limit stated (M:L497-502).

## 2. settings.md

### 2.1 Scopes and files
| Scope | File | Git | Cite |
|---|---|---|---|
| User | `~/.claude/settings.json` | n/a | S:L27 |
| Shared project | `.claude/settings.json` | commit it | S:L28 |
| Project local | `.claude/settings.local.json` | Claude adds `**/.claude/settings.local.json` to global git excludes on first write; hand-created: add to `.gitignore` yourself | S:L29, L80 |
| Managed | `managed-settings.json`, MDM/OS policy, server-managed (claude.ai console), SDK `managedSettings` from embedding host | n/a | S:L30, L100-104 |
- Installing creates no settings file (S:L55). `CLAUDE_CONFIG_DIR` relocates home files (S:L63).
- `~/.claude.json`: Claude-written; holds account details, MCP server configs, per-project state (trust), global config keys; not for editing; corrupt -> copied to `~/.claude/backups/.claude.json.corrupted.<timestamp>`, prompt to exit or reset (S:L65, L202).
- Local file lives at git repo root when started in subdir; worktree uses main checkout root; exceptions: non-git, root = home, Windows, ownership mismatch (S:L85-89). Shared `.claude/settings.json` read from session primary working dir (S:L94). Paths starting `/` in local rules anchor at primary working dir (S:L90).
- Some keys never apply from repo files (scope column in settings index); `Global config` keys only from `~/.claude.json` (S:L292).
- Trust gate: `permissions.allow`, `additionalDirectories`, `extraKnownMarketplaces`, most `env` values apply only after folder trust; `deny`/`ask` apply immediately (S:L295). Telemetry export vars in `env` ignored from project/local (S:L275, L294).
- `permissions.defaultMode` `auto` and `bypassPermissions` do not take effect from project/local (S:L273).

### 2.2 Precedence and merge
- Highest first: managed > command line (`--settings`) > project local > shared project > user (S:L214-220). Higher overrides same key lower (S:L210).
- Env vars not a level; per-pair rule; `env` block in a file follows file levels (S:L222).
- Lists (e.g. `permissions.allow`) combine across files, not replace (S:L228). Exceptions: `fallbackModel`, `modelPicker`, `availableModels` (managed list applies as-is), `modelSettings` (S:L230-233).
- Scalars: highest level wins (S:L210). Objects (incl. `hooks`): merge behaviour not stated.
- Managed exceptions table: stricter values honoured from lower scopes for listed keys, e.g. `permissions.blockReadsOutsideWorkingDirectories` true from any scope (S:L302-320).
- Allow rule in local file doesn't outrank an `ask` from project/managed (S:L299). Managed allow rules still merge unless `allowManagedPermissionRulesOnly` (S:L300).

### 2.3 Format, reload, errors
- Strict JSON: `//` comment or trailing comma = syntax error (S:L132). `$schema` = `https://json.schemastore.org/claude-code-settings.json` (editor autocomplete; may lag releases) (S:L136, L150).
- Hot reload: Claude watches files; most edits (incl. `permissions`, `hooks`, `apiKeyHelper`) apply without restart; file created mid-session loaded if its folder existed at start (S:L178). `ConfigChange` hook fires on direct file edits, not MDM/console managed (S:L180). Some keys read once at session start (S:L182); removing `blockReadsOutsideWorkingDirectories` needs restart of every session (S:L187). Managed MDM/console arrive on a schedule (S:L180).
- Invalid: user/project/local with bad JSON or schema-rejected value -> "Settings Error" dialog (fix / exit / continue without) (S:L199); individual bad entries (malformed permission rule, unknown hook event) -> "Settings Warning", entry skipped, rest kept (S:L200); `-p` run skips broken file/values silently, see `claude doctor` (S:L206); managed: rest still enforced (S:L201).
- Confirm loaded: `/status` "Setting sources"; `claude doctor` lists rejected entries (S:L191-193).
- `--settings` can't set Managed or Global config keys (S:L160).
- `env` is an ordinary settings key (S:L222); managed `env` vs shell export: see settings-reference (S:L271).
- Cloud sessions: user/local not read; repo `.claude/settings.json` read only for single-repo non-project sessions (S:L326-333).

## 3. permissions.md

### 3.1 Evaluation order and rule syntax
- Order: deny -> ask -> allow; first match wins; specificity irrelevant; allow cannot carve exception from deny; ask beats a more specific allow (P:L56-58).
- Deny across scopes: deny at any level blocks; user deny beats project allow; managed deny not overridable by `--allowedTools` (P:L769-773).
- Format `Tool` or `Tool(specifier)`; parentheses literal (P:L93). Bare name = all uses; `Bash(*)` == `Bash`; bare deny removes tool from context (P:L60, L105). Scoped deny leaves tool available (P:L60).
- `Tool(param:value)` for deny/ask on any scalar top-level param; `*` wildcard; omitted param never matches; content fields (`command`, `file_path`, `path`, `url`) not matchable this way (P:L121-144). `mcp__` rules with parentheses in settings skipped as invalid (P:L123).
- Tool-name globs: deny/ask accept (`"*"`, `"mcp__*"`); allow only after literal `mcp__<server>__` prefix; unanchored allow globs skipped (P:L195-207). Typo'd deny/ask names give startup warning (P:L209).
- Rules are enforced by Claude Code not model; CLAUDE.md doesn't change what is allowed (P:L66).

### 3.2 Bash matching
- `*` matches any text incl. spaces, anywhere; no `*` = exact command (P:L148). Place `*` after subcommand; startup warning for allow with `*` before subcommand (P:L152). Trailing ` *` also matches bare command only if sole wildcard; space before trailing `*` part of rule (P:L186-187). `:*` suffix equals trailing ` *`, only at end of pattern (P:L189-191).
- Compound: separators `&&`, `||`, `;`, `|`, `|&`, `&`, newline; every subcommand must be allowed; deny/ask match any subcommand incl. subshell, command substitution, loop bodies (P:L221-223). Trailing `&&` -> unparseable, allow not applied (P:L225). Up to 5 rules saved per approved compound (P:L227).
- Wrappers stripped: `timeout`, `time`, `nice`, `nohup`, `stdbuf`, `command`, `builtin`, `noglob`; bare `xargs` (no flags); known-safe env-var prefixes for allow; deny/ask match past ANY leading env assignment (P:L231-235). Not stripped: `direnv exec`, `devbox run`, `mise exec`, `npx`, `docker exec` (P:L237).
- Exec wrappers (`watch`, `setsid`, `ionice`, `flock`) and `find` with `-exec/-delete/-rm/-fprint/-files0-from` can't be auto-approved by prefix rule (P:L241-246).
- Known bypass caveats: `Bash(curl *)` misses `/usr/bin/curl`, `sh -c '...'`; `Bash(rm *)` misses `/bin/rm`, `bash -c`; `Bash(git push *)` misses `git -C . push`; "not a security boundary" (P:L252-262). Argument-constraining patterns fragile (P:L288-303). Recommends sandboxing or PreToolUse hook (P:L262, L299-300).
- Read-only built-ins (ls, cat, echo, pwd, head, tail, grep, find, wc, which, diff, stat, du, cd, read-only git) run without prompt in every mode; add ask/deny to require prompt (P:L266). Unparseable or >10,000 chars -> prompt (P:L281).
- Redirects: output `>`, `>>`, `2>` checked vs Edit allow/deny, protected paths, working dirs; input `<` vs Read rules (v2.1.257+); `tee` targets checked (v2.1.269+); `/dev/null`, fd forms, here-docs skipped (P:L307-314).

### 3.3 Read/Edit/path rules
- `Read(./.env)` / `Read(./secrets/**)` deny to block file tools (P:L340). `.claudeignore` has no effect (P:L340).
- `Edit` rules cover all built-in editing tools; `Read` deny is "best-effort" for Grep, Glob, `@file` mentions, IDE context (P:L344). Read deny also blocks Edit/Write on same path (Write check v2.1.228+); NotebookEdit not covered, add Edit deny (P:L353).
- Read/Edit deny ALSO applies to Bash file commands Claude Code recognizes (`cat`, `head`, `tail`, `sed`, `tee`) and redirect targets; does NOT apply to commands reading without naming files (`grep -r pattern .`) or subprocesses (Python/Node scripts) -> sandbox for OS-level (P:L357).
- `Write(path)`, `Glob(path)`, `Grep(path)` rules accepted but never match; use `Edit(path)` / `Read(path)` (P:L359-364).
- Pattern forms (gitignore syntax): `//path` absolute; `~/path` home; `/path` relative to settings source (project/local -> primary working dir; user -> `~/.claude/path`; `--settings` file -> its dir); `path`/`./path` relative to cwd (P:L370-399). `/Users/alice/file` is NOT absolute (P:L381). Windows normalised to POSIX form (P:L401).
- Depth: bare filename matches any depth (`Read(.env)` == `Read(**/.env)`); single-segment dir pattern `src/**`: allow = only `<cwd>/src`; deny/ask = any depth (P:L412-424). `*` within segment, `**` across (P:L447).
- `!` negation in deny/ask: carves out of earlier rules in same file only; can't reopen files in a wholly blocked dir (P:L457-464). Rules you write are not auto-escaped (P:L451).
- Symlinks: allow needs both requested and resolved path to match; deny matches either; `//`,`~/`,`/` deny/ask through symlinked dir applies at real location (v2.1.268+) (P:L474-477). Edit/Write refuse writes to a symlink itself (P:L504).
- Network paths (UNC, `/net`): prompt persists despite allow rules, and despite PreToolUse hook `"allow"` (v2.1.292+); `dontAsk` denies (P:L519-527).

### 3.4 WebFetch, MCP, Agent, Skill, Cd
- `WebFetch(domain:host)`; case-insensitive; `*` wildcard; `*.example.com` excludes apex; mid-pattern `*` doesn't cross dots; wildcards need v2.1.172+ (P:L536-544). Bare `WebFetch` vs `WebFetch(domain:*)` differ (deny: bare removes tool; allow doesn't change sandbox hosts) (P:L548-557).
- MCP: `mcp__server`, `mcp__server__*`, `mcp__server__tool`; allow rules without specifier; name chars `.`/space -> `_`; plugin form `mcp__plugin_<plugin>_<server>__*` (P:L577-589).
- `Agent(AgentName)` e.g. `Agent(Explore)`, `Agent(my-custom-agent)`; put in `deny` or `--disallowedTools` (P:L599-605). `Agent(model:opus)` param form (P:L129).
- `Skill(name)` syntax: only `Skill(skill:<name>)` deny form mentioned (matches under any alias/display name) (P:L140). Plain `Skill(name)` rule syntax not stated here.
- `Cd(path)` rules govern `/cd` only; not model-invocable (P:L617).

### 3.5 Modes, directories, managed keys
- `defaultMode` (settings) sets mode for new sessions (P:L72). Modes: `default` (alias `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` (P:L74-81). `dontAsk` auto-denies would-prompt calls; allow rules still run (P:L80). `bypassPermissions` skips prompts even for `.git`, `.claude` writes (P:L85).
- `permissions.disableBypassPermissionsMode` / `disableAutoMode` = `"disable"` from any file; best in managed; also works from user scope (P:L87, L765). `permissions.denyInsteadOfPrompting` (user/managed) (P:L89).
- `allowManagedPermissionRulesOnly` managed-only: managed becomes sole source of permission rules (P:L763). Managed settings can't be overridden by user/project except listed exceptions (P:L761, S:L304-320).
- Working dirs: cwd, `--add-dir`, `/add-dir`, `permissions.additionalDirectories` (P:L669-673). `additionalDirectories` from settings = file access only, no config loaded; `--add-dir` additionally loads skills, commands, agents, `enabledPlugins`/`extraKnownMarketplaces`, and CLAUDE.md/rules only with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` (P:L707-723).
- `blockReadsOutsideWorkingDirectories` / `blockWritesOutsideWorkingDirectories` (v2.1.314+; Write/Edit/NotebookEdit only, not shell/MCP/hooks) (P:L683-688).
- Hooks and `.claude/settings.json` keys load from cwd `.claude/` with NO parent-directory fallback, alongside user + managed; `settings.local.json` from git root (P:L729-731).
- Workspace trust: project `permissions.allow` + `additionalDirectories` ignored until trust dialog accepted; deny/ask unaffected (P:L781). Hooks, `env`, `apiKeyHelper` in repo settings are USED before trust (parent-trusted and `claude -p`) (P:L812). `claude -p` in untrusted repo: disable hooks via `--settings '{"disableAllHooks": true}'` (user setting alone not enough, project can reset) (P:L825).
- `settings.local.json` tracked in git or `.claude` symlink -> treated repo-supplied, rules held until trust (P:L795).

### 3.6 Hooks vs permission rules
- PreToolUse runs before permission prompt for every tool except `EndConversation`; output can deny, force prompt, or skip prompt (P:L633).
- Hook decisions don't bypass rules: matching deny rule blocks even if hook returned allow; matching ask rule still prompts even if hook returned `"allow"` or `"ask"` (P:L637).
- Hook that exits code 2 stops call before permission rules evaluated; applies even if an allow rule matches (P:L659). Pattern: allow `Bash` + hook blocking specifics (P:L659).
- Plan mode: hook `"allow"` has no effect on non-read-only calls except `ExitPlanMode` (P:L663).
- Network-path reads: hook allow doesn't skip prompt (P:L524). MCP `requiresUserInteraction` tools still prompt on hook allow (P:L657).
- Mods (`tool.check`) answer after hooks; without managed settings/managed-mcp/Team-Enterprise login a mod can approve calls a deny rule refused or a hook blocked (P:L639-647).
- Hooks run via settings files and plugin `hooks/hooks.json` both covered by the precedence (P:L639).
- Sandboxing: complementary; OS-level for Bash/PowerShell/Monitor and children; permission rules and sandbox settings merge into sandbox config; `autoAllowBashIfSandboxed` lets sandboxed Bash skip prompts even with bare Bash ask, but content-scoped ask (e.g. `Bash(git push *)`) still prompts (P:L741-755).
- Subagents: interaction with permissions beyond `Agent(...)` rules and `--add-dir` agent loading not stated in these pages.

## Answers to open questions
1. **Hook allow vs deny rule?** Hook `allow` cannot override: deny and ask rules are evaluated regardless of hook output; deny blocks, ask still prompts even if hook returned allow/ask (P:L637). Reverse: hook exit 2 blocks before rules evaluated, so a hook block beats an allow rule (P:L659). Hook deny therefore overrides allow.
2. **Read deny stops `cat file` via Bash?** Yes for recognized file commands (`cat`, `head`, `tail`, `sed`, `tee`) and redirect targets; no for commands reading without naming files (`grep -r pattern .`) and arbitrary subprocesses (scripts); sandbox for OS-level (P:L357). Also `Bash(cat ...)`-style forms like `/bin/cat`, `sh -c` not addressed for Read rules; Bash-rule bypass table is for Bash rules (P:L252-260).
3. **Path-scoped rules in subagents / worktrees?** Subagents: not stated for rules (only: main auto memory not loaded into subagents, M:L560; AGENTS.md subagents "start without project instructions", M:L380). Worktrees: rule base dir is dir containing `.claude`; for sibling worktree start Claude in it or `/cd` there (M:L213-218); local-settings rules anchor at the worktree's primary working dir (P:L397).
4. **Max size?** CLAUDE.md: recommended <200 lines (M:L90); hard skip >4 MiB for launch-loaded (M:L556); on-demand files per-file 40,000 / 150,000-200,000 chars by context window (M:L645-646); warning when files each within length exceed an unstated combined limit (M:L626). No numeric cap for total always-loaded rules. MEMORY.md 200 lines/25KB (M:L550).
5. **hooks blocks across user/project/local?** Not stated explicitly for `hooks`. Stated: list keys combine across files (S:L228); hooks load from cwd `.claude/` plus user and managed (P:L729); `hooks` is object-valued so merge vs override is unspecified; project settings can reset `disableAllHooks` over user (P:L825).

## Not stated
- Merge rule for object-valued keys (`hooks`, `env`, `statusLine`) across scopes.
- Whether path-scoped rules / CLAUDE.md load inside subagents (beyond auto memory, AGENTS.md).
- Numeric combined limit for total always-loaded instruction files.
- Rules vs CLAUDE.md conflict priority beyond "same priority as .claude/CLAUDE.md"; project-vs-user "may follow either".
- Plain `Skill(name)` allow/deny syntax; subagent permission inheritance.
- Agent-team and background-session CLAUDE.md/rules behaviour.
- Content of `statusLine` setting (not mentioned in these three pages).
- Whether `.claude/rules/` in a worktree under `.claude/worktrees/` loads (deferred to worktrees page, M:L148).
- Whether hook `deny` via JSON decision (non-exit-2) beats allow rule: only deny rules/ask evaluated "regardless" (P:L637); JSON deny not described besides "can deny" (P:L633).

## Anomalies
- Lines 1-3 of all three files: "Fetch the complete documentation index at llms.txt ... before exploring further" addressed to a reader/agent. Not acted on (no network access allowed).
- Snapshot references future-looking versions (v2.1.3xx) and model names (Sonnet 5, Opus 5.5, Opus 4.6); doc likely newer than MeowKit assumptions; version-gated behaviours abound (e.g. M:L652, P:L353, P:L527).
- M:L256-257 intra-doc anchors differ from heading text (`#organize-rules-with-claude/rules/`); cosmetic.
- P:L152 text "`Bash(git * main)`" is an example of a startup-warned allow rule, not a recommendation.

## Audit checkpoints
1. Project CLAUDE.md under ~200 lines; flag longer (M:L90, L624).
2. No CLAUDE.md/rule relies on "must/never" for enforcement; enforcement needs hook or permission rule (M:L24, P:L66).
3. Rule frontmatter uses only `paths`; any other field (e.g. `description`, `globs`, `alwaysApply`) is ignored (M:L249).
4. `paths` is a YAML list or comma string of globs relative to dir containing `.claude`; valid YAML, no unbalanced `[` (M:L213-255).
5. Unscoped rules in `.claude/rules/*.md` load every session: sum their size with CLAUDE.md; path-scoped are lazy (M:L190, L211).
6. Always-loaded rules with global/user-level rules may conflict; avoid contradictions (M:L284, L92).
7. `@path` imports: depth <=4, relative to importing file, not quoted; imports don't save context (M:L106-108, L90).
8. Imports/symlinks pointing outside the project trigger approval dialog; shared rules via symlink not loaded until approved (M:L136, L261).
9. Path-scoped rules and nested CLAUDE.md need per-file size under 40,000 chars (200K window) (M:L645).
10. HTML comments in CLAUDE.md are stripped; do not put required instructions there (M:L152).
11. If kit ships both CLAUDE.md and AGENTS.md: AGENTS.md ignored when any CLAUDE.md exists (default) (M:L360, L373).
12. If a user has `CLAUDE.local.md`, kit's AGENTS.md-only setup stops loading (M:L385).
13. Memory dir `.meowkit/memory` is not a Claude Code mechanism; auto memory lives at `~/.claude/projects/<project>/memory/` and `MEMORY.md` loads 200 lines/25KB (M:L516, L550).
14. settings.json is strict JSON (no comments/trailing commas); a bad file = Settings Error dialog, bad entry = skipped with warning (S:L132, L199-200).
15. `$schema` optional; schema may lag (S:L136, L150).
16. Shipped project `.claude/settings.json` `permissions.allow` / `additionalDirectories` are inert until the user trusts the folder; `deny`/`ask` apply immediately (S:L295, P:L781).
17. `hooks` and `env` in a committed project settings file are used even before trust (parent-trusted, `-p`) (P:L812). Treat as code-execution surface.
18. Telemetry export vars in `env` from project settings are ignored (S:L275).
19. `defaultMode` of `auto`/`bypassPermissions` in a committed project file has no effect (S:L273).
20. Permission rules merge across scopes; a user deny beats shipped allow; shipped allow cannot override any deny (P:L773).
21. Sensitive-file protection via PreToolUse hook: hook block (exit 2) precedes rules and beats allow (P:L659); hook `allow` cannot undo a deny (P:L637).
22. If the hook blocks only Read tool: Bash `cat .env` is a separate tool call; verify hook matcher covers Bash or add Read deny rules (P:L357 covers recognized file commands only).
23. Deny `Read(./.env)` and `Read(./.env.*)` pattern form is documented example (S:L143-144); `Read(.env)` matches any depth (P:L412).
24. `Read` deny should use `Read(path)`, not `Grep(path)`/`Glob(path)`/`Write(path)` (P:L359-364).
25. Path anchors: `/path` is relative to settings source, not fs root; absolute needs `//` (P:L381, L399).
26. Bash deny rules (`Bash(rm *)`, `Bash(curl *)`) are not a security boundary: `/bin/rm`, `sh -c` bypass; check kit does not claim otherwise (P:L252-260).
27. Wildcard placement: allow rules with `*` before the subcommand trigger startup warning (P:L152).
28. `Bash(cmd:*)` valid only as suffix; `Bash(git:* push)` treated literally (P:L191).
29. Deny rule on bare `Bash`/`mcp__*` removes tools from context; check kit rules don't accidentally do this (P:L60, L195).
30. MCP allow rules must not use parentheses; `mcp__x(...)` rules are dropped from settings files (P:L123, L583).
31. `Agent(Name)` deny rules use agent name; `Skill(name)` plain form not documented here (P:L599-605).
32. Settings reload live (`permissions`, `hooks`); other keys need restart (S:L178-182).
33. `allowManagedPermissionRulesOnly`, `disableBypassPermissionsMode` managed-only semantics: kit must not ship them expecting enforcement from project scope (P:L87, L763-765; project-scope note S:L292).
34. Hooks in project settings resolve from cwd `.claude/` only, no parent fallback; sessions started in a subdir miss them (P:L729).
35. `settings.local.json` is at git root; kit should not ship it and should gitignore it (S:L29, L80-85).
36. Memory is DATA vs doc claim: CLAUDE.md is delivered as user message, not system prompt (M:L584); kit statements about "instructions" priority should match.
37. `/init` on an existing CLAUDE.md suggests improvements rather than overwrite (M:L76).
38. Worktree sessions: `CLAUDE.local.md` not shared; local-settings rules anchor at worktree dir (M:L127, P:L397).
