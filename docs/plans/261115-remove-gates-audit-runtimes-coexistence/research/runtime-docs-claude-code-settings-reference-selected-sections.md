# Claude Code "All settings" reference: selected sections

Cite format: `L<n>` = `claude/settings-reference.md:L<n>` (Read-tool line numbers). Ranges `La-b`.

## Scope

- File: `/Users/sangnguyen/Desktop/MeowKit/tmp/runtime-docs-261115/claude/settings-reference.md` (6115 lines).
- Ranges read in full, every line: L1-268, L808-1277, L2313-2647, L3438-3798, L3799-4435, L4635-4866, L5474-5531, L5625-5877.
- Sections NOT read (skipped by instruction): Model and responses, Sandbox, Interface and terminal, MCP, Remote/desktop, Authentication, Updates, Privacy, Global config; also gaps between ranges (e.g. L269-807, L1278-2312, L2648-3437, L4436-4634, L4867-5473, L5532-5624, L5878+). Keys from skipped sections appear only as index rows (name/purpose/scope), no detail.
- Scope vocabulary (L15): User=`~/.claude/settings.json`, Project=`.claude/settings.json`, Local=`.claude/settings.local.json`, Managed=org-deployed; "Any file"=all four; "Global config"=`~/.claude.json`.
- Doc text treated as DATA; nothing acted on.

## Settings index (L17-267)

Cols: key | topic | purpose | scope | cite. Scope: Any=any of 4 files; Mgd=managed only; U|M=user or managed; GC=global config (~/.claude.json). Topics abbreviated: Model=Model and responses; Auth=Authentication and providers; UI=Interface and terminal; Mem=Memory and context; Perm=Permission settings; Plug=Plugins and skills; Hook=Hooks and automation; Git=Git and attribution; Agt=Agents, sessions, worktrees; Remote=Remote, desktop, notifications; Priv=Privacy and telemetry; Ent=Enterprise and managed; Upd=Updates; Sbx=Sandbox; Tools; MCP.

