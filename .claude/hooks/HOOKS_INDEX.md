# Hooks Index

Every hook this kit ships, with its registration and what it is for.

## Runtime

The runtime is node. Every hook is a `.cjs` module registered in exec form — the
executable in `command`, the script path as one `args` element — so no hook needs a
shell to start and the kit runs on a host that has none. The one exception is
`ensure-skills-venv.sh`, which bootstraps the Python environment and is replaced
together with its lazy resolver.

Input arrives as JSON on stdin. A write guard reads it with the fail-closed reader
(`lib/parse-stdin.cjs` `readHookInput`), which reports why input was unreadable so the
guard can refuse; an observer reads the same payload from the dispatcher.

## Two contracts, deliberately opposite

**Write guards** — `gate-enforcement.cjs`, `privacy-block.cjs`, `pre-ship.cjs` — are
registered directly, never through the dispatcher, and fail CLOSED: each installs
top-level error handlers that print its marker and exit 2 before any library is
required, so a crash, a syntax error or a missing library still blocks. Only exit 2
blocks a tool call; every other exit is advisory, which is why a crashing guard would
otherwise read as permission.

**Observers** — every entry in `handlers.json` — run through `dispatch.cjs` and fail
OPEN: one that throws is reported and the rest still run. Two of them have their output
passed through rather than swallowed: `post-write.cjs` fails the tool result on a
blocked pattern, and `pre-completion-check.cjs` answers with a block decision. Both are
emitted after every other observer has run.

**CLI modules** are invoked with arguments by an agent or another module, not by an
event, so they appear in no registry.

`toggleKey` is declared for every observer and is read from project configuration
later; nothing is switchable yet.

## Registered entrypoints

| Hook | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `ensure-skills-venv.sh` | SessionStart | — | — | 30s | Bootstraps the Python environment the python-based skills need. Idempotent |
| `dispatch.cjs` | SessionStart | — | — | 15s | Runs the observers registered for one event, fail-open |
| `gate-enforcement.cjs` | PreToolUse | Edit\|Write | — | 10s | Blocks a source write before the plan is approved and before the sprint contract is signed |
| `privacy-block.cjs` | PreToolUse | Edit\|Write | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, and obviously unsafe fetch targets |
| `privacy-block.cjs` | PreToolUse | Read | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, and obviously unsafe fetch targets |
| `pre-ship.cjs` | PreToolUse | Bash | — | 30s | Ship-boundary guard: structural review proof, team-memory lint, then the build/lint/test block |
| `privacy-block.cjs` | PreToolUse | Bash | — | 5s | Refuses reads of credential-bearing files and web-fetch artifacts, and obviously unsafe fetch targets |
| `dispatch.cjs` | PreToolUse | Bash | — | 10s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUse | Edit\|Write | — | 40s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUse | Bash | — | 15s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | Stop | — | — | 15s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | UserPromptSubmit | — | — | 10s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PreCompact | — | — | 5s | Runs the observers registered for one event, fail-open |
| `dispatch.cjs` | PostToolUseFailure | — | — | 5s | Runs the observers registered for one event, fail-open |

## Observers (dispatched via `dispatch.cjs`, registered in `handlers.json`)

| Handler | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `pre-task-check.cjs` | PreToolUse | Bash | preTaskCheck | — | Reports prompt-injection patterns in a command (advisory) |
| `build-verify.cjs` | PostToolUse | Edit\|Write | buildVerify | — | Runs the project build after an edit |
| `loop-detection.cjs` | PostToolUse | Edit\|Write | loopDetection | — | Detects repeated identical edits |
| `budget-tracker.cjs` | PostToolUse | Edit\|Write | budgetTracker | — | Accumulates token and cost estimates |
| `auto-checkpoint.cjs` | PostToolUse | Edit\|Write | autoCheckpoint | — | Writes a checkpoint after an edit |
| `learning-observer.cjs` | PostToolUse | Edit\|Write | learningObserver | — | Per-file edit ledger and the canonical edit record |
| `post-write.cjs` | PostToolUse | Edit\|Write | postWrite | — | Security scan of a file that has already been written; fails the tool result on a blocked pattern |
| `budget-tracker.cjs` | PostToolUse | Bash | budgetTracker | — | Accumulates token and cost estimates |
| `review-evidence-tag.cjs` | PostToolUse | Bash | reviewEvidenceTag | — | Tags review evidence from a command |
| `checkpoint-writer.cjs` | Stop | — | checkpointWriter | — | Writes the end-of-session checkpoint |
| `post-session.cjs` | Stop | — | postSession | — | Records cost and trace data when a session ends |
| `control-probe.cjs` | Stop | — | controlProbe | — | A known-good fire, used as a control signal |
| `pre-completion-check.cjs` | Stop | — | preCompletionCheck | — | Refuses to end a session that owes verification, up to a bounded number of attempts |
| `model-detector.cjs` | SessionStart | — | modelDetector | — | Records the active model at session start |
| `orientation-ritual.cjs` | SessionStart | — | orientationRitual | — | Emits the orientation prompt at session start |
| `project-context-loader.cjs` | SessionStart | — | projectContextLoader | — | Injects the project's own context and resets per-session state |
| `jira-env-loader.cjs` | SessionStart | — | jiraEnvLoader | — | Reports whether the issue-tracker credentials are present. The only reader of the project dotenv |
| `capability-bootstrap.cjs` | SessionStart | — | capabilityBootstrap | — | Emits the capability-resolution guidance |
| `safety-sentinel-inject.cjs` | UserPromptSubmit | — | safetySentinelInject | — | Emits the cached-skip marker when this session already verified the baseline |
| `tdd-flag-detector.cjs` | UserPromptSubmit | — | tddFlagDetector | — | Turns the test-first sentinel on or off from the prompt |
| `precompact-probe.cjs` | PreCompact | — | precompactProbe | — | Re-arms the safety baseline before context is compacted |
| `posttoolfailure-probe.cjs` | PostToolUseFailure | — | posttoolfailureProbe | — | Records that the tool-failure event fires |

## CLI modules (argv-invoked, in no registry)

| Module | Event | Matcher | Toggle key | Timeout | Purpose |
|---|---|---|---|---|---|
| `pre-implement.cjs` | — (argv) | — | — | — | Refuses to start implementing until a failing test exists. Argv-driven, fail-closed in strict mode |
| `append-trace.cjs` | — (argv) | — | — | — | Writes one record to the shared trace history. Argv-driven |

## Where observer output lands

`.meowkit/telemetry/trace-log.jsonl` is the single canonical event stream: one record per
event, written through a shared sidecar lock so a writer in another language cannot
interleave with it, and scrubbed before the write. `.claude/hooks/.logs/hook-log.jsonl` is
separate and internal — hook-fire telemetry, gitignored, kept uncompressed so it stays
greppable.

## Drift checks

`scripts/check-hook-registration.sh` catches drift in both directions plus the registry:
a hook on disk that nothing registers, a registration with no file, and a registry entry
with no file. `mewkit doctor --hard-gates` probes the guards behaviourally and reports a
leftover shell hook as a finding.
