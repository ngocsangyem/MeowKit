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

The orchestrator routes by skill names:

| Intent | Use |
| --- | --- |
| Quick codebase search or architecture fingerprint | `mk:scout` |
| Implementation pipeline | `mk:plan-creator` → `mk:cook` |
| Bug investigation / root cause | `mk:investigate` → `mk:fix` |
| Current library/API documentation | `mk:docs-finder` |
| Project documentation updates | `mk:document-release` or `mk:docs-init` |
| Verification build/lint/test/typecheck | `mk:verify` or `mk:lint-and-validate` |
| Code review / pre-landing audit | `mk:review` |
| Browser or UI QA | `mk:qa`, `mk:qa-manual`, `mk:playwright-cli`, or `mk:agent-browser` |
| Visual explanation / diagrams / slides | `mk:preview` |
| Media or document analysis/generation | `mk:multimodal` |
| Security audit | `mk:cso` or `mk:vulnerability-scanner` |
| Skill creation | `mk:skill-creator` |
| AI-friendly docs index | `mk:llms` |

Pick one primary skill per distinct intent.

If a task spans domains, run the workflow skill first (`mk:plan-creator`, `mk:cook`, `mk:fix`, or `mk:harness`) and load the domain skill at the phase where it is needed.
