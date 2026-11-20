# Enforcement matrix

What MeowKit enforces on each runtime, read from the hook registrations that ship
(`.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json`). This page is the only
source for an enforcement claim in the README, `CLAUDE.md`, `docs/core/` or an instruction
file: a claim that is not here is advisory at most.

The registrations are `.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json` and
`.grok/hooks/meowkit.json`, plus two code modules: the Pi extension `.pi/extensions/meowkit.ts`
and the OMP hook module `.omp/hooks/pre/meowkit.ts`. Both code modules call the shared guard
`.agents/meowkit/hooks/guard.cjs`. Claude Code, Codex and Cursor are in the first table;
Grok, Pi and OMP are in the second.

**Enforced** means a registered hook refuses the action. **Advisory** means an instruction
asks for it and nothing checks. **Absent** means neither.

## Controls: Claude Code, Codex and Cursor

| Control | Claude Code | Codex | Cursor |
|---|---|---|---|
| Credential-file reads (`.env`, keys, credentials) | Enforced: `privacy-block.cjs` on Read, Edit/Write and Bash; blocks when the hook itself fails (`onFailure: block`) | Enforced on Bash only: `privacy-block.cjs` reads the command and the paths it names; Codex has no file-read hook | Enforced: `privacy-read-gate.cjs` on `beforeReadFile`, fail-closed; the kill switch does not disable it |
| Ship check: lint, related tests, type-check on commit, push, merge, `gh pr create\|merge` | Enforced: `pre-ship.cjs` on Bash | Enforced: `pre-ship.cjs` on Bash (deny) | Enforced: `pre-ship.cjs` on `beforeShellExecution`; not fail-closed, and the kill switch disables it |
| Destructive shell commands | Advisory; the `careful` and `freeze` guards block only while their skill is active | Absent | Enforced: `shell-gate.cjs`, fail-closed; the kill switch downgrades it |
| MCP server allowlist | Absent (host permissions only) | Absent (host permissions only) | Enforced: `mcp-gate.cjs`, fail-closed |
| File writes to protected paths (`.git`, unclassified tools) | Absent (host permissions only) | Absent (host permissions only) | Enforced: `tool-gate.cjs`, fail-closed for writes and unclassified tools |
| Plan before building | Advisory | Advisory | Advisory |
| Review before shipping | Advisory | Advisory | Advisory |
| Test-first order in `--tdd` mode | Advisory | Advisory | Advisory |
| Completion check (edits left unverified at the end of a turn) | Opt-in, off by default: `pre-completion-check.cjs` on Stop blocks twice at most, then ends with a notice | Opt-in: `completion-check.cjs` on Stop (`decision: block` continues the turn); a pass counts only when the result carries exit code 0 | Opt-in: `stop-followup.cjs` sends a follow-up message, twice at most |
| Push, merge, force-push approval | Host permission prompt, when set to ask | Host approval policy | Host permission prompt |

## Controls: Grok, Pi and OMP

| Control | Grok | Pi | OMP |
|---|---|---|---|
| Credential-file reads (`.env`, keys, credentials) | Enforced on every tool: `privacy-block.cjs` on PreToolUse. A hook that errors or times out lets the call through | Enforced on every tool call: `guard.cjs` through the extension's `tool_call`; any failure blocks | Enforced on every tool call: `guard.cjs` through the hook module's `tool_call`; any failure blocks |
| Ship check: lint, related tests, type-check on commit, push, merge, `gh pr create\|merge` | Enforced on Bash: `pre-ship.cjs` on PreToolUse | Enforced on a shell command, inside `guard.cjs` | Enforced on a shell command, inside `guard.cjs` |
| Destructive shell commands | Absent | Absent | Absent |
| MCP server allowlist | Absent | Absent | Absent |
| File writes to protected paths | Absent | Absent | Absent |
| Plan before building | Advisory | Advisory | Advisory |
| Review before shipping | Advisory | Advisory | Advisory |
| Test-first order in `--tdd` mode | Advisory | Advisory | Advisory |
| Completion check | Absent | Absent | Absent |
| Push, merge, force-push approval | Not set by the kit; host setting | Not set by the kit; host setting | Not set by the kit; host setting |

