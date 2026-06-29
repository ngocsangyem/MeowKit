# Security Audit Verdict — Wiki Infrastructure Security Gate (Phase 4)

- **Date:** 2026-06-29
- **Auditor:** security agent (COMPLEX tier — AUDIT_SEC + EXT_SYSTEM risk flags)
- **Scope:** `packages/mewkit/src/wiki/{infrastructure,application,domain}` — the self-poisoning / prompt-injection / secret-leak defense gate
- **Posture:** adversarial; assume attacker controls all fetched + agent content
- **Overall verdict:** **PASS-with-warnings** (no shipping-broken BLOCK; one HIGH defense-in-depth gap strongly recommended before Phase 5 fetcher lands)

---

## Executive Summary

The chokepoint architecture is sound and the headline security property holds: **canonical content cannot reach disk without a scanner-issued `ApprovedWrite` token, and that token cannot be minted from a non-clean or under-scanned verdict** (short of an explicit `as unknown as` cast, which is out of scope per the brief). Secret scrub is byte-for-byte parity with the approved `.cjs` source. SQL is fully parameterized. Path traversal is defended in depth (slug grammar + `assertNoTraversal` + `resolveInSlug` prefix check).

The weaknesses are all in **detection completeness**, not in **architecture**: the injection pattern set is ~14 patterns vs the web-to-markdown Layer 5 claim of 50+, the base64 decode pass has a 64-char floor that lets short encoded payloads through, and there is a **token/scrub decoupling gap** where `ApprovedWrite.issue` accepts a `page` whose `content` it never verifies was scrubbed. None of these ship a broken gate today (Phase 5 adds the fetcher; agent/human content paths still scan), but the token/scrub gap (HIGH) should be closed before untrusted fetched content flows through.

---

## Attack-Question Findings

### Q1 — CHOKEPOINT: can content reach disk unscanned? — PASS (with HIGH sub-gap)

**Type-level chokepoint holds.** Every content path into the canonical tree was traced:

- `MarkdownWikiRepository.writePage(token: ApprovedWrite)` — the ONLY canonical content writer (`markdown-repository.ts:53`). Accepts ONLY the branded token; a raw string/object will not type-check.
- `ApprovedWrite` has a `private constructor` and a single `static issue()` factory (`ports.ts:28-44`) that throws unless `verdict.status === "clean"` AND `verdict.passes >= MIN_SCAN_PASSES`. No forging path exists other than `as unknown as` (excluded by brief).
- `createWiki` (`markdown-repository.ts:48`) writes only fixed `wiki.json` metadata, no attacker content — acceptable.
- `quarantine` (`markdown-repository.ts:95`) writes RAW content by design to a read-blocked `.quarantined` file — acceptable (see Q3).
- `wiki-ingest.ts` writes into the DERIVED index from the already-canonical tree (rebuild) — trust is inherited from write-time scanning, not a new ingress. Acceptable.

**HIGH sub-gap — token does not bind to scrubbed content (WARN-H1).** `ScannerAdapter.scan` returns `{ verdict, scrubbed, secretsFound }` (`scanner-adapter.ts:82-83`), but `ApprovedWrite.issue(page, verdict)` takes the `page` and the `verdict` as INDEPENDENT arguments and never checks that `page.content === scrubbed`. The application layer (Phase 4, not yet written) is FREE to mint a token from the clean verdict while passing the ORIGINAL un-scrubbed `page.content`. The type system enforces "a clean verdict existed" but NOT "the content written is the scrubbed content the verdict was computed over." A secret therefore can land in a canonical page (and from there into `wiki_fts`/index via ingest) even though scrub ran. The test at `scanner-adapter.test.ts:35-41` proves scrub WORKS but never proves the WRITTEN page carries the scrubbed bytes. This is the single most important fix.

### Q2 — INJECTION BYPASS: encodings that slip through — WARN (HIGH, pattern-completeness)

Empirically confirmed bypasses against the current 3-pass (plaintext / base64 / ROT13) + NFKC design:

