# System Architecture

For full meowkit system architecture see `meowkit-architecture.md`.

---

## Retired local-web surfaces (historical)

No MeowKit CLI binds a local HTTP port any more. `mewkit orchviz` (and `src/orchviz/`)
was removed in v2.13.6; the `mewkit visual-plan` studio, the shared loopback primitives
it reused (`src/local-web/`) and `src/token-estimator/` were removed in the current
unreleased change. The code remains in git history.

## Context Boundary

Three different concerns about "how much is loaded" are deliberately split
across three separate mechanisms. Confusing them is a recurring source of
mis-reported state.

| Concern                                   | Mechanism                                          | Unit             |
| ----------------------------------------- | -------------------------------------------------- | ---------------- |
| Cost                                      | `mewkit budget` + `harness/scripts/budget-tracker.sh`  | USD              |
| Window utilization & structural overhead  | `/mk:context-audit`                                 | tokens / %       |

`mewkit budget` answers "how much have we spent?" (monetary). `/mk:context-audit`
answers "how much of the context window is consumed by always-on `.claude/`
content?" (window utilization). The transcript cache answers "how big is the
running conversation?" — orthogonal to both above.

The 10% / 25% structural-overhead banners used by `/mk:context-audit` are the
canonical source of truth for window-utilization thresholds. They are NOT
linked to the `budget.*` config keys — those are USD amounts, not token
percentages.

## Rules Layout

Always-on rules: `.claude/rules/*.md` — auto-loaded by directory mechanism. Phase-zero conditional: same directory, but loaded explicitly by `mk:agent-detector` Step 0b only.

Agile/Scrum: 3 conditional rules in `.claude/skills/agent-detector/references/agile-*.md` — loaded by `mk:agent-detector` Step 0b only when an Agile context is detected (sprint-state contract, `jira_tickets:` frontmatter, `MEOW_JIRA_SITE_URL` env, or Jira-key prompt match). Non-Agile sessions pay zero context cost.

## Install Profiles & Packs (modular install)

The release ships ONE full kit zip; install size is controlled at install time, not at packaging time. `.claude/pack-manifest.json` maps 7 profiles (`core`/`developer`/`product`/`atlassian`/`security`/`research`/`full`) onto the governance `owner` field plus a `base` essentials set (safety rules, all hooks, settings, statusline, core `/mk:*` commands).

- **Selection** (`crates/mewkit-adapters/src/claude_code/selection.rs`): no packs means the whole tree; named packs install base plus those packs (a profile is flattened to its packs first), and a disabled skill leaves its directory out. `init --profile` re-run with a narrower profile removes what it no longer includes, unless the user edited it.
- **`mewkit pack`** (`crates/mewkit-cli/src/commands/pack/`): `list`/`add`/`remove` manage domains post-install. `add` is a scoped install; `remove` deletes only pristine, pack-exclusive, kit-owned files (`crates/mewkit-core/src/pack_removal.rs`) — base-covered, dual-homed, settings.json-referenced and user-edited files survive.
- **Pack-aware `upgrade`**: a partial install upgrades only its packs; removed packs stay removed.
- **Guardrails**: `mewkit validate --packs` (manifest coherence, completeness, the exact-path safety invariant) and `mewkit budget context --profile <p> [--fail-over N]` (loadable-context estimator) — both wired into CI.

## Install Targets (Codex, Cursor, Grok, Pi, OMP)

Codex, Cursor, Grok, Pi and OMP content is **projected from `.claude/` at install time**, plus a
small overlay. There is no stored copy of the kit for any of them. The `mewkit migrate` verb and
its converter pipeline are removed.

- **Projection** — `crates/mewkit-adapters/src/projected_kit.rs` reads the kit's `.claude/`
  skills and agents and rewrites them for the runtime (`crates/mewkit-adapters/src/projection/`):
  skill names and invocations, paths, host words, helper paths anchored at the project root,
  and agents as Codex `.toml`, as Cursor Markdown carrying only the frontmatter keys Cursor
  documents, or as plain prompt files with `name` and `description` and no model (Grok, and
  the shared `.agents/` tree below). It then adds the runtime's overlay.
