---
title: "mk:confluence"
description: "Routing skill — recommends the correct mk:confluence-* leaf for any Confluence Cloud task. Pure router; no execution."
---

# mk:confluence — Routing Skill

## What This Skill Does

`mk:confluence` is a **pure routing layer**. Its sole purpose is to identify the right `mk:confluence-*` leaf for the user's Confluence Cloud task and point at it. **No execution.**

Confluence execution lives in 5 thin leaf skills (each forks a dedicated agent in `.claude/agents/`) backed by the `confluence-as` CLI installed via `npx mewkit setup`. The hub itself never invokes the wrapper.

## When to Use

- **Triggers:** "confluence", "wiki page", "spec page", ambiguous Confluence intent
- **NOT for:** Direct execution — forward to a specific `mk:confluence-{leaf}`. If you already know the leaf, invoke it directly.

## Routing Table

| User intent | Leaf skill |
|---|---|
| Get/create/update/delete a single page or blog post; copy/move/version | [`mk:confluence-page`](/reference/skills/confluence-page) |
| Search pages with CQL; list spaces; export results | [`mk:confluence-search`](/reference/skills/confluence-search) |
| Deep spec analysis: requirements, gaps, suggested stories | [`mk:confluence-spec-analyst`](/reference/skills/confluence-spec-analyst) |
| Bulk ops on 10+ pages (label, move, delete) — dry-run mandatory | [`mk:confluence-bulk`](/reference/skills/confluence-bulk) |
| Comments, attachments, labels, watchers (collaboration surface) | [`mk:confluence-collaborate`](/reference/skills/confluence-collaborate) |

## Disambiguation

- Numeric token (likely page ID) + verb → match verb to leaf
- Uppercase short token (likely space key) + read intent → `mk:confluence-search`
- CQL syntax (`=`, `AND`, `OR`, `currentUser()`) → `mk:confluence-search`
- 10+ items / `bulk` / `batch` / `mass` keyword → `mk:confluence-bulk`
- Spec analysis intent (`requirements`, `acceptance criteria`, `analyze the spec`) → `mk:confluence-spec-analyst`
- **Labels:** `mk:confluence-collaborate` owns label CRUD. Routing "label page X" → collaborate, NOT page.
- **Comments / attachments / watchers:** always `mk:confluence-collaborate`, even if scoped to a single page.
- Truly ambiguous → ask one clarifying question.

## Setup

One-time:

```bash
npx mewkit setup           # auto-installs confluence-as into .claude/skills/.venv
cp .claude/.env.example .claude/.env
# edit MEOW_CONFLUENCE_API_TOKEN, MEOW_CONFLUENCE_EMAIL, MEOW_CONFLUENCE_SITE_URL
```

Cloud-only — the wrapper exits 3 on non-`*.atlassian.net` URLs. For Server / Data Center, use the Atlassian MCP escape hatch documented in `references/install-and-auth.md`. The hub does NOT auto-fallback.

## Architecture

```
mk:confluence (router, ≤80 lines)              ← recommends a leaf, never executes
├── shared resources (used by all 5 leaves):
│   ├── scripts/{confluence-as.sh, cql-sanitize.sh}
│   ├── scripts/{adf-to-md.sh, adf_to_md.py}    ← macro-aware ADF→Markdown walker
│   ├── scripts/requirements.txt                 ← pip deps installed by mewkit setup
│   └── references/{install-and-auth, cli-idioms, safety-framework}.md
└── 5 leaf skills (each: context: fork → matching agent in .claude/agents/)
    ├── confluence-page          — single-page CRUD + hierarchy + version
    ├── confluence-search        — CQL search + space list + saved filters + export
    ├── confluence-spec-analyst  — deep spec analysis (read-only at Confluence side)
    ├── confluence-bulk          — bulk ops on 10+ pages with mandatory dry-run
    └── confluence-collaborate   — comments / attachments / labels / watchers
```

## Handoff

- `mk:planning-engine` accepts `--spec <report-path>` pointing at a `mk:confluence-spec-analyst` report; user runs spec-analyst FIRST, then passes the path.
- `mk:intake` recognizes Confluence URLs (`*.atlassian.net/wiki/spaces/...`) and raw page IDs as a 5th source; fetches page content directly via the wrapper, recommends spec-analyst for deeper analysis.
- No write-back from `mk:cook` — Confluence write paths are out of scope of the implementation pipeline.

## Gotchas

- `mk:confluence` itself never executes; if you find yourself thinking about `confluence-as` commands inside this skill, you're in the wrong place — forward to a leaf.
- Binary name is `confluence-as` (NOT `confluence` despite some upstream README docs). The wrapper handles this; leaves call the wrapper.
- ADF round-trip is lossy on macros (panel / expand / mention / decision / task-list / media). For read-side macro preservation, `mk:confluence-spec-analyst` uses the macro-aware `adf-to-md.sh` walker.
