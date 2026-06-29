# Review: Wiki Application Service (Phase 4)

## Verdict: PASS

Gate 2 structural review of the wiki application service against
`phase-04-application-service.md` success criteria and report §4/§5/§6/§8.
All five dimensions PASS. Two non-blocking suggestions and one acknowledged WARN-level
observation that does not rise to a FAIL.

Scope reviewed:
- `src/wiki/application/service.ts` (176 lines)
- `src/wiki/application/queries.ts` (14 lines)
- `src/wiki/application/ports.ts` (149 lines, modified)
- `src/wiki/infrastructure/markdown-repository.ts` (166 lines, modified)
- `src/wiki/application/__tests__/{mocks,write-order,approve-flow,service-integration}.ts`
- Read for context: domain `types.ts`, `write-decision.ts`, `invariants.ts`,
  `salience.ts`, `scanner-adapter.ts`, `scan-patterns.ts`; report §4/§5/§6/§8.

Verification re-confirmed this session: `npx vitest run src/wiki/application` → 12 pass
(3 files); no `: any` / `as any` in `src/wiki/`; service.ts 176, ports.ts 149,
markdown-repository.ts 166 — all ≤200.

---

## Correctness — PASS

The §5 write-transaction order is faithfully implemented and the architecture matches
the plan and report §4.

1. **§5 ORDER — scrub+scan precede every canonical write.** `commitWrite`
   (`service.ts:170`) is the §4 "writePage" step. It mints `ApprovedWrite.issue(page, scan)`
   (`ports.ts:52`) which THROWS unless `scan.verdict.status === "clean"` AND
   `passes >= MIN_SCAN_PASSES`, then writes → indexes → traces in that exact order
   (`service.ts:171-174`). The scrub-then-scan ordering is atomic inside the scanner:
   `ScannerAdapter.scan` runs the multi-pass injection scan on normalized content and
   computes `scrubbed` in the same call (`scanner-adapter.ts:121-133`); the token binds the
   page to `scan.scrubbed` (`ports.ts:59`), so no caller-supplied raw content can reach disk.
   Report §5 step 3 (scrub) before step 4 (scan): the scanner detects injection on the
   pre-scrub `normalized` form (correct — scrubbing must not mask an injection signal) and
   persists only the scrubbed form. This satisfies the §5 intent.

2. **Write-order test is a faithful proof.** `write-order.test.ts:79` asserts
   `m.calls` equals `["scan","writePage","upsertPage","trace:wiki_write"]` exactly, then
   re-asserts the pairwise index ordering (scan<write<upsert<trace) at lines 81-83. The spy
   adapter (`mocks.ts:15-58`) records every port method by name, so the assertion is a
   genuine call-sequence proof, not a smoke test. `proposeCandidate` is separately proven to
   emit `["scan","appendCandidate","trace:wiki_candidate"]` and to NOT contain `writePage`
   (`write-order.test.ts:61-62`).

3. **commitWrite is the sole writePage caller.** Grep-equivalent confirmation by reading:
   `repo.writePage(token)` appears only at `service.ts:172` inside private `commitWrite`;
   `commitWrite` is called only at `service.ts:126` inside `approveCandidate`. No other path
   reaches it.

4. **SOLE MINT — agent-origin cannot self-commit.** `proposeCandidate` (`service.ts:49`)
   is the agent/system entry point and its only persistence outcomes are
   quarantine / link-intervention / discard / candidate-append — never `writePage`. The page
   in `approveCandidate` is constructed with `provenance.origin: "human"` hard-coded
   (`service.ts:119`), and the defense-in-depth `canTransition("approved","committed",
   {origin})` guard (`service.ts:123`, domain `invariants.ts:88`) bars an agent origin from
   `committed`. Proven by `approve-flow.test.ts:53-61` (agent proposal never writes; only
   human approval does).

5. **SCANNER UNCONDITIONAL on approve.** `approveCandidate` re-scans the candidate content
   unconditionally (`service.ts:101`) and on a non-clean verdict it quarantines, records an
   intervention, traces `wiki_approve_blocked`, and THROWS (`service.ts:102-106`) — approval
   cannot bypass it. Proven by `approve-flow.test.ts:84-91` (human approval cannot bypass the
   scanner). Defense-in-depth: `ApprovedWrite.issue` re-checks the verdict even if a future
   caller forgot to (`ports.ts:53-58`).

