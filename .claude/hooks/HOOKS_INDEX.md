# Hooks Index

Every hook this kit ships, with its registration and what it is for.

## Runtime

The runtime is node. Every hook is a `.cjs` module registered in exec form — the
executable in `command`, the script path as one `args` element — so no hook needs a
shell to start and the kit runs on a host that has none. There is no exception: no
registration runs a shell, a `.sh` file or an interpreter, and `mewkit doctor` sweeps
the hook paths for one.

The kit ships 28 node hooks: the 4 entrypoints directly under `hooks/`, which the host
registers or an agent invokes, and the 24 observers under `hooks/handlers/`, which
`dispatch.cjs` runs. Nothing under `lib/` is a hook — the host registers none of it — and
neither are the sidecars (`HOOKS_INDEX.md`, `handlers.json`) or `__tests__/`.

`lib/` holds two kinds of file, and the difference matters when reading a registration:
the shared modules a hook `require`s, and the kit's own command-line tools, which a skill
or an agent runs by path and no event ever starts — `injection-audit.cjs`,
`skill-python.cjs`, `workflow-config`, `workflow-slug`, `workflow-repo-mode`,
`workflow-diff-scope`, `workflow-review-log` and `setup-workflow`. They live beside the
libraries because they share them and because the whole tree carries one runtime rule:
node, and nothing else.

Input arrives as JSON on stdin. A write guard reads it with the fail-closed reader
(`lib/parse-stdin.cjs` `readHookInput`), which reports why input was unreadable so the
guard can refuse; an observer reads the same payload from the dispatcher.

## Two contracts, deliberately opposite

**Write guards** — `privacy-block.cjs` and `pre-ship.cjs` — are
registered directly, never through the dispatcher, and fail CLOSED: each installs
top-level error handlers that print its marker and exit 2 before any library is
required, so a crash, a syntax error or a missing library still blocks. Only exit 2
blocks a tool call; every other exit is advisory, which is why a crashing guard would
otherwise read as permission.

**Observers** — every entry in `handlers.json` — run through `dispatch.cjs` and fail
OPEN: one that throws is reported and the rest still run. Three of them have their output
passed through rather than swallowed: `build-verify.cjs` and a BLOCK finding of
`post-write.cjs` reach the model (exit 2, stderr), and the opt-in `pre-completion-check.cjs` answers
with a block decision. These are emitted after every other observer has run. An observer
with advice for the model returns `context`; on tool events the dispatcher sends it as
`hookSpecificOutput.additionalContext`, because plain stdout there reaches only the
transcript.

**CLI modules** are invoked with arguments by an agent or another module, not by an
event, so they appear in no registry.

`toggleKey` is declared for every observer. Setting `hooks.<toggleKey>: false` in the project
config removes that observer from every event it is registered on (`lib/handler-registry.cjs`).

## Registered entrypoints

| Hook | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `dispatch.cjs` | SessionStart | — | — | 15s | Runs the observers registered for one event, fail-open |
| `privacy-block.cjs` | PreToolUse | Edit\|Write | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, and obviously unsafe fetch targets |
| `privacy-block.cjs` | PreToolUse | Read\|Grep\|Glob | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, obviously unsafe fetch targets, and reads, searches and listings of archived plans (`tasks/plans/archive/`, `tasks/plans/ceo-plans/archive/`) |
| `pre-ship.cjs` | PreToolUse | Bash | — | 300s | Ship check: team-memory lint, then lint on the changed files, the tests related to them and a type-check |
| `privacy-block.cjs` | PreToolUse | Bash | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, obviously unsafe fetch targets, and read, list or search commands aimed at archived plans (moves and writes into the archive pass) |
| `dispatch.cjs` | PreToolUse | Bash | — | 10s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PreToolUse | Task\|Agent | — | 10s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUse | Edit\|Write | — | 40s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUse | Bash | — | 15s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | Stop | — | — | 15s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | UserPromptSubmit | — | — | 10s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PreCompact | — | — | 5s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUseFailure | — | — | 5s | Runs the observers registered for one event, fail-open |

## Observers (dispatched via `dispatch.cjs`, registered in `handlers.json`)