| key | topic | purpose | scope | cite |
|---|---|---|---|---|
| advisorModel | Model | model answering advisor tool | Any | L19 |
| agent | Agt | start sessions as named subagent | Any | L20 |
| agentPushNotifEnabled | Remote | phone push when Claude decides | Any | L21 |
| allowAllClaudeAiMcps | MCP | load claude.ai connectors beside managed-mcp.json | Mgd | L22 |
| allowClaudeInChromeWithManagedMcp | MCP | Chrome server beside managed-mcp.json | Mgd | L23 |
| allowedChannelPlugins | Plug | replace channel-plugin allowlist | Mgd | L24 |
| allowedHttpHookUrls | Hook | limit HTTP hook URLs | Any | L25 |
| allowedMcpServers | MCP | allowlist MCP servers | Any | L26 |
| allowedProviders | Auth | limit API providers | Mgd | L27 |
| allowManagedHooksOnly | Hook | only org-deployed hooks run | Mgd | L28 |
| allowManagedMcpServersOnly | MCP | managed MCP allowlist only | Mgd | L29 |
| allowManagedPermissionRulesOnly | Perm | managed = only source of permission rules | Mgd | L30 |
| alwaysThinkingEnabled | Model | extended thinking off for all | Any | L31 |
| apiKeyHelper | Auth | command generating credential | Any | L32 |
| askUserQuestionTimeout | UI | auto-continue unanswered question | U\|M | L33 |
| appendPlugins | Plug | org mods run after user mods | U\|M | L34 |
| attribution | Git | customize commit/PR attribution | Any | L35 |
| attribution.commit | Git | change/hide commit trailer | Any | L36 |
| attribution.pr | Git | change/hide PR line | Any | L37 |
| attribution.sessionUrl | Git | omit claude.ai session link | Any | L38 |
| autoCompactEnabled | Mem | auto compaction on/off | Any | L39 |
| autoCompactWindow | Mem | context fullness before compact | Any | L40 |
| autoConnectIde | GC | auto-connect IDE | GC | L41 |
| autoContinueAtUsageLimit | UI | wait and continue after limit reset | U\|M | L42 |
| autoInstallIdeExtension | GC | /ide installs extension | GC | L43 |
| autoMemoryDirectory | Mem | auto memory dir | Any | L44 |
| autoMemoryEnabled | Mem | auto memory on/off | Any | L45 |
| autoMode | Perm | add rules to auto-mode classifier | U\|M | L46 |
| autoMode.classifyAllShell | Perm | all shell cmds through classifier | U\|M | L47 |
| autoScrollEnabled | UI | follow output in fullscreen | Any | L48 |
| autoUpdatesChannel | Upd | stable vs latest channel | Any | L49 |
| availableModels | Model | restrict selectable models | Any | L50 |
| availableModelsMatch | Model | entry permits only named version | Mgd | L51 |
| awaySummaryEnabled | Remote | session recap off | Any | L52 |
| awsAuthRefresh | Auth | refresh Bedrock creds cmd | Any | L53 |
| awsCredentialExport | Auth | Bedrock creds JSON cmd | Any | L54 |
| axScreenReader | UI | screen-reader output | U\|M | L55 |
| bashEditDiffEnabled | UI | record files changed by Bash | U\|M | L56 |
| bashOutputMaxChars | Mem | inline Bash output limit | Any | L57 |
| blockedMarketplaces | Plug | block marketplace sources | Mgd | L58 |
| browserExternalPageTools | Tools | desktop: tools off external pages | Mgd | L59 |
| channelsEnabled | Plug | allow channels for org | Mgd | L60 |
| claudeInChromeDefaultEnabled | GC | Chrome integration at start | GC | L61 |
| claudeMd | Mem | org CLAUDE.md text | Mgd | L62 |
| claudeMdExcludes | Mem | skip CLAUDE.md files | Any | L63 |
| cleanupPeriodDays | Priv | transcript retention days | Any | L64 |
| companyAnnouncements | UI | startup announcements | Any | L65 |
| copyFullResponse | GC | /copy full response | GC | L66 |
| copyOnSelect | GC | auto-copy selection | GC | L67 |
| crossSessionInbound | Agt | handle msgs from other sessions | Any | L68 |
| defaultShell | UI | Bash vs PowerShell for `!` | Any | L69 |
| defaultToAgentsView | GC | open agent view by default | GC | L70 |
| deniedMcpServers | MCP | block MCP servers | Any | L71 |
| deniedModels | Model | block specific models | Mgd | L72 |
| desktopSessionCleanupPeriodDays | Priv | desktop transcript age limit | U\|M | L73 |
| dialogExpiry | UI | forwarded-dialog wait | U\|M | L74 |
| diffTool | GC | IDE diff viewer | GC | L75 |
| disableAgentView | Agt | turn off background agents + agent view | Any | L76 |
| disableAllHooks | Hook | turn off hooks, statusLine, fileSuggestion | Any | L77 |
| disableArtifact | Remote | DEPRECATED; use enableArtifact | Any | L78 |
| disableAutoMode | Perm | remove auto mode from cycle | Any | L79 |
| disableBrowserExternalNavigation | Tools | desktop browser localhost only | Mgd | L80 |
| disableBundledSkills | Plug | turn off bundled skills/workflows | Any | L81 |
| disableClaudeAiConnectors | MCP | no claude.ai connectors | Any | L82 |
| disableCommandPluginSources | Plug | block command-source plugins | Mgd | L83 |
| disableDeepLinkRegistration | Remote | no claude-cli:// handler | Any | L84 |
| disableDesktopLocalSessions | Remote | no local Desktop sessions | Mgd | L85 |
| disabledMcpjsonServers | MCP | reject .mcp.json servers | Any | L86 |
| disableMobileSimulatorTools | Tools | block iOS Simulator tools | Mgd | L87 |
| disableRemoteControl | Remote | Remote Control off | Any | L88 |
| disableRemotePreviewScripts | Remote | no scripts in desktop previews | Mgd | L89 |
| disableSideloadFlags | Ent | reject --plugin-dir/--agents/etc | Mgd | L90 |
| disableSkillShellExecution | Plug | no inline shell in skills/commands | Any | L91 |
| disableWorkflows | Hook | dynamic workflows off for everyone | Any | L92 |
| editorMode | UI | vim bindings | Any | L93 |
| effortLevel | Model | default effort | Any | L94 |
| emojiCompletionEnabled | UI | emoji shortcodes | Any | L95 |
| enableAllProjectMcpServers | MCP | approve all project .mcp.json servers | Any | L96 |
| enableArtifact | Remote | `false` turns Artifact tool off; no file turns it on | Any | L97 |
| enabledMcpjsonServers | MCP | approve specific .mcp.json servers | Any | L98 |
| enabledPlugins | Plug | plugins on/off per scope | Any | L99 |
| enableWorkflows | Hook | workflows on/off vs plan default | Any | L100 |
| enforceAvailableModels | Model | /model Default inside allowlist | Any | L101 |
| env | Mem | env vars for sessions + subprocesses | Any | L102 |
| externalEditorContext | GC | Ctrl+G shows last response | GC | L103 |
| extraKnownMarketplaces | Plug | register marketplaces | Any | L104 |
| fallbackModel | Model | backup models | Any | L105 |
| fastMode | Model | fast mode on | Any | L106 |
| fastModePerSessionOptIn | Model | opt in per session | Any | L107 |
| feedbackDrafts | Priv | queue feedback drafts | U\|M | L108 |
| feedbackSurveyRate | Priv | survey frequency | Any | L109 |
| fileCheckpointingEnabled | Mem | /rewind snapshots | Any | L110 |
| fileSuggestion | UI | custom `@` autocomplete cmd | Any | L111 |
| footerLinksRegexes | UI | clickable IDs in footer | U\|M | L112 |
| forceLoginGatewayUrl | Auth | gateway URL for login | U\|M | L113 |
| forceLoginMethod | Auth | restrict login method | Any | L114 |
| forceLoginOrgUUID | Auth | pin org; only managed enforces | Any | L115 |
| forceRemoteSettingsRefresh | Ent | block startup until server-managed fetched | Mgd | L116 |
| gatewayInternalNetworks | Auth | gateway on internal public IPv4 | Mgd | L117 |
| gcpAuthRefresh | Auth | refresh GCP creds cmd | Any | L118 |
| hooks | Hook | lifecycle hooks | Any | L119 |
| httpHookAllowedEnvVars | Hook | env vars HTTP hooks may put in headers | Any | L120 |
| idleCompaction | Mem | compact idle conversations | Any | L121 |
| includeCoAuthoredBy | Git | DEPRECATED; use attribution | Any | L122 |
| includeGitInstructions | Git | drop built-in commit/PR instructions | Any | L123 |
| inputNeededNotifEnabled | Remote | push when waiting | Any | L124 |
| isolatePeerMachines | Agt | approval before cross-machine msg | Any | L125 |
| keybindingFlavor | UI | DEPRECATED, no effect | Any | L126 |
| language | Model | response language | Any | L127 |
| leftArrowOpensAgents | GC | left-arrow shortcut | GC | L128 |
| managedMcpServers | MCP | remote MCP servers for all users | Mgd | L129 |
| managedSourcesBehavior | Ent | compose managed sources | Mgd | L130 |
| maxEffortLevel | Model | cap effort | Any | L131 |
| maxProseWidth | UI | prose width cap | Any | L132 |
| minimumVersion | Upd | floor for auto-update | Any | L133 |
| model | Model | starting model | Any | L134 |
| modelOverrides | Model | map model IDs to provider IDs | Any | L135 |
| modelPicker | Model | /model picker list | U\|M | L136 |
| modelPricing | Model | contracted rates | Mgd | L137 |
| modelSettings | Model | per-model effort/compact window | Any | L138 |
| otelHeadersHelper | Auth | rotating OTel headers cmd | Any | L139 |
| outputStyle | Model | output style | Any | L140 |
| parentSettingsBehavior | Ent | apply/drop host-passed restrictions | Mgd | L141 |
| permissionExplainerEnabled | GC | REMOVED v2.1.257 | GC | L142 |
| permissions | Perm | allow/ask/deny + default mode | Any | L143 |
| permissions.additionalDirectories | Perm | extra working dirs | Any | L144 |
| permissions.allow | Perm | approve without prompt | Any | L145 |
| permissions.ask | Perm | always prompt | Any | L146 |
| permissions.blockReadsOutsideWorkingDirectories | Perm | file tools refuse outside reads | Any | L147 |
| permissions.blockWritesOutsideWorkingDirectories | Perm | Write/Edit/NotebookEdit refuse outside writes | Any | L148 |
| permissions.defaultMode | Perm | default permission mode | Any | L149 |
| permissions.deny | Perm | block tool uses | Any | L150 |
| permissions.denyInsteadOfPrompting | Perm | deny what would prompt | U\|M | L151 |
| permissions.disableBypassPermissionsMode | Perm | forbid bypassPermissions | Any | L152 |
| plansDirectory | Mem | plan-mode plan dir | Any | L153 |
| pluginConfigs | Plug | stored plugin dialog answers | U\|M | L154 |
| pluginSuggestionMarketplaces | Plug | marketplaces that may suggest | Mgd | L155 |
| pluginTrustMessage | Plug | extra trust-warning text | Mgd | L156 |
| policyHelper (+ .path .refreshIntervalMs .timeoutMs) | Ent | exe computing managed settings | Mgd | L157-160 |
| preferredNotifChannel | Remote | bell/desktop notif | Any | L161 |
| prefersReducedMotion | UI | reduce animations | Any | L162 |
| prependPlugins | Plug | org mods before user mods | U\|M | L163 |
| processWrapper | Agt | corporate launcher for bg processes | U\|M | L164 |
| promptCacheTtl | Model | main-conversation cache TTL | Any | L165 |
| promptSuggestionEnabled | UI | grayed prompt suggestions | Any | L166 |
| prStatusFooterEnabled | GC | PR status badge | GC | L167 |
| prUrlTemplate | Git | internal review-tool links | Any | L168 |
| remote.defaultEnvironmentId | Remote | default cloud env (`ccpool_` ID only from user/managed/--settings) | Any | L169 |
| remoteControlAtStartup | Remote | auto Remote Control | Any | L170 |
| requiredMaximumVersion | Upd | refuse newer version | Mgd | L171 |
| requiredMinimumVersion | Upd | refuse older version | Mgd | L172 |
| respectGitignore | UI | `@` picker honours gitignore | Any | L173 |
| respondToBashCommands | UI | stop reply after `!` cmd | Any | L174 |
| sandbox + 38 sandbox.* sub-keys (allowAppleEvents, allowNestedUserNamespaces, allowUnsandboxedCommands, autoAllowBashIfSandboxed, bwrapPath, credentials[.allowPlaintextInject/.awsPairs/.envVars/.files/.sigv4], enabled, enableWeakerNestedSandbox, enableWeakerNetworkIsolation, excludedCommands, failIfUnavailable, filesystem[.allowManagedReadPathsOnly/.allowRead/.allowWrite/.denyRead/.denyWrite/.disabled], ignoreViolations, network[.allowAllUnixSockets/.allowedDomains/.allowLocalBinding/.allowMachLookup/.allowManagedDomainsOnly/.allowUnixSockets/.deniedDomains/.httpProxyPort/.socksProxyPort/.strictAllowlist/.tlsTerminate], ripgrep, socatPath) | Sbx | Bash sandbox | mostly Any; Mgd-only: bwrapPath, socatPath, filesystem.allowManagedReadPathsOnly, network.allowManagedDomainsOnly; U\|M: allowAppleEvents, allowNestedUserNamespaces, credentials.{allowPlaintextInject,awsPairs,sigv4}, filesystem.disabled, network.{strictAllowlist,tlsTerminate}, ripgrep | L175-213 |
| showClearContextOnPlanAccept | UI | clear-context option | Any | L214 |
| showThinkingSummaries | Model | thinking summaries | Any | L215 |
| showTurnDuration | UI | hide "Cooked for" | Any | L216 |
| skillListingBudgetFraction | Mem | context share for skill listing | Any | L217 |
| skillListingMaxDescChars | Mem | per-skill description cap | Any | L218 |
| skillOverrides | Plug | hide/collapse skill w/o editing SKILL.md | Any | L219 |
| skipAutoPermissionPrompt | Perm | skip auto-mode notice | U\|M | L220 |
| skipDangerousModePermissionPrompt | Perm | skip bypass confirmation | User, Local, Mgd | L221 |
| skipWebFetchPreflight | Priv | skip WebFetch host check | Any | L222 |
| spellcheck | UI | prompt spell checker | U\|M | L223 |
| spinnerTipsEnabled / spinnerTipsOverride / spinnerVerbs | UI | spinner text | Any | L224-226 |
| sshConfigs / sshHostCommands | Remote | Desktop SSH connections | U\|M | L227, L229 |
| sshHostAllowlist | Remote | limit Desktop SSH hosts | Mgd | L228 |
| statusLine | UI | custom status-line command | Any | L230 |
| strictKnownMarketplaces | Plug | allowlist marketplace sources | Mgd | L231 |
| strictPluginOnlyCustomization (+ .agents .hooks .mcp .skills) | Plug | block skills/agents/hooks/MCP from user+project | Mgd | L232-236 |
| subagentPromptCacheTtl | Model | subagent cache TTL | Any | L237 |
| switchModelsOnFlag | Model | classifier-flag behaviour | Any | L238 |
| syncClaudeAiPlugins / syncClaudeAiSkills | Plug | stop loading claude.ai synced plugins/skills | User, Local, Mgd | L239-240 |
| syntaxHighlightingDisabled | UI | no highlighting | Any | L241 |
| taskOutputMaxChars | Mem | REMOVED v2.1.277 | Any | L242 |
| teammateDefaultModel | GC | REMOVED v2.1.234 | GC | L243 |
| teammateMode | Agt | agent-team teammate display | Any | L244 |
| terminalProgressBarEnabled / terminalTitleFromRename / theme / timeFormat / timeZone / tui | UI | UI | Any | L245-250 |
| ultracode | Model | auto-plan workflow per task | Any | L251 |
| useAutoModeDuringPlan | Perm | classifier in plan mode | User, Local, Mgd | L252 |
| verbose / viewMode | UI | output view | Any | L253-254 |
| vimInsertModeRemaps | UI | INSERT remap | U\|M | L255 |
| voice / voiceEnabled | UI | dictation | Any | L256-257 |
| wheelScrollAccelerationEnabled | UI | wheel accel | Any | L258 |
| workflowKeywordTriggerEnabled | Hook | `ultracode` keyword trigger | Any | L259 |
| workflowSizeGuideline | Hook | agent count guideline | Any | L260 |
| worktree | Agt | worktree creation config | Any | L261 |
| worktree.baseRef | Agt | base ref for new worktrees | Any | L262 |
| worktree.bgIsolation | Agt | bg-session edit isolation | Any | L263 |
| worktree.location | Agt | Desktop SSH worktree folder | User only | L264 |
| worktree.sparsePaths | Agt | sparse checkout dirs | Any | L265 |
| worktree.symlinkDirectories | Agt | symlink dirs into worktrees | Any | L266 |
| wslInheritsWindowsSettings | Ent | WSL reads Windows policy chain | Mgd | L267 |

