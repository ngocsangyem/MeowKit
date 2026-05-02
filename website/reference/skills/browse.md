---
title: "mk:browse (removed)"
description: "Retired. Superseded by mk:agent-browser."
---

# `mk:browse` — removed

The `mk:browse` skill was retired in this release. All browser automation is now handled by [`mk:agent-browser`](./agent-browser).

## Migration

See the [migration guide](https://github.com/) bundled with the `agent-browser` skill: `.claude/skills/agent-browser/references/migrating-from-browse.md`. It covers verb-to-verb mapping (`$B goto` → `agent-browser open`, `$B snapshot -i` → `agent-browser snapshot -i`, etc.), recipes for capabilities `agent-browser` doesn't ship natively (responsive screenshots, link enumeration, performance timing), and a developer-machine runbook for handoff/CAPTCHA/MFA flows that previously used `$B handoff`.

## Why

`mk:browse` and `mk:agent-browser` covered overlapping use cases. Consolidating onto one skill removes the routing decision between them and reduces maintenance surface.

## What changed

- `mk:browse` SKILL.md and references removed.
- Catalog entries dropped from `SKILLS_INDEX.md` and `.meowkit.manifest.json`.
- Historical attribution preserved in `SKILLS_ATTRIBUTION.md` under the `## Removed` section.
- Cross-skill callers (`mk:qa`, `mk:office-hours`, `mk:fix`, `mk:evaluate`, `mk:chom`, `mk:agent-detector`, `mk:sprint-contract`, `mk:retro`, `mk:qa-manual`, `mk:ui-ux-designer`, `mk:evaluator`) now use `mk:agent-browser` directly or paste the relevant recipe from the migration guide.
