# the toolkit Skills Index

Centralized registry of all skills. Updated: 2026-03-30 (v1.1.0).

## By Phase

### Phase 0 — Orient

```toon
[13]{skill,owner,type,architecture}
`mk:agent-detector`|orchestrator|utility|monolithic
`mk:help`|orchestrator|utility|monolithic
`mk:lazy-agent-loader`|orchestrator|utility|monolithic
`mk:project-context`|orchestrator|utility|monolithic
`mk:scale-routing`|orchestrator|utility|monolithic
`mk:scout`|orchestrator|cross-cutting|monolithic
`mk:session-continuation`|orchestrator|cross-cutting|monolithic
`mk:task-queue`|orchestrator|utility|monolithic
`mk:team-config`|orchestrator|utility|monolithic
`mk:workflow-orchestrator`|orchestrator|cross-cutting|monolithic
`mk:memory`|analyst|memory|monolithic
`mk:skill-creator`|orchestrator|utility|monolithic
`mk:worktree`|orchestrator|utility|script-backed (v2.9.5: Node.js CLI `scripts/worktree.cjs`; 6 commands: create/merge/cleanup/list/status/prune; `--orchestrated` flag for parallel agent isolation; `--json` + `--dry-run` on all commands)
```

### Phase 1 — Plan

```toon
[8]{skill,owner,type,architecture}
`mk:plan-creator`|planner|planning|step-file (v1.5.0: scope challenge, multi-file output, plan red team, sync-back, **--product-level mode** for green-field app builds via step-03a; **--deep mode** for per-phase scouting; **--tdd flag** injects TDD sections into phase files; **standalone subcommands**: archive/red-team/validate; outputs `red-team-findings.md`; solution design checklist in each phase; memory capture at Gate 1)
`mk:plan-ceo-review`|planner|planning|monolithic (v2.0: layered verification pipeline — pre-screen + two-lens eval + severity tiers + adversarial necessity + append-only verdict)
`mk:validate-plan`|planner|planning|monolithic
`mk:brainstorming`|brainstormer|planning|monolithic
`mk:office-hours`|brainstormer/planner|planning|monolithic
`mk:grill`|brainstormer|planning|monolithic (one-question-at-a-time interview of the user's plan/design; checkpoints to `docs/knowledge/<slug>.md`; read-only on source; hands off to skill-creator/plan-creator/project-context)
`mk:party`|orchestrator/brainstormer|planning|monolithic
`mk:planning-engine`|planner|planning|monolithic
```

### Phase 2 — Test RED

```toon
[6]{skill,owner,type,architecture}
`mk:testing`|tester|testing|monolithic
`mk:nyquist`|tester|testing|monolithic
`mk:lint-and-validate`|tester|testing|monolithic
`mk:qa`|tester|testing|monolithic
`mk:qa-manual`|tester|testing|monolithic
`mk:playwright-cli`|tester|testing|monolithic
```

### Phase 3 — Build GREEN

```toon
[20]{skill,owner,type,architecture}
`mk:development`|developer|development|monolithic
`mk:cook`|developer|development|monolithic
`mk:fix`|developer|development|monolithic
`mk:investigate`|tester/developer|development|monolithic
`mk:simplify`|developer|development|monolithic
`mk:clean-code`|developer|development|monolithic
`mk:sequential-thinking`|developer|development|monolithic
`mk:problem-solving`|developer|development|monolithic
`mk:project-organization`|developer|development|monolithic
`mk:bootstrap`|developer|development|monolithic
`mk:verify`|developer|development|monolithic
`mk:loop`|developer|development|monolithic (references; bounded git-tracked metric-optimization loop, boundary-gated, leaf executor — calls no orchestration skill)
`mk:build-fix`|developer|development|monolithic
`mk:api-design`|architect|development|monolithic
`mk:database`|developer|development|monolithic
`mk:decision-framework`|planner|development|monolithic
`mk:figma`|ui-ux-designer|development|monolithic
`mk:jira`|orchestrator|integration|monolithic
`mk:intake`|orchestrator|integration|monolithic
`mk:agent-browser`|developer|development|monolithic
```

#### Language/Framework Skills (Phase 3)

