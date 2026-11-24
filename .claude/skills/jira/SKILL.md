---
name: mk:jira
description: "Jira routing hub to the mk:jira leaf. Not an executor."
phase: on-demand
source: local
keywords:
  - jira
  - jira-router
  - routing-hub
  - atlassian
  - mk-jira
  - ticket
when_to_use: "Jira leaf unclear."
user-invocable: true
owner: jira
criticality: medium
status: active
runtime: claude-code
requires_external_service: ["jira"]
default_enabled: false
dependency_edges:
  - id: mk:confluence
    type: peer
  - id: mk:cook
    type: peer
  - id: mk:intake
    type: peer
  - id: mk:jira-admin
    type: peer
  - id: mk:jira-agile
    type: peer
  - id: mk:jira-analyst
    type: peer
  - id: mk:jira-bulk
    type: peer
  - id: mk:jira-collaborate
    type: peer
  - id: mk:jira-dev
    type: peer
  - id: mk:jira-estimator
    type: peer
  - id: mk:jira-evaluator
    type: peer
  - id: mk:jira-fields
    type: peer
  - id: mk:jira-issue
    type: peer
  - id: mk:jira-jsm
    type: peer
  - id: mk:jira-lifecycle
    type: peer
  - id: mk:jira-ops
    type: peer
  - id: mk:jira-relationships
    type: peer
  - id: mk:jira-search
    type: peer
  - id: mk:jira-time
    type: peer
  - id: mk:planning-engine
    type: peer
  - id: mk:ship
    type: peer
  - id: mk:story-sizer
    type: peer
---

# mk:jira — Routing Skill

> Script paths in this skill's other files (references, steps) are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.

This skill is a **pure routing layer**. Its sole purpose: identify the right `mk:jira-*` leaf for the user's Jira task, then point at it. **No execution.**

## Routing Table

| User intent                                  | Leaf skill              |
| -------------------------------------------- | ----------------------- |
| Get/create/update/delete a single issue      | `mk:jira-issue`         |
| Find issues by criteria; export; filters     | `mk:jira-search`        |
| Transition, assign, resolve; versions, components | `mk:jira-lifecycle` |
| Comments, attachments, watchers              | `mk:jira-collaborate`   |
| Issue links, blockers, dependencies, clone   | `mk:jira-relationships` |
| Worklogs, time tracking, time reports        | `mk:jira-time`          |
| Epics, sprints, backlog                      | `mk:jira-agile`         |
| Custom field discovery + configuration       | `mk:jira-fields`        |
| Change 10+ issues at once                    | `mk:jira-bulk`          |
| Service Management (queues, SLAs, customers) | `mk:jira-jsm`           |
| Project/user/group/scheme administration     | `mk:jira-admin`         |
| Branch name, PR body, commit links           | `mk:jira-dev`           |
| Cache + project-context discovery            | `mk:jira-ops`           |
| Score a ticket's complexity and inconsistencies | `mk:jira-evaluator`  |
| Suggest story points for one ticket          | `mk:jira-estimator`     |
| Read one ticket's context, media, root cause | `mk:jira-analyst`       |
| Size draft stories that are not tickets yet  | `mk:story-sizer`        |

Neighbouring leaves, told apart:

- Show a ticket's fields = `mk:jira-issue`; explain its context, attachments or root cause = `mk:jira-analyst`.
- Complexity or quality = `mk:jira-evaluator`; points = `mk:jira-estimator`; writing points to a ticket = `mk:jira-agile` or `mk:jira-issue`.
- Bulk verbs split by CLI group: `bulk-link` runs in `mk:jira-relationships`, `bulk-log` in `mk:jira-time`; `mk:jira-bulk` owns the `bulk` group (transition, assign, set-priority, clone, delete) and `search bulk-update`. All of them run `--dry-run` first.

## Setup

See `references/install-and-auth.md` for one-time setup (`mewkit skill env jira` installs `jira-as` into `.meowkit/envs/jira/`; populate `.meowkit/.env` with the 3 `MEOW_JIRA_*` vars).

## Shared Resources (used by leaves)

- `scripts/jira-as.sh` — env-translating wrapper (`MEOW_JIRA_*` → `JIRA_*`, sets `JIRA_OUTPUT=json`)
- `scripts/jql-sanitize.sh` — JQL escaping for user-derived terms
- `scripts/requirements.txt` — pip dependency manifest read by `mewkit skill env jira`
- `references/install-and-auth.md` — setup, exit codes, DC/mTLS caveats
- `references/cli-idioms.md` — verified jira-as syntax + `jq` projection rules
- `references/safety-framework.md` — 4-tier safety model
- `references/evaluation-rubric.md` — used by `mk:jira-evaluator`
- `references/estimation-guide.md` — used by `mk:jira-estimator`
- `../jira-fields/references/field-discovery.md` — used by `mk:jira-fields`

## Handoff

Report consumers (`mk:planning-engine`, `mk:intake`) are documented in their own skills.

## Gotchas

- mk:jira itself never executes; if you're in this skill thinking about jira-as commands, you're in the wrong place — forward to a leaf.
- Escape hatch: if jira-as is unusable (mTLS, multi-profile), users may invoke Atlassian MCP directly per `references/install-and-auth.md`. The router does NOT auto-fallback.
