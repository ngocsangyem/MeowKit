# Enforcement matrix

What MeowKit enforces on each runtime, read from the hook registrations that ship
(`.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json`). This page is the only
source for an enforcement claim in the README, `CLAUDE.md`, `docs/core/` or an instruction
file: a claim that is not here is advisory at most.

**Enforced** means a registered hook refuses the action. **Advisory** means an instruction
asks for it and nothing checks. **Absent** means neither.

## Controls

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

## What the credential guard does not see

- Files attached with `@` in the prompt: no tool call happens, so no hook runs.
- Reads inside a subprocess (`grep -r`, a script, a build tool) on Claude Code and Cursor; on
  Codex only the command line and the paths it names are checked.
