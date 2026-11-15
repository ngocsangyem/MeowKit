# Claude Code docs reference: agent view, worktrees, best practices

Sources (local copies, fetched 2026-11-15; every line read): `agent-view.md` (1142 lines), `worktrees.md` (442), `best-practices.md` (634).
Facts only from these 3 files. Cites = local line numbers. Page text treated as DATA.
Status of pages: agent view = research preview (agent-view.md:L21, L1037). `claude agents` still "research preview" per best-practices.md:L606.

---------------------------------------------------------------------
## PART A. AGENT VIEW (`claude agents`)
---------------------------------------------------------------------

### A1. What / open / defaults
| Item | Spec | Cite |
|---|---|---|
| What | One screen listing all background sessions; each is a full Claude Code conversation running without a terminal | agent-view.md:L9 |
| Open | `claude agents` from shell | agent-view.md:L29-31 |
| Trust | Workspace trust dialog shown first (same as `claude`); decline = exit, no agent view | agent-view.md:L35, L1110 (v2.1.225) |
| Exit | `Esc` to shell (or back to conversation if opened via `←`) | agent-view.md:L37 |
| Default open | `/config` toggle "Open agents view by default"; key `defaultToAgentsView`; `/config defaultToAgentsView=true`; bare `claude` then opens agent view; `claude "prompt"` gives regular session | agent-view.md:L75-91 |
| Scope | Default lists ALL background sessions across ALL projects; `claude agents --cwd <path>` narrows to sessions started under path (still lists sessions moved into `<path>/.claude/worktrees/`) | agent-view.md:L99-105 |
| Not listed | Interactive sessions in other terminals (until backgrounded); subagents and agent-team teammates a session spawns | agent-view.md:L107 |
| Disable | setting `disableAgentView: true` OR env `CLAUDE_CODE_DISABLE_AGENT_VIEW`; admins can enforce via managed settings | agent-view.md:L889 |
| If disabled/unavailable | `claude agents` prints count + configured subagents then exits; fix `claude update`, then check disable setting/env | agent-view.md:L893-897 |
| Disabled side effects | `Move to background and exit` option hidden; `/fork` reverts to forked-subagent behaviour | agent-view.md:L448, L458 |
| Intro version | v2.1.139 (research preview) | agent-view.md:L1142 |

### A2. Ways a session becomes a background session
| Route | Detail | Cite |
|---|---|---|
| Dispatch input in agent view | Each prompt + Enter = NEW session (never a follow-up). Min prompt length 4 chars else `Too short` | agent-view.md:L43, L921 |
| `/background` or `/bg` (inside session) | Moves current conversation; optional prompt `/bg <instruction>`; fresh session with no messages: `/bg` asks to send a message first | agent-view.md:L59, L446 |
| `←` on empty prompt (foreground session) | Single press backgrounds + opens agent view; disable via setting `leftArrowOpensAgents` in `/config`; footer hint `← for agents` (10s), `← N agents`, `← 99+ agents`, `← N done` | agent-view.md:L61-67, L264, L294 |
| `/fork` | Copies conversation to new background session, original keeps running; carries model, permission mode, effort, added dirs, "don't ask again" grants; independent afterwards | agent-view.md:L452-456 |
| `claude --bg "<prompt>"` / `--background` | Straight to background; prompt is positional | agent-view.md:L511-515 |
| `claude --bg --exec 'pytest -x'` | Shell job (PTY-backed, no model); output only in memory; row auto-cleans ~5 min after exit; also `!` prefix in dispatch input | agent-view.md:L571-581 |
| `claude --resume <full-session-id> --bg "<prompt>"` | v2.1.257+: continues same ID or starts copy + `note:` line. `--bg` with `--continue`, bare `--resume`, or `--resume <name/path>` always starts a copy; `--fork-session` = copy on purpose | agent-view.md:L531-539 |
| `--name "<n>"` | Sets display name | agent-view.md:L541-545 |
| `--agent <name> --bg` | Runs custom subagent as main agent; unknown name => session exits with `--agent '<name>' not found` (v2.1.191) | agent-view.md:L521-527, L1133 |
| `--bg` + `-p`/`--print` | Rejected before session creation | agent-view.md:L517 |
| `--bg` output | `backgrounded · <shortid> · <name>` + hints for `claude agents`, `claude attach <id>`, `claude logs <id>`, `claude stop <id>` | agent-view.md:L547-555 |
| `--bg` parsing | Read as flag only before bare `--` and not as another flag's value; ambiguous position => error `Couldn't tell whether --bg is a flag or text here` (v2.1.299) | agent-view.md:L565-567, L1061 |
| `--bg` in untrusted dir | Trust dialog; scripts: error `Workspace not trusted` (v2.1.281) | agent-view.md:L519, L1073 |
| `claude --bg --safe-mode` | Session runs with customizations off; peek shows `safe mode · customizations are off`; to resume with customizations: `claude stop <id>` then `claude --resume` | agent-view.md:L214 |

### A3. Dispatch input prefixes / commands
| Input | Effect | Cite |
|---|---|---|
| `<agent-name> <prompt>` | First word matching custom subagent name runs it as main agent (frontmatter config applies) | agent-view.md:L403 |
| `@<agent-name>` | Same, anywhere in prompt. Subagent beats sibling repo of same name | agent-view.md:L404, L422 |
| `@<repo>` | Run session in that repo. `@` lists: git repos one level below launch dir; registered worktrees of launch repo that live inside its tree (e.g. `.claude/worktrees/`, labeled with branch); dirs already having a session. Worktrees outside repo (`git worktree add ../feature`) NOT listed; dirs with spaces not listed | agent-view.md:L405, L429-435 |
| `/<command>` | Suggest skills/commands; skills, user commands, prompt-expanding built-ins (`/init`) are sent to a NEW session as its first prompt | agent-view.md:L406, L418 |
| `! <command>` | Background shell job | agent-view.md:L407 |
| `#<n>` / PR or MR URL | Selects existing row if a session already works on it | agent-view.md:L408 |
| Local commands | `/exit`, `/quit`, `/logout`, `/login`, `/model`, `/effort`, `/fast` (`/effort`, `/fast`, bare `/model` need v2.1.299+), bare `/resume` or `/continue` | agent-view.md:L412-416 |
| Unavailable built-in | Hint `isn't available in agent view`; text stays in input; attach to a session to run it | agent-view.md:L418 |
| Recurring tasks | Package as a skill to dispatch repeatedly | agent-view.md:L420 |
| Target dir | Defaults to dir agent view was opened from; in directory grouping, dispatch goes to selected row's dir; or `cd` + `claude --bg` | agent-view.md:L426-438 |

### A4. Session states and shapes
| State (UI) | Meaning | Cite |
|---|---|---|
| Working (animated) | running tools / generating | agent-view.md:L135 |
| Needs input (yellow) | question, permission decision, sandbox prompt, MCP elicitation; commands needing attached terminal (`/install-github-app`, `/mcp` list) hold unattended session here | agent-view.md:L136, L244 |
| Idle (dim) | nothing to do | agent-view.md:L137 |
| Completed (green) | finished OK | agent-view.md:L138 |
| Failed (red) | ended with error | agent-view.md:L139 |
| Stopped (grey) | `Ctrl+X`, `claude stop`, external process kill, or ended while service off | agent-view.md:L140 |
| Group names | `Ready for review` (open PR needing review/failing checks), `Needs input`, `Working`, `Completed` (= finished+failed+stopped); `Ctrl+S` toggles group by state/directory, persisted | agent-view.md:L307-309 |
| Shapes | `✻`/animated `✽` process running or needs input; `∙` process exited (reply/Enter restarts from saved conversation); `✢` `/loop` sleeping | agent-view.md:L146-148 |
| PR label | `#N` (GitHub) or `!N` (GitLab MR); colors yellow/green/purple/grey; `3 PRs` count form; `FORCE_HYPERLINK=0` => plain text | agent-view.md:L178-199 |
| Row summaries | Haiku-class model; billed via normal provider; third-party: `ANTHROPIC_DEFAULT_HAIKU_MODEL`; working row text updates at most every 15 s | agent-view.md:L166-174 |
| `/status` | `Session kind` row: `background job · attached`, `background job · unattended`, or `interactive` (v2.1.221) | agent-view.md:L840, L1111 |

