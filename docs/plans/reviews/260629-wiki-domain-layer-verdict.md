# Review: Wiki Domain Layer (phase-01-domain-layer)

## Verdict: PASS (with 2 acknowledged WARN items)

Scope reviewed: 8 newly-created files under `packages/mewkit/src/wiki/domain/`
(types, invariants, salience, write-decision, index + 3 test files). Read-only
review — no files modified. The temporary adversarial probe spec was created in
`__tests__/` and removed in the same step (test input artifact, not a project edit).

Re-confirmed facts: `npx tsc --noEmit` exits 0; `npx vitest run src/wiki/domain`
→ 52 tests pass; `grep -rn ': any' src/wiki/domain` → none;
`grep IO-imports (fs/path/os/http/net/child_process/sqlite)` → none.

### Process note — missing review inputs (not a code defect)
The plan phase file (`tasks/plans/260629-meowkit-wiki-harness/phase-01-domain-layer.md`)
and the source report (`tasks/reports/brainstorm-260628-meowkit-wiki-harness-review.md`)
do **not exist** anywhere in the repo (`tasks/plans/` is empty; no `*260629*` or wiki
report files found). Acceptance criteria were graded against the criteria text quoted
in the review request (which mirrors the phase file) and against the in-code comments
that cite report §4/§5/§6. The salience component set, bounds, and §6 thresholds could
not be cross-checked against the authoritative report — they are graded as internally
consistent and defensible, not as verbatim-matching an unavailable source. (CF-C5)

---

## Correctness — PASS

All five acceptance criteria are met.

**AC1 — 11 domain types present.** All present and exported (types.ts):
WikiSlug:11, WikiPageId:13, InjectionVerdict:65, SalienceScore:92, WikiSource:99,
WikiClaim:108, WikiSeed:118, WikiCandidate:135, WikiPage:155, WikiIntervention:171,
WikiWriteDecision:186. (Plus supporting enums/interfaces — superset is fine.)

**AC2 — Invariants as pure validators.** All five enforced:
- No path traversal — `assertNoTraversal` (invariants.ts:9-26) rejects empty, null-byte,
  absolute (posix + windows), backslash, and `..`/`.` segments. Slug grammar
  (`WIKI_SLUG_PATTERN` types.ts:17) independently forbids `.`/`/`/whitespace.
- Canonical completeness — `assertCanonicalComplete` (invariants.ts:30-41) requires
  title+slug+createdAt+updatedAt+provenance.origin and re-runs the traversal check on `path`.
- External claim sourcing — `assertClaimHasSource` (invariants.ts:44-48).
- Unscanned cannot reach `approved` — enforced structurally by `ALLOWED_TRANSITIONS`
  (invariants.ts:52-59): `approved` is reachable ONLY from `scanned`. Verified by probe
  (no from-state other than `scanned` lists `approved`).
- Agent-origin cannot reach `committed` — `canTransition` (invariants.ts:88-90). Probe
  confirmed: agent origin is barred from `committed` from every from-state.

**AC3 — scoreSalience: 9 components + penalties + bounds.** salience.ts:8-18 declares
all 9 with inclusive bounds; `scoreSalience` (35-45) clamps each to its bound before
summing. Max +16 / min −8 verified by tests (salience.test.ts:22-43). NaN → component
min (salience.ts:23-25), tested.

**AC4 — decideWrite thresholds + canonical-page ban.** write-decision.ts:38-76 implements
the §6 precedence exactly: injection/secret → quarantine (43-48); high-dup+id → link
(50-56); ≥10 with verified signal → append-candidate (58-63); ≥8 → propose-candidate
(65-70); else discard (72-75). **CRITICAL defense verified:** the `WikiWriteDecision`
union (types.ts:186-191) has no page/commit variant — a canonical page write is
*structurally impossible* to return, not merely unreached at runtime. Confirmed by
test (write-decision.test.ts:106-114) and by the union shape itself.

Adversarial probes (run + removed) confirmed: agent→committed barred from all states;
verified signal + heavy penalty (total <8) → discard; salience 13 without verified
signal → propose (not append).

## Security — PASS

The two anti-self-poisoning defenses cannot be bypassed through the exported API:

1. **Self-commit ban is structural, defense-in-depth.** Two independent layers stop
   agent content from becoming canonical: (a) `decideWrite` cannot emit any page/commit
   decision (type-level), and (b) `canTransition` bars `agent`→`committed` (runtime).
   Even if an upper layer drove the state machine directly, the transition guard holds.
2. **Unscanned→approved ban is table-enforced.** `approved` is reachable only from
   `scanned`; there is no code path that promotes `proposed`/`quarantined`/`rejected`
   to `approved`. `from === to` and terminal-state exits are also blocked.
3. **Security wins over salience.** `decideWrite` checks scan verdict *first*
   (write-decision.ts:43), so a high-salience verified injection still quarantines —
   probe and test (write-decision.test.ts:61-70) confirm.
