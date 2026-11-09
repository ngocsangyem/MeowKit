# Ship-set reader greps

Every path excluded from the published kit artifact, with the search that found its referrers and
whether each referrer ships. The rule: a path is excluded only when nothing that ships reads it, or
when the referrer is excluded with it as one unit.

Commands were run from the repository root. `.claude/worktrees/` matches are ignored throughout —
that directory is itself excluded, so a reference from inside it is not a shipped reference.

| Excluded path | Grep | Referrers | Ship? | Verdict |
|---|---|---|---|---|
| `.claude/settings.json.bak` | `grep -rn "settings.json.bak" .claude packages scripts` | `packages/mewkit/src/migrate/discovery/exclusions.ts` (already excludes it during user-tree discovery) | referrer is CLI source, not kit content | excluded alone |
| `.claude/.brand-allowlist.txt` | `grep -rln "brand-allowlist" .claude .github tests` | `.claude/scripts/lint-brand-prose.sh`, `tests/changed-files-lint.test.sh`, `.github/workflows/ci.yml` | the first SHIPS; the other two are repo-only | excluded **as one unit** with both shipped scripts below — the data alone would ship a script that fails on a missing file |
| `.claude/scripts/lint-brand-prose.sh` | `grep -rln "lint-brand-prose" .claude .github tests` | `.github/workflows/ci.yml` (repo-only) | no shipped referrer | same unit |
| `.claude/scripts/check-anthropic-context.py` | `grep -rln "check-anthropic-context" .claude .github` | `.github/workflows/ci.yml` (repo-only) | no shipped referrer | same unit — it reads the allowlist too |
| `.claude/benchmarks/results/*` | `grep -rln "benchmarks/results" .claude` | `.claude/skills/benchmark/scripts/*` write into it | writers ship; the OUTPUT does not | only `results/` excluded |
| `.claude/eval/*` (`track-m-adapter-core.cjs`) | `grep -rln "track-m-adapter-core" .claude` | `.claude/skills/brainstorming/eval/run-scenarios.cjs`, `.claude/skills/prompt-enhancer/eval/run-canaries.cjs` | both SHIP and `require` it | excluded **as one unit** with every `.claude/skills/*/eval/` — excluding either side alone leaves a broken `require` |
| `.claude/skills/*/eval/*` | `grep -rln "/eval/" .claude/skills` | `prompt-enhancer/eval/run-canaries.test.cjs` runs in CI from the repo | repo-only | same unit |
| `*/__tests__/*`, `*/tests/*`, `*.test.*` | `grep -rn "__tests__\|/tests/" .github/workflows/ci.yml` | CI runs them from the **repo** (`ci.yml`); vitest deliberately skips `.claude/**/*.test.cjs` | repo-only | excluded from the artifact only |

## Narrowed rather than applied as written

Three exclusions were narrowed because the greps changed the answer. Each is stated rather than
done quietly.

1. **`.claude/benchmarks/` → `.claude/benchmarks/results/` only.** `canary/` and the README are the
   input corpus of a **user-invocable** skill (`/mk:benchmark`), read by
   `.claude/skills/benchmark/{SKILL.md,scripts/run-canary.sh,scripts/git-index-audit.sh,scripts/compare-runs.sh}`
   and by `.claude/scripts/rules-audit.sh`. A skill's input corpus is product content, not a
   maintainer artifact. Only the run output is excluded.
2. **`.claude/eval/` is excluded only together with every `.claude/skills/*/eval/`.** Excluding the
   shared adapter alone would ship two skills whose `require` resolves to nothing.
3. **`.brand-allowlist.txt` is excluded only together with both scripts that read it.** Excluding
   the data alone would ship two scripts that fail on a missing file.

## Kept deliberately

| Path | Why |
|---|---|
| `workflow.yaml` | `grep -rl "workflow.yaml" .claude` → 35 shipped files read it (rules, `cook`, `autobuild`, `workflow-orchestrator`) |
| `.claude/benchmarks/canary/`, `.claude/benchmarks/README.md` | the benchmark skill's input corpus, above |

## Nothing is removed from the repository

`git ls-files | grep -cE "\.claude/eval/|\.claude/\.brand-allowlist|\.claude/scripts/lint-brand-prose|\.claude/benchmarks/|__tests__|\.test\."`
→ **360** tracked files still match. The exclusions are from the **artifact**, so CI keeps running
every test, eval and benchmark from the repository.
