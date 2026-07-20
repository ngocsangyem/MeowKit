# System Architecture

For full meowkit system architecture see `meowkit-architecture.md`.

---

## Local Web Loopback + Visual-Plan Studio (v2.13.6)

The experimental `mewkit orchviz` visualizer (and its `src/orchviz/` module) was
removed in v2.13.6. Its loopback-server safety model survived as the reusable
primitives under `packages/mewkit/src/local-web/`, now consumed by the
`mewkit visual-plan` studio (`packages/mewkit/src/visual-plan/`, layered
domain → application → infrastructure → interface/server like the wiki subsystem).

### Shared Loopback Primitives (`src/local-web/`)

| Module | Guarantee |
| --- | --- |
| `local-server.ts` | Transient HTTP server bound to `127.0.0.1` only; no hosted service. |
| `host-guard.ts` | Host-header allowlist — blocks DNS-rebinding even on the loopback bind. |
| `origin-guard.ts` | Origin allowlist for state-changing requests (`127.0.0.1`/`localhost` + port, exact match). |
| `etag.ts` | sha256 content ETags; writes require `If-Match` — stale revision → 409, client re-fetches. |
| `atomic-write.ts` | Same-directory tmp file + `renameSync` (POSIX-atomic); tmp unlinked on failure. |
| `path-boundary.ts` | Resolved paths must stay inside the served root — no traversal. |
| `request-body.ts` / `static-handler.ts` / `open-browser.ts` | Size-capped body reads, strict-CSP static serving, browser launch. |

### Visual-Plan Studio (consumer)

- Canonical artifact: `{plan_dir}/visual-plan/plan.json` (schema `visual-plan/v1`) —
  coverage ledger + frames/connectors/annotations. The deterministic CLI owns
  `validate` / `status` / `approve --revision` (single writer of `review.status`) /
  `rehash` / `export --format html`.
- `edit` serves the studio with a single-editor lock; `view` is read-only.
  Wireframe HTML is sanitized at both save and render; pages serve under a strict CSP.
- Reviewer edits freeze into immutable feedback batches; `apply-feedback` is
  receipted and stale-safe (double-apply refused). An unresolved receipt op blocks
  `approve` at that revision.
- Editor-conflict semantics are unchanged from the old write surface: atomic rename
  means an external editor sees a complete new file version, never a partial write.

## Context Boundary

Three different concerns about "how much is loaded" are deliberately split
across three separate mechanisms. Confusing them is a recurring source of
mis-reported state.

| Concern                                   | Mechanism                                          | Unit             |
| ----------------------------------------- | -------------------------------------------------- | ---------------- |
| Cost                                      | `/mk:budget` + `harness/scripts/budget-tracker.sh`  | USD              |
| Window utilization & structural overhead  | `/mk:context-audit`                                 | tokens / %       |

`/mk:budget` answers "how much have we spent?" (monetary). `/mk:context-audit`
answers "how much of the context window is consumed by always-on `.claude/`
content?" (window utilization). The transcript cache answers "how big is the
running conversation?" — orthogonal to both above.

The 10% / 25% structural-overhead banners used by `/mk:context-audit` are the
canonical source of truth for window-utilization thresholds. They are NOT
linked to `MEOWKIT_BUDGET_*` env vars — those are USD amounts, not token
percentages.

## Rules Layout

Always-on rules: `.claude/rules/*.md` — auto-loaded by directory mechanism. Phase-zero conditional: same directory, but loaded explicitly by `mk:agent-detector` Step 0b only.

Agile/Scrum: 3 conditional rules in `.claude/rules-conditional/agile-*.md` — loaded by `mk:agent-detector` Step 0b only when an Agile context is detected (sprint-state contract, `jira_tickets:` frontmatter, `MEOW_JIRA_BASE_URL` env, or Jira-key prompt match). Non-Agile sessions pay zero context cost.

## Install Profiles & Packs (modular install)

The release ships ONE full tarball; install size is controlled at install time, not at packaging time. `.claude/pack-manifest.json` maps 7 profiles (`core`/`developer`/`product`/`atlassian`/`security`/`research`/`full`) onto the governance `owner` field plus a `base` essentials set (safety rules, all hooks, settings, statusline, core `/mk:*` commands).

