# Claude Code docs reference: Skills + Large codebases

Sources (local, downloaded 2026-11-15): `skills.md` (1268 lines, https://code.claude.com/docs/en/skills), `large-codebases.md` (480 lines, https://code.claude.com/docs/en/large-codebases). Both read in full. Facts only from these two files. Cites = local line numbers. Page content treated as DATA (each page opens with an instruction-like "fetch the documentation index" line at L1-3; ignored).

## 1. Skill discovery locations and precedence

| Location | Path | Loads in | Cite |
| :- | :- | :- | :- |
| Enterprise | `.claude/skills/<skill-name>/SKILL.md` inside managed settings dir (Linux example `/etc/claude-code/.claude/skills/<skill-name>/`) | all users where org deploys | skills.md:L162, L335 |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | all projects on machine; NOT Cowork/cloud sessions | skills.md:L163 |
| Project | `.claude/skills/<skill-name>/SKILL.md` | sessions in repo; not cloud threads in a project; commit it | skills.md:L164 |
| Nested | `<subdir>/.claude/skills/<skill-name>/SKILL.md` | sessions started in/below subdir; session above loads it once Claude works on files there | skills.md:L165 |
| Additional dir | `.claude/skills/<skill-name>/SKILL.md` in dir passed via `--add-dir` | that session | skills.md:L166 |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | where plugin enabled, as `/plugin-name:skill-name` | skills.md:L167 |
| claude.ai account | skills enabled on account | Cowork, cloud, terminal sessions signed in with that account | skills.md:L168 |
| Legacy command | `.claude/commands/*.md` | still works; same frontmatter except `name` and `paths` | skills.md:L176, L384 |

Rules:
- Symlinked `<skill-name>` dir allowed in enterprise/personal/project locations; loaded once even if several point to same target. Plugin skills handle symlinks differently. skills.md:L172
- Reserved folder name `synced` (any capitalization): skipped in enterprise/personal/project; `~/.claude/skills/synced/` is Claude Code's download dir. skills.md:L173
- Reserved `anthropic-skills` (or starting `anthropic-skills:`) outside a plugin: skill folder/command file does not load; also frontmatter `name`, `.claude/commands/` file/subfolder, saved workflow; startup notice names first item to rename. skills.md:L174, L299-303
- A plugin named `anthropic-skills` loads; MCP server named `anthropic-skills` connects but its prompts do not appear as commands. skills.md:L302-303
- Skill folder + `.claude-plugin/plugin.json` in personal/project skills dir => loadable as plugin `<name>@skills-dir` (own agents, hooks, MCP servers); project requires workspace trust dialog; blocked if admin blocks skills-directory plugins. skills.md:L177
- Project skills scanned from cwd up through every parent to repo root (starting in `packages/frontend/` still finds root skills). skills.md:L181
- `/cd` (v2.1.246+) adds new directory's project skills. skills.md:L181
- Linked git worktree (`--worktree` or `git worktree add`): parent search stops at worktree root; v2.1.277+: if worktree root has no `.claude/skills`, main checkout's project skills load instead. skills.md:L183
- Skills in `.claude/skills/` BELOW start dir: not loaded at startup; load first time Claude reads/edits a file in that subdir; stay for session; until then absent from `/` menu, cannot invoke by name. `/add-dir <subdir>` loads sooner (v2.1.257+). skills.md:L185
- Nested same-name as root: both stay available. `/deploy` runs root; `/apps/web:deploy` runs nested (description names its directory); Claude is also listed directory-qualified variants. skills.md:L187-190
- `--add-dir` / `/add-dir` loads that dir's `.claude/skills/`, `.claude/commands/`, `.claude/agents/`. SDK `additionalDirectories` (TS) / `add_dirs` (Python) behave same (pass `--add-dir`). skills.md:L194
- `permissions.additionalDirectories` in settings.json = file access only; loads none of skills/commands/agents. skills.md:L194; large-codebases.md:L296-299, L368
- Live-watch covers `.claude/skills/` in `--add-dir` dir at launch, NOT its `.claude/commands/` or `.claude/agents/` (restart needed). skills.md:L196
- These loads depend on `project` setting source (on by default); restricted further by `strictPluginOnlyCustomization`, bare mode, `--safe-mode`. skills.md:L198
- Added-dir skill whose folder name clashes gets prefix; `/<prefix>:<skill-name>` (v2.1.309+), e.g. `/cli:verify`; two added dirs sharing folder name: prefix starts with parent folder name (`/b/cli:verify`). skills.md:L202-207, L453

### Name-collision precedence table (skills.md:L213-223)
| Same name in | Winner |
| :- | :- |
| two of enterprise/personal/project | enterprise > personal > project |
| your skill vs bundled skill | your skill replaces bundled command, not its aliases (`code-review` vs alias `/review`) |
| your skill vs built-in command | local terminal: your skill replaces built-in, not aliases (`usage` vs `/cost`) |
| skill vs `.claude/commands/` file | the skill |
| project-root skill vs nested | both load |
| ent/personal/project vs added-dir (outside project) | ent/personal/project; added-dir runs prefixed |
| two added dirs | first added (order of `--add-dir`/`/add-dir`); other prefixed |
| plugin skill vs any | both load (namespaced `/plugin-name:skill-name`) |
| anything vs synced claude.ai short name | the other; synced skill only under full name `/anthropic-skills:<name>` |

Name comparison for synced collisions ignores case, spacing, invisible chars; compat forms (fullwidth, dash variants) fold; look-alike letters from other alphabets are different (v2.1.228+). skills.md:L293-295

## 2. SKILL.md structure and frontmatter

- Every skill needs `SKILL.md`: YAML frontmatter between `---` markers + markdown body. skills.md:L118, L541 ("SKILL.md (required - overview and navigation)")
- Frontmatter read ONLY when opening `---` is the file's first line; otherwise entire file (incl. markers) is skill content. skills.md:L399
- Malformed YAML: skill still loads with NO fields set (body works, `/skill-name` works, description matching fails). `--debug` shows parse error. skills.md:L399, L1211
- Unrecognized field: ignored silently, no error; field names must match table exactly incl. hyphens. skills.md:L397
- Field names lowercase hyphen-separated EXCEPT `when_to_use` (underscore). skills.md:L384
- All fields optional; only `description` recommended. skills.md:L397
- Booleans accept `yes`,`no`,`on`,`off`,`1`,`0` any case, plus `true`/`false`. skills.md:L397
- Keep `SKILL.md` under 500 lines; move detail to separate files. skills.md:L559
- Body persists after load; each line is recurring token cost; keep concise. skills.md:L380, L613
- `ultrathink` anywhere in skill content requests deeper reasoning. skills.md:L755

### Frontmatter field table (skills.md:L401-422)
| Field | Type | Req | Default | Constraint / behaviour | Cite |
| :- | :- | :- | :- | :- | :- |
| `name` | string | No | directory name | Command name in `/` menu; see naming rules sec. 3. No stated length/charset limit on the page except forbidden chars | L403 |
| `description` | string | Recommended | first non-empty line of markdown body | Combined `description`+`when_to_use` truncated at 1,536 chars in listing; key use case first; `<`/`>` display as `&lt;`/`&gt;` | L404 |
| `when_to_use` | string | No | - | Appended to `description` in listing; counts toward 1,536 cap | L405 |
| `argument-hint` | string | No | - | Autocomplete hint e.g. `[issue-number]`, `[filename] [format]` | L406 |
| `arguments` | space-separated string OR YAML list | No | - | Named positional args for `$name` substitution; names map to positions in order | L407 |
| `disable-model-invocation` | bool | No | `false` | `true`: Claude cannot auto-load; also blocks preloading into subagents and running when session-scoped scheduled task fires with skill as prompt | L408 |
| `user-invocable` | bool | No | `true` | `false`: hidden from `/` menu; typing `/name` does not run it | L409 |
| `allowed-tools` | space/comma string OR YAML list | No | - | Pre-approves tools for the invoking turn only; clears at next user message; does NOT restrict tools | L410, L623 |
| `disallowed-tools` | space/comma string OR YAML list | No | - | Removes tools from pool while skill active; clears at next message; cannot remove `EndConversation` while any other tool remains | L411, L638 |
| `model` | string | No | - | Values as `/model`, or `inherit`; applies rest of current turn, not saved; org `availableModels` excluded value ignored; with `context: fork` sets subagent model; auto-mode unsupported model ignored | L412 |
| `effort` | string | No | per effort resolution order | `low`,`medium`,`high`,`xhigh`,`max` (availability model-dependent); overrides session, NOT env `CLAUDE_CODE_EFFORT_LEVEL`; with fork sets subagent effort | L413 |
| `context` | string | No | - | `fork` = run in forked subagent context | L414 |
| `agent` | string | No | `general-purpose` when omitted (L867) | Subagent type when `context: fork`; built-ins `Explore`,`Plan`,`general-purpose` or any custom in `.claude/agents/` | L415, L867 |
| `background` | bool | No | `true` | Only with `context: fork`; `false` waits for result in invoking turn | L416 |
| `hooks` | object | No | - | Hooks registered on invocation, kept for rest of session; format/`once`/limits documented on hooks page (not on these pages) | L417 |
| `paths` | comma string OR YAML list (globs) | No | - | Auto-activation only when working with matching files; patterns relative to cwd; files outside cwd don't match; same glob format as path-specific rules; NOT valid in command files | L418, L384 |
| `shell` | string | No | `bash` | `bash` or `powershell`; selects shell for `` !`cmd` `` and ```` ```! ```` blocks | L419 |
| `metadata` | YAML map | No | - | Free-form; Claude Code does not act on it; non-map value dropped; don't reuse frontmatter names (e.g. `paths`) as keys | L420 |
| `license` | string | No | - | Agent Skills spec field; accepted, not acted on | L421 |
| `compatibility` | string, max 500 chars | No | - | Agent Skills spec field; accepted, not acted on | L422 |

PowerShell tool availability for `shell: powershell`: default on Windows without Git Bash; default on with Git Bash for claude.ai/Console accounts; needs `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` on Bedrock, Google Cloud Agent Platform, Microsoft Foundry, and macOS/Linux/WSL; `0` turns off. skills.md:L419

Not stated on these pages: max length of `name`; max length of `description` other than listing cap; regex for `name`; whether `name` must equal directory name (page says `name` defaults to dir name and both can invoke in personal/project dirs, L445); full `hooks` schema; `argument-hint` char limit.

### Frontmatter outside Claude Code (Agent Skills spec portability) skills.md:L424-441
- Claude Code accepts every field above. L426
- claude.ai uploads, Skills API, `package_skill.py` (anthropics/skills): only `name`,`description`,`license`,`compatibility`,`metadata`,`allowed-tools`. L431
- Any other field => hard packaging/upload error. Verbatim: `Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata, name`. L435-439
- Dynamic context injection does not function in claude.ai chat or API. L441
- Uploading a personal skill to claude.ai (for Cowork/cloud) subjects it to same rules. L433

## 3. Naming

| Layout | Command name source | Cite |
| :- | :- | :- |
| `~/.claude/skills/<dir>/` or `.claude/skills/<dir>/` | frontmatter `name` or dir name; both invoke it; `name` wins in `/` menu unless another command already has it | L445, L451 |
| nested dir, name clash | `/<subdir-path-relative-to-cwd>:<skill-dir>`, e.g. `/apps/web:deploy` | L452 |
| added dir, clash | `/<added-dir-folder>:<skill-dir>` (v2.1.309+) | L453 |
| `.claude/commands/<f>.md` | filename sans extension | L454 |
| `.claude/commands/<sub>/<f>.md` | `/<sub>:<f>` (each `/` -> `:`) | L455 |
| plugin `skills/<dir>` | `/<plugin>:<name or dir>`; bare `/<name>` also works unless taken | L456, L460 |
| plugin root `SKILL.md` | frontmatter `name`, fallback plugin dir name | L457, L464 |
| synced claude.ai | `anthropic-skills:<name>`; short `/name` if free | L458 |

- Plugin `name` already starting with plugin prefix: not doubled on v2.1.246+; v2.1.216-v2.1.245 doubled it. L460
- Non-interactive: `help` and `feedback` not reserved; plugin skills with these names keep bare command; other terminal-only built-in names (e.g. `/login`) stay reserved. L462
- Refused characters in command name / frontmatter `name`: zero-width space or control char; private-use/unassigned char (icon-font glyph); bidi-changing char; blank other than one plain space between words (no-break space, double space, leading/trailing space); `<` or `>`. L468-474
- Refused dir/file name => custom command/skill doesn't load (rename). Refused frontmatter `name` => `/` menu doesn't show it and typing it doesn't invoke. Plugin skill folder names: chars become hyphens. L476-479
- Diagnose: `claude --debug`, search debug log for `[names]`; interactive startup notice also. Restart after rename unless dir watched. L481

## 4. How descriptions are listed, budget, truncation

- Regular session: skill names+descriptions loaded into context; full content only on invoke. Subagents with preloaded skills get full content at startup. skills.md:L598
- Listing always contains every skill name; when too many, descriptions dropped to fit char budget (removes matching keywords). L1234
- Budget = 1% of model context window. Overflow drops descriptions starting with least-recently-invoked skills. L1234
- Per-entry cap: combined `description`+`when_to_use` = 1,536 chars regardless of budget; configurable via `skillListingMaxDescChars`. L404-405, L1240
- Raise budget: setting `skillListingBudgetFraction` (e.g. `0.02` = 2%) or env `SLASH_COMMAND_TOOL_CHAR_BUDGET` (fixed char count). L1240
- `skillOverrides` value `"name-only"` frees budget (name listed, no description). L1240
- `/context` Skills row reports post-budget size (before v2.1.196 counted full text). L1238
- Over-budget warning written to debug log (`--debug`). `/doctor` estimates listing cost. L1236
- `disable-model-invocation: true` => description NOT in context at all ("removes the skill from Claude's context entirely"). L593, L913
- `user-invocable: false` => description still in context. L594
- Large-codebase guidance: keep descriptions short, lead with request-like words; accumulation can reach hundreds when starting at repo root. large-codebases.md:L367-370
- Display sanitization (synced skills): control chars removed, angle brackets escaped in text reaching Claude (v2.1.228+). skills.md:L310
- `<`/`>` in `description`/`when_to_use` shown as `&lt;`/`&gt;`; use `[branch]` or `argument-hint: <branch>`. L1242-1247

## 5. Invocation control

| Frontmatter | User can invoke | Claude can invoke | Context | Cite |
| :- | :- | :- | :- | :- |
| default | yes | yes | description listed; body on invoke | L592 |
| `disable-model-invocation: true` | yes | not on its own | description absent; body on invoke | L593 |
| `user-invocable: false` | no | yes | description listed; body on invoke | L594 |

- `user-invocable: false` does not block Claude's Skill-tool call; to block use `disable-model-invocation: true`. L915-917
- Blocked-call behaviour: if Claude tries to run a `disable-model-invocation` skill and user message lacks `/name` as separate word with no punctuation, Claude Code blocks; Claude suggests user runs it. L586
- `/name` at start of message runs directly; after plain text as separate word = permission only, not direct run. L604-607
- Stack skills at terminal prompt: first skill + up to five more; expansion stops at first token that isn't an inline user-invocable skill (forked skill e.g. `/code-review`, or `/loop`); in `claude -p`/Agent SDK only first skill loads, rest = args. L705-707
- Built-ins also reachable via Skill tool: `/init`, `/security-review`; others (`/compact`) not. L871
- `/verify` or `/simplify` skill in enterprise/personal/project/added-dir location or `.claude/commands/`: Claude Code commit instructions tell Claude to run it before each commit (except docs/tests-only); requires v2.1.286+; not for bundled, plugin, claude.ai-synced skills; not if Claude cannot invoke it; not if `includeGitInstructions` off. L74-78
- `/verify` records recipe at `.claude/skills/verify/SKILL.md` (repo root, or touched package dir in monorepo); at root it replaces bundled `/verify`. `/run-skill-generator` writes `.claude/skills/run-<name>/`. L66-68

## 6. Arguments and substitutions (skills.md:L487-520, L653-707)

| Variable | Meaning | Note |
| :- | :- | :- |
| `$ARGUMENTS` | full arg string as typed | if no placeholder receives an arg, Claude Code appends `ARGUMENTS: <value>` |
| `$ARGUMENTS[N]` | 0-based indexed arg | |
| `$N` | shorthand (`$0`,`$1`) | shell-style quoting; unmatched indexed stays literal text |
| `$name` | named arg from `arguments` frontmatter | unmatched named => empty string; counts as receiving |
| `${CLAUDE_SESSION_ID}` | session id | not substituted in terminal/VS Code synced skills (L318) |
| `${CLAUDE_EFFORT}` | `low`/`medium`/`high`/`xhigh`/`max` | |
| `${CLAUDE_SKILL_DIR}` | dir containing the SKILL.md (plugin: skill subdir) | |
| `${CLAUDE_PROJECT_DIR}` | project root; same as hooks/MCP `CLAUDE_PROJECT_DIR` | |
| `${CLAUDE_PLUGIN_ROOT}` | plugin install dir | plugin skills only |
| `${CLAUDE_PLUGIN_DATA}` | plugin persistent data dir | plugin skills only |

- `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` substituted in markdown body AND in Bash rules of `allowed-tools` (plugin: also `${CLAUDE_PLUGIN_ROOT}`,`${CLAUDE_PLUGIN_DATA}`). Example `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`. L500-512
- Arg values containing `$1`/`$ARGUMENTS` inserted literally; `${CLAUDE_*}` still replaced after. L518
- Escape: `\$1.00` (single backslash only); `\\$1` still expands; escape covers only arg placeholders, not `${CLAUDE_*}`. L520
- `allowed-tools` accepts space-separated: `Bash(git add *) Bash(git commit *) Bash(git status *)`. L634

## 7. Dynamic context injection (skills.md:L711-801)

- Inline: `` !`<command>` `` ; multi-line: fenced block opened with ```` ```! ````. Output replaces placeholder before Claude sees content. L713, L739
- Recognized only when `!` at line start or right after whitespace; `` KEY=!`cmd` `` left literal. L737
- Single pass over original file; output not re-scanned. L735
- Disable: setting `"disableSkillShellExecution": true` (user, project, plugin, additional-dir sources); each command replaced by `[shell command execution disabled by policy]`; bundled and managed skills unaffected; best in managed settings. L749
- Shell selection from `shell` frontmatter: `powershell` (tool enabled) -> PowerShell; `shell: bash` without bash (Windows no Git Bash) fails invocation: ``Skill <name> requires bash (`shell: bash` in frontmatter) but Git Bash was not found``; else Bash, falling back to PowerShell. L759-763
- Runs in session shell cwd (moves with `cd`); bash merges stderr into stdout; 2-minute default Bash timeout; large output => file path + preview. L767-770
- Failure aborts WHOLE invocation: `Shell command failed for pattern "..."`. Non-zero = failure; exit 1 from search/comparison commands is normal result; exit >=2 fails. Append `|| true` for expected non-zero. L776-785
- `No shell command in <name> was run` => command contains character the tool rejects. L789
- Permission: injected commands never prompt; deny-rule match aborts with `Shell command permission check failed for pattern "..."`; outside auto mode non-allow result aborts; pre-approve via `allowed-tools`; deny/ask rules still abort; bare-repo folder (HEAD beside `refs`/`commondir`) makes `allowed-tools` ignored for Bash with `git` or unparseable. Auto mode: loads with instruction to run it first; still aborts in forked skill with `agent` set or no shell tool. L793-801
- Synced skills in terminal/VS Code: `!` commands not run, `@` file refs not attached, `${CLAUDE_PROJECT_DIR}`/`${CLAUDE_SESSION_ID}` not substituted (v2.1.228+); Cowork: `!` lines replaced by `disableSkillShellExecution` placeholder. L317-318, L751

## 8. Supporting files (skills.md:L535-559)
- Skill dir may hold extra files; layout shown: `SKILL.md` (required), `reference.md`, `examples.md`, `scripts/helper.py` ("executed, not loaded"). Reference them from SKILL.md so Claude knows what/when. Page names no required subdir names; `scripts/` appears only as example.
- Reference scripts via `${CLAUDE_SKILL_DIR}` for cwd-independence. L495

## 9. Tool restriction / permissions
- `allowed-tools` = per-turn pre-approval, not restriction; project skill's `allowed-tools` applies even in `-p` run in untrusted folder (review repo skills). L623-625
- `hooks` in `strictPluginOnlyCustomization` (managed): personal/project skill declaring `hooks` loses `allowed-tools` pre-approval and its hooks don't run; fix: remove `hooks` or move skill into plugin; check `/status`. L642-645
- `allowManagedPermissionRulesOnly` (managed): project/personal skill `allowed-tools` ignored (v2.1.282+); `/status` lists "allowed-tools ignored this session". L649-651
- `disallowed-tools` removes from pool; settings deny rules for all skills. L638
- Permission rule syntax: `Skill` (deny all), `Skill(name)` exact, `Skill(name *)` prefix w/ args. Examples `Skill(commit)`, `Skill(review-pr *)`, `Skill(deploy *)`. Allow rules do not limit Claude to named skills. L875-893
- Deny blast radius: `Skill(review)` also blocks bundled `/code-review` via alias; `Skill(deploy)` also blocks nested `apps/web:deploy` (since v2.1.260); `Skill(anthropic-skills:deploy)`, `Skill(deploy:deploy)`, `Skill(skill:deploy)` (parameter form). L897-905
- Allow matches only skill's own name + invocation name; `Skill(anthropic-skills:pdf)`, `Skill(anthropic-skills *)` ok; `Skill(anthropic *)` does not match. L907-911

## 10. Forked context / subagents (skills.md:L803-867)
- `context: fork` => new subagent of type in `agent`; skill content = its prompt; no conversation history. Not a fork of the conversation. L805-809
- Default runs in BACKGROUND; `background: false` waits. Always waits: `-p`/Agent SDK; `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`; re-invoke while earlier run active; session-scoped scheduled task. Dynamic-workflow agent always waits (before v2.1.295 it did not). L811-820
- Background fork uses narrower background-subagent tool set; set `background: false` to keep full tools. L822
- Background fork edits are outside checkpoints; `/rewind` won't revert them (use git). L824
- WARNING: `context: fork` needs explicit task; guidelines-only skill returns nothing useful. L828
- Table: fork skill = system prompt from agent type, task = SKILL.md, also loads CLAUDE.md per agent startup context; subagent with `skills` field = subagent body as system prompt, delegation message as task, preloaded skills + CLAUDE.md. L832-835
- Built-in `Explore` and `Plan` agents start WITHOUT CLAUDE.md and git status; forked skill with `agent: Explore` sees none of your CLAUDE.md. L837
- `agent` options: `Explore`, `Plan`, `general-purpose`, or custom `.claude/agents/`; default `general-purpose`. L867
- Subagent `skills` field preload is the inverse direction (documented on sub-agents page, not here). L839

## 11. Skill content lifecycle and compaction (skills.md:L611-619)
- Rendered SKILL.md enters conversation as one message, persists; file not re-read; write standing instructions.
- Re-invoke with identical rendered content => short "already loaded" note; differing content => full content appended again.
- Auto-compaction re-attaches most recent invocation of each skill: first 5,000 tokens each; combined budget 25,000 tokens; filled from most recent; older skills can be dropped. Put key instructions near top. L617, L1230
- If a rule must hold every time: use a hook (or `hooks` frontmatter, active from invocation to session end). L1228

## 12. Hooks in skill frontmatter
- `hooks` field registers hooks on invocation, persists for session; `once` option and "limits on skill hooks" documented on hooks page only. skills.md:L417, L1228
- Org `strictPluginOnlyCustomization` including `hooks` disables skill hooks for personal/project skills. L642-645

## 13. Live reload / settings / env vars / commands
| Item | Behaviour | Cite |
| :- | :- | :- |
| live change detection | watches `~/.claude/skills/`, project `.claude/skills/`, `--add-dir` `.claude/skills/`; add/edit/remove picked up without restart; off in bare mode | skills.md:L322 |
| `/reload-skills` | needed when a top-level skills dir was created after session start; rerun after later changes there | L324 |
| plugin-folder skill | live detection covers SKILL.md text only; `.mcp.json`, `agents/`, `output-styles/`, `hooks/` need `/reload-plugins` | L328 |
| `/skills` menu | lists skills; Space cycles `skillOverrides` state, Esc saves to `.claude/settings.local.json` | L268, L921 |
| `/skill-doctor` | usage/cost report; v2.1.252+; needs feature-flag fetching; not over Remote Control | L955-959 |
| `/doctor` | setup checkup; `/doctor prompt-audit` v2.1.283+; usage check v2.1.305+ | L42-52 |
| `disableBundledSkills` | setting; turns off bundled skills (`/doctor` stays typable; hide with `DISABLE_DOCTOR_COMMAND` env or `skillOverrides` `"doctor": "off"`) | L32-36, L338 |
| `skillOverrides` | map skill name -> `"on"`,`"name-only"`,`"user-invocable-only"`,`"off"`; absent = `"on"`; `"off"` hides from Remote Control/Agent SDK lists; invoking hidden by full name returns `skillOverrides` error; plugin skills unaffected; user/project/local settings match skill names only (not aliases); managed/`--settings` entries can apply via alias (restrict only; v2.1.260+) | L923-951 |
| `skillListingBudgetFraction` / `SLASH_COMMAND_TOOL_CHAR_BUDGET` / `skillListingMaxDescChars` | listing budget knobs | L1240 |
| `disableSkillShellExecution` | see sec 7 | L749 |
| `includeGitInstructions` | off removes commit-time verify/simplify instruction | L78 |
| `syncClaudeAiSkills` | `false` in user settings stops sync; skills moved to `~/.claude/skills/.trash/` at next start | L272 |
| `CLAUDE_CODE_SYNC_SKILLS=1` | non-interactive run downloads+waits for synced skills | L253 |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_USE_POWERSHELL_TOOL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` | referenced env vars (see rows above/sec 10, 15) | L258, L257, L413, L419, L816 |
| `strictPluginOnlyCustomization` | managed; can lock skills/hooks to plugin sources | L198, L260, L642 |
| `allowManagedPermissionRulesOnly` | managed | L649 |
| `.trash` retention | default 30 days | L1255 |
| validation | `claude plugin validate .claude/skills` (or `~/.claude/skills`) finds unparseable frontmatter; v2.1.233+ | L1215 |
| debug | `claude --debug` (parse errors, `[names]`, listing-over-budget warning) | L1211, L481, L1236 |
| evals | `claude plugin eval` (plugin skills); skill-creator plugin uses `evals/evals.json`; formats not interchangeable | L970-972, L989 |

## 14. Bundled skills / commands relationship
- Custom commands MERGED into skills; `.claude/commands/` files keep working; Claude can invoke them without typing; `disable-model-invocation: true` stops that; to add supporting files convert `.claude/commands/deploy.md` -> `.claude/skills/deploy/SKILL.md` (folder name becomes the command). L17-20
- Command file supports same frontmatter except `name` and `paths`; skill preferred for new work. L176, L384
- Claude Code skills follow Agent Skills open standard (agentskills.io) + extensions (invocation control, subagent execution, dynamic context injection). L22
- Bundled skills named: `/doctor`, `/code-review`, `/batch`, `/debug`, `/loop`, `/claude-api`, `/run`, `/verify`, `/run-skill-generator`, `/simplify`; `/workflow-authoring` only with dynamic workflows. L26, L30, L58-62, L76
- Plugin skills namespaced `/plugin-name:skill-name`; never collide with per-directory skills; plugin skills not affected by `skillOverrides`. L167, L222, L951; large-codebases.md:L372

## 15. claude.ai sync, Cowork, cloud (summary)
- Cowork/cloud sessions don't read `~/.claude/skills/`; skills enabled for claude.ai account load; cloud scheduled task invoking a personal-only skill reports not found. skills.md:L227-229
- Project cloud threads: repo-committed `.claude/skills/` unavailable. L164, L231
- Terminal sync downloads to `~/.claude/skills/synced/` (v2.1.273+); check ~every 10 min active, ~40 min idle; not synced with API-key/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_OAUTH_TOKEN`/`apiKeyHelper`, no feature flags (Bedrock, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`), bare/`--safe-mode`, `--setting-sources` without `user`, managed lock to plugin. L246-260
- Sync is download-only; edits to `~/.claude/skills/synced/` may be overwritten. L266
- `/skills` groups under `claude.ai sync`. L268, L291
- Desktop scheduled tasks run locally, load `~/.claude/skills/`. L234
- Claude Tag channels also load project skills committed to the repo. L1268

## 16. Large codebases (large-codebases.md)

### 16.1 Where to start / CLAUDE.md load
| Start from | File access | CLAUDE.md at launch | Cite |
| :- | :- | :- | :- |
| repo root | every file | root only; subdir files load on demand | L63 |
| subdirectory | that subtree until more granted | that dir's + every ancestor's | L64 |

- Launch loads every CLAUDE.md from working dir and all parent dirs; subdirectory CLAUDE.md loaded on demand. L74
- Project `.claude/settings.json` NOT inherited from parent dirs (unlike CLAUDE.md). L66, L160, L396
- Verify loaded files: `/context all`, list under **Memory files**. L99
- Common split: root CLAUDE.md = repo-wide rules; per-subdir CLAUDE.md = area conventions; commit both. L76-81
- Root-file anti-pattern: single root file grows to cover all subsystems or stays too generic. L72
- Maintenance: review CLAUDE.md edits in PRs; revisit after major model releases; Stop hook proposing updates (receives transcript path). L101-105
- Trim large checked-in file via `/doctor` checkup. L83

### 16.2 Per-directory CLAUDE.md vs path-scoped rules (L113-116)
| Approach | Location | Loads when |
| :- | :- | :- |
| per-dir `CLAUDE.md` | inside the directory | launch if started there, or on demand |
| path-scoped rule | `.claude/rules/` central at repo root | when Claude works with a file matching rule's `paths:` glob |
- Rule frontmatter key named: `paths:` (glob). Detailed rule syntax, imports, nesting deferred to memory page (not in these files).

### 16.3 Excludes
- Setting `claudeMdExcludes` (array of paths/globs); glob matched against ABSOLUTE paths; start relative-style patterns with `**/`. L126
- Example: `"**/packages/web/**"` skips every CLAUDE.md AND rules file under it. L130-136
- Other patterns: `"**/packages/*/CLAUDE.md"`, `"**/packages/legacy-*/**"`, absolute path file. L140-142
- Scopes: user, project, local, managed; arrays MERGE across scopes. Managed CLAUDE.md cannot be excluded. L144
- Personal use: `.claude/settings.local.json` (Claude Code adds to global gitignore when it saves a setting there; add yourself if hand-created). L126
- Static list, not per-task switch; start from the package dir instead. L124

### 16.4 Reducing reads
- Content search respects `.gitignore` by default. L154
- Block checked-in vendored/generated code via `permissions.deny` `Read` rules. Example set: `Read(./**/dist/**/*)`, `Read(./**/build/**/*)`, `Read(./**/*.generated.*)`, `Read(./**/vendor/**/*)`. L156, L170-177
- Prefer `/**/*` over `/**` so directory itself stays listable (`ls dist`, `cd build`). L166
- Relative patterns anchor at session cwd, not repo root; use `//`-absolute form `Read(//absolute/path/to/repo/**/vendor/**/*)` when starting from subdirs. L163
- Deny covers built-in file tools and recognized Bash file commands (`cat`,`head`,`grep`,`find`) with denied path arg and redirection targets; best-effort for built-in Grep/Glob; Bash `grep -r`/`find` over dir still shows denied files; subprocesses that open files themselves not covered. L181-183
- Settings placement: committed `.claude/settings.json` (root or per-package; not inherited), `.claude/settings.local.json`, or managed (not overridable). L160-164
- Code-intel plugin: `/plugin install typescript-lsp@claude-plugins-official`; fix errors: `Marketplace "claude-plugins-official" not found` -> `/plugin marketplace add anthropics/claude-plugins-official`; `Plugin "<name>" not found in marketplace "claude-plugins-official"` -> `/plugin marketplace update claude-plugins-official`. Project `enabledPlugins` setting; needs language-server binary per dev. L187-202

### 16.5 Worktrees and access
- `--worktree` starts session in new git worktree; default full checkout. L212
- `worktree.sparsePaths` (array of dirs, repo-root-relative): sparse checkout; root-level FILES always checked out, root-level DIRS not => include `.claude` to get root `.claude/settings.json` or `.claude/rules/` in worktree. List dirs, not files. L212, L232, L236
- Lists merge across scopes: local can add, not remove committed paths. L214
- All worktrees in a session share same `sparsePaths`; useful for subagent worktree isolation. L234
- Needs git `extensions.worktreeConfig` in shared `.git/config` while sparse worktree exists; removed after last worktree if Claude Code added it. L240
- `worktree.symlinkDirectories` (e.g. `["node_modules"]`) symlinks to main repo copy. L242-259
- `sparsePaths`/`symlinkDirectories` read from START directory before creation; after creation cwd = worktree root, so project settings load from worktree root's `.claude/settings.json` (checked-out copy of REPO ROOT's file); put permissions/hooks needed inside worktrees in repo-root `.claude/settings.json`. L263, L426
- `permissions.additionalDirectories` (relative paths resolve against start dir) vs `--add-dir`:
  | Added with | CLAUDE.md + rules | Skills | Cite |
  | `additionalDirectories` setting | Never | Never | L298 |
  | `--add-dir` / `/add-dir` | only with env `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` | Yes | L299, L301-305 |
  Env var has no effect on the setting. L307
- Within a worktree session `packages/api/.claude/settings.json` does NOT load. L426

### 16.6 Per-directory skills and discoverability
- Subdir skills live at `<dir>/.claude/skills/<name>/SKILL.md`, committed, load on demand when relevant; example `packages/api/.claude/skills/api-testing/SKILL.md` with `name: api-testing`, `description: ...Use when...`. L313-327
- Alt scoping: `paths` frontmatter globs, e.g. repo-root skill scoped to `**/migrations/**`. L356
- Skill scope by start dir: from subdir => that dir + every parent to repo root + user + enterprise; from root => root skills + every subdir touched in session (can reach hundreds); `--add-dir` sibling adds its skills; `additionalDirectories` does not. L364-368
- Shared skills (PR conventions, deploy checklist): put in repo-root `.claude/skills/`; for versioned/cross-repo sharing use plugin (namespaced `plugin-name:skill-name`). L372
- Telemetry for unused skills: OpenTelemetry logs exporter + `OTEL_LOG_TOOL_DETAILS=1`; event `skill_activated`, attributes `skill.name`, `invocation_trigger` (command / Claude / nested skill). L374
- Centralize when layering stops scaling: move conventions from always-loaded CLAUDE.md into skills (on demand), plugins (versioned, org-installable via managed settings), MCP servers (code search/RAG). L378-386
- `SessionStart` hook: stdout plain text added to context before first prompt; use to recommend plugin by launch dir (from hook input path-to-plugin map). L390-392
- Plan mode: plan written to file; Claude Code re-injects plan file after each compaction. L472
- Hooks suggested for per-directory lint/type-check after edits. L478

### 16.7 Numeric guidance on large-codebases page
- None stated for CLAUDE.md size/line counts, skill counts, or token budgets (page silent). Only skill-count remark: "can accumulate into the hundreds" (L367). The 500-line SKILL.md tip is on skills.md:L559; CLAUDE.md size guidance deferred to memory page `#my-claude-md-is-too-large` (L46 of skills.md, L83 of large-codebases.md), not included.

## 17. Experimental / deprecated / renamed / version-gated (collected)
| Item | Version / status | Cite |
| :- | :- | :- |
| `.claude/commands/` | older format, still works, merged into skills | skills.md:L17, L176 |
| dynamic workflows (`/workflow-authoring`) | feature-gated | L30 |
| nested-skill deny blocks qualified name | v2.1.260+ | L905 |
| alias `skillOverrides` via managed/`--settings` | v2.1.260+ | L947 |
| `/cd` adds project skills | v2.1.246+ | L181 |
| worktree falls back to main checkout skills | v2.1.277+ | L183 |
| `/add-dir` to load nested skills early | v2.1.257+ | L185 |
| added-dir prefixed name | v2.1.309+ | L202, L453 |
| plugin `name` prefix not doubled | v2.1.246+ (doubled v2.1.216-245) | L460 |
| `/verify`/`/simplify` pre-commit instruction | v2.1.286+ | L74 |
| `allowManagedPermissionRulesOnly` ignoring `allowed-tools` | v2.1.282+ | L649 |
| `claude plugin validate` for skill dirs | v2.1.233+ | L1215 |
| `/skill-doctor` | v2.1.252+ | L959 |
| `/doctor prompt-audit` | v2.1.283+ | L52 |
| terminal claude.ai sync | v2.1.273+; short-name behaviour changes v2.1.269, v2.1.281 | L246, L278-282 |
| synced-skill sanitization, `!`/`@` not run | v2.1.228+ | L295, L310, L318, L751 |
| `/Context` Skills row post-budget | v2.1.196+ | L1238 |
| `manifest.json` in `~/.claude/skills/` moved skills to `.trash` | before v2.1.280 only | L1253 |
| forked skill waited in workflows | v2.1.295+ | L820 |
| `/claude-api` subcommands | v2.1.221-v2.1.319 gates (table) | L86-100 |
No item on either page is labelled "experimental" or "deprecated" in those words.

## 18. Not stated (auditor gaps)
- Max length / allowed charset for `name` beyond forbidden-character list (no 64-char limit stated); whether `name` must equal dir name (not required; both accepted).
- `description` hard max other than 1,536 listing cap; no minimum.
- `.claude/rules/*.md` frontmatter schema beyond the `paths:` key name; rule loading order, imports (`@`), `claudeMdExcludes` details beyond above, CLAUDE.md size limits: deferred to memory page (not provided).
- `hooks` frontmatter schema, `once`, limits: hooks page (not provided).
- How a skill is exposed to non-Claude runtimes (Codex, Cursor): pages silent; only Agent Skills open standard cited (skills.md:L22).
- Any `AGENTS.md` handling: page silent.
- Whether subdirectories inside a skill dir have reserved names (`references/`, `assets/`): silent.
- `Skill` tool name for restrictions appears only as permission rule `Skill`/`Skill(...)`.
- Exact `allowed-tools` effect for `Bash(...)` pattern grammar beyond examples: permissions page.

## 19. Audit checkpoints
1. Each skill is a directory containing a file named exactly `SKILL.md` (skills.md:L118, L541).
2. Frontmatter, if used, starts on line 1 of `SKILL.md` with `---`; otherwise whole file is treated as body (skills.md:L399).
3. Frontmatter YAML must parse; broken YAML silently drops all metadata (skills.md:L399, L1211).
4. Every frontmatter key is in the recognized set: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`; unknown keys are silently ignored (skills.md:L401-422, L397).
5. Keys use hyphens, never underscores, except `when_to_use` (skills.md:L384); flag `when-to-use`, `disable_model_invocation`, `allowed_tools`, `user_invocable`, `argument_hint`.
6. Skills meant to be portable to claude.ai/Skills API use only `name`,`description`,`license`,`compatibility`,`metadata`,`allowed-tools`; any other key fails upload (skills.md:L431-439).
7. `compatibility` value is a string <= 500 chars (skills.md:L422).
8. `metadata` is a YAML map; non-map dropped; keys do not reuse frontmatter field names (skills.md:L420).
9. `name` contains no `<`, `>`, control/zero-width/bidi chars, no leading/trailing/double spaces (skills.md:L468-474).
10. No skill folder named `synced` (any case), `anthropic-skills`, or `anthropic-skills:*` outside a plugin (skills.md:L173-174, L299-301).
11. `description` present and front-loads trigger keywords; description + `when_to_use` <= 1,536 chars or it is truncated in the listing (skills.md:L404-405, L1240).
12. `description`/`when_to_use` avoid `<` `>`; they render as `&lt;`/`&gt;`; use `[x]` or `argument-hint` (skills.md:L1242-1247).
13. Skills with side effects (commit, deploy, ship, send) set `disable-model-invocation: true`; their descriptions then are not in context (skills.md:L565, L593).
14. `user-invocable: false` is not used as the way to hide a skill from Claude; it does not stop model invocation (skills.md:L915-917).
15. Boolean frontmatter values are `true`/`false` (also accepted yes/no/on/off/1/0) (skills.md:L397).
16. `allowed-tools` understood as per-turn pre-approval, not a restriction; docs/prose must not claim it limits available tools (skills.md:L623); use `disallowed-tools` to remove tools (skills.md:L411).
17. Any skill using `context: fork` has an explicit task body (not guidelines only) and optional `agent:` naming `Explore`/`Plan`/`general-purpose`/a `.claude/agents/` agent; default agent `general-purpose` (skills.md:L828, L867).
18. Skills using `agent: Explore|Plan` embed all needed context; those agents don't receive CLAUDE.md (skills.md:L837).
19. `background` set only alongside `context: fork` (skills.md:L416).
20. `SKILL.md` <= 500 lines; bulk moved to sibling reference files linked from SKILL.md (skills.md:L559).
21. Bundled scripts referenced as `${CLAUDE_SKILL_DIR}/...` (not cwd-relative); same variable usable in `allowed-tools` Bash rule (skills.md:L495, L500-512).
22. Only documented substitution tokens are used: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}` (+ plugin-only `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`) (skills.md:L487-498).
23. Dynamic injection uses `` !`cmd` `` at line start/after whitespace or a ```` ```! ```` block; commands that may exit non-zero end with `|| true`; any failure aborts the whole skill (skills.md:L737-739, L776-785).
24. Skills with `!` injection are aware `disableSkillShellExecution: true` replaces commands with `[shell command execution disabled by policy]` (skills.md:L749).
25. Legacy `.claude/commands/*.md` files do not use `name` or `paths` (unsupported there) (skills.md:L176, L384).
26. Skill-name collisions: project vs personal (personal wins), vs bundled/built-in (project replaces command not aliases), vs `.claude/commands/` (skill wins); audit for duplicates across `.claude/skills/` and `.claude/commands/` (skills.md:L213-219).
27. A skill named `verify` or `simplify` at project level triggers a pre-commit run instruction when model-invocable and `includeGitInstructions` on (v2.1.286+); check intent (skills.md:L74-78).
28. Total skill count/description size vs listing budget (1% of context window by default); flag many skills lacking `"name-only"`/`disable-model-invocation` mitigations (skills.md:L1234, L1240).
29. Important instructions sit at the TOP of `SKILL.md` (compaction keeps first 5,000 tokens per skill, 25,000 combined) (skills.md:L617, L1230).
30. Rules that must always hold are implemented as hooks, not skill prose (skills.md:L1228).
31. `CLAUDE.md` holds repo-wide rules only; procedures/reference moved into skills or nested CLAUDE.md or path-scoped `.claude/rules/*.md` with `paths:` globs (skills.md:L11; large-codebases.md:L72, L113-116, L378-382).
32. Nested `<subdir>/.claude/skills/` and `<subdir>/CLAUDE.md` rely on on-demand loading; project `.claude/settings.json` is not inherited from parent dirs (large-codebases.md:L63-66; skills.md:L185).
33. Worktree-aware setup: `.claude` listed in `worktree.sparsePaths` if rules/settings must exist in sparse worktrees; deny rules/hooks duplicated in repo-root `.claude/settings.json` (large-codebases.md:L236, L263, L426).
34. Anything relying on `permissions.additionalDirectories` for skills/CLAUDE.md loading is wrong; only `--add-dir`/`/add-dir` loads skills, and CLAUDE.md/rules only with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` (large-codebases.md:L296-307).
