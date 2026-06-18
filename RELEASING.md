# Releasing MeowKit

Complete guide to building, tagging, and publishing MeowKit releases.

## Architecture

```
Source of truth (.claude/, tasks/, CLAUDE.md)
    ↓
prepare-release-assets.cjs → dist/meowkit-release.zip
    ↓
GitHub Release (tag + zip asset)
    ↓
mewkit CLI fetches zip at npx mewkit init
```

**Key insight:** `mewkit` CLI downloads `meowkit-release.zip` from GitHub Releases at runtime. If the release has no zip asset, the CLI cannot find it and falls back to an older version.

## Version Channels

| Branch | npm Tag   | GitHub Release | Example         |
| ------ | --------- | -------------- | --------------- |
| `main` | `@latest` | Stable         | `v1.2.0`        |
| `dev`  | `@beta`   | Pre-release    | `v1.3.0-beta.1` |

## Quick Release (Script)

For standard releases, use the release script:

```bash
./scripts/release.sh <version> "<release title>"
```

Example:

```bash
./scripts/release.sh 2.3.2 "The Agent-Skills Integration Release"
```

The script automates steps 3-9 below: bump version → build/lint/typecheck/test → prepare release assets → VitePress build check → commit + tag → push → create GitHub Release with zip. Stops on any failure, warns on uncommitted changes.

**Before running the script:** Complete step 2 (update CHANGELOG) manually. If the release affects guide/reference pages, complete step 1a as well. If a new agent or skill landed, complete step 1b (routing surfaces) too.

**After the script:** Run step 10 (npm publish) and step 11 (end-to-end test) manually.

## Manual Release (Step-by-Step)

### 1. Update CHANGELOG and affected docs

Update the changelog and any affected guide/reference pages BEFORE tagging.

**Patch releases:** Only update `website/changelog.md` (step 2). Skip the doc update step below unless a guide page documents behavior that changed.

#### 1a. Update affected guide pages

Check and update these pages if the release affects them:

| Page                                | Update when                                      |
| ----------------------------------- | ------------------------------------------------ |
| `guide/memory-system.md`            | Memory schema, capture, or consolidation changes |
| `guide/workflow-phases.md`          | Phase behavior changes (new steps, hook changes) |
| `guide/agent-skill-architecture.md` | New skills, agents, or Mermaid diagram changes   |
| `guide/model-routing.md`            | Model tier or routing changes                    |
| `reference/agents/*.md`             | Agent capability changes                         |
| `reference/skills/*.md`             | Skill behavior or schema changes                 |

#### 1b. Update agent and skill routing (when new agents/skills land)

When a release adds a new agent or skill, update the routing surfaces so the orchestrator and `mk:help` can recommend it.