### A5. Attach / detach / peek
| Item | Spec | Cite |
|---|---|---|
| Peek | `Space`; reply + Enter; `!` prefix = Bash; `/stop` exactly = stop at once | agent-view.md:L49, L218-221 |
| Reply to working session | `/model`, `/effort`, `/rename`, `/usage` run immediately; others join message queue; other commands wait for turn end | agent-view.md:L220 |
| Reply cannot answer dialogs | permission prompt / sandbox / MCP elicitation: reply waits in queue; must attach with `→` | agent-view.md:L228 |
| Hook output invalid | Row shows hook event + `hook output invalid:` + validation error when `PermissionRequest` or `PreToolUse` hook returns unvalidatable output; session still waits | agent-view.md:L230 |
| Attach | `Enter`/`→`, or `claude attach <id|name>` (name needs v2.1.290+; by name only while process running); recap posted on attach | agent-view.md:L53, L240, L802 |
| Attached rendering | Always fullscreen mode regardless of `tui` setting; does not report status to terminal | agent-view.md:L246-248 |
| Detach | `←` on empty prompt, `/exit`, double `Ctrl+C`/`Ctrl+D`, `Ctrl+Z`; detaching never stops session; `/stop` ends from inside | agent-view.md:L250-260 |
| Backgrounding waits | Waits for running tool; ~10 s cap, but keeps waiting for foreground subagents, pending permission prompt/question; cancelled by unsent input or stopped turn; queued message that can't move blocks | agent-view.md:L280-288 |
| Shell command in foreground at move | Stopped on backgrounding; Claude may re-run it; `Ctrl+B` turns it into a background command first | agent-view.md:L290 |
| Prompt sent during move | Not sent if `SessionStart` hooks still running (silently); kept in prompt history | agent-view.md:L296-303 |
| Task list | Moves with the conversation | agent-view.md:L276 |

### A6. Keys (all in agent view)
`↑/↓`, `PgUp/PgDn`, `Home/End`, `Enter` (attach or submit), `Space` (peek), `Shift+Enter` newline, `Ctrl+Enter` dispatch+attach, `→`, `Alt+1..9`, `Tab`, `Ctrl+S` (group switch), `Ctrl+T` (pin; keeps process running), `Ctrl+F` (find, `n:`), `Alt+↑/↓`, `Ctrl+R` (rename), `Ctrl+G` ($VISUAL/$EDITOR), `Ctrl+J`, `Ctrl+X` (stop; again within 2 s = delete), `Shift+↑/↓` (reorder), `Esc`, `Ctrl+Y`, `Ctrl+C`, `?` (agent-view.md:L357-381). Rebind via `keybindings.json`, `Agents` context actions `agents:switchView`, `agents:togglePin`; `Ctrl+G` via `Chat` context `chat:externalEditor` (agent-view.md:L383, L1083).

Filters in dispatch input: `a:<name>`, `s:<state>` (`s:blocked` = waiting on you, `s:ready`), `n:<text>` (v2.1.287+), `o:<text>`, `#1234`/PR URL, other URL = first prompt match; combine by space (agent-view.md:L340-349).

### A7. Hosting: supervisor, state on disk, env
| Item | Spec | Cite |
|---|---|---|
| Hosting model | Every session listed is a background session; each is its own Claude Code process under a "supervisor" background service; started first time you background or open agent view | agent-view.md:L838, L844-846 |
| Process lifecycle | Working/paused-on-dialog/attached: kept. Finished or waiting, unattached ~1 h: process stopped (conversation on disk; resumes on attach/reply); pin with `Ctrl+T`. Exited unexpectedly: supervisor restarts it (self-backgrounded then killed = marked stopped). Auto-update: supervisor restarts itself, moves idle sessions; busy ones not interrupted | agent-view.md:L847-851 |
| Supervisor dies | macOS/Linux: sessions stop unless new supervisor within ~1 min (`claude agents` starts one); v2.1.295: exiting `claude agents` with no supervisor does NOT start one | agent-view.md:L852, L858-868, L1064 |
| Carry-over on process restart | background shell cmds + background subagents carry over; dynamic workflow only if Claude relaunches; monitors and subagent shell cmds stop; `CLAUDE_CODE_DISABLE_BG_EXIT_HANDOFF=1` stops everything with the process | agent-view.md:L854 |
| Sleep/shutdown | Sleep preserves sessions; shutdown stops them. <48 h => shows failed (reply restarts); >48 h => stopped `ended while the background service was off` (press Enter twice) | agent-view.md:L160, L925-934 |
| Paths | `~/.claude/daemon.log`; `~/.claude/daemon/roster.json`; `~/.claude/jobs/<id>/state.json`; `~/.claude/jobs/<id>/tmp/` (Write/Edit there do not prompt; removed on delete); `~/.claude/daemon.lock` | agent-view.md:L874-879, L986 |
| Config dir | `CLAUDE_CONFIG_DIR` => separate supervisor instance with own sessions | agent-view.md:L872 |
| Env in session | `CLAUDE_JOB_DIR` = `~/.claude/jobs/<id>`; use `$CLAUDE_JOB_DIR/tmp` for temp files | agent-view.md:L881, L834 |
| Stable interface | `claude agents --json` only. Files under `~/.claude/jobs/<id>/` NOT stable; writes to `state`, `detail`, `tempo`, `needs` are overwritten | agent-view.md:L154, L832 |
| Daemon cmds | `claude daemon status`, `claude daemon logs`, `claude daemon stop --any [--keep-workers]` | agent-view.md:L798-800 |
| Hooks/notifications | Agent view fires `Notification` hook with type `agent_needs_input` or `agent_completed` via `preferredNotifChannel`; `/loop` sessions notify only on needs-input | agent-view.md:L156, L1130 |
| macOS | Host process needs separate Files & Folders / Full Disk Access grant; Local Network permission on macOS 15+ | agent-view.md:L1013-1021 |

### A8. CLI session management
| Command | Purpose | Cite |
|---|---|---|
| `claude agents [--cwd <path>] [--json [--all]]` | open / list; `--json` entry fields: `cwd`,`kind`(`interactive`/`background`),`startedAt`(unix ms) always; `id`,`state` (`working`/`blocked`/`done`/`failed`/`stopped`) for background; `pid`,`status` (`busy`/`waiting`/`idle`) while alive; `waitingFor` (`permission prompt`,`input needed`,`sandbox request`,`worker request`,`dialog open`); `sessionId`,`name` | agent-view.md:L786-789, L806-817 |
| `claude attach <id|name>`, `claude logs <id|name>` | name matching v2.1.290+ | agent-view.md:L790-791, L802 |
| `claude stop <id>` (alias `claude kill`) | stop | agent-view.md:L792 |
| `claude respawn <id>` / `--all` | restart (e.g. new binary) | agent-view.md:L793-794 |
| `claude rm <id>` | remove row + Claude-created worktree if safe; `--discard-unpushed <commit>@<worktree-id>` (v2.1.260+), `--force-remove-worktree <worktree-id>` (v2.1.268+) | agent-view.md:L795-797 |
| Scripting poll | `claude agents --json --all`; `done` = finished turn and ready for next prompt, `blocked` always means needs something from user | agent-view.md:L821-830 |

