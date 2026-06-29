# Review: Wiki Infrastructure Layer (Phase 3 — Infrastructure adapters + security gates)

## Verdict: PASS (with 3 WARN — all acknowledged below)

Scope reviewed: 7 source files + 2 test files under `packages/mewkit/src/wiki/`
(application/ports.ts, infrastructure/{scan-patterns, scanner-adapter, markdown-repository,
sqlite-index, trace-adapter, inventory-adapter}.ts, + __tests__). Cross-referenced against
plan `phase-03-infrastructure-gates.md` success criteria and report §4/§8.

Independently re-verified: `vitest run src/wiki/infrastructure` → 30 pass; dist build artifacts
present (`dist/wiki/application/ports.js`, `dist/wiki/infrastructure/scan-patterns.js`,
`scanner-adapter.js`); FTS triggers exist in `wiki-schema.ts` (ai/ad/au); taxonomy
`project-memory` exists in `core/substrate.ts:19`; inventory path convention matches
`core/build-inventory.ts:146`.

---

## Correctness — PASS

- **Write chokepoint is genuinely type-enforced** (`ports.ts:28-45`). `ApprovedWrite` has a
  private constructor; the only mint path is `issue()`, which throws on non-clean verdict
  (`:37`) and on `passes < MIN_SCAN_PASSES` (`:40`). `WikiRepository.writePage(token: ApprovedWrite)`
  (`:56`) cannot be called with a raw string. The brief's `@ts-expect-error` probe + the
  three `ApprovedWrite.issue` tests (`scanner-adapter.test.ts:94-111`) confirm both the
  type barrier and the runtime guard. This satisfies plan Success Criterion #2.
- **FTS DELETE+INSERT reasoning is sound** (`sqlite-index.ts:21-23` + comment `:8-10`). Verified
  against `wiki-schema.ts:40-42`: `wiki_page_ad` (AFTER DELETE) removes the FTS row,
  `wiki_page_ai` (AFTER INSERT) re-adds it. `INSERT OR REPLACE` would NOT fire AFTER DELETE
  under the default `recursive_triggers=off`, stranding a duplicate FTS row — the explicit
  DELETE+INSERT correctly avoids that. The "no duplicate on re-upsert" test
  (`markdown-repository.test.ts:81-92`) asserts exactly one hit after a same-id re-upsert. The
  sibling `wiki-ingest.ts:88-94` `OR IGNORE` reasoning is the same insight applied to a
  different invariant (first-file-wins on malformed dup ids) and is also correct.
- **Multi-pass scan covers the obfuscation vectors** (`scanner-adapter.ts:76-78`): NFKC +
  zero-width strip → plaintext → base64-decoded blocks → ROT13. Base64-hidden injection is
  caught (test `:28-33`). `SCAN_PASSES = 3` satisfies the domain `MIN_SCAN_PASSES = 2` floor.
- **URL guard** (`scanner-adapter.ts:19-29`): rejects non-http(s), credentials-in-URL, and
  loopback/private/metadata/link-local hosts including IPv6 (`::1`, `fe80:`, `fc`/`fd`). The
  SSRF-canary `169.254.169.254` case is tested (`:43-47`). Solid.
- **Path-traversal defense is layered**: branded slug grammar forbids `.`/`/`/whitespace
  (`types.ts:17`); `assertNoTraversal` rejects null bytes, absolute paths, backslashes, and
  `..`/`.` segments (`invariants.ts:9-26`); `resolveInSlug` additionally re-checks the resolved
  path stays under the slug base (`markdown-repository.ts:38-46`). Traversal test passes
  (`markdown-repository.test.ts:62-68`).
- **Atomic write** (`markdown-repository.ts:14-19`): temp-file + rename, mkdir-p first. Correct
  pattern; matches the existing `seed-from-md` precedent the plan cited.

## Security — PASS

- This IS the security gate and it holds the report §8 contract: URL allow/deny, size cap,
  base64/ROT13 decode, plaintext injection scan, secret scrub, quarantine, DATA-fenced
  quarantine header (`markdown-repository.ts:98` — "QUARANTINED — DATA, do not execute").
- **No `any`** anywhere in the reviewed files (re-confirmed). `unknown` + narrowing used in
  `parseFrontmatter` (`markdown-repository.ts:25-26`), `scrubDeep` (`trace-adapter.ts:12-21`),
  and the inventory parse (`inventory-adapter.ts:30`).