| File                                                            | Update when                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.claude/agents/SKILLS_INDEX.md`                                | New skill — add a row in the matching phase or "Cross-Cutting (Any Phase)" table                                            |
| `.claude/agents/AGENTS_INDEX.md`                                | New agent — add a row to the active-agents table (Type, Role, Source, phases, auto-activate, CE version)                    |
| `.claude/rules/agent-routing.md`                                | New core/support agent — add to the 17-row table; new domain agent → add to the hub-skill family row                        |
| `.claude/skills/agent-detector/references/lifecycle-routing.md` | New skill that maps to a user signal — add a Discovery Tree row                                                             |
| `.claude/skills/scale-routing/data/domain-complexity.csv`       | New domain match (fintech, healthcare, etc.) — add a row with signals + level + workflow                                    |
| `website/.vitepress/config.ts`                                  | New skill or agent — add to the matching sidebar group under `reference/skills/*` or `reference/agents/*`                   |
| `website/reference/skills/<name>.md`                            | New skill — create the reference page (use an existing skill page as a template; keep it under 800 lines per `docs.maxLoc`) |
| `website/reference/agents/<name>.md`                            | New agent — create the reference page                                                                                       |

Skip rows that don't apply to the current release. The matrix is a checklist, not a mandate to edit every file.

#### 1c. Verify VitePress builds

```bash
cd website && npx vitepress build
```

Must complete with no errors. Chunk size warnings are normal.

#### 1d. Update portable migration manifest when paths move

Check `packages/mewkit/portable-manifest.json` whenever a release moves source files or provider install paths used by `mewkit migrate`.

- Add a `renames` entry when a shipped `.claude/` source item moves or is renamed.
- Add a `providerPathMigrations` entry when a target provider path changes, such as moving Codex skills to a new directory.
- Do not add entries for new files, deleted files, provider capability changes, or invented history.
- Keep release checksum manifests, provider manifests, and `portable-manifest.json` separate; they serve different purposes.
- Do not copy `portable-manifest.json` into `.claude/`. It is an npm package artifact shipped with `packages/mewkit`, not part of the project kit that `npx mewkit init` scaffolds.
- If a release changes `packages/mewkit`, make sure `packages/mewkit/package.json` includes `portable-manifest.json` in `files` and publish the npm package. The GitHub release zip used by `npx mewkit init` only contains `.claude/`, `tasks/`, `CLAUDE.md`, and `release-manifest.json`.

### 2. Update CHANGELOG (`website/changelog.md`)

> **Note:** Root `CHANGELOG.md` is a stub that points at `website/changelog.md` (the live source). Edit `website/changelog.md`.

Add a new version section at the **top** (just below the `## Upgrade` block). Use the schema below — only include sections that have content. Empty sections are dropped, not stubbed.

#### Section schema (in this order)

| Section                | When to include                                                   | Format                                                                                       |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `### Highlights`       | Always for feature/breaking releases. Optional for patches.       | 1–3 sentences. State the user-visible thesis of the release. No file paths, no internal IDs. |
| `### New Skills`       | Whenever ≥1 new skill ships.                                      | Markdown table: `\| Skill \| Purpose \|`                                                     |
| `### New Agents`       | Whenever ≥1 new agent ships.                                      | Bullet list: `- ``agent-name`` — purpose.`                                                   |
| `### New Commands`     | Whenever ≥1 new slash command ships.                              | Bullet list: `- ``/command`` — purpose.`                                                     |
| `### CLI`              | Whenever `mewkit` CLI changes.                                    | Bullet list.                                                                                 |
| `### Features`         | New user-facing functionality not covered by the New-\* sections. | Bullet list.                                                                                 |
| `### Improvements`     | Refactors, ergonomics, perf, prunes that the user notices.        | Bullet list.                                                                                 |
| `### Removals`         | Deletions, deprecations, renames.                                 | Bullet list. State migration path inline.                                                    |
| `### Bug Fixes`        | All user-visible fixes.                                           | Bullet list. State the symptom + the fix briefly.                                            |
| `### Beta`             | Opt-in / experimental features (env var or flag-gated).           | Bullet list. State the opt-in mechanism.                                                     |
| `### Migration Notes`  | Only if user action is required.                                  | Bullet list. Include the exact command or env var.                                           |
| `### Breaking Changes` | Only if there are any.                                            | Bullet list. State the before/after behavior.                                                |

#### Style rules (DRY: enforced by these rules, not duplicated everywhere)

- **One sentence per bullet** unless an env var table or migration command is needed.
- **No internal IDs** in published bullets — drop `RT-C1`, `M2`, `CF3`, `RF-14`, `phase-XX`, `[CHM]<n>`. They belong in commit messages, not the changelog.
- **No test counts** (e.g. "40 passed / 3 todo") — that is CI noise, not a user-impact signal.
- **No audit metadata** ("5 parallel red-team teams audited 78 skills, 64 findings dedup'd") — summarize the _outcome_ in Highlights and let bullets describe what changed.
- **No file counts** ("286 lines, 11 sections, 16 agents wired") — describe what the user gets, not how big the diff was.
- **No internal plan-directory paths** (`plans/260411-1906-...`).
- **No `**bold:**` prefix per bullet.** Sentence-case content is enough; bold is reserved for skill / command / agent names referenced inline (use backticks, not bold).
- **Em dash `—`** between subject and explanation. Hyphens are for compound words.
- **CLI commands in fenced blocks** when ≥3 chars or a flag combination. Inline backticks for short ones (`mewkit doctor`).
- **Env vars in tables** when ≥2 are introduced in the same release.
- **Section dividers `---`** between major versions only, not minor patches.

#### Patch vs. minor vs. major releases

| Release type    | Required sections                                                                      | Optional sections                       |
| --------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| Patch (`x.y.Z`) | At least one of: `Bug Fixes`, `Improvements`                                           | `Highlights` (only if non-trivial), CLI |
| Minor (`x.Y.0`) | `Highlights` + at least one of: `Features`, `New Skills`, `New Agents`, `New Commands` | All others                              |
| Major (`X.0.0`) | `Highlights` + `Breaking Changes` + `Migration Notes` (if action required)             | All others                              |

#### What goes in `Highlights` vs `Features`

- **Highlights** is the elevator pitch — _what changed in this release at the level the user cares about_. 1–3 sentences. No bullets.
- **Features** is the granular list of additions. Bullets, one per addition.

If you only have one feature and it's the whole release, put it in **Highlights** as prose and skip **Features**.

#### Worked example

```markdown
## 2.5.0 (YYYY-MM-DD) — Release Title

### Highlights

One-paragraph user-facing thesis. State what shipped and why a user
would want it.

### New Skills

| Skill        | Purpose           |
| ------------ | ----------------- |
| `mk:example` | One-line purpose. |

### Features

- `--new-flag` — what it does.
- New env var `MEOWKIT_THING` — purpose, default value.

### Improvements

- Existing thing X now does Y instead of Z.

### Bug Fixes

- Symptom — fix.

### Migration Notes

- `npx mewkit upgrade` to pick up the new defaults.
```

### 3. Bump versions

#### When to bump

Only bump `packages/mewkit` when the release ships **changes inside `packages/mewkit/src/`**. Edits to `.claude/`, `tasks/`, `CLAUDE.md`, the website, or rules do NOT require a CLI version bump — those ride out via the release zip and `npx mewkit upgrade`.

```bash
# Decide first — does this release touch CLI code?
git diff --name-only HEAD~1 -- packages/mewkit/src
```

If the command prints nothing, skip step 3 entirely. The release proceeds at the existing CLI version.

#### How to choose the bump (SemVer)

Map the size of the change inside `packages/mewkit/src/` to a SemVer field:

| Change shape                                                                                                                       | Bump                  | Example         | New version from `2.8.5` |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------- | ------------------------ |
| Minor edits — bug fix, log tweak, refactor that preserves CLI surface                                                              | patch (last number)   | `2.8.5 → 2.8.6` | `2.8.6`                  |
| Big changes — new flag, new subcommand, new env var, behavior addition that does NOT remove or rename existing behavior            | minor (middle number) | `2.8.6 → 2.9.0` | `2.9.0`                  |
| Breaking changes — removed flag, renamed subcommand, removed/renamed env var, contract change that an existing script would notice | major (first number)  | `2.9.0 → 3.0.0` | `3.0.0`                  |

Patch resets minor/patch counters according to standard SemVer (`2.x.x → 3.0.0`, never `3.0.5`).

#### Run the bump

```bash
npm -w packages/mewkit version <version> --no-git-tag-version
```

> **Note:** Only bump `mewkit`. Do NOT pass `<version>` if `packages/mewkit/src/` is untouched — skip step 3 instead.

### 4. Build and verify

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

### 5. Build release assets

```bash
node scripts/prepare-release-assets.cjs "<version>"
```

This creates:

- `.claude/metadata.json` — version metadata
- `release-manifest.json` — SHA-256 checksums for all files
- `dist/meowkit-release.zip` — the release package (`.claude/` + `tasks/` + `CLAUDE.md` + manifest)

Verify the zip:

```bash
python3 -c "import os,zipfile; z=zipfile.ZipFile('dist/meowkit-release.zip'); print(f'Size: {os.path.getsize(\"dist/meowkit-release.zip\")/1024:.0f} KB, Files: {len(z.namelist())}')"
```

### 6. Commit and tag

```bash
git add -A
git commit -m "chore: release v<version>"
git tag -a v<version> -m "v<version> — <release title>

<Brief description of what changed>"
```

### 7. Push to GitHub

```bash
git push origin main
git push origin v<version>
```

### 8. Create GitHub Release with zip

**This is the critical step.** The zip file MUST be attached as a release asset.

````bash
gh release create v<version> dist/meowkit-release.zip \
  --title "v<version> — <release title>" \
  --notes-file - <<'NOTES'
## <Release Title>

<Release notes in markdown>

### Install

```bash
npx mewkit init
# or upgrade:
npx mewkit upgrade
````

Upload separately:

```bash
gh release create v<version> --title "..." --notes "..."
gh release upload v<version> /tmp/meowkit-v<version>.zip --clobber
```

### 9. Verify the release

```bash
# Check tag exists
git tag | grep v<version>

# Check zip is attached
gh release view v<version> --json assets -q '.assets[].name'
# Must show: meowkit-release.zip or meowkit-v<version>.zip

# Check release URL
gh release view v<version> --json url -q '.url'
```

### 10. Publish to npm (only if step 3 ran)

Skip this step entirely if `packages/mewkit/src/` was not touched in this release. `npm publish` against an unchanged version errors out, and republishing the same code at a new version pollutes the registry.

```bash
npm -w packages/mewkit publish
```

> **Note:** Only publish `mewkit`. Tag with `--tag beta` for pre-releases on the `dev` branch.

### 11. Test end-to-end

```bash
npx mewkit init test-project
# Should scaffold using the new version
```

## Release Checklist

Copy this checklist for each release:

```markdown
## Release v<version> Checklist

### Docs

- [ ] Updated affected guide/reference pages (step 1a)
- [ ] If a new agent or skill landed: updated routing surfaces (step 1b — `SKILLS_INDEX.md`, `AGENTS_INDEX.md`, `agent-routing.md`, `lifecycle-routing.md`, sidebar config, reference page)
- [ ] VitePress build passes (`npx vitepress build`)

### Changelog

- [ ] Added v<version> section to `CHANGELOG.md`

### Version

- [ ] Checked `git diff --name-only HEAD~1 -- packages/mewkit/src` — empty means SKIP step 3 and step 10
- [ ] If `packages/mewkit/src/` changed: chose patch / minor / major bump per the SemVer table in step 3
- [ ] Ran `npm -w packages/mewkit version <version>` (or skipped because src untouched)

### Build

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

### Release

- [ ] `prepare-release-assets.cjs` ran successfully
- [ ] `dist/meowkit-release.zip` exists with expected size
- [ ] Committed and tagged
- [ ] Pushed to GitHub (commits + tag)
- [ ] GitHub Release created with zip asset
- [ ] Release notes include install instructions
- [ ] If CLI was bumped: `npm -w packages/mewkit publish` ran (else step 10 skipped)

### Verify

- [ ] `gh release view v<version>` shows asset
- [ ] `npx mewkit init` scaffolds new version correctly
```

## Automated Release (CI/CD)

Push to `main` or `dev` triggers `.github/workflows/release.yml`:

1. Semantic-release analyzes conventional commits → determines version bump
2. `sync-package-versions.cjs` syncs version across both packages
3. `prepare-release-assets.cjs` builds zip + metadata + manifest
4. `@semantic-release/github` creates GitHub Release with zip asset
5. `@semantic-release/exec` publishes both packages to npm
6. `@semantic-release/git` commits version files back to repo

**Note:** Automated releases do NOT update `CHANGELOG.md` or affected guide/reference pages. Those must be done manually before the release commit.

### Conventional commits → version bumps

The CI mapping below applies to `.claude/`, `tasks/`, and `CLAUDE.md` content. The CLI follows the same SemVer fields, but it only bumps when `packages/mewkit/src/` changes — see step 3.

```
feat: new skill            → MINOR (1.0.0 → 1.1.0)
fix: skill bug             → PATCH (1.1.0 → 1.1.1)
feat!: breaking change     → MAJOR (1.1.1 → 2.0.0)
chore: cleanup             → no release
docs: update readme        → no release
```

For CLI changes inside `packages/mewkit/src/`:

| Change shape                                                                       | Bump  |
| ---------------------------------------------------------------------------------- | ----- |
| Bug fix, log tweak, refactor that preserves CLI surface                            | patch |
| New flag, new subcommand, new env var, additive behavior                           | minor |
| Removed/renamed flag, removed/renamed subcommand, removed env var, contract change | major |

## Release Scripts

| Script                                  | Purpose                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/sync-package-versions.cjs`     | Sync version across both npm packages                                           |
| `scripts/generate-release-manifest.cjs` | Generate SHA-256 checksums for all release files                                |
| `scripts/prepare-release-assets.cjs`    | Build metadata.json + manifest + dist/meowkit-release.zip                       |
| `scripts/release.sh`                    | Automated release: bump → build → assets → commit → tag → push → GitHub Release |

## Release History

| Version | Date       | Title                                            |
| ------- | ---------- | ------------------------------------------------ |
| v2.11.6 | 2026-06-19 | Merge Conflict Resolution Skill                  |
| v2.11.5 | 2026-06-18 | Long-Horizon Run Hardening                       |
| v2.11.4 | 2026-06-18 | Post-Compaction Safety Re-Arm                    |
| v2.11.3 | 2026-06-14 | Vue 3 Skill Suite                                |
| v2.11.2 | 2026-06-13 | Grill Plan-Interrogation Skill                   |
| v2.11.1 | 2026-06-11 | Ask-Me Project Q&A Skill                         |
| v2.11.0 | 2026-06-11 | Context Tiers + Harness Guardrails               |
| v2.10.3 | 2026-06-10 | Memory + Plan Completion Cleanup                 |
| v2.10.2 | 2026-06-02 | PR Review + Response Skills                      |
| v2.10.1 | 2026-06-02 | Brainstorming Rigor + Prompt Recipes            |
| v2.9.14 | 2026-05-30 | Autobuild rename + mk:loop                       |
| v2.9.13 | 2026-05-30 | Fix Gate Parity & Workflow Evidence Index        |
| v2.9.12 | 2026-05-30 | JSON-first memory + observability cleanup        |
| v2.9.11 | 2026-05-24 | Plan-creator mode clarity                        |
| v2.9.10 | 2026-05-23 | Skill portability + cook context-engineering + provider diagnostics |
| v2.9.9  | 2026-05-23 | Plan-creator determinism + handoff               |
| v2.9.8  | 2026-05-23 | Memory system deep fix                           |
| v2.9.7  | 2026-05-16 | Docs reference contract + validator              |
| v2.9.6  | 2026-05-16 | Context isolation: SessionStart budgeting, agent-detector sentinel, memory auto-prune |
| v2.9.5  | 2026-05-14 | mk:worktree script backing and new commands       |
| v2.9.4  | 2026-05-11 | Agent rules and TOON agent docs                  |
| v2.9.3  | 2026-05-12 | TOON Optimization                                |
| v2.9.2  | 2026-05-11 | Spec-to-tech-breakdown orchestrator              |
| v2.9.1  | 2026-05-11 | Brand-prose neutralization for migrate targets   |
| v2.9.0  | 2026-05-11 | Pre-ticket story sizing                          |
| v2.8.7  | 2026-05-11 | Agile/Scrum Rule Layer                           |
| v2.8.6  | 2026-05-10 | Align rules                                      |
| v2.8.5  | 2026-05-10 | Rules Folder Reconsolidation + mk:preview        |
| v2.8.4  | 2026-05-10 | Confluence Ecosystem + Macro-Aware Spec Analysis |
| v2.8.3  | 2026-05-10 | Jira Family + Workflow Discovery                 |
| v2.8.2  | 2026-05-09 | Prompt Enhancer Output Modes                     |
| v2.8.1  | 2026-05-09 | The Prompt Enhancer Release                      |
| v2.8.0  | 2026-05-09 | The Cleanup & Audit Release                      |
| v2.7.6  | 2026-05-09 | Phase 0 risk checklist                           |
| v2.7.5  | 2026-05-09 | CLAUDE.md trim + reference cleanup               |
| v2.7.4  | 2026-05-02 | Browser skill consolidation                      |
| v2.7.3  | 2026-05-01 | `npx mewkit` resolution fix                      |
| v2.7.2  | 2026-05-01 | Checkpoint subsystem cleanup                     |
| v2.7.1  | 2026-04-30 | Phase Frontmatter Contract                       |
| v2.7.0  | 2026-04-30 | The Namespace Rename Release                     |
| v2.6.2  | 2026-04-29 | The Telemetry & Validator Release                |
| v2.6.1  | 2026-04-22 | The project-manager Release                      |
| v2.6.0  | 2026-04-22 | The Skills Compliance Release                    |
| v2.5.1  | 2026-04-20 | mk:henshin                                       |
| v2.5.0  | 2026-04-19 | The Native Fit Release                           |
| v2.3.4  | 2026-04-11 | Centralized Dotenv Loading                       |
| v2.3.3  | 2026-04-11 | The Wiring Integrity Release                     |
| v2.3.2  | 2026-04-11 | The Agent-Skills Integration Release             |
| v2.3.1  | 2026-04-11 | The Plan Creator Intelligence Release            |
| v1.4.0  | 2026-04-03 | The Plan Intelligence Release                    |
| v1.3.4  | 2026-04-02 | Hook path resolution fix                         |
| v1.3.3  | 2026-04-02 | The Hook Safety Release                          |
| v1.3.2  | 2026-04-01 | The Plan Quality Release                         |
| v1.3.1  | 2026-04-01 | The Red Team Depth Release                       |
| v1.3.0  | 2026-03-31 | The Integration Integrity Release                |
| v1.2.1  | 2026-03-31 | Memory capture enforcement fix                   |
| v1.2.0  | 2026-03-31 | The Memory Activation Release                    |
| v1.1.0  | 2026-03-30 | The Reasoning Depth Release                      |
| v1.0.0  | 2026-03-30 | The Disciplined Velocity Release                 |
| v0.1.2  | 2026-03-29 | Interactive version selection                    |
| v0.1.1  | 2026-03-29 | Runtime dir exclusion fix                        |
| v0.1.0  | 2026-03-29 | Initial pre-release                              |

## Troubleshooting

### CLI fetches wrong version

**Cause:** The target release has no `meowkit-release.zip` asset. The code in `github-releases.ts` filters out releases without a `.zip` asset.

**Fix:** Upload the zip to the release:

```bash
gh release upload v<version> dist/meowkit-release.zip --clobber
```

### Tag already exists

```bash
git tag -d v<version>                    # delete local
git push origin :refs/tags/v<version>    # delete remote
git tag -a v<version> -m "message"       # recreate
git push origin v<version>               # push
```

### npm publish fails with 403

Check you're logged in: `npm whoami`. Check package name isn't taken. Check `publishConfig` in package.json.

### GitHub Release exists but no zip

```bash
gh release upload v<version> dist/meowkit-release.zip --clobber
```

### Semantic-release skips release

No `feat:` or `fix:` commits since last release. Add a commit with the right prefix, or use `--force` on the workflow dispatch.