- **Overlay shape** — `kit/overlays/{codex,cursor,grok}/`: `overlay.toml` (frontmatter keys per
  skill or agent, `omit` for files the runtime does not get, `[[replace]]` lines for text
  that belongs to one runtime), `files/` installed as they are (hooks and their libraries,
  `hooks.json` (Grok: `.grok/hooks/meowkit.json`), Codex `config.toml` and
  `rules/default.rules`, Cursor `.mdc` rules,
  rubrics, `scripts/bin` helpers) and `catalog/` install packs
  (`skill-packs.json`; Cursor also carries `mcp-profiles.json`). The shared `.agents/` tree has
  its own overlay, `kit/overlays/agents/` (`overlay.toml`, `catalog/skill-packs.json`, and in
  `files/` the guard script, its hook libraries, rubrics and helpers); `kit/overlays/pi/` and
  `kit/overlays/omp/` hold only `files/` with the runtime's own hook file. The always-on text
  for every runtime that reads the project's `AGENTS.md` is one file,
  `kit/overlays/shared/AGENTS.md`. Claude Code does not use it: it keeps `.claude/rules/`, and
  `CLAUDE.md` does not import `AGENTS.md`.
- **The shared `.agents/` tree** — Codex, Pi and OMP all read skills from `.agents/skills`, so
  each of their emitters installs one tree (`crates/mewkit-adapters/src/agents_tree.rs`):
  skills in `.agents/skills`, and in `.agents/meowkit/` the files skill text names by path
  (helper scripts, rubrics, agent prompts as plain files) and one guard script,
  `.agents/meowkit/hooks/guard.cjs`. The wording depends on the set installed in the project.
  Alone, a runtime writes its own: Codex as before, with its helpers under `.codex/`; Pi and
  OMP with `/skill:mk-<name>` invocations. With two or more of the three, every one of them
  writes the same neutral wording (skills named in prose, "this runtime", paths under
  `.agents/meowkit/`), byte for byte, and Codex's installed files are written again in that
  wording when a second sharer arrives. Cursor reading `.agents/skills` beside its own
  `.cursor/skills` does not count as a sharer and does not change the wording.