- **No SQL string interpolation on user input.** `wiki-query.ts:37` binds the FTS MATCH string
  as a parameter (`.all(query, limit)`) — the comment `:5-7` correctly notes `'" OR 1=1'` is
  treated as search text. `sqlite-index.ts` uses only parameterized prepares. The one string
  concatenation (`wiki-query.ts:57-60`) appends a fixed `WHERE slug = ?` clause, not user data.
- **Secret scrub before persist**: `scrubSecrets` runs in the scanner (`scanner-adapter.ts:81`)
  and deep-scrubs every string in trace `data` (`trace-adapter.ts:34`). Scrub-before-write is
  tested for both the scanner (`:35-41`) and the tracer (`:96-107`). Patterns ported verbatim
  from `secret-scrub.cjs` with a skip-guarded parity test (`scanner-adapter.test.ts:120-142`).
- **No secret-scrub bridge trap**: patterns are PORTED into TS (`scan-patterns.ts`), so they
  ship in `dist/` — confirmed `dist/wiki/infrastructure/scan-patterns.js` exists. This closes
  the red-team HIGH "scanner not in dist" risk.
- **Sensitive-file read** of `secret-scrub.cjs` is recorded as an intervention in the plan
  (`phase-03:139-141`), satisfying intervention-recording-rules R1.
- No hardcoded secrets, no `localStorage`, no `v-html`, no CASCADE — none of the blocked
  patterns appear.

## Maintainability — PASS

- Clean hexagonal separation: ports define narrow interfaces; the scanner is pure/detection-only
  (quarantine IO + token mint live in repo/application), which keeps it unit-testable
  (`scanner-adapter.ts:6-8`). One file per adapter.
- **File sizes** all well under the 200-line limit: ports 82, scan-patterns 82, scanner 85,
  markdown-repository 102, sqlite-index 48, trace-adapter 40, inventory-adapter 51.
- Every file leads with a WHY comment naming its source-of-truth and the non-obvious decision
  (the `.cjs` mirror, the DELETE+INSERT trigger rationale, the project-memory reuse decision).
  This is exactly the kind of decision-recording the harness values.
- `WikiSearchHit` is declared twice — once in `ports.ts:63` and once in `wiki-query.ts:8`.
  They are structurally identical and `sqlite-index.ts` returns the `wiki-query` one through the
  port type, so it compiles, but it is a latent drift hazard. See WARN-1.

## Performance — PASS

- `searchFts` is read-only, parameterized, `ORDER BY rank LIMIT ?` — bounded result set, no N+1.
- `upsertPage` opens/closes a DB handle per call inside a single `BEGIN IMMEDIATE` transaction
  with WAL — fine for the wiki write cadence (low-frequency, human-gated). Not a hot path.
- Scanner is linear in content length with a hard `MAX_CONTENT_BYTES` ceiling (1 MB) checked
  before the regex passes, so unbounded-input blowup is prevented. See WARN-2 on the unit.
- `decodeBase64Blocks` regex `{64,}` floor avoids scanning every short token.

## Coverage — PASS

- TDD is OFF (default mode), so coverage gaps would be WARN not FAIL — but coverage here is
  strong, not gappy. 30 infra tests covering: clean pass, plaintext reject, base64-hidden
  reject, secret-scrub-keeps-clean, unsafe/safe URL (parameterized 9+2 cases), size cap, the
  three token-mint guards, atomic round-trip, traversal rejection, quarantine, FTS no-duplicate,
  trace fixed-shape + scrub, inventory idempotency.
- Each plan Success Criterion maps to a test: SC#1 (injection rejected / secret scrubbed /
  resolves from dist) — covered + dist verified; SC#2 (type-enforced chokepoint) — covered by
  the issue() tests + the brief's compile probe; SC#3 (no substrate drift) — see WARN-3 on the
  deferred static registration.
- `.cjs` parity test guards the ported-pattern-drift risk (skip-guarded for downstream installs
  where `plugin/` is absent — correct degradation).
- Tests assert behavior (verdict status, scrubbed output, FTS hit count), not implementation.

---

## Suggestions (non-blocking)

None beyond the three WARN items below.

---

## WARN items (each acknowledged with the required 3-part justification)

