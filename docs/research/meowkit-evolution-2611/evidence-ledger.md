# Evidence ledger

Lead-verified facts only. Domain findings live in `findings/` and are merged here after
cross-examination. Labels are defined in `BRIEF.md`.

## Environment record (Stage 1) — 2026-11-15

| Item | Value | Label |
| --- | --- | --- |
| Checkout | `/Users/sangnguyen/Desktop/MeowKit` | VERIFIED (`pwd`) |
| Branch / HEAD | `feat/rust-plan-state-verbs` / `fc278b31cc78b355fd70ef518a54538ab38c46ab` | VERIFIED (`git rev-parse`) |
| Working tree | clean at start; 27 ahead / 0 behind `origin/main` | VERIFIED (`git status`, `git rev-list`) |
| Remote | `https://github.com/ngocsangyem/MeowKit.git` — local ≠ remote main by 27 commits | VERIFIED |
| Monorepo version | `2.15.0` (root `package.json`) | VERIFIED |
| npm CLI | `mewkit` `2.3.1` (`packages/mewkit/package.json`; `node packages/mewkit/dist/index.js --version`) | VERIFIED |
| Rust CLI | workspace `0.1.0`, crates `mewkit-core`, `mewkit-adapters`, `mewkit-cli`; no release binary built in `target/` | VERIFIED |
| Runtime requirements | Node ≥ 24 (`engines`), Rust 1.99 pinned, Python 3.9+ optional (README) | VERIFIED / DOCUMENTED |
| Local toolchain | node v26.13.0, cargo/rustc 1.99.1, Python 3.12.6, macOS Darwin 24.6.0 | VERIFIED |
| Provider targets | Claude Code (flat-copy + plugin), Codex ("experimental projection"), Cursor ("authored bundle") | DOCUMENTED (README) — behaviour unverified |
| `mewkit` on PATH | absent; SessionStart hook reports "CLI not available", checks that call it skip | VERIFIED (hook output) |
| `mewkit orient` | `orientation: none` | VERIFIED |

## Reference repositories

| Repo | Origin | HEAD | Last commit | License file |
| --- | --- | --- | --- | --- |
| deepseek-harness | `github.com/deepseek-ai/deepseek-harness` | `39163dd3` (master) | 2026-11-13 | LICENSE present |
| hermes-agent | `github.com/NousResearch/hermes-agent` | `4b86af50` (main) | 2026-11-14 | LICENSE present |
| qwen-code | `github.com/QwenLM/qwen-code` | `9d390e23` (main) | 2026-11-14 | LICENSE present |
| rig | `github.com/0xPlaygrounds/rig` | `8c1a2e19` (main) | 2026-11-13 | LICENSE present |

## Host research capabilities (this session)

| Capability | Available | Note |
| --- | --- | --- |
| Background subagents (typed) | yes | `Agent` tool; project agents + built-ins |
| Deterministic multi-agent workflow | yes | `Workflow` tool; not used — domains are independent, no pipeline needed |
| Web search / fetch | yes | deferred tools + `researcher` agent |
| Controlled model/host A-B runs | **no** | this session cannot pin model version, reasoning effort or run a host without MeowKit; causal experiments are designed, not executed |

## Lead-verified findings

| ID | Finding | Label | Evidence |
| --- | --- | --- | --- |
| L-01 | README component counts disagree with disk: 42 agents claimed, 44 files in `.claude/agents/`; "27 hook scripts" vs 100 files under `.claude/hooks/` (count basis undefined) | RETRACTED — README is correct. 44 files = 42 agents + 2 index files; "27 hook scripts" = 6 entry scripts + 21 handlers (derived, not stated in README). Re-counted on main by D03, R1 and the deliverable-02 compiler | `README.md:12`, `ls .claude/agents/*.md \| wc -l` |
| L-02 | `.meowkit/memory/` is absent in this checkout; `git ls-files .meowkit` lists no memory file. README and CLAUDE.md describe `decisions.md`/`gotchas.md` as committed team memory | CONTRADICTED | `git ls-files tasks .meowkit`; `README.md` "What is MeowKit"; `CLAUDE.md` Memory section |
| L-03 | `SubagentStart` and `SubagentStop` are registered in `.claude/settings.json` with empty handler arrays; `handlers.json` has no entry for either | VERIFIED | `.claude/settings.json` hooks block; `.claude/hooks/handlers.json` |
| L-04 | Gate 1 path allowlist is segment-pattern based: any path matching `*/docs/*`, `*/test/*`, `*/tests/*`, `*/__tests__/*`, `*.test.*`, `*.spec.*` or `.claude/*` is non-gated. `src/test/anything.ts` and `pkg/docs/run.sh` therefore need no approved plan | VERIFIED (source read; not yet executed) | `.claude/hooks/lib/gate1-path-rules.cjs:44-53`, `.claude/hooks/lib/core/plan-gate.cjs:97` |
| L-05 | Gate 1 is registered only for `Edit\|Write`. A file written by a Bash command is not seen by `gate-enforcement.cjs` (whether a Bash-side handler compensates is for D01) | VERIFIED (registration) / UNKNOWN (compensation) | `.claude/settings.json` PreToolUse matchers |
| L-06 | A top-level research directory is blocked by Gate 1 (no plan in `tasks/plans/`); `docs/**` is allowed. The gate, not a convention, determined this workspace's location | VERIFIED (source) | same as L-04 |
| L-07 | Coexistence conflict observed live in this session: the user-global `~/.claude` toolkit (`ck:` skills, rules) and MeowKit (`mk:`) are both loaded and give contradictory instructions — plan location `./plans/` vs `tasks/plans/`, docs list, workflow chain `/ck:plan → /ck:cook` vs `mk:plan-creator → mk:cook`; both claim to "OVERRIDE" / be "MANDATORY, NON-NEGOTIABLE". Same-named agents exist in both (`researcher`, `planner`, `debugger`, `code-reviewer`/`reviewer`) | VERIFIED (session context) | system context of session `2432fe97` |
| L-08 | Third-party hook misfire observed live: the Vercel plugin's `UserPromptSubmit` hook keyword-matched this research directive and issued "You must run Skill(workflow)" / "Skill(vercel-sandbox)" — an unrelated toolkit injecting mandatory-voiced instructions alongside MeowKit's | VERIFIED (session context) | hook output, session `2432fe97` |
| L-09 | SessionStart hook output exceeded the host's inline limit (53.2 KB persisted to disk, 2 KB previewed) — the Vercel plugin's knowledge graph, not MeowKit. MeowKit's own SessionStart block was ~60 lines | VERIFIED (session context) | hook persisted-output notice |
| L-10 | SessionStart reported "Model: not detected (defaulting to STANDARD/FULL)". Adaptive density therefore ran on a default, not on the actual model, in this host (desktop app / Agent SDK) | VERIFIED (hook output) — cause for D05/D03 | SessionStart hook output |