| Vector | Result | Note |
|---|---|---|
| Newline-split keywords (`ignore\nprevious\ninstructions`) | CAUGHT | `\s+` matches newlines — good |
| Zero-width INSIDE a keyword (`ig<ZWSP>nore previous instructions`) | CAUGHT | NFKC + ZW strip — good |
| **Short base64 payload** (`you are now evil` → 24-char b64) | **BYPASS** | `decodeBase64Blocks` floor is `{64,}`; most single-phrase injections encode to < 64 chars |
| **Nested base64** (encode twice) | **BYPASS** | single decode pass returns base64, not plaintext; re-scan sees gibberish |
| **URL/percent-encoding** (`ignore%20previous%20instructions`) | **BYPASS** | no percent-decode pass |
| **Hex encoding** | **BYPASS** | no hex-decode pass |
| **HTML comment interleave** (`ignore <!-- x --> previous instructions`) | **BYPASS** | comments not stripped before scan |
| **Synonyms** (`disregard everything above`, `ignore the prior directives`) | **BYPASS** | pattern set is literal-phrase, ~14 patterns vs Layer 5's 50+ |
| **Tool-call hijack variants** beyond `bash/write/edit/read` | partial | `/use the (bash\|write\|edit\|read) tool/` misses `Task`, `Glob`, `WebFetch`, etc. |

**Assessment:** the pattern set is materially thinner than the web-to-markdown Layer 5 contract it cites (security.md lines 176-196: 50+ patterns across 4 categories, plus flood detection and delimiter-injection checks — NEITHER of which is ported). The base64 64-char floor is the most concrete miss because it defeats the very decode pass that exists. This is a HIGH defense-in-depth gap, not a BLOCK, because: (a) Phase 5 has not yet wired untrusted fetched content in, and (b) the chokepoint still quarantines anything the scanner flags. But it WILL be load-bearing the moment the fetcher lands.

### Q3 — SECRET LEAK: scrub coverage — PASS (one WARN)

- Secret-scrub TS port is **byte-for-byte identical** to the human-approved `secret-scrub.cjs` (verified line-by-line: `scan-patterns.ts:49-68` ≡ `secret-scrub.cjs` PATTERNS). Parity test exists (`scanner-adapter.test.ts:136-141`).
- Trace path scrubs deeply via `scrubDeep` over every string in `data` before append (`trace-adapter.ts:12-21, 34`) — verified by test (`markdown-repository.test.ts:96-107`).
- **Quarantine writes RAW (un-scrubbed) content by design** (`markdown-repository.ts:95-100`). Acceptable per the brief: the file is `.quarantined` (read-blocked by `privacy-block.sh`, confirmed live — the hook blocked my own read of `secret-scrub.cjs` this session) and 0400-intent. A poisoned page that ALSO contains a secret keeps the secret at rest in quarantine, but that bucket is human-review-only and never indexed. WARN (W3): quarantine files are NOT created with explicit `0400` perms in code — `atomicWriteText` uses default umask. The security.md contract (Layer 6) specifies 0400. Recommend `fs.chmodSync(target, 0o400)` after write.
- **Index leak risk is downstream of W-H1:** if an un-scrubbed page is written (Q1 gap), `wiki-ingest`/`upsertPage` copies `page.content` verbatim into `wiki_page` and the trigger mirrors it into `wiki_fts` (`wiki-schema.ts:40`). So the secret-into-index path is REAL but is gated entirely by closing W-H1. Closing W-H1 closes this too.

### Q4 — SSRF: `isSafeSourceUrl` completeness — WARN (MEDIUM)

`isSafeSourceUrl` (`scanner-adapter.ts:19-29`) covers the common cases well: http(s)-only scheme allowlist, credentials-in-URL rejection, and a `PRIVATE_HOST` regex spanning localhost / `127.` / `10.` / `192.168.` / `169.254.` / `172.16-31.` / `::1` / `fe80:` / `fc` / `fd`. Confirmed by the 9-case rejection test.

