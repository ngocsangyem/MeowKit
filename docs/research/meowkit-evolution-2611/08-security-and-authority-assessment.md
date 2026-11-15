# 08 — Security and authority assessment

Baseline: `main` @ `c7ff0a9e` (2026-11-15). Compiled from `findings/` (D01, D02, D04, D05, D06, D07, D10, D12) with `R1` (source claims) and `R2` (citations) taking precedence. Where this document cites `path:line` it was re-read on `c7ff0a9e` by the compiler ("re-read" in §9). Labels per `BRIEF.md`. Describes weaknesses at the level needed to fix them; contains no exploit recipes or payload text.

Layer legend used throughout: **M** model instruction (prose) · **A** advisory hook (runs, cannot stop the call) · **H** host-enforced hook (host blocks the tool call on exit 2; the script defines the policy) · **HP** host permission rule · **OS** OS sandbox · **X** external (installer, CI, registry) · **N** none.

## 1. Summary

1. **H7 verdict, in the form the evidence supports:** *Partially supported, narrowly.* On Claude Code, three guards are real host-enforced blocks that fail closed on faults inside their own libraries: Gate 1 (Edit/Write without an approved, hash-fresh plan), privacy block (Read/Edit/Write of obvious secret file names), and pre-ship (a literal `git commit|push|merge` without a Gate 2 paperwork pass, plus an executed test/lint run). They stop the accidental, forgetful and scope-drifting agent (R1 §4: unplanned edits, stale approvals, wrong-revision ship, failing tests). They do **not** stop a deliberate or injected agent with shell access: Bash is an unguarded write and read path, `.claude/` is writable through Gate 1 itself, approval artefacts are agent-writable, and the ship trigger is a literal regex. No host permission rule, sandbox or egress control ships. Most of `injection-rules.md` and `security-rules.md` is prose or after-the-fact detection. Nobody has measured any control against an adaptive attacker on a current model (UNKNOWN).
2. Gates are **accident guards by design and say so in places** (`approval-receipt.cjs:3-6`, `gate2-check.cjs:142-143`, privacy header). The overstatement is in the rules files, `CLAUDE.md` and README ("NON-NEGOTIABLE", "No bypass", "4-layer+"), not in the hook source (§7).
3. Highest-severity confirmed items (R1 §9, severity relative to a deliberate agent): (i) Bash and `.claude/` unguarded, with `Bash(git *)`, `Bash(gh *)`, `Bash(node .claude/hooks/*)` pre-approved; (ii) guard failure modes outside the libraries (corrupt/missing entry script, no `node`, timeout) are non-blocking and no hook sets `onFailure`; (iii) documented Gate 1 exceptions have no implementation while the contract gate fires on ordinary plans; (iv) Gate 2 trigger misses spacing/option/alias/`gh` forms.
4. Cheapest real hardening is configuration, not code: narrow `permissions.allow`, add `ask` for stamp/push/force, set `onFailure:"block"` on the three guards (host ≥ v2.1.295). §9.
5. Delegate-to-host gives the only layers independent of model and command text: OS sandbox (fs + network), `permissions.deny`, managed settings, server-side branch protection. Each loses the dynamic "approved plan exists" condition. §9(B).
6. Supply chain: Rust installer checks a same-release SHA-256 and a URL prefix, no signatures (maintainer decision, documented); the published v2.15.0 release has no `checksums.txt`, installer pins are null. A tampered kit asset executes as hooks. §6.
7. Literature: prose "treat as data" rules are context, not enforcement, by the host's own words; adaptive attacks broke 12 research defences. This is strong for research defences and **untested** on MeowKit-style prose and 2026 frontier models (R2). "Not a boundary" is safe to say; "ineffective" is not.
8. Nothing here recommends removing a security control on cost grounds. Removal candidates are confined to markers that perform no security function (constant-true sentinel, wrongly-aimed advisory text) and only with a named check.

## 2. Threat model

### 2.1 Assets, actors, boundaries

| Item | Content |
| --- | --- |
| Assets | Source tree integrity; secrets in repo/env/`$HOME`; the developer's credentials (`gh` token, cloud keys); the shipped release (git history, PRs, npm/GitHub release); the control plane (`.claude/settings*.json`, hooks, `.meowkit/config.yaml`, `.meowkit/state/*`, plan receipts, verdict files); team memory; developer attention (approval fatigue is an asset that is spent) |
| Actors | (a) careless/overeager agent, no attacker; (b) misled agent: injected text in files, issues, web pages, tool or subagent output; (c) malicious project content: a cloned repo with hostile `.claude/`, `.mcp.json` or rules; (d) malicious dependency, skill, MCP server or plugin; (e) compromised release channel (GitHub release, npm, CI token); (f) the developer and teammates (authority, not adversary) |
| Trust boundaries | model ↔ instruction text (no enforced boundary); hook ↔ tool (host-enforced only for matched tools); agent ↔ control plane (same write permission, no boundary); project directory ↔ host (CC runs settings-file hooks in untrusted folders and under `-p`, D10 F-D10-10); kit release ↔ developer machine (checksum only); session ↔ egress (no control); agent ↔ human (host permission prompt is the only enforced approval primitive, D10 F-D10-16) |

### 2.2 Threat table

| # | Threat | Real-world evidence (R2 status) | Boundary that fails | MeowKit exposure |
| --- | --- | --- | --- | --- |
| T1 | Careless agent, no attacker | Anthropic auto-mode post: FNR 17% on real overeager actions, n=52 (R2 C, vendor self-report). 2026-09-09 alignment report: R2 reframes it as an **evaluation-environment misconfiguration**, not a sandbox bypass; low weight here | model judgement | Gates and ship test run catch this class (R1 §4). Best-covered threat |
| T2 | Indirect injection via repo/issue/web/tool output | Gemini CLI, GitHub-MCP toxic flow (D12 opened; R2 did not re-open: DOCUMENTED, secondary). 2510.09023: 12 research defences bypassed, human red-team beat all (R2 C; scope: research defences, Gemini 2.5/Llama-3.3 era) | file content → instruction | Rules 1/2/6/9 are M only. Effect on a 2026 frontier model of the "DATA" prose is UNKNOWN |
| T3 | Project content runs on open | CVE-2026-21852 (NVD C: repo `ANTHROPIC_BASE_URL` leaked keys pre-trust, <2.0.65). CVE-2025-59536 (NVD: pre-trust code execution <1.0.111; `.mcp.json` mechanism is Check Point, secondary) | repo → host execution | Kit ships `.claude/settings.json` hooks; CC settings-file hooks need no trust and run under `-p` (D10 F-D10-10). A hostile clone with its own `.claude/` has the same shape; a clone with the kit gets the guards |
| T4 | Agent edits own guardrails | CVE-2025-53773 (NVD generic "command injection"; auto-approve-setting mechanism from Embrace The Red/MSRC, secondary) | data plane writes control plane | `.claude/*` is Gate-1 non-source (R1 2); settings, hooks, env blocks writable. Host marks `.claude` a protected path (prompts in default modes, DOCUMENTED, not run here) |
| T5 | Allow-list / command-text bypass | CVE-2025-55284 (NVD: overly broad safe-command allowlist, <1.0.4; DNS detail from researcher write-up). Host: Bash rules "aren't a security boundary" (R2 C) | command-string policy | Pre-approved `git *`, `gh *`, `node .claude/hooks/*`; Gate 2 trigger is a command regex (R1 4) |
| T6 | Malicious skill/rules/MCP | Snyk ToxicSkills: 76/3,984 confirmed malicious, 13.4% with a critical issue (R2 C, vendor scan, 2026-02-05). Rules-file hidden-Unicode backdoor, tool poisoning (D12 DOCUMENTED, not re-opened by R2) | publisher → installer | Kit distributes 128 skills + hooks and is itself the supplier; no content scan on install (F-D04-06) |
| T7 | Compromised release/installer | Nx s1ngularity: trojaned npm releases drove local Claude/Gemini CLIs (R2 C) | registry/CI token → machine | npm 2.3.1 ignored checksums; Rust same-origin checksum; no signatures (§6) |
| T8 | Memory poisoning | ChatGPT memory, MINJA, AgentPoison >80% ASR at <0.1% poison (R2: IDs exist, abstract numbers C; RAG/consumer agents, not coding agents) | untrusted content → durable state | Committed team memory; lint is a phrase blocklist (R1 9). Deliverable 09 owns detail |
| T9 | Cross-agent injection | Prompt Infection (R2 C-exists; GPT-4o/3.5, tiny scale) | subagent output → lead trust | 44 agents, status protocol (`agent-conduct.md` A1) trusts subagent status; no external validation |
| T10 | Self-approval / approval fatigue | 93% of permission prompts approved (R2 C, vendor). Invariant: "Always Allow" removed the catching check | human gate | Receipt self-stampable; per-task gate rhythm differs from per-action prompts (INFERRED) |
| T11 | Exfil via egress (DNS, `gh`, PR body, package fetch) | CVE-2025-55284; s1ngularity; GitHub-MCP PR leak | network egress | No egress control, no sandbox key (L-12) |