Index scope notes: no index key is flagged "project ignored" directly; restriction lives in the Scope column (Managed / User or managed / User, local, or managed) (L15, L17-267). Keys absent from the index (e.g. `ignorePatterns`, `proxyAuthHelper`, `allowManagedModsOnly`) appear in body text only: `ignorePatterns` is "deprecated", replaced by `permissions.deny` (L1022); `proxyAuthHelper` named in merge table (L5708); `allowManagedModsOnly` is linked to another page (L3631).

## Permission settings (L808-1277)

| key | type | default | allowed values | scopes honoured | env/flag equivalent | version / deprecation | cite |
|---|---|---|---|---|---|---|---|
| allowManagedPermissionRulesOnly | bool | unset (user/project/local/--settings rules also apply) | true/false | Managed | ignores `--allowedTools` when true | v2.1.282+ also ignores skill/command `allowed-tools` frontmatter from repo `.claude/`, `~/.claude/skills`+`commands`, --add-dir, plugin manifests in skills dirs; `@inline` plugin case v2.1.305+; pre-v2.1.257 dropped CLI/session rules at first reload | L812-847 |
| autoMode | object: `environment`,`allow`,`soft_deny`,`hard_deny` arrays + `classifyAllShell` | unset | `"$defaults"` literal keeps built-ins | User or managed | - | arrays concatenate across files | L849-867 |
| autoMode.classifyAllShell | bool | false | | User or managed | - | v2.1.193+ | L869-887 |
| disableAutoMode | string | unset | `"disable"` | Any file; also valid as `permissions.disableAutoMode` | - | - | L889-901 |
| permissions | object: allow, ask, deny, additionalDirectories, blockReadsOutsideWorkingDirectories, blockWritesOutsideWorkingDirectories, defaultMode, denyInsteadOfPrompting, disableBypassPermissionsMode, disableAutoMode | unset | | Any file | - | - | L903-924 |
| useAutoModeDuringPlan | bool | true | | User, local, managed ("A repository can't turn it off for you") | - | ignoring a left-out `--setting-sources` file needs v2.1.314+ | L926-941 |
| permissions.allow | array of rule strings | unset | `Tool` or `Tool(specifier)` | Any file | `--allowedTools` (session) | project-file `allow` rules apply only after workspace-trust dialog accepted (L962) | L943-977 |
| permissions.ask | array | unset | | Any file | - | in `dontAsk` mode matching use denied not prompted | L979-993 |
| permissions.deny | array | unset | tool-name globs (`*`, `mcp__*`) | Any file | `--disallowedTools` (session) | replaces deprecated `ignorePatterns`; deny on EndConversation ignored while other tools exist | L995-1022 |
| permissions.additionalDirectories | array of paths | unset | | Any file (sandbox write access from project/local entries limited) | `--add-dir`, `/add-dir` | project-file entries effective only after trust dialog; most `.claude/` config NOT discovered from these dirs (L1026) | L1024-1041 |
| permissions.blockReadsOutsideWorkingDirectories | bool | unset | | Any file; `true` in any file applies (repo can turn on, not lift) | - | v2.1.257+ | L1043-1098 |
| permissions.blockWritesOutsideWorkingDirectories | bool | unset; ON while managed `permissions` object unreadable | | Any file; `true` in any file applies | - | v2.1.314+; removes/refuses `EnterWorktree` and `ExitWorktree` when on (L1104) | L1100-1139 |
| permissions.defaultMode | string | unset | default, acceptEdits, plan, auto, dontAsk, bypassPermissions, manual (alias of default) | Any file, BUT `auto` and `bypassPermissions` do not take effect from project/local; VS Code reads only user/managed/--settings (L1145); cloud sessions honour only acceptEdits/plan/default/auto (L1165) | `--permission-mode`, `--dangerously-skip-permissions` | pre-v2.1.257 bypassPermissions worked from any file | L1141-1165 |
| permissions.denyInsteadOfPrompting | bool | unset | | User or managed, and `--settings`; repo can't set | `--permission-prompts none` (-p, single run) | v2.1.319+; removes AskUserQuestion/EnterPlanMode/ExitPlanMode; cancels MCP elicitation; in auto mode 20 consecutive blocked actions end the turn | L1167-1225 |
| permissions.disableBypassPermissionsMode | string | unset | `"disable"` | Any file (typically managed) | rejects `--dangerously-skip-permissions`; ignores agent frontmatter `permissionMode: bypassPermissions` | pre-v2.1.223 applied frontmatter mode anyway | L1227-1244 |
| skipAutoPermissionPrompt | bool | unset | | User or managed; repo can't set | - | - | L1246-1260 |
| skipDangerousModePermissionPrompt | bool | unset | | User, local, managed, `--settings`; background sessions count only user+managed; untrusted repo can't skip | - | written by Claude Code on accept | L1262-1275 |