- **Resolver** (`packages/mewkit/src/core/pack-resolver.ts`): a pure function turning a profile → the exact set of `.claude/`-relative paths. `full`/`*` short-circuits to `collectFiles` (byte-identical to today's install). Skills expand to their whole directory; `depends_on` closure is implemented but inert (no edges yet).
- **Filter** (`smart-update.ts`): an optional `allowedPaths` skip-predicate writes only a profile's files; `init --profile` records `profile`+`packs` in `metadata.json` (`full`/none ⇒ `packs: undefined` sentinel = auto-adopt). A profile downgrade (full→core) runs an opt-in trim pass (`trimToProfile`, init-only) that deletes pristine excluded files and preserves user-modified ones.
- **`mewkit pack`** (`commands/pack.ts`): `list`/`add`/`remove` manage domains post-install. `remove` deletes only pristine, pack-exclusive, kit-owned files — base-covered, dual-homed, settings.json-referenced, and user-edited files survive — and rebuilds metadata write-before-delete for crash safety.
- **Pack-aware `upgrade`**: reads `metadata.packs` (corrupt/absent ⇒ full); a partial install upgrades only its packs, removed packs stay removed.
- **Guardrails**: `mewkit validate --packs` (manifest coherence, completeness, the exact-path safety invariant) and `mewkit budget context --profile <p> [--fail-over N]` (loadable-context estimator) — both wired into CI. The safety invariant is enforced by an explicit exact-path assertion (not by registering dispatched files in the inventory, which would collide with the Phase-2 ownership check).

## Wiki Subsystem (`mewkit wiki`)

Long-term, gated, FTS-searchable project knowledge, built on clean layering under `packages/mewkit/src/wiki/`. The dependency direction is strictly inward: **interface → application → infrastructure → domain**.

- **domain/** — pure types + invariants (no IO): branded `WikiSlug`/`WikiPageId`, the salience rubric (`scoreSalience`, 9 components), `decideWrite` thresholds, and the state machine where *unscanned→approved* and *agent-origin→committed* are structurally impossible.
- **application/** — `WikiService` orchestrates the write order (scrub → scan → candidate-or-approve → atomic write → index upsert → trace). `commitWrite` is the SOLE caller of `repo.writePage`; `approveCandidate` is the SOLE canonical-page mint. `queries.ts` is read-only (CQS via `Pick<>` port slices). `research.ts` turns fetched DATA into candidates only.
- **handoff/** — a vertical slice that lets a knowledge-producing skill hand its terminal artifact to the wiki. `domain.ts` defines `WikiHandoffPacket`/`WikiHandoffRecord` (a superset of `ProposeInput`) + the `toProposeInput` mapper; `profile-factory.ts` + `profiles/*.ts` hold a per-skill registry (class **required/conditional/none** + salience defaults, one row per skill — adding a skill is a registry row, never a switch edit); `service.ts`'s `HandoffService` reads the artifact, **path-gates it** (rejects out-of-root + sensitive `.env`/`*.pem`/`*.key`/`*secret*`/`*credentials*`/`*.keystore` paths before any read), scans it, and proposes a candidate ONLY when salience clears the existing `decideWrite` gate and the scan is clean. `suggest` is read-only; there is no page-write path (no `writePage`/`approveCandidate` dependency).
- **infrastructure/** — `MarkdownWikiRepository` (atomic temp+rename canonical writes under `tasks/wikis/<slug>/`; `writePage` accepts only a scanner-issued `ApprovedWrite` token; `appendHandoff` writes `handoffs.jsonl`), `ScannerAdapter` (url-guard → size cap → multi-pass injection scan → secret scrub; TS port of `validate-content.cjs`/`secret-scrub.cjs` so it ships in `dist/`), `SqliteWikiIndex` (FTS over the consolidated `wiki-index.db`), `FetcherAdapter` (web/arXiv/GitHub; per-hop redirect re-validation), `TraceAdapter`, `InventoryAdapter`.
- **interface/** — `cli.ts` (`mewkit wiki <sub>`) is the only layer that constructs concrete adapters and injects them into the service; `render.ts` emits a self-contained (no-CDN, HTML-escaped) snapshot. Subcommands include `handoff suggest|propose|profiles`, the disciplined recall surface `context` (snippets only unless `--include-content`; returns a project-root-readable `path`), and full provenance flags on `propose` (`--origin`, `--source-id`, `--reuse-scope`, `--salience-json`, …).

**Anti-self-poisoning core:** external content and agent output are DATA. An agent can only propose a `WikiCandidate` — whether via `propose`, `research`, or `handoff` — never write a canonical page; canonical pages are written only via human `approve`, which always re-runs the scanner. The chokepoint is type-enforced (`ApprovedWrite` private constructor, minted only on a clean multi-pass verdict bound to scrubbed content). Recall (`context`) is read-only and DATA-bounded by `rules/wiki-context-rules.md`: wiki content never overrides rules or instructions, and the probe fails open when no index exists.

**Persistence:** canonical files in `tasks/wikis/<slug>/` (wiki.json, pages/*.md, sources/claims/candidates/interventions/seeds/**handoffs** JSONL) are the source of truth; `.claude/memory/wiki-index.db` (SCHEMA_VERSION 4 — trace + cost + wiki tables + FTS5, the additive v3 `wiki_handoff` + `wiki_candidate_source` relation, and the additive v4 `trace_events.task_id` + `plan_path` columns for task-joined queries) is derived and fully rebuildable via `mewkit wiki reindex` / `mewkit index`.

## High-assurance PR review pipeline (`src/review/`, `src/commands/review/`)

The `mewkit review *` command group + the `mk:review-pr --assured` lane run a
deterministic, evidence-gated PR review as a `ReviewSession` under
`tasks/reviews/<session>/`. All git/gh calls use array-argv `execFileSync` (no shell).

- **`review/schema.ts`** — canonical Zod contract (ReviewSession, ReviewManifest,
  EvidenceEvent, Finding, VerdictState, SubmitPayload); `ref`/`worktreePath` are
  regex-pinned to the `review-pr-` namespace. **`review/pr-target.ts`** parses a PR
  target and selects the BASE-repo remote (fork-safe, never guesses). **`review/impact-map.ts`**
  derives a deterministic, diff-scoped impact map + scout-escalation. **`review/roster.ts`**
  selects a scope-driven topology (small/medium/large tiers, whole-diff roles that
  per-chunk territory reviewers cannot own, heavy-file invariant slices).
  **`review/verdict.ts`** is the pure cap table; **`review/anchors.ts`** resolves inline
  comment anchors by snippet, never by agent-reported line number.
- **`commands/review/`** — `prepare` (isolated SHA-bound worktree via
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
  narrow extension (`.claude/scripts/validate-review-coverage.cjs`, called from
  `gate2-check.sh`) validates a review verdict's embedded coverage block.
