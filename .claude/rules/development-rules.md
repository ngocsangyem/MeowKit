# Development Rules

These rules apply to all implementation work in projects using this workflow.

## General

- Analyze the skill catalog before starting and activate only the skills needed for the task domain.
- Follow YAGNI, KISS, and DRY. Prefer the smallest real change that satisfies the approved scope.
- Use `mk:docs-finder` for current library/API documentation; do not rely on training data for signatures.
- Use `mk:multimodal` for describing or processing images, videos, audio, PDFs, and other non-text artifacts.
- Use `mk:sequential-thinking` and `mk:investigate` for multi-step analysis, root-cause debugging, or uncertain fixes.
- Use `mk:scout` before broad codebase exploration; keep investigations scoped to avoid context bloat.
- Follow the codebase structure and code standards in `docs/` when they exist.
- Do not simulate, fake, stub, or mock production implementation. Always implement the real behavior.

## File Management

### File naming

ALWAYS use kebab-case for file names with descriptive names.
WHY: Search tools must infer file purpose from names.
Example: `user-authentication.service.ts`.

### File size

ALWAYS keep code files under 200 lines.
WHY: Shorter files fit in context windows and reduce merge conflicts.
Split large files into focused modules by concern.

Use composition over inheritance for large UI/components, extract utilities into focused modules, and move business logic into services.

Do not split files mechanically if it makes the system harder to understand. The 200-line limit is a maintainability guard, not a license for needless indirection.

### No enhanced copies

NEVER create new "enhanced" or "v2" files. ALWAYS update existing files directly.
WHY: Duplicate files obscure the canonical implementation.

## Code Quality

### Compilation

ALWAYS run the compile/build command after creating or modifying a code file.
WHY: Immediate compile/build checks catch cascading failures early.
Check: zero compilation errors before proceeding.

For this toolkit itself, the default commands are:

- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`

For downstream projects, prefer commands documented in that project's `README.md`, `CLAUDE.md`, or `docs/`.

### Real implementation only

NEVER simulate, mock, or stub implementation code to pass tests or CI.
WHY: Mocks hide real integration failures that surface in production.
Implement real code and use test databases/services.

### Tests must pass (if tests exist)

NEVER finish a session with failing tests. Fix all failures before completing.
WHY: Leftover failures erode trust in the test suite.
Escalate after 3 failed fix attempts (per tdd-rules.md).

**Default mode (TDD-optional):** This rule applies IF tests exist in the repo. There is no requirement to create tests for new code in default mode — that's controlled by `tdd-rules.md`, which is opt-in via `MEOWKIT_TDD=1` or `--tdd`. A repo with zero tests is permitted; the reviewer may flag missing tests as a WARN at Gate 2.

**Strict mode (`MEOWKIT_TDD=1` / `--tdd`):** Tests must exist AND pass. The `pre-implement.sh` hook enforces failing-test-first; the rules in `tdd-rules.md` "When TDD is enabled" apply.

NEVER ignore failing tests, delete tests, weaken assertions, or introduce fake data solely to pass CI.

Address the root cause, then re-run the relevant checks.

## Pre-Commit Rules

### Before every commit

1. Run linting — zero lint errors
2. Run tests — all tests pass IF tests exist (default mode tolerates zero-test repos; `pre-ship.sh` already skips the test check when `package.json` has no `"test"` script)
3. Verify no confidential files are staged (`.env`, credentials, API keys)

### Commit format

ALWAYS use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
NEVER include AI references in commit messages.
NEVER push to main/master directly — use feature branches and PRs.

### Git safety

NEVER force-push unless the user explicitly requests it.
ALWAYS commit frequently with descriptive messages.
ALWAYS pull before push to catch merge conflicts early.

## Documentation Impact

After completing implementation tasks, ALWAYS declare docs impact:

- `Docs impact: none` — no documentation changes needed
- `Docs impact: minor` — update existing docs
- `Docs impact: major` — new documentation required

WHY: Docs impact keeps future sessions aligned.

### Documentation updates

When docs impact is `minor` or `major`, update documentation in the same PR:

- `docs/project-context.md` — conventions, stack, anti-patterns loaded by agents
- `docs/project-overview.md` — product/system overview
- `docs/architecture/system-architecture.md` — architecture and component relationships
- `docs/code-standards.md` — code conventions and examples
- `docs/deployment-guide.md` — release/deploy instructions
- `docs/development-roadmap.md` — roadmap phase and milestone progress, when present
- `docs/project-changelog.md` — significant features, fixes, security updates, and breaking changes

If a project uses a different documented docs layout, follow that layout instead.

After shipping feature work, prefer `mk:document-release`; for a project with no docs, use `mk:docs-init`.

## Tool Output Limits

ALWAYS apply default output limits to prevent context bloat at source.
PostToolUse hooks cannot truncate tool output (hooks append, not replace).
Instead, prevent bloat by limiting output at the tool call site.

| Tool | Default Limit                                 | Override                                           |
| ---- | --------------------------------------------- | -------------------------------------------------- |
| Glob | `head_limit=50`                               | Increase only when explicitly needing more results |
| Grep | `head_limit=20` per query                     | Increase for comprehensive searches                |
| Read | `offset` + `limit` for files >500 lines       | Read full file only when necessary                 |
| Bash | Pipe through `head -100` for verbose commands | Skip for commands with concise output              |

WHY: Limiting output at source prevents context bloat without platform changes.
