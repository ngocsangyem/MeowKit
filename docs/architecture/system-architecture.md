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

## Observability & Simulation

The harness no longer blocks/passes silently — the controls feed one canonical event stream that three read surfaces turn into answers.

- **Canonical event log**: the existing `.claude/memory/trace-log.jsonl` (written by `append-trace.sh` — schema_version 1.0, secret-scrub, 50MB rotation) is the single event stream. The safety hooks emit typed events on every block via the `lib/emit-event.sh` helper (fire-and-forget; placed OUTSIDE each `{…} >&2` block and BEFORE `exit`, so emission never changes a hook's exit code/stream/marker): `gate.blocked` (`gate-enforcement.sh`), `privacy.blocked` (`privacy-block.sh`, sanitized descriptor — never the raw command), `injection.blocked` (`pre-task-check.sh`, advisory), and `hook.failed` (per-hook `trap ERR`, bash-only). Payloads carry descriptors + paths only. The taxonomy lives in `.claude/skills/trace-analyze/references/trace-schema.md`; `skill.invoked`/`memory.write` are reserved (no emitter yet → consumers render `N/A`). The TS reader `core/event-log.ts#readEvents` folds in-window rotated `.gz` archives, skips+tallies malformed and >64 KiB lines, and never throws.
- **`mewkit reflect`** (`commands/reflect.ts`): retrospective over the log — gate blocks (by gate·reason), hook failures, review outcomes (from `verdict_written`), repeated review failures. `--last`/`--task`/`--json`. Reserved/underivable metrics render `N/A`, never a fake zero.
- **`mewkit health`** (`commands/health.ts`): one-command control panel composing `checkHardGates`, `buildInventory`, `checkStaleIndex`, `computeContextBudget` (threshold sourced from the CI `--fail-over` cap, no fresh number), `checkMemoryHealth`, provider portability, plus event-derived panels (hook-failure COUNT — not an undefined-denominator rate; top repeated failures). Rolled-up `X PASS / Y WARN / Z FAIL`. Runs advisory (non-gating) in CI.
- **`mewkit simulate`** (`core/simulation-runner.ts` + `commands/simulate.ts`): declarative given→when→expect scenarios in `.claude/simulations/*.yaml` replayed against a scaffolded temp harness via the real configured hooks. The shared `assertOutcome` (PASS/FAIL/SKIP) is consumed by BOTH the runner and `doctor --hard-gates` — one assertion path. An allow-case where no hook matched → SKIP (never a vacuous PASS). Advisory in CI until `full-lifecycle` determinism is proven.
- **Harness mutation tests** (`core/__tests__/harness-mutation.test.ts`): adversarial "break the harness, assert it detects or fails safe" suite. Every mutation operates on the scaffolded `project.dir` only — an `afterAll` byte-equality guard proves the real `.claude/memory/` is untouched. Mutations with no detector (duplicate active plans, stale contract, unsupported provider metadata) ship as `test.todo`, never a fake pass.

## Long-Run Harness Evolution

Phase 5 turns evidence into reviewable recommendations. These surfaces are proposal-only unless the user runs an explicit mutating command.

- **`mewkit evolve`** (`commands/evolve.ts`, `core/evolution/*`): `suggest` / `report` aggregate event-log clusters, repeated review failures, malformed trace rows, and future memory/pack signals into `EvolutionSuggestion` records. Every suggestion carries evidence, confidence, impact, risk, and `neverAutoApply: true`.
- **Usage-based pruning** (`core/usage/usage-analyzer.ts`): `inventory --unused`, `inventory --rarely-used`, and `pack suggest-prune` render `N/A` while `skill.invoked`/`agent.invoked` emitters are absent. They never classify artifacts as unused from static metadata alone.
- **Memory lifecycle** (`memory/compact.ts`, `conflicts.ts`, `archive.ts`, `promote.ts`): `mewkit memory compact|conflicts|archive|promote` manages curated JSON stores. JSON stays canonical; markdown views regenerate from JSON. Conflicts surface instead of silently merging.
- **Provider matrix** (`commands/portability.ts`, `core/portability-matrix.ts`): `portability matrix|explain|coverage` exposes provider contract diagnostics as a product surface. Unsupported/disabled surfaces are not counted as PASS.
- **Gate policy profiles** (`commands/policy.ts`, `core/gate-policy.ts`, `.claude/policy.json`): `policy explain` and `policy set strict|balanced|lightweight` make gate strictness explicit. Missing policy keeps legacy hook behavior; malformed policy fails safe as strict. Privacy and prompt-injection blocks are never disabled by policy.
