# Releasing MeowKit

Complete guide to building, tagging and publishing MeowKit releases. There are two release
streams: the **kit** (`.claude/` content, shipped as a zip) and the **binary** (the native `mewkit`
CLI, with `mk` as a short alias).

## Architecture

```
Source of truth (.claude/, kit/overlays/)
    ↓
prepare-release-assets.cjs → dist/meowkit-release.zip + dist/checksums.txt
    ↓
GitHub Release (tag vX.Y.Z + those two assets)                       kit stream
    ↓
mewkit init / mewkit upgrade download the zip

Cargo workspace (crates/, version under [workspace.package])
    ↓
rust-release.yml on tag mewkit-vX.Y.Z → six archives, binary-manifest.json, checksums.txt
    ↓
GitHub Release (never "latest") + PR that re-pins install.sh / install.ps1   binary stream
```

**One distribution, one source.** `.claude/` is the source for skills, agents, rules and hooks. The
per-runtime overlays in `kit/overlays/<runtime>/` hold what one runtime needs that `.claude/` cannot
express. The release zip carries both (`scripts/kit-ship-set.cjs` lists what ships). At install time
`mewkit init --target codex|cursor` projects the `.claude/` skills and agents into that runtime's
layout and adds its overlay. Nothing is hand-ported per release.

**Key insight:** the `mewkit` binary downloads `meowkit-release.zip` from GitHub Releases at runtime.
A release without that zip asset is invisible to it, so the binary skips it.

## Version Independence: kit vs binary

There are **two independently versioned things** in this repo, and they are deliberately not
synchronized:

| Version field | What it versions |
| --- | --- |
| root `package.json` → `version` | The **kit**: `.claude/` and `kit/overlays/` content |
| root `Cargo.toml` → `[workspace.package]` `version` | The **binary** (`mewkit`, alias `mk`): the installer, validator and lifecycle CLI |

Read the current numbers from those files, never from this page. A version pasted into prose is
stale the next time either one is bumped.

**Do not synchronize the two version fields.** They answer different questions: "which harness
content am I running" and "which binary installed it". A user can hold a new binary against an old
kit, or the reverse. Aligning the numbers would force a binary release for every prose edit, and a
kit release for every binary bugfix.

Bump each **only** for its own change:

- Kit content changed (`.claude/`, `kit/overlays/`, rules, skills, agents) → bump the **root** version.
- Binary code changed (`crates/`) → bump the **workspace** version.
- Both changed → bump both, independently, in the same release. Not to the same number.

A version-field change is a release decision. Never edit one to make the other match, and never let
tooling do it automatically.

## Release Tags and Channels

| Stream | Tag | GitHub Release | Marked `latest` |
| ------ | --- | -------------- | --------------- |
| Kit | `v<version>` | Stable release, with `meowkit-release.zip` and `checksums.txt` | Yes |
| Binary | `mewkit-v<version>` | Stable release, no `.zip` asset | Never |
| Binary prerelease | `mewkit-v<version>-beta.N` | Pre-release on the beta channel (the `-` in the version makes it one) | Never |

`https://github.com/ngocsangyem/MeowKit/releases/latest` must keep resolving to the newest kit.

## Quick Release (Script)

For a kit release, use the release script:

```bash
./scripts/release.sh <version> "<release title>"
```

Example:

```bash
./scripts/release.sh 2.3.2 "The Agent-Skills Integration Release"
```