| Handler | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `pre-task-check.cjs` | PreToolUse | Bash | pre-task-check | — | Reports blocking-class prompt-injection patterns in a command to the model as additionalContext (advisory); length and outside-project paths are not reported |
| `delegation-brief-check.cjs` | PreToolUse | Task\|Agent | delegation-brief-check | — | Notes, as additionalContext, a delegation brief with no `Goal:` or `Return:` label; records one trace event |
| `build-verify.cjs` | PostToolUse | Edit\|Write | build-verify | — | Runs the project build after an edit |
| `loop-detection.cjs` | PostToolUse | Edit\|Write | loop-detection | — | Reminds the model, as additionalContext, at 4 and 8 edits to one file, then every 4 |
| `budget-tracker.cjs` | PostToolUse | Edit\|Write | budget-tracker | — | Accumulates token and cost estimates; notices are user-only |
| `auto-checkpoint.cjs` | PostToolUse | Edit\|Write | auto-checkpoint | — | Writes a checkpoint after an edit |
| `learning-observer.cjs` | PostToolUse | Edit\|Write | learning-observer | — | Per-file edit ledger and the canonical edit record |
| `post-write.cjs` | PostToolUse | Edit\|Write | post-write | — | Security scan of a file that has already been written; fails the tool result on a blocked pattern |
| `budget-tracker.cjs` | PostToolUse | Bash | budget-tracker | — | Accumulates token and cost estimates; notices are user-only |
| `review-evidence-tag.cjs` | PostToolUse | Bash | review-evidence-tag | — | Tags review evidence from a command |
| `verification-evidence.cjs` | PostToolUse, SessionStart | Bash | verification-evidence | — | Records the session's starting tree and the tree at each passing verification command, for the opt-in completion check |
| `checkpoint-writer.cjs` | Stop | — | checkpoint-writer | — | Writes the end-of-session checkpoint |
| `post-session.cjs` | Stop | — | post-session | — | Records cost and trace data when a session ends; writes the "verified" marker only for rule and phase-zero files that are present, non-empty and unchanged since session start |
| `control-probe.cjs` | Stop | — | control-probe | — | A known-good fire, used as a control signal |
| `pre-completion-check.cjs` | Stop | — | pre-completion-check | — | Opt-in: continues a turn whose edits are unverified, at most twice |
| `plan-state-sync.cjs` | Stop | — | plan-state-sync | — | Always on: syncs changed plans' derived state (phase status, Overview line, plan.md table and status, `.plan-state.json`) to their checkboxes; one line to the user when it changed something or a plan is ready to archive; never blocks |
| `model-detector.cjs` | SessionStart | — | model-detector | — | Records the active model at session start |
| `orientation-ritual.cjs` | SessionStart | — | orientation-ritual | — | Emits the orientation prompt at session start |
| `project-context-loader.cjs` | SessionStart | — | project-context-loader | — | Injects the project's own context, resets per-session state and records the rule-file digests the marker is checked against |
| `jira-env-loader.cjs` | SessionStart | — | jira-env-loader | — | Reports whether the issue-tracker credentials are present. The only reader of the project dotenv |
| `capability-bootstrap.cjs` | SessionStart | — | capability-bootstrap | — | Emits the capability-resolution guidance |
| `safety-sentinel-inject.cjs` | UserPromptSubmit | — | safety-sentinel-inject | — | Emits the cached-skip marker when this session verified the baseline and the files still match the recorded digest |
| `tdd-flag-detector.cjs` | UserPromptSubmit | — | tdd-flag-detector | — | Turns the test-first sentinel on or off from the prompt |
| `precompact-probe.cjs` | PreCompact | — | precompact-probe | — | Re-arms the safety baseline before context is compacted |
| `posttoolfailure-probe.cjs` | PostToolUseFailure | — | posttoolfailure-probe | — | Records that the tool-failure event fires |

## CLI modules (argv-invoked, in no registry)

| Module | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `append-trace.cjs` | — (argv) | — | — | — | Writes one record to the shared trace history. Argv-driven |

## Where observer output lands

`.meowkit/telemetry/trace-log.jsonl` is the single canonical event stream: one record per
event, written through a shared sidecar lock so a writer in another language cannot
interleave with it, and scrubbed before the write. `.meowkit/telemetry/hook-log.jsonl` is
separate and internal — hook-fire telemetry, kept uncompressed so it stays greppable.

## Drift checks

A registration check in the kit's source repository catches drift in both directions plus the registry:
a hook on disk that nothing registers, a registration with no file, and a registry entry
with no file. `mewkit doctor --hard-gates` probes the write guards behaviourally and
reports a leftover shell hook as a finding.
