# Review: Wiki Index Consolidation (Phase 2 — `wiki-index.db`)

## Verdict: WARN

DATA_MODEL change consolidating the derived `index.db` into a unified `wiki-index.db`
(trace+cost v1 carried forward verbatim + new wiki tables/FTS5 v2). Reviewed read-only
against phase-02 success criteria and report §5. All five dimensions evaluated. Two
WARN findings (one correctness edge-case, one maintainability inconsistency — they are
the same root issue), no FAIL, no security BLOCK. Recommend routing to **shipper** with
the two WARNs acknowledged.

Independently re-confirmed during review:
- `npx vitest run src/core/__tests__/derived-index.test.ts src/wiki` → **67 tests pass**.
- `grep ': any' src/wiki src/core/derived-index.ts src/commands/index-command.ts` → **none**.
- Only string-built SQL anywhere is `"DELETE FROM " + table` (wiki-ingest.ts:174) with
  `table` drawn from the hard-coded `WIKI_TABLES` constant.
- FTS trigger behavior probed in an isolated `node:sqlite` harness (see Correctness §2/§5).

---

## Correctness — WARN

**Determinism (PASS).** `buildIndex` is delete→reindex→identical for the wiki tables.
`ingestWiki` clears every wiki table via `DELETE FROM <const>` (wiki-ingest.ts:173-175)
then re-reads the canonical tree; the rebuild test asserts `searchWiki(...)` before ==
after across a DB drop (derived-index.test.ts:176-184). The trace/cost path is unchanged
and still passes its own rebuild test (derived-index.test.ts:55-66).

**FTS5 standalone-table + trigger design (PASS).** I probed the exact DDL in isolation:
- `wiki_fts` is a standalone (non-external-content) FTS5 table synced by three triggers
  on `wiki_page` (AI/AD/AU) — wiki-schema.ts:39-42. For a full-rebuild ingest that only
  ever INSERTs and DELETEs pages, the AI + AD triggers are sufficient and correct; the AU
  trigger is dead in this ingest path but correct to keep for the Phase 3 live-write path.
- The `DELETE FROM wiki_fts` in the clear loop is **redundant** (the subsequent
  `DELETE FROM wiki_page` fires the AD trigger which clears the same rows) but **harmless
  and idempotent** — verified: clearing an already-empty `wiki_fts` is a no-op, and
  re-insert through the AI trigger rebuilds it with exactly one row per page.
- "No duplicate FTS rows across rebuilds" is both trigger-guaranteed and test-asserted
  (derived-index.test.ts:186-192) — confirmed 1 row after two consecutive builds.
- DELETE-by-`page_id` in the AD/AU triggers is correct: `page_id` is the join key
  `searchWiki` uses (`wiki_fts f JOIN wiki_page p ON p.id = f.page_id`, wiki-query.ts:37).

**[WARN-1] `wiki_page` uses bare `INSERT`, not `INSERT OR REPLACE` — crash path on
duplicate frontmatter `id`.** wiki-ingest.ts:88-90 is the *only* per-row insert that is
not `INSERT OR REPLACE`/`INSERT OR IGNORE`; every sibling table (wiki, source, claim,
seed, candidate, salience, intervention, link) tolerates duplicate keys. I reproduced the
failure in an isolated harness: a second `INSERT` with a duplicate primary key throws
`UNIQUE constraint failed: wiki_page.id`. This is reachable from canonical data — two
`pages/*.md` files in one slug whose frontmatter declares the same `id:` will throw an
**uncaught** exception out of `ingestSlug` → `ingestWiki` → `buildIndex`. The fallback id
`` `${slug}/${file}` `` (wiki-ingest.ts:96) is filename-unique, so the absent-`id` case is
safe; only an explicit duplicate `id:` triggers it.
- *Blast radius is bounded:* the DB is derived and `buildIndex` re-clears on every run, so
  no persistent corruption — a re-run after fixing the canonical file fully recovers. But
  `indexCommand` (index-command.ts:31) does not wrap `buildIndex` in try/catch, so the
  throw surfaces as an unhandled error from `mewkit index` rather than a graceful message.
- *Why WARN, not FAIL (3-part justification):*
  1. **What it means:** a malformed canonical wiki (two pages sharing an explicit `id`)
     aborts the whole index rebuild with an unhandled exception.
  2. **Why acceptable in this context:** Phase 2 ships no command that *writes* canonical
     pages — the scanner-gated write path arrives in Phase 3/4. Until then, canonical wiki
     trees are author-controlled and the duplicate-`id` state is not yet machine-producible;
     the index stays rebuildable so there is no data-loss vector. Sibling tables already use
     `INSERT OR REPLACE`, so the fix is a one-token change.
  3. **What would make it FAIL:** if Phase 2 also shipped a canonical write path that could
     emit two pages with the same `id`, OR if `buildIndex` were wired into an automatic/hook
     path where the throw could wedge a workflow. Either condition flips this to FAIL.
- *Suggested resolution:* change wiki-ingest.ts:89 to `INSERT OR REPLACE INTO wiki_page`
  (matches every sibling and the wiki-page-version semantics), and add a duplicate-`id`
  test fixture. Optionally wrap `buildIndex`'s call in `indexCommand` so a malformed tree
  degrades to a logged warning rather than an unhandled throw.

**Legacy `index.db` deletion (PASS).** `removeLegacyDb` (derived-index.ts:127-140) builds
its target solely from the hard-coded `LEGACY_DB_REL = memory/index.db` constant and only
appends the fixed suffixes `""`/`-wal`/`-shm`. There is no path that can be influenced by
user input, so it cannot ever touch a non-derived file. Deleting a derived, rebuildable
file is explicitly authorized by plan requirement 6 and the logs remain canonical — sound.
Test coverage at derived-index.test.ts:112-120 confirms the one-time cleanup.

