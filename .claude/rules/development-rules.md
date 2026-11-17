# Development Rules

Follow YAGNI, KISS, DRY — the smallest real change that satisfies the agreed scope, within the code standards in `docs/`. Look up API signatures with `mk:docs-finder`, not from memory: APIs change between releases.

## File Management

Name files in kebab-case with a descriptive name (e.g. `user-authentication.service.ts`), so search tools can tell a file's purpose from its name.

Keep code files under 200 lines; split a large file by concern. The limit guards maintainability; do not split mechanically when that makes the system harder to follow.

Update the existing file rather than creating an "enhanced" or "v2" copy: a duplicate hides which implementation is canonical.

## Code Quality

After creating or modifying a code file, run the build or compile command and fix every error before moving on. Defaults here: `cargo build`, `cargo test --workspace`, `npm run lint`, `npm test`; in another project, use the commands its `README.md`, `CLAUDE.md` or `docs/` give.

Implement real code. Do not mock, stub or simulate implementation code to make tests or CI pass — that hides the integration failure the test exists to catch. Use test databases and services.

When tests exist, end the session with them passing. Fix the root cause: do not delete tests, weaken assertions or add fake data to get green. After three failed fix attempts, stop and tell the user.

Tests are optional in default mode and expected in strict mode (`MEOWKIT_TDD=1` / `--tdd`: write the failing test first; no hook checks the order); a zero-test repo is permitted and the reviewer may WARN on it. Policy: `.claude/skills/cook/references/tdd-rules.md`.

## Commits and Pushes

Before a commit: lint with zero errors; run the tests if the project has any (`pre-ship.cjs` skips them when `package.json` has no `"test"` script); stage no confidential file (`.env`, credentials, API keys).

Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) with descriptive messages, committed often. Leave AI references out of commit messages.

NEVER push to main/master directly: use a feature branch and a PR, so the change is reviewed. Pull before you push, so conflicts surface early.

NEVER force-push unless the user asks for it: it rewrites history others may already have.

## Documentation Impact

After implementation, declare docs impact: `none` · `minor` (update existing docs) · `major` (new documentation required).

For `minor` or `major`, update the affected docs in the same PR: `docs/project-context.md` (the conventions, stack and anti-patterns every agent loads) plus whichever of `docs/project-overview.md`, `docs/architecture/system-architecture.md`, `docs/code-standards.md`, `docs/deployment-guide.md`, `docs/development-roadmap.md` and `docs/project-changelog.md` the project keeps — or its own documented layout. Prefer `mk:document-release` after shipping; `mk:docs-init` when a project has no docs.

## Tool Output Limits

Tool output stays in context, so cap it at the source: `head_limit=50` for Glob; `head_limit=20` per Grep query; `offset` + `limit` on Read for files over 500 lines; pipe verbose Bash commands through `head -100`. Raise a limit only when the task needs more.

Output also accumulates across turns: after a tool returns, keep the finding, not the raw output; re-running the tool retrieves it.