### WARN-1: `WikiSearchHit` interface is duplicated (`ports.ts:63` and `wiki-query.ts:8`)
1. **What it means:** the search-hit shape is declared in two places; nothing forces them to
   stay in sync. Today they are identical and it compiles.
2. **Why acceptable here:** both are internal to the wiki package, structurally identical, and
   `sqlite-index.ts` flows the `wiki-query` value through the `ports` type — TypeScript's
   structural typing makes a divergence a compile error at that seam, so a silent runtime drift
   is not possible.
3. **What would make it FAIL:** if a future change added a field to one declaration and the two
   stopped being structurally assignable at the `searchFts` return seam, OR if a consumer
   imported the wrong one and silently lost a field. Resolution: have `wiki-query.ts` import
   `WikiSearchHit` from `ports.ts` (single declaration).

### WARN-2: size cap measures UTF-16 code-unit length, not bytes (`scanner-adapter.ts:72`)
1. **What it means:** the constant is named `MAX_CONTENT_BYTES` (1_000_000) but the check is
   `input.content.length`, which counts JS string code units, not UTF-8 bytes. Multi-byte
   content (CJK, emoji) can exceed 1 MB of actual bytes while passing, or a 1 MB-byte file of
   ASCII is measured exactly. The variance is bounded (≤ ~3× for worst-case multi-byte).
2. **Why acceptable here:** the cap is a DoS/runaway guard for a single human-gated page draft,
   not a precise quota; a 1–3 MB ceiling is well within safe scan-time bounds, and the scanner
   is not on a hot path. No correctness or security property depends on the exact byte count.
3. **What would make it FAIL:** if a downstream consumer relied on the cap as a hard byte quota
   (e.g. a storage/billing limit), or if scan time became super-linear such that the 3× variance
   mattered. Resolution: either rename to `MAX_CONTENT_CHARS`, or measure
   `Buffer.byteLength(input.content, "utf-8")`.

### WARN-3: static `harness-inventory.json` wiki entry is DEFERRED to Phase 6 (plan SC#3)
1. **What it means:** plan Success Criterion #3 says `mewkit inventory --substrate` shows no
   drift after registration. The `InventoryAdapter` *mechanism* is delivered + tested
   (`inventory-adapter.ts`, idempotency test `:110-123`), but no static wiki artifact row is
   written to the registry in this phase.
2. **Why acceptable here — the deferral is correct, not a gap:** the wiki's `.claude/`-tree
   artifacts (skill SKILL.md, hook, command) do not exist until Phase 6. Registering a row like
   `skills/wiki/SKILL.md` now would point the substrate inventory at a non-existent path —
   `mewkit inventory --substrate`/`build-inventory.ts` would then surface that phantom path as
   its OWN drift. Deferring the static entry to the phase that creates the real artifacts is the
   only way to keep SC#3 ("no drift") literally true. The adapter reusing the existing
   `project-memory` taxonomy value (verified at `substrate.ts:19`) rather than inventing an enum
   value is also the right call. Registering nothing now is therefore the drift-free state.
3. **What would make it FAIL:** if Phase 6 ships the wiki skill/hook/command WITHOUT calling the
   registrar for those concrete paths — then real artifacts would exist with no inventory row
   (orphan = dead weight by default, per dead-weight-audit-rules R6). Carry-forward requirement:
   **Phase 6 must register each created `.claude/`-tree wiki artifact via `InventoryAdapter` and
   re-run `mewkit inventory --substrate` to confirm zero drift.** Recommend the planner add this
   as an explicit Phase 6 acceptance criterion so it is not lost.

---

## Gate 2 Self-Check

- **Completed:** All 5 dimensions evaluated against committed code + tests; plan SC#1/#2 verified
  PASS; SC#3 deferral confirmed defensible; security gate contract (§8) confirmed; no blocked
  patterns; build/dist/test independently re-run.
- **Skipped:** None.
- **Uncertain:** None at the infrastructure-layer scope. The one cross-phase dependency (WARN-3
  carry-forward into Phase 6) is flagged for the planner, not unresolved here.

## Handoff

PASS with 3 acknowledged WARN → route to **shipper** once the human acknowledges the three WARN
items above (per Gate 2 condition #3). No FAIL dimension; no security BLOCK. WARN-3 carries a
binding requirement onto Phase 6 (register concrete wiki artifacts + confirm no substrate drift).