4. **No `any`, no IO, no secrets, no injection sinks.** Pure functions; the `as` casts
   are all benign (post-validation branded smart constructors at types.ts:29/36, the
   `Object.keys` key-narrowing at salience.ts:20, `{} as SalienceComponents` accumulator
   at salience.ts:36 immediately fully populated, and `as const`). No string-interpolated
   queries, no `process.env`, no network.

No BLOCK patterns from security-rules.md. No security-agent escalation warranted for a
pure, IO-free domain layer.

## Maintainability — PASS

- All source files ≤200 lines (types 197, invariants 105, write-decision 76, salience 45,
  index 5). Comments explain *why* (the self-commit rationale, the report citations).
- Discriminated unions used correctly (`WikiWriteDecision`, `WikiState`, `ScanStatus`);
  branded primitives prevent fabricated slugs/ids; thresholds and bounds each live in a
  single tunable constant (`SALIENCE_BOUNDS`, `SALIENCE_THRESHOLDS`).
- Type guards (`isWikiSlug`, `isClean`) and throwing smart constructors give callers a
  safe, total API. ESM `.js` import suffixes consistent with the package.

## Testing — PASS

52 tests across 3 specs cover every invariant, both threshold boundaries (8 exact, 7
just-below, 10 with/without verified signal), all clamp directions, NaN handling, every
transition edge (no-op, terminal exits, all three origins for commit), and the explicit
"never a page-write" guard. Tests assert behavior (decision kinds, throw/no-throw),
not implementation internals. Boundary and negative cases are strong.

Minor coverage gap (non-blocking): no test asserts `assertCanonicalComplete` reports
*multiple* missing fields at once, and the multi-pass-count concern (see WARN-1) is
untested because the domain does not model it.

## Conventions — PASS

kebab-case filenames; camelCase fns, PascalCase types, UPPER_SNAKE constants
(`WIKI_SLUG_PATTERN`, `SALIENCE_BOUNDS`, `SALIENCE_THRESHOLDS`); `__tests__/` colocated.
Zero-IO purity matches the stated mirror of the Rust `domain.rs`. The snake_case
salience component keys (types.ts:80-90) intentionally break the TS camelCase convention
to map 1:1 to the `wiki_salience` store — this is documented at the type and is a
defensible deliberate choice (DB-column-style identifiers), not an accident.

---

## Required Changes (FAIL items)
None.

## WARN items (each needs human acknowledgement before Gate 2 passes)

**WARN-1 — `isClean` gates on `status` only; multi-pass count is not enforced in-domain.**
- *Meaning:* `decideWrite` treats a verdict as clean when `status === "clean"` regardless
  of `passes` (write-decision.ts:12 → types.ts:72-74). A verdict of
  `{status:"clean", passes:0, findings:[...]}` reaches `append-candidate` (probe confirmed).
  Report §5 calls for a multi-pass scan.
- *Why acceptable here:* This is a *pure domain* layer. Producing a trustworthy
  `InjectionVerdict` (running N passes, deciding when `status` may be `clean`) is the
  scanner/application layer's job; encoding a minimum-pass floor here would duplicate that
  responsibility and couple the domain to scanner mechanics. The domain correctly makes
  `status` authoritative.
- *Becomes FAIL if:* the upper scanner layer (a later phase) does NOT enforce the
  multi-pass requirement before stamping `status:"clean"`, OR the domain is later expected
  to own that floor. Re-check at the scanner-layer review; if no layer enforces it, that
  layer FAILs, not this one.

**WARN-2 — Plan + source report artifacts absent from repo.**
- *Meaning:* The authoritative phase file and brainstorm report could not be located, so
  the salience rubric (component set, bounds, §6 thresholds) and the §4 invariant list
  were graded against the request text and in-code citations, not the source of truth.
- *Why acceptable here:* The criteria quoted in the request are precise and binary; the
  implementation is internally consistent with them and the in-code comments cite the
  report sections. No contradiction was found. The code stands on its own merits.
- *Becomes FAIL if:* the recovered report reveals the component names, bounds, or
  thresholds diverge from what was implemented (e.g. a different threshold than 8/10, or
  a missing/renamed component). Recommend the orchestrator restore or link the plan dir
  before ship so the audit trail is complete.

## Suggestions (non-blocking)
- Consider a test asserting `assertCanonicalComplete` aggregates multiple missing fields
  (the code already does — invariants.ts:31-38 — it's just untested).
- Optional: a `passes`-aware helper (e.g. `isCleanWithMinPasses(verdict, n)`) could live
  in the domain as a *pure predicate* for upper layers to call, keeping the multi-pass
  policy declarative without giving the domain IO. Only if a consumer wants it (YAGNI otherwise).

## Handoff
Recommend routing to **shipper** with the 2 WARN items acknowledged. Both WARNs carry the
required 3-part justification above; neither blocks on its own. Surface WARN-2 (missing
plan/report) to the human at Gate 2 — restoring the plan directory is advisable for the
audit trail even though it does not change the code verdict.
