# Contributing to MeowKit

MeowKit has two parts that live in this repository:

- **The kit**: skills, agents, rules and hooks, authored once in `.claude/`, plus what one runtime
  needs and cannot be derived in `kit/overlays/<runtime>/`.
- **The `mewkit` binary**: the Rust CLI in `crates/` that installs the kit on Claude Code, Codex,
  Cursor, Grok, Pi and OMP.

Release steps are in [RELEASING.md](RELEASING.md). This page covers making a change and getting it
through CI.

## Set up

Requirements: Rust (the toolchain pinned in `rust-toolchain.toml`; `rustup` installs it on first
use), Node.js 24+, pnpm, Python 3.9+ and Git.

```bash
pnpm install --frozen-lockfile
cargo build -p mewkit-cli --locked     # target/debug/mewkit
export MEWKIT="$PWD/target/debug/mewkit"
```

The CI steps below call the binary as `"$MEWKIT"`. Locally, use the same path or put
`target/debug` on your `PATH`.

## Make a change

1. Branch from `develop` as `feature/*`, `fix/*`, `refactor/*`, `chore/*` or `docs/*`, and open the
   pull request against `develop`; do not stack pull requests. `main` takes only release and hotfix
   branches (CI job `branch-policy`). Each merge into `develop` publishes a beta; see
   [RELEASING.md](RELEASING.md).
2. Edit the source, never a generated file. Skills and agents live in `.claude/`; a Codex, Cursor,
   Grok, Pi or OMP install is projected from them. Hand-edit an overlay only for the cases in
   [RELEASING.md step 1d](RELEASING.md#1d-update-the-runtime-overlays-when-claude-content-changes).
3. Keep shipped text runtime-neutral and free of the product name (RELEASING.md step 1f). Shipped
   files may name only files that exist in an install.
4. For a user-visible change, add a changelog fragment `changes/<your-branch>.md`
   ([changes/README.md](changes/README.md)) and update the docs page that describes the behavior.
   Never edit the changelog page or any version: releases compute both. CI requires a fragment when
   the PR touches `.claude/`, `kit/`, `crates/`, `.meowkit/` or `install.*`, unless it carries the
   `no-changelog` label.
5. Use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `build:`, `ci:`).
   A change to shipped kit content under `.claude/` is `feat:`, `fix:` or `refactor:`, because it
   reaches every installed project.

### The local ship check

When the kit is installed in your checkout's host, the `pre-ship` hook runs on `git commit`,
`git push`, `git merge` and `gh pr create|merge`. It lints the changed files, runs the tests related
to them and a type-check, and refuses the command when one fails. Fix the failure; do not bypass the
hook.

## What CI runs

These workflows run on a pull request to `develop` or `main`, and the release workflows after a merge.

| Workflow | File | Runs when |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | every pull request |
| Rust CI | `.github/workflows/rust-ci.yml` | a pull request or push to `main` or `develop` that touches `crates/`, `Cargo.*`, `deny.toml`, `rust-toolchain.toml`, `install.*`, `scripts/release/`, the kit the tests package (`.claude/`, `kit/overlays/` and the shipped `.meowkit/` files) or either Rust workflow |
| Release beta | `.github/workflows/release-beta.yml` | a merge into `develop` (publishes `vX.Y.Z-beta.N` and `mewkit-vX.Y.Z-beta.N`) |
| Release prepare | `.github/workflows/release-prepare.yml` | a push to `release/vX.Y.Z` or `hotfix/vX.Y.Z` (validates, commits the version and changelog, dry-runs the release, opens the PR into `main`) |
| Release stable | `.github/workflows/release-stable.yml` | a merge into `main` whose version is untagged |
| Binary build | `.github/workflows/binary-build.yml` | called by `release.yml`, or a manual run (builds six targets, publishes nothing) |
| Docs deploy | `.github/workflows/docs-deploy.yml` | a push to `main` (production) or `develop` (beta docs) that touches the docs or `.claude/` |

Run the full local set before you push:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked        # long: run it in the background
npm run lint
npm test
cd packages/docs && npm run check && npm run build
```

### Rust CI

| Check | Command | When it fails, fix it with |
| --- | --- | --- |
| Format | `cargo fmt --all --check` | `cargo fmt --all` |
| Clippy | `cargo clippy --workspace --all-targets --locked -- -D warnings` | Fix each warning. `RUSTFLAGS=-D warnings` also fails the build on any rustc warning. Do not add `#[allow]` without a reason in a comment |
| Test (Linux, macOS, Windows in 3 shards) | `cargo nextest run --workspace --locked --partition slice:<n>/<shards>`, plus `cargo test --workspace --doc --locked` on Linux. `cargo test --workspace --locked` runs the same tests locally | Run the failing test alone: `cargo test -p <crate> --test <file> <name>`. A Windows-only failure is usually a path separator, a line ending or a POSIX shell assumption. `reader_agreement` needs Node on `PATH` |
| `--locked` fails | any of the above | `Cargo.lock` is out of date: run `cargo build -p mewkit-cli` and commit `Cargo.lock` |
| cargo-deny | `cargo deny check advisories bans licenses sources` | A new advisory: update the crate (`cargo update -p <crate>`). A licence or source refusal: pick another crate, or change `deny.toml` with the reason in the pull request |

### CI: `validate` job

The job builds the binary once and runs every step below in order; the first failure stops it.

**Lint and tests**