**Not run in a live session.** The Enforced cells for Grok, Pi and OMP describe what the vendor
documents and what the kit's code does. None of them has been run inside a live Grok or Pi
session. For OMP only the skill listing was probed. Each Enforced cell needs the checks in
`docs/maintainer/runtime-probe-checklist.md` before it is claimed as tested.

- **Grok:** a hook that errors, times out or sends a shell command under a field name the guard
  does not know lets the call through. Grok blocks only on an explicit deny. The ship check's
  hook timeout is 300 s, and the check stops itself at 270 s, as on the other runtimes.
- **Pi:** the extension catches every failure in its own code and blocks the call. If Pi cannot
  load the extension at all, it logs the error and runs without it, so no guard runs.
- **OMP:** the hook module blocks the call when the guard gives no answer.

## Ship check scope

- **Commands seen:** `git commit`, `git push`, `git merge`, `gh pr create`, `gh pr merge`,
  including global options (`git -C . commit`, `git -c k=v commit`), extra spaces, env and
  `command`/`exec` prefixes, and git aliases (including `!` shell aliases), five levels deep.
- **Commands not seen:** a ship run inside `bash -c '…'`, a script file, a Makefile target, or
  any tool other than the shell. These pass unchecked.
- **Files checked:** a commit checks the staged files (plus modified tracked files with `-a`);
  push, merge and PR commands check `@{upstream}...HEAD` or `origin/HEAD...HEAD`.
- **Tests:** only the tests the runner can relate to the changed files (`vitest related`,
  `jest --findRelatedTests`). Any other runner, and Python and Swift projects, run lint and
  type-check only, and the output says tests did not run.
- **Time:** the check stops itself at 270 s, inside the 300 s hook timeout, and reports what
  did not finish. A hook killed by the host's timeout prints nothing.
- **Once per command:** when Cursor also loads the Claude Code hooks, both kits' ship checks
  fire on one command; a marker keyed by command, HEAD and the staged tree makes the second
  reuse the first one's result.
- `MEOWKIT_HOOK_PROFILE=fast` does not turn the ship check off.
- **Grok, Pi and OMP:** the same decision code runs (`lib/core/pre-ship.cjs`, copied into the
  guard), so the scope above applies to them too.

## Completion check

Switched on by `hooks.pre-completion-check: true` in `.meowkit/config.yaml`. After a shell
command that names a test, build, lint or type-check runner passes, a digest of the working
tree is stored; at the end of a turn, a tree that no longer matches it asks for one more turn,
at most twice per session. Before any pass, the tree the session started from is the
reference, so changes already present never arm it. Edits are read from the working tree, so
a file rewritten through the shell counts. Outside a git repository it does nothing.

It is evidence of effort, not proof: a trivial passing command satisfies it, a command whose
exit status is not the runner's (a pipe, `;`, `||`) never counts, and the agent can write its
state file. Codex starts the check only after its hooks are reviewed.

## When installed hooks do not run

- A Claude Code session started in a subdirectory that does not see the project's
  `.claude/settings.json`.
- A sparse checkout or worktree without `.claude/`.
- Codex hooks that are new or changed since the user last reviewed them: Codex skips them until
  they are trusted. After an upgrade the ship check is inactive on Codex until reviewed.
- Cursor with `MEWKIT_CURSOR_HOOKS_KILL_SWITCH=1` in the environment: the shell, MCP and tool
  gates and the ship check stand down; the credential read gate does not.
- Grok: project hooks run only after you run `/hooks-trust`, or when Grok starts with `--trust`.
  Until then the credential guard and the ship check are inactive.
- Pi: the project must be trusted with `/trust`. Pi loads `.pi/extensions/meowkit.ts` only in a
  trusted project.
- OMP: no trust step. The hook module loads with the project.

## What the credential guard does not see

- Files attached with `@` in the prompt: no tool call happens, so no hook runs.
- Reads inside a subprocess (`grep -r`, a script, a build tool) on Claude Code and Cursor; on
  Codex only the command line and the paths it names are checked.
