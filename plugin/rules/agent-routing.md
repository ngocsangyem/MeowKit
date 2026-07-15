---
source: original
applies_to: [Phase 0, all]
# Unconditional load — orchestrator always needs the routing table.
---

# Agent Routing

| Agent           | Role                                             | Phase     |
| --------------- | ------------------------------------------------ | --------- |
| orchestrator    | Route tasks, assign model tier                   | 0         |
| planner         | Scope-adaptive plan (fast/hard/deep), Gate 1     | 1         |
| architect       | ADRs, system design                              | 1         |
| researcher      | Technology research, library evaluation          | 0, 1, 4   |
| brainstormer    | Trade-off analysis, solution exploration         | 1         |
| tester          | Write failing tests first                        | 2         |
| developer       | TDD implementation                               | 3         |
| ui-ux-designer  | UI design, accessibility, design systems         | 3         |
| security        | Audit, BLOCK verdicts                            | 2, 4      |
| reviewer        | Structural audit, Gate 2                         | 4         |
| evaluator       | Behavioral verification, rubric grading          | 3, 4      |
| shipper         | Deploy pipeline                                  | 5         |
| git-manager     | Git operations, conventional commits             | 5         |
| documenter      | Living docs, changelogs                          | 6         |
| analyst         | Cost tracking, patterns                          | 0, 6      |
| journal-writer  | Failure docs, root cause analysis                | 6         |
| project-manager | Cross-workflow delivery tracking, status reports | on-demand |

No two agents modify the same file type. Conflicts → escalate to human.

## Artifact Ownership

Each agent's `## Exclusive Ownership` section is the authoritative source for
write-artifact patterns. This routing table deliberately does not duplicate a
pattern-to-owner registry; the generated inventory is the consolidated view.

**Opt-out:** `MEOWKIT_PM_AUTO=off` disables all silent (background) project-manager fires from orchestration skills. User-invoked `/mk:status` is always honored. See `.claude/rules/post-phase-delegation.md` for fire points and skip conditions.

## Domain Integration Agents (routed by hub skills, NOT by orchestrator)

The 21 domain integration agents below are NOT scored by `mk:agent-detector` and are NOT in the table above. They live behind their hub skill's routing layer; the hub picks the leaf based on intent + verb match.

| Hub skill | Agent count | Agents | CLI backend |
| --- | ---: | --- | --- |
| `mk:jira` | 16 | jira-issue, jira-search, jira-lifecycle, jira-collaborate, jira-relationships, jira-time, jira-agile, jira-fields, jira-bulk, jira-jsm, jira-admin, jira-dev, jira-ops, jira-evaluator, jira-estimator, jira-analyst | `jira-as` |
| `mk:confluence` | 5 | confluence-page, confluence-search, confluence-spec-analyst, confluence-bulk, confluence-collaborate | `confluence-as` |

**Routing flow:** `mk:agent-detector` (Phase 0) → if scale-routing CSV matches `jira` or `confluence` keywords, route to the hub skill → hub disambiguates and forks the leaf agent via the matching `mk:<domain>-<leaf>` skill. Orchestrator never invokes a domain agent directly.

**Why excluded:** Domain agents use hub-level routing and separate wrapper safety, so core orchestrator scoring stays focused.

## Skill Domain Routing

The intent → skill dispatch table is not needed to assign an agent or model tier, so
it is loaded on demand rather than always-on. It lives in
`.claude/skills/agent-detector/references/skill-domain-routing.md` and is read once per
session by `mk:agent-detector` at Step 0b (sentinel-cached).
