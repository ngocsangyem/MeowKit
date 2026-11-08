# AC-12 — the recorded clone-without-init journey

Reproduce with `bash ac-12-clone-journey.sh <repo-root>`; the full capture is
`ac-12-clone-journey-transcript.txt` (line numbers below refer to it).

## How the clone was made, and why that way

Nothing was committed to this repository. The script builds a **throwaway source
repository in `$TMPDIR`** from a copy of the working tree's kit content — the whole
`.claude/` tree (minus `worktrees/` and `logs/`, which are not kit content), the
allowlisted `.meowkit/` members, and `CLAUDE.md` — commits it there, and then runs a
**real `git clone`** of it. So the clone is produced by git from a real commit, as a
teammate's would be, and the repository under test is untouched.

What the source repository tracks under `.meowkit/` — the deny-all ignore file doing
its job, no `cache/`, no `metadata.json`:

```
.meowkit/.env.example
.meowkit/.gitignore
.meowkit/config.yaml
.meowkit/mcp.json.example
```

The clone: 1273 tracked files, `node_modules` **absent**, `.meowkit/cache` **absent**
(untracked by construction, so a clone never has one), `.meowkit/metadata.json`
**absent**, `tasks/plans` **absent**.

## The environment capture

| Probe | Result |
|---|---|
| `PATH` | a single directory holding only `node` and `git` symlinks |
| `command -v mewkit` | `(not found)` |
| `command -v npx` | `(not found)` |
| `fetch("https://github.com")` | `unreachable: EOFFLINE` |
| raw socket to `github.com:443` | `unreachable: EOFFLINE` |

A closed-port proxy is **not** sufficient on this Node (v20.20.2 ignores
`NODE_USE_ENV_PROXY` for `fetch` — verified directly), so the refusal is installed
in-process and inherited by every child through `NODE_OPTIONS=--require offline.cjs`:
`dns.lookup`, `dns.promises.lookup` and `net.Socket.prototype.connect` all fail. The
error code is deliberately `EOFFLINE` rather than one of the three the transcript is
grepped for, so a hook that *did* try the network would appear as its own distinct
string instead of hiding inside the crash grep. **Observed `EOFFLINE` occurrences in
the session: 0** — no hook attempted the network.

## The session

| # | Event | Entrypoint | Result |
|---|---|---|---|
| 1 | SessionStart | `dispatch.cjs SessionStart` | exit 0, full context block |
| 2 | PreToolUse Edit `src/app.ts` | `gate-enforcement.cjs` | **exit 2**, `@@GATE_BLOCK@@` (:74) |
| 3 | PreToolUse Read `.env` | `privacy-block.cjs` | **exit 2**, `@@PRIVACY_BLOCK@@` (:81) |
| 4 | PreToolUse Bash (ship), nothing staged | `pre-ship.cjs` | exit 0, N/A — and the memory lint degrades (:87) |
| 4b | PreToolUse Bash (ship), `src/app.ts` staged | `pre-ship.cjs` | **exit 2**, `@@GATE_BLOCK@@` (:97) |
| 4c | PreToolUse Bash | `dispatch.cjs PreToolUse Bash` | exit 0, observers ran |
| 5 | Stop | `dispatch.cjs Stop` | exit 0, checkpoint + telemetry written |
| — | guard careful | `check-careful.cjs` | exit 0, `permissionDecision: ask` — matches `careful-destructive-command` |
| — | guard freeze | `check-freeze.cjs` | exit 0, `{}` (no freeze in force) |
| — | guard investigate | `check-report-path.cjs` | **exit 2**, deny — matches `investigate-report-path-wrong` |

Event 4 is run twice on purpose: the AC asks for two different things from the same
hook. With nothing ship-capable staged the ship is correctly **N/A** and the thing
that degrades is the memory-store lint — `SKIP: mewkit CLI not found — team memory
store not linted`, exactly the existing line, neither blocking nor passing silently.
With a source file staged, Gate 2 **blocks**: "Ship-capable change (e.g. `src/app.ts`)
with no active-plan pointer", naming the fix. Neither invocation needed the CLI or the
config (D2), which is why the missing install does not affect them.

## The grep and the count

```
crash markers (Traceback|MODULE_NOT_FOUND|ENOTFOUND): 0
network attempts (EOFFLINE):                           0
non-zero hook exits:                                   4   (the three blocks above + the investigate guard)
"mewkit doctor" hint occurrences:                      1
memory-store lint degradation:                         1
```

Every non-zero exit is a deliberate block. The dispatcher and every observer exited 0,
fail-open as contracted.

## The one defect this journey found, and its fix

**The `mewkit doctor` hint did not exist.** The first run of this journey counted **0**
occurrences: the clone degraded correctly and silently. `pre-ship` printed
`SKIP: mewkit CLI not found` with nothing on screen connecting that skip to the missing
install, and no other surface mentioned it. D14 commits this sprint to "the no-CLI
graceful degradation **and** the `mewkit doctor` hint", so the hint is product code now,
not evidence prose:

- `.claude/hooks/lib/session-context-report.cjs` gains `resolveCli(root, env)` —
  resolution only, nothing spawned: the committed launcher (`.meowkit/bin/mewkit`,
  phase 06), `node_modules/.bin/mewkit`, then each `PATH` entry — and `installBlock`,
  which returns the hint only when all three come up empty.
- `.claude/hooks/handlers/project-context-loader.cjs` emits it **under the same
  new-session condition as the config block**, so it is once per session by
  construction rather than once per event: a resume or a compaction re-runs the handler
  under the same session id and prints nothing.
- `tests/hooks/session-start-context.test.ts` asserts all three claims: the hint
  appears with `mewkit doctor` in it exactly once, a second call under the same session
  id is silent, and a project with a resolvable CLI gets no hint at all.

No new observer and no new `handlers.json` entry: the registry still has its 22 entries
over 21 keys, so AC-02's 21 config stubs and AC-07's 21 toggles are untouched.
