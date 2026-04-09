# Changelog

All notable changes to MeowKit are documented here.

See [website changelog](https://meowkit.dev/changelog)

## [Unreleased]

### BREAKING — TDD is now optional

TDD enforcement (`pre-implement.sh` hook + `tdd-rules.md`) is now opt-in. Default mode skips the RED-phase gate; `pre-implement.sh` becomes a no-op unless TDD mode is enabled.

**To restore strict TDD:**
- Per-command: pass `--tdd` to `meow:cook`, `meow:fix`, `meow:test`, `meow:harness`, `meow:spawn`
- Per-shell: `export MEOWKIT_TDD=1` in your shell rc or CI config
- Per-session: write `on` to `.claude/session-state/tdd-mode` (the slash command does this automatically when `--tdd` is detected)

**Backward compatibility:**
- `MEOW_PROFILE=fast` still bypasses TDD with a deprecation warning. The alias will be removed in the next major version.
- Existing in-flight plans under `tasks/plans/*` that reference "Phase 2 Test RED" can be completed under strict mode by exporting `MEOWKIT_TDD=1`. See migration guide.

**Why:** strict TDD added friction for spike work, tooling, and prototypes. Production-quality work should still enable `--tdd`.

**Migration guide:** [website/migration/tdd-optional](https://meowkit.dev/migration/tdd-optional) — full opt-in instructions, in-flight plan handling, and `MEOW_PROFILE=fast` deprecation timeline.

**Files affected (summary):**
- `.claude/hooks/pre-implement.sh` + new `.claude/hooks/lib/tdd-detect.sh` helper
- `.claude/rules/tdd-rules.md` (wrapped with When-enabled / When-disabled sections)
- `.claude/agents/{developer,tester,orchestrator,reviewer,planner}.md` (TDD-mode conditional)
- `.claude/skills/{meow:cook,meow:harness,meow:fix,meow:testing,meow:development,meow:workflow-orchestrator}/...`
- `.claude/commands/meow/{cook,test,fix,spawn}.md` (added `--tdd` flag)
- `CLAUDE.md` workflow phase string + TDD mode banner
- `website/**` ~21 doc files reframed as opt-in