### A9. What a background session loads / settings / permissions (audit-critical)
| Item | Spec | Cite |
|---|---|---|
| Settings | Read from the directory the session runs in, "same as if you had started `claude` there" plus carried flags; includes project-settings `env` block | agent-view.md:L691 |
| Shell env | Runs with `PATH` of dispatching shell; keeps `CLAUDE_CODE_USE_BEDROCK`/`CLAUDE_CODE_USE_VERTEX`, `ANTHROPIC_DEFAULT_*_MODEL`, `CLAUDE_CODE_EXTRA_BODY` | agent-view.md:L693 |
| Gateway | Put gateway vars in a settings file `env` block; shell-exported `ANTHROPIC_BASE_URL`/`ANTHROPIC_CUSTOM_HEADERS` reach session only in limited cases (supervisor shares gateway env; same dir); never written to disk; error `No LLM gateway` when dispatched from other dir; fix `claude respawn <id>` | agent-view.md:L697-708, L1003-1011 |
| Config flags carried on backgrounding | `--mcp-config`, `--strict-mcp-config`, `--settings`, `--setting-sources`, `--add-dir`, `--plugin-dir`, `--fallback-model`, `--allow-dangerously-skip-permissions`, plus `/add-dir` dirs | agent-view.md:L491-501 |
| `claude agents` flags | `--settings`, `--setting-sources`, `--add-dir`, `--plugin-dir`, `--mcp-config`, `--strict-mcp-config` passed through to dispatched sessions; repeat flag per value (no space-separated); `--add-dir`/`--mcp-config` must come AFTER `agents` else `--json` fails `unknown option`; `--settings` file must exist | agent-view.md:L758-779 |
| Plugins | Loaded plugins/MCP via these flags available in dispatched sessions. v2.1.251: session starting during marketplace refresh previously could start without skills/agents/hooks/MCP servers of that marketplace | agent-view.md:L758, L1090 |
| Subagent as main agent | Resume/restart restores agent + tool restrictions; searches session's own dir first if workspace trusted; missing agent => default tools + transcript warning | agent-view.md:L529, L1115 |
| Skills/agents/CLAUDE.md/hooks | PAGE IS SILENT on exactly which of CLAUDE.md, rules, skills, agents, hooks a background session loads, beyond "reads settings from the directory it runs in" (L691). Only worktree-specific notes in worktrees.md (see B6) | - |
| Hook events named | `SessionStart` (race with early prompts, L301), `PermissionRequest`/`PreToolUse` (invalid output surfaced, L230), `Notification` (L156), `WorktreeCreate`/`WorktreeRemove` (L592, L646) | as cited |
| Permission mode (`/bg`, `←`) | Keeps current mode | agent-view.md:L712 |
| Permission mode (shell `claude agents`/`--bg`) | Starts as a new `claude` in that dir would (unless dispatch defaults) | agent-view.md:L713 |
| Permission mode (agent view opened with `←`) | 1) target dir `permissions.defaultMode` (`auto`/`bypassPermissions` honored only from managed settings, `--settings` file, or `~/.claude/settings.json`; project `.claude/settings.json`/`.local.json` refused if MORE permissive than originating session); 2) originating session's mode. Permissiveness order: plan < Manual & `dontAsk` < `acceptEdits` & auto < `bypassPermissions` | agent-view.md:L715-724 |
| `bypassPermissions` bg | Needs bypass-disclaimer acceptance on record; if only in `.claude/settings.local.json` or `--settings`, new session starts Manual with notice `Bypass permissions was requested at launch and ignored` | agent-view.md:L720, L744 |
| Dispatch defaults | `claude agents --permission-mode <m> --model <m> --effort <e> --agent <a>`; `--effort` accepts `ultracode`; `--dangerously-skip-permissions`; `--allow-dangerously-skip-permissions`; `--restricted` (v2.1.248+); `agent` setting is fallback for `--agent`, else built-in `claude` agent | agent-view.md:L728-742 |
| In-view model controls | `/model <name>`, `/effort low|medium|high|xhigh|max`, `/fast on|off`, `default` to undo; scoped to that agent-view window, not saved; a `/model` choice or `claude agents --model` overrides a subagent's frontmatter `model` | agent-view.md:L660-683 |
| Persistence on restart | permission mode, model, effort, carried flags, `/rename` name, `Ctrl+S` stash; effort from settings (`effortLevel` key or `modelSettings` entry) re-read on each process start | agent-view.md:L746-754 |

### A10. Worktree/isolation behaviour of background sessions
| Item | Spec | Cite |
|---|---|---|
| Default | Session starts in working dir; BEFORE editing files, Claude moves it into an isolated git worktree under `.claude/worktrees/`; after that, worktree isolation is enforced for session and its subagents | agent-view.md:L585 |
| Skips worktree when | (1) session was backgrounded via `←`/`/background` (keeps editing in place); (2) already inside a linked git worktree (Claude-made or `git worktree add`); (3) target file inside a linked worktree; (4) working dir not a git repo and no `WorktreeCreate` hook; (5) write outside working dir | agent-view.md:L587-593 |
| Opt-out | `.claude/settings.json`: `{"worktree":{"bgIsolation":"none"}}` (added v2.1.143) | agent-view.md:L595-603, L1139 |
| Non-git | Sessions edit working dir directly, not isolated from each other; with `WorktreeCreate` hook, isolated the same way; hook failure outside git repo => edit in place | agent-view.md:L605-607, L1126 |
| Before move (in git repo) | `Edit`/`Write`/`NotebookEdit` on shared checkout refused until move happens | agent-view.md:L607 |
| Subagents | Inherit session cwd (so land in session worktree); own worktree via `isolation: worktree` frontmatter or `isolation: "worktree"` at spawn | agent-view.md:L611 |
| Finish behaviour (when changes made in worktree Claude entered) | Claude commits without asking, pushes branch if remote exists; opens DRAFT PR when task calls for it; NEVER pushes to `main`/`master`, never force-pushes, never merges. User git instructions in task, `CLAUDE.md`, or memory (e.g. "I handle commit/push") take precedence. Always ends with a report (path/branch/PR/answer) | agent-view.md:L613-622 |
| Non-isolated checkout | Asks before committing or switching branches (isolation `none`, failed move, or session started inside pre-existing worktree) | agent-view.md:L620 |
| `/fork` copy | Instructed to create its own worktree before code changes unless it edits in place; never touch originating worktree; base new branch on originating branch if task builds on it; confirmation suffix `runs in the origin tree` or `edits this checkout`. Outside git repo only a copy moved out of a hook-created worktree gets the instruction | agent-view.md:L466-475, L1111 |
| Un-forkable | Sessions with launch flags the copy won't inherit (replaced system prompt, `--tools` allowlist) | agent-view.md:L479 |
| Delete | `Ctrl+X` x2 in agent view removes Claude-created worktree INCLUDING uncommitted changes; `claude rm` keeps it (and the row) if uncommitted changes. Refused for unpushed commits (message names branch/count; v2.1.260+). Kept when another live session runs inside it (v2.1.227). Transcript stays, `claude --resume` works | agent-view.md:L624-638, L1079, L1109 |
| Stays on disk | worktrees user created himself; Claude-created dir whose `.git` file is gone (branch stays) | agent-view.md:L635-638 |
| Locks | Session backgrounded via `←`/`/background` holds `git worktree lock` on its worktree while running (v2.1.248) | agent-view.md:L1093 |
| Leftovers | `.claude/worktrees/` filling up: `git worktree list`, `git worktree remove <path>` | agent-view.md:L1029-1033 |
| Hook messages | `Worktree not removed` (Claude Code or `WorktreeRemove` hook failed); `files that weren't checked against a repository` from `claude rm` | agent-view.md:L644-656 |

