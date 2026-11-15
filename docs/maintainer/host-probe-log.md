# Host probe log

What each host does with kit hooks, as the gate-removal work depends on it. Each row names the
host version, the date, what is known and the design it selects. The guard replay suite
(`tests/guards/`) asserts only host-visible decisions; this log records what the replay cannot
see because it needs a live host.

**Status on 2026-11-15: no live runs.** The maintainer declined headless model spend for the
probes. Every row below is taken from the host documentation snapshots indexed in the plan
research (`runtime-docs-index.md`, fact numbers in brackets) and is marked **documented, not
probed**. A row moves to **probed** only when a live run in a scratch project outside the repo
confirms it; record the command, host version and date when that happens.

Hosts installed on the maintainer machine that day: Claude Code 2.1.322, Codex CLI 0.167.0,
Cursor Agent 2026.07.23-e383d2b.

## Decision table

| # | Probe | Host | Known behaviour | Source | Status | Design it selects |
|---|---|---|---|---|---|---|
| P1 | `hookSpecificOutput.additionalContext` reaches the model on PreToolUse, PostToolUse and PostToolUseFailure | Claude Code | "Add context for Claude": wrapped in a system reminder next to the tool result; plain stdout on these events is not listed as model-visible; 10,000-character cap | [hooks reference](https://code.claude.com/docs/en/hooks), checked 2026-11-16 | documented, not probed | Observers return `context`; `dispatch.cjs` sends it as `additionalContext` on tool events (`docs/maintainer/hook-output-channels.md`) |
| P1 | Plain hook stdout reaches the model on PostToolUse and Stop | Claude Code | Not stated as model-visible. Exit 2 on PostToolUse shows stderr to Claude; `hookSpecificOutput.additionalContext` continues a Stop turn as feedback | [#37], [#31] | documented, not probed | Model-visible feedback uses `hookSpecificOutput.additionalContext` (Stop) or exit 2 + stderr (PostToolUse); plain stdout is treated as user-only |
| P1 | Same | Codex | Stop `decision: "block"` or exit 2 with stderr continues the turn with the reason as a new prompt | [#9] | documented, not probed | Codex completion check blocks with `decision: "block"` and a reason |
| P1 | Same | Cursor | Stop `decision: "block"` + `reason` (Claude Code format) becomes an automatic follow-up; native hooks use `followup_message` | [#46] | documented, not probed | Cursor completion check returns `followup_message` |
| P2 | Exit-code field in PostToolUse(Bash) input | all | Not documented in the snapshots | — | documented, not probed: no channel known | Completion check (Phase 4) must not depend on it: a verification command that ran is read from the working tree and the command line, and an unknown result counts as not passed |
| P3 | Session id stable between PostToolUse and Stop; Stop re-entry flag | Claude Code, Codex | `stop_hook_active` is in Stop input; Claude Code overrides a Stop block after eight continuations in a row | [#31], [#9] | documented, not probed | Completion check exits 0 when `stop_hook_active` is true and caps its own blocks below the host cap |
| P4 | `onFailure` on hook crash and timeout | Claude Code | A timed-out PreToolUse hook does not block; exit codes other than 2, a hook that does not start, or invalid JSON let the action through. `onFailure: "block"` on a `command` hook makes failure, crash and timeout block, from 2.1.295 | [#29], [#30] | documented, not probed | `privacy-block` registrations get `onFailure: "block"` (host floor 2.1.295, installed 2.1.322 is above it); `pre-ship` does not, by maintainer decision |
| P4 | Same | Cursor | Exit 2 blocks; any other failure allows unless `failClosed: true`; permission hooks block on invalid JSON regardless | [#13] | documented, not probed | Privacy read gate keeps `failClosed: true`; the new ship-check entry is not fail-closed |
| P4 | Same | Codex | PreToolUse `ask`, `approve` or `continue: false` fail the hook and the call continues; only exit 2 or `deny` block | [#8] | documented, not probed | Codex ship check blocks with exit 2 or `permissionDecision: "deny"` only |
| P5 | Maximum hook timeout | Claude Code | 600 s default for `command` hooks; maximum not stated | [#42] | documented, not probed | Ship check keeps a configured timeout well under 600 s and an internal deadline shorter than it, so a slow check prints that it did not run instead of dying silently |
| P5 | Same | Codex | 600 s default; SessionEnd and Interrupt 1 s (max 3) | [#10] | documented, not probed | Same as Claude Code |
| P5 | Same | Cursor | Not documented | — | documented, not probed: unknown | Ship-check entry gets its own timeout, separate from the 10 s security gates, and the same internal deadline |
| P6 | Guard reach on other edit tools | Claude Code | A PreToolUse hook matching `Read` does not run for files added with `@`; PostToolUse `Edit\|Write` does not run when Bash rewrites a file | [#33] | documented, not probed | Enforcement matrix (Phase 3) lists `@`-attached files and shell rewrites as not covered; completion check reads edits from `git status --porcelain` |
| P7 | `model` in SessionStart input | all | Not documented in the snapshots | — | documented, not probed: no channel known | Density selection keeps `MEOWKIT_MODEL_HINT` as the input and treats a missing model as the default tier |

## Observed by replay (no live host needed)

| Case | Result 2026-11-15 | Meaning |
|---|---|---|
| Dual install (`.claude/` and `.cursor/` in one project), one shell command fired through Cursor's native shell hooks and the Claude Code `PreToolUse(Bash)` hooks Cursor also loads [#45] | Ship check ran once | Today only the Claude Code tree has a ship check. Once the Cursor bundle registers its own, the same command reaches both; the run-once marker keeps the count at one (case `cursor+cc: a dual install runs the ship check once per command`) |