| Check | Command | Fix |
| --- | --- | --- |
| Lint | `npm run lint` | Fix the ESLint finding in the named file |
| Test | `npm test` | Vitest suite: hooks, scripts and kit tests. Needs a fresh `target/debug/mewkit` (`cargo build -p mewkit-cli --locked`) |
| Hook regression tests | `node --test .claude/hooks/__tests__/*.test.cjs` | Run the named test file alone with `node --test <file>` |
| Skill script and contract tests | the `node …test…` and `bash tests/*.test.sh` steps | Each step names its script; run it locally and fix the skill it covers |
| Python skill tests (multimodal, figma, web-to-markdown, skill-creator, scale-routing) | `"$MEWKIT" skill env <skill>`, then the step's command | Each skill has its own environment from its own `requirements`. A missing package belongs in that skill's requirements, not in a shared environment |

**Generated files must match the code.** These tests render a file from Rust and compare it byte for
byte with the committed copy. When the change is intended, regenerate, review the diff, and commit
it:

| Step | Regenerate with |
| --- | --- |
| Substrate view and README/index counts | `MEWKIT_BLESS=1 cargo test -p mewkit-core --locked --test bless_substrate_view --test bless_inventory_counts` |
| Config schema | `MEWKIT_BLESS=1 cargo test -p mewkit-core --locked --test config_schema` |
| CLI reference shipped to projects | `MEWKIT_BLESS=1 cargo test -p mewkit-cli --locked --test cli_manual --test docs_cli` |
| Docs reference manifest (docs job) | `MEWKIT_BLESS=1 cargo test -p mewkit-core --locked --test bless_docs_manifest` |

`kit_verbs` has no bless: it fails when a skill tells an agent to run a `mewkit` verb that does not
exist. Fix the skill text or add the verb.

**Kit validators**

| Check | Command | Fix |
| --- | --- | --- |
| Authoring suite | `"$MEWKIT" validate` | Read the named finding; each one names the file and the rule |
| Workflow, gates, ownership, agents, packs, substrate, frontmatter, docs refs | `"$MEWKIT" validate --workflow`, `--gates`, `--ownership`, `--agents`, `--packs`, `--substrate`, `--frontmatter`, `--docs-refs` | Run the same flag locally. `--agents` rejects a model id that is not a registered profile; `--packs` fails when a skill is in no pack or `core` is over budget |
| Team memory | `"$MEWKIT" validate --memory` | Fix the entry format in `.meowkit/memory/*.md`. Write entries with `mewkit note`, not by hand |
| Codex bundle (Linux and Windows) | `init --target codex --kit-dir .` into a temp project, then `"$MEWKIT" validate --target codex <dir>` | Usually a broken Codex overlay file or a hook wrapper that is missing or not executable |
| Skills portable across runtimes | `node scripts/check-skills-portable.cjs` | A skill reaches its own files through `.claude/`, or names a tool that is not in the table. Use the skill-relative path |
| Own-skill paths | `node scripts/rewrite-own-skill-paths.cjs --check` | Run it without `--check` and commit the result |
| Skill cross-refs | `bash scripts/check-skill-cross-refs.sh` | A skill links to a file that does not exist; fix the path |
| Hook registration | `bash scripts/check-hook-registration.sh` | A hook in `.claude/hooks/` is not registered in `settings.json` / `handlers.json`, or the reverse |
| Instruction criteria | `node scripts/check-instruction-criteria.cjs --baseline scripts/instruction-criteria-baseline.json` | A file grew a finding the baseline does not hold (a host-foreign token, an unresolved reference). Fix the text; do not grow the baseline to pass |
| Always-on rule budget | `node scripts/check-always-on-budget.cjs .` | The rules every session loads exceed the byte budget. Move detail into a skill reference |
| Rule survival, dangling rule refs | `node scripts/check-rule-survival.cjs .`, `node scripts/check-dangling-rule-refs.cjs .` | A safety sentence was reworded away, or a file points at a rule that moved |
| Environment names | `node scripts/check-env-reads.cjs` | The kit reads an environment variable that is not in `env-name-classification.json`. Classify it there |
| Node-only executables | `node scripts/check-node-only-runtime.cjs .` | A shared executable needs something other than Node |
| Brand prose (changed files only) | `LINT_MODE=diff bash scripts/lint-brand-prose.sh` | A changed `.claude/` file names the product as a subject. Write "the toolkit" or "this workflow" |
| No `meow:` namespace | grep in the step | Use `mk:` and `/mk:` |
| Memory/wiki residue, terminology, dependency metadata, rule availability | the named `scripts/*` command | Run it locally; each prints the file and the line |

### CI: `docs` job

| Check | Command | Fix |
| --- | --- | --- |
| Typecheck | `npm run typecheck -w packages/docs` | Fix the MDX or TypeScript error it names |
| Docs manifest | `cargo test -p mewkit-core --locked --test bless_docs_manifest` | Bless as above when a documented path, env var or model id changed on purpose |
| Frontmatter, links, nav, stale values, prose, coverage | `npm run check:<name> -w packages/docs` | `links`: point at a page that exists. `nav`: add the page to its `meta.json` or a redirect. `stale`: replace the hard-coded value. `coverage`: a new skill or agent needs a reference page |
| Build | `npm run build -w packages/docs` | Chunk-size warnings are normal; errors are not |

### CI: `hooks-windows` job

Runs the hook suites (`npx vitest run tests/hooks`), the node-native hook tests,
`mewkit doctor --hard-gates` and the Codex install on Windows. A failure here and not on Linux
means a hook assumes a POSIX shell, a `/` path or LF line endings.

## Report a problem

Open an issue with the bug report template. Include `mewkit --version`, the output of
`mewkit versions`, the runtime and its version. For a security problem, do not open a public
issue; contact the maintainer privately.