The script checks that `<version>` equals root `package.json` `version`, stamps
`.claude/kit-contract.json`, runs `scripts/release-check.sh`, builds and verifies the kit assets,
checks the docs build, commits and tags, pushes, and creates the GitHub Release with the zip. It does
not build or tag the binary. That is the separate `mewkit-v` tag (see
[Binary release stream](#binary-release-stream)).

**Before running the script:** complete step 2 (CHANGELOG) by hand, plus steps 1a, 1b and 1e when they apply.

**After the script:** run step 11 (end-to-end test). If the binary changed, run step 10 too.

## Manual Release (Step-by-Step)

### 1. Update CHANGELOG and affected docs

Update the changelog and any affected guide or reference pages BEFORE tagging.

**Patch releases:** only update `packages/docs/content/docs/changelog/index.mdx` (step 2). Skip the
doc steps below unless a guide page documents behavior that changed.

#### 1a. Update affected guide pages

Check and update these pages if the release affects them:

| Page                                | Update when                                      |
| ----------------------------------- | ------------------------------------------------ |
| `guide/memory-system.md`            | Memory schema, capture, or consolidation changes |
| `guide/workflow-phases.md`          | Phase behavior changes (new steps, hook changes) |
| `guide/agent-skill-architecture.md` | New skills, agents, or Mermaid diagram changes   |
| `guide/model-routing.md`            | Model tier or routing changes                    |
| `guide/{claude,codex,cursor}-agent-models.md` | An agent's pinned model changes, or an agent is added/removed |
| `reference/agents/*.md`             | Agent capability changes                         |
| `reference/skills/*.md`             | Skill behavior or schema changes                 |

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

#### 1d. Update the Codex and Cursor overlays (when `.claude/` content changes)

`mewkit init --target codex|cursor` projects the `.claude/` skills and agents into each runtime's
layout at install time. A new or changed skill or agent reaches both runtimes with no second edit.
Only the items in the table below need a hand edit, per runtime.

| Change | Edit |
| --- | --- |
| New skill | Add `mk-<name>` to a pack in `kit/overlays/codex/catalog/skill-packs.json` **and** `kit/overlays/cursor/catalog/skill-packs.json`. A skill in no pack installs only when no pack list is given. Keep `core` under `budgetChars`. |
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
as `mk-<name>` for both runtimes (`skill_prefix` in `crates/mewkit-adapters/src/projection/target.rs`).
Do not write `mk-` names into `.claude/` by hand.

**The skills directories differ ON PURPOSE.** Codex reads `.agents/skills/`, Cursor reads
`.cursor/skills/`. Each is the only skills root its runtime reads (`skills_root` in
`crates/mewkit-adapters/src/projection/target.rs`). Do NOT "unify" them.

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
  `packages/docs/content/docs/guide/claude-agent-models.mdx`.
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

### 2. Update CHANGELOG (`packages/docs/content/docs/changelog/index.mdx`)

> **Note:** The ONLY changelog file you edit is `packages/docs/content/docs/changelog/index.mdx`, the
> Fumadocs source that renders to https://docs.meowkit.dev/changelog. Root `CHANGELOG.md` is a
> permanent stub that just refers readers to that published page; never add release notes to it.
> Older releases live in the sibling `changelog/archive.mdx`; a release moves there only when the
> index page needs trimming, never as part of adding a new section.

Add a new version section at the **top** (just below the `## Upgrade` block). Use the schema below.
Only include sections that have content. Empty sections are dropped, not stubbed.

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

### 3. Bump versions

#### Kit version

Set root `package.json` `version` to the kit version in the release PR. `scripts/release.sh <version>`
refuses any other value, so the kit version is always set first.

#### Binary (CLI) version

Bump only when the release changes the binary. Check first:

```bash
LAST=$(git tag --list 'mewkit-v*' --sort=-v:refname | head -1)
git diff --name-only "${LAST:-HEAD~1}"..HEAD -- crates Cargo.toml Cargo.lock
```

If the command prints nothing, the binary is unchanged: skip this sub-step and step 10. The binary
keeps its current version.

Map the size of the change to a SemVer field:

| Change shape                                                                                                                       | Bump                  | Example            |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| Minor edits: bug fix, log tweak, refactor that preserves the CLI surface                                                           | patch (last number)   | `X.Y.Z → X.Y.(Z+1)` |
| Big changes: new flag, new subcommand, new env var, behavior addition that does NOT remove or rename existing behavior            | minor (middle number) | `X.Y.Z → X.(Y+1).0` |
| Breaking changes: removed flag, renamed subcommand, removed or renamed env var, contract change that an existing script would notice | major (first number)  | `X.Y.Z → (X+1).0.0` |

Run the bump: edit `version` under `[workspace.package]` in the root `Cargo.toml`, run
`cargo build -p mewkit-cli` so `Cargo.lock` follows, and commit both. Every crate inherits that one
value. The release scripts read it through `scripts/lib/cli-version.cjs`, so do not set a version in a
crate's own `Cargo.toml`.

### 4. Build and verify

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
npm test
npm run lint
node --test .claude/hooks/__tests__/*.test.cjs
npm run release:check      # the readiness gate release.sh also runs
```

### 5. Build release assets

```bash
node scripts/prepare-release-assets.cjs "<version>"
```

This creates:

- `release-manifest.json`: SHA-256 checksums for all files
- `dist/meowkit-release.zip`: the release package (`.claude/`, the `kit/overlays/` files and catalogs, and manifests; no root `CLAUDE.md`, no `tasks/`); it carries `.claude/kit-contract.json`
- `dist/checksums.txt`: `<sha256>  meowkit-release.zip`, in `sha256sum -c` format

> **Note:** This script does NOT write `.claude/metadata.json`. The `mewkit` binary writes it on
> install and upgrade, and the script excludes it from the zip.

Verify the assets (contract inside the zip, checksum matches, no signed-artifact asset in `dist/`):

```bash
node scripts/verify-release-assets.cjs "<version>" dist
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

### 8. Create GitHub Release with zip and checksums

**This is the critical step.** The zip and `checksums.txt` MUST be attached as release assets, and
nothing else.

````bash
gh release create v<version> dist/meowkit-release.zip dist/checksums.txt \
  --title "v<version> — <release title>" \
  --notes-file - <<'NOTES'
## <Release Title>

<Release notes in markdown>

### Install

```bash
mewkit init
# or upgrade:
mewkit upgrade
```
NOTES
````

To upload the assets separately:

```bash
gh release create v<version> --title "..." --notes "..."
gh release upload v<version> dist/meowkit-release.zip dist/checksums.txt --clobber
```

### 9. Verify the release

```bash
# Check tag exists
git tag | grep v<version>

# Check the assets
gh release view v<version> --json assets -q '.assets[].name'
# Must show exactly: meowkit-release.zip, checksums.txt

# Check release URL
gh release view v<version> --json url -q '.url'
```

### 10. Release the binary (only when step 3 bumped the binary version)

Skip this step if `git diff` in step 3 printed nothing. The binary keeps its version and nothing is
tagged. Otherwise follow [Binary release stream](#binary-release-stream): merge the version bump, tag
`mewkit-v<version>`, push the tag, then review and merge the pin PR the workflow opens.

### 11. Test end-to-end

In an empty directory, with the binary installed from the release (`install.sh` / `install.ps1`):

```bash
S=$(mktemp -d) && cd "$S"
mewkit init --target claude-code --yes
mewkit versions     # kit version must be the one just released
mewkit doctor
```

## Release Checklist

Copy this checklist for each release:

```markdown
## Release v<version> Checklist

### Docs and changelog

- [ ] Affected guide/reference pages (step 1a) and routing surfaces (step 1b) updated
- [ ] No product-brand leakage in shipped `.claude/` (step 1f); docs build passes
- [ ] `v<version>` section added to `packages/docs/content/docs/changelog/index.mdx` (not root `CHANGELOG.md`, a stub)

### Versions

- [ ] Root `package.json` `version` is the kit version being released
- [ ] Binary changed? (step 3 `git diff`). If yes: `[workspace.package] version` bumped, `Cargo.lock` committed, step 10 planned. If no: step 10 skipped
- [ ] Memory contract changed? (step 1e): docs, rule and `Migration Notes` updated, `mewkit validate --memory` green

### Build and overlays

- [ ] Step 4 commands pass (cargo fmt, clippy, test, `npm test`, lint, hook tests, `npm run release:check`)
- [ ] Codex AND Cursor overlays updated where step 1d needs a hand edit; new skills in both `kit/overlays/*/catalog/skill-packs.json` files
- [ ] Step 1d verify commands pass (installed-tree checks, `sync-hook-core.cjs --check`, `mewkit validate --packs`, `bless_docs_manifest`); multi-provider smoke passes in both orders

### Release

- [ ] `prepare-release-assets.cjs` and `verify-release-assets.cjs` ran; `dist/meowkit-release.zip` has the expected size
- [ ] Committed, tagged `v<version>`, pushed; GitHub Release has `meowkit-release.zip` and `checksums.txt` only, with `mewkit init` install notes
- [ ] Binary changed: `mewkit-v<version>` tag pushed, release published, pin PR merged (step 10)
- [ ] `mewkit init` in an empty directory scaffolds the new version (step 11)
```

## Release Streams and Trust Model

Three things ship. Only two are released.

- **Kit**: `scripts/release.sh <version> "<title>"` tags `v<version>` and publishes `meowkit-release.zip` + `checksums.txt` to the GitHub Release. The zip carries `.claude/kit-contract.json`: `kitContract` (format version), `requires.mewkitMin` (oldest binary that can read this kit) and `kitVersion` (stamped from root `package.json` by `sync-versions.cjs`).
- **Binary**: the native `mewkit` CLI (alias `mk`) is released from this repo under its own `mewkit-v<version>` tags with no `.zip` asset, so kit consumers never mistake it for a kit. It fetches the kit zip and checks it against `checksums.txt`. See [Binary release stream](#binary-release-stream).
- **npm package (`mewkit`)**: retired. It is no longer released. See [Retiring the npm package](#retiring-the-npm-package).

**Trust model: checksums only.** MeowKit is open source and releases carry no signatures. `checksums.txt` is fetched from the same release as the zip, so it detects corruption and partial downloads, not a tampered release. Trust rests on GitHub, TLS and who can push tags.

**Never upload `meowkit-kit-*.tar.gz`, `kit-manifest.json` or `*.sig` to a release.** Older npm CLIs (up to 2.3.1) install from a signed kit artifact when a release carries one, and their trusted keyring is empty, so every install of that release would be refused. `verify-release-assets.cjs` fails if any of them sits in `dist/`. The signing engine and its scripts were removed.

### Binary release stream

**What a release is.** Pushing the tag `mewkit-v<version>` runs `.github/workflows/rust-release.yml`. The tag must equal `version` under `[workspace.package]` in `Cargo.toml`; the workflow fails otherwise. Bump that in a reviewed PR first. The workflow:

1. builds six targets: `{x86_64,aarch64}-unknown-linux-musl` (static), `{x86_64,aarch64}-apple-darwin`, `{x86_64,aarch64}-pc-windows-msvc` (static C runtime);
2. packs each as `mewkit-<version>-<target>.tar.gz` (Windows too: never `.zip`);
3. writes `checksums.txt` and `binary-manifest.json` (`version`, `channel`, `published_at`, `min_supported`, per-target `url`, `sha256`, `size`) from the archives;
4. creates the release as a draft, uploads everything, then publishes it with `--latest=false`. A version with `-` (e.g. `0.2.0-beta.1`) is a prerelease on the beta channel;
5. opens a PR `release/installer-pins-mewkit-v<version>` that re-renders `install.sh` and `install.ps1` with the new pins.

`workflow_dispatch` (Actions → "Rust release" → Run workflow) builds all six targets and publishes
nothing. **Run it once before the first tag**: it is the only proof that the arm64 runners build every
target.

**Installers.** `install.sh` and `install.ps1` place `mewkit` and `mk` (the same binary). For one
release they also place `mewkit-next` with a rename notice, then that name is dropped. An existing
`mk` that is not MeowKit is left alone and reported.

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
PATH, then a pre-rename `mewkit-next`; set `MEWKIT_NEXT_BIN` to point at another binary. A kit whose
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

Use the commit history to choose the kit bump. The mapping below applies to `.claude/` content. The
binary follows the same SemVer fields, but it only bumps when `crates/` changes; see step 3.

```
feat: new skill            → MINOR (1.0.0 → 1.1.0)
fix: skill bug             → PATCH (1.1.0 → 1.1.1)
feat!: breaking change     → MAJOR (1.1.1 → 2.0.0)
chore: cleanup             → no release
docs: update readme        → no release
```

For binary changes, use the SemVer table in step 3.

## Release Scripts

| Script                                  | Purpose                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/release.sh`                    | Kit release: version check → stamp → readiness gate → assets → commit → tag → push → GitHub Release |
| `scripts/release-check.sh`              | Readiness gate (`npm run release:check`): cargo build, bless tests, version sync, portable skills, kit contract, install check, `validate --portable` on the binary, npm test, lint, format check |
| `scripts/prepare-release-assets.cjs`    | Build the release manifest + `dist/meowkit-release.zip` + `dist/checksums.txt`   |
| `scripts/verify-release-assets.cjs`     | Check `dist/` before upload: contract in the zip, checksum, no signed-artifact asset |
| `scripts/generate-release-manifest.cjs` | Generate SHA-256 checksums for all release files                                |
| `scripts/kit-ship-set.cjs`              | The files a kit ships: `.claude/`, plus `kit/overlays/{codex,cursor}/` (`overlay.toml`, `files/`, catalogs) |
| `scripts/sync-hook-core.cjs`            | Copies the shared hook libraries from `.claude/hooks/lib/` into the overlays; `--check` exits 1 on drift |
| `scripts/sync-versions.cjs`             | Check or stamp the kit version into the derived surfaces, incl. `.claude/kit-contract.json`; records the binary version read from `Cargo.toml` |
| `scripts/lib/cli-version.cjs`           | Reads the binary version from `[workspace.package]` in the root `Cargo.toml`    |
| `scripts/release/build-binary-manifest.mjs` | Binary stream: `binary-manifest.json` + `checksums.txt` from the six archives (run by `rust-release.yml`) |
| `scripts/release/render-installers.mjs` | Binary stream: render `install.sh` / `install.ps1` from their templates and `installer-pins.json`; `--check` fails on drift |
| `scripts/release/check-kit-against-binary.sh` | Kit gate: `init --dry-run` of a staged kit for the three runtimes with a given binary |

## Release History

| Version | Date       | Title                                            |
| ------- | ---------- | ------------------------------------------------ |
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

### Binary release workflow fails at "Tag and crate version must agree"

**Cause:** The tag `mewkit-v<version>` does not equal `version` under `[workspace.package]` in the root `Cargo.toml`. The workflow refuses to build.

**Fix:** Delete the wrong tag as above, bump `Cargo.toml` in a PR, merge it, and tag the merged commit.

### GitHub Release exists but no zip

```bash
gh release upload v<version> dist/meowkit-release.zip dist/checksums.txt --clobber
```

### A Codex or Cursor install is missing a skill or rule after editing `.claude/`

**Cause:** A skill that is in no pack in `kit/overlays/<runtime>/catalog/skill-packs.json` is skipped by a pack-limited install. A Cursor rule exists only in `.claude/rules/` and was never written as a `.mdc` in the Cursor overlay. A hook edit in `.claude/hooks/` does not reach the overlay until it is copied.

**Fix:** Add the skill as `mk-<name>` to a pack in both `kit/overlays/codex/catalog/skill-packs.json` and `kit/overlays/cursor/catalog/skill-packs.json`. Write a Cursor rule under `kit/overlays/cursor/files/.cursor/rules/`. Run `node scripts/sync-hook-core.cjs` for hook libraries. Then run the verify commands and the multi-provider smoke in step 1d.

### Cursor installed no skills at all in a multi-provider project

**Cause:** Skills were written into a directory another runtime owns. Codex owns `.agents/skills/` and Cursor owns `.cursor/skills/` (`skills_root` in `crates/mewkit-adapters/src/projection/target.rs`).

**Fix:** Keep the trees separate. Both are documented load paths for their runtime; do not "unify" them. Re-run the multi-provider smoke in step 1d, in both install orders.
