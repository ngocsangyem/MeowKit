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

## Install Targets (Codex, Cursor)

Codex and Cursor are **both hand-authored bundles** — nothing converts `.claude/` at
install time. The `mewkit migrate` verb and its converter pipeline are removed.

- **Bundle shape** — `kit/bundles/{codex,cursor}/`: a provider-native tree (`root/`) plus
  `catalog/` install packs (`skill-packs.json`; Cursor also carries `mcp-profiles.json`).
  Codex surfaces: `AGENTS.md`, `.codex/config.toml`, `.codex/rules/`, `.codex/agents/`,
  `.codex/hooks.json` + `.codex/hooks/`, `.codex/scripts/`, `.agents/skills/`. Cursor
  surfaces: `AGENTS.md` (installed as the always-applied rule
  `.cursor/rules/meowkit-core.mdc`) and `.cursor/{rules,agents,skills,hooks}`. Neither has a
  command surface.
- **Install** — `mewkit init --target codex|cursor` runs that runtime's emitter
  (`crates/mewkit-adapters/src/{codex,cursor}/`). Files map 1:1 onto the project, except
  the ones a user may own too: Codex merges a marked block into `AGENTS.md`, hook handlers
  into `.codex/hooks.json` and keys into `.codex/config.toml`; Cursor merges
  `.cursor/hooks.json` handler by handler. Each is recorded so uninstall takes out only what
  the kit added. A second run converges to zero drift; a user-edited kit file is kept and
  reported, never silently overwritten.
- **Upgrade** — `mewkit upgrade` refreshes the runtimes it finds an ownership index for. A
  runtime the npm CLI installed is adopted only by an explicit `init --target <tool>`.
- **Authoring cost** — new `.claude/` content reaches Codex or Cursor only by
  hand-authoring the matching provider-native file(s) in **both** bundles; see
  `RELEASING.md` step 1e. Neither target picks up kit changes automatically.

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
  one emitter per runtime in `crates/mewkit-adapters` (`claude_code`, `codex`, `cursor`) turns
  the kit into a `Plan` of owned-data ops; `crates/mewkit-core` executes every plan through one
  journal with backups, dry-run and an ownership index per runtime and scope. Cursor here is an
  emitter like the others, not a converter.
- **Scopes:** project (state in `.meowkit/`) and global (home directory, state in
  `~/.mewkit/state/`), honouring `CLAUDE_CONFIG_DIR` and `CODEX_HOME`.
- **Two release streams** (ADR [`261110-two-release-streams.md`](adr/261110-two-release-streams.md)):
  the kit ships on `v*` tags as `meowkit-release.zip`; the binary ships on `mewkit-v*` tags as
  six `mewkit-*.tar.gz` archives with `binary-manifest.json`, never as GitHub's latest
  release and never with a `.zip`, so deployed npm CLIs cannot mistake it for a kit.
  `install.sh` / `install.ps1` pin each archive by SHA-256 and size; no signatures.
  Neither stream is signed. npm CLIs ≤2.3.1 still prefer a signed kit artifact against an
  empty keyring, so releases must never carry one (`RELEASING.md`).
- **Proof:** `crates/mewkit-cli/tests/lifecycle_matrix.rs` runs install → doctor → edit →
  upgrade → uninstall for each runtime at both scopes.

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
