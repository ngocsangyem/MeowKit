# Releasing MeowKit

Complete guide to MeowKit releases. A release ships two things under **one version**: the **kit**
(`.claude/` content, a zip) and the **binary** (the native `mewkit` CLI, with `mk` as a short alias).
Releases run in GitHub Actions on two channels: **beta** from `develop` and **stable** from `main`.
Nobody edits a version by hand in a feature PR.

## Architecture

```
feature/* fix/* refactor/* chore/* docs/*  ──PR──▶  develop  (beta channel)
                                                      │  every merge: release-beta.yml
                                                      │  → mewkit-vX.Y.Z-beta.N + vX.Y.Z-beta.N
                                                      ▼
                                              release/vX.Y.Z  (cut from develop)
                                                      │  release-prepare.yml: validate, stamp version,
                                                      │  build changelog, full dry-run release, open PR
                                                      ▼
hotfix/vX.Y.Z (cut from main) ──PR──▶  main  (stable channel)
                                                      │  merge: release-stable.yml
                                                      │  → mewkit-vX.Y.Z + vX.Y.Z (latest),
                                                      │    installer pin PR, back-merge PR → develop
```

Every release goes through `.github/workflows/release.yml`:

1. `binary-build.yml` stamps the version into `Cargo.toml` and builds six targets.
2. The kit gate (`scripts/release/build-kit.sh`) stamps the same version into `package.json` and
   `.claude/kit-contract.json`, runs `scripts/release-check.sh` with the linux binary from step 1 as
   `MEWKIT_NEXT_BIN`, builds `dist/meowkit-release.zip` + `dist/checksums.txt`, and builds the docs.
3. It publishes `mewkit-v<version>` (archives, `binary-manifest.json`, `checksums.txt`, build
   provenance; never `latest`) and then `v<version>` (`meowkit-release.zip`, `checksums.txt`;
   `latest` only for a stable).
4. For a stable only, it opens the installer pin PR into `main`.

A failed step publishes nothing after it. Published assets are immutable: a rerun never replaces one.

**One distribution, one source.** `.claude/` is the source for skills, agents, rules and hooks. The
per-runtime overlays in `kit/overlays/<runtime>/` hold what one runtime needs that `.claude/` cannot
express. The release zip carries both (`scripts/kit-ship-set.cjs` lists what ships). At install time
`mewkit init --target codex|cursor` projects the `.claude/` skills and agents into that runtime's
layout and adds its overlay. Nothing is hand-ported per release.

**Key insight:** the `mewkit` binary downloads `meowkit-release.zip` from GitHub Releases at runtime.
A release without that zip asset is invisible to it, so the binary skips it.

## One version for kit and binary

Root `package.json` `version` is the source of truth. `scripts/sync-versions.cjs` stamps it into
`[workspace.package] version` in `Cargo.toml`, the workspace crates in `Cargo.lock`,
`.claude/kit-contract.json` (`kitVersion`) and `release-manifest.json`, and fails CI on any drift:

```bash
node scripts/sync-versions.cjs                 # check
node scripts/sync-versions.cjs --set 3.2.0     # set package.json, then stamp the rest
```

Since 3.1.2 the binary carries the kit's number (it jumped from 0.2.1). Every release publishes both,
even when only one of them changed: the cost is a binary build per release, the gain is that
`mewkit --version` and `mewkit versions` always name the same release.

`requires.mewkitMin` in the kit contract is still the oldest binary that can read the kit. Raise it
only when the kit needs new binary behavior, not on every release.

## Branches

| Branch | Role | Takes PRs from | Releases |
| --- | --- | --- | --- |
| `main` | Stable channel, production docs | `release/vX.Y.Z`, `hotfix/vX.Y.Z`, `release/installer-pins-mewkit-v*` | stable on merge |
| `develop` | Beta channel, beta docs | `feature/*`, `fix/*`, `refactor/*`, `chore/*`, `docs/*`, `dependabot/*`, `chore/back-merge-v*` | beta on merge |

