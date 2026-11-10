# Development Rules

These rules apply to all implementation work in projects using this workflow.

Follow YAGNI, KISS, DRY — the smallest real change that satisfies the approved scope, within the code standards in `docs/`. Use `mk:docs-finder`, never training data, for API signatures.

## File Management

ALWAYS use kebab-case for file names with descriptive names (e.g. `user-authentication.service.ts`) — search tools must infer purpose from the name.

ALWAYS keep code files under 200 lines; split large files into focused modules by concern. The limit is a maintainability guard, not a license for indirection: do not split mechanically if it makes the system harder to understand.

NEVER create new "enhanced" or "v2" files. ALWAYS update existing files directly — duplicates obscure the canonical implementation.

## Code Quality

ALWAYS run the compile/build command after creating or modifying a code file; zero compilation errors before proceeding. Defaults here: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`; downstream, prefer the commands documented in that project's `README.md`, `CLAUDE.md` or `docs/`.

NEVER simulate, mock, or stub implementation code to pass tests or CI — mocks hide real integration failures. Implement real code and use test databases/services.

NEVER finish a session with failing tests. Fix all failures before completing; escalate after 3 failed fix attempts.

NEVER ignore failing tests, delete tests, weaken assertions, or introduce fake data solely to pass CI. Address the root cause, then re-run the relevant checks.

Those two rules apply whenever tests exist. Tests are optional in default mode and required in strict mode (`MEOWKIT_TDD=1` / `--tdd`, where `pre-implement.cjs` enforces failing-test-first); a zero-test repo is permitted and the reviewer may WARN at Gate 2. Policy: `.claude/skills/cook/references/tdd-rules.md`.

## Pre-Commit Rules

Before every commit: run linting (zero errors); run tests — all pass IF tests exist (`pre-ship.cjs` skips that check when `package.json` has no `"test"` script); stage no confidential file (`.env`, credentials, API keys).

ALWAYS use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
NEVER include AI references in commit messages.
NEVER push to main/master directly — use feature branches and PRs.
NEVER force-push unless the user explicitly requests it.
ALWAYS commit frequently with descriptive messages.
ALWAYS pull before push to catch merge conflicts early.

## Documentation Impact

After completing implementation tasks, ALWAYS declare docs impact: `none` · `minor` (update existing docs) · `major` (new documentation required).

When impact is `minor` or `major`, update the affected docs in the same PR: `docs/project-context.md` (the conventions, stack and anti-patterns every agent loads) plus whichever of `docs/project-overview.md`, `docs/architecture/system-architecture.md`, `docs/code-standards.md`, `docs/deployment-guide.md`, `docs/development-roadmap.md` and `docs/project-changelog.md` the project keeps — or its own documented layout. Prefer `mk:document-release` after shipping; `mk:docs-init` when a project has no docs.

## Tool Output Limits

ALWAYS apply default output limits to prevent context bloat at source: `head_limit=50` for Glob; `head_limit=20` per Grep query; `offset` + `limit` on Read for files >500 lines; pipe verbose Bash commands through `head -100`. Raise a limit only when the task explicitly needs more.

Those caps bound a SINGLE call; observations also accumulate ACROSS turns. After a tool returns, summarize it to the relevant finding rather than retaining raw output — never discard silently, since raw output stays retrievable by re-running the tool.
