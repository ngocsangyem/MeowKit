# Runtime evidence — 261102 meowkit-v3-lean-runtime, sprint 2

Contract: `tasks/contracts/261102-0031-meowkit-v3-lean-runtime-sprint-2.md`
Captured: 2026-11-02 (UTC) · branch `feat/v3-lean-runtime`, all changes **staged, not committed**
Captured by: evaluator (active verification). Nothing in the repo was modified; every run
targeted a scratch dir under the session scratchpad.

## Verdict table

| Sub-check | What it asserts | Result | Evidence |
| --- | --- | --- | --- |
| AC-08(a) | Release archive + manifest contain no root `CLAUDE.md` | **PASS** | [ac08a-release.txt](ac08a-release.txt) |
| AC-08(b) | Fresh init creates no `CLAUDE.md`; `.claude/rules` has exactly 7 files | **PASS** | [ac08b-init.txt](ac08b-init.txt) |
| AC-08(c) | `validate` + install validation fail for neither a missing `CLAUDE.md` nor 7 rules | **PASS** | [ac08c-validate.txt](ac08c-validate.txt) |
| AC-09 (user-project half) | docs-reference check reports N/A; `context-budget` always-on total has no `CLAUDE.md` term | **WARN** | [ac08c-validate.txt](ac08c-validate.txt) §3 |
| AC-08(d) | v2-shaped upgrade: pristine moved rules removed, modified one kept + reported, `CLAUDE.md` byte-identical, no new migration module | **PASS** | [ac08d-upgrade.txt](ac08d-upgrade.txt) |
| AC-10 | Hooks re-inject none of the 19 moved rule names, nor `CLAUDE.md` as a required file; safety-baseline marker still appears | **FAIL** | [ac10-hooks.txt](ac10-hooks.txt) |
| AC-11 (partial) | Codex + Cursor bundles generate and validate; each `AGENTS.md` carries the Compaction Policy and gate/security pointers | **PASS** | [ac11-targets.txt](ac11-targets.txt) |

## The one FAIL — AC-10

`.claude/hooks/project-context-loader.sh:216-220` scores a project out of 5 and counts a
root `CLAUDE.md` as one of the 5 required items. In a fresh v3 install — which by design
ships no `CLAUDE.md` — SessionStart now prints on **every** session:

```
## Agent Readiness: 0/5
Missing: CLAUDE.md project-context test-cmd lint-cmd typecheck
```

AC-10 requires 0 matches for `CLAUDE.md` as a required file. There is 1.

**This is a regression introduced by this sprint, not pre-existing.** On `main` the kit
shipped a root `CLAUDE.md` (`generate-release-manifest.cjs` `INCLUDE_FILES`,
`prepare-release-assets.cjs` `archiveTargets`, and `smart-update.ts:234-240` copied it on
install), so the item was satisfied and the string never appeared. The sprint removed all
three producers and left the hook untouched (`git diff --cached --name-only | grep -c
project-context-loader` → 0). A correctly-installed v3 project can never exceed 4/5.

Fix guidance: drop the `CLAUDE.md` readiness item and set `READY_MAX=4`, or re-point the
check at the always-on rule set (`ALWAYS_ON_RULES` in
`packages/mewkit/src/core/always-on-rules.ts`) the way `validate` already does.

The other two AC-10 checks pass: 0 matches across all 19 moved rule basenames, and the
safety-baseline marker is emitted (with the PreCompact re-arm correctly withholding it).

## The WARN — AC-09 user-project `context-budget`

`mewkit budget context` exits 1 in a fresh install: `Context budget requires
.claude/pack-manifest.json`. The archive ships `.meowkit/pack-manifest.json`, but
`smart-update.ts` copies only `sourceDir/.claude` (:135) and `sourceDir/tasks` (:212), so
a fresh install never receives it.