The CI job `branch-policy` refuses any other head → base pair. Both branches are protected by
rulesets (`.github/rulesets/`): no direct or force push, no deletion, PR with passing checks; `main`
also needs every review thread resolved and the full release gate. It needs no approval: the repository
has one maintainer, and GitHub does not let an author approve their own PR (release PRs are opened with
that maintainer's `RELEASE_PR_TOKEN`). Raise `required_approving_review_count` once a second reviewer joins.

## Versions are computed, never typed

`scripts/release/next-version.cjs` decides every number from tags:

- **Beta:** the latest stable bumped by the highest conventional-commit level since it
  (`feat!:` or `BREAKING CHANGE:` → major, `feat:` → minor, anything else → patch), never below a base
  an existing beta already used; `N` is the highest existing `-beta.N` of that base plus one. The beta
  job stamps it in its workspace and commits nothing back to `develop`, so the tagged commit's
  `package.json` keeps the last stable number; the zip, the binary and the tags carry the beta.
- **Stable:** the number in the `release/vX.Y.Z` or `hotfix/vX.Y.Z` branch name. It must be strictly
  greater than the latest stable, and neither `vX.Y.Z` nor `mewkit-vX.Y.Z` may exist.

Concurrent PRs therefore never conflict on a version. Changelog entries are one file per PR in
`changes/` (see [changes/README.md](changes/README.md)), so they never conflict either.

## Release Tags and Channels

| Stream | Tag | GitHub Release | Marked `latest` |
| ------ | --- | -------------- | --------------- |
| Kit | `v<version>` | Stable release, with `meowkit-release.zip` and `checksums.txt` | Yes |
| Kit beta | `v<version>-beta.N` | Pre-release with the same two assets. Installed only with `mewkit init --beta` / `mewkit upgrade --beta` | Never |
| Binary | `mewkit-v<version>` | Stable release, no `.zip` asset | Never |
| Binary beta | `mewkit-v<version>-beta.N` | Pre-release on the beta channel | Never |

`https://github.com/ngocsangyem/MeowKit/releases/latest` must keep resolving to the newest kit. The
two tag prefixes stay so that kit selection (newest release with the zip) and `self-update` (tags
`mewkit-v*`) work unchanged in every binary already installed.

## Cutting a stable release

```bash
git switch develop && git pull --ff-only
git switch -c release/v3.2.0
git push -u origin release/v3.2.0
```

`release-prepare.yml` then validates `3.2.0`, commits `chore(release): v3.2.0` to the branch (version
in every surface, `## 3.2.0 (<date>)` built from `changes/*.md`, fragments deleted), runs the whole
release without publishing, and opens `release: v3.2.0` into `main`. Fix anything it reports with
commits on the release branch (it reruns). Review, approve, merge (merge commit). Then:

1. `release-stable.yml` publishes `mewkit-v3.2.0` and `v3.2.0` from `main`.
2. Review and merge the installer pin PR (see [Binary release stream](#binary-release-stream)).
3. Merge the back-merge PR `chore/back-merge-v3.2.0` into `develop`.
4. `docs-deploy.yml` deploys the production docs from `main`.

A **hotfix** is the same with `hotfix/v3.2.1` cut from `main`; its fixes reach `develop` through the
back-merge PR.

## Beta releases

Merging any PR into `develop` runs `release-beta.yml` (unless it only touched docs, landing, `tasks/`
or root prose). One beta runs at a time; when merges land faster than a release, the newest queued
run replaces older queued ones and its beta carries all of them. Notes list the fragments added since
the previous beta. Run it by hand from Actions → "Release beta" when needed.

## Docs channels

`docs-deploy.yml` builds the one docs source twice through Vercel, from the repo root, each as its
own project's production deploy (both projects have Root Directory `packages/docs`):

| Channel | Branch    | Vercel project secret         | Domain                                       |
| ------- | --------- | ----------------------------- | -------------------------------------------- |
| Stable  | `main`    | `VERCEL_DOCS_PROJECT_ID`      | `docs.meowkit.dev`                           |
| Beta    | `develop` | `VERCEL_DOCS_BETA_PROJECT_ID` | `DOCS_BETA_DOMAIN` (`beta.docs.meowkit.dev`) |

The beta is a production deploy of a second project, not a preview of the first: previews sit
behind Vercel Deployment Protection, and a domain aliased onto the stable project is taken back by
its next production deploy. A channel whose project secret is unset is skipped with a notice.
A Vercel token limited to one project needs a second one for beta: `VERCEL_TOKEN` for stable and
`VERCEL_DOCS_BETA_TOKEN` for beta (when unset, beta uses `VERCEL_TOKEN`).

Each build gets both channels' versions from the release tags (`next-version.cjs channels`: the
newest kit stable, and the newest kit beta only while it is ahead). They feed the Stable | Beta
switcher at the top of the sidebar, which links to the same page on the other site, and the banner
above each title: always on beta ("features may change… switch to stable"), on stable only while a
newer beta exists. A push deploys its branch's channel; a finished "Release beta" or "Release
stable" run redeploys both, since both version labels moved. The beta build also sets
`NEXT_PUBLIC_DOCS_CHANNEL=beta`, so its `robots.txt` disallows indexing. Stable deploys queue and
are never cancelled; a newer beta deploy replaces an older one.

## Repository settings (owner)

- Rulesets from `.github/rulesets/main.json` and `.github/rulesets/develop.json`:
  `gh api -X POST repos/ngocsangyem/MeowKit/rulesets --input .github/rulesets/main.json` (same for develop).
- Default branch: `develop`, so new PRs target it. `releases/latest` is unaffected.
- Secret `RELEASE_PR_TOKEN` (fine-grained: contents and pull requests write, this repository),
  **required**: commits and PRs made with the default token start no workflow, so the checks `main`
  requires would never run on the release PR. `release-prepare.yml` fails without it. The pin and
  back-merge PRs fall back to the default token and then need a push (or close/reopen) to get CI.
- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
- Variable `DOCS_BETA_DOMAIN` and the Vercel secrets above. `beta.docs.meowkit.dev` must be a domain of
  the beta project (not the stable one), with no Git branch, since the workflow deploys it.

## Manual recovery

`scripts/release.sh <version> "<title>"` finishes a kit release a workflow could not, from a clean
checkout of the exact commit: it runs `build-kit.sh` and `publish-kit.sh`, and refuses when the commit
is on no remote branch or `mewkit-v<version>` is not published. It never commits or pushes a branch.

## What each change and release needs

### 1. Update CHANGELOG and affected docs

Update the changelog and any affected guide or reference pages BEFORE tagging.

**Patch releases:** only update `packages/docs/content/docs/changelog/index.mdx` (step 2). Skip the
doc steps below unless a guide page documents behavior that changed.

#### 1a. Update affected guide pages

Check and update these pages if the release affects them:

| Page                                | Update when                                      |
| ----------------------------------- | ------------------------------------------------ |
| `guide/memory-system.mdx`           | Memory schema, capture, or consolidation changes |
| `core-concepts/workflow.mdx`        | Phase behavior changes (new steps, hook changes) |
| `guide/agent-skill-architecture.mdx` | New skills, agents, or Mermaid diagram changes  |
| `guide/model-routing.mdx`           | Model tier or routing changes                    |
| `guide/agent-models.mdx`            | An agent's pinned model changes, or an agent is added/removed |
| `reference/agents/*.mdx`            | Agent capability changes                         |
| `reference/skills/*.mdx`            | Skill behavior or schema changes                 |

#### 1b. Update agent and skill routing (when new agents/skills land)

When a release adds a new agent or skill, update the routing surfaces so the orchestrator and
`mk:help` can recommend it.

| File                                                            | Update when                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.claude/agents/SKILLS_INDEX.md`                                | New skill — add a row in the matching phase or "Cross-Cutting (Any Phase)" table                                            |
| `.claude/agents/AGENTS_INDEX.md`                                | New agent — add a row to the active-agents table (Type, Role, Source, phases, auto-activate, CE version)                    |
| `.claude/skills/agent-detector/references/agent-routing.md`     | New core/support agent — add to the 17-row table; new domain agent → add to the hub-skill family row                        |
| `.claude/skills/agent-detector/references/lifecycle-routing.md` | New skill that maps to a user signal — add a Discovery Tree row                                                             |
| `.claude/skills/scale-routing/data/domain-complexity.csv`       | New domain match (fintech, healthcare, etc.) — add a row with signals + level + workflow                                    |
| `packages/docs/content/docs/reference/meta.json`                | New skill or agent — add to the matching group                                                                              |
| `packages/docs/content/docs/reference/skills/<name>.mdx`        | New skill — create the reference page (use an existing skill page as a template; keep it under 800 lines per `docs.maxLoc`) |
| `packages/docs/content/docs/reference/agents/<name>.mdx`        | New agent — create the reference page                                                                                       |

Skip rows that don't apply to the current release. The matrix is a checklist, not a mandate to edit
every file.

#### 1c. Verify docs build

```bash
npm run build -w packages/docs
```

Must complete with no errors. Chunk size warnings are normal.

#### 1d. Update the runtime overlays (when `.claude/` content changes)

`mewkit init --target codex|cursor|grok|pi|omp` projects the `.claude/` skills and agents into each
runtime's layout at install time. A new or changed skill or agent reaches every runtime with no
second edit. Only the items in the table below need a hand edit, per runtime.

The overlays in `kit/overlays/`:

| Overlay | Used by |
| --- | --- |
| `codex/` | Codex: `.codex/` hooks, config and command policy |
| `cursor/` | Cursor: `.cursor/` hooks and rules, MCP profiles |
| `grok/` | Grok: `.grok/` hook file and helpers |
| `agents/` | The `.agents/skills/` root Codex, Pi and OMP read: its skill-pack catalog |
| `pi/`, `omp/` | Pi's extension and OMP's hook module only |
| `shared/AGENTS.md` | The always-on block every runtime that reads `AGENTS.md` merges |

| Change | Edit |
| --- | --- |
| New skill | Add `mk-<name>` to a pack in **every** `kit/overlays/*/catalog/skill-packs.json` (codex, cursor, grok, agents). A skill in no pack installs only when no pack list is given; `mewkit validate --packs` fails on it. Keep `core` under `budgetChars`. |
| Hook or hook helper | Write the file under `kit/overlays/<runtime>/files/` (Codex: `.codex/hooks.json`, `.codex/hooks/**`; Cursor: `.cursor/hooks.json`, `.cursor/hooks/**`). Shared hook libraries are copies of `.claude/hooks/lib/` made by `node scripts/sync-hook-core.cjs`; run it after editing them. |
| Cursor rule | `kit/overlays/cursor/files/.cursor/rules/<name>.mdc`, holding only what the shared `AGENTS.md` block does not say. Codex has no rule files: `.claude/rules/*` reach it as sections of `AGENTS.md`. |
| Always-on text | `kit/overlays/shared/AGENTS.md`: one text, merged as the `meowkit` block of the project's `AGENTS.md` by every runtime that reads that file (Codex, Cursor). Name no runtime folder in it. Claude Code keeps `.claude/rules/`. What only Cursor needs in every session goes in `kit/overlays/cursor/files/.cursor/rules/runtime-invariants.mdc`. |
| Text that belongs to one runtime | `[[replace]]` in `kit/overlays/<runtime>/overlay.toml` (`path`, `find`, `with`). The `find` text must occur exactly once in the projected file, or the build fails. |
| Frontmatter key for one runtime | `[skill.<name>]` or `[agent.<name>]` table in that runtime's `overlay.toml`. |
| Installed path a runtime does not take | `omit` in that runtime's `overlay.toml`. |
| Cursor MCP profile | `kit/overlays/cursor/catalog/mcp-profiles.json`. Merged by `init --mcp-profiles`; without the flag no MCP config is written. |

**Keep `.claude/` wording runtime-neutral.** Projection rewrites paths, tool words and skill names,
but a line that only makes sense on Claude Code must be reworded in the `.claude/` source. Use an
overlay `[[replace]]` only for text that belongs to one runtime.

**Skill naming.** Skills are `.claude/skills/<name>/` with `name: mk:<name>`. Projection installs them
as `mk-<name>` on every other runtime (`skill_prefix` in `crates/mewkit-adapters/src/projection/target.rs`).
Do not write `mk-` names into `.claude/` by hand.

**The skills directories differ ON PURPOSE.** Codex, Pi and OMP read `.agents/skills/`, Cursor reads
`.cursor/skills/`, Grok reads `.grok/skills/` (`skills_root` in
`crates/mewkit-adapters/src/projection/target.rs`). Do NOT "unify" them. Where each combination of
runtimes writes: `crates/mewkit-adapters/runtime-surface-table.md`.

**What projection produces** (reference only; these files are generated, do not author them by hand):

| `.claude/` surface | Codex | Cursor |
| --- | --- | --- |
| `skills/<name>/` | `.agents/skills/mk-<name>/SKILL.md` | `.cursor/skills/mk-<name>/SKILL.md` |
| `agents/<name>.md` | `.codex/agents/<name>.toml` (`name`, `description`, `developer_instructions`, model and effort) | `.cursor/agents/<name>.md` (frontmatter `name`, `description`, `model`, `readonly`, `is_background`) |
| `rules/*` | Summarised as sections of the shared `AGENTS.md` block. Native `.codex/rules/default.rules` is a Starlark **command policy** from the overlay | The same `AGENTS.md` block. Cursor-only rules are written by hand as `.cursor/rules/<name>.mdc` in the overlay; each rule declares one activation class (`alwaysApply: true` is reserved for `runtime-invariants.mdc`) |
| `settings.json` hooks | Hand-written in the overlay: `.codex/hooks.json` + `.codex/hooks/` | Hand-written in the overlay: `.cursor/hooks.json` + `.cursor/hooks/` |
| memory | `.meowkit/memory/` (provider-neutral, never `.claude/memory/`) | `.meowkit/memory/` |

Index files (`agents/AGENTS_INDEX.md`, `SKILLS_INDEX.md`) are catalogs, not agents.

**Model assignment when adding an agent:**

- **Claude Code** (the source): set `model:` in `.claude/agents/<name>.md` by class: advisory →
  `fable`; deep (planning, review, security, architecture, design, evidence synthesis) →
  `claude-opus-5`; standard judgement → `sonnet`; bounded or wrapper work → `haiku`. An exact model id
  must be registered as a named profile in `crates/mewkit-core/src/validate/agent_registry_rows.rs`,
  or `mewkit validate --agents` rejects it. Per-agent table:
  `packages/docs/content/docs/guide/agent-models.mdx`.
- **Codex and Cursor**: the model id and reasoning effort come from projection (`model_pins` in
  `crates/mewkit-adapters/src/projection/target.rs`). The tier mapping and the approved ids are in
  `scripts/lib/model-pins.md`. Add a new id there first, then to the mapping, if you introduce one.
  Do not hardcode a runtime model id in `.claude/`.

**Always check the official docs FIRST**, because these formats change:

- Codex: [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) · [rules](https://learn.chatgpt.com/docs/agent-configuration/rules) · [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) · [hooks](https://learn.chatgpt.com/docs/hooks) · [skills](https://learn.chatgpt.com/docs/build-skills) · [config](https://learn.chatgpt.com/docs/config-file/config-basic)
- Cursor: [subagents](https://cursor.com/docs/agent/subagents) · [rules](https://cursor.com/docs/context/rules) · [skills](https://cursor.com/docs/context/skills) · [models](https://cursor.com/docs/models-and-pricing)

**Host words.** Projection rewrites host paths, tool names and hook event names for each runtime
(`crates/mewkit-adapters/src/projection/`). Any host-specific text it cannot rewrite goes in the
`.claude/` source as runtime-neutral wording, or in an overlay `[[replace]]` if it belongs to one
runtime. Product self-references stay out of `.claude/` (step 1f). The per-host denylist is
`scripts/lib/host-foreign-tokens.json`, which `scripts/check-instruction-criteria.cjs` enforces on
the installed tree.

**Verify (from the repo root):**

```bash
cargo build -p mewkit-cli --locked

# installed-tree checks: each runtime is installed into a temp directory with the built binary
node scripts/check-instruction-criteria.cjs --baseline scripts/instruction-criteria-baseline.json
bash scripts/check-skill-cross-refs.sh

# hook-core copies match .claude/hooks/lib/ (exits 1 on drift)
node scripts/sync-hook-core.cjs --check

# pack-catalog coherence, then docs-reference drift
mewkit validate --packs
cargo test -p mewkit-core --locked --test bless_docs_manifest

# brand-prose lint on the authored files
LINT_MODE=diff bash scripts/lint-brand-prose.sh
```

**End-to-end smoke: a multi-provider install must not drop content.** Use the kit zip the release
step built, and run it in **both orders**:

```bash
REPO=$(pwd)
S=$(mktemp -d) && cd "$S"
mewkit init --target codex  --kit-archive "$REPO/dist/meowkit-release.zip"
mewkit init --target cursor --kit-archive "$REPO/dist/meowkit-release.zip"
ls .agents/skills | wc -l   # codex skills
ls .cursor/skills | wc -l   # cursor skills: BOTH counts must equal the full catalog
```

An omitted `--skill-packs` installs the full catalog for both providers; `--skill-packs core`
narrows it. A second run of either command should change nothing.

> **MCP servers → Codex:** the `.mcp.json` → `.codex/config.toml [mcp_servers]` merge was dropped
> with the retired `migrate` verb. Add servers to `config.toml` by hand.

#### 1e. Update when the memory contract changes

The team store is two committed files, `.meowkit/memory/decisions.md` and `gotchas.md`. A change to
the entry format, the read or write sets, `mewkit note`, or the `validate --memory` lint must update,
in the same PR:

- `packages/docs/content/docs/guide/memory-system.mdx`
- the `.claude/rules/meowkit-core.md` Memory section, and the `mk:memory` skill

A format change affects existing stores, so record it in the CHANGELOG `Migration Notes` with the
exact new entry format or command.

#### 1f. No product-brand leakage in shipped content

`mewkit init` copies `.claude/` into the USER's project, where every loaded skill, agent and rule
competes for the user's context window. Shipped content MUST NOT refer to the product by name as a
self-referential subject. Write **"the toolkit"**, **"the harness"**, or **"this workflow"** instead
of "MeowKit" / "meowkit".

**Allowed (functional, keep):**

- The `mewkit` CLI binary: `mewkit validate`, `mewkit note`, etc. (it is the installed command, not brand prose).
- `MEOWKIT_*` environment variables (e.g. `MEOWKIT_TDD`, `MEOWKIT_AUTOBUILD_MODE`).
- The `ngocsangyem/MeowKit` repo URL inside install commands.
- Attribution and provenance metadata (e.g. `SKILLS_ATTRIBUTION.md`, skill `attribution:` frontmatter).
- Real path and string literals the code depends on (`~/.meowkit/...`, `"meowkit-default"`, `meowkit:` frontmatter keys).

**Scope:** this rule applies ONLY to the shipped surface, `.claude/`. The source repo's `packages/`,
`docs/` and README are the product's own surfaces and SHOULD use the brand.

**Check before release.** Scope the grep to the context-loaded prose surfaces and exclude the
functional refs above. Expect **zero** hits:

```bash
grep -rinE 'meowkit' .claude/skills .claude/agents .claude/rules --include='*.md' \
  | grep -vE 'MEOWKIT_|ngocsangyem/MeowKit|attribution|MeowKit-native|meowkit_tier|author: meowkit|~/\.meowkit|meowkit-default|:meowkit:'
```

A broader `grep -ri meowkit .claude` also surfaces functional hits (config identity, filenames, hook
log prefixes, generated views). Those are expected. Only new prose that names the product as a
subject needs neutralizing.

### 2. Changelog fragments (`changes/*.md` → `packages/docs/content/docs/changelog/index.mdx`)

> **Note:** The ONLY changelog file you edit is `packages/docs/content/docs/changelog/index.mdx`, the
> Fumadocs source that renders to https://docs.meowkit.dev/changelog. Root `CHANGELOG.md` is a
> permanent stub that just refers readers to that published page; never add release notes to it.
> Older releases live in the sibling `changelog/archive.mdx`; a release moves there only when the
> index page needs trimming, never as part of adding a new section.

Do not edit this page in a feature PR. Add a fragment under `changes/` instead
([changes/README.md](changes/README.md)); its `section` is one of the sections below.
`release-prepare.yml` writes the version section at the **top** (just below the `## Upgrade` block)
from all fragments, in this order, and drops empty sections. Edit the generated section on the
release branch if it needs polish.

#### Section schema (in this order)

| Section                | When to include                                                   | Format                                                                                       |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `### Highlights`       | Always for feature/breaking releases. Optional for patches.       | 1–3 sentences. State the user-visible thesis of the release. No file paths, no internal IDs. |
| `### New Skills`       | Whenever ≥1 new skill ships.                                      | Markdown table: `\| Skill \| Purpose \|`                                                     |
| `### New Agents`       | Whenever ≥1 new agent ships.                                      | Bullet list: `- ``agent-name`` — purpose.`                                                   |
| `### New Commands`     | Whenever ≥1 new slash command ships.                              | Bullet list: `- ``/command`` — purpose.`                                                     |
| `### CLI`              | Whenever the `mewkit` binary changes.                             | Bullet list.                                                                                 |
| `### Features`         | New user-facing functionality not covered by the New-\* sections. | Bullet list.                                                                                 |
| `### Improvements`     | Refactors, ergonomics, perf, prunes that the user notices.        | Bullet list.                                                                                 |
| `### Removals`         | Deletions, deprecations, renames.                                 | Bullet list. State migration path inline.                                                    |
| `### Bug Fixes`        | All user-visible fixes.                                           | Bullet list. State the symptom + the fix briefly.                                            |
| `### Beta`             | Opt-in / experimental features (env var or flag-gated).           | Bullet list. State the opt-in mechanism.                                                     |
| `### Migration Notes`  | Only if user action is required.                                  | Bullet list. Include the exact command or env var.                                           |
| `### Breaking Changes` | Only if there are any.                                            | Bullet list. State the before/after behavior.                                                |

#### Style rules

- **One sentence per bullet** unless an env var table or migration command is needed.
- **No internal IDs** in published bullets: drop `RT-C1`, `M2`, `CF3`, `RF-14`, `phase-XX`, `[CHM]<n>`. They belong in commit messages, not the changelog.
- **No test counts** (e.g. "40 passed / 3 todo"). That is CI noise, not a user-impact signal.
- **No audit metadata.** Summarize the _outcome_ in Highlights and let bullets describe what changed.
- **No file counts** ("286 lines, 11 sections"). Describe what the user gets, not how big the diff was.
- **No internal plan-directory paths** (`plans/260411-1906-...`).
- **No `**bold:**` prefix per bullet.** Bold is reserved for skill, command and agent names referenced inline (use backticks, not bold).
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

- **Highlights** is the elevator pitch: _what changed in this release at the level the user cares about_. 1–3 sentences. No bullets.
- **Features** is the granular list of additions. Bullets, one per addition.

If you only have one feature and it is the whole release, put it in **Highlights** as prose and skip **Features**.

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

- `mewkit upgrade` to pick up the new defaults.
```

### 3. Choose the version

Feature PRs set no version. For a stable, pick `X.Y.Z` from the conventional commits since the last
stable ([table below](#conventional-commits--version-bumps)), one number for kit and binary, and cut
`release/vX.Y.Z` ([Cutting a stable release](#cutting-a-stable-release)). `requires.mewkitMin` in
`.claude/kit-contract.json` changes only when the kit needs newer binary behavior.

### 4. Check locally before cutting (optional)

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
npm test && npm run lint && npm run format:check
node --test .claude/hooks/__tests__/*.test.cjs
node scripts/release/next-version.cjs stable --branch release/vX.Y.Z
npm run release:check      # the readiness gate the release workflow runs
```

### 5. What the workflows do

Steps 5–10 of the old manual flow (assets, commit, tag, push, GitHub Release, binary tag) are done by
`release.yml`. `scripts/release/build-kit.sh <version>` and `scripts/release/publish-kit.sh` are the
same steps it runs, usable by hand for [Manual recovery](#manual-recovery). The zip carries
`.claude/`, the `kit/overlays/` files and catalogs, and manifests (no root `CLAUDE.md`, no `tasks/`,
no `changes/`), and `.claude/kit-contract.json`. The script does NOT write `.claude/metadata.json`;
the binary writes it on install and upgrade.

### 6. Review the installer pin PR (stable only)

While "Allow GitHub Actions to create and approve pull requests" is off and no `RELEASE_PR_TOKEN` is
set, the "Open the installer pin pull request" job cannot open the PR. It still pushes the branch
`release/installer-pins-mewkit-v<version>` and ends with a notice and a job-summary link; the run stays
green. Review before merging:

```bash
git fetch origin release/installer-pins-mewkit-v<version>
gh release download mewkit-v<version> -p checksums.txt -D "$(mktemp -d)"   # compare each digest with the diff
git diff main FETCH_HEAD                                                     # every URL under releases/download/mewkit-v<version>/
git switch --detach FETCH_HEAD && node scripts/release/render-installers.mjs --check; git switch main
```

Until the pin PR merges, `install.sh` and `install.ps1` still install the previous binary.

### 7. Test end-to-end

After the pin PR and the kit release, in a scratch `HOME` so your own install is untouched:

```bash
S=$(mktemp -d) && export HOME="$S/home" && mkdir -p "$HOME" && cd "$S"
curl -fsSL https://raw.githubusercontent.com/ngocsangyem/MeowKit/main/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
mewkit --version                       # the binary just released
mkdir proj && cd proj && git init -q
mewkit init --target claude-code --yes
mewkit versions                        # kit version must be the one just released
mewkit doctor && mewkit validate
```

## Release Checklist

Copy this checklist for each release:

```markdown
## Release v<version> Checklist

### Docs and changelog

- [ ] Affected guide/reference pages (step 1a) and routing surfaces (step 1b) updated
- [ ] No product-brand leakage in shipped `.claude/` (step 1f); docs build passes
- [ ] Every user-visible PR since the last stable added a `changes/*.md` fragment; the generated `## <version>` section reads well

### Versions

- [ ] `release/v<version>` validated by `release-prepare.yml`; `node scripts/sync-versions.cjs` passes (one version everywhere)
- [ ] `requires.mewkitMin` raised only if the kit needs newer binary behavior
- [ ] Memory contract changed? (step 1e): docs, rule and `Migration Notes` updated, `mewkit validate --memory` green

### Build and overlays

- [ ] Step 4 commands pass (cargo fmt, clippy, test, `npm test`, lint, hook tests, `npm run release:check`)
- [ ] Runtime overlays updated where step 1d needs a hand edit; new skills in every `kit/overlays/*/catalog/skill-packs.json` file
- [ ] Step 1d verify commands pass (installed-tree checks, `sync-hook-core.cjs --check`, `mewkit validate --packs`, `bless_docs_manifest`); multi-provider smoke passes in both orders

### Release

- [ ] Release PR into `main` green and approved; merged with a merge commit
- [ ] `release-stable.yml` published `mewkit-v<version>` then `v<version>`; the kit release has `meowkit-release.zip` and `checksums.txt` only
- [ ] Installer pin PR reviewed and merged (step 6); back-merge PR into `develop` merged
- [ ] Fresh `install.sh` + `mewkit init` in a scratch `HOME` gives the new binary and kit (step 7)
```

## Release Streams and Trust Model

Three things ship. Only two are released.

- **Kit**: `release.yml` (through `scripts/release/publish-kit.sh`) tags `v<version>` and publishes `meowkit-release.zip` + `checksums.txt` to the GitHub Release. The zip carries `.claude/kit-contract.json`: `kitContract` (format version), `requires.mewkitMin` (oldest binary that can read this kit) and `kitVersion` (stamped from root `package.json` by `sync-versions.cjs`).
- **Binary**: the native `mewkit` CLI (alias `mk`) is released from this repo under `mewkit-v<version>` tags, same number as the kit, with no `.zip` asset, so kit consumers never mistake it for a kit. It fetches the kit zip and checks it against `checksums.txt`. See [Binary release stream](#binary-release-stream).
- **npm package (`mewkit`)**: retired. It is no longer released. See [Retiring the npm package](#retiring-the-npm-package).

**Trust model: checksums only.** MeowKit is open source and releases carry no signatures. `checksums.txt` is fetched from the same release as the zip, so it detects corruption and partial downloads, not a tampered release. Trust rests on GitHub, TLS and who can push tags.

**Never upload `meowkit-kit-*.tar.gz`, `kit-manifest.json` or `*.sig` to a release.** Older npm CLIs (up to 2.3.1) install from a signed kit artifact when a release carries one, and their trusted keyring is empty, so every install of that release would be refused. `verify-release-assets.cjs` fails if any of them sits in `dist/`. The signing engine and its scripts were removed.

### Binary release stream

**What a release is.** Every beta and stable run of `.github/workflows/release.yml` builds the binary with `binary-build.yml` (the version stamped into `Cargo.toml` first, so `mewkit --version` prints it) and publishes it as `mewkit-v<version>` before the kit. Nobody pushes a `mewkit-v*` tag by hand. The workflow:

1. builds six targets: `{x86_64,aarch64}-unknown-linux-musl` (static), `{x86_64,aarch64}-apple-darwin`, `{x86_64,aarch64}-pc-windows-msvc` (static C runtime);
2. packs each as `mewkit-<version>-<target>.tar.gz` (Windows too: never `.zip`);
3. writes `checksums.txt` and `binary-manifest.json` (`version`, `channel`, `published_at`, `min_supported`, per-target `url`, `sha256`, `size`) from the archives;
4. creates the release as a draft, uploads everything, then publishes it with `--latest=false`. A version with `-` (e.g. `3.2.0-beta.1`) is a prerelease on the beta channel;
5. for a stable only, opens a PR `release/installer-pins-mewkit-v<version>` into `main` that re-renders `install.sh` and `install.ps1` with the new pins (the installers serve stable binaries only).

`workflow_dispatch` (Actions → "Binary build" → Run workflow) builds all six targets from any branch
and publishes nothing.

**Installers.** `install.sh` and `install.ps1` place `mewkit` and `mk` (the same binary). An existing
`mk` that is not MeowKit is left alone and reported. The 0.1.0 and 0.1.1 installers also placed
`mewkit-next`; later installers and `mewkit self-update` remove it when it is a mewkit binary.

**`releases/latest` keeps pointing at a kit.** Binary releases are never `latest`, so
`https://github.com/ngocsangyem/MeowKit/releases/latest` keeps resolving to the newest stable kit.
Kit consumers pick the newest release with a `.zip`, which binary releases never have. Link a binary
release by its tag. `crates/mewkit-core/src/kit/select_tests.rs` proves the binary's own kit
selection skips binary releases; deployed npm CLIs skip them because no binary asset is a `.zip`.

**Repository settings the workflow needs (owner):**

- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests", for the pin PR.
- Optional secret `RELEASE_PR_TOKEN` (fine-grained token: contents and pull requests, write, this repository). Without it the pin PR is opened by `GITHUB_TOKEN`, and GitHub runs no CI on PRs that token opens; with it, the pin PR gets CI like any other.
- Branch protection on `main` requiring review. The installers' pins are the root of trust for a first install; they must reach `main` only through a reviewed PR.

**Reviewing a pin PR.** Check that every URL is under `releases/download/mewkit-v<version>/` and that
the digests match the release's `checksums.txt`. `node scripts/release/render-installers.mjs --check`
passes on the PR branch.

**Trust model (no signatures).** `install.sh` / `install.ps1` are trusted as served over TLS from
`main`; they refuse any archive whose size or SHA-256 differs from the pin. `mewkit self-update` checks
`binary-manifest.json` and the archive's SHA-256 and size before replacing itself (the previous binary
is kept for rollback). Anyone who can publish a release here can ship code to `self-update` users; that
is the accepted cost of not managing signing keys.

**Withdrawing a bad version.** Set the repository variable `MEWKIT_MIN_SUPPORTED` (Settings → Variables →
Actions) to the first good version and publish a fixed release. Its manifest carries that floor, and
`self-update` on any older binary reports that the running version is withdrawn and names the release
to move to. Deleting a release does not withdraw it from users who have it.

**Kit releases check the binary.** `scripts/release-check.sh` installs the candidate kit with the
newest published binary (`init --dry-run` for claude-code, codex and cursor). It looks for `mk` on
PATH; set `MEWKIT_NEXT_BIN` to point at another binary. A kit whose
`kitContract` or `requires.mewkitMin` is beyond that binary fails the release. Install the binary
first (`install.sh`) or set `MEWKIT_NEXT_BIN`; until a binary release exists the step is skipped, and
only when `gh` can confirm that.

### Retiring the npm package

The Node `mewkit` CLI on npm is no longer maintained. Its last published version is `mewkit@2.3.1`.
Published versions keep installing, and there is no `npm publish` step any more. `npm deprecate` only
adds a warning at install time; it does not unpublish anything.

The maintainer runs this once, from a machine logged in to npm with publish rights on `mewkit`:

```bash
npm deprecate mewkit "The Node mewkit CLI is no longer maintained. Install the native CLI: https://docs.meowkit.dev/installation (commands: mewkit, mk)"
```

This is a registry action, not part of any release; the PR that carries this change repeats the command.
Projects that still run `npx mewkit` keep working.

### Conventional commits → version bumps

Kit and binary share one version, so the mapping below applies to any change, in `.claude/`,
`kit/` or `crates/`. Betas apply it automatically (`next-version.cjs`); for a stable, pick the branch
name with it.

```
feat: new skill            → MINOR (1.0.0 → 1.1.0)
fix: skill bug             → PATCH (1.1.0 → 1.1.1)
feat!: breaking change     → MAJOR (1.1.1 → 2.0.0)
chore: cleanup             → no release
docs: update readme        → no release
```

For the binary, a removed flag, renamed subcommand or removed env var is breaking (`!`); a new flag,
subcommand or env var is `feat:`.

## Release Scripts

| Script                                  | Purpose                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/release/next-version.cjs`      | Next beta (from tags + conventional commits) or the validated stable target of a `release/`/`hotfix/` branch |
| `scripts/release/assemble-changelog.cjs` | Changelog fragments: `check`, beta `notes`, stable `section` insertion, PR `require` check |
| `scripts/release/build-kit.sh`          | Stamp one version → readiness gate → JSON checks → assets → docs build (no git, no publish) |
| `scripts/release/publish-kit.sh`        | Publish `v<version>` with the zip and checksums (tag at a given commit; never replaces an asset) |
| `scripts/release.sh`                    | Manual recovery: `build-kit.sh` + `publish-kit.sh` on a clean, pushed commit |
| `scripts/release-check.sh`              | Readiness gate (`npm run release:check`): cargo build, bless tests, version sync, portable skills, kit contract, install check, `validate --portable` on the binary, npm test, lint, format check |
| `scripts/prepare-release-assets.cjs`    | Build the release manifest + `dist/meowkit-release.zip` + `dist/checksums.txt`   |
| `scripts/verify-release-assets.cjs`     | Check `dist/` before upload: contract in the zip, checksum, no signed-artifact asset |
| `scripts/generate-release-manifest.cjs` | Generate SHA-256 checksums for all release files                                |
| `scripts/kit-ship-set.cjs`              | The files a kit ships: `.claude/`, `kit/overlays/{codex,cursor,grok,agents}/` (`overlay.toml`, `files/`, catalogs), `kit/overlays/{pi,omp}/files`, `kit/overlays/shared/AGENTS.md` |
| `scripts/sync-hook-core.cjs`            | Copies the shared hook libraries from `.claude/hooks/lib/` into the overlays; `--check` exits 1 on drift |
| `scripts/sync-versions.cjs`             | Check, stamp (`--write`) or set (`--set <v>`) the one version: `package.json` → `Cargo.toml`, `Cargo.lock`, `.claude/kit-contract.json`, `release-manifest.json` |
| `scripts/lib/cli-version.cjs`           | Reads the binary version from `[workspace.package]` in the root `Cargo.toml`    |
| `scripts/release/build-binary-manifest.mjs` | Binary stream: `binary-manifest.json` + `checksums.txt` from the six archives (run by `release.yml`) |
| `scripts/release/render-installers.mjs` | Binary stream: render `install.sh` / `install.ps1` from their templates and `installer-pins.json`; `--check` fails on drift |
| `scripts/release/check-kit-against-binary.sh` | Kit gate: `init --dry-run` of a staged kit for claude-code, codex and cursor with a given binary |

## Release History

Binary releases (`mewkit-v*`, never `latest`):

| Version | Date       | Notes                                                        |
| ------- | ---------- | ------------------------------------------------------------ |
| 0.1.1   | 2026-11-21 | Upgrade removes retired files without a cache or install record; `init` notes a newer binary |
| 0.1.0   | 2026-11-20 | First native binary                                          |

Kit releases (`v*`):

| Version | Date       | Title                                            |
| ------- | ---------- | ------------------------------------------------ |
| v3.0.1  | 2026-11-21 | Upgrade Fixes                                    |
| v3.0.0  | 2026-11-20 | Native Binary & Six Runtimes                     |
| v2.15.0 | 2026-07-27 | Strategic Supervision & the Portable Backend Surface |
| v2.14.8 | 2026-07-26 | Runtime-Neutral State & the Documentation Rebuild |
| v2.14.7 | 2026-07-25 | Per-Agent Model Routing & Explore Agent          |
| v2.14.4 | 2026-07-19 | The Orientation & Transition Spine               |
| v2.14.3 | 2026-07-19 | Jira & Confluence Agents on Haiku                |
| v2.14.2 | 2026-07-18 | Composed Capability Recall                       |
| v2.14.1 | 2026-07-18 | Harness Integrity & Provider Parity              |
| v2.14.0 | 2026-07-17 | Provider Conformance, Contract Safety & Evals    |
| v2.13.7 | 2026-07-15 | Gate Contract Safety, Portability, DX            |
| v2.13.6 | 2026-07-13 | Local Visual Plan Review                          |
| v2.13.5 | 2026-07-12 | Capability Discovery + Durable Task State        |
| v2.13.4 | 2026-07-05 | Figma Gateway + Agent-Browser Hardening          |
| v2.13.3 | 2026-07-04 | Context-Engineering + Prompt-Enhancer Hardening  |
| v2.13.2 | 2026-07-03 | Deep Research Skill + Full-Surface Codex Migration |
| v2.13.1 | 2026-06-29 | Wiki Handoff + Context Recall                    |
| v2.13.0 | 2026-06-29 | The Wiki Knowledge Subsystem                     |
| v2.12.3 | 2026-06-28 | Visual + HTML Workflow                           |
| v2.12.2 | 2026-06-28 | Visual Plan Rendering                            |
| v2.12.1 | 2026-06-27 | Native Plugin Distribution                       |
| v2.12.0 | 2026-06-27 | Legible Context + Queryable Substrate            |
| v2.11.7 | 2026-06-20 | Brainstorming Solution Decompression             |
| v2.11.6 | 2026-06-19 | Merge Conflict + Codebase Architecture Skills    |
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

### `mewkit init` fetches the wrong version

**Cause:** The target release has no `meowkit-release.zip` asset. The binary only lists releases that carry the zip, so a kit release without one is skipped.

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

The same steps apply to a `mewkit-v<version>` tag.

### CI fails at "One version for kit and binary"

**Cause:** `package.json`, `Cargo.toml`, `Cargo.lock` or `.claude/kit-contract.json` disagree.

**Fix:** `node scripts/sync-versions.cjs --write` and commit the result. Feature PRs should not
change a version at all.

### GitHub Release exists but no zip

```bash
gh release upload v<version> dist/meowkit-release.zip dist/checksums.txt --clobber
```

### The binary workflow says "Open the installer pin PR by hand"

**Cause:** "Allow GitHub Actions to create and approve pull requests" is off in the repository
settings and no `RELEASE_PR_TOKEN` is set. The release itself is published and the pin branch is
pushed; the job reports this as a notice, not a failure.

**Fix:** Review the pin branch and open the PR from the link in the job summary (step 6). To have
the workflow open it, turn the setting on or add the `RELEASE_PR_TOKEN` secret. Any other error from
`gh pr create` still fails the job.

### `release-prepare.yml` fails at "Validate the target version"

**Cause:** The branch is not `release/vX.Y.Z` / `hotfix/vX.Y.Z`, or `X.Y.Z` is not above the latest
stable, or `vX.Y.Z` / `mewkit-vX.Y.Z` already exists (published releases are immutable).

**Fix:** Delete the branch and cut one with the next free version.

### A beta was not released after a merge

**Cause:** The merge touched only paths `release-beta.yml` ignores (docs, landing, `tasks/`, root
prose), or a newer queued run replaced it (its beta carries the change), or the gate failed.

**Fix:** Check the "Release beta" runs; rerun or run it by hand after fixing the gate.

### The readiness gate reports "generated artifacts drifted" for `README.md`

**Cause:** The skill, agent, rule and hook counts in `README.md` are generated from the tree, and a
hand edit changed them.

**Fix:** `MEWKIT_BLESS=1 cargo test -p mewkit-core --locked --test bless_inventory_counts`, review the
diff and commit it. The same failure makes `validate --portable` report hard failures.

### The readiness gate cannot find a binary

**Cause:** No `mk` on `PATH` and no `MEWKIT_NEXT_BIN`.

**Fix:** Set `MEWKIT_NEXT_BIN` to a checksum-verified binary from the newest `mewkit-v*` release, or
to `target/debug/mewkit` built from the same commit. In CI the release workflow sets it to the binary it
just built.

### An install is missing a skill or rule after editing `.claude/`

**Cause:** A skill that is in no pack in `kit/overlays/<runtime>/catalog/skill-packs.json` is skipped by a pack-limited install. A Cursor rule exists only in `.claude/rules/` and was never written as a `.mdc` in the Cursor overlay. A hook edit in `.claude/hooks/` does not reach the overlay until it is copied.

**Fix:** Add the skill as `mk-<name>` to a pack in every `kit/overlays/*/catalog/skill-packs.json`. Write a Cursor rule under `kit/overlays/cursor/files/.cursor/rules/`. Run `node scripts/sync-hook-core.cjs` for hook libraries. Then run the verify commands and the multi-provider smoke in step 1d.

### Cursor installed no skills at all in a multi-provider project

**Cause:** Skills were written into a directory another runtime owns. Codex, Pi and OMP read `.agents/skills/`, Cursor reads `.cursor/skills/` and Grok reads `.grok/skills/` (`skills_root` in `crates/mewkit-adapters/src/projection/target.rs`).

**Fix:** Keep the trees separate. Both are documented load paths for their runtime; do not "unify" them. Re-run the multi-provider smoke in step 1d, in both install orders.
