# Review: Wiki Research Loop (Phase 5)

## Verdict: PASS (with 3 WARN — all acknowledged below)

Scope: structural / correctness / test-quality review of the wiki research-fetch loop. A
dedicated security agent is auditing SSRF/injection specifics in parallel; security findings
below are the structural-review subset, not a substitute for that audit.

Files reviewed:
- `packages/mewkit/src/wiki/infrastructure/fetcher-adapter.ts` (120 lines)
- `packages/mewkit/src/wiki/application/research.ts` (73 lines)
- `packages/mewkit/src/wiki/application/service.ts` (188 lines, modified)
- `packages/mewkit/src/wiki/application/ports.ts` (modified — `fetcher?` added)
- `packages/mewkit/src/wiki/infrastructure/scanner-adapter.ts` (modified — hex-IP guard)
- Tests: `research-quarantine.test.ts`, `fetcher-adapter.test.ts`, `mocks.ts`
- Cross-ref: `domain/write-decision.ts`, `domain/salience.ts`, `domain/types.ts`

---

## Correctness — PASS

**CANDIDATE-ONLY invariant: confirmed at three independent layers.** This is the central
anti-self-poisoning rule and it holds.

1. **Call graph.** `runResearchStep` (research.ts:54-73) calls `ctx.propose` →
   `WikiService.proposeCandidate` (service.ts:50). `proposeCandidate` has exactly four
   terminal branches: `quarantine` (56-61), `link-existing` (62-66), `discard` (67-70), and
   candidate-append (72-93). None calls `repo.writePage`. The research context object
   (service.ts:154-163) wires `propose`, `appendSource`, and `trace` only — it has no handle
   to `writePage` or `approveCandidate`.
2. **Sole writePage caller.** `repo.writePage` is reachable ONLY via `commitWrite`
   (service.ts:182-187), and `commitWrite` is called ONLY by `approveCandidate`
   (service.ts:127). `approveCandidate` is the human path — it re-scans (service.ts:102) and
   constructs the page with `origin:"human"` (service.ts:120).
3. **Origin transition guard (defense-in-depth).** `canTransition("approved","committed",
   {origin})` (service.ts:124) would bar an agent-origin commit even if the call graph were
   subverted. research.ts:64 tags the candidate `origin:"agent"` — the most-restricted
   origin.

Plus the type-system chokepoint: `repo.writePage` accepts ONLY `ApprovedWrite`
(ports.ts:72), whose constructor is private and whose `issue()` factory throws on a
non-clean or under-scanned verdict (ports.ts:52-60). A raw string cannot reach the
canonical store. **No path from fetched content to a canonical page exists.**

**Salience heuristic (`salienceFor`, research.ts:33-46): reasonable.** Verified against
`scoreSalience` bounds and `decideWrite` thresholds:
- novel arXiv/GitHub = 2(intent)+2(novelty)+2(reuse)+2(source)+1(blast) = 9 ≥ 8 →
  propose-candidate. Correct.
- novel web = 2+2+2+1+1 = 8 → propose-candidate (exactly on threshold). Correct.
- `verified_outcome:0` so the append-candidate auto-path (needs ≥10 AND strong verified
  signal) is correctly unreachable from research — fetched content can never auto-append,
  only propose. This is the right conservatism for unverified external content.

**Redirect handling correct.** `safeGet` (fetcher-adapter.ts:75-99) re-runs `isSafeSourceUrl`
at the top of every hop, resolves relative `Location` against the current URL before
re-validation (line 90), caps hops, and rejects a redirect with no `Location`.

**Streaming + header size caps both enforced** (fetcher-adapter.ts:94-95 content-length
pre-check; 101-118 streaming cap with `reader.cancel()` on overflow). The defense is layered:
a lying/absent `content-length` is still caught by the streaming counter. See WARN-1.

## Maintainability — PASS

- No `: any`. The single boundary cast (`globalThis.fetch as unknown as FetchImpl`,
  fetcher-adapter.ts:41) is acceptable — see Conventions.
- All files ≤200 lines (research 73, fetcher 120, service 188).
- `research.ts` is a clean orchestration shim: pure helpers (`titleFor`, `salienceFor`,
  `computeDup`) + one async step. Dependencies arrive via an explicit `ResearchContext`
  interface rather than reaching into the service — good seam, testable in isolation.
- `FetchResponse` is structurally typed (fetcher-adapter.ts:13-19) rather than importing
  undici types — keeps the adapter portable and the test double trivial to construct.
- Comments are load-bearing (explain WHY the candidate-only path exists), not noise.

## Performance — PASS

- One network round-trip per seed (plus redirects, hop-capped). No N+1.
- Streaming read with early `cancel()` on size overflow avoids buffering oversized bodies.
- `computeDup` runs one FTS query with `limit 3` (research.ts:49) — bounded.
- `Buffer.concat` of streamed chunks is bounded by `maxBytes`. No unbounded accumulation.

## Security — PASS (structural subset; defer SSRF/injection depth to security agent)

- url-guard runs BEFORE any network read AND at every redirect hop. The test
  `blocks an unsafe start URL BEFORE any network call` asserts `called === 0`
  (fetcher-adapter.test.ts:44-53) — proves no egress on a blocked target. Strong.
- Redirect-to-private-host blocked (fetcher-adapter.test.ts:55-62), exercising the
  metadata-endpoint SSRF pivot (302 → `169.254.169.254`).
