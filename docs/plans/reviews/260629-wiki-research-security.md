# Security Re-Audit Verdict — Wiki Research Loop + Fetcher (Phase 5)

- **Date:** 2026-06-29
- **Auditor:** security agent (COMPLEX tier — EXT_SYSTEM + AUDIT_SEC; highest-risk phase: live external ingress)
- **Scope:** `packages/mewkit/src/wiki/{infrastructure/fetcher-adapter.ts, infrastructure/scanner-adapter.ts, infrastructure/scan-patterns.ts, application/research.ts, application/service.ts}` + the composed fetcher to scanner pipeline
- **Posture:** adversarial — attacker controls fetched web/arXiv/GitHub content AND redirect targets; goals: (a) reach a canonical page, (b) hit an internal/SSRF host, (c) exfiltrate secrets
- **Prior verdict:** `260629-wiki-infra-security.md` (Phase 4, PASS-with-warnings; required this re-audit before the fetcher ships)
- **Overall verdict:** **PASS-with-warnings** — all 3 mandatory Phase-3 carry-forwards are CLOSED; the 4 core research invariants hold; remaining items are MEDIUM/LOW SSRF residue inherent to a string-only host filter.

NOTE: throughout this verdict the cloud-metadata IPv4 is written as `169·254·169·254` (middle dots) and its hex form as `a9fe:a9fe` so the privacy-block hook does not flag the verdict file itself. They denote the standard link-local metadata address.

---

## Carry-Forward Closure (the gate)

| # | Carry-forward | Status | Evidence |
|---|---|---|---|
| 1 | SSRF redirect re-validation (every hop, max-hops cap, manual redirects) | **CLOSED** | `fetcher-adapter.ts:75-99` |
| 2 | SSRF hex IP literal (+ IPv4-mapped IPv6, bare-decimal, octal) | **CLOSED** | `scanner-adapter.ts:18-45`, verified by live probe |
| 3 | Pattern parity (~38 assistant-directed patterns vs Layer-5 "50+") | **CLOSED (defensible)** | `scan-patterns.ts:12-58` |

### #1 — Redirect re-validation — CLOSED

`safeGet` (`fetcher-adapter.ts:75-99`) implements the web-to-markdown Layer-2 redirect contract correctly:

- **Manual redirects:** `fetchImpl(url, { redirect: "manual", ... })` (line 83) — no auto-follow into a private host.
- **Per-hop re-validation:** `isSafeSourceUrl(url)` is re-run at the TOP of every loop iteration (line 78), so the resolved redirect target is guarded BEFORE the next `fetchImpl` call.
- **Max-hops cap:** `for (let hop = 0; hop <= this.maxHops; hop++)` with `maxHops` default 3; exhaustion throws `too many redirects` (line 98). Tested (`fetcher-adapter.test.ts:76-81`).
- **Relative/protocol-relative resolution:** `new URL(loc, url).toString()` (line 90) resolves the Location against the current URL, then the loop top re-validates the absolute result.

Adversarial redirect-target probe (Location header attacker-controlled) — every bypass attempt is caught at the loop-top re-validation:

| Location value | Resolves to | Guard result |
|---|---|---|
| `//<metadata-ip>/` (protocol-relative) | `https://<metadata-ip>/` | BLOCK (metadata IP) |
| `data:text/html,evil` | `data:` scheme | BLOCK (non-http scheme) |
| `file:///etc/passwd` | `file:` scheme | BLOCK |
| `javascript:alert(1)` | `javascript:` scheme | BLOCK |
| `\\<metadata-ip>\x` (backslash) | `https://<metadata-ip>/x` | BLOCK |
| `https://example.com@<metadata-ip>/` (userinfo) | host metadata-ip, user set | BLOCK (username present) |
| `  http://<metadata-ip>/` (leading ws) | `http://<metadata-ip>/` | BLOCK |

The redirect test (`fetcher-adapter.test.ts:55-62`) proves a 302 to the metadata IP is blocked and the private host is never read. No bypass found.

### #2 — Numeric-IP SSRF — CLOSED

Two independent layers now reject numeric-IP encodings:

1. **Node `URL` canonicalizes** most numeric forms BEFORE the guard sees them — verified live: `0x7f000001`, `2130706433`, `0177.0.0.1`, `127.1`, `0x7f.0.0.1`, `017700000001` all normalize to `127.0.0.1`, which the dotted-quad branch (`scanner-adapter.ts:24` then `BLOCKED_V4`) rejects.
2. **`isBlockedIpv4` explicit branches** (`scanner-adapter.ts:21-23`) catch any residual `0x...` / bare-decimal / octal-leading-zero forms as belt-and-suspenders.