Facts: eval order deny, then ask, then allow; first match decides (L966). Permission rules layer on every mode; deny blocks even in bypassPermissions (L1165). Read/Edit deny covers built-in file tools, recognized Bash file commands (cat/head/tail/sed/tee) and redirections; not `grep -r` or arbitrary subprocesses; sandbox suggested for OS-level enforcement (L999). `Bash(curl *)` deny does not stop `/usr/bin/curl` or `sh -c` (L1022). Directories added only in repo settings do not count as working dirs for the read block (L1072). Under the write block, Claude Code settings files stay refused even inside working dirs (L1130); subagent `isolation: worktree` edits refused when its worktree is outside working dirs; add `.claude/worktrees` at repo root via /add-dir (L1132, L1135). Linked-worktree session keeps common `.git` readable/writable to sandboxed commands (L1080).

## Memory and context (L2313-2647)

| key | type | default | values | scopes | env/flag | version/dep | cite |
|---|---|---|---|---|---|---|---|
| autoCompactEnabled | bool | true | | Any | `DISABLE_AUTO_COMPACT` (either off wins) | - | L2317-2334 |
| autoCompactWindow | number tokens | unset | 100000-1000000, capped at model window | Any | `--autocompact`; `CLAUDE_CODE_AUTO_COMPACT_WINDOW` wins over both | `/autocompact` saves under `modelSettings` | L2336-2351 |
| autoMemoryDirectory | string abs or `~/` path | `~/.claude/projects/<project>/memory/` | | Any; from project/local honoured under same workspace-trust rule as hooks | - | when from project `.claude/settings.json` (or repo-supplied local), no auto memory loaded from/saved to it (L1074) | L2353-2367 |
| autoMemoryEnabled | bool | true | | Any | `CLAUDE_CODE_DISABLE_AUTO_MEMORY` (either direction); `--bare`, safe mode also outrank | `/memory` writes user settings | L2369-2384 |
| bashOutputMaxChars | int chars | unset (30,000 inline) | clamped 4000-128000 | Any | when set, `BASH_MAX_OUTPUT_LENGTH` ignored | v2.1.261+ | L2386-2400 |
| claudeMd | string (CLAUDE.md text, `\n` breaks) | unset | | Managed | - | loaded ahead of user/project CLAUDE.md | L2402-2418 |
| claudeMdExcludes | array of glob/abs path | unset (load all) | match absolute paths | Any | - | applies only to user/project/local memory; managed CLAUDE.md can't be excluded | L2420-2434 |
| env | object name->string | unset | | Any | - | see below | L2436-2506 |
| fileCheckpointingEnabled | bool | true | | Any | `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING`; ignored in `-p`/SDK (use `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true`) | - | L2508-2525 |
| idleCompaction | bool | true | | Any | `DISABLE_AUTO_COMPACT`; threshold `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` (default 200000, floor 100000) | v2.1.290+; /config row v2.1.302+ | L2527-2587 |
| plansDirectory | string rel path | unset (`~/.claude/plans`) | falls back to `~/.claude/plans` if outside project root or contains backslash on mac/Linux/WSL | Any | - | - | L2589-2606 |
| skillListingBudgetFraction | number | 0.01 | >0, <=1 | Any | - | over-cap: names kept, least-used descriptions dropped; `/doctor` shows usage | L2608-2622 |
| skillListingMaxDescChars | int | 1536 | positive | Any | - | caps `description` + `when_to_use` text per skill | L2624-2638 |
| taskOutputMaxChars | - | - | - | Any | - | REMOVED v2.1.277 with TaskOutput tool; no effect | L2640-2646 |

`env` behaviour: value overwrites same shell var (L2457); empty string `""` cancels a shell export (L2459); plain text, reaches every subprocess; use `apiKeyHelper`/`otelHeadersHelper` for secrets (L2461). Applied: user/--settings/managed at startup + on change; project/local after trust (or at startup in `-p`); "safe" vars (model, timeouts, feature toggles) at startup from every file (L2465-2467); `/cd` on v2.1.246+ adds new dir's project/local env (L2468). Desktop/self-hosted runner launch env wins over settings `env` (L2458).

