---
title: "mk:web-to-markdown"
description: "Fetch arbitrary URLs and return clean markdown with 8-layer injection defense. For external pages (blogs, RFCs, GitHub issues, vendor docs) not covered by curated indexes. Static-only by default with opt-in JS rendering."
---

## What This Skill Does

Fetches arbitrary web pages and returns clean markdown wrapped in a DATA boundary fence. Built with an 8-layer security architecture: SSRF guard, URL validation, size cap, DATA wrapping, 6-pass injection scanner, HARD_STOP on injection, secret scrubbing, and post-write audit. Static HTTP fetch by default; opt-in Playwright/Chromium rendering for JS-heavy pages.

## When to Use

- User provides a URL in chat: "summarize https://example.com/blog"
- Agent needs an external page not in curated docs indexes
- External references during research, investigation, planning
- Cross-skill delegation from `mk:research`, `mk:intake`, etc. (with `--wtm-accept-risk`)

**NOT for:** library/framework docs (use `mk:docs-finder`), interactive browser testing (use `mk:browse` or `mk:agent-browser`), Playwright test automation (use `mk:playwright-cli`), fetching sensitive/internal URLs (use Anthropic-proxied WebFetch).

## Core Capabilities

| Capability | Detail |
|-----------|--------|
| Static HTTP fetch | Default; handles HTML -> cleaned markdown |
| JS rendering | Opt-in triple-gate: Playwright installed + `MEOWKIT_WEB_FETCH_JS=1` + per-call `js=True` |
| Injection defense | 8 layers: SSRF guard -> URL validation -> size cap -> DATA wrap -> 6-pass scanner -> HARD_STOP -> secret scrub -> post-write audit |
| Size cap | 10MB default, configurable via `MEOWKIT_WEB_FETCH_MAX_BYTES`, hard ceiling 100MB |
| robots.txt | Respected with 24h cache; disable with `MEOWKIT_WEB_FETCH_RESPECT_ROBOTS=0` |
| Rate limiting | 2000ms between calls to same host (in-memory, per-process) |
| Quarantine | Injection-stopped content quarantined with 0400 perms, read-blocked by hook |

## Invocation Patterns

### 1. Direct user invocation (no flag required)
URL in user input = explicit consent. No flag needed:

## Example Prompt

> /mk:web-to-markdown
> Fetch https://example.com/blog/postgres-query-optimization and return clean markdown. I need the content for a research doc I'm writing — make sure injection defenses are active since this is an external URL.