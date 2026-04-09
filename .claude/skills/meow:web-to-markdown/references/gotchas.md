# meow:web-to-markdown — Gotchas

Concrete edge cases and operational surprises. Each entry explains why it matters and how to mitigate it.

---

## Gotcha: robots.txt respected by default

**Why it matters:** This skill checks `robots.txt` before fetching. A rate-limit-free domain (no Crawl-delay) may still include a `Disallow: /` for all bots or for the MeowKit user-agent. The fetch will return `ERROR: robots.txt denies fetch` even on publicly accessible pages. Silence is not always consent — legitimate content producers opt out of crawling.

**Mitigation:** Set `MEOWKIT_WEB_FETCH_RESPECT_ROBOTS=0` to disable the check entirely. Use sparingly — only when you have explicit permission to fetch or the domain is known to not enforce robots. Default is ON (check respected).

---

## Gotcha: 10 MB size cap truncates long articles

**Why it matters:** The default cap is 10,485,760 bytes (10 MB). Some legitimate pages — deep API references, RFCs, single-page documentation sites — exceed this. The fetch returns `ERROR: page exceeds size cap` and no content is returned, not a truncated result.

**Mitigation:** Raise the cap via `MEOWKIT_WEB_FETCH_MAX_BYTES=<bytes>`. Hard ceiling is 100 MB regardless. If the page is genuinely large, consider fetching sub-pages or using the `--api-spec` flag for structured extraction.

---

## Gotcha: Mojibake on non-UTF-8 / non-Latin pages

**Why it matters:** The skill uses `charset-normalizer` (via `requests.apparent_encoding`) for encoding detection. For pages in Cyrillic, Arabic, CJK, or other non-Latin scripts encoded in legacy charsets (Windows-1251, Shift-JIS, GB2312), detection is best-effort. Garbled text passes injection scanning and lands in the report as readable-looking garbage.

**Mitigation:** No clean workaround in v1. If markdown output looks garbled, the source page likely uses a non-standard charset. Manual inspection of the raw bytes is needed. `html_to_markdown.maybe_fix_mojibake` applies NFKC normalization but cannot recover from a wrong charset guess.

---

## Gotcha: False-positive "thin content" detection

**Why it matters:** The `is_thin_content` heuristic rejects responses with fewer than ~200 characters of readable markdown. Pages that are heavily nav-link-only, or that require JavaScript rendering to populate body content, return empty or near-empty markdown from the static path. The skill reports this as thin content and may return an error rather than partial content.

**Mitigation:** Enable Playwright opt-in (see Gotcha: JS rendering opt-in). For nav-only pages that are legitimately thin (sitemaps, redirect pages), the thin detection is working correctly — there is no body content to fetch.

---

## Gotcha: Injection scanner is best-effort — DATA boundary is the real defense

**Why it matters:** The 6-pass injection scanner catches known patterns (role override, encoding obfuscation, delimiter injection, tool-call hijack, memory poisoning). Novel phrasing, obfuscated variants, or patterns not yet in the pattern set may pass all six scans undetected. An adversarial page author with knowledge of the scanner can craft content that slips through.

**Mitigation:** The DATA boundary wrap (`\`\`\`fetched-markdown from=...`) is the load-bearing defense — it signals to the consuming agent that content is untrusted data, not instructions. The injection scanner adds defense-in-depth but must not be treated as a complete guarantee. Do not send fetched content directly to tools without the DATA wrapper.

---

## Gotcha: JS rendering requires three independent conditions

**Why it matters:** Playwright rendering is triple-gated. ALL three must be true simultaneously:

1. `playwright` package installed (via `mewkit setup --system-deps`, ~200MB download)
2. `MEOWKIT_WEB_FETCH_JS=1` environment variable set
3. Per-call `js=True` argument passed to `fetch_as_markdown()`

Missing any single gate silently falls back to static fetch. If static fetch returns thin content and all three gates are not met, the skill returns an error, not a Playwright result.

**Mitigation:** Run `npx mewkit setup --system-deps` to install Playwright, then set `MEOWKIT_WEB_FETCH_JS=1` in your environment, and pass `js=True` at the call site. Verify all three before assuming JS rendering is active.

---

## Gotcha: Fetch reports accumulate unbounded on disk

**Why it matters:** Every successful fetch writes a report file to `.claude/cache/web-fetches/`. There is no TTL-based cleanup in v1. A session that fetches dozens of pages will grow the cache proportionally and permanently. The cache is never pruned automatically.

**Mitigation:** Manual cleanup:

```bash
rm -rf .claude/cache/web-fetches/*.md         # clear regular reports
rm -rf .claude/cache/web-fetches/quarantine/  # clear quarantine (REVIEW FIRST)
```

TTL auto-cleanup is deferred to v2 (`mewkit setup --clean-fetches`). Add the cache directory to `.gitignore`

---

## Gotcha: Reports may contain PII — secret scrub is regex-based

**Why it matters:** The pre-write secret scrub covers known patterns (API keys, JWTs, AWS credentials, bearer tokens, basic auth URLs). It does not catch free-text PII (names, emails, phone numbers embedded in page content), custom token formats, or novel secret layouts. A report file written to `.claude/cache/web-fetches/` may contain sensitive information not caught by the scrubber.

**Mitigation:** Never commit `.claude/cache/` to git (`.gitignore` covers this). Treat all report files as potentially sensitive. If a page is known to contain PII, review the report before sharing or persisting it outside the cache directory.

---

## Gotcha: Per-domain rate limit applies per process — resets on restart

**Why it matters:** The rate limiter (default 2000 ms between calls to the same host) is in-memory only. It is NOT persisted across processes or sessions. If the parent process restarts between calls, the throttle counter resets and consecutive calls to the same host may go out at full speed on session start.

**Mitigation:** Configure `MEOWKIT_WEB_FETCH_THROTTLE_MS` to a conservative value. Set to `0` only for domains you control. For long-running batch fetches, keep the same process alive across calls rather than restarting between them.

---

## Gotcha: Cross-skill delegation requires explicit opt-in flag

**Why it matters:** Any skill other than a direct user invocation must pass `--wtm-accept-risk` when delegating to `meow:web-to-markdown`. Without this flag, the skill refuses with `ERROR: cross-skill delegation requires --wtm-accept-risk flag`. This prevents implicit invocation from skills that haven't consciously acknowledged the injection risk of fetching arbitrary URLs.

**Mitigation:** Always pass `--wtm-accept-risk` (or `wtm_accept_risk=True` in Python) when delegating from another skill. This flag is a conscious trust-boundary crossing — the caller acknowledges that the target URL may contain prompt injection and that the skill's defenses are best-effort. See `references/security.md` §3 for full flag semantics.
