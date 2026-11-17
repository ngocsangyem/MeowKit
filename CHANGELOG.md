# Changelog

All notable changes to MeowKit are documented here.

See [website changelog](https://docs.meowkit.dev/changelog)

## Unreleased

### Breaking: no approval gates

- **The plan-approval gate and the review-approval gate are removed on Claude Code, Codex and Cursor.** An agent can edit source with no approved plan and commit with no review verdict. Planning and review stay in the workflow as practices; approval is no longer enforced by any hook.
- **Removed verbs:** `mewkit plan approve`, `mewkit validate --gates`, `mewkit verdict-gate`. `mewkit doctor --hard-gates` keeps its name and probes the surviving guards.
- **Removed files:** `gate-enforcement.cjs`, `pre-implement.cjs`, the approval-receipt, contract-signature, plan-discovery and Gate 2 libraries, the sprint-contract scripts, `validate-gate-2.cjs`, and `.claude/rules/gate-rules.md`. `upgrade` removes their registrations and files.
- **Removed setting:** `gate1PresenceOnly` in `~/.meowkit/config.yaml` and `MEOWKIT_GATE1_PRESENCE_ONLY`. A user config that still has the key is reported as invalid by `mewkit doctor`; delete the line.
- **The ship check stays and now runs on all three runtimes.** On `git commit`, `git push`, `git merge` and `gh pr create|merge` it runs lint on the changed files, the tests related to them and a type-check, and refuses the command when one fails. It ignores `MEOWKIT_HOOK_PROFILE=fast`. When the test runner cannot name related tests it runs lint and type-check only and says that tests did not run.
- **Codex:** the ship check is a new hook in `.codex/hooks.json`. Codex runs a new or changed hook only after you review it, so after upgrading, review the hooks once or the ship check stays inactive.
- **Cursor:** the kill switch is environment-only (`MEWKIT_CURSOR_HOOKS_KILL_SWITCH=1`); the flag file no longer disables anything, and the credential read gate ignores the switch.
- **Completion check, opt-in on all three runtimes.** With `hooks.pre-completion-check: true`, a turn that ends with files changed since the last passing test, build, lint or type-check run is continued, twice at most. Off by default; advisory evidence, not proof.
- **Build feedback reaches the model.** A failed compile or lint after an edit is reported on the channel Claude Code shows to the model, not only in the transcript.
- What each runtime enforces: `docs/core/enforcement-matrix.md`.

### Model fit on Claude Code, Codex and Cursor

- **Agents are pinned by tier to current models.** Each agent's model follows its Claude Code tier, and the bundles derive from that table: haiku → Codex `gpt-6-luna`, Cursor `composer-2.5[fast=true]`; sonnet → `gpt-6.1-sol`, `composer-2.5[fast=true]`; opus → `gpt-6-astra`, `claude-opus-5[effort=high]`; fable → `gpt-6-astra`, `claude-fable-5`. Thirteen Codex agents pinned a retired id. The table and its sources: `docs/maintainer/model-pins.md`.
- **Always-on rules and skill bodies give reasons instead of shouted absolutes**, keeping NEVER on force-push and pushing to main and on the security rules. Standing "delegate" and "re-verify" lines are conditioned.
- **Hook advice reaches the model on Claude Code.** Observers that printed plain stdout on tool events (loop detection, pre-task check, post-write warnings) now send `additionalContext`. Every handler's channel on each runtime: `docs/maintainer/hook-output-channels.md`.
- **Skill listings fit each runtime's ceiling** (16k Claude Code, 12k Codex, 16k Cursor), with the words a user types for the job first.
- **The bundles speak their host's language.** Codex text invokes skills as `$mk-x` and Cursor as `/mk-x`; Claude Code tool syntax is gone from both. Bundle scripts resolve the project root and their `mk-` skill folders, so the Jira, Confluence and benchmark wrappers work after install.
- **The bundles ship what their skills call.** The `workflow-*` helpers the skill preambles run now install under `.codex/scripts/bin/` and `.cursor/scripts/bin/`, copied byte for byte by `scripts/sync-hook-core.cjs`. The rubric library installs under `.codex/rubrics/` and `.cursor/rubrics/`, which is where `mk-rubric` and the evaluator's score check look.
- **`mewkit skill env <skill>` finds Codex and Cursor installs** (`.agents/skills/mk-<skill>`, `.cursor/skills/mk-<skill>`). Install hints on all three runtimes name this command; plain `mewkit setup` builds no skill environment without `--skills`.
- **Autobuild density knows current models.** On Claude Code, Opus 5 and Fable 5 are COMPLEX with LEAN density (the rule already applied to Opus 4.6 and 4.7), and Fable no longer falls back to STANDARD. On Codex, as on Cursor, nothing names the session's model to the script, so LEAN is explicit opt-in only.
- **Bundle parity check in CI.** `node scripts/check-bundle-parity.cjs` compares every Claude Code skill and agent with its Codex and Cursor port by heading outline, with host terms folded. Accepted differences and their reasons are listed in `scripts/bundle-parity-allow.json`; a listed difference that no longer occurs also fails.

### Upgrade notes

- **Autobuild on Opus 5.5 or Fable 5.2 now runs LEAN** (contract optional, at most one iteration round). Set `MEOWKIT_AUTOBUILD_MODE=FULL` to keep the previous scaffolding. Neither model has been replayed against the calibration set yet.
- **Codex:** `gpt-6-luna` must be enabled by an Enterprise or Edu admin before agents pinned to it can run. `athena`, `brainstormer` and `explore` run in Codex's read-only sandbox.
- **A skill that needs Python reports `mewkit skill env <skill>`** when its environment is missing. Run that command once per skill.

### Improvements

- **New identity: Prompt + Cursor.** The `/meow|` typed-text logo and the royal-blue palette are replaced on the README, `meowkit.dev` and `docs.meowkit.dev`. The mark is an ink `>` chevron beside a blue cat-eared cursor, with an outlined lowercase JetBrains Mono wordmark `meowkit`. Colour is one family of muted blues: mist paper `#eef2f7`, night `#131a27` for ink and dark mode, one accent dusk `#2f66b3` (sky `#8fb5e8` on night). Headlines set in Newsreader, text in Onest, labels and commands in JetBrains Mono; docs code blocks stay on the platform mono.
- `assets/design-tokens.json` is the one token source, mirrored byte-for-byte to `docs/design/` and `packages/mewkit/assets/`. Asset filenames are unchanged (`meow-logo.svg`, `meow-favicon.svg`, `meow-og.png` …), so existing links keep resolving; new: `meow-symbol*.svg`, a favicon PNG/ICO set and `meow-apple-touch-icon.png`.
- The landing page is rebuilt as seven sections in the new identity.