```toon
[8]{skill,owner,type,architecture}
`mk:typescript`|developer|development|monolithic
`mk:vue`|developer|development|monolithic
`mk:vue-best-practices`|developer|development|monolithic (invoke-only deep Vue best-practices review + ordered authoring workflow; read-only Read/Grep/Glob; complements mk:vue)
`mk:angular`|developer|development|monolithic
`mk:react-patterns`|developer|development|monolithic
`mk:frontend-design`|developer|development|monolithic
`mk:ui-design-system`|developer|development|monolithic
`mk:vue-testing-best-practices`|tester|testing|monolithic (invoke-only Vue test-design advisor + test-code reviewer; read-only Read/Grep/Glob; complements mk:vue-best-practices)
```

### Integration / On-Demand

Hub skills route to leaf agents via the `mk:jira` and `mk:confluence` hubs. Each leaf skill maps 1-to-1 to a domain agent.

#### Jira sub-skills (routed by `mk:jira` hub)

```toon
[14]{skill,owner,type,architecture}
`mk:jira-admin`|jira|integration|monolithic
`mk:jira-agile`|jira|integration|monolithic
`mk:jira-analyst`|jira|integration|monolithic
`mk:jira-bulk`|jira|integration|monolithic
`mk:jira-dev`|jira|integration|monolithic
`mk:jira-estimator`|jira|integration|monolithic
`mk:jira-evaluator`|jira|integration|monolithic
`mk:jira-fields`|jira|integration|monolithic
`mk:jira-jsm`|jira|integration|monolithic
`mk:jira-lifecycle`|jira|integration|monolithic
`mk:jira-ops`|jira|integration|monolithic
`mk:jira-relationships`|jira|integration|monolithic
`mk:jira-search`|jira|integration|monolithic
`mk:jira-time`|jira|integration|monolithic
```

#### Confluence skills (hub + sub-skills)

```toon
[6]{skill,owner,type,architecture}
`mk:confluence`|confluence|integration|monolithic
`mk:confluence-bulk`|confluence|integration|monolithic
`mk:confluence-collaborate`|confluence|integration|monolithic
`mk:confluence-page`|confluence|integration|monolithic
`mk:confluence-search`|confluence|integration|monolithic
`mk:confluence-spec-analyst`|confluence|integration|monolithic
```

### Phase 4 — Review

```toon
[10]{skill,owner,type,architecture}
`mk:review`|reviewer|review|**step-file** (4 steps)
`mk:rubric`|evaluator|review|monolithic (v1.0.0: 7 rubrics + 4 composition presets at .claude/rubrics/, weighted graded grading with PASS/WARN/FAIL anchors and load/compose/validate scripts; frontend-app preset pruned to 4 distinctive rubrics in v2.0.0 per audit 260408)
`mk:evaluate`|evaluator|review|**step-file** (v1.0.0: 5 steps — load-rubrics → boot-app → probe-criteria → grade-and-verdict → feedback-to-generator. Active-verification HARD GATE: validate-verdict.sh rejects PASS verdicts with empty evidence/. Skeptic persona enforced on every criterion grading.)
`mk:sprint-contract`|developer (propose/amend) + evaluator (review)|planning|monolithic (v1.0.0, 130 lines: propose/review/amend/sign actions inline. Phase 4 file-based contract negotiation between generator and evaluator before source edits. Enforced by gate-enforcement.sh; bypassable via MEOWKIT_AUTOBUILD_MODE=LEAN.)
`mk:autobuild`|orchestrator (planner/developer/evaluator/shipper agents dispatched per step)|orchestration|**step-file** (v1.0.0: 7 steps — tier-detection → plan → contract → generate → evaluate → iterate-or-ship → run-report. Adaptive density MINIMAL/FULL/LEAN. Budget tracker with $30 warn / $100 block. 6h hard timeout. Resumable via --resume.)
`mk:trace-analyze`|researcher (3 parallel) + main agent synthesis|analysis|**step-file** (v1.0.0: 6 steps — ingest → partition → scatter → gather → suggestions → HITL gate. Reads `.claude/memory/trace-log.jsonl`, finds patterns via error-taxonomy, mandatory HITL approval. Anti-overfit threshold ≥3 occurrences.)
`mk:benchmark`|orchestrator (invokes mk:autobuild per spec)|measurement|monolithic (v1.0.0: run/compare subcommands. Quick tier 5 tasks ≤$5; full tier 6 tasks ≤$30. Records to `.claude/benchmarks/results/{run-id}.json` + trace-log.jsonl. Backs the dead-weight audit with measured deltas.)
`mk:elicit`|reviewer|review|monolithic
`mk:review-pr`|reviewer|review|monolithic (v0.1.0: single shallow correctness/security/breaking/AI-slop pass on a GitHub PR → Summary/Risk/Findings/Verdict. Default prints; --reply posts via gh pr review. Read-only on code. Shallow lane vs mk:review's deep Gate-2 engine.)
`mk:respond-pr`|reviewer|review|monolithic (v0.1.0: triage reviewer comments with receiving-review discipline — verify each vs codebase, then accept/push-back/clarify. Default dry; --reply posts in-thread. Never edits code — accepted items hand off to mk:fix.)
```