- **Installed surfaces** — Codex: an `AGENTS.md` block, `.codex/config.toml`,
  `.codex/rules/`, `.codex/agents/`, `.codex/hooks.json` + `.codex/hooks/`,
  `.codex/scripts/`, `.agents/skills/` (plus `.agents/meowkit/` when it shares the tree).
  Cursor: `.cursor/{rules,agents,skills,hooks}` and,
  in project scope only, the same `AGENTS.md` block (a global Cursor install writes no
  `AGENTS.md`); `.cursor/rules/runtime-invariants.mdc` (always applied) holds only
  Cursor-specific text. Grok (project scope only): skills in `.grok/skills/mk-*`, one kit
  hook file `.grok/hooks/meowkit.json`, the same `AGENTS.md` block, and everything Grok does
  not load itself (hook scripts, helper scripts, rubrics, agent prompts) under
  `.grok/meowkit/`. No Grok agent definition is written: the vendor page
  (https://docs.x.ai/build/features/subagents) names `.grok/agents/` but no file format, so
  the agent prompts sit in `.grok/meowkit/agents/` as files a skill reads. Pi (project scope
  only): the shared tree, the same `AGENTS.md` block and one extension,
  `.pi/extensions/meowkit.ts`; no agents, since Pi has no subagents (the install notice says a
  skill that hands work to an agent runs it in the main session). OMP (project scope only):
  the shared tree, the same `AGENTS.md` block, the hook module `.omp/hooks/pre/meowkit.ts`,
  `.omp/agents/*.md` (below) and, only when Claude Code is in the set, `.omp/config.yml`
  with `disabledProviders: [claude]`, so OMP does not list a second copy of each skill from
  `.claude/`; that switch turns off everything OMP imports from `.claude/`, not skills alone,
  and the install notice says so. None of these runtimes gets a command surface.
- **OMP agents** — one `.omp/agents/<name>.md` per agent prompt, with `name`, `description`
  and a `tools` list holding only OMP built-in tool names (mapping in
  `crates/mewkit-adapters/src/omp/agents.rs`). OMP uses `tools` as the allow-list and keeps an
  unknown name as written, where it matches nothing, so authored tools with no built-in are
  left out and named in the install summary. No `model` is written: OMP treats it as optional
  and no tier mapping is documented.
- **Install** — `mewkit init --target codex|cursor|grok|pi|omp` runs that runtime's emitter
  (`crates/mewkit-adapters/src/{codex,cursor,grok,pi,omp}/`), which builds its plan from the
  projected kit. Files map 1:1 onto the project, except
  the ones a user may own too: Codex, Cursor, Grok, Pi and OMP all merge the shared text into
  `AGENTS.md` as the marked block `meowkit` (`crates/mewkit-adapters/src/agents_block.rs`), so
  a project with several of them carries it once; Codex merges hook handlers into `.codex/hooks.json` and
  keys into `.codex/config.toml`; Cursor merges `.cursor/hooks.json` handler by handler. Grok
  merges nothing into a hook file: it loads every `*.json` in `.grok/hooks/`, so the kit
  writes its own `meowkit.json` whole and the user's hooks stay in their own files. Pi and OMP
  merge nothing either: each loads the kit's module as its own file. OMP's `.omp/config.yml`
  is a whole file; one the user already has is left alone and the notice asks for the line.
  Each merge is recorded so uninstall takes out only what the kit added. A second run
  converges to zero drift; a user-edited kit file is kept and reported, never silently
  overwritten.
- **Overlapping installs** — two installs can own the same block or the same file. The
  `meowkit` block in `AGENTS.md`: `mewkit uninstall --target` for one runtime leaves it while
  another installed runtime's ownership index still records it. A whole file in the shared
  `.agents/` tree: the executor records a file whose bytes already match the plan as owned
  without rewriting it, so each sharer's index lists it; `uninstall` keeps a file a staying
  install also owns (it leaves only the leaving install's record) and then plans each staying
  sharer again for the set that remains, so its files return to the wording it would have
  been installed with and a later uninstall recognises them. That re-plan needs the kit the
  staying install came from; without it the files keep the shared wording and a notice names
  `mewkit upgrade --target <runtime>`. In the other direction, `init` plans an installed sharer
  again, first, when a newcomer shares the tree with it, so both write the shared wording.
  `init codex` → `init omp` → `uninstall omp` leaves the tree of a fresh `init codex`
  (`crates/mewkit-cli/tests/lifecycle.rs`).
- **Grok hooks** — `.grok/hooks/meowkit.json` registers two handlers, both on `PreToolUse`,
  the only Grok event whose output can block: the privacy guard on every tool call and the
  ship check on `Bash`. A Grok hook stopped at its
  timeout lets the call through (https://docs.x.ai/build/features/hooks), so on Grok neither
  guard fails closed.
- **Pi and OMP hooks** — the Pi extension and the OMP hook module both run
  `.agents/meowkit/hooks/guard.cjs` (the privacy decision on every tool call, the ship check on
  a shell command) through `pi.exec`, and block the call on any answer but an allow. The
  completion check is not ported to either. Pi loads `.pi/extensions` and the project's
  `.agents/skills` only in a project the user has trusted (install notice and a `pi trust`
  doctor row); OMP has no trust step, so its hook module runs from the first session, which
  the install output states. Nothing about Pi has been probed on a running Pi; its surfaces
  follow the vendor documentation (`docs/maintainer/host-probe-log.md`, X12). OMP's forms were
  read from its source, and OMP 18.13.3 was observed listing each `mk-*` skill once in a
  project holding all six installs (X13, X14).
- **Validation** — `mewkit validate --target grok|pi|omp` checks the installed tree of that
  runtime.
- **Scope support** — `Emitter::supports(ScopeKind)` (default: every scope) says where a
  runtime can be installed. Grok, Pi and OMP support project scope only: `--target all` at
  global scope leaves them out (it covers six runtimes in a project and Claude Code, Codex and
  Cursor globally), and a named `--global --target grok|pi|omp` is refused by the emitter.
- **Upgrade** — `mewkit upgrade` refreshes the runtimes it finds an ownership index for. A
  runtime the npm CLI installed is adopted only by an explicit `init --target <tool>`.
- **Authoring cost** — a `.claude/` skill or agent reaches Codex, Cursor, Grok, Pi and OMP with
  no second edit. Still written by hand: the always-on `AGENTS.md` text (once, shared by every
  runtime but Claude Code) and, per overlay, hooks, Cursor rules and pack membership in each
  `catalog/skill-packs.json`. The hook
  libraries listed in `.claude/hooks/core-closure.json` are copied into each overlay that
  carries hook scripts by `scripts/sync-hook-core.cjs`. See `RELEASING.md`.
- **Placement** — `crates/mewkit-adapters/src/placement_resolver.rs` (data in
  `crates/mewkit-adapters/src/surface_table.json`, described in
  [`docs/maintainer/runtime-surface-table.md`](../maintainer/runtime-surface-table.md))
  computes, for the set of runtimes sharing a project, which roots to write so each runtime
  loads each kind of content once. Emitters receive it in `EmitRequest.placement`. The Codex,
  Pi and OMP emitters act on it: it decides whether the `.agents/` tree takes the shared
  wording, Pi and OMP turn its list of foreign folders they also read into install notices,
  and OMP writes `.omp/config.yml` from its switches. Every `Runtime` has an emitter
  (`registry::NOT_YET_EMITTED` is empty).
- **Kit contract** — the kit declares contract 2 (`.claude/kit-contract.json`) and
  `crates/mewkit-core/src/kit/contract.rs` accepts exactly 2, so an older binary refuses
  this kit and asks for `self-update`.

## The `mewkit` binary and the two release streams

`crates/` holds the one CLI, the native `mewkit` binary (`mk` is the same binary, linked beside it on Unix and copied on Windows, and the
pre-rename name still runs for one release with a notice). It replaced the npm
`mewkit` package, which is deleted; see
[`docs/maintainer/npm-cli-retirement.md`](../maintainer/npm-cli-retirement.md).

- **Verbs** — the install lifecycle (`init`, `upgrade`, `uninstall`, `doctor`, `providers`,
  `versions`, `self-update`) plus `plan` (`status`, `check`, `approve`, `archive`),
  `task`, `task-state`, `note`, `orient`, `validate`, `review`, `verdict-gate`, `advice`,
  `trace`, `budget`, `setup`, `skill env`, `pack`, `capabilities` and `backups`, with the
  logic in `mewkit-core` (`plan_doc`, `task_files`, `task_state`, `task_store`, `note`,
  `orient`, `validate`, `review`, `verdict_gate`, `advice`, `trace_analysis`, `budget`,
  `setup`, `skill_env`, `system_deps`, `toolchain` (the one place Python, pip and package
  managers are spawned), `pack_removal`, `mcp_profiles`, `capability`, `snapshot`,
  `baseline`). The verbs ported from the npm CLI parse argv with its minimist tolerance
  (`crates/mewkit-cli/src/argv_compat.rs`), so invocations written against that CLI keep
  running.
- **Behaviour record** — what the npm CLI did on each case was recorded before it was
  deleted and is frozen in `crates/mewkit-cli/tests/golden/npm/`;
  `cargo test -p mewkit-cli --test npm_behaviour` holds the binary to it, and
  `tests/golden/DIVERGENCES.md` lists the deliberate differences.
- **Hooks** — the kit's hooks stay Node scripts. They reach the CLI through the committed
  launcher `.meowkit/bin/mewkit` (via `.claude/runtime.json`), which runs the binary.
- **Adapter contract** (ADR [`261110-rust-adapter-contract.md`](adr/261110-rust-adapter-contract.md)):
  one emitter per runtime in `crates/mewkit-adapters` (`claude_code`, `codex`, `cursor`, `grok`,
  `pi`, `omp`; six registered) turns the kit into a `Plan` of owned-data ops (Codex, Pi and OMP
  build the shared `.agents/` tree through `agents_tree`); `crates/mewkit-core` executes every plan through one
  journal with backups, dry-run and an ownership index per runtime and scope. Cursor here is an
  emitter like the others, not a converter.
- **Scopes:** project (state in `.meowkit/`) and global (home directory, state in
  `~/.mewkit/state/`), honouring `CLAUDE_CONFIG_DIR` and `CODEX_HOME`. Grok, Pi and OMP have no
  global scope (see Scope support above).
- **Two release streams** (ADR [`261110-two-release-streams.md`](adr/261110-two-release-streams.md)):
  the kit ships on `v*` tags as `meowkit-release.zip`; the binary ships on `mewkit-v*` tags as
  six `mewkit-*.tar.gz` archives with `binary-manifest.json`, never as GitHub's latest
  release and never with a `.zip`, so deployed npm CLIs cannot mistake it for a kit.
  `install.sh` / `install.ps1` pin each archive by SHA-256 and size; no signatures.
  Neither stream is signed. npm CLIs ≤2.3.1 still prefer a signed kit artifact against an
  empty keyring, so releases must never carry one (`RELEASING.md`).
- **Proof:** `crates/mewkit-cli/tests/lifecycle_matrix.rs` runs install → doctor → edit →
  upgrade → uninstall for Claude Code, Codex and Cursor at both scopes and for Grok, Pi and OMP at project
  scope. Their plans are also tested in `crates/mewkit-adapters/tests/` (`emit_grok.rs` for
  Grok, `emit_agents_tree.rs` for the shared tree), and the set changes of the shared tree in
  `crates/mewkit-cli/tests/lifecycle.rs`.

## Team memory store

Non-derivable project knowledge lives in two committed, plain-markdown files:
`.meowkit/memory/decisions.md` (why a non-obvious choice was made) and
`.meowkit/memory/gotchas.md` (what a real failure taught). There is no index, no JSON
store, and no generated view.

- **Read** — five skills (`mk:fix`, `mk:investigate`, `mk:review`, `mk:plan-creator`,
  `mk:cso`) run one `grep -rilE "<kw1|kw2|kw3>" .meowkit/memory/` at task start and open
  only the matching entries. No always-on rule, no auto-injection.
- **Write** — `mk:fix`, `mk:review`, `mk:retro`, `mk:memory`, and the `architect` agent;
  `mk:party` and `mk:plan-creator archive` write `decisions.md` only. Each
  appends one entry when the lesson is non-derivable. There is no hook capture; a human asks
  for something to be remembered and the agent writes it. A failed write prints one line.
- **Boundary** — content is DATA (`rules/injection-rules.md` Rule 3): it never overrides a
  rule, grants a permission, or bypasses a gate. Security findings and secrets never enter
  the store; they stay in `mk:cso` reports and Gate 2 verdicts.
- **Governance** — the store ships in the PR diff, so git review replaces a scanner gate.
  `mewkit validate --memory` lints size (≤300 lines per file), the injection patterns in
  `.claude/hooks/lib/validate-content.cjs`, and secret patterns. `mk:memory --prune`
  proposes removals; every removal is human-approved.

The earlier wiki subsystem (gated pages under `tasks/wikis/`, SQLite FTS index,
propose/approve chokepoint, handoff-class registry, recall envelope) was removed in v3: it
had zero recorded use, and `grep` over two committed files covers the same need. The code
remains in git history.

## High-assurance PR review pipeline (`crates/mewkit-core/src/review/`)

The `mewkit review *` command group + the `mk:review-pr --assured` lane run a
deterministic, evidence-gated PR review as a `ReviewSession` under
`tasks/reviews/<session>/`. All git/gh calls pass an argument vector, never a shell string (`review/exec.rs`).

- **`review/session.rs`** — the session contract (ReviewSession, ReviewManifest,
  EvidenceEvent, Finding, VerdictState, SubmitPayload); `ref`/`worktreePath` are
  regex-pinned to the `review-pr-` namespace. **`review/pr_target.rs`** parses a PR
  target and selects the BASE-repo remote (fork-safe, never guesses). **`review/impact_map.rs`**
  derives a deterministic, diff-scoped impact map + scout-escalation. **`review/roster.rs`**
  selects a scope-driven topology (small/medium/large tiers, whole-diff roles that
  per-chunk territory reviewers cannot own, heavy-file invariant slices).
  **`review/verdict.rs`** is the pure cap table; **`review/anchors.rs`** resolves inline
  comment anchors by snippet, never by agent-reported line number.
- **Stages** (`review/{prepare,read,coverage,compose,submit,cleanup}.rs`, wired in
  `crates/mewkit-cli/src/commands/review/`) — `prepare` (isolated SHA-bound worktree via
  `worktree.cjs review-pr` + immutable hash-pinned diff + `untrusted/` quarantine +
  roster/briefs), `read` (path-confined evidence-recording wrapper), `coverage`
  (roster ∩ evidence gap gate + evidence level), `compose` (the mechanical gate: verify
  diff hash → re-run coverage → cap table → anchors → verdict-gate-compatible proof
  bundle + SubmitPayload; a PASS is impossible without complete, session-observed
  coverage), `submit` (the sole GitHub write — `--reply` + payload-hash-bound
  confirmation + head-SHA recheck + idempotency), `cleanup` (manifest-owned worktree
  removal; keeps the session audit trail).
- **Worktree safety** (`.claude/skills/worktree/scripts/lib/worktree-review-pr.cjs`):
  a review worktree is detached and owned by a manifest nonce; cleanup removes only a
  worktree whose in-worktree back-reference nonce matches — the user's checkout and
  unrelated feature worktrees are provably untouchable.
- **Evidence honesty:** subagent tool calls do not reach the parent PostToolUse
  dispatcher and carry no agent id, so `session-observed` (Bash-hook-corroborated) is
  anti-accidental, not unforgeable, and proves session-level (not individual-reviewer)
  access; subagent-driven reviews are `attested` and cannot earn Approve. The Gate 2
  narrow extension (`.claude/hooks/lib/validate-review-coverage.cjs`, called from
  `gate2-check.cjs`) validates a review verdict's embedded coverage block.