- Hex-IP guard added to `isBlockedIpv4` (scanner-adapter.ts:22) closes the Phase-3
  carry-forward deferral. IPv4 / IPv6 / IPv4-mapped (dotted + hex-compressed) / bare-decimal
  / octal / hex are all covered.
- Fetched content is never trusted: it flows through the scanner inside `proposeCandidate`
  and a poisoned payload is quarantined with an intervention + trace (verified by test).
- No secret/credential handling, no exfiltration path, no `localStorage`/SQL-interpolation
  patterns. `user-agent` is the only header set.

Three security-relevant items are downgraded to WARN (below), not BLOCK — each has a
compensating control. The parallel security agent should still confirm WARN-1 and pattern
parity (WARN-3); a security-agent BLOCK on either would flip this dimension to FAIL.

## Coverage — PASS (TDD off; tests present and behavior-focused)

`research-quarantine.test.ts` covers all four required behaviors and asserts on the call
ledger, not implementation details:
- clean → candidate, asserts `appendCandidate` present and `writePage` absent (line 30) —
  directly proves the candidate-only invariant.
- poison → quarantine + intervention, asserts `appendCandidate` AND `writePage` absent.
- high-dup → link-existing, no candidate.
- no-fetcher → throws `/not enabled/`.

`fetcher-adapter.test.ts` proves redirect re-validation, content-length cap, streaming cap,
hop cap, buildUrl mapping, and zero-egress-on-block — all without real network. The injected
`fetchImpl` seam is a sound testability design: the security guards (the part that matters)
are exercised deterministically; only the raw socket is stubbed.

Gaps (non-blocking, see WARN-2): no test for the lying-`content-length`-then-large-stream
case, and no test for `computeDup` near-duplicate-with-different-title mis-scoring.

---

## WARN items (each requires human acknowledgment per Gate 2)

### WARN-1 — content-length pre-check trusts an attacker-controlled header
- **What it means:** `safeGet` rejects on `content-length > maxBytes` (fetcher-adapter.ts:94-95),
  but `content-length` is supplied by the remote server. A malicious server can send
  `content-length: 0` (or omit it) and stream a large body.
- **Why acceptable here:** the streaming cap (lines 111-113) is the real enforcement — it
  counts actual bytes and aborts via `reader.cancel()` regardless of the header. The header
  check is a cheap fast-path, not the security boundary. Defense holds.
- **What would make it FAIL:** if the streaming cap were removed or could be bypassed (e.g.
  the `!res.body` fallback at line 102 calls `res.text()` then slices — for a body-less
  response that buffers the full text before slicing; bounded in practice by undici but worth
  the security agent's eye), this becomes a real DoS vector and flips to FAIL.

### WARN-2 — `computeDup` is exact-title-match only; semantic dups mis-scored as novel
- **What it means:** `computeDup` (research.ts:48-52) flags a duplicate only when an FTS hit's
  title equals the candidate title case-insensitively. Content that duplicates an existing
  page under a different title scores `novelty:2` and produces a new candidate.
- **Why acceptable here:** the output is a *candidate*, not a canonical page — a human
  reviews it before it ever becomes canonical, and the FTS query still surfaces the related
  page. Over-proposing is a low-cost failure; the anti-poisoning invariant is unaffected.
- **What would make it FAIL:** if research candidates could auto-approve, or if dup-misses
  caused unbounded candidate growth (no de-dup on the candidate store). Neither is the case
  today.

### WARN-3 — injection-pattern parity is asserted by count, not by a parity test
- **What it means:** `INJECTION_PATTERNS` was expanded to ~38 (toward the web-to-markdown
  Layer-5 "50+" target named in the phase plan), but there is no test pinning the set against
  the reference layer, so future edits can silently regress coverage.
- **Why acceptable here:** the scanner is exercised end-to-end (poison → quarantine) and the
  expansion is a strict superset of Phase 3; this is a regression-guard gap, not a present
  hole.
- **What would make it FAIL:** the parallel security agent finding a Layer-5 pattern class
  that is entirely absent (not just below the count target) from the live-fetch path.

---

## Suggestions (non-blocking)

- Add a test for the body-less / `res.text()` fallback (fetcher-adapter.ts:102) to confirm it
  honors `maxBytes` for a response with no `body` stream.
- Add a `computeDup` test with a near-duplicate-different-title fixture to document the
  exact-match limitation as intended behavior.
- Consider a small parity test that asserts `INJECTION_PATTERNS.length >= N` and/or pins a
  representative sample, so pattern regressions surface in CI (addresses WARN-3 cheaply).
- `salienceFor` web-novel lands exactly on the threshold (8 == proposeCandidate floor). Fine,
  but a one-line comment noting the on-threshold intent would prevent a future tuning edit
  from silently dropping web seeds to `discard`.

---

## Gate 2 Self-Check

- **Completed:** all 5 dimensions evaluated against phase-05 success criteria; candidate-only
  invariant traced to source; fetcher security seam and tests verified.
- **Skipped:** deep SSRF/Layer-5 injection audit — owned by the parallel security agent by
  design; WARN-1 and WARN-3 are flagged for that audit to confirm.
- **Uncertain:** WARN-1's body-less `res.text()` fallback buffering behavior under undici —
  bounded in practice but I did not exercise it at runtime; security agent should confirm.

Handoff: PASS with 3 WARN. Recommend routing to **shipper** after human acknowledges the
three WARN items AND the parallel **security** agent returns no BLOCK on WARN-1/WARN-3. A
security-agent BLOCK on either flips the Security dimension to FAIL.