### A11. Interaction with subagents / teams / other
- Subagents and teammates are not separate rows (agent-view.md:L107). Comparison of agent view vs subagents/teams/worktrees lives at an external page `agents.md` (agent-view.md:L17), not captured here.
- Backgrounding with foreground subagents running: waits, or restarts them from the beginning on second `←` (agent-view.md:L284). Background subagents/shell cmds/`/loop` carry over; running monitors stop (L485-487).
- Dynamic workflow: not auto-continued after backgrounding; Claude must relaunch; its running subagents restart and re-spend tokens (agent-view.md:L503-507).
- Cross-session messaging: after `/fork`, either session's Claude can message the other where enabled (L456); needs-input row `approve message from` (L1086).
- Limits: usage counts per session (10 agents ~ 10x quota speed); sessions local; stop on machine shutdown; Claude-created worktrees deleted with session (agent-view.md:L1039-1041).

---------------------------------------------------------------------
## PART B. WORKTREES
---------------------------------------------------------------------

### B1. CLI / defaults
| Item | Spec | Cite |
|---|---|---|
| Flag | `claude --worktree <name>` / `-w <name>` | worktrees.md:L24-28 |
| Path | `.claude/worktrees/<name>/` at repo root | worktrees.md:L24 |
| Branch | new branch `worktree-<name>` | worktrees.md:L24 |
| No name | Claude generates one (e.g. `bright-running-fox`) | worktrees.md:L30 |
| Trust | Interactive: needs prior workspace trust else error; `claude -p --worktree` skips trust check | worktrees.md:L32 |
| gitignore | Recommended: add `.claude/worktrees/` to `.gitignore` | worktrees.md:L36 |
| Environment | Fresh checkout; install deps yourself/ask Claude; gitignored files via `.worktreeinclude` | worktrees.md:L40 |
| Reopen same name | Existing worktree opened rather than created; errors `belongs to a different repository` / `is a leftover worktree` | worktrees.md:L231 |
| Defaults summary | under `.claude/worktrees/`, branch from default branch, checks out only tracked files | worktrees.md:L166 |
| PR base | `claude --worktree "#1234"` (quote), GitHub PR URL, GitLab MR URL; creates `.claude/worktrees/pr-<number>`; fetches from `origin`: github.com `pull/<number>/head`; gitlab.com `merge-requests/<number>/head`; other hosts try `pull/` then `merge-requests/`; non-interactive fetch (fails with `Error creating worktree: Failed to fetch PR/MR #<number>`); GitLab/URL forms from v2.1.233 | worktrees.md:L195-209 |

### B2. In-session tools
- `EnterWorktree`: Claude creates a worktree on request, or switches to another under `.claude/worktrees/` by passing target path (worktrees.md:L44). `ExitWorktree` also exists (L57, L84).
- Entering a path OUTSIDE `.claude/worktrees/` prompts for approval; an `EnterWorktree` permission rule / "don't ask again" does not suppress it; only `bypassPermissions` skips (worktrees.md:L46). Move carries cwd, write access, project config (`CLAUDE.md`, settings).
- Both tools removed/refused when `permissions.blockWritesOutsideWorkingDirectories` is on; workarounds: `claude --worktree`; for bg sessions `claude --bg --worktree`, `worktree.bgIsolation: "none"`, or `git worktree add` under the starting dir. Diagnose with `/status` (setting sources) (worktrees.md:L55-67).

### B3. Hooks and worktrees (contract as stated on THIS page)
| Item | Spec | Cite |
|---|---|---|
| `WorktreeCreate` hook | Replaces default git worktree logic ENTIRELY (incl. location other than `.claude/worktrees/`); `.worktreeinclude` NOT processed; copy files inside hook script | worktrees.md:L227, L253, L311 |
| Input | JSON on stdin; example reads name with `jq -r .name` | worktrees.md:L313, L323 |
| Output | Prints the created directory path to stdout (progress to stderr, e.g. `>&2`); that path becomes session cwd | worktrees.md:L313, L323 |
| Settings shape | `{"hooks":{"WorktreeCreate":[{"hooks":[{"type":"command","command":"..."}]}]}}` | worktrees.md:L316-329 |
| `WorktreeRemove` hook | Pair for cleanup at session end; used for hook-created worktrees instead of built-in rules; also invoked on agent-view delete | worktrees.md:L71, L136, L332; agent-view.md:L646 |
| Full input schema, removal example | NOT in these pages (deferred to the hooks reference) | worktrees.md:L332 |
| Failure | Hook printing something other than the dir, or dir deleted => error naming path, exit code 1 | worktrees.md:L342 |
| Hook-created dir | Must be OUTSIDE any git repo, else refused with `git resolves its working tree to` message; dir with no git metadata passes check only when no repo contains it | worktrees.md:L393 |
| Sweep | Hook-created worktrees are never swept (no marker) | worktrees.md:L154 |
| Transcript | Hook-created worktree keeps transcript at launch dir | worktrees.md:L98 |
| `/batch` | A `WorktreeCreate` hook lets `/batch` run outside git (v2.1.281+) | worktrees.md:L334 |
| Existing hooks in worktree | `${CLAUDE_PROJECT_DIR}` STAYS at original project root after `EnterWorktree` (hook command still runs main-checkout script); hook input `cwd` = worktree root and follows `cd` | worktrees.md:L50-53 |
| Desktop-app worktree sessions | Settings, hooks, skills, agents, commands, `.mcp.json` read from MAIN checkout root; hook commands run there; `${CLAUDE_PROJECT_DIR}` = main root; use hook `cwd` for worktree path; `CLAUDE.md` and `.claude/rules/` still load from the worktree | worktrees.md:L270 |