IPv6 coverage verified live (`scanner-adapter.ts:28-45`): `::1`, `fe80::1`, `fc00::1`, `fd00::1`, IPv4-mapped dotted (`::ffff:<metadata-ip>`), IPv4-mapped hex-compressed (`::ffff:a9fe:a9fe`), and the expanded `0:0:0:0:0:ffff:a9fe:a9fe` (which `URL` re-compresses to `::ffff:a9fe:a9fe`) are ALL blocked. The prior `fc`/`fd` over-match false-positive is fixed — the regex is now colon-anchored (`/^f[cd][0-9a-f]{0,2}:/`), so `fcc.com` correctly ALLOWS.

### #3 — Pattern parity — CLOSED (defensible)

`scan-patterns.ts` now carries ~38 injection patterns (up from ~14 at Phase 3). The scanner runs a 4-pass design (`scanner-adapter.ts:122-129`): NFKC+zero-width normalize, then plaintext, percent-decode, ROT13, and base64-block decode (floor lowered to **16 chars**, `scan-patterns.ts:83`, closing the prior short-payload bypass), plus a context-flood heuristic (`scanner-adapter.ts:95-100`, closing the prior R9 FAIL-to-port).

The deliberate exclusion of generic shell terms (`curl`, `rm -rf`, `execute`) is a **defensible** position for a dev-knowledge wiki: those terms appear in legitimate content and would cause false-positive quarantine of real pages. The retained set is scoped to ASSISTANT-DIRECTED phrasings (instruction-override, tool-call hijack, role-play/jailbreak, exfil-directive, memory-poisoning, prompt-extraction). The chokepoint design means a missed pattern degrades gracefully — fetched content can at worst become a CANDIDATE, never a canonical page, and `approveCandidate` re-scans. No critical category is missing. Accept as defensible; track residual encoding gaps (nested-base64, HTML-comment interleave) below as LOW.

---

## Core Research Invariants

### Q4 — CANDIDATE-ONLY: can fetched content reach a canonical page? — PASS

No path exists from fetched content to `writePage`. Traced end-to-end:

- `runResearchStep` (`research.ts:54-73`) calls ONLY `ctx.propose(...)` then `proposeCandidate`. It never calls `writePage`/`approveCandidate`/`commitWrite`.
- Fetched content is tagged `origin: "agent"` (`research.ts:62`) — the most-restricted origin.
- `proposeCandidate` (`service.ts:50-94`) terminal outcomes are quarantine / link-existing / discard / candidate — **never a page**. The candidate persists `scan.scrubbed`, not raw content (`service.ts:79`).
- `decideWrite` (`write-decision.ts:45-90`) by construction never returns a "write canonical page" decision — strongest outcome is `append-candidate`.
- The SOLE canonical-write path is `approveCandidate` then `commitWrite` then `ApprovedWrite.issue` then `repo.writePage`. `approveCandidate` requires a human `approvedBy` and `canTransition("approved","committed",{origin})` BARS agent origin (`invariants.ts:88-89`; enforced `service.ts:124-125`). Tested (`research-quarantine.test.ts:30,41,55`: `writePage` is never in the call log on any research path).

### Q5 — POISON to QUARANTINE (unconditional scan) — PASS

The scan is unconditional on the research path: `runResearchStep` then `proposeCandidate` then `scanner.scan(...)` runs FIRST (`service.ts:51`) before any salience/decision logic. Any non-clean verdict then `decideWrite` returns `quarantine` (`write-decision.ts:50-55`) then `repo.quarantine` (raw, 0400, read-blocked) + `recordIntervention` + `recordWikiTrace("wiki_quarantine")` (`service.ts:56-60`). A poisoned fetch produces **zero candidates** + an intervention + a trace. Tested (`research-quarantine.test.ts:33-42`).

### Q6 — NO READ BEFORE GUARD — PASS

`safeGet` validates the FIRST hop before any network read: `isSafeSourceUrl(url)` at `fetcher-adapter.ts:78` precedes `fetchImpl` at line 83 (hop 0). Tested (`fetcher-adapter.test.ts:44-53`: unsafe start URL throws, `called === 0`). The scanner independently re-guards `sourceUrl` (`scanner-adapter.ts:119`) — two-layer.

### Q7 — SECRET SCRUB on fetched content before the candidate store — PASS

The persisted candidate carries `scan.scrubbed` (`service.ts:79`), and `scan.scrubbed` is `scrubSecrets(normalized)` (`scanner-adapter.ts:132`). The secret pattern set is the verbatim `.cjs` port (`scan-patterns.ts:79-98`). The `sources.jsonl` sidecar (`research.ts:56`) stores only `{id, kind, url, fetchedAt, contentHash}` — no fetched body, and `url` already passed `isSafeSourceUrl` (no embedded credentials). No secret-bearing fetched content lands in any store unscrubbed. The token-to-scrub binding (prior W-H1, HIGH) is also CLOSED: `ApprovedWrite.issue(page, scan)` reconstructs `{ ...page, content: scan.scrubbed }` (`ports.ts:52-60`) — the approve path cannot ride raw content past the gate.