## Maintainability — WARN

**[WARN-2] Insert-mode inconsistency (same root as WARN-1).** The lone bare `INSERT` for
`wiki_page` amid eight `INSERT OR REPLACE`/`INSERT OR IGNORE` siblings is a maintainability
smell independent of the crash: a future reader cannot tell whether the asymmetry is
intentional. Fixing WARN-1 resolves this. 3-part: (1) means an inconsistent convention
across one module; (2) acceptable now because the module is new and small (181 lines,
under the 200-line guard) and the fix is trivial; (3) becomes FAIL only if the asymmetry
is left and a second bare-INSERT table is added, entrenching the inconsistency.

Otherwise strong: files are small and single-purpose (schema 45 lines, ingest 181, query
67); no `any` (`unknown` + `s()`/`n()` guards used throughout); kebab-case filenames;
clear comments stating the security invariants at each chokepoint. The migration array
pattern (derived-index.ts:21-39) cleanly carries v1 verbatim and folds v2 in as
`WIKI_MIGRATION_SQL`. Domain types are mirrored into columns per the plan.

## Performance — PASS

Full-rebuild ingest is O(rows) with prepared statements reused across the loop
(pageStmt/linkStmt/srcStmt/… hoisted, wiki-ingest.ts:88-163). FTS maintenance is
trigger-driven, not a separate scan. `searchWiki` opens read-only, binds `MATCH ?` and
`LIMIT ?`, orders by `rank`, and closes in `finally` (wiki-query.ts:31-50). No N+1, no
unbounded fetch (caller-supplied `limit`, default 10), no blocking concern (CLI sync DB).
One micro-note (non-blocking): the redundant `DELETE FROM wiki_fts` is a negligible extra
statement; leaving it for defensiveness is a fine trade.

## Security — PASS

No security BLOCK. Re-ran the security-rules.md blocked-pattern checklist against the diff:
- **SQL injection:** all data inserts are parameterized prepared statements. The only
  string-concatenated SQL is `"DELETE FROM " + table` (wiki-ingest.ts:174) where `table`
  iterates the compile-time `WIKI_TABLES` constant (wiki-schema.ts:9-22) — never user
  input. `PRAGMA user_version = ${m.version}` (derived-index.ts:57) interpolates an integer
  literal from the in-code `MIGRATIONS` array, not external data. The FTS `MATCH` is bound
  (`.all(query, limit)`, wiki-query.ts:39), so a payload like `" OR 1=1` is treated as FTS
  search text — asserted by derived-index.test.ts:169-174.
- **No `any`**, no hardcoded secrets, no `localStorage`/`v-html`, no disabled validation.
- **No CASCADE DELETE** in the DDL; the FK-style relations are plain columns with
  app-level (trigger) maintenance — no implicit cascade data-loss vector.
- Read path opens `{ readOnly: true }` (wiki-query.ts:33,55); write path never runs from a
  hook (build is opt-in/explicit per index-command.ts header). Consistent with the plan's
  "external content and wiki pages are DATA" rule — though note Phase 2 ingests
  *author-controlled* canonical files only; the untrusted-content scanner gate is a
  Phase 3/4/5 concern and correctly out of scope here.

## Coverage — PASS

Default mode (TDD off) — coverage gaps are WARN-eligible, not FAIL. Coverage here is
genuinely strong for the phase, so PASS stands. 13 derived-index tests + wiki/FTS suite
cover: trace/cost aggregate build, deterministic rebuild, source-immutability, WAL+schema
stamp, query-before-build guard, empty-logs, schema-v2 stamp, legacy cleanup, wiki ingest
counts, FTS match with provenance+token estimate, SQL-ish-string-is-search-text, wiki+FTS
rebuild identity, and no-duplicate-FTS-across-rebuilds. This maps cleanly onto phase-02
success criteria 1-3 and the report §5 rebuildability invariant.

**Coverage gap (note, not a separate WARN):** no fixture exercises the duplicate
frontmatter-`id` path that WARN-1 identifies — that is precisely why the crash path went
unnoticed. A regression test should accompany the WARN-1 fix.

---

## Required Changes (if FAIL)

None — verdict is WARN, not FAIL. Nothing blocks Gate 2 approval.

## Suggestions (non-blocking)

1. **(addresses WARN-1 + WARN-2)** Change wiki-ingest.ts:89 `INSERT INTO wiki_page` →
   `INSERT OR REPLACE INTO wiki_page` to match all sibling tables and remove the
   duplicate-`id` crash path. Add a duplicate-`id` test fixture asserting graceful rebuild.
2. Optionally wrap the `buildIndex(claudeDir)` call in `indexCommand` (index-command.ts:31)
   in try/catch so a malformed canonical tree degrades to a logged advisory (consistent
   with the command's existing exit-0 "advisory, no gate" posture) rather than an
   unhandled throw.
3. Consider dropping the redundant `DELETE FROM wiki_fts` from `WIKI_TABLES` (the AD
   trigger already clears it on `wiki_page` delete) — minor; current code is correct and
   defensible as defensive.

## Gate 2 Self-Check

- **Completed:** all 5 dimensions evaluated with file:line evidence; 67-test pass, no-`any`,
  parameterization, FTS trigger behavior, and legacy-deletion safety independently verified.
- **Skipped:** none.
- **Uncertain:** none. WARN-1 reproduced directly in an isolated `node:sqlite` harness.

## Handoff

Route to **shipper** with WARN-1 and WARN-2 acknowledged (both resolved by a single
one-token change + one test). No **security** agent escalation required — Phase 2 ingests
author-controlled canonical files only and contains no SQL-injection or data-loss surface;
the untrusted-content gate is correctly deferred to Phase 3/4/5.