### B4. Base branch and settings keys
| Key | Values | Cite |
|---|---|---|
| `worktree.baseRef` | `"fresh"` (default; default branch on remote, usually `main`) or `"head"` (local `HEAD`, carries unpushed commits; in a worktree resolves to THAT worktree's HEAD). Cannot be a branch name; use `git worktree add` for that | worktrees.md:L170-175 |
| fresh fetch rules | fetch default branch if not fetched in 24 h, cap 5 s, uses cached ref on failure; never prompts (password/passphrase/new-host counts as failure); no remote or no cached `origin/HEAD` => falls back to local `HEAD` | worktrees.md:L177-181 |
| `worktree.bgIsolation` | `"none"` disables bg-session worktree move | worktrees.md:L64; agent-view.md:L595 |
| `worktree.symlinkDirectories` | setting for large dirs (e.g. node_modules) instead of copy | best-practices.md:L594 |
| `cleanupPeriodDays` | age threshold for sweep | worktrees.md:L144 |
| `permissions.blockWritesOutsideWorkingDirectories` | removes `EnterWorktree`/`ExitWorktree` | worktrees.md:L57 |
| Subagent base | Subagent worktrees use same base as `--worktree` (default branch unless `baseRef: "head"`) | worktrees.md:L138 |

### B5. `.worktreeinclude`
- Location: project root. Syntax: `.gitignore` syntax. Only files matching a pattern AND gitignored are copied; tracked files never duplicated (worktrees.md:L213-215).
- Example content: `.env`, `.env.local`, `config/secrets.json` (worktrees.md:L221-225); best-practices example adds `config/dev-credentials.json` (best-practices.md:L588-592).
- `**/` caveat: for files in a wholly-ignored dir, copied only when the dir matches the pattern, or the first name after `**/` is a name in the dir's path (e.g. `**/.claude/skills/*.md` copies out of ignored `.claude/`). Else name the dir: `vendor/**/config.json` not `**/config.json`. Pre-v2.1.239 behaviour narrower (worktrees.md:L217).
- Applies to: `--worktree`, subagent worktrees, desktop-app parallel sessions; not when `WorktreeCreate` hook is used (worktrees.md:L227).
- Copies, does not link: keep to small files; no `node_modules` (best-practices.md:L594).

### B6. What worktrees share / how project config loads
| Item | Spec | Cite |
|---|---|---|
| `.git` | shared repo `.git`; with sandbox, `git commit` works at worktree root; `index.lock` error if `claude` run in a subdirectory of worktree | worktrees.md:L259 |
| Plugins | Project-scope plugins from main checkout load in worktrees | worktrees.md:L260 |
| Permission approvals | "Yes, and don't ask again" in worktree saves to MAIN checkout `.claude/settings.local.json`; applies repo-wide; survives removal (not on Windows / non-repo-root cases) | worktrees.md:L261-263 |
| Untracked skills/agents/commands | If worktree has no `.claude/skills` at its root (e.g. gitignored), main checkout's project skills load; if worktree has its own `.claude/skills`, only that loads; same for `.claude/agents`, `.claude/commands`; skills read-through v2.1.277+ | worktrees.md:L264-266 |
| Apply to | worktrees from `--worktree` or `git worktree add` | worktrees.md:L268 |
| Subagent in own worktree | Takes instruction files it starts with from the MAIN conversation, not its worktree; for worktrees in default `.claude/worktrees/` location it ALSO does not load worktree-root `CLAUDE.md` or `.claude/rules/` when reading files there, even if differing on that branch | worktrees.md:L140 |

### B7. Subagent isolation
- Ask "use worktrees for your agents" or frontmatter `isolation: worktree` in `.claude/agents/*.md` (example `name: refactorer`, `description: ...`, `isolation: worktree`) (worktrees.md:L121-134). Spawn-time form `isolation: "worktree"` (agent-view.md:L611).
- Temporary worktree auto-removed when subagent finishes without changes; with changes stays until sweep (worktrees.md:L136). Subagent worktrees get same four isolation checks (L104).

### B8. Isolation enforcement (four checks, active while session isolated)
Applies to `--worktree`, `EnterWorktree`, resumed worktree sessions, bg sessions, and every spawned subagent (worktrees.md:L102-104):
1. File edits: `Edit`/`Write`/`NotebookEdit` targeting main checkout blocked (L108).
2. Command cwd: Bash/PowerShell/Monitor whose cwd resolves to main checkout or cannot be verified (L109).
3. Git redirects: `git -C`, `--git-dir`, `GIT_DIR`/`GIT_WORK_TREE`, `cd` into main checkout (Bash/Monitor) (L110).
4. Command shape: unverifiable git target (runtime-computed command name, unparseable syntax, `${!name}`, `${ command; }`); cannot be disabled (L111).
- Not tracked: shell writes like `cp` or redirects into main checkout without git there are NOT refused; governed by permissions/sandbox (L113). PowerShell: working-directory check only (L115). Checks cover main checkout a linked worktree is linked from (L115).

### B9. Cleanup rules
| Case | Behaviour | Cite |
|---|---|---|
| Interactive exit, clean, unnamed | removed with branch automatically | worktrees.md:L73 |
| Interactive exit, clean, named | prompts | worktrees.md:L73 |
| Has work (changed/untracked files, submodule uncommitted work, new commits) | prompt keep/remove; keep => resume with `claude --worktree <name> --resume` (command printed on exit) | worktrees.md:L71, L74 |
| On another branch with extra commits | prompt; either answer keeps that other branch | worktrees.md:L75 |
| State unverifiable | prompt naming what couldn't be checked | worktrees.md:L76 |
| `-p` runs | no exit prompt, no cleanup, lock stays until later sweep; remove with `git worktree remove` (+ `git worktree unlock`) | worktrees.md:L78; best-practices.md:L604 |
| Sweep | Periodic; removes Claude-made subagent and bg-session worktrees older than `cleanupPeriodDays`. Skips: holds work (changed/untracked/unpushed); submodule changes/uninspectable (v2.1.274+); LFS/filter-driver blocking cases; `--worktree` session not backgrounded; user-made `git worktree add`; any without Claude's marker in git metadata | worktrees.md:L144-154 |
| Locks | `git worktree lock` held while agent runs / bg session runs; sweep releases Claude's lock for exited process, never user locks | worktrees.md:L158-160 |
| Windows | removal deletes only link for junctions/symlinks inside worktree | worktrees.md:L80 |
| Reset-on-reopen (fresh base) | reopened worktree resets to default branch only if: sandbox not restricting writes AND no sandbox enabled in worktree/main `.claude` settings; clean; still on own branch; no own commits or PR merged + remote branch deleted. Else reopens at old tip (also if `baseRef: "head"`, unverifiable, PR-ref name) | worktrees.md:L233-249 |

### B10. Resume
- Resuming a session that ended inside a worktree returns it there (interactive, `-p` with `--continue`/`--resume`, Agent SDK); `--continue` = most recent session under launch dir; before v2.1.212 non-interactive stayed in start dir (worktrees.md:L84-96).
- Verifies separate checkout; launch from main checkout or repo dir; re-enters Claude-made worktrees under `.claude/worktrees/` even from inside; other worktrees only if verifiable from there (L90). `--fork-session`: starts at launch dir, original untouched (L91). Deleted worktree: resume at launch dir, binding cleared (L92).
- Transcript moves with enter/exit (like `/cd`) (L98).
- Resume failure messages (interactive): `Your worktree <path> no longer exists`, `Could not verify your worktree <path> this time`, `Did not re-enter your worktree <path>`, `Could not re-enter your worktree <path>` (L410-415). In `-p`/SDK, refusals error to stderr; `stream-json` gives `result` with subtype `error_during_execution`; `startup_failure_reason` = `worktree_unverified` or `worktree_resume_refused` (v2.1.274+) (L417-432).

### B11. Manual worktrees and limitations
- Manual: `git worktree add ../project-feature-a -b feature-a`; existing branch: `git worktree add ../project-bugfix fix-issue-456`; `git worktree list`; `git worktree remove <path>` (worktrees.md:L276-305). Needed for specific existing branch or placing outside repo (L274).
- Non-git VCS (SVN, Perforce, Mercurial): `WorktreeCreate` + `WorktreeRemove` hooks (L311).
- Error `Can only use --worktree in a git repository` when not a git checkout and no hook; fix `git init` + first commit, set hook, or omit `--worktree` (L373-379).
- Refuses symlinked `.claude`, `.claude/worktrees`, or worktree dir (v2.1.212 fix) (L346).
- `git replace` objects: worktree files hold ORIGINAL content (`GIT_NO_REPLACE_OBJECTS=1` forced) (L350).
- Git LFS: with `git lfs install --local` (or any repo-local filter driver) worktrees get pointer files; run `git lfs pull` in worktree; drivers skipped since v2.1.247; four error cases create no worktree: `Could not read the repository git config to neutralize filter drivers`, filter name containing `=`/newline, `includeIf` in repo `.git/config`, `Git was not run: the repository's own git config sets <key>` (L356-367).
- Partial clone error `This repository is a partial clone` (L371).
- `Refusing to use <path> as an isolation worktree` family (L389-404).

---------------------------------------------------------------------
## PART C. BEST PRACTICES
---------------------------------------------------------------------

### C1. Deterministic vs non-deterministic instructions
| Fact | Cite |
|---|---|
| Prompt, `CLAUDE.md`, skills = model reads, no guarantee it follows; hooks, deny rules, managed settings = harness always applies | best-practices.md:L43-44 |
| Table: what to do (CLAUDE.md/skills vs hooks / user-only skills); what it can touch (auto classifier vs deny rules, strict sandbox, managed settings); when done (evidence request, `/goal`, `/code-review` vs tests, typecheck, `Stop` hook, CI); spend (effort vs `--max-turns`, `--max-budget-usd` with `-p`, spend limit); last word (Claude's summary vs branch protection / human merge approval) | best-practices.md:L48-54 |
| Default stance: let Claude decide; hooks only for zero-exception rules | best-practices.md:L56-61 |
| Rule examples for hooks: never edit generated client `src/gen/`; always run license-header script after creating a file | best-practices.md:L60-61 |
| Emphasis on CLAUDE.md line failing => belongs in a hook; hooks that are only preferences => delete | best-practices.md:L67 |
| Adding IMPORTANT will probably not fix an ignored line; either file too long or the line is an exceptionless rule => hook | best-practices.md:L172 |
| "Old advice" table: IMPORTANT / ALL CAPS emphasis is obsolete, over-applies the rule | best-practices.md:L617 |

### C2. CLAUDE.md guidance
- Content test: only what Claude can't find by reading the repo or would rediscover every session; test = could it find it? would it actually look? both yes => omit (best-practices.md:L73-90).
- Keep short: loaded every session, every line costs attention (L135). Include: exact test/typecheck/lint commands + single-test command; misleading places; off-repo decisions; things corrected twice (L137-140).
- Example sections: `# Commands`, `# Conventions`, `# Gotchas` (L144-156). Do not describe architecture/file layout (L622).
- `/context all` to confirm loaded (L158). Typecheck line = command only; enforcement via `Stop` hook; "Always typecheck before you finish" works most of the time (L160).
- `/init` generates start; memory guide recommends under 200 lines; `/doctor` suggests cuts; `/doctor prompt-audit` flags instructions for older models, dead file refs, contradictions (L162-166).
- Personal prefs: `CLAUDE.local.md` + `.gitignore` (L168).
- Worktree bootstrap: keep install command in `CLAUDE.md` so Claude runs it in a new checkout (L594).

### C3. Rules, skills, subagents
| Topic | Spec | Cite |
|---|---|---|
| Path-scoped rules | `.claude/rules/<name>.md` with frontmatter `paths:` list of globs (`"src/api/**/*.ts"`); loads only when working there | best-practices.md:L176-185 |
| Skills | `.claude/skills/<name>/SKILL.md`; for team procedures; skill name+description always in context, full file read on demand => lighter than CLAUDE.md; same "only what Claude can't find" rule | best-practices.md:L189-195 |
| Side-effect skills | frontmatter `disable-model-invocation: true` (user-only `/release`); example frontmatter `name`, `description`, `disable-model-invocation`; steps include "if not main/clean tree stop and ask", "never publish from your machine" | best-practices.md:L197-209 |
| Reviewer subagent | `.claude/agents/reviewer.md` with `name`, `description`, `tools: Read, Grep, Glob` (tool limit enforced by harness); body: review vs spec, "report only gaps that affect correctness. Skip style" | best-practices.md:L471-484 |
| Subagent model cost | `model: haiku` in definition for simple work; ask for short summaries; `/usage` per subagent type | best-practices.md:L468-470 |
| Subagent defaults | Claude delegates on its own: broad searches => built-in Explore agent; side tasks forked (fork mode on by default); subagents run in background by default | best-practices.md:L449-451 |
| Subagent value/cost | Pays off for parallelism, keeping long output out of main context, independent reviewer, restricted tools; costs tokens, may be slower (must regather context); same model so no smarter answer | best-practices.md:L455-464 |
| Old advice dropped | "use subagents to protect context" and "delegate for a better answer" are obsolete (fresh reviewer still helps) | best-practices.md:L618-619 |
| Connect tools | CLI first (`gh`), `--help` for unknown; MCP `claude mcp add --transport http notion https://mcp.notion.com/mcp`; connected MCP servers add tool names/instructions to context even when unused => disable unneeded via `/mcp`; code-intelligence plugin | best-practices.md:L213-223 |

### C4. Hooks (as taught here)
| Item | Spec | Cite |
|---|---|---|
| Handler types | shell command, HTTP POST, MCP tool call, `prompt`/`agent` hook (model decides => NOT deterministic) | best-practices.md:L301-307 |
| Real enforcement | `command` or `http` hook; add `onFailure: "block"` to stop the action if the hook crashes/times out | best-practices.md:L307 |
| `Stop` hook | runs when Claude tries to end turn; exit code 2 blocks stop; stderr returns to Claude as reason; example `"command": "pnpm tsc --noEmit 1>&2 || exit 2"` under `hooks.Stop[].hooks[]` | best-practices.md:L249, L272-286 |
| Stop block cap | 8 consecutive blocked stops with no tool call between => harness overrides, ends turn; raise via env `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` | best-practices.md:L288 |
| `PostToolUse` example | `"matcher": "Edit|Write"`; command `f=$(jq -r '.tool_input.file_path') && npx prettier --write --ignore-unknown "$f"` | best-practices.md:L311-324 |
| `PreToolUse` | exit code 2 for paths under `migrations/`; `/hooks` to view; can be prompted into existence | best-practices.md:L328 |
| Scope of hooks | zero-exception rules only; "Prefer named exports" stays in CLAUDE.md; keep enforced set small (~forty hooks/deny rules = mostly preferences) | best-practices.md:L328, L368 |
| Where a hook lives | `.claude/settings.json` committed => applies to everyone; hooks start only after workspace trust | best-practices.md:L365 |

### C5. Permissions / enforcement placement
- `deny` rules hold in EVERY mode including auto and `bypassPermissions`; example `permissions.allow/ask/deny` with `Read(./.env)`, `Read(./.env.local)`, `Read(./secrets/**)`, `Bash(git push *)` in ask (best-practices.md:L332-342).
- Edges: `Read` deny catches `cat .env` but not a script that opens it; `WebFetch` deny does not stop `curl` unless sandbox on (L346-350). `/sandbox` = OS-level limit on macOS/Linux/WSL2; strict sandbox mode disables retry outside sandbox (L352-354).
- Auto mode = classifier, can be wrong, tunable, org can disable => "never" rules in deny rules or hooks (L358). Deny/ask rules and `PreToolUse` hooks run BEFORE the classifier (L402). Conversational "don't push until I've reviewed" is a block signal but can be lost at compaction => put in deny rule (L406).
- `autoMode` config: `environment`, `allow`, `soft_deny`; keep `"$defaults"` in every list else built-ins replaced; MUST live in `~/.claude/settings.json` (ignored in project settings) (L410-430). Blocks: 3 in a row or 20 total => falls back to asking (L400).
- Scope table: `.claude/settings.local.json` and `~/.claude/settings.json` personal; `.claude/settings.json` + its hooks repo-wide (deny applies at once, `allow` waits for trust dialog); managed settings (admin console/MDM/`managed-settings.json`) not overridable (L364-366).
- Defaults: interactive terminal and VS Code start in auto mode (L13, L378); default model Opus 5.5 at medium effort on most plans (L379); `Shift+Tab` cycles modes; `claude --permission-mode manual`; `/fewer-permission-prompts` (L432).

### C6. Verification and "done"
- Give Claude a pass/fail check (test file, build exit code, linter, fixture diff script, browser screenshot); the single most useful CLAUDE.md line is the command that runs it (best-practices.md:L225-243).
- Four strictness levels: prompt ("run auth tests after, keep going until they pass"); `/goal <condition>` (separate model checks each turn; useful for long background runs); `Stop` hook (enforced); `/code-review` (fresh subagent, no conversation) (L247-250).
- Ask for EVIDENCE (command + output or screenshot), not "all tests pass" (L252). `/verify` builds and runs the app (L256).
- Spec review prompt: "use a subagent to review the rate limiter diff against SPEC.md, check every requirement is implemented and the listed edge cases have tests, report gaps that affect correctness and skip style"; keep `skip style` else reviewer always finds something and you get extra abstractions/tests for impossible cases (L260-268).

### C7. Plan-first / spec / context
- Brainstorm: ask Claude to "Interview me until you could write the spec, then write it to SPEC.md"; then START A FRESH SESSION to build from SPEC.md (best-practices.md:L123-131).
- Specific prompts: name file, symptom, definition of fixed; `@path` to include file; paste images; pipe `cat error.log | claude -p "..."` (L94-107). `be ambitious` still useful for scope; `think step by step`/`be thorough` are ordinary text; effort is the control (L109-117, L620).
- Plan-mode: page does not teach plan-mode as a practice; it only mentions "accept a plan" nowhere. NOT stated.
- Context: 1M window on most current models, auto compaction; `/clear` between unrelated tasks (`/clear <name>` names the session left); `/compact <focus>` e.g. `/compact keep the API changes and the test commands`; `/usage` breakdown by skill/subagent/plugin/MCP server, flags patterns >10% (L490-496).
- Cache: ~1 h on subscription, 5 min on API key/cloud/credits; subagents 5 min; idle >200K tokens session compacted shortly before 1 h cache expiry (L500-502).
- Steer: watch first minute, `Esc` on drift, after TWO failed corrections `/clear` and rewrite prompt rather than third correction (L508-514). `/rewind` or `Esc Esc`; checkpoints cover only files edited with Claude's file tools, not Bash-touched files (L513-518). `/btw` side questions; `/rename <name>` + `claude --resume <name>`; `claude --continue` (L520).
- "Old advice" table also drops: manage context aggressively, delegate for better answer, "keep going / don't be lazy" lines, architecture description in CLAUDE.md (L616-622).

### C8. Failure patterns listed (page's own diagnosis list, best-practices.md:L26-31)
1. Built something different / rediscovers facts each session => missing info not in repo.
2. Said done but not => no way to check own work.
3. Did something that must never happen / skipped required step => prompt alone cannot guarantee; use hooks/deny.
4. Right but too costly (time/tokens/prompts) => change a default.
Also: reviewer always finds something (L268); piling emphasis over-applies rules (L617); CLAUDE.md too long loses lines (L172); conversation instruction lost at compaction (L406); third correction adds failed attempts to context (L514); prompt/agent hooks non-deterministic (L307); auto-mode misjudgment (L358); worktree lacks `.env`/deps (L586); `node_modules` in `.worktreeinclude` = full copies (L594); `claude -p --worktree` not auto-cleaned (L604); overnight run building on wrong assumption (L528).

### C9. Unattended / headless / fan-out
| Item | Spec | Cite |
|---|---|---|
| Five questions before unattended run | knows what done looks like (goal/spec/failing test); can check own work (tests/`Stop` hook/review); what it may touch (permission rules, `dontAsk`, sandbox, a worktree, the one branch it may push to); what stops it (`--max-turns`, `--max-budget-usd`, spend limit); where result goes and who signs off | best-practices.md:L530-538 |
| Script flags | `claude -p "prompt"`; `--bare` (skips hooks, skills, plugins, MCP servers, `CLAUDE.md` repo AND machine; auth only from `ANTHROPIC_API_KEY`, `apiKeyHelper` in `--settings` file, or cloud creds); hooks passed via `--settings` DON'T run under `--bare`; `--append-system-prompt`, `--mcp-config`, `--settings`; `--allowedTools`; `--permission-mode dontAsk`; `--output-format json` / `stream-json` with `--verbose`; `--max-turns` | best-practices.md:L542-549 |
| Fan-out loop | `for file in $(cat files.txt); do claude --bare -p "Migrate $file to the new logger API and commit. Reply OK or FAIL." --allowedTools "Read,Edit,Bash(git add *),Bash(git commit *)" --permission-mode dontAsk --max-turns 20; done`; test on 3 files first; hitting turn limit exits with error | best-practices.md:L553-562 |
| Auto mode with `-p` | `--permission-mode auto`; a classifier block denies that action, run continues, repeated blocks do not pause | best-practices.md:L564 |
| Scheduled | `/loop 15m check CI...` (each run is a turn in same session); `/schedule` cloud routines need claude.ai login (not API key); protect `main` with a GitHub branch rule the task can't bypass | best-practices.md:L570-580 |
| Parallel sessions | `claude -w feature-auth`; desktop app; cloud sessions; `/batch <task>` splits into 5 to 30 units, shows plan, each unit own worktree and PR; `claude agents` (research preview) | best-practices.md:L584, L606 |
| Second session as reviewer | one writes, another reviews `@src/middleware/rateLimiter.ts`, user relays | best-practices.md:L608 |
| Worktree cleanup note | unnamed session exit removes clean worktree; named/with changes asks; subagent worktrees vanish if unchanged; leftovers swept by `cleanupPeriodDays` | best-practices.md:L598-600 |

### C10. Model/effort statements (potentially time-sensitive, as of page)
Effort levels `low`, `medium`, `high`, `xhigh`, `max`; models named: Claude Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5 default `medium` (best-practices.md:L436); `/model fable`; Haiku for simple subagents (L443); `ultrathink` per-prompt (L441).

---------------------------------------------------------------------
## PART D. EXPERIMENTAL / VERSION-GATED INDEX
---------------------------------------------------------------------
| Item | Gate | Cite |
|---|---|---|
| Agent view | research preview; UI/keys may change | agent-view.md:L21 |
| Version floors (agent view) | `n:` filter v2.1.287; `claude attach/logs` by name v2.1.290; `/effort`,`/fast`, bare `/model` v2.1.299; `--restricted` v2.1.248; `←` detaches during `/btw` overlay v2.1.257; `--resume <id> --bg` same-ID v2.1.257; `claude rm --discard-unpushed` v2.1.260; `--force-remove-worktree` v2.1.268; `Esc` clearing needs two presses v2.1.323 | agent-view.md:L344, L802, L414, L740, L252, L537, L796-797, L378 |
| `/fork` | v2.1.212 became session copy; old forked-subagent behaviour moved to `/subtask`; `/fork` = subagent when agent view off | agent-view.md:L458, L1118 |
| Worktree version floors | PR/MR refs v2.1.233; `**/` include v2.1.239; LFS filter skip v2.1.247; non-interactive resume re-enter v2.1.212; skills read-through v2.1.277; submodule sweep check v2.1.274; `/batch` outside git v2.1.281; `startup_failure_reason` v2.1.274; resume refusal `result` message v2.1.260; stray `.git` fix v2.1.302 | worktrees.md:L209, L217, L358, L96, L266, L149, L334, L432, L419, L402 |
| Skills read-through | main-checkout skills visible in worktree lacking `.claude/skills` | worktrees.md:L264-266 |
| Renamed | `/fork` forked-subagent => `/subtask` (agent-view.md:L1118). No other renames/deprecations stated in these 3 pages. |

---------------------------------------------------------------------
## PART E. NOT STATED (gaps an auditor may hit)
---------------------------------------------------------------------
- agent-view: which of `CLAUDE.md`, `.claude/rules/`, skills, agents, hooks a background session loads at startup (only "reads settings from the directory it runs in"; agent-view.md:L691). Whether project hooks fire inside the worktree path vs project root is addressed only for `EnterWorktree` and Desktop app (worktrees.md:L50-53, L270), not explicitly for `--bg` sessions.
- agent-view: how `isolation` interacts with `.worktreeinclude` for bg sessions (worktrees.md:L227 lists `--worktree`, subagent, desktop only; bg sessions not named).
- worktrees: full `WorktreeCreate`/`WorktreeRemove` input/output schema, exit codes, matcher fields (deferred to hooks reference; worktrees.md:L332).
- worktrees: branch naming for subagent / bg-session worktrees (only `--worktree` => `worktree-<name>`, `pr-<number>` dir for PR refs).
- worktrees: Codex/Cursor/other runtimes: nothing.
- best-practices: no explicit plan-mode / "plan first" practice; no hard numeric size cap for CLAUDE.md beyond "under 200" via memory guide (L164); no skill size limit.
- best-practices: no guidance on `agents` `maxTurns`, subagent `isolation`; no statement about how many parallel agents is safe (only `/batch` 5 to 30 units, L606).

---------------------------------------------------------------------
## AUDIT CHECKPOINTS (testable against toolkit rules/skills/hooks/worktree prose)
---------------------------------------------------------------------
1. Worktree CLI form is `claude --worktree <name>` / `-w <name>`; default path `.claude/worktrees/<name>/`, branch `worktree-<name>`; any other documented path/branch convention is toolkit-specific, not runtime-default (worktrees.md:L24).
2. Toolkit gitignores `.claude/worktrees/` (worktrees.md:L36).
3. Toolkit prose does not claim `.worktreeinclude` works with a custom `WorktreeCreate` hook (it does not; worktrees.md:L311).
4. If a `.worktreeinclude` ships, entries are gitignored files only, `.gitignore` syntax, small files, no `node_modules` (worktrees.md:L215; best-practices.md:L594).
5. Toolkit worktree instructions do not assume `${CLAUDE_PROJECT_DIR}` follows into a worktree; hook scripts needing worktree path read `cwd` from hook stdin JSON (worktrees.md:L50-53).
6. Hook commands registered in `.claude/settings.json` use `${CLAUDE_PROJECT_DIR}`-based paths consistent with the above (worktrees.md:L52).
7. Toolkit's subagent-isolation instructions use frontmatter `isolation: worktree` (or spawn arg `isolation: "worktree"`), not custom git worktree scripts, where the runtime feature suffices (worktrees.md:L121; agent-view.md:L611).
8. No prose assumes a subagent in a worktree loads that worktree's root `CLAUDE.md` / `.claude/rules/` (it does not in default location; worktrees.md:L140).
9. Prose using `git worktree add` outside `.claude/worktrees/` acknowledges agent-view `@` doesn't list such worktrees and `EnterWorktree` there prompts (agent-view.md:L432; worktrees.md:L46).
10. Parallel-execution prose accounts for worktree base: default fresh from remote default branch; unpushed local work absent unless `worktree.baseRef: "head"` (worktrees.md:L172-173).
11. Toolkit does not instruct agents to edit the main checkout from inside an isolated worktree session (blocked: Edit/Write/NotebookEdit, cwd, git redirects, command shape; worktrees.md:L106-111).
12. Toolkit prose does not rely on `cp`/redirect writes into main checkout being blocked (they are not; worktrees.md:L113).
13. Toolkit cleanup instructions cover `claude -p --worktree` leftovers (`git worktree remove`, `git worktree unlock`) (worktrees.md:L78).
14. Background-session prose: commit and push to own branch, draft PR, never push `main`/`master`, never force-push or merge; user git instructions in `CLAUDE.md`/memory take precedence (agent-view.md:L613-618). Check toolkit rules don't contradict (e.g. mandatory approval gates before commit in bg sessions would stall at `Needs input`).
15. Any workflow gate requiring human approval is documented as surfacing as `Needs input`/`blocked` in bg sessions; permission prompts cannot be answered via peek reply, only via attach (agent-view.md:L228).
16. Hooks that read stdin and emit decisions use only valid output schemas for `PermissionRequest`/`PreToolUse`; invalid output shows `hook output invalid:` and leaves session blocked (agent-view.md:L230).
17. Hook behaviour at `SessionStart` is short/fast: prompts typed while `SessionStart` hooks run can be dropped when backgrounding (agent-view.md:L301).
18. Hooks using `Notification` handle types `agent_needs_input` and `agent_completed` if toolkit registers a `Notification` hook (agent-view.md:L156).
19. Toolkit does not read or parse `~/.claude/jobs/<id>/state.json`; uses `claude agents --json --all` (agent-view.md:L154, L832). Session temp files go under `$CLAUDE_JOB_DIR/tmp`, not edited in `state.json` (L834).
20. Enforced rules (no-exception gates) are implemented as hooks/deny rules, not only CLAUDE.md prose; preference-only rules are not hooks (best-practices.md:L56, L67, L294).
21. Any `prompt`/`agent` type hook is not described as deterministic enforcement; enforcing hooks are `command`/`http` with `onFailure: "block"` where fail-closed is required (best-practices.md:L307).
22. `Stop`-hook gates use exit code 2 + stderr reason, and account for the 8-consecutive-block override and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (best-practices.md:L272, L288).
23. `PreToolUse` blocking hooks use exit code 2 (best-practices.md:L328).
24. Always-on `CLAUDE.md` / rules files are short (memory guide: under 200 lines; only non-derivable content); no architecture/file-layout dumps; path-specific rules use `paths:` frontmatter (best-practices.md:L135-141, L164, L176-185, L622).
25. Emphasis wording (IMPORTANT/ALL CAPS/NEVER stacks) is not the mechanism for exceptionless rules; such rules map to hooks/deny (best-practices.md:L172, L617).
26. Side-effecting skills (ship/release/deploy) set `disable-model-invocation: true`; skill descriptions are specific since name+description sit in context each session (best-practices.md:L191, L197).
27. Reviewer-style subagents restrict `tools` (e.g. `Read, Grep, Glob`), instruct "skip style"/correctness-only, and review against a spec file (best-practices.md:L260-268, L471-484).
28. Verification steps give Claude a runnable pass/fail command and require evidence (command + output), not bare assertions (best-practices.md:L243, L252).
29. Spec-first flow: interview => `SPEC.md` => fresh session to build; `/clear` between unrelated tasks; after two failed corrections `/clear` (best-practices.md:L131, L494, L514).
30. Headless/fan-out scripts use `claude -p` with `--allowedTools`, `--permission-mode dontAsk`, `--max-turns`; `--bare` is not used where hooks/skills/CLAUDE.md are required (hooks via `--settings` also skipped under `--bare`) (best-practices.md:L546-562).
31. Parallel-agent prose is consistent with runtime facts: `/batch` 5-30 units, each own worktree; bg sessions consume quota per session; agent view is research preview and may change (best-practices.md:L606; agent-view.md:L21, L1039).
32. Toolkit hook/skill/agent definitions are visible to bg sessions only via the session directory settings and carried flags; nothing assumes a bg session inherits the interactive session's unflagged state (agent-view.md:L491-501, L691).