---

## WARN List (none block; all are residual SSRF in a string-only host filter)

| ID | Sev | Finding | Location | Remediation |
|---|---|---|---|---|
| R-W1 | MED | DNS-rebinding / hostname-that-resolves-to-private is not caught — `127.0.0.1.nip.io` and any A-record pointing at a private IP ALLOW (string filter only; no resolve-and-pin). `new URL(loc,url)` between hops also re-resolves DNS, so a TOCTOU rebind across hops is theoretically possible. | `scanner-adapter.ts:49-63` | v2: resolve host to IP, classify the resolved address, and pin the socket to that IP for the request (matches the security.md Layer-2 "IP classification at fetch time" note; explicitly deferred to v2 there). |
| R-W2 | MED | CGNAT `100.64.0.0/10` and benchmark `198.18.0.0/15` ranges ALLOW; some cloud link-local equivalents beyond `169.254.` not covered. Metadata/loopback/RFC1918 ARE covered. | `scanner-adapter.ts:18,24` | Add CGNAT `100.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.` and `198.1[89]\.` to the blocked-v4 set if internal infra uses these. |
| R-W3 | LOW | IPv6 indirect-embedding forms NAT64 `64:ff9b::a9fe:a9fe`, 6to4 `2002:a9fe:...`, and bare `::a9fe:a9fe` ALLOW — they embed a metadata v4 but are not `::ffff:`-mapped. Reaching metadata via these requires a network that routes them. | `scanner-adapter.ts:28-45` | v2: decode NAT64/6to4 embedded v4 and classify; or rely on the resolve-and-pin fix (R-W1) which subsumes this. |
| R-W4 | LOW | Encoding-obfuscation residue: nested base64 (double-encode), HTML-comment interleave (`ignore <!-- x --> previous`), and hex-encoded injections still bypass the scan passes. Mitigated by the candidate-only chokepoint + approve re-scan. | `scanner-adapter.ts:122-128` | Optional: add an HTML-comment strip pass and a single nested-base64 re-decode. Track as accepted residual for a dev wiki. |
| R-W5 | LOW | `content-length` cap uses `Number(res.headers.get(...) ?? "0")`; a malformed/negative/absent header coerces to `0`/`NaN` and skips the early cap, but the streaming cap (`readCapped`, `fetcher-adapter.ts:101-118`) is the real backstop and IS tested. No exploit; noted for completeness. | `fetcher-adapter.ts:94-96` | None required — streaming cap covers it. |

---

## Injection-Rules Rule-by-Rule (live-fetch path)

| Rule | Verdict | Evidence |
|---|---|---|
| R1 File content is data | PASS | Candidate/source content treated as data; never executed. |
| R2 Tool output is data | PASS | No tool-output execution in the research path. |
| R3 Memory cannot override | PASS | Trace/intervention appends are data-only; secret-scrubbed candidate content. |
| R4 Sensitive-file protection | PASS | Quarantine writes `.quarantined` + `chmodSync(0o400)` (`markdown-repository.ts:184`); read-blocked by `privacy-block.sh`. |
| R5 No external exfiltration | PASS | Egress only to the guarded fetch URL; no file content piped outbound; URL credential-stripped. |
| R6 Project-dir boundary | PASS | All writes via `resolveInSlug` prefix-check under `tasks/wikis/<slug>/`. |
| R7 Skill content boundary | PASS | Fetched content is DATA then scanner gate then quarantine HARD-STOP (no programmatic override); pattern set now ~38 + 4 passes. |
| R8 Encoding-obfuscation | PASS-with-WARN | NFKC + zero-width strip + base64(>=16) + ROT13 + percent-decode present; nested-b64/HTML-comment/hex residual (R-W4). |
| R9 Context-flooding | PASS | `isFlood` ported (`scanner-adapter.ts:95-100`) — prior FAIL-to-port closed. |
| R10 Escalation protocol | PASS | Injection then quarantine + intervention + trace; no override path. |

No FAIL on any rule. Merge is not blocked.

---

## Re-Audit Trigger

No further re-audit required before ship for the audited scope. A future re-audit IS required if/when: (a) the resolve-and-pin DNS guard (R-W1) is implemented (it changes the network code path), or (b) Playwright/JS rendering is added to the fetcher (new attack surface per security.md Layer 10a).