6. **Reject path.** `rejectCandidate` (`service.ts:130`) records intervention + trace and
   never writes (`approve-flow.test.ts:63-68`), satisfying the plan's
   "every reject/override path produces a wiki_intervention + trace event."

7. **End-to-end with real adapters** (criterion #3) passes: createWiki → proposeCandidate →
   approveCandidate produces `tasks/wikis/demo/pages/salience-rubric.md` and an FTS row
   (`service-integration.test.ts:37-80`); a secret in proposed content is redacted from the
   canonical page (`service-integration.test.ts:82-110`).

## Security — PASS

This is the security-bearing layer; it holds.

- **No bypass of scan.** Both the propose path (`decideWrite` quarantines on any
  non-clean verdict OR `passes < MIN_SCAN_PASSES`, `write-decision.ts:50-62`) and the approve
  path (unconditional re-scan, `service.ts:101`) route through the scanner. The clean+min-pass
  floor is type-enforced at the write boundary via the private-constructor `ApprovedWrite`
  token (`ports.ts:41-61`) — a raw string or plain object will not type-check into
  `writePage`. Report §8 "human approval không bỏ qua scanner" is honored.
- **Persisted content is always scrubbed.** Candidate carries `scan.scrubbed`
  (`service.ts:77`); the canonical page carries `scan.scrubbed` (`service.ts:115`) and the
  token re-binds to `scan.scrubbed` (`ports.ts:59`). No raw path to disk.
- **Quarantine is read-blocked at rest** (`markdown-repository.ts:158-165`, `chmod 0o400`,
  DATA header), and every reject/quarantine emits an intervention + trace
  (report §8 final rule). Injected proposal proven quarantined with no candidate/page
  (`approve-flow.test.ts:71-82`).
- **Path-traversal** is rejected at the write boundary (`resolveInSlug` →
  `assertNoTraversal` + prefix containment check, `markdown-repository.ts:46-54`) and the
  slug grammar forbids `.` `/` whitespace (`types.ts:17`).
- **No blocked patterns.** No hardcoded secrets, no `any`, no SQL string interpolation in
  this slice (FTS bind noted in `queries.ts:5` / `wiki-query.ts`), no `process.env`,
  no network egress (Fetcher is a stub). No security-rules.md BLOCK items found.

No security agent escalation required for this slice.

## Maintainability — PASS

- No `any` / unsafe casts in `src/wiki/` except one bounded `as unknown as WikiCandidate[]`
  in `listCandidates` (`markdown-repository.ts:151`) — see WARN below; it is acknowledged,
  not a FAIL.
- Files all ≤200 lines (176 / 14 / 149 / 166). Clear command/query split across
  `service.ts` and `queries.ts`. Comments explain the WHY of the security spine without
  narrating the code.
- `ProposeInput`/`ProposeResult`/`WikiServiceDeps` are colocated in `ports.ts` as the layer
  boundary and re-exported from `service.ts` (`service.ts:23`) so callers have one import
  surface — reasonable.
- The plan's architecture sketch named a separate `commands.ts`; the implementation folded
  commands into `service.ts` (176 lines, under the 200 limit). This is a sanctioned
  divergence — the plan said "split into commands.ts/queries.ts/service.ts **if needed**"
  (plan line 41). Not needed; no finding.

## Performance — PASS

- No N+1, no unbounded fetch, no blocking-in-async concerns in this slice. The service is
  synchronous orchestration; the only async surface (`Fetcher`) is a Phase-5 stub.
- `getCandidate` does a full JSONL read + linear scan per lookup
  (`markdown-repository.ts:154-155`). For an approval flow (one human action at a time over a
  per-slug candidate log) this is appropriate; premature indexing would be over-engineering.
  No finding.

## Coverage — PASS

Default mode (TDD off), but coverage here is strong and directly targets the plan's
High-priority Test Gap Matrix rows:

- Write follows §5 order (scrub before scan before write): `write-order.test.ts` — covered.
- approveCandidate is the only canonical path: `approve-flow.test.ts:52-61` — covered.
- searchWiki has no side effects: `approve-flow.test.ts:99-105` (asserts `calls === ["searchFts"]`)
  — covered.
- Scanner-unconditional + re-scan-blocks-approval: `approve-flow.test.ts:71-91` — covered.
- Unknown-candidate throw: `approve-flow.test.ts:93-96` — covered.
- Candidate carries scrubbed not raw: `write-order.test.ts:65-69` — covered.
- Real-adapter end-to-end incl. secret redaction: `service-integration.test.ts` — covered.

Tests assert behavior (call sequence, persisted content, thrown errors), not implementation
detail. The §3 runnable-increment criterion is proven by the integration test rather than a
script — equivalent evidence, accept.

Minor coverage gap (non-blocking, see Suggestions): `link-existing` and `append-candidate`
decision branches in `proposeCandidate` (`service.ts:61-65`, `:71-92`) are not directly
exercised by a dedicated test; the HIGH fixture totals 8 → `propose-candidate`. Behavior is
inherited from `write-decision.test`-level coverage in the domain layer, so this is a WARN-not-FAIL.

---

## Suggestions (non-blocking)

1. **Add a `link-existing` and an `append-candidate` service-level test.** The propose path's
   non-`propose-candidate` branches (`service.ts:61-65` link, `:71-92` append via
   `verified_outcome>=3` + total≥10) are only covered transitively through domain tests. A
   two-line mock-driven test per branch would close the matrix at the application layer.

2. **Consider threading the candidate's real state into the approve transition.** The
   defense-in-depth `canTransition("approved","committed",…)` at `service.ts:123` hard-codes
   the `from` state and a `human` origin (the page is always constructed with origin "human"
   at `:119`). It is a genuine guard but cannot currently fail, because an agent-origin page
   is never constructed on this path. If a future change lets `approveCandidate` accept a
   system/agent-approved candidate, wire `candidate.origin` into the page provenance so the
   guard becomes load-bearing rather than tautological. No action needed for Phase 4.

3. **runResearchStep stub + Fetcher port** (`service.ts:151`, `ports.ts:94`) are acceptable
   Phase-4 placeholders per the plan's co-ownership note (plan line 66). The stub throws
   rather than silently no-ops — correct fail-loud behavior. No change needed.

---

## WARN (acknowledged — does not block)

**W1 — `as unknown as WikiCandidate[]` cast in `listCandidates`** (`markdown-repository.ts:151`).

1. *What it means:* `readJsonl` returns `Record<string, unknown>[]`; the cast asserts each
   parsed JSONL row is a fully-formed `WikiCandidate` without runtime field validation. A
   corrupt or hand-edited `candidates.jsonl` row could yield a candidate object missing
   fields, surfacing as a downstream `undefined` rather than a parse-time error.
2. *Why acceptable here:* candidates.jsonl is an append-only store written exclusively by
   `appendCandidate` from a typed `WikiCandidate` (`markdown-repository.ts:134-135`) — the
   only writer is in-process and typed. The approve path immediately re-scans candidate
   content (`service.ts:101`), so a tampered `content` field cannot bypass the security gate;
   the worst case from a malformed non-content field is a thrown error, not a security
   breach. The `readJsonl` loop is already tolerant of malformed lines
   (`markdown-repository.ts:124-129`).
3. *What would make it a FAIL:* if `candidates.jsonl` were ever written by an untrusted or
   out-of-process producer, OR if any candidate field other than `content` flowed into a
   security decision (path, origin, slug) without revalidation. At that point the cast must
   become a runtime type-guard / schema parse.

This is the only WARN. No FAIL dimensions; no Required Changes.

---

## Handoff

PASS → route to **shipper** for Gate 2 human approval. W1 must be explicitly acknowledged by
the human at Gate 2 (3-part justification provided above). No security agent escalation
needed for this slice.

**Status:** DONE
**Summary:** Gate 2 structural review of the wiki application service — overall PASS across
all 5 dimensions. The §5 write-order is faithfully implemented and proven; `commitWrite` is
the sole `writePage` caller; `approveCandidate` is the sole canonical mint; agent-origin
content has no self-commit path; the scanner re-runs unconditionally on approval and cannot
be bypassed; `searchWiki` is CQS-pure; candidates carry scrubbed content. One acknowledged
WARN (the `as unknown as WikiCandidate[]` cast) and three non-blocking suggestions.
**Concerns/Blockers:** None blocking. W1 (unvalidated JSONL→WikiCandidate cast) needs human
acknowledgement at Gate 2; two coverage branches (link-existing / append-candidate) are only
transitively tested at the service layer.
