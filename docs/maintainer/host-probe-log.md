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

## Cross-runtime discovery (2026-11-17)

What a runtime loads from folders that belong to another runtime, as the placement of kit files
depends on it. Run in a scratch git project outside the repo holding a skill `probe-a` with a
different description in each of `.agents/skills`, `.agents/skills/nested`, `.claude/skills`,
`.codex/skills`, `.cursor/skills` and `.omp/skills`. No model turn was spent.

Hosts that day: Codex CLI 0.167.0, OMP 18.13.3, Cursor Agent 2026.07.23-e383d2b, Claude Code
2.1.322. Grok and Pi are not installed on the maintainer machine.

| # | Probe | Host | Observed | Command or source | Status | Design it selects |
|---|---|---|---|---|---|---|
| X1 | Skill roots in a project | Codex | Lists `.agents/skills` **and `.codex/skills`** as skill roots. The documentation names `.agents/skills` only | `codex debug prompt-input` (run inside the project), "Skill roots" block | probed | The surface table lists `.codex/skills` as a Codex root; the kit writes nothing there |
| X2 | Same skill name in several roots | Codex | All three copies listed (`.agents/skills`, its nested folder, `.codex/skills`); no dedupe | same | probed | One copy of a skill per project for Codex |
| X3 | Two project agents with one `name`; a single project agent | Codex | Neither appears in the `spawn_agent` role list of the rendered prompt, also with the project marked trusted through `-c`; user-level agents do appear | same | inconclusive: the debug render may not load project agents | Emit one agent file per name; checklist item C1 |
| X4 | Same skill name, different text, four roots | OMP | Four entries: `probe-a` (native), `agents/probe-a`, `claude/probe-a`, `codex/probe-a` | `omp skill list --json` | probed | Differing copies are never left for OMP to see |
| X5 | Same skill name, identical bytes in `.omp/skills` and `.agents/skills` | OMP | One entry (`native:project`), no warning | same | probed | Identical copies are safe on OMP |
| X6 | Project switch for foreign providers | OMP | `.omp/config.yml` with `disabledProviders: [claude, codex]` leaves `probe-a` and `agents/probe-a` only | `omp config list --scope project`, `omp skill list --json` | probed | With `.claude/skills` present, the OMP emitter sets `disabledProviders` in `.omp/config.yml` |
| X7 | Agent `tools:` entry OMP does not know | OMP | `normalizeToolName` lowercases a canonical name (`Bash` → `bash`) and returns any other name unchanged (`WebFetch`, `Task(Explore)`); the list is then used as the subagent's tool allow-list | `src/tools/builtin-names.ts:47`, `src/discovery/helpers.ts:336-345`, `src/task/executor.ts:4339` | read from source | The OMP emitter writes canonical lowercase names only and reports a tool with no equivalent |
| X8 | Same skill name in `.cursor/skills`, `.agents/skills`, `.claude/skills` | Cursor | No listing command without a model turn (`cursor-agent` has `mcp`, `models`, `about`, no skill listing) | `cursor-agent --help` | unknown: conservative placement | Treated as no dedupe; checklist item C2 |
| X9 | Claude skill and agent paths, `.mdc` parsing, matcher names, agent fields | Grok | Not installed | — | unknown: conservative placement | Grok gets `.grok/` roots of its own and no reliance on its imports; checklist items C3–C5 |

Maintainer-run items: `docs/maintainer/runtime-probe-checklist.md`.
