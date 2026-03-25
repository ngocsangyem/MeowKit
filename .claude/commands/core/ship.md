# /ship — Phase 5: Ship Pipeline

## Usage

```
/ship
/ship --canary
/ship --dry-run
```

## Behavior

Triggers Phase 5. Runs the `ship-pipeline` skill. Will NOT execute if Gate 2 (review) has not passed.

### Pre-Conditions

Before any shipping action:
- Verify a passing verdict file exists at `tasks/reviews/YYMMDD-name-verdict.md`
- Verify no FAIL dimensions and no unacknowledged WARNs
- Verify security scan shows no BLOCK items
- If any pre-condition fails: print what's missing and refuse to ship

### Execution Steps

1. **Pre-ship checks.**
   - All tests pass (run full test suite).
   - No uncommitted changes (working tree clean).
   - Branch is up to date with remote.
   - Gate 2 verdict file exists and is passing.

2. **Create conventional commit.**
   - Analyze changes to determine commit type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
   - Generate commit message following conventional commit format:
     ```
     type(scope): description

     Body with details if needed.
     ```
   - Include breaking change footer if applicable.

3. **Create Pull Request.**
   - Push branch to remote.
   - Create PR with: title from commit message, body with summary of changes, link to plan file, link to verdict file.

4. **Verify CI.**
   - Wait for CI pipeline to complete.
   - If CI fails: parse logs, report the failure, do NOT merge.
   - If CI passes: report success.

5. **Document rollback plan.**
   - Print rollback instructions specific to the change:
     ```
     🐱 Rollback: git revert <commit-sha> && git push
     ```
   - For database migrations: include down-migration command.
   - For infrastructure changes: include revert steps.

### Flags

| Flag | Behavior |
|------|----------|
| `--canary` | Staged rollout. Routes to `/canary` for deployment with monitoring checklist and promotion/rollback decision. |
| `--dry-run` | Preview everything that would happen (commit message, PR body, files included) without actually pushing or creating the PR. |

### Output

- Conventional commit created
- PR created (with URL printed)
- CI status reported
- Rollback plan documented
