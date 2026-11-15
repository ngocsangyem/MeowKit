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

### Improvements

- **New identity: Prompt + Cursor.** The `/meow|` typed-text logo and the royal-blue palette are replaced on the README, `meowkit.dev` and `docs.meowkit.dev`. The mark is an ink `>` chevron beside a blue cat-eared cursor, with an outlined lowercase JetBrains Mono wordmark `meowkit`. Colour is one family of muted blues: mist paper `#eef2f7`, night `#131a27` for ink and dark mode, one accent dusk `#2f66b3` (sky `#8fb5e8` on night). Headlines set in Newsreader, text in Onest, labels and commands in JetBrains Mono; docs code blocks stay on the platform mono.
- `assets/design-tokens.json` is the one token source, mirrored byte-for-byte to `docs/design/` and `packages/mewkit/assets/`. Asset filenames are unchanged (`meow-logo.svg`, `meow-favicon.svg`, `meow-og.png` …), so existing links keep resolving; new: `meow-symbol*.svg`, a favicon PNG/ICO set and `meow-apple-touch-icon.png`.
- The landing page is rebuilt as seven sections in the new identity.