**Pre-existing, not caused by this sprint** — `main` resolves the manifest path identically
and copies the same two trees, so a fresh install from `main` fails the same way. It is
also *not* a failure "for a missing `CLAUDE.md`" or "for having 7 rules", so **AC-08(c) as
worded still passes**; only the AC-09 `context-budget`-in-a-user-project clause is
unsatisfiable as written, on this branch and on `main` alike.

With the manifest supplied by hand, the content assertion passes: always-on = 7 files /
377 lines / 6,336 tokens in every profile, and the tier legend reads `always-on (rules)`
with no `CLAUDE.md` term (was `CLAUDE.md + rules`). Installed rule bytes total 25,522.

## Two contract-wording notes for the reviewer

1. **AC-09 names a command that does not exist.** The contract says `mewkit context-budget`;
   the real verb is `mewkit budget context`. There is no `context-budget` top-level command.
2. **AC-11's "Compaction" grep is misleading on Cursor.** A case-sensitive grep for
   `Compaction` matches codex (`## Compaction policy`) but not cursor, whose heading is
   `## Gates, security and compaction`. The required *content* — the "ALWAYS preserve
   verbatim" list — is present in both. Do not fail Cursor on the literal grep. (This
   sprint *added* that section to the Cursor bundle; `main` had no such section.)

## How the runs were driven, and why

`mewkit init` resolves `targetDir = process.cwd()` (`init.ts:682`) and installs a
**published GitHub release** (`fetchReleases` → `downloadRelease` → `smartUpdate` →
`validate`), so the binary cannot exercise the local branch kit. Every install here drives
the same `smartUpdate()` from `packages/mewkit/dist/` with an explicit scratch `targetDir`
and a local `sourceDir`, via `<scratchpad>/ac-evidence/drive-init.cjs`, which hard-refuses
any target path outside the scratch tree. No network was used.

- **Kit assets** — the two release scripts are cwd-rooted with no out-dir flag, so they ran
  with cwd set to a scratch copy of `.claude`, `tasks`, `scripts`,
  `packages/mewkit/package.json`, `.meowkit/pack-manifest.json`, `deletions.json`. The copy
  excludes `.claude/worktrees` (a git-ignored dev worktree carrying `node_modules`, which
  `zip -r` would otherwise walk — it inflated a first attempt past 1.1 GB) and
  `.claude/skills/.venv`.
- **Fresh init** — `sourceDir` = the AC-08(a) archive extracted; `targetDir` = empty dir.
- **v2-shaped upgrade** — `git archive b225a319 .claude tasks` as the v2 source (all 25 BASE
  rules = 6 survivors + the 19 moved; `meowkit-core.md` is new in v3), installed first so
  genuine install metadata with real checksums exists, then one moved rule user-modified and
  a user-written root `CLAUDE.md` added, then upgraded from the local v3 kit. Result: 18
  pristine moved rules deleted, `rules/harness-rules.md` kept and reported via
  `deletionsSkipped`, `CLAUDE.md` byte-identical (sha256
  `9a069f12…53d2` before and after). Only the pre-existing update / deletion-list /
  orphan-cleanup path was used; no `--force`.
- **Codex / Cursor** — `init --target codex|cursor` are offline paths that read the bundle
  from the repo's `dist/` and write to cwd; both ran in empty scratch dirs with
  `</dev/null`.

Clean-`main` baseline by running a CLI was **not captured**: `git archive main
packages/mewkit` yields no `dist/` (build output, untracked) and no `node_modules`, so no
CLI is runnable without a build. A static baseline settled the one Codex WARN instead
(`allowedPermissionValues` appears in 0 files in both main's and the branch's codex bundle,
and the sprint touches no Codex hook wrapper or `config.toml`) — the WARN is pre-existing.

## Repo cleanliness

`git status --short | grep -vE '^[MADR]  '` after all runs reported only
`?? tasks/plans/261101-meowkit-v3-lean-runtime/` and `?? tasks/reviews/evidence/`
(this directory). No tracked file was edited; no git mutation was run.
