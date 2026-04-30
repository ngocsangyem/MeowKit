---
title: "mk:web-to-markdown"
description: "Fetch arbitrary URLs as clean markdown with SSRF guard, 6-pass injection scanner, and DATA-boundary content wrapping."
---

# mk:web-to-markdown

Fetch a URL and return clean markdown. Use when the agent needs an arbitrary external page (blog, RFC, GitHub issue, vendor doc) that is not covered by `mk:docs-finder`. Triggers on URLs in chat.

## What This Skill Does

Most documentation flows go through `mk:docs-finder` (Context7 → Context Hub → WebSearch). That works for libraries with curated indexes. But blog posts, RFCs, vendor changelogs, GitHub issues, and one-off vendor pages often aren't in any curated source. `mk:web-to-markdown` is the **tier-4 fallback** — an arbitrary-URL → clean-markdown skill with security defenses suitable for entering untrusted content into the agent context.

## Core Capabilities

- **Static fetch by default** — `requests` + `readability-lxml` + `html2text` for clean markdown extraction without a browser
- **Optional Playwright** — JS-rendered pages via opt-in three-layer gate (package present + env var + per-call flag); off by default
- **SSRF guard** — `safe_url()` rejects non-http(s) schemes, credentials in netloc, private/loopback/link-local/reserved/multicast IPv4 + IPv6, hostname blocklist, DNS resolution failure
- **Streaming size cap** — 10MB default via `iter_content` + `lxml huge_tree=False`; configurable via `MEOWKIT_WEB_FETCH_MAX_BYTES`
- **6-pass injection scanner** — vendored Lasso patterns (MIT) + MeowKit-specific patterns + base64 / ROT13 / Unicode NFKC / zero-width / context-flood detection
- **HARD_STOP on injection** — no programmatic bypass. Hits are quarantined to `.claude/cache/web-fetches/quarantine/{sha256}.quarantined` and require manual user inspection
- **DATA boundary wrapping** — every fetched page enters the agent context inside ` ```fetched-markdown from={url} ` fences. Both saved reports AND the preview returned to the agent are wrapped — load-bearing per `injection-rules.md` Rule 7
- **Fetch persistence** — successful fetches write to `.claude/cache/web-fetches/{YYMMDD}-{HHMMSS}-{host}-{sha256[:10]}.md`. The skill returns a 2KB preview + path; agent reads full content via `Read` on demand. Token-efficient (Anthropic's just-in-time context engineering)
- **Per-domain rate limit** — 1 req/2s default via `time.monotonic()`; configurable via `MEOWKIT_WEB_FETCH_THROTTLE_MS=0` to disable
- **robots.txt respected** — 24h TTL cache at `.claude/cache/web-to-markdown/robots-cache.json`; kill switch `MEOWKIT_WEB_FETCH_RESPECT_ROBOTS=0`
- **Honest User-Agent** — `MeowKit/1.0 (+https://meowkit.dev/skills/web-to-markdown)` (no browser spoofing)
- **Secret scrub before persist** — regex scrubber catches AWS keys, JWTs, bearer tokens, PEM private keys, basic-auth before report files are written

## When to Use This

::: tip Use mk:web-to-markdown when...

- The URL is a blog post, RFC, GitHub issue, vendor changelog — anything `mk:docs-finder` can't reach
- You need clean markdown extraction from a page (not raw HTML)
- The page is static or you're willing to opt into Playwright for JS rendering
- You're delegated to it via `mk:docs-finder` tier-4 fallback or another skill passing `--wtm-accept-risk`
  :::

::: warning Don't use mk:web-to-markdown when...

- The URL is in a curated index → use `mk:docs-finder` (Context7/chub/WebSearch)
- You need interactive browser testing → use `mk:browse` or `mk:agent-browser`
- You're delegating without `--wtm-accept-risk` → cross-skill delegation is blocked by design
  :::

## Cross-skill delegation gate

Other skills MUST pass `--wtm-accept-risk` to delegate a fetch to `mk:web-to-markdown`. Without the flag, those skills CANNOT call web-to-markdown — they fall back to `mk:docs-finder` (Context7/chub/WebSearch). The flag forces conscious crossing of the trust boundary.

Documented delegation gates (Phase 3):

- `mk:intake`, `mk:investigate` — skill-level
- `researcher`, `planner`, `analyst` — agent-level

## docs-finder integration

`mk:docs-finder` invokes web-to-markdown as **tier-4 fallback** when Context7 / Context Hub / WebSearch all return empty or off-target results. The `--wtm-approve` flag promotes web-to-markdown to **tier-1** (skips Context7/chub/WebSearch entirely) — used when the user knows the target URL is not in any curated index.

## Usage

```bash
# Direct URL invocation (auto-triggers on URL detection in chat)
https://blog.example.com/post

# Via docs-finder tier-4 fallback (automatic when other tiers fail)
/mk:docs-finder some obscure topic

# Via docs-finder priority override
/mk:docs-finder https://specific-url.com --wtm-approve

# Cross-skill delegation (other skills must pass)
--wtm-accept-risk
```

## Environment variables

| Variable                           | Default    | Effect                                            |
| ---------------------------------- | ---------- | ------------------------------------------------- |
| `MEOWKIT_WEB_FETCH_PERSIST`        | `on`       | `off` returns full content inline, no disk write  |
| `MEOWKIT_WEB_FETCH_JS`             | `0`        | `1` enables Playwright (requires opt-in install)  |
| `MEOWKIT_WEB_FETCH_MAX_BYTES`      | `10485760` | Per-fetch size cap (capped at 100MB hard ceiling) |
| `MEOWKIT_WEB_FETCH_THROTTLE_MS`    | `2000`     | Per-domain rate limit; `0` disables               |
| `MEOWKIT_WEB_FETCH_RESPECT_ROBOTS` | `1`        | `0` disables robots.txt check                     |

## Dependencies

**Static fetch (always required):**

```bash
.claude/skills/.venv/bin/pip install -r scripts/requirements.txt
# requests, readability-lxml, html2text, lxml, charset-normalizer
```

**Optional JS rendering (opt-in, three-layer gate):**

1. Install via `npx mewkit setup --system-deps` (200MB chromium download)
2. Set `MEOWKIT_WEB_FETCH_JS=1`
3. Pass `js=True` per call

All three required.

## Security model

See `references/security.md` inside the skill for the full threat model. Key layers:

| #   | Layer                   | Defense                                                        |
| --- | ----------------------- | -------------------------------------------------------------- |
| 1   | Path/venv               | `.claude/cache/web-fetches/` (NOT memory), `.venv/bin/python3` |
| 2   | SSRF                    | `safe_url()` IPv4+IPv6 + hostname blocklist + DNS validation   |
| 3   | Size cap                | Streaming 10MB + `huge_tree=False`                             |
| 4   | DATA boundary           | Triple-backtick fence wrap on report + preview                 |
| 5   | Injection scan          | 6 passes (Lasso patterns + encoding + flood + delimiter)       |
| 6   | HARD_STOP               | Quarantine + security-log; no programmatic bypass              |
| 7   | Secret scrub            | Regex scrubber before persist                                  |
| 8   | Post-write library scan | `injection-audit.scan_file` via `importlib` (NOT a hook)       |

## Known limitations

- **DNS TOCTOU / rebinding** — `safe_url` resolves once; `requests.get` re-resolves. Mitigated at network layer (egress firewall to RFC1918). Full single-resolve-by-IP deferred due to TLS SNI complexity.
- **Naive eTLD+1 redirect check** — last-2-label comparison breaks on `.co.uk`, `.com.au`. PSL integration deferred.
- **Linux apt-get per-dep transactions** — schema-driven `mewkit setup --system-deps` issues separate sudo prompts for ffmpeg/imagemagick (cost of registry-driven simplicity).
- **Manual cache cleanup** — `.claude/cache/web-fetches/` grows unbounded in v1. TTL auto-cleanup deferred. Cleanup: `rm -rf .claude/cache/web-fetches/*`.
- **Reports may contain PII** — secret-scrub catches credentials but not names/emails/user IDs in body text. Treat cached reports as sensitive.
- **No `--approve` override** — once the injection scanner halts a fetch, manual user inspection of the quarantine file is the only recovery path. **Programmatic `--approve` flag deferred** to a future release.

## Files

- `SKILL.md` — entrypoint
- `references/security.md` — full threat model + defense layers
- `references/gotchas.md` — 10 enumerated gotchas
- `scripts/fetch_as_markdown.py` — public API + orchestration
- `scripts/http_fetch.py` — `safe_url` SSRF guard + streaming fetch
- `scripts/injection_detect.py` + `injection_patterns.py` — 6-pass scanner (Lasso vendored)
- `scripts/persist_fetch.py` — atomic write + flock manifest + Layer 8 audit
- `scripts/secret_scrub.py` — credential regex scrubber
- `scripts/robots_cache.py` — 24h TTL robots.txt cache
- `scripts/rate_limit.py` — per-host monotonic-clock throttle
- `scripts/html_to_markdown.py` — HTML extraction (readability + lxml + html2text)
- `tests/test_smoke_real_urls.py` — skip-by-default real-URL smoke tests
