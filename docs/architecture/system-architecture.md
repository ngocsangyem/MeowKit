# System Architecture

For full meowkit system architecture see `meowkit-architecture.md`.

---

## orchviz Write Surface (v1.2)

Introduced in `260501-orchviz-plan-writeback`. Extends the read-only v1.1
orchviz server with a POST endpoint for toggling individual todo checkboxes.

### Endpoints

| Method  | Path                | Description                                                        |
| ------- | ------------------- | ------------------------------------------------------------------ |
| GET     | `/api/plans`        | Array of non-archived plan summaries, mtime-desc, capped at 100.  |
| GET     | `/api/plan?slug=`   | Full plan state for a specific slug (or most-recent if no slug).   |
| POST    | `/api/plan/todo`    | Flip one todo checkbox in a phase file (atomic write).             |
| OPTIONS | `/api/plan/todo`    | CORS preflight for allowed origins.                                |

### Auth Model

- **Origin allowlist** (case-insensitive exact equality): only
  `http://127.0.0.1:<port>` and `http://localhost:<port>` are accepted.
- **No auth tokens** — orchviz binds `127.0.0.1` only; Origin guard prevents
  DNS-rebinding attacks without requiring secrets.
- **GET/HEAD** endpoints have no Origin check (read-only, no state change).
- **POST + OPTIONS** check Origin first — disallowed origin → 403 immediately,
  no ACAO header emitted.

### ETag Round-Trip

```
Client  →  GET /api/plan?slug=foo
           Server reads phase-NN-*.md, sha256 each file
           Returns { phaseEtags: { "1": "<hex64>", "2": "<hex64>", … } }

Client  →  POST /api/plan/todo { slug, phase, todoIdx, checked, etag }
           Server re-reads file, re-hashes
           If hash mismatch → 409 { error:"stale", currentEtag:"<new-hex64>" }
           Else → atomic-write via tmp+renameSync → invalidate cache
           Returns 200 { ok:true, changed:true, etag:"<new-hex64>" }
```

Stale 409 causes the UI to discard the optimistic flip and re-fetch the plan
so the latest file content is displayed.

### Atomic Write

Same-directory temp file + `renameSync` — POSIX rename is atomic on the same
filesystem. Implementation: `src/orchviz/plan/atomic-write.ts`.

- Tmp filename: `.orchviz-tmp-<6-byte-hex>` — phase glob regex excludes leading-dot files.
- Windows `EPERM` (file open in editor): single 50ms retry, then throw → HTTP 500.
- `finally` unlinks tmp on any rename failure — no orphans on throw.
- `cleanOrphanedTmps(planDir)` removes `.orchviz-tmp-*` files older than 5 min
  on first write per slug per process.

### Read-Only Mode

Set `MEOWKIT_ORCHVIZ_READONLY=1` in the environment before launching orchviz.
- POST `/api/plan/todo` → 405 `{ error:"readonly" }`.
- UI reverts to v1.1 disabled-checkbox display.
- All GET endpoints remain unaffected.

### Editor-Conflict Note

If a phase file is open in an external editor (vim/VSCode) when a UI write
occurs, the editor will display a "file changed externally" prompt. This is
expected behavior — orchviz does not coordinate with editor locks. The atomic
rename guarantees the file is never partially written from the editor's
perspective; the editor sees the complete new version.

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
- **infrastructure/** — `MarkdownWikiRepository` (atomic temp+rename canonical writes under `tasks/wikis/<slug>/`; `writePage` accepts only a scanner-issued `ApprovedWrite` token), `ScannerAdapter` (url-guard → size cap → multi-pass injection scan → secret scrub; TS port of `validate-content.cjs`/`secret-scrub.cjs` so it ships in `dist/`), `SqliteWikiIndex` (FTS over the consolidated `wiki-index.db`), `FetcherAdapter` (web/arXiv/GitHub; per-hop redirect re-validation), `TraceAdapter`, `InventoryAdapter`.
- **interface/** — `cli.ts` (`mewkit wiki <sub>`) is the only layer that constructs concrete adapters and injects them into the service; `render.ts` emits a self-contained (no-CDN, HTML-escaped) snapshot.

**Anti-self-poisoning core:** external content and agent output are DATA. An agent can only propose a `WikiCandidate`; canonical pages are written only via human `approve`, which always re-runs the scanner. The chokepoint is type-enforced (`ApprovedWrite` private constructor, minted only on a clean multi-pass verdict bound to scrubbed content).

**Persistence:** canonical files in `tasks/wikis/<slug>/` (wiki.json, pages/*.md, sources/claims/candidates/interventions/seeds JSONL) are the source of truth; `.claude/memory/wiki-index.db` (SCHEMA_VERSION 2 — trace + cost + wiki tables + FTS5) is derived and fully rebuildable via `mewkit wiki reindex` / `mewkit index`.