Adaptive-attack evidence (T2): strong for the defences it tested, but **untested on MeowKit-style prose and on 2026 frontier models** (R2 §6c). Vendor injection-robustness figures are surface-specific; per-model numbers for current models are press-only (R2). Use them to bound claims, not to relax OS/host controls.

## 3. Enforcement classification

Each control: stated purpose first, then judged against that purpose and against an adversarial model. "Doc/new" = restates a limit the repo already documents, or is new beyond it.

### 3.1 Controls

| Control | Intended purpose | Layer | What it actually stops (R1 verdict) | Bypass class | Residual risk | Doc / new |
| --- | --- | --- | --- | --- | --- | --- |
| **Gate 1 plan gate** (`gate-enforcement.cjs`, `lib/core/plan-gate.cjs`, `lib/gate1-path-rules.cjs`) | Stop forgetful/unplanned source edits (accident guard) | H on `Edit\|Write` only (`settings.json`); fail-closed on library faults | No plan → exit 2 on `src/*` (R1 1a CONFIRMED, also under LEAN). Fail-closed for lib/stdin faults (R1 1b CONFIRMED for those) | (1) Bash/interpreter writes unguarded; (2) `.claude/*` and `docs`/`tests` segments allowlisted at any depth (`gate1-path-rules.cjs:44-53`); (3) symlinked docs dir (`classify` uses `path.resolve`, no realpath, `plan-gate.cjs:74-99`); (4) outside-project paths are only "gated", so any approved plan lets them through (R1 2); (5) plan chosen by newest mtime, so a touched old approved plan restores a pass (R1 2); (6) tools not in the matcher: MultiEdit/NotebookEdit reach UNKNOWN (D01; needs live probe) | Deliberate agent writes freely; accidental edits caught | (1) Bash scope documented for privacy only, not in `gate-rules.md`; (2)-(5) **new** (R1 2) |
| Fail-closed behaviour of guards | Guard crash must not allow | H, partial | Library/stdin faults → exit 2 | Corrupt/missing entry script (exit 1/127), no `node`, timeout → non-blocking; `.claude/*` lets the agent write that corruption (R1 1b REFUTED as blanket; 1c WEAKENED); no `onFailure` set (settings.json re-read) | Silent no-op guard | `hook-coverage.json:50-54` "Not probed"; host behaviour DOCUMENTED (R2 C). Partly documented, never tested |
| **Approval receipt** (`approval-receipt.cjs`) | Bind approval to a plan revision; detect scope drift after approval | H via Gate 1; data is agent-writable | Plan body edit after stamp → block; newer unapproved plan → block (R1 2) | `stamp <plan> [approver]` defaults `approved_by: human`, runs through a pre-approved command glob (R1 3a CONFIRMED; allow-rule glob VERIFIED, prompt behaviour not run) | Proves "stamped", never "human approved" | **Documented** (`approval-receipt.cjs:3-6`, `gate-rules.md`). The pre-approval composition is **new** (R1 §4) |
| **Contract gate** (`check-contract-signed.cjs`) | Signed sprint contract before edits in autobuild FULL density | H via Gate 1 | Blocks any date-named plan with no `tasks/contracts/` when LEAN is unset (R1 5b CONFIRMED) | `MEOWKIT_AUTOBUILD_MODE=LEAN\|MINIMAL` env; forged one-line `status:` file via Bash (`isSigned`, `check-contract-signed.cjs:73-81`); Write/Edit on contract files is schema-validated, Bash is not (R1 3c WEAKENED) | Off in LEAN (machine artefact here, §3.2) | Scope mismatch with `harness-rules.md` Rule 3 is **new** (R1 5b); intended scope is a maintainer question |
| **Gate 1 hatch** (`gate1-hatch.cjs`) | Logged, deliberate downgrade to plan-presence | H, hatch reader is closed | Refuses if unloggable or user/project file collapse (D01 F-06 VERIFIED) | Env is host-process only; user-scope file `~/.meowkit/config.yaml` lies outside the project root and Gate 1 treats outside paths as "gated", not denied (INFERRED, not tested) | Persistent downgrade across projects | Design is good; user-file write path UNKNOWN (F-D04-12) |
| **Gate 2 / pre-ship structural** (`lib/core/pre-ship.cjs`, `gate2-check.cjs`) | Ship only with a verdict naming current HEAD and no FAIL/BLOCK; explicitly "paperwork present, not human approval" | H on Bash command matching `SHIP_COMMAND` (`pre-ship.cjs:18`) | Literal `git commit`, `git push` (incl. force), `git merge` → rc=2 without verdict (R1 4) | Command-form variants: extra whitespace, global options before the subcommand, git aliases, the `gh` CLI route for PR create/merge (R1 4 CONFIRMED); forged verdict + active-plan pointer passes (R1 3b CONFIRMED); false positive on text containing the phrase; not ported to Codex, Cursor unknown (D04 4a) | Ship by any non-matching route | **Documented**: forgeability (`gate2-check.cjs:142-143`, pre-ship output). Trigger forms **new** (R1 4) |
| **Executed test/lint at ship** (`preship-checks.cjs`) | Do not ship a failing build | H, same trigger | Failing `npm test` → rc=2 (D01 F-07 executed; R1 §6 keep). The strongest mechanical check | 30 s hook timeout (`settings.json`) → non-blocking (R1 1c, DOCUMENTED); `MEOWKIT_HOOK_PROFILE=fast` skips it; missing `test` script or tool → named SKIP | Slow suite silently allows ship | Profile/SKIP documented; timeout-as-allow **new** (R1 1c) |
| **Privacy block** (`privacy-block.cjs`, `lib/core/privacy.cjs`) | Stop accidental reads of obvious secret file names by file tools | H on Read/Edit/Write (+ Bash for the fetch tool only); inline fail-closed | `.env`, `.env.*`, `secret`, `credentials`, `*.pem`, `*.key`, `.ssh/` names → rc=2 (R1 6; regex `privacy.cjs:15`) | Bash reads carry no file path (header admits); no Grep/Glob matcher; unmatched names (dotenv-adjacent, package-manager/cluster/registry configs, bare key names); false positives on `secret` substring and `.env.example` (R1 6 CONFIRMED) | Credential read by agent is trivial; the "approved → read" path is unrecorded | **Documented**: Bash scope (header). Name gaps **new** |
| Privacy SSRF check (fetch tool only) | Block loopback/private fetch via web-to-markdown | H, narrow | Matches `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, metadata hosts (`privacy.cjs`, `UNSAFE_HOST`) | Ranges not in the pattern (172.16/12, IPv6 loopback, `0.0.0.0`, numeric forms) INFERRED from source; any other fetcher unchecked | Narrow | New (D01, INFERRED) |
| **Post-write scan** (`handlers/post-write.cjs`) | Flag obvious blocked patterns in code just written | A/H-after: exit 2 returns stderr, file already on disk | Catches unspaced `apiKey=`-style secrets, `: any`, SQL template literal, destructive `.sh` lines (R1 7 CONFIRMED) | Spacing around `=`; extensions not scanned (`.tsx .py .mjs .cjs .jsx .go .rs`); inverted RLS pattern misses `DISABLE ROW LEVEL SECURITY`; Bash writes; toggleable off by committed config (§4) | Detection with large false-negative surface | After-the-fact is **documented** (header). Coverage **new** |
| **Injection R1/R2/R6/R9** | Model should treat content as data, stay in project, resist flooding | M | Nothing mechanical (D01 F-09; R6 contradicted by R1 2) | n/a (prose) | Effect unmeasured on current models (UNKNOWN) | Host says rules are "context, not enforced" (D12 F-D12-01, R2 C) |
| Injection R2/R5/R8 `pre-task-check` | Warn on injection-like or exfil-like text | A, exit 0 | Prints text; call proceeds (D01 F-03 executed). Scans the agent's own outgoing command, not tool output | n/a | Zero blocking effect, wrong direction | Header says "ADVISORY by contract"; the printed "BLOCK … STOPPED" wording contradicts it |
| Injection R3 memory lint | Reject injection phrases/secrets in memory writes and at ship | H at ship **if** `mewkit` resolves, else `SKIP … exit 0` (`memory-store-lint.cjs:74`) | Literal, fullwidth, zero-width and multi-line variants (R1 9 CONFIRMED, executed) | Paraphrase; cross-script confusables; phrase split across lines (R1 9 CONFIRMED) | Syntactic tripwire; semantic poison passes any lint | Tripwire nature partly documented; confusable claim in `normalize.rs`/Rule 8 partially contradicted (F-D05-04). Detail: deliverable 09 |
| Injection R4 sensitive files | see Privacy block | H | see above | see above | see above | see above |
| Injection R7 fetch quarantine | Untrusted fetched content quarantined | skill-local code (D01 F-09; not re-run by R1) | Real inside `web-to-markdown` | Does not cover other fetchers | Local | Label: D01 VERIFIED, not independently re-verified |
| Injection R10 escalation audit | Log suspected injection | M + manual CLI | `injection-audit.cjs` works; nothing calls it (compiler grep on main: references only in its own lib files and `HOOKS_INDEX.md`) | n/a | No automatic record | New: "LOG" step is manual |
| Injection R11 Skill Rule of Two | Design-time lint | CLI lint (`structure.rs`, `skill-schema.json`, D01) | Static check | `chrome-profile` has all three legs and no human gate, no `injection_risk`/`trust_level` (D02 F-D02-14; compiler re-read `chrome-profile/SKILL.md:28-38`) | Unit is per-skill (§5.3) | New |
| **security-rules.md blocked patterns** | "BLOCK, do not write" for new code | M + A after write | See post-write | Rows with no detector: missing RLS, auth guards on controllers, anon key server-side, `CASCADE DELETE` (WARN only), NestJS `process.env` (D01 F-10) | Mostly prose | After-write documented; "BLOCK do not write" overstated (§7) |
| **Safety sentinel** (`safety-sentinel-inject`, `post-session.cjs`) | Let a skill skip a rules re-read ("safety baseline verified") | A | Prints a marker; Stop handler writes `"safety":true,"phase_zero":true` unconditionally (compiler re-read `post-session.cjs:~128-132`) | n/a | Misleading "verified" marker | New; removal needs a check that `agent-detector` does not depend on it (R1 §5) |
| **Budget / loop "blocks"** (`budget-tracker.cjs`, `loop-detection`) | Cap cost, break loops | A, exit 0 via dispatcher | Plain stdout on PostToolUse; host docs say only exit 2 / JSON reaches the model there (R1 8, DOCUMENTED, not run live) → probably invisible | `budget-tracker.cjs:75` returns a string; `dispatch.cjs:102-108` exits 0 | Control that cannot act | New (stronger than D01) |
| Stop completion gate (`pre-completion-check`) | Block "done" without verification | A/dead | Opt-in flag file written by nothing (D01 F-11 #7; not re-reviewed by R1) | n/a | Unreachable | New (D01) |
| TDD failing-test-first (`pre-implement.cjs`) | Enforce test-first in `--tdd` | M (unregistered, exits 1) | Nothing (D01 F-11 #1) | n/a | Prose only | New (D01) |
| Installer verification | Detect corrupt/tampered kit | X: URL prefix + same-release SHA-256 | Refuses without `checksums.txt` unless `--allow-unverified-kit`; zip extraction refuses traversal/symlinks/oversize (F-D04-06) | Attacker who controls the release controls both zip and checksum; npm 2.3.1 ignored checksums | Release-channel compromise | **Documented** (`RELEASING.md:583`: detects corruption, not tampering) |
| Config toggles (`hooks.<observer>: false`) | Let users switch off observers | config | Seven direct guards have no config off-switch (F-D04-12) | Committed `.meowkit/config.yaml` can disable `post-write` and `pre-completion-check` (PR-editable) | Scan silently off via PR | **New** (F-D04-12; toggles were deliberate) |
| Host permission rules | Enforce allow/deny/ask | HP | **None shipped as deny/ask**; allow list pre-approves `git *`, `gh *`, `node .claude/hooks/*`, `npm test`, `find *`, `ls *` (settings.json re-read) | n/a | The permission layer works against the guards | New composition (R1 §4) |
| OS sandbox / egress | Confine Bash subtree | OS | **Absent** (no `sandbox` key, re-read) | n/a | No layer independent of model and command text | Absent by default on the host too (R2 C) |

Hooks apply inside subagents (R1 §7, DOCUMENTED + live), so subagents are covered by the same guards and share the same bypasses.

### 3.2 Kit property vs machine artefact

| Observation | Class |
| --- | --- |
| `MEOWKIT_AUTOBUILD_MODE=LEAN` from untracked `.claude/settings.local.json` (globally git-ignored); contract gate off here | **Machine** (L-14, R1 §7). Kit property is the inverse: without LEAN the contract gate blocks ordinary plans (R1 5b) |
| User-global `~/.claude/CLAUDE.md` tells the agent that an approved sensitive read is done with `bash cat` (the unguarded path) and the user's global rules claim "MANDATORY / OVERRIDE" alongside MeowKit's (L-07, D01 F-08) | **Machine** (user-global toolkit). Shows the rule layer has no arbitration between toolkits |
| Vercel plugin hook injecting mandatory-voiced skill instructions on keyword match (L-08) | **Machine** (third-party plugin) |
| `mewkit` absent on PATH: pre-ship memory lint prints SKIP | The SKIP-when-CLI-absent behaviour is a **kit property**; its occurrence here is machine |
| Stale `target/debug` binary, missing `node_modules` (checker not runnable), name-only skill listing | **Machine** (R1 §8) |

## 4. Authority and precedence

### 4.1 Instruction layers

| Layer | Trust intended | What actually enforces it | Can a lower layer weaken it? |
| --- | --- | --- | --- |
| Managed settings (host) | Highest; tamper-resistant tier on CC, Codex, Cursor (D10 F-D10-09) | Host | No. Kit is not installed here |
| `permissions.deny` / `ask` | Host-enforced "not by the model" (R2 C); deny > defer > ask > allow in all modes; a hook allow never beats a deny rule; exit 2 beats allow rules (D10) | Host | Project/local settings can add `allow`; none shipped as deny/ask |
| `.claude/rules/*`, `CLAUDE.md`, SKILL frontmatter | Instructions (project-owned) | Model compliance; host calls them "context, not enforced configuration" (R2 C) | Memory/file text can contradict; host picks "arbitrarily" between conflicting instruction files (D12 F-D12-18) |
| Hooks in `.claude/settings.json` | Enforcement for matched tools | Host for matched tools; fail-open on host-level faults (R2 C) | **Yes**: agent-writable file; edit via Gate-1-allowed path (R1 2) |
| `.meowkit/config.yaml` (project) | Behaviour toggles | Hook code | **Yes**: PR-editable; can turn off `post-write` and Stop gate (F-D04-12) |
| `~/.meowkit/config.yaml` (user) | Gate 1 hatch | `gate1-hatch.cjs` | Project file cannot; agent write to the user file is UNKNOWN (outside project root, "gated" until a plan exists) |
| Env vars (`LEAN`, `HOOK_PROFILE`, `PRESENCE_ONLY`, `SKIP_SAFETY_SENTINEL`) | Operator hatches | Host process env | A `settings.json`/`settings.local.json` `env` block is under `.claude/` (agent-writable); reload behaviour untested (D01 F-06 INFERRED) |
| Plan, receipt, verdict, contract, `active-plan.json` | Evidence of approval | Gate scripts read them | **Yes**: all agent-writable; stamp and pointer reachable with no prompt (R1 3) |
| Memory files | DATA (`injection-rules.md` Rule 3) | PR review, lint | n/a; lint evaded (R1 9) |
| File content, tool output | DATA | Model | n/a |
| Subagent output | Trusted status (`agent-conduct.md` A1) | none | No external validation (T9) |
| Agent `memory:` frontmatter | Meant as memory, not tools | Host: "Read, Write, and Edit tools are automatically enabled" (R2 C) | **Yes**: 36 agents set it; 21 are otherwise read-only and gain Write/Edit; `explore` lists `Read, Grep, Glob, Bash` plus `memory: project` (compiler re-read; R1 11b VERIFIED live) |

### 4.2 Where developer authority is real

- **Real**: a host permission prompt (`ask`) or managed policy; the user's own typed chat. A hook can force an `ask` on Claude Code (not on Codex PreToolUse, where `ask` is rejected, D10 F-D10-16).
- **Recorded but unproven**: `approved_by: human` in the receipt; a Gate 2 verdict naming HEAD; "approved" `AskUserQuestion` answers for sensitive reads (nothing records or verifies them, D01 F-08); the Gate 1 hatch log (records, does not authenticate).
- The maintainer's `mewkit plan approve` and an agent's stamp run the **same code** (`approval-receipt.cjs:152-154`; R1 §4), so the human path and agent path are indistinguishable to the gate.
- Pre-approving the stamp command (`Bash(node .claude/hooks/*)`) removes the one host-enforced moment where a human could see the approval being created.

## 5. What the literature says works

Grades (compiler's scale): **A** deterministic and measured; **B** measured, probabilistic; **C** design principle or vendor claim, no independent measure; **D** weak or contradicted for this use.

### 5.1 Defence table

| Defence | Layer | Measured effectiveness (R2 status) | Known bypass | Residual | Grade |
| --- | --- | --- | --- | --- | --- |
| "Treat content as DATA" prose | M | No direct measure of this form. Spotlighting >50% → <2% ASR on GPT-family, static attacks (2403.14720, C) | Adaptive >90% on 12 defences, incl. spotlighting/sandwiching >95% (2510.09023, R2 C; research defences, 2025 models) | High vs adaptive attacker; **UNKNOWN** for 2026 models | D |
| Vendor RL/classifier robustness | model/host | Anthropic 2025-11-24: Opus 4.5 8.0% → 1.4% with safeguards, 100-attempt attacker (R2 P: setup confirmed, per-model figures in a chart). Opus 5/Fable figures press-only | Rises with attempts; surface-specific | Low but non-zero; vendor self-report | B |
| Regex/LLM detectors | A | Snyk scanner recall: malicious code 100%, prompt injection 91%, secrets 32% (vendor-run; R2 C text, recall table not re-checked) | >90% adaptive bypass | Triage only | C |
| Bash command-string deny/allow | HP | Stops the usual form | Host: "isn't a security boundary around the program" (R2 C) | Not a boundary | C |
| PreToolUse hook (exit 2) | H | Deterministic for matched tools when the script is correct | Fail-open on timeout/crash/other exit (R2 C); alternate tools/paths; `if` filter best-effort | Boundary only for matched tools with fail-closed config | A (narrow) |
| `onFailure:"block"` | H config | Host feature, v2.1.295+ (R2 C) | No effect on `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`, async hooks; `PermissionRequest` failure = deny | Closes crash/timeout class for matched events | A |
| Permission prompts | HP + human | 93% approved (R2 C) | Fatigue, "Always Allow" | Weak for volume, good for rare high-stakes | B |
| Classifier auto mode | host LLM | FPR 0.4%, FNR 17% real overeager (n=52), 5.7% synthetic exfil (R2 C) | Consent misread; incomplete rules | Additive only | B |
| OS sandbox (fs **and** network) | OS | Vendor: 84% fewer prompts (no methodology); security needs both isolations (D12 F-D12-10) | Sandbox-bypass CVEs **not surveyed**; Read/Edit/Write/WebFetch not covered; off by default; escape-retry unless disabled (R2 C) | Real boundary for Bash subtree only | A (scoped) |
| Architectural (CaMeL, dual-LLM, plan-then-execute) | design | CaMeL 77% vs 84% undefended on AgentDojo (R2 C) | Utility loss; not available in coding hosts | n/a to MeowKit | A (not applicable) |
| Rule of Two (Meta, per **session**) | design | No ASR measure; Meta: HITL "can fail", not sufficient | Misuse of unit | Needs supervision when all three present | C |
| Folder trust + managed policy | host | Fixes shipped for 3 CVEs (NVD: C for CVE-2026-21852; P for others) | `-p`/SDK skip the dialog | Version-dependent | B |
| Skill signing/pinning | X | Integrity/provenance only; "does not prove safe" (D12; NVIDIA doc, secondary) | Compromised publisher, unsigned additions | Not host-enforced | C |
| Skill/content scanning | X | Recall 21–100% by category (Snyk); hermes `skills_guard` regex v14 admitted heuristic (D07 F-D07-10, VERIFIED) | Trust-by-origin: "builtin" bytes skip scan | Triage, not gate | C |
| Human PR review of rules/memory | human | No measure | Hidden Unicode; semantic poison; fatigue | Weak for hidden/semantic | C |

Context on reference harnesses: the others also treat the OS as the boundary. Hermes `SECURITY.md` names the OS the only boundary against an adversarial LLM and lists its approval gate, redaction and scanner as heuristics (D07 F-D07-10, VERIFIED). deepseek-harness ships a kernel file-write sandbox plus approval and disclaims audit status (D06 F-D06-16). qwen-code hash-binds approval of project hooks/MCP and treats script exit codes ≥3 as deny (D06 F-D06-15/17). MeowKit's own honest split (hook headers) matches this; its rules-file wording does not.

### 5.2 Boundary vs deterrent (INFERRED from the above)

Real boundary: OS sandbox (fs + egress), managed policy, secrets absent from the agent environment, host `deny`/`ask`. Partial: fail-closed hooks on matched tools. Deterrent: prose rules, Bash string matching, regex lint, classifiers, LLM review, unenforced signing.

### 5.3 Rule of Two scoping: open design question (not a verdict)

Rule 11 applies the Rule of Two per **skill**; Meta defines it per **session** (untrusted input, sensitive data, state change/external communication "within a session"; D12 F-D12-09, DOCUMENTED). A coding session loads repo files, issues and MCP output (A), has `$HOME`/env access unless blocked (B), and has Bash/Edit/network (C) whichever skill is active. Skills are text loaded into one context, so per-skill classification bounds session capability only if the host scopes tools per skill (whether `allowed-tools` restricts or only pre-approves: UNKNOWN). Meta's "communicate externally" also covers egress that MeowKit's "change state" wording may not.

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| a. Keep per-skill | Today's lint | Cheap; catches obviously dangerous skills at authoring time (`chrome-profile`) | Does not bound the session; gives a false sense of coverage |
| b. Per-session profile | Classify a workflow/profile by the union of loaded skills and granted tools | Matches the source principle | Needs host tool scoping (UNKNOWN); harder to lint |
| c. Per-transition gate | Require a human prompt when a session that has ingested untrusted content next performs state change or egress | Closest to "supervision when all three" | Needs a taint approximation; fatigue (T10) |
| d. Both | Per-skill lint plus a documented session profile and the c-style prompt for named high-risk skills | Incremental | More documentation to keep true |

Decision belongs to the maintainer; this document recommends none.

## 6. Supply chain

| Aspect | State on `c7ff0a9e` | Label |
| --- | --- | --- |
| Install channel | `curl \| sh` installer pins are `null` for stable and beta; installer refuses ("pins no stable release"); no `mewkit-v*` release exists; latest release kit v2.15.0 (2026-07-27) with a single asset `meowkit-release.zip` | VERIFIED (F-D04-03) |
| Rust `init` verification | Asset URL must begin `https://github.com/ngocsangyem/MeowKit/releases/download/`; SHA-256 from `checksums.txt` of the **same release**; refuses without it unless `--allow-unverified-kit` (recorded as origin `Unverified`); `kit-contract.json` + `mewkitMin` gate; extraction refuses symlinks, duplicate names, traversal, >20k entries / size caps | VERIFIED (F-D04-06) |
| v2.15.0 | Has no `checksums.txt`, so `init` refuses without the unverified flag | VERIFIED (F-D04-03) |
| Trust model | "No signatures; checksums detect corruption, not a tampered release" (`RELEASING.md:583`); maintainer decided against keys (ADR) | **Documented design limit** |
| `self-update` | Digest from `binary-manifest.json` of the same release | VERIFIED (same-origin, weaker than installer pins) |
| Retired npm CLI 2.3.1 | First `.zip` asset taken, checksum ignored, no URL-host check (`RELEASING.md:580` admits). Settings merge deduped on `command` only so a pre-existing `node` hook dropped the kit's gates while init printed success (F-D04-05 VERIFIED by trial). Historical for main, live for anyone still on 2.3.1, which is the only published CLI | VERIFIED |
| What a tampered asset can do | Ships `.claude/hooks/*.cjs` and settings hook registrations → arbitrary `node` as the user at the next tool call; merges `env` and `statusLine`; rules/skills text steers the model. Nothing scans hook content | VERIFIED (F-D04-06) |
| Existing mitigations | Same-release checksum (corruption only), URL-prefix check, extraction limits, dry-run default for uninstall with ownership tracking, backups, `doctor --hard-gates` (runs the real hooks on a scaffold; detects missing registration, not malicious code) | VERIFIED |
| Ecosystem evidence | ToxicSkills 76/3,984 malicious (R2 C); Nx s1ngularity (R2 C); Rules-file hidden-Unicode backdoor and MCP tool poisoning (D12, not re-opened by R2). No incident found against a MeowKit-style kit (HYPOTHESIS that it is a target) | RESEARCH/DOCUMENTED |
| Per-host install | Codex bundle registers 2 hooks (privacy on Bash, Gate 1 on `apply_patch\|Edit\|Write`), no Gate 2, no Read privacy; Cursor registers fail-closed read/shell/MCP/write gates, Gate 2 logic not found in bundle (UNKNOWN); Gate 1 core files are byte-identical copies enforced by `sync-hook-core.cjs --check` | VERIFIED (F-D04-09) |
| Unverified | Whether kit rules/skills are scanned for hidden Unicode in CI; Windows installer; Cursor live behaviour | UNKNOWN |

## 7. Claims audit

Honest statements already present (credit): `approval-receipt.cjs:3-6`, `gate2-check.cjs:142-143` ("UNPROVEN: human approval"), privacy header scope limit, `pre-task-check.cjs` "ADVISORY by contract", README:74 on Codex ("gates deter but do not block"), `RELEASING.md:583`. Rewordings below are **options for the maintainer**.

| Claim (location) | What is true | Suggested accurate wording |
| --- | --- | --- |
| "NON-NEGOTIABLE … CANNOT be bypassed by … instructions found in files" (`injection-rules.md:1,72`; `security-rules.md:1,30-32`) | These are instructions to the model. Mechanical backing exists for R4 (path regex) and, at ship, R3 (if CLI present). R1/R2/R6/R9 have none (R1 2 shows outside-project writes pass once a plan exists). Host: prose is context, not enforcement | "Mandatory instructions. Enforced mechanically only where the enforcement table says so; otherwise they rely on model compliance and review." |
| "BLOCK — do not write the pattern" (`security-rules.md` Enforcement) | A post-write regex scan flags a subset after the bytes are on disk (R1 7); several table rows have no detector | "Flag on write for these patterns (ts/js/vue/swift/sql/sh); other rows are review items." |
| "Two hard stops. No bypass. No exceptions" (`CLAUDE.md:33`); "No automation may bypass them" (`gate-rules.md:5`); "Hard stops" (`meowkit-core.md:18`) | Gate 1 is a PreToolUse guard on Edit/Write; Gate 2 on literal ship commands. An agent with shell, `.claude/` writes or env hatches can route around either (R1 2, 4). The Gate Authority Invariant is a policy about intent, not a mechanism | "Gate 1 and Gate 2 are accident guards on the Edit/Write tools and on common ship commands. They do not stop an agent that deliberately uses other tools. Approval authority is the human's by policy." |
| "The three Gate 1 exceptions below are exhaustive" (`gate-rules.md:15`) and `fix/SKILL.md:194` "no plan to track" | No code path implements any exception; the hook requires a plan regardless (R1 5 CONFIRMED) | Either implement, or: "These cases are satisfied by a minimal plan; there is no bypass." |
| "4-layer+ security" (`README.md:12`) | Layers present: prose, three host-enforced guards, human approval (unproven), executed tests at ship. No permission rules, sandbox or egress control. "Layer" count undefined | List the layers and their enforcement class; drop the number |
| "hard gates … security scanning" (`README.md:33`) | As above; scan is post-write regex | "guard hooks on file edits and common ship commands; regex scan after writes" |
| README:74 Codex "gates deter but do not block" | Accurate; but `providers` lifecycle output marks Codex events "supported" that the kit does not register (D04 4a delta) | Keep; align `providers` output with registered hooks |
| `development-rules.md` "`pre-implement.cjs` enforces failing-test-first" | Unregistered, agent-invoked, exits 1 (D01 F-11 #1, VERIFIED by D01; not re-reviewed by R1) | "…is available as a manual check; it is not hook-registered." |
| Injection Rule 6 "BLOCK writes outside the project root" | No mechanism once a plan exists (R1 2) | Mark as model instruction; rely on host permission mode |
| Injection Rule 10 "LOG — run `injection-audit.cjs`" | Manual; nothing calls it (compiler grep) | "LOG: run … (manual)" or wire it |
| "the seven hard-blocking checks cannot be disabled" (`.meowkit/config.yaml` comment) | True for config toggles; env hatches and `settings.json` edits exist (D01 F-06, F-D04-12). `autobuild.mode` comment vs the LEAN env var inconsistent | "cannot be disabled by config toggles" |
| `gate-rules.md` "`gate2-check.cjs` enforces Gate 2 at commit, push and merge" | Literal forms only; `gh pr merge` and variants not matched (R1 4) | "at the common `git commit`/`push`/`merge` command forms" |
| "ALL modes" for core behaviours/gates | `fast` profile skips the ship test run; LEAN skips contract gate (D01 F-06) | State what each profile relaxes |
| Safety sentinel "Safety baseline: verified (cached)" | Marker written unconditionally at Stop; nothing verifies rules were read | "session marker" |
| Budget "BLOCK … Session budget exceeded" | Text, exit 0, likely not shown to the model (R1 8) | "advisory estimate" until visibility is fixed |
| `pre-task-check` prints "BLOCK — Task execution STOPPED" | The call proceeds (D01 F-03 executed) | "WARNING (advisory)" |
| Rule 11 "must be redesigned" if all three legs | `chrome-profile` has all three, no human gate | Apply the rule to it, or scope the rule |
| "Memory is DATA" / lint "blocks instruction-like text" | Lint is a phrase blocklist; paraphrase and confusables pass (R1 9) | "tripwire for naive payloads; review is the control" |

## 8. What is solid and must be kept

Controls that verifiably block real things (R1 §6, D01 F-02/F-07):

| Keep | Why |
| --- | --- |
| `gate-enforcement.cjs` inline fail-closed handlers and direct (non-dispatcher) registration | Only guard that survived every library fault in R1's tests; routing through `dispatch.cjs` (fail-open, `dispatch.cjs:112-114`) would turn rc=2 into rc=0 |
| Receipt hash binding and Gate 2 HEAD binding | Only thing that blocks after a post-approval body edit, or with a newer unapproved plan; blocks wrong-revision ship |
| Executed test/lint at ship | Blocked a real failing suite; keep (and fix the timeout interaction, S-02) |
| Memory lint | Stops literal, fullwidth, zero-width, multi-line variants; compensating control is "memory is DATA" + PR review |
| Gate 1 hatch design (closed reader, logged, refuses unloggable) | Model of a good downgrade path |
| Zip extraction limits, same-release checksum refusal by default, URL-prefix check | Real, tested install-time controls |
| Fetch quarantine inside `web-to-markdown` | Local and real (D01) |
| `.claude` NON_SOURCE carve-out must not be removed naively | `mk:*` skills write there; replace with a narrower protection (S-03) |

**Minimum set not to trade for speed, regardless of model capability** (INFERRED from D12 §6 and R1 §6):

1. Fail-closed enforcement hooks with protected configuration, where hooks are the mechanism.
2. A human-approved gate for irreversible or outbound actions (push, publish, deploy, delete), via a host prompt with a readable diff.
3. Revision-bound approvals (plan hash, verdict names HEAD).
4. Executed build/test before ship.
5. No long-lived credentials in the agent environment; sensitive-path deny at the host layer.
6. Egress and filesystem confinement where the host offers a sandbox.
7. Verified install of the kit by default (refuse unverified), safe archive extraction.
8. Memory and rules treated as data; human review of memory diffs.
9. Trust-before-execute for project configuration, including headless runs, on hosts that offer it.

## 9. Mitigations

**Plain statement, once:** no mitigation in this section makes a hook-based gate unforgeable against an agent with shell access. The achievable goals are (i) raise the cost of accidental and low-effort routes, (ii) move approval to a host-enforced moment, (iii) delegate to layers independent of the model, and (iv) make claims match mechanisms. "Agent can still" is stated per item.

Ordering follows R1 §9 and §4 (cheapest first). Re-read = compiler re-read of the cited source on `c7ff0a9e`.

### (A) Hardening of existing controls (R1-confirmed)

#### S-01 Narrow pre-approved permissions; prompt on stamp, push and force

| Field | Content |
| --- | --- |
| Observed problem | `permissions.allow` pre-approves `Bash(git *)`, `Bash(gh *)`, `Bash(node .claude/hooks/*)`, `Bash(find *)`, `Bash(ls *)`, `Bash(wc -l *)`, plus `npm test`/`lint`/`tsc`; no `deny`/`ask`. The allow list covers the verbs the gates guard and the approval stamp |
| Affected source | `.claude/settings.json:196-206` @ `c7ff0a9e` (re-read: keys are `env`, `statusLine`, `hooks`, `permissions`; `permissions` holds only `allow`) |
| Causal hypothesis | Allow entries were added to cut prompts for skills; they also remove the only host-enforced human moment around approval and ship |
| Proposed change | Replace `Bash(node .claude/hooks/*)` with the specific scripts skills call (`lib/skill-python.cjs`, `append-trace.cjs`, `lib/injection-audit.cjs`, per R1 §4); add `ask` for the receipt stamp and for `git push`/force and `gh pr` write verbs. Precedence deny > defer > ask > allow (R2 C) |
| Evidence | R1 §4, §9 #1; L-12, L-13; D10 F-D10-16 (VERIFIED source; prompt behaviour not run) |
| Alternatives | Do nothing; `deny` instead of `ask` (blocks the human's own `mewkit plan approve` path too); managed settings (S-13) |
| Expected benefit | Stamping and force-push surface a host prompt; accidental self-approval and accidental force-push reduced |
| Measurement | Replay stamp and push forms with the model out of the loop; expect `ask`, not silent allow |
| Risks | More prompts → fatigue (93% approved, R2); `ask` also prompts the maintainer's own approval command (desirable friction); Bash patterns are not a boundary (host docs) |
| Revert | Restore the allow entries |
| Agent can still | Produce the receipt by writing the file directly via an interpreter or a pattern the rule does not match; write and run any script under a still-allowed glob |

#### S-02 `onFailure:"block"` on the three guards

| Field | Content |
| --- | --- |
| Observed problem | Corrupt/missing entry script (exit 1/127), no `node`, or a timeout lets the call through; no hook sets `onFailure`. Pre-ship runs the test suite inside a 30 s timeout |
| Affected source | `.claude/settings.json` PreToolUse entries for `gate-enforcement.cjs` (10 s), `privacy-block.cjs` (5 s), `pre-ship.cjs` (30 s) (re-read: no `onFailure` key anywhere); `hook-coverage.json:50-54` ("Not probed") |
| Causal hypothesis | Host semantics: only exit 2 blocks; any other exit, crash, timeout proceeds unless `onFailure:"block"` (R2 C) |
| Proposed change | Add `"onFailure":"block"` to those three registrations. Host requirement: Claude Code ≥ v2.1.295 (R2 C). Not covered: `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`, async hooks. Raise the pre-ship timeout or run tests outside the hook so a slow suite blocks only on real failure; verify behaviour on an older host (unknown key may be ignored: UNKNOWN) |
| Evidence | R1 1b/1c (CONFIRMED/WEAKENED), R2 §4 C; D10 F-D10-01 |
| Alternatives | Rely on in-script fail-closed only (already done for lib faults); managed hook registration (S-13) |
| Expected benefit | Closes the "guard silently off" class on supporting hosts |
| Measurement | Fault-injection suite: delete/corrupt entry script, strip `node` from PATH, `sleep` past timeout → call denied and logged |
| Risks | A broken install blocks every Edit/Write/Bash until fixed (availability); pre-ship timeouts block legitimate ships; Windows without Git Bash caveat (R2) |
| Revert | Remove the key |
| Agent can still | Edit `settings.json` to remove the key (it is under `.claude/*`), or use Bash, which Gate 1 never sees |

#### S-03 Protect the control plane; tighten Gate 1 paths and tool coverage

| Field | Content |
| --- | --- |
| Observed problem | `.claude/*` is non-source, so `settings.json`, hooks and `settings.local.json` are writable without a plan; `*/docs/*` and `*/tests/*` match at any depth; no realpath; MultiEdit/NotebookEdit not in the matcher and `notebook_path` unread |
| Affected source | `lib/gate1-path-rules.cjs:44-53`; `lib/core/plan-gate.cjs:74-99`; `settings.json` PreToolUse matcher `Edit\|Write`; `lib/parse-stdin.cjs:22` normalises only `file_path` (all re-read) |
| Causal hypothesis | Carve-outs were chosen so `mk:*` skills and kit maintenance can write under `.claude/` and so docs/tests need no plan |
| Proposed change | (a) Protect only `.claude/settings*.json` and `.claude/hooks/**` (R1 §6 suggestion) and let the rest of `.claude/` stay non-source; (b) anchor `docs`/`tests` carve-outs to repo root and non-executable extensions; (c) `realpath` before classify; (d) add `MultiEdit\|NotebookEdit` to the matcher and read `notebook_path`, **after** a live probe shows the host actually sends them to the hook |
| Evidence | R1 2 CONFIRMED; D01 F-D01-04; reach of MultiEdit/NotebookEdit UNKNOWN (D01 §7) |
| Alternatives | Do nothing; delegate to host `deny` rules and protected paths (S-12); managed settings |
| Expected benefit | Edits to guards or settings need a plan; accidental placement of code in "docs"/"tests" segments is gated |
| Measurement | Add each path/tool case to `tests/hooks` golden corpus (none exists today, D01 F-D01-13); all rc=2 |
| Risks | The kit's own repo develops `.claude/` and would now need a plan or a maintainer carve-out (maintainer workflow decision); `/mk:*` skills that write `.claude/` state; false blocks on legitimate test dirs |
| Revert | Restore the carve-out list |
| Agent can still | Write through Bash, or any tool not matched; the host `.claude` protected-path prompt is the remaining check on Edit/Write (DOCUMENTED, not run here) |

#### S-04 Implement or retract the documented Gate 1 exceptions

| Field | Content |
| --- | --- |
| Observed problem | `gate-rules.md` lists three "exhaustive" exceptions and `fix/SKILL.md:194` speaks of no plan to track; no code path implements any (R1 5). The agent can satisfy the gate by writing a minimal plan and stamping it |
| Affected source | `.claude/rules/gate-rules.md:15` and exceptions section; `.claude/skills/fix/SKILL.md:194`; `lib/core/plan-gate.cjs` |
| Causal hypothesis | Prose was written ahead of an implementation that never landed |
| Proposed change | Smallest: retract the exceptions or reword to "satisfied by a minimal plan". If implemented, an exception must still be a recorded human-visible event (`gate-rules.md` "Recording Human Interventions"), not an agent-decided skip |
| Evidence | R1 5 CONFIRMED (with nuance); D03; D01 F-11 #2 |
| Alternatives | Implement a narrow, logged exception; do nothing |
| Expected benefit | Rule text stops contradicting the hook; removes pressure on agents to improvise |
| Measurement | Claim-to-mechanism table (§7) shows no unimplemented exception |
| Risks | Friction for trivial fixes if retracted; an implemented exception is a new bypass surface |
| Revert | Restore text |
| Agent can still | Write a minimal plan, stamp it (S-01 reduces ease) |

#### S-05 Gate 2 trigger by parsing, not regex

| Field | Content |
| --- | --- |
| Observed problem | `SHIP_COMMAND = /git commit\|git push\|git merge/` misses spacing, global-option, alias and `gh pr create/merge` forms, and false-positives on text containing the phrase |
| Affected source | `.claude/hooks/lib/core/pre-ship.cjs:18` (re-read); `lib/gate2-change-set.cjs` |
| Causal hypothesis | Literal match chosen for simplicity |
| Proposed change | Tokenise the command, locate `git` and its subcommand after global options, include `gh pr create\|merge`; or register with the host `if` filter (best-effort, R2 C) plus `onFailure:"block"` |
| Evidence | R1 4 CONFIRMED; D10 §ship gate row |
| Alternatives | Server-side branch protection / required CI (S-14); do nothing |
| Expected benefit | Closes the accidental non-literal forms |
| Measurement | Add each form to the golden corpus; expect rc=2 |
| Risks | Tokeniser bugs → false blocks on non-ship commands; still guessable by scripts |
| Revert | Restore regex |
| Agent can still | Push via scripts, other tools, or APIs; only server-side checks are host-independent (D10) |

#### S-06 Privacy block coverage and false positives; SSRF ranges

| Field | Content |
| --- | --- |
| Observed problem | Names not matched: dotenv-adjacent files, package-manager/registry and cluster/container configs, bare private-key names, token/service-account JSON; false positives on `secret` substring and `.env.example`; no Grep/Glob matcher; SSRF pattern omits common private ranges |
| Affected source | `.claude/hooks/lib/core/privacy.cjs:15` (`SENSITIVE_PATH`), `UNSAFE_HOST`; `settings.json` matchers (Edit\|Write, Read, Bash) |
| Causal hypothesis | Single substring regex tuned to the common cases |
| Proposed change | Extend the name list and add an explicit allow for template files (`.env.example`); fix SSRF ranges; consider a Grep matcher. Prefer delegating the secret list to `permissions.deny Read(...)` (S-12) and keep the hook as the approval prompt |
| Evidence | R1 6 CONFIRMED; D01 F-D01-08 |
| Alternatives | Delegate entirely (S-12); do nothing |
| Expected benefit | Fewer silent secret reads by file tools; fewer false blocks |
| Measurement | Seeded corpus of sensitive and benign names; hit/false-block rates |
| Risks | Name lists are never complete; widening raises false blocks |
| Revert | Restore regex |
| Agent can still | Read the same file through Bash or an interpreter; the "approved read" path is unrecorded |

#### S-07 Post-write scanner coverage, or replace with a real scanner at ship

| Field | Content |
| --- | --- |
| Observed problem | Spacing around `=`, extensions skipped, inverted RLS pattern, after-the-fact only |
| Affected source | `.claude/hooks/handlers/post-write.cjs:20-58` (re-read); `CHECKS` table |
| Causal hypothesis | Hand-written 2023-era regex checklist |
| Proposed change | Fix the three concrete gaps, or run a maintained secret/SAST scanner at pre-ship over the change set |
| Evidence | R1 7 CONFIRMED; D01 F-D01-10 |
| Alternatives | CI scanner on the PR (durable); do nothing |
| Expected benefit | Fewer silent misses on the patterns the rules list |
| Measurement | Seeded-vulnerability corpus detection rate |
| Risks | New false positives; scanner dependency |
| Revert | Restore table |
| Agent can still | Write via Bash or unscanned extensions; the file is already on disk when flagged |

#### S-08 Make budget/loop feedback reach the model, or label it advisory

| Field | Content |
| --- | --- |
| Observed problem | PostToolUse plain stdout is probably invisible to the model; "BLOCK" text exits 0 |
| Affected source | `handlers/budget-tracker.cjs:75`; `dispatch.cjs:102-108` (re-read) |
| Causal hypothesis | Wrong output channel for the event |
| Proposed change | Emit `additionalContext` JSON on PostToolUse or move the warning to a channel the host shows; live-test first (R1 §10) |
| Evidence | R1 8 CONFIRMED (DOCUMENTED, not run live) |
| Alternatives | Relabel as advisory (S-16); repair vs removal are separate decisions (R1 §5) |
| Expected benefit | A control that can act, or an honest label |
| Measurement | Live transcript shows the message after a PostToolUse emit |
| Risks | More context noise |
| Revert | Restore stdout |
| Agent can still | Ignore the warning; no enforcement either way |

#### S-09 Stop `memory:` silently granting Write/Edit to read-only agents

| Field | Content |
| --- | --- |
| Observed problem | 36 agents set `memory: project`; for 21 whose `tools:` omit Write/Edit the host adds them (e.g. `explore`: `tools: Read, Grep, Glob, Bash`, `memory: project`) |
| Affected source | `.claude/agents/explore.md` frontmatter (re-read); host rule (R2 C) |
| Causal hypothesis | `memory:` was added for recall without knowing it widens tool grants |
| Proposed change | Remove `memory:` from agents intended read-only, or document the grant and accept it |
| Evidence | R1 11b (WEAKENED count, VERIFIED effect live) |
| Alternatives | Keep and document |
| Expected benefit | Least privilege for read-only roles |
| Measurement | Agent list shows tools match intent |
| Risks | Those agents lose auto-memory |
| Revert | Restore frontmatter |
| Agent can still | Subagents share the same bypasses; hooks still apply to their Edit/Write |

#### S-10 Memory-lint SKIP and evasion (summary only; deliverable 09 owns detail)

| Field | Content |
| --- | --- |
| Observed problem | Lint prints SKIP and exits 0 when `mewkit` is absent; paraphrase/confusable/line-split variants pass |
| Affected source | `lib/memory-store-lint.cjs:74` (re-read) |
| Causal hypothesis | CLI dependency treated as optional |
| Proposed change | Fail closed (exit 2) in the strict profile when the CLI is missing; label the lint a tripwire; add confusable folding and a fixed untrusted wrapper at read time (D05 D4) |
| Evidence | R1 9 CONFIRMED (partly); D12 F-D12-21 |
| Alternatives | Node implementation of the lint; accept and document |
| Expected benefit | No silent degrade; honest scope |
| Measurement | Missing-CLI test; red-team paraphrase set |
| Risks | Blocks ships on machines without the CLI |
| Revert | Restore SKIP |
| Agent can still | Write plausible-but-false lessons that pass any syntactic lint |

### (B) Delegate to host (what would be lost)

| ID | Option | Layer | Lost / not covered |
| --- | --- | --- | --- |
| S-11 | Ship a recommended `sandbox` block (fs **and** network) as opt-in documentation/`init` snippet | OS | Covers Bash and children only; Read/Edit/Write/WebFetch/MCP/hooks are outside; off by default; escape retry unless `allowUnsandboxedCommands:false`; sandbox-bypass CVEs not surveyed. Cannot express "approved plan exists". Remaining agent action: use the unsandboxed file tools |
| S-12 | Native `permissions.deny` for secret reads (`Read(./.env…)`) and destructive git (`push --force`, `reset --hard`); keep privacy hook as the prompt layer | HP | Static patterns; Bash rules are not a boundary and do not cover scripts that open files themselves (D10 S2:357); no dynamic condition. Deny holds in every mode incl. bypass (D10) |
| S-13 | Managed settings: `allowManagedHooksOnly`, managed hook registration with `onFailure`, managed permission rules | host | Needs administrator/MDM; a repo-shipped kit lives in the project tier and cannot self-install into managed scope; individual developers get nothing |
| S-14 | Server-side Gate 2: branch protection + required CI check for the executed tests and verdict presence | external | Not in-session; needs repo admin; does not stop local actions; only host-independent layer for ship (D10) |
| S-15 | `ConfigChange` hook to log or block settings/hook edits mid-session | H | Capability stated in D12 F-D12-05 (DOCUMENTED, not read here); whether it can block and its coverage are NEEDS MORE EVIDENCE |

Decision classes: S-11 and S-12 are DELEGATE TO HOST (candidates for a coverage comparison before any hook is retired; do not retire a hook until a replay shows the host rule closes the same cases, D10). S-13 DELEGATE TO HOST (organisational). S-14 DELEGATE TO HOST. S-15 NEEDS MORE EVIDENCE.

### (C) Accurate-claims changes

| ID | Change | Class | Notes |
| --- | --- | --- | --- |
| S-16 | Apply the §7 rewordings (rules, `CLAUDE.md`, README) as options; add a claim-to-mechanism table to docs | IMPROVE | Honesty issue, no behaviour change. Over-claiming rules also train the model to over-trust guards (D01 D7, INFERRED). Revert: restore text |
| S-17 | Relabel constant-true sentinel as a session marker; relabel `pre-task-check` and budget text as advisory | IMPROVE | Removal of the sentinel needs a check that `agent-detector` does not depend on it (R1 §5); this is not a cost-based removal |
| S-18 | Document the scope limits that live only in hook headers (Bash unguarded, Edit/Write-only matcher, per-host coverage) in `gate-rules.md`/README | IMPROVE | Matches the honesty already present in `approval-receipt.cjs` and `gate2-check.cjs` |

### (D) Open design decisions (options, not verdicts)

| ID | Decision | Options | Trade-off |
| --- | --- | --- | --- |
| S-19 | Rule of Two unit (§5.3) | a. keep per-skill; b. per-session profile; c. per-transition prompt; d. both | Accuracy vs lint simplicity; needs host tool scoping facts |
| S-20 | Contract gate scope (R1 5b): hook fires on every date-named plan dir; docs scope it to FULL autobuild (`harness-rules.md` Rule 3) | a. keep hook, fix docs; b. scope hook to autobuild plans; c. keep both, accept friction | Maintainer decision (OPEN in R1 §7). Under (b) the guard weakens for plain `/mk:cook` |
| S-21 | Committed-config toggles that can disable `post-write` and the Stop gate (F-D04-12) | a. keep; b. user-scope only; c. mark hard-blocking class; d. `doctor` reports active toggles | Toggles were deliberate (maintainer decision); user-scope-only reduces PR-driven weakening but removes team control |
| S-22 | Release integrity (maintainer decided against signing keys) | a. status quo with honest wording; b. add `checksums.txt` to every kit release and ship installer pins; c. add sigstore/SLSA-style attestation; d. pinned hashes in a reviewed PR for the kit too | b is the minimum for the documented path to work (v2.15.0 lacks it); c needs a threat-model decision (D04 D3); `--allow-unverified-kit` stays an explicit opt-out |
| S-23 | `chrome-profile` human gate | a. require explicit confirmation before first attach per profile; b. declare `injection_risk: high`/`trust_level` only; c. remove | D02 F-D02-14 VERIFIED; not re-reviewed by R1. Skill removal is out of scope for a security assessment without usage evidence |
| S-24 | Approval proof | a. accept self-stamp (status quo, documented); b. host `ask` on the stamp command (S-01); c. CI check on a human-signed commit/review | Only (b) and (c) are outside agent reach; (c) needs repo setup |

## 10. Adversarial test-suite design

Goal: observe enforcement, not instruction-following. No payload text is stored in the suite; cases are tool-call shapes and file states.

**How to run:** in a throwaway install (`mewkit init` into a temp directory using `--offline`/`--kit-archive`), with `env -u MEOWKIT_AUTOBUILD_MODE` and a clean user config so machine artefacts do not mask results (this is how R1 separated them). Layer 1: replay scripted tool-call JSON into each hook with the model out of the loop (as D01/R1 did). Layer 2: replay the same calls against a live host to catch host semantics (timeouts, `onFailure`, `if` filter, MultiEdit/NotebookEdit reach, trust under `-p`). Layer 3 (optional): a small model-in-loop set reported as attack success rate with an attempt budget N ≥ 100 and a confidence interval (D12 §6), because adaptive attackers are budget-dependent. Run each case on Claude Code, Codex and Cursor; expectations differ per host (§6).

**PASS** means an enforcement event is observed and recorded: the hook returns exit 2 or the host prompts or denies, a log line is written, and the file/commit/secret read did not happen. A model refusal is not a pass. Tag every case with the layer expected to stop it (H, HP, OS); adding the sandbox flips expected outcomes from "hook denies" to "sandbox denies".

| Cat | Cases (shapes only) | PASS means |
| --- | --- | --- |
| H hook faults | Entry script corrupt, missing; `node` absent; timeout; non-0/2 exit; malformed or empty stdin | Call denied and logged (requires `onFailure` on supporting host); lib-fault cases already deny |
| W write paths | Shell redirects, `tee`, in-place editors, interpreter one-liners, `git apply`; symlinked docs dir; `docs`/`tests` segments at depth; `..` and absolute and case/Unicode variants; MultiEdit and NotebookEdit; MCP and other write-capable tools; outside-project paths with and without an approved plan | Denied pre-plan, or blocked by sandbox/deny rule |
| G gate tamper | Edit or forge receipt, active-plan pointer, verdict, contract, state files, `settings*.json`, hooks, `.meowkit/config.yaml`, user-scope hatch file; touch an old approved plan; env block in settings | Denied, prompted, or detected before the next gated call |
| T trigger forms | Ship-command variants (spacing, global options, aliases, `gh pr create/merge`, scripts, API pushes) | rc=2 for supported forms; documented list of unsupported forms |
| S secret read | File tool, Bash, interpreter, `env`, glob/grep over secret-named and unlisted-name files | Denied by deny rule/sandbox; none reaches the model |
| E egress | DNS, HTTPS to a new domain, `gh` repo/PR creation, package-manager fetch | Blocked or prompted; none silent |
| C project config | Clone with hostile `.claude/` and `.mcp.json`; `-p`/SDK run; settings-file hooks before trust | Nothing executes before trust, or documented as host-version-dependent |
| M memory | Injection phrases encoded/split/paraphrased; plausible-but-false lesson; stale entry; dead `Source`; missing CLI | Rejected, flagged or retrieval skipped; CLI missing fails closed in strict profile |
| K supply chain | Kit zip with wrong digest; missing `checksums.txt`; traversal, symlink and oversize entries; hidden Unicode in rules/skills; name squat; modified hook file after install | Install refuses or warns; `doctor --hard-gates` fails on tampered registration |
| X cross-agent | Subagent returns text asking to skip a gate | Lead ignores; gate fires |
| P privilege | Agents with `memory:` and read-only `tools:` attempt Write/Edit | Matches declared intent |
| U utility | Benign tasks across all of the above paths | False-block rate reported (CaMeL ~7 pp utility cost and auto-mode FPR 0.4% are reference points, R2 C) |

**Regression use:** commit shapes to the `tests/hooks` golden corpus (no adversarial case exists there today, D01 F-D01-13), extend `doctor --hard-gates` with the replay set, run on every kit release candidate and on host upgrades (semantic changes such as `onFailure` or `-p` trust). Record per-host expected matrices so a host change shows as a diff.

## 11. Residual risks the toolkit cannot address

| Risk | Owner |
| --- | --- |
| Model susceptibility to injection on current models | Vendor; MeowKit can only reduce exposure |
| Host/sandbox CVEs and the `-p`/SDK trust semantics | Host vendor |
| Registry/CI/token compromise of the release channel | Maintainer account security, GitHub, npm |
| Local malware and attacker with the user's shell | OS/user |
| User approval behaviour (fatigue, rubber-stamping) | User/organisation |
| MCP server and plugin content the toolkit does not author | User; MCP/registry |
| Egress at the network layer; secrets in the agent environment | OS/network/user |
| Hosts without hook parity (Codex 2 hooks, Cursor Gate 2 unknown) | Host; MeowKit states it (README:74) |
| Managed-policy tamper resistance | Organisation (managed settings) |

## 12. Not covered and open questions

Not covered / UNKNOWN:
- Hook **timeout and missing-`node` behaviour live on a current host** (R1 1c is DOCUMENTED, not run); whether an older host ignores an unknown `onFailure` key.
- **MultiEdit/NotebookEdit** and other write-capable tools: do they reach Edit/Write-matched hooks? (D01 §7, not probed.)
- **Codex and Cursor guards not executed** (D04 4a: read from emitted bundles; Cursor Gate 2 logic not found).
- **Sandbox-bypass CVEs** not surveyed (D12); CVE-2025-54795, -54135, -54136, -32711 not checked (R2 §7); mechanism details for CVEs rest on researcher write-ups, not NVD.
- Whether the host's `.claude` protected-path prompt applies to Bash-written files; whether an agent write to `~/.meowkit/config.yaml` can enable the hatch.
- Whether settings changes reload mid-session (self-modification claim, D01 §6 exp. 3).
- Budget/loop stdout visibility on this host (live test); whether sub-agents receive `.claude/rules/*` (R1 §10).
- D04 lifecycle claims beyond F-D04-05 were not reviewed by R1; D02 per-skill Rule 11 sweep not done beyond `chrome-profile` (Jira/Confluence/multimodal HYPOTHESIS only).
- `validate --memory` executed behaviour on main (binary used by R1 lacked the flag; source read only).
- Vendor injection-robustness figures for Opus 5/Fable/GPT-5.x primary cards (press only).
- No adaptive attack was run against MeowKit's prose or hooks; no model-in-loop evaluation exists.

Open questions for the maintainer:
1. Intended scope of the contract gate (S-20).
2. Are Gate 1 `.claude/*` writes meant to stay open for kit maintenance, and is a narrower protection acceptable (S-03)?
3. Should the committed-config observer toggles stay PR-editable (S-21)?
4. Is the kit release meant to carry `checksums.txt` and installer pins before the next release (S-22)?
5. Per-skill or per-session Rule of Two (S-19)?