### Security (Phase 2, 4)

```toon
[3]{skill,owner,type,architecture}
`mk:cso`|security/reviewer|security|monolithic
`mk:vulnerability-scanner`|security/reviewer|security|monolithic
`mk:skill-template-secure`|security|security|monolithic
```

### Phase 5 — Ship

```toon
[1]{skill,owner,type,architecture}
`mk:ship`|shipper|deployment|monolithic
```

### Phase 6 — Reflect

```toon
[6]{skill,owner,type,architecture}
`mk:document-release`|shipper/documenter|documentation|monolithic
`mk:docs-init`|documenter|documentation|monolithic
`mk:llms`|documenter|documentation|monolithic
`mk:retro`|analyst/documenter|memory|monolithic
`mk:context-audit`|documenter|documentation|monolithic
`mk:prompt-enhancer`|documenter|documentation|monolithic
```

### Cross-Cutting (Any Phase)

```toon
[12]{skill,owner,trigger}
`mk:ask-me`|any agent|Evidence-grounded project Q&A — "how does X work here", claim-checks, constraint summaries — answered with cited `file:line` sources. Read-only; redirects ideation/decisions/debugging/review to the owning specialist skill.
`mk:careful`|any agent|Before destructive commands
`mk:freeze`|any agent|Debug session scoping
`mk:docs-finder`|any agent (primary: researcher)|Library/API documentation lookup
`mk:multimodal`|any agent|Visual content analysis
`mk:web-to-markdown`|any agent|Fetch arbitrary URLs as clean markdown — use when URL is not covered by mk:docs-finder. Static-only by default; Playwright opt-in via `.claude/scripts/bin/setup-workflow --system-deps`.
`mk:henshin`|any agent|Planning front door for wrapping existing code as agent-consumable surfaces (CLI + MCP + companion skill). Produces a Transformation Spec; hands off to `mk:plan-creator` → `mk:cook`. Adapted from external agentization patterns.
`mk:preview`|any agent|Generate visual artifacts — markdown or self-contained HTML — for explanations, diagrams, slide decks, git diffs, and plan rendering. Display only; not for plan critique (mk:plan-ceo-review) or media generation (mk:multimodal).
`mk:story-sizer`|story-sizer|Pre-ticket Fibonacci sizing of paste-mode user stories. Default writes a Story Sizing Report. Opt-in `--auto-create` delegates to `mk:jira-issue` + `mk:jira-collaborate` with a single batch confirmation gate.
`mk:chom`|researcher|Copy-cat / replicate features from external systems, repos, or ideas into the current project
`mk:pack`|developer|Pack an external repository into a single AI-friendly file for third-party analysis or handoff to external LLMs
`mk:resolving-merge-conflicts`|git-manager|Resolve an in-progress git merge/rebase conflict — read state, recover each side's intent, resolve hunks, run checks, finish the merge/rebase. Most often during ship; always resolves (never --abort); NOT the full ship pipeline (see mk:ship)
```

## Summary

```toon
[11]{category,count}
Planning|6
Testing|7
Development|27
Review|8
Security|3
Deployment|2
Documentation|4
Memory|2
Utility|12
Cross-Cutting|7
**Total**|**106**
```

Note: Some skills appear in multiple categories (scout, investigate). Count reflects primary category. `mk:memory` counted under Memory (not Utility). `mk:retro` counted under Memory (not Documentation).

## Architecture Types

- **Monolithic** — Single SKILL.md file. Used for skills <150 lines.
- **Step-file** — SKILL.md + workflow.md + step-NN-*.md. Used for skills with 3+ phases.

Currently step-file enabled:
- `mk:plan-creator` — 9 steps (00–08)
- `mk:review` — 5 steps (includes step-02b persona passes)
- `mk:evaluate` — 5 steps
- `mk:autobuild` — 7 steps
- `mk:trace-analyze` — 6 steps
