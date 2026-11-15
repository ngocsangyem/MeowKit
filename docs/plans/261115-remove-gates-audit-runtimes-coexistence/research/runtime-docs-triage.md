# Triage of the runtime-docs findings against the approved plan

2026-11-15. Source: `runtime-docs-index.md` (fact numbers below are its). The plan is approved
with a receipt; nothing in `plan.md` or the phase files was edited for this triage. Six facts
(#9, #10, #11, #33, #42, #45) were re-read in the snapshots under `tmp/runtime-docs-261115/`
and match the index.

## A. Already covered by the plan

| Fact | Where the plan covers it |
| --- | --- |
| #29 only exit 2 blocks on Claude Code | Phase 1 cases assert the host-visible decision; Phase 2 keeps exit 2 |
| #30 a timed-out hook does not block; `onFailure: "block"` needs 2.1.295+ | Phase 2 Requirement 3 (`privacy-block` only, maintainer decision); Phase 1 probe |
| #13 Cursor fails open unless `failClosed` | Phase 2 Risk Assessment; the ship check is deliberately not fail-closed |
| #14 Cursor `loop_limit` defaults to 5 | Phase 4 Key Insights |
| #1, #61 stacked emphasis is an outdated pattern | Phase 3 criterion A3 |
| #36 Bash deny rules are not a security boundary | Phase 3 Requirement 5 (enforcement matrix), Phase 5 Requirement 7 (optional host profile) |

## B. Implementation notes — no plan change, read when the phase starts

Phase 1
- The Stop re-entry flag exists: `stop_hook_active` (#31, Claude Code; #9, Codex). The probe confirms it instead of discovering it.
- Default hook timeout is 600 s on Claude Code and Codex (#42, #10). The 10 s the plan cites is the kit's own configured value. Cursor's maximum is not stated; that probe stays.
- Exit 2 means different things per event (#37): it blocks PreToolUse and Stop, and only shows stderr on PostToolUse.

Phase 2
- A PreToolUse JSON decision belongs in `hookSpecificOutput.permissionDecision`; top-level `decision` is deprecated for that event (#34). The ship check uses exit 2, which routes as deny.
- On Codex a PreToolUse hook that returns `ask`, `approve` or `continue: false` fails and the call continues (#8). The Codex ship check must use exit 2 or `deny` only.
- `${CLAUDE_PROJECT_DIR}` stays at the starting repo after entering a worktree; hook input `cwd` follows it (#4). `changed-files.cjs` must resolve the repository from `cwd`.
- A hook killed by its timeout prints nothing. "The output states the check did not run" needs an internal deadline shorter than the configured timeout.
- Codex skips a new or changed hook until the user reviews it (#11). After upgrade the new ship-check hook is inactive until trusted; the upgrade notes (Phase 3 Requirement 7) must say so.

Phase 3
- `.claude/rules/` frontmatter: only `paths` is read (#60).
- The enforcement matrix must state that `privacy-block` does not run for `@`-attached files and that Read deny rules do not cover `grep -r` or subprocesses (#33, #36).
- Stop does not run on user interrupt or API error (#32); list it under the completion check.

Phase 4
- Claude Code overrides a Stop block after eight continuations in a row (#31); the plan's cap of two is below that. `hookSpecificOutput.additionalContext` continues the turn as feedback.
- Cursor `loop_limit` is native-format only (#46).
- If the check is ever put on SubagentStop, it also fires for internal agents with an empty `agent_type` (#43).

Phase 5
- On Claude Code the same handler defined in more than one settings file runs once (#41); a global plus project install does not double-fire there.

## C. Would need a plan change and re-approval

| # | Finding | Why the plan does not cover it | Smallest change |
| --- | --- | --- | --- |
| C1 | Cursor loads Claude Code hooks, skills and agents by default, and runs all matching hooks from every source (#45, #46, #15, #47) | A repo with both `.claude/` and `.cursor/` bundles runs both MeowKit hook sets in Cursor. After pull request 2c the ship check would run twice. The Phase 5 `foreign hooks` row reports only hooks the kit does not own, so the kit colliding with itself is invisible | Phase 5: a row for cross-runtime double load. Phase 1: one case. Phase 2 (2c): the ship check detects that it already ran for the same command, or the bundle documents the Cursor setting |
| C2 | A PostToolUse hook matching `Edit\|Write` does not run when Bash rewrites a file (#33) | Phase 4 Architecture records the last edit from that hook only, so the completion check never arms for edits made through the shell | Phase 4 Requirement 1 and Architecture: derive "edited since last pass" from the working tree (`git status --porcelain`) at Stop |
| C3 | Codex has Stop hooks; `decision: "block"` continues the turn (#9) | Phase 4 Step 9 and Next Steps say Codex has no stop hook and defer it "if the host adds one". The gap is in the bundle, not the host | Correct the wording; optionally add the completion rule to the Codex bundle |
| C4 | Kit hooks can be installed and not run: session started in a subdirectory (#38), `disableAllHooks`, managed-only hooks (#40, #49), untrusted Codex project or unreviewed hook (#11, #48), sparse worktree without `.claude` (#7) | Phase 5 Requirement 5 (`checks: weakened`) covers observer toggles, the fast profile, the kill switch and the host floor only | Phase 5 Requirement 5: add the states `doctor` can read from config; list the rest in the enforcement matrix |

A change to any phase body makes the approval receipt stale; all four can go into one revision
with one re-approval.
