---
name: meow:browse
preamble-tier: 1
version: 1.1.0
description: |
  Fast headless browser for QA testing and site dogfooding. Navigate any URL, interact with
  elements, verify page state, diff before/after actions, take annotated screenshots, check
  responsive layouts, test forms and uploads, handle dialogs, and assert element states.
  ~100ms per command. Use when you need to test a feature, verify a deployment, dogfood a
  user flow, or file a bug with evidence. Use when asked to "open in browser", "test the
  site", "take a screenshot", or "dogfood this".
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
source: gstack
---

<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# browse: QA Testing & Dogfooding

Persistent headless Chromium browser for QA testing and site dogfooding. First call auto-starts (~3s), then ~100ms per command. State persists between calls (cookies, tabs, login sessions). Use `$B <command>` for all browser interactions.

## When to Use

- User asks to "open in browser", "test the site", "take a screenshot", or "dogfood this"
- Verifying a deployment or feature works end-to-end
- Filing a bug with visual evidence (annotated screenshots, console errors, network logs)
- Testing user flows (login, forms, uploads, dialogs)
- Comparing responsive layouts or diffing environments (staging vs prod)

## Workflow

1. **Initialize** — run preamble, verify browse binary, apply shared protocols. See `references/preamble.md`, `references/setup.md`, `references/shared-protocols.md`
2. **Navigate + interact** — use browse commands (goto, snapshot, click, fill) to explore the target. See `references/command-reference.md`, `references/snapshot-flags.md`
3. **Verify + capture** — follow QA patterns, handle handoffs for CAPTCHAs/MFA, take screenshots. See `references/qa-patterns.md`, `references/user-handoff.md`
4. **Report** — show screenshots via Read tool, report completion status, run telemetry. See `references/shared-protocols.md`

## References

- `references/preamble.md` — Preamble bash block, upgrade check, lake intro, telemetry prompt
- `references/shared-protocols.md` — AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status Protocol, Telemetry, Plan Status Footer
- `references/setup.md` — Browse binary setup check and one-time build
- `references/qa-patterns.md` — 11 core QA patterns (page verify, user flows, assertions, responsive, dialogs, uploads, diffs, screenshots)
- `references/snapshot-flags.md` — Snapshot flag reference (-i, -c, -d, -s, -D, -a, -o, -C), ref numbering, output format
- `references/user-handoff.md` — Handoff/resume for CAPTCHAs, MFA, OAuth
- `references/command-reference.md` — Full command list (navigation, reading, interaction, inspection, visual, snapshot, meta, tabs, server)

## Gotchas

- **SPA content not rendered**: Headless browser captures DOM before JS hydration completes → Add explicit wait for selector or networkidle before assertions
- **Auth-gated pages return 401**: Session cookies expire between commands → Re-authenticate or pass cookies explicitly before each protected page test