Variables IGNORED in project and local `env` (dropped, warning via `claude --debug`) (L2472-2496): `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_TMPDIR`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, `XDG_*`; Windows program/config vars (`SystemRoot`, `ComSpec`, `ProgramData`, `LOCALAPPDATA`, `PATHEXT`, `PSModulePath`, `ProgramFiles*`); `OTEL_LOG_RAW_API_BODIES`, `ENABLE_BETA_TRACING_DETAILED`, `BETA_TRACING_ENDPOINT`; OTel exporter group (`CLAUDE_CODE_ENABLE_TELEMETRY`, `*_ENHANCED_TELEMETRY_BETA`, `OTEL_{LOGS,METRICS,TRACES}_EXPORTER`, `OTEL_LOG_USER_PROMPTS|ASSISTANT_RESPONSES|TOOL_CONTENT|TOOL_DETAILS`, `OTEL_EXPORTER_OTLP_*` ending `_ENDPOINT/_HEADERS/_PROTOCOL/_CERTIFICATE/_CLIENT_KEY/_INSECURE`, `OTEL_EXPORTER_PROMETHEUS_HOST/PORT`; only off-values still apply from project/local; needs v2.1.282+); `CLAUDE_CODE_PROCESS_WRAPPER`, `CLAUDE_CODE_SYNC_SKILLS`, `CLAUDE_CODE_SYNC_PLUGINS`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`, `CLAUDE_CODE_PLUGIN_SEED_DIR`; `CLAUDE_CODE_OAUTH_TOKEN/_REFRESH_TOKEN/_SCOPES`; `CLAUDE_AX_*`; `CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS`, `CLAUDE_CODE_DISABLE_ATTACHMENTS`, `CLAUDE_CODE_DISABLE_FILE_MENTIONS` (pre-v2.1.290 allowed the dialog timer + attachments ones; pre-v2.1.251 allowed file-location/session-export ones except HOME, XDG_CONFIG_HOME) (L2497). Ignored from EVERY file: `CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_ACCOUNT_UUID` (L2499); `CLAUDE_CODE_MESSAGING_SOCKET` (v2.1.224+), `CLAUDE_CODE_MESSAGING_TOKEN` (v2.1.228+) (L2500); `CLAUDE_CODE_PROJECT_DIR_NAME` (v2.1.234+) (L2501); `CLAUDE_CODE_RESTRICTED` (L2502); `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY` (v2.1.283+) (L2503); `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT`, `..._SUBSTITUTION_RM_PROMPT`, `..._INLINE_SHELL_RM_PROMPT`, `..._MOUNTED_DRIVE_RM_PROMPT` (L2504); `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS` (L2505); `CLAUDE_CODE_WARN_DISK_FREE_GIB`, `CLAUDE_CODE_WARN_MEMORY_FREE_GIB` (v2.1.304+) (L2506). `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` honoured from shell/user/--settings only, not managed/project/local (L2498).

## Git and attribution (L3438-3583)

| key | type | default | values | scopes | version/dep | cite |
|---|---|---|---|---|---|---|
| attribution | object `{commit, pr, sessionUrl}` or `false` | unset (standard attribution) | `false` hides all | Any | `false` needs v2.1.281+; older versions reject it and skip the WHOLE user/project/local settings file holding it (L3447) | L3442-3466 |
| attribution.commit | string (trailers allowed) | `Co-Authored-By: <model name> <noreply@anthropic.com>` (name = model used; subagent commit names subagent's model; `Claude` alone if version unknown; `Claude Code` for unmatched/third-party model) | `""` hides | Any | - | L3530-3548 |
| attribution.pr | string | `🤖 Generated with [Claude Code](https://claude.com/claude-code)` | `""` hides | Any | - | L3550-3564 |
| attribution.sessionUrl | bool | true | | Any | adds `Claude-Session` trailer/PR link for cloud/Remote Control sessions only | L3566-3582 |
| includeCoAuthoredBy | bool | true | `false` omits both trailer and PR text | Any | DEPRECATED since v2.0.62; ignored once `attribution.commit`/`.pr` set | L3468-3488 |
| includeGitInstructions | bool | true | | Any | env `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` wins; `false` drops built-in commit/PR instructions AND git-status snapshot; no snapshot with replaced system prompt in -p/SDK | L3490-3512 |
| prUrlTemplate | string URL template | unset | `{host}` `{owner}` `{repo}` `{number}` `{url}` | Any | GitLab MR links unchanged; non-`/pull/<n>` URLs unchanged | L3514-3528 |

Once `commit` or `pr` is set, `includeCoAuthoredBy` is ignored and unset one of the two gets default text (L3464). Claude Code tells Claude that user instructions (CLAUDE.md/memory) about attribution take precedence over these lines unless set in managed settings (L3466).

## Hooks and automation (L3584-3797)

| key | type | default | values | scopes | notes | cite |
|---|---|---|---|---|---|---|
| allowedHttpHookUrls | array of URL patterns (`*` wildcard) | unset (any URL) | empty array blocks all HTTP hooks | Any; arrays merge across files | applies to hooks from every source incl. managed; host match case-insensitive, trailing dot ignored; SDK `managedSettings` ignores a non-empty list (use SDK `settings`) | L3588-3606 |
| allowManagedHooksOnly | bool | unset | | Managed | see list below | L3608-3636 |
| disableAllHooks | bool | unset | | Any; only managed can disable managed hooks | see list below | L3638-3669 |
| disableWorkflows | bool | false | | Any | env `CLAUDE_CODE_DISABLE_WORKFLOWS`; either off wins | L3680-3695 |
| enableWorkflows | bool | unset (on unless Pro plan) | | Any | `/config` writes user settings | L3697-3714 |
| hooks | object keyed by hook event; value = array of `{matcher, hooks}` | unset | handler `type`: `command`, `prompt`, `agent`, `http`, `mcp_tool` | Any; "merge across files rather than replacing"; managed hooks can't be removed from other files | event list/exit codes are in hooks reference (not in this page) | L3716-3741 |
| httpHookAllowedEnvVars | array of env var names | unset (hook's own `allowedEnvVars` applies) | | Any; arrays merge | a hook may use var only if BOTH its own `allowedEnvVars` and this key name it; applies to all sources incl. managed; SDK `managedSettings` ignores non-empty list | L3743-3761 |
| workflowKeywordTriggerEnabled | bool | true | | Any | `ultracode` keyword | L3763-3779 |
| workflowSizeGuideline | string | `"medium"` (`"small"` on Pro, v2.1.271+) | unrestricted, small (<5 agents), medium (<10), large (<50) | Any | advice, not cap | L3781-3797 |

`allowManagedHooksOnly=true` (L3626-3636): runs managed hooks, Agent SDK in-process hooks, and hooks from plugins force-enabled in managed `enabledPlugins` (matched on full `plugin@marketplace` ID). Blocks: user/project/local hooks, hooks+mods from other plugins, agent-frontmatter hooks, monitors from non-force-enabled plugins (v2.1.310+), command-source plugins (unless `disableCommandPluginSources=false`), marketplace `headersHelper` (v2.1.238+). `statusLine` and `fileSuggestion` read from managed only. `/goal` cannot run.

`disableAllHooks` reach (L3654-3669): in managed = disables every hook incl. managed, SDK in-process hooks keep running (v2.1.242+); in SDK `managedSettings` = ignored on admin-managed machines unless host policy allowed (v2.1.309+); in any other file = disables user/project/local/plugin hooks, managed hooks + SDK hooks + managed force-enabled plugin hooks keep running. Also stops mods (plugins registering hooks); built-in mods keep running. Disables custom statusLine and fileSuggestion. `/goal` can't run; `/hooks` menu shows a notice.

statusLine/fileSuggestion gates (L3671-3678): OFF entirely when managed sets `disableAllHooks` or folder untrusted (same rule as settings-file hooks). NARROWED to managed when `allowManagedHooksOnly`, or `disableAllHooks` true outside managed after precedence, or `--safe-mode`; then managed value runs if present, else user value skipped silently (status line disabled; `@` falls back to built-in).

## Plugins and skills (L3799-4435)

| key | type | default | values | scopes | version/notes | cite |
|---|---|---|---|---|---|---|
| disableBundledSkills | bool | unset | | Any | env `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`; removes bundled skills+workflows; `/init` etc. typable but hidden from model; plugin/`.claude/skills/`/`.claude/commands/` skills unaffected | L3803-3820 |
| disableSkillShellExecution | bool | unset (inline shell runs) | | Any; `true` in managed can't be overridden | replaces `` !`...` `` and ```` ```! ```` blocks with `[shell command execution disabled by policy]`; covers user/project/plugin/additional-dir sources; bundled + managed-deployed skills unaffected | L3822-3838 |
| skillOverrides | object skill-name -> state | unset (all "on") | `on`, `name-only`, `user-invocable-only`, `off` | Any; `/skills` menu writes `.claude/settings.local.json` | NOT applied to plugin skills (manage via `/plugin`); alias keys for bundled skills in managed/--settings | L3840-3865 |
| syncClaudeAiSkills | bool | unset (sync) | only `false` honoured | User, local, managed, --settings; repo can't | `false` also moves synced skills to `~/.claude/skills/.trash/` in user/managed | L3867-3883 |
| syncClaudeAiPlugins | bool | unset (sync) | only `false` honoured | User, local, managed, --settings | v2.1.273+; per-plugin off via `"<name>@synced": false` in `enabledPlugins` | L3885-3903 |
| allowedChannelPlugins | array of `{marketplace,plugin}` or `"plugin@marketplace"` | unset (Anthropic default list) | `[]` blocks all | Managed | string form v2.1.267+ (older reject whole value) | L3905-3926 |
| blockedMarketplaces | array of source objects | unset | `github` owner wildcard `owner/*` (v2.1.223+); `{source:"skills-dir"}` stops `@skills-dir` plugins from `~/.claude/skills/` and `.claude/skills/` | Managed | checked on add/install/update/refresh/auto-update | L3928-3948 |
| channelsEnabled | bool | unset (blocked on Team/Enterprise + Console w/ managed settings) | | Managed | - | L3950-3966 |
| disableCommandPluginSources | bool | unset (follows `allowManagedHooksOnly`) | | Managed | v2.1.229+; headersHelper block v2.1.238+ | L3968-3984 |
| pluginSuggestionMarketplaces | array of names | unset | | Managed | needs registered + declared in same managed file | L3986-4000 |
| pluginTrustMessage | string | unset | | Managed | - | L4002-4014 |
| strictKnownMarketplaces (alias `allowedMarketplaces`, v2.1.232+) | array of source objects | unset (any); `[]` = total lockdown incl. official | source types github, git, url, file, directory, hostPattern, pathPattern, skills-dir | Managed | exact match incl ref/path; owner wildcard v2.1.223+; any allowlist (even empty) stops skills-dir plugins unless `{source:"skills-dir"}` listed and `strictPluginOnlyCustomization` unset | L4016-4154 |
| strictPluginOnlyCustomization | `true` or array of `skills`,`agents`,`hooks`,`mcp` | unset | unknown names ignored | Managed | any lock also stops skills-directory plugins (`~/.claude/skills/`, `.claude/skills/`) | L4156-4174 |
| ...`.skills` | | | | Managed | stops `~/.claude/skills`, `.claude/skills`, `~/.claude/commands`, `.claude/commands`, --add-dir skills, claude.ai synced skills; keeps bundled, managed-dir, other-plugin skills | L4176-4188 |
| ...`.agents` | | | | Managed | stops `~/.claude/agents`, `.claude/agents`, --add-dir agents; keeps built-in, managed-dir, plugin agents | L4190-4202 |
| ...`.hooks` | | | | Managed | stops user/project/local settings hooks + frontmatter hooks in locked skills/commands/agents; keeps managed + plugin hooks; skill with frontmatter `hooks` loses `allowed-tools` pre-approval (kept under `context: fork`) | L4204-4225 |
| ...`.mcp` | | | | Managed | stops `~/.claude.json` and `.mcp.json` MCP servers | L4227-4239 |
| enabledPlugins | object `plugin@marketplace` -> bool | unset (plugin `defaultEnabled`) | | Any | project scope enables but does NOT install; project beats user (set false in `.claude/settings.local.json` to opt out); managed `false` blocks install everywhere; managed force-enable can't be disabled locally | L4241-4268 |
| extraKnownMarketplaces (alias `additionalMarketplaces`, v2.1.232+) | object name -> `{source, autoUpdate?}` | unset | source: github, git, url (+headers, headersHelper v2.1.238+), file, directory, settings (inline) | Any; repo entries honoured only after trust dialog, ignored silently otherwise incl. `-p` | same-name entry from highest-precedence file wins whole (pre-v2.1.228 field merge); `skipLfs` accepted no effect (LFS never downloaded; pre-v2.1.274 downloaded); `headersHelper` in `--add-dir` dir settings ignored; project/local entry header names filtered | L4270-4368 |
| pluginConfigs | object plugin ID -> `{options, mcpServers?}` | unset | | User or managed; project/local entries ignored (substituted into hook/MCP/LSP configs) | `cc-plugin-agents-md@builtin`.options.instructionFiles controls reading AGENTS.md (pre-v2.1.285 id `agents-md@builtin`) | L4370-4394 |
| prependPlugins / appendPlugins | array `plugin@marketplace` | unset | | User or managed; user file honoured only on machine with no managed settings/managed-mcp.json and non-Team/Enterprise login; ignored in project/local/--settings | order of org mods; `sec-default@builtin` keeps built-in guard | L4396-4433 |

## Agents, sessions, worktrees (L4635-4866)

| key | type | default | values | scopes | env/flag | version/notes | cite |
|---|---|---|---|---|---|---|---|
| agent | string (built-in or custom agent name) | unset | | Any | `--agent` wins | also default agent for `claude agents` dispatch | L4639-4652 |
| crossSessionInbound | string | unset (per-message decision) | accept, hold, refuse | Any; project/local applies only if stricter than managed/--settings/user value; managed > --settings > user first-found | - | unrecognized value: held (user/project/local) or treated as refuse (managed); /config row v2.1.232+; pre-v2.1.248 silently ignored | L4654-4675 |
| disableAgentView | bool | unset | | Any | `CLAUDE_CODE_DISABLE_AGENT_VIEW` (either off wins) | disables `claude agents`, `--bg`, `/background`, on-demand supervisor | L4677-4692 |
| isolatePeerMachines | bool | unset | | Any; `true` from any scope applies (project can turn on, not off) | - | v2.1.224+; prompt appears even in bypassPermissions | L4694-4710 |
| processWrapper | string argv prefix | unset | | User or managed | `CLAUDE_CODE_PROCESS_WRAPPER` wins | v2.1.210+; macOS/Linux only | L4712-4727 |
| teammateMode | string | `"in-process"` | in-process, auto, tmux, iterm2 | Any; also reads older `~/.claude.json` value | `--teammate-mode` | - | L4729-4746 |
| worktree | object: baseRef, symlinkDirectories, sparsePaths, bgIsolation | unset | | Any | - | for `--worktree`, `EnterWorktree`, isolated subagents, background sessions | L4748-4767 |
| worktree.baseRef | string | `"fresh"` | fresh (= `origin/<default-branch>`), head (local HEAD incl. unpushed) | Any | - | in linked worktree `head` = that worktree's HEAD | L4769-4787 |
| worktree.symlinkDirectories | array of repo-root-relative dir paths | unset (none) | | Any | - | symlinks from main repo | L4789-4805 |
| worktree.sparsePaths | array of repo-root-relative dir paths | unset (whole tree) | | Any | - | git sparse-checkout: only listed dirs + root-level files; include `.claude` to get `.claude/settings.json` and `.claude/rules/`; enables `extensions.worktreeConfig` in shared `.git/config` | L4807-4825 |
| worktree.bgIsolation | string | `"worktree"` | worktree, none | Any | - | `worktree`: Edit/Write blocked in main checkout until `EnterWorktree`; session moved to bg with `←`//background edits in place regardless; `none` edits working copy; outside git a failing `WorktreeCreate` hook releases block | L4827-4845 |
| worktree.location | string abs or `~/` | unset (`<project-root>/.claude/worktrees/`) | | User only (remote machine `~/.claude/settings.json`) | - | desktop SSH sessions only; `--worktree`, EnterWorktree, subagents, bg sessions ignore; Desktop v1.44121.0+ | L4847-4865 |

Gitignored files (e.g. `.env`) into new worktrees: use a `.worktreeinclude` file at project root, "instead of a setting" (L4767).

## Tools (L5474-5531)

Section applies to the desktop app only; terminal CLI ignores these keys (L5476). All Managed: `browserExternalPageTools` (string `"disabled"`/`"disable"`, L5478-5492), `disableBrowserExternalNavigation` (bool, only JSON `true` effective, L5494-5512), `disableMobileSimulatorTools` (bool, only JSON `true` effective, L5514-5530). No tool-permission keys here; tool permissions live under `permissions.*`.

## Enterprise and managed settings (L5625-5877)

| key | type | default | values | notes | cite |
|---|---|---|---|---|---|
| disableSideloadFlags | bool | false | | rejects `--plugin-dir`, `--plugin-url`, `--agents`, `--mcp-config` (exit with error); also `CLAUDE_CODE_PLUGIN_DIRS` env (v2.1.280+) and SDK `addPlugins` (v2.1.301+); key v2.1.193+; `type:"sdk"` mcp-config entries still accepted | L5629-5657 |
| forceRemoteSettingsRefresh | bool | false | | block startup until server-managed settings freshly fetched; exits on failure; `true` from any admin-controlled managed source honoured; `claude auth` exempt | L5659-5677 |
| managedSourcesBehavior | string | `"first-wins"` | first-wins, merge | v2.1.242+; merge rules table: lists combine, locks strictest, allowlists whole from highest source, `env` merges per var, some keys highest-source-only (`apiKeyHelper`, `awsAuthRefresh`, `awsCredentialExport`, `gcpAuthRefresh`, `otelHeadersHelper`, `proxyAuthHelper`, `parentSettingsBehavior`, `modelPicker`, `policyHelper`, `permissions.defaultMode`); `permissions.allow` is a combined list | L5679-5722 |
| parentSettingsBehavior | string | `"first-wins"` | first-wins, merge | host-supplied (SDK/IDE) managed settings dropped or applied through restrictive-only filter | L5724-5740 |
| policyHelper | object path/timeoutMs/refreshIntervalMs | unset | | honoured only from macOS plist, Windows HKLM, or managed-settings file; output JSON must be under `managedSettings` key else silently applies nothing; failing startup run = refuse to start; 1 MiB stdout cap | L5742-5804 |
| policyHelper.path | string abs normalized path (Windows: drive/UNC ending `.exe`) | required | | | L5806-5820 |
| policyHelper.timeoutMs | int ms | 10000 | min 1000 | | L5822-5837 |
| policyHelper.refreshIntervalMs | int ms | unset (run once) | 0 disables, else >=60000 | | L5839-5856 |
| wslInheritsWindowsSettings | bool | false | | HKLM or `C:\Program Files\ClaudeCode\` only; v2.1.282+; no effect on native Windows | L5858-5876 |

## Answers to open questions

1. Keys ignored/limited in project-scope settings (all from read ranges):
   - `permissions.defaultMode` values `auto` and `bypassPermissions`: no effect from project or local; set in `~/.claude/settings.json` (L1145).
   - `skipDangerousModePermissionPrompt`, `useAutoModeDuringPlan`, `syncClaudeAiSkills`, `syncClaudeAiPlugins`: user/local/managed only; repo can't set (L930, L1266, L3871, L3889). `permissions.denyInsteadOfPrompting`, `skipAutoPermissionPrompt`, `autoMode`, `processWrapper`, `pluginConfigs`: user/managed only (L1173, L1250, L853, L4716, L4374). `pluginConfigs` project/local entries ignored because a cloned repo must not supply them (L4394). `prependPlugins`/`appendPlugins` ignored in project/local (L4400, L4420). `worktree.location` user only (L4851).
   - `env`: project/local cannot set listed variables (config dirs, OS dirs, OTel exporter/content, plugin/sync paths, OAuth, etc.; L2472-2496); several are ignored from every file (L2499-2506).
   - Gated by workspace trust dialog (not ignored, but inert until accepted): project `permissions.allow` (L962), `permissions.additionalDirectories` (L1041), `extraKnownMarketplaces` (silently ignored if untrusted, incl. `-p`, L4274), `autoMemoryDirectory` (same trust rule as hooks, L2367), hooks/statusLine/fileSuggestion (L3675). `env` from project/local applies after trust, or at startup in `-p` (L2466).
   - Cannot loosen: `blockReads/WritesOutsideWorkingDirectories` `true` in any file wins (repo can turn on, can't lift) (L1056, L1106); `isolatePeerMachines` same (L4698); `crossSessionInbound` project value only when stricter (L4658).
   - `headersHelper` in `.claude/settings*.json` of an `--add-dir` directory ignored (L4327). `autoMemoryDirectory` from repo settings = no auto memory loaded/saved from it (L1074).
   - No statement in these ranges that `hooks`, `permissions.deny/ask`, `statusLine`, `attribution`, `agent`, `worktree.*` (except `.location`), `skillOverrides`, `disableSkillShellExecution`, `enabledPlugins` are ignored in project scope; the index lists them as Any file (L99, L119, L145-150, L219, L230, L35, L20, L261-266, L91).
2. Stop-hook consecutive-block cap: no setting or env var stated in these ranges. Only a loosely related cap: with `denyInsteadOfPrompting`, auto mode ends the turn after 20 consecutive classifier-blocked/safety-refused actions (L1219). Not a Stop-hook cap.
3. `worktree.*` keys: `baseRef` (fresh|head, default fresh, L4769-4777), `symlinkDirectories` (L4789-4795), `sparsePaths` (L4807-4813), `bgIsolation` (worktree|none, default worktree, L4827-4835), `location` (desktop SSH only, user-scope, L4847-4851). Copy/symlink: only listed `symlinkDirectories` are symlinked (none by default, L4795); gitignored files copied only via `.worktreeinclude` at project root (L4767); with `sparsePaths`, only listed dirs + root-level files are written, so `.claude` must be listed to get `.claude/settings.json` and `.claude/rules/` (L4809, L4815); without `sparsePaths` each worktree checks out the whole tree (L4813). The page does not state anywhere in these ranges what is copied of untracked `.claude/settings.local.json`. Default worktree dir `<project-root>/.claude/worktrees/` (L4849). Also: `blockWritesOutsideWorkingDirectories=true` removes/refuses `EnterWorktree`/`ExitWorktree` (L1104); bg sessions default `bgIsolation:"worktree"` blocks Edit/Write in main checkout until `EnterWorktree` (L4829).
4. Skill listing and enable/disable: `skillListingBudgetFraction` (0.01 default, L2614), `skillListingMaxDescChars` (1536, L2630); per-skill `skillOverrides` on/name-only/user-invocable-only/off (L3845-3850), not for plugin skills (L3863); `disableBundledSkills` (L3803); `disableSkillShellExecution` (L3822); `strictPluginOnlyCustomization.skills` (managed, L4176); `syncClaudeAiSkills` (L3867). No per-skill allow/deny list key beyond `skillOverrides` stated in these ranges.
5. Attribution: `attribution.commit`, `.pr`, `.sessionUrl`, or `attribution: false` (v2.1.281+) to hide all (L3447-3450). Any file scope incl. project `.claude/settings.json` (L3446), so it can be turned off per project; for files older versions also read, use `commit:""`, `pr:""`, `sessionUrl:false` (L3450). Deprecated `includeCoAuthoredBy:false` still works unless `attribution.commit/pr` set (L3474). Older Claude Code versions skip the entire settings file containing `attribution: false` (L3447). Managed-settings attribution lines are not overridable by CLAUDE.md/memory rules (L3466). `includeGitInstructions:false` removes built-in commit/PR instructions (L3494).

## Not stated

- Stop-hook consecutive-block cap setting/env var (Q2).
- Hook event names, matcher syntax, handler fields, exit codes, timeouts: deferred to hooks reference (L3718, L3741); not in ranges.
- `statusLine` object shape (type/command/padding): lives in Interface section (skipped); only gating stated (L3671-3678).
- Any statement that project-scope `hooks` are ignored/blocked for security by default (only trust-dialog gating by reference to another page, L2367, L3675).
- Which untracked/gitignored files (e.g. `.claude/settings.local.json`) get copied into new worktrees besides `.worktreeinclude` behaviour (L4767).
- Agent-teams enable flag / experimental env var: only `teammateMode` and removed `teammateDefaultModel` appear (L244, L243); no enable key in these ranges.
- Any per-project key to disable individual skills other than `skillOverrides`.
- Settings precedence/merge order across files: referenced to `settings.md` (L924), not in this page's ranges (only managed-source merge table L5701-5710).
- `ignorePatterns` details beyond "deprecated" (L1022).

## Anomalies

- L1-3: page begins with a directive to a reader to fetch an external llms.txt index. Not acted on.
- L3466: states Claude Code tells Claude to prioritise user CLAUDE.md/memory attribution rules over commit/PR lines (unless managed). Product behaviour description, not an instruction to this agent.
- L1104: "follow Claude has no EnterWorktree tool" linkage text addresses the reader; not acted on.
- Index vs body mismatch: `permissions.defaultMode` index says Any file (L149) but body says `auto`/`bypassPermissions` ignored from project/local (L1145). Index `skipDangerousModePermissionPrompt` scope "User, local, or managed" (L221) vs body adds `--settings` (L1266).
- `attribution: false` is rejected by pre-v2.1.281 clients, which then skip the whole settings file (L3447): a hazard when writing it into a shared project file.
- Typo-adjacent: L1219 message "20 actions were refused..." and `permissions.disableAutoMode` dual placement (L893, L908).
- Deprecated/removed keys present in index: `disableArtifact` (L78), `includeCoAuthoredBy` (L122), `keybindingFlavor` (L126), `permissionExplainerEnabled` (L142), `taskOutputMaxChars` (L242), `teammateDefaultModel` (L243).
- No injection-style instructions aimed at an AI agent found beyond L1-3.

## Audit checkpoints

1. Every top-level key MeowKit writes into `.claude/settings.json` must appear in the index (L17-267); unknown keys not listed there (e.g. `ignorePatterns` is deprecated, L1022).
2. `hooks` must be an object keyed by event, each value array of `{matcher, hooks:[{type,...}]}` with `type` in command/prompt/agent/http/mcp_tool (L3721).
3. Project `hooks` merge with (not replace) user/managed hooks; MeowKit hooks cannot remove managed ones (L3720).
4. Any `disableAllHooks:true` in a file MeowKit writes would also disable custom `statusLine` and `fileSuggestion` (L3640, L3644).
5. Under managed `allowManagedHooksOnly` or `strictPluginOnlyCustomization:["hooks"]`, MeowKit's project hooks do not run (L3631, L4208-4211); statusLine narrowed to managed (L3634).
6. HTTP hooks (if any) need URL match in `allowedHttpHookUrls` (if defined; `[]` blocks all) and env vars in both hook `allowedEnvVars` and `httpHookAllowedEnvVars` (L3590, L3745).
7. `permissions.defaultMode` of `auto`/`bypassPermissions` in project `.claude/settings.json` has no effect; verify MeowKit does not rely on it (L1145).
8. `permissions.allow` and `additionalDirectories` in project settings take effect only after the user accepts workspace trust (L962, L1041).
9. `permissions.deny` takes precedence over ask/allow; first match wins; deny blocks in bypassPermissions (L966, L1165).
10. Bash deny patterns like `Bash(curl *)` do not cover `/usr/bin/curl` or `sh -c`; Read/Edit deny does not cover `grep -r` (L999, L1022).
11. If `permissions.blockWritesOutsideWorkingDirectories:true` is present, `EnterWorktree`/`ExitWorktree` are removed/refused and subagent worktrees outside working dirs refuse edits (L1104, L1132); `.claude/worktrees` needs adding via `/add-dir` or user `additionalDirectories` (L1135, L1139).
12. Repo-only `additionalDirectories` do not count as working directories for read/write blocks (L1072, L1131).
13. `permissions.disableBypassPermissionsMode` value must be string `"disable"` (L1232); `disableAutoMode` same (L894).
14. `env` in project settings: verify none of the dropped variable names are used (config dirs, HOME/TMPDIR/XDG_*, OTel exporters, plugin dirs, OAuth, `CLAUDE_CODE_RESTRICTED`, etc.; L2472-2506); `env` values are plain text reaching all subprocesses (L2461).
15. Project `env` applies after trust (or at startup under `-p`) (L2466).
16. `attribution` in project settings is valid (Any file); for older clients use `commit:""`, `pr:""`, `sessionUrl:false` rather than `false` (L3446, L3447, L3450).
17. `includeCoAuthoredBy` is deprecated since v2.0.62 and ignored once `attribution.commit/pr` set (L3472-3474).
18. `claudeMdExcludes` is array of globs/absolute paths and cannot exclude managed CLAUDE.md (L2425, L2434).
19. `autoMemoryDirectory` set in project settings yields no auto memory load/save from it; plus write block refuses it (L1074, L1133).
20. `skillListingBudgetFraction` must be number in (0,1] (default 0.01); `skillListingMaxDescChars` positive int (default 1536) (L2613-2614, L2629-2630); skill description + `when_to_use` truncated at that cap (L2626).
21. `skillOverrides` values only on/name-only/user-invocable-only/off and do not apply to plugin skills (L3845-3850, L3863).
22. `disableSkillShellExecution:true` makes inline `` !`cmd` `` blocks in MeowKit skills/commands print `[shell command execution disabled by policy]` (not bundled/managed skills) (L3824, L3838).
23. Under `allowManagedPermissionRulesOnly` (v2.1.282+), skill/command `allowed-tools` frontmatter from repo `.claude/` is ignored (L822-824).
24. `enabledPlugins` keys must be `plugin@marketplace`; project scope enables without installing; project beats user (L4246, L4264, L4268).
25. `extraKnownMarketplaces` entries in project settings are ignored silently in untrusted folders including `-p` (L4274).
26. `worktree.baseRef` values only fresh|head (default fresh); `worktree.bgIsolation` only worktree|none (default worktree); `symlinkDirectories` and `sparsePaths` are repo-root-relative arrays (L4774-4777, L4832-4835, L4794, L4812).
27. If `worktree.sparsePaths` is used it must include `.claude` for worktrees to get `.claude/settings.json` and `.claude/rules/` (L4815); gitignored files via `.worktreeinclude`, not a setting (L4767).
28. `teammateMode` values in-process|auto|tmux|iterm2 only (default in-process) (L4734-4739).
29. `agent` is a string agent name; `--agent` overrides (L4644-4646).
30. `crossSessionInbound` only accept|hold|refuse; unrecognised value causes hold (L4659-4673).
31. `statusLine` is a settings key (Any file) but is disabled when folder untrusted (L230, L3675).
32. Keys removed/deprecated that MeowKit must not emit as functional: `taskOutputMaxChars` (no effect, L2644), `teammateDefaultModel` (removed, L243), `permissionExplainerEnabled` (removed, L142), `keybindingFlavor` (no effect, L126), `disableArtifact` (deprecated, L78).
33. No Stop-hook cap key is documented in these ranges; any MeowKit setting/env claiming one cannot be verified here (Q2, Not stated).
