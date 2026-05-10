---
title: "mk:jira"
description: "Routing skill — recommends the correct mk:jira-* leaf for any Jira task. Pure router; no execution."
---

# mk:jira — Routing Skill

## What This Skill Does

`mk:jira` is a **pure routing layer** as of v2.8.3. Its sole purpose is to identify the right `mk:jira-*` leaf for the user's Jira task and point at it. **No execution.**

The Atlassian-MCP-coupled implementation has been removed. Jira execution now lives in 16 thin leaf skills (each forks a dedicated agent in `.claude/agents/`) backed by the `jira-as` CLI installed via `npx mewkit setup`.

## When to Use

- **Triggers:** "jira", "jira ticket", ambiguous Jira intent
- **NOT for:** Direct execution — forward to a specific `mk:jira-{leaf}`. If you already know the leaf, invoke it directly.

## Routing Table

| User intent | Leaf skill |
|---|---|
| Get/create/update/delete a single issue | [`mk:jira-issue`](/reference/skills/jira-issue) |
| Find issues by criteria; export; filters | [`mk:jira-search`](/reference/skills/jira-search) |
| Transition through workflow; assign; resolve | [`mk:jira-lifecycle`](/reference/skills/jira-lifecycle) |
| Comments, attachments, watchers, notify | [`mk:jira-collaborate`](/reference/skills/jira-collaborate) |
| Issue links, blockers, dependencies | [`mk:jira-relationships`](/reference/skills/jira-relationships) |
| Worklogs, time tracking, reports | [`mk:jira-time`](/reference/skills/jira-time) |
| Epics, sprints, backlog, story points | [`mk:jira-agile`](/reference/skills/jira-agile) |
| Custom field discovery + configuration | [`mk:jira-fields`](/reference/skills/jira-fields) |
| Bulk ops (10+ issues, dry-run mandatory) | [`mk:jira-bulk`](/reference/skills/jira-bulk) |
| Service Management (queues, SLAs, customers) | [`mk:jira-jsm`](/reference/skills/jira-jsm) |
| Project/user/group/scheme administration | [`mk:jira-admin`](/reference/skills/jira-admin) |
| Git/PR/branch-name integration | [`mk:jira-dev`](/reference/skills/jira-dev) |
| Cache + project-context discovery | [`mk:jira-ops`](/reference/skills/jira-ops) |
| Evaluate ticket complexity + inconsistencies | [`mk:jira-evaluator`](/reference/skills/jira-evaluator) |
| Estimate story points (heuristic) | [`mk:jira-estimator`](/reference/skills/jira-estimator) |
| Analyze ticket context + media; RCA | [`mk:jira-analyst`](/reference/skills/jira-analyst) |

## Setup

One-time:

```bash
npx mewkit setup           # auto-installs jira-as into .claude/skills/.venv
cp .claude/.env.example .claude/.env
# edit MEOW_JIRA_API_TOKEN, MEOW_JIRA_EMAIL, MEOW_JIRA_SITE_URL
```

The SessionStart hook `jira-env-loader.sh` validates `.claude/.env` and emits `[mk:jira] env OK` / `[mk:jira] <KEY> missing`. The wrapper `scripts/jira-as.sh` translates `MEOW_JIRA_*` → native `JIRA_*` env per call.

See [Environment Variables — Jira](/reference/configuration#jira) for the full list.

## Architecture

```
mk:jira (router, ≤80 lines)              ← recommends a leaf, never executes
├── shared resources (used by all 16 leaves):
│   ├── scripts/{jira-as.sh, jql-sanitize.sh, fetch-workflow.sh}
│   ├── scripts/requirements.txt          ← pip deps installed by mewkit setup
│   └── references/{install-and-auth, cli-idioms, safety-framework}.md
└── 16 thin leaf skills (each: context: fork → matching agent in .claude/agents/)
    ├── 13 domain leaves (issue, search, lifecycle, collaborate, relationships, time,
    │                     agile, fields, bulk, jsm, admin, dev, ops)
    └── 3 intelligence leaves (evaluator, estimator, analyst)

tasks/jira-workflows/              ← discovered Jira workflow cache (NEW in 2.8.3)
├── README.md
├── _schemes/<PROJECT_KEY>.md      ← project → workflow-name mapping
└── <workflow-slug>.md             ← full statuses + transitions per workflow
```

## Handoff

- `mk:intake` → recommends the right `mk:jira-*` leaf based on triage
- `mk:planning-engine` → consumes `mk:jira-evaluator` + `mk:jira-estimator` reports for capacity analysis
- `mk:cook` Phase 3 → may invoke `mk:jira-issue` to create implementation tickets
- `mk:ship` Phase 5 → may invoke `mk:jira-dev` for branch-name + PR description

## Gotchas

- `mk:jira` itself never executes; if you find yourself thinking about `jira-as` commands inside this skill, you're in the wrong place — forward to a leaf.
- **Escape hatch**: if `jira-as` is unusable (mTLS, multi-profile), invoke Atlassian MCP directly per `references/install-and-auth.md`. The router does NOT auto-fallback.
