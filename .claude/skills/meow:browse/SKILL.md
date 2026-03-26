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
author: garrytan (gstack)
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

1. **Run preamble** — initialize gstack session, check for upgrades, handle first-run prompts. See `references/preamble.md`
2. **Follow MeowKit shared protocols** — AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status, Telemetry, Plan Status Footer. See `references/shared-protocols.md`
3. **Run setup check** — verify `$B` binary exists; if `NEEDS_SETUP`, prompt user and build. See `references/setup.md`
4. **Navigate and interact** — use `$B goto`, `$B snapshot`, `$B click`, `$B fill`, etc. See `references/command-reference.md`
5. **Use QA patterns** — follow established patterns for page verification, user flows, assertions, responsive testing, visual evidence. See `references/qa-patterns.md`
6. **Use snapshot flags** — combine `-i`, `-c`, `-D`, `-a`, `-C`, etc. for targeted inspection. See `references/snapshot-flags.md`
7. **Hand off when blocked** — use `$B handoff` / `$B resume` for CAPTCHAs, MFA, OAuth. See `references/user-handoff.md`
8. **Show screenshots** — always use the Read tool on output PNGs so the user can see them
9. **Report status** — use Completion Status Protocol (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT)
10. **Run telemetry** — log session duration and outcome. See `references/shared-protocols.md`

## References

- `references/preamble.md` — Preamble bash block, upgrade check, lake intro, telemetry prompt
- `references/shared-protocols.md` — AskUserQuestion format, Completeness Principle, Repo Ownership, Search Before Building, Contributor Mode, Completion Status Protocol, Telemetry, Plan Status Footer
- `references/setup.md` — Browse binary setup check and one-time build
- `references/qa-patterns.md` — 11 core QA patterns (page verify, user flows, assertions, responsive, dialogs, uploads, diffs, screenshots)
- `references/snapshot-flags.md` — Snapshot flag reference (-i, -c, -d, -s, -D, -a, -o, -C), ref numbering, output format
- `references/user-handoff.md` — Handoff/resume for CAPTCHAs, MFA, OAuth
- `references/command-reference.md` — Full command list (navigation, reading, interaction, inspection, visual, snapshot, meta, tabs, server)
