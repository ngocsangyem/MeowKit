---
source: claudekit-engineer
original_file: development-rules.md
adapted: yes
adaptation_notes: >
  Merged highest-scoring rules from development-rules.md, primary-workflow.md,
  and team-coordination-rules.md. Added WHY explanations per
  rule-writing principle #2. Paired every NEVER with an INSTEAD per principle #1.
---

# Development Rules

These rules apply to all implementation work in MeowKit.

## File Management

### File naming

ALWAYS use kebab-case for file names with descriptive names.
WHY: LLM tools (Grep, Glob) must understand file purpose from names alone.
INSTEAD of: `userAuth.ts` → use: `user-authentication.service.ts`

### File size

ALWAYS keep code files under 200 lines.
WHY: Shorter files fit in context windows and reduce merge conflicts.
INSTEAD of one large file → split into focused modules by concern.

### No enhanced copies

NEVER create new "enhanced" or "v2" files. ALWAYS update existing files directly.
WHY: Duplicate files create confusion about which is canonical. The git history tracks changes.

## Code Quality

### Compilation

ALWAYS run the compile/build command after creating or modifying a code file.
WHY: Catching syntax errors immediately prevents cascading failures.
Check: zero compilation errors before proceeding.

### Real implementation only

NEVER simulate, mock, or stub implementation code to pass tests or CI.
WHY: Mocks hide real integration failures that surface in production.
INSTEAD of mocks → implement real code, use test databases/services.

### Tests must pass (if tests exist)

NEVER finish a session with failing tests. Fix all failures before completing.
WHY: Broken tests left behind become ignored and erode the test suite.
Escalate after 3 failed fix attempts (per tdd-rules.md).

**Default mode (TDD-optional):** This rule applies IF tests exist in the repo. There is no requirement to create tests for new code in default mode — that's controlled by `tdd-rules.md`, which is opt-in via `MEOWKIT_TDD=1` or `--tdd`. A repo with zero tests is permitted; the reviewer may flag missing tests as a WARN at Gate 2.

**Strict mode (`MEOWKIT_TDD=1` / `--tdd`):** Tests must exist AND pass. The `pre-implement.sh` hook enforces failing-test-first; the rules in `tdd-rules.md` "When TDD is enabled" apply.

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

WHY: Undocumented changes create knowledge gaps for future sessions.

## Tool Output Limits

ALWAYS apply default output limits to prevent context bloat at source.
PostToolUse hooks cannot truncate tool output (hooks append, not replace).
Instead, prevent bloat by limiting output at the tool call site.

| Tool | Default Limit | Override |
|------|--------------|----------|
| Glob | `head_limit=50` | Increase only when explicitly needing more results |
| Grep | `head_limit=20` per query | Increase for comprehensive searches |
| Read | `offset` + `limit` for files >500 lines | Read full file only when necessary |
| Bash | Pipe through `head -100` for verbose commands | Skip for commands with concise output |

WHY: Unbounded tool output consumes 14-70% of context window per research measurements.
Limiting at source is behavioral (agent compliance) but achievable immediately without platform changes.
