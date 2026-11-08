# Simplify pass — lazy-Python working tree

Scope: uncommitted new/changed code (TS core + `skill env` command, `.claude/scripts` node ports, no-python harness, port-corpus recorder, benchmark/trace-analyze `.cjs`). `tasks/plans/` untouched. Behavior, output text, exit codes, flags, file names, golden corpora unchanged.

## Changes

| File | Change |
|---|---|
| `packages/mewkit/src/core/skill-env.ts` | removed dead `pythonSkills()` (no caller anywhere) |
| `packages/mewkit/src/commands/skill-env.ts` | removed dead `remediationCommand()` and unused `export { envPythonPath, skillEnvDir }` re-export (+ now-unused `envPythonPath` import) |
| `.claude/scripts/injection-audit.cjs` | dropped unused `projectRoot` param of `reportDirectory`; redundant `isDir = false` in catch replaced by a why-comment |
| `scripts/lib/no-python-checks.cjs` | removed plan-artifact reference from header ("sprint contract; phase 06"); single-use `verbLabel` inlined; its misplaced review/advice rationale moved to the `tolerateUsage` branch it explains |
| `scripts/lib/port-corpus-env.cjs` | removed dead `portEnv()` and the `pinnedEnv` / `PINNED_PATH` imports + re-export it alone needed; header comment corrected ("two extra normalizers" -> one, `logStamp`) |
| `.claude/skills/benchmark/scripts/lib/render-run-delta.cjs` + codex/cursor mirrors | `nA`/`nB` always incremented together -> one `scored` counter; mirrors kept byte-identical; output diffed identical on a sample with PENDING rows |

## Skipped (debatable)

- Unused exports on library modules (`injection-audit-core`: `finding`, `toLines`, `resolveLoose`, `scanContent`; `workflow-config-core`: `CANONICAL_REL`, `LEGACY_REL`) — library surface, cheap to keep.
- Skill-name regex duplicated in `core/skill-env.ts` and `commands/skill-env.ts` — different error paths (throw vs. user message).
- `check-plan-structure.ts` limits vs. message text (100 vs "max 80", 200 vs "max 150") — pinned output, port parity.
- `skill-python.cjs` — mirrored with provider rewrites; nothing worth changing.

## Verify

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | 0 errors, 3 warnings (capabilities.ts, orient.ts, validate.ts — untouched files) |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | 251 files / 2894 tests passed (no flake this run) |
| `node --test .claude/hooks/__tests__/*.test.cjs` | 36/36 pass |
| `mewkit doctor` | exit 0 — 14 pass, 3 warn |
| `mewkit validate` | exit 0 — 40 pass, 34 warn, 1 n/a |
| `mewkit inventory --check` | exit 0 |
| `node scripts/check-no-python.cjs --allow-existing-envs` | 28/28 ok (tolerated envs: evaluate, figma, multimodal, scale-routing, web-to-markdown) |
| `bash tests/fixtures/plan-creator/validate-fixtures.sh` | 8 passed, 0 failed |

## Unresolved questions

None.