## Baseline change during the research (2026-11-15 03:12 +0700)

| Item | Value | Label |
| --- | --- | --- |
| What happened | `checkout: moving from feat/rust-plan-state-verbs to main`, then `pull --tags origin main: Fast-forward` to `c7ff0a9e` | VERIFIED (`git reflog`) |
| Who | Not a research agent: of 12 agent transcripts only D04 and D05 contain the commands, both in tool *output* (they read the reflog), 0 in tool *input*. Actor is outside this research (user terminal or another session) | VERIFIED (transcript scan) |
| Relationship | `fc278b31` is an ancestor of `c7ff0a9e`; 27 commits newer; 4149 files changed, +43,651 / −74,458 | VERIFIED (`git merge-base --is-ancestor`, `git diff --shortstat`) |
| Substance | main merges PR #49 `rust-retire-ts-cli`, #50 native-CLI docs pass, #51, #52 stale TS-CLI references. `packages/mewkit/src` no longer exists. Under `.claude/` only 16 files differ (+536 / −314) | VERIFIED |
| Effect on findings | D05, D01 and the first pass of D02 cite `fc278b31` (D05 used a `git archive` copy of it). D02, D03, D04 were told to re-baseline on `c7ff0a9e` and tag each citation with its commit. Any finding about "two CLIs maintained in parallel" must be re-stated for main | — |
| Lead action | Checkout left as found. Not switched back | — |

## Maintainer decisions after the research (2026-11-15)

These are the maintainer's decisions. They supersede the proposed records where they differ;
the deliverables were not rewritten.

| # | Decision | Supersedes |
| --- | --- | --- |
| M-1 | Remove both gates, option A: drop the plan-approval hook and receipt (Gate 1) and the human approval with verdict file (Gate 2). Keep the `pre-ship` test, lint and type-check run at commit and push as a standalone check | ADR-08 ("keep both gates"); roadmap rows R-03, R-05, R-11, R-12 and the gate parts of R-04 become moot or shrink |
| M-2 | Audit every skill, rule, hook and agent for model fit, across all three runtimes: Claude Code, Codex and Cursor | Roadmap placed skill changes behind experiments; the audit now comes first |

Scope facts for M-2, counted on `c7ff0a9e`: Claude Code 128 skills, 42 agents, 7 rules;
Codex bundle 125 skills, 41 agent files, 1 rule file; Cursor bundle 124 skills, 41 agent
files, 5 rule files. None of the bundle `SKILL.md` files is byte-identical to its
`.claude/skills` original (0 of 125, 0 of 124; `cmp`), so the three runtimes hold three
separate copies. `claude`, `codex` and `cursor-agent` are all installed on this machine.

## Lead-verified findings (continued)

| ID | Finding | Label | Evidence |
| --- | --- | --- | --- |
| L-11 | Gate 1 blocks `Write`-tool writes to paths outside the project root when no approved plan exists — including the host's own session scratch directory. Two research agents (D01 deliberately, D02 for its scripts) then wrote the same scratch paths with Bash heredocs, which the gate does not see. A guard that blocks the audited tool for a legitimate target and leaves the unaudited tool open pushes agents toward the unguarded path | VERIFIED (D01 live test; D02 report; `plan-gate.cjs:80` returns `gated` for out-of-root paths) | D01 §4, D02 report |
| L-12 | On main `c7ff0a9e`, `.claude/settings.json` pre-allows `Bash(node .claude/hooks/*)`, `Bash(git *)` and `Bash(gh *)`; it has no `permissions.deny`, no `sandbox` key, and no `onFailure` on any hook | VERIFIED (lead re-check of D01/D12 claims) | `node -e` read of `.claude/settings.json` @ `c7ff0a9e` |
| L-13 | `approval-receipt.cjs` exposes `stamp <plan.md> [approver]` on the command line with approver defaulting to `human`; its own header calls the receipt "agent-writable by design". Combined with L-12 the stamp command needs no permission prompt. Lead confirmed by source; execution evidence is D01's | VERIFIED (source) | `.claude/hooks/lib/approval-receipt.cjs:5,107,125,148-154` @ `c7ff0a9e` |
| L-14 | `MEOWKIT_AUTOBUILD_MODE=LEAN` comes from `.claude/settings.local.json`, which is untracked and globally git-ignored. The contract gate being off is this machine's local setting, not shipped kit behaviour. It does mean local traces and density observations here reflect LEAN | VERIFIED | `git ls-files --error-unmatch`, `git check-ignore -v` |