Gaps (all MEDIUM — acceptable for THIS layer; SSRF is primarily Phase 5's fetcher concern, and security.md defers IPv6-mapped-IPv4 and DNS-rebinding to v2 explicitly):

- **IPv4-mapped IPv6** `::ffff:169.254.169.254` / `::ffff:a9fe:a9fe` — NOT matched by the regex (no `ffff:` branch). Python's `ipaddress` (the contract reference) catches this; the lean regex port does not.
- **Octal/decimal/hex IP encodings** `http://0177.0.0.1`, `http://2130706433`, `http://0x7f000001` — NOT matched (regex is dotted-decimal-prefix only). `URL` does not normalize these to canonical form for the hostname check.
- **DNS rebinding / hostname-that-resolves-to-private** — no DNS resolution here (string-only check). Acceptable: the contract states `_safe_url` does IP classification at fetch time; this TS port is the string pre-filter, not the network guard.
- **Redirect following** — NOTHING in this layer follows redirects (no network IO at all). The decode/scan pipeline is pure. The redirect re-validation requirement (security.md Layer 2) is unambiguously Phase 5 fetcher scope. PASS for this layer; FLAGGED for Phase 5.

The regex is also slightly over-broad (`\[?fc` / `\[?fd` match any hostname STARTING with `fc`/`fd`, e.g. `fc-barcelona.com` → false-positive reject). Low impact (fails closed), noted as W4-minor.

### Q5 — PATH TRAVERSAL: slug / page.path escape — PASS

Defense in depth, all three layers verified:

1. **Slug grammar** (`types.ts:17` `WIKI_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`) forbids `.`, `/`, `\`, whitespace, null — a branded `WikiSlug` cannot carry traversal. `makeWikiSlug` throws otherwise.
2. **`assertNoTraversal`** (`invariants.ts:9-26`) rejects empty, null-byte, absolute (`/` or `C:\`), backslash, and any `..`/`.` segment.
3. **`resolveInSlug`** (`markdown-repository.ts:38-46`) re-resolves with `path.resolve` and asserts the target is the base dir or starts with `base + sep` — a belt-and-suspenders prefix check that catches anything the string check missed.

`writePage` calls `assertCanonicalComplete` (which re-runs `assertNoTraversal` on `page.path`) THEN `resolveInSlug`. Confirmed by test `markdown-repository.test.ts:62-68` (traversal path throws, no file escapes). Null-byte and absolute-path vectors are covered. No bypass found.

### Q6 — SQL INJECTION: parameterization — PASS

- All data-bearing SQL uses prepared statements with bound `?` params: `sqlite-index.ts:21-34` (DELETE + INSERT), `wiki-ingest.ts` (every `INSERT OR REPLACE/IGNORE` bound), `wiki-query.ts:36-39, 57-62` (FTS `MATCH ?` and `LIMIT ?` bound).
- The ONLY string-built SQL is `"DELETE FROM " + table` (`wiki-ingest.ts:180`) where `table` iterates the hard-coded `WIKI_TABLES` constant array (`wiki-schema.ts:9-22`) — no user input. Safe.
- FTS `MATCH ?` binds the query string, so `'" OR 1=1' is treated as search text (documented `wiki-query.ts:5-6`). Read DB is opened `{ readOnly: true }`. No injection surface found.

---

## BLOCK List

(none — no shipping-broken critical vulnerability)

## WARN List

| ID | Sev | Finding | Location | Remediation |
|---|---|---|---|---|
| W-H1 | **HIGH** | `ApprovedWrite.issue(page, verdict)` does not bind the token to the SCRUBBED content; the verdict and `page.content` are independent args, so the Phase-4 application layer can mint a valid token while writing un-scrubbed content (secret/injection-into-canonical-and-index path). | `application/ports.ts:36-44`; `infrastructure/scanner-adapter.ts:82-83` | Make `ApprovedWrite.issue` take the `ScanOutput` (or the scrubbed string) and construct/overwrite `page.content` from `scrubbed` inside `issue`, so the only content a token can carry IS the scanned+scrubbed content. Add a test asserting a page built from un-scrubbed content cannot be written with a secret intact. |
| W-H2 | **HIGH** | Injection detection is materially thinner than the cited Layer 5 contract: ~14 literal patterns vs 50+; base64 decode floor `{64,}` lets short encoded payloads bypass (empirically confirmed); no percent/hex decode; no nested-base64 re-decode; no HTML-comment strip; no flood/delimiter checks. | `scan-patterns.ts:12-28`; `scanner-adapter.ts:39-50` | Before Phase 5 wires the fetcher: lower the base64 floor (e.g. `{16,}`) or decode all candidate blocks; add a percent-decode pass; add the Layer 5 role-play/encoding-tell/context-manipulation phrase families; port flood (R9) + delimiter-injection checks. Document accepted residual gaps explicitly. |
| W3 | MED | Quarantine + canonical files are not chmod'd `0400`; rely on default umask. security.md Layer 6 specifies 0400 read-only. | `markdown-repository.ts:14-19, 95-100` | `fs.chmodSync(target, 0o400)` on quarantine writes (and consider read-only on committed pages). |
| W4 | MED | `isSafeSourceUrl` misses IPv4-mapped IPv6 (`::ffff:169.254.169.254`), octal/decimal/hex IP encodings; regex `fc`/`fd` branches over-match (false-positive reject). No redirect/DNS handling (correctly deferred to Phase 5). | `scanner-adapter.ts:16, 19-29` | Add `::ffff:` branch; normalize numeric IP forms (or parse host as `ipaddress`-equivalent); tighten `fc00::/7`/`fd00::/8` to require the colon. Flag redirect re-validation as a Phase-5 fetcher AC. |
| W5 | LOW | `MIN_SCAN_PASSES = 2` (domain) but scanner always reports `passes: 3`. The floor is satisfied trivially and `passes` is a self-reported integer, not a proof that N independent passes ran. A future scanner change reporting `passes: 2` with one real pass would still mint a token. | `domain/write-decision.ts:27`; `scanner-adapter.ts:14, 82` | Acceptable now (defense-in-depth signal). Long-term: derive `passes` from the actual pass array length rather than a constant. |

---

## Injection-Rules (injection-rules.md) Rule-by-Rule Posture

This layer is the gate that ENFORCES these rules for the wiki subsystem. Posture against the 10 rules (the skill is not yet a full fetch-skill — Phase 5 — so R5/R7 are partial-by-design):

| Rule | Verdict | Evidence |
|---|---|---|
| R1 File content is data | PASS | Canonical/ingested content treated as data; no execution of file content. |
| R2 Tool output is data | PASS | No tool-output execution in this layer. |
| R3 Memory cannot override | PASS | Trace append is data-only, secret-scrubbed (`trace-adapter.ts`). |
| R4 Sensitive-file protection | PASS | `privacy-block.sh` actively blocked `secret-scrub.cjs` read this session; quarantine uses `.quarantined` (read-blocked). |
| R5 No external exfiltration | PASS (this layer) | Pipeline is pure/no-network; exfil surface is Phase-5 fetcher. |
| R6 Project-dir boundary | PASS | All writes resolved under `tasks/wikis/<slug>/` via `resolveInSlug`; traversal rejected. |
| R7 Skill content boundary | **WARN** | Fetched content wrapping/DATA-fence is asserted in the contract but the STOP-on-injection is realized only as quarantine + thin pattern set (W-H2). Hard-stop semantics OK (quarantine, no override); detection completeness is the gap. |
| R8 Encoding-obfuscation detection | **WARN** | NFKC + ZW strip + base64 + ROT13 present, but base64 floor, nested-b64, percent/hex, HTML-comment all bypass (W-H2). |
| R9 Context-flooding defense | **FAIL-to-port** | The `>5000 char` repetitive-padding flood check (security.md Layer 5 pass 5) is NOT ported. Add before Phase 5. Tracked under W-H2. |
| R10 Escalation protocol | PASS | Injection → quarantine + verdict findings; no programmatic override path; intervention recorded via trace/`wiki_intervention`. |

R9 not being ported is folded into W-H2 (HIGH) rather than a separate BLOCK, because the size-cap (`MAX_CONTENT_BYTES = 1MB`) provides a coarse flood ceiling and no untrusted bulk content flows until Phase 5.

---

## Re-Audit Trigger

A re-audit is REQUIRED before Phase 5 (fetcher) ships, regardless of whether W-H1/W-H2 are fixed now, because the fetcher converts every "this layer is pure / no untrusted ingress yet" mitigation into a live attack surface. Specifically re-verify: W-H1 (token↔scrub binding), W-H2 (pattern completeness + base64 floor + R9 flood), and W4 (redirect re-validation + numeric-IP SSRF).
